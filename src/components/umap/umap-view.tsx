import { useState, useRef, useEffect, useMemo, useCallback, useReducer } from 'react';
import { Upload, X, Eye, EyeOff, Crosshair, Loader2, Pin, ChevronDown, Info } from 'lucide-react';
import { useUploadedFiles } from '../../contexts/uploaded-files-context';
import { useSearchParams } from 'react-router-dom';
import { useFile } from '../../contexts/file-context';
import { useBucket } from '../../contexts/bucket-context';
import { useBedUmap } from '../../queries/use-bed-umap';
import { EmbeddingPlot, type EmbeddingPlotRef } from './embedding-plot';
import { EmbeddingLegend } from './embedding-legend';
import { EmbeddingTable } from './embedding-table';
import { EmbeddingSelections } from './embedding-selections';
import { EmbeddingStats } from './embedding-stats';
import type { UmapPoint, LegendItem } from '../../lib/umap-utils';

type SelectionState = {
  preselected: UmapPoint[];
  bucket: UmapPoint[];
  interactive: UmapPoint[];
  pending: UmapPoint[] | null;
};

type SelectionAction =
  | { type: 'SET_PRESELECTED'; points: UmapPoint[] }
  | { type: 'SET_BUCKET'; points: UmapPoint[] }
  | { type: 'SET_INTERACTIVE'; points: UmapPoint[] }
  | { type: 'SET_PENDING'; points: UmapPoint[] | null }
  | { type: 'APPLY_PENDING' }
  | { type: 'CLEAR_INTERACTIVE' }
  | { type: 'REMOVE_INTERACTIVE_POINT'; identifier: string };

function selectionReducer(state: SelectionState, action: SelectionAction): SelectionState {
  switch (action.type) {
    case 'SET_PRESELECTED': return { ...state, preselected: action.points };
    case 'SET_BUCKET': return { ...state, bucket: action.points };
    case 'SET_INTERACTIVE': return { ...state, interactive: action.points };
    case 'SET_PENDING': return { ...state, pending: action.points };
    case 'APPLY_PENDING': return { ...state, interactive: state.pending || [], pending: null };
    case 'CLEAR_INTERACTIVE': return { ...state, interactive: [] };
    case 'REMOVE_INTERACTIVE_POINT': return { ...state, interactive: state.interactive.filter(p => p.identifier !== action.identifier) };
  }
}

function dedup(...arrays: UmapPoint[][]): UmapPoint[] {
  const seen = new Set<string>();
  const merged: UmapPoint[] = [];
  for (const arr of arrays) {
    for (const p of arr) {
      if (!seen.has(p.identifier)) { seen.add(p.identifier); merged.push(p); }
    }
  }
  return merged;
}

export function UmapView() {
  const { bedFile, setBedFile, umapCoordinates, setUmapCoordinates, lockFileSwitch, unlockFileSwitch } = useFile();
  const { enabledBedIds, removeBedFromEnabled, resetBucketsOnMount } = useBucket();
  const [searchParams, setSearchParams] = useSearchParams();
  const getBedUmap = useBedUmap();

  const { files: uploadedFiles, addFiles, setActiveIndex } = useUploadedFiles();
  const plotRef = useRef<EmbeddingPlotRef>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileVisible, setFileVisible] = useState(true);
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const filePickerRef = useRef<HTMLDivElement>(null);

  // State managed here, not in context
  const [colorGrouping, setColorGrouping] = useState('cell_line_category');
  const [legendItems, setLegendItems] = useState<LegendItem[]>([]);
  const [pinnedCategories, setPinnedCategories] = useState<number[]>([]);
  // umapCoordinates is persisted in FileContext so it survives UmapView remounts (e.g., split view)
  // Pass null to the plot when hidden to remove the point without clearing the cache
  const customCoordinates = fileVisible ? umapCoordinates : null;
  const setCustomCoordinates = setUmapCoordinates;
  const [preselectedMatch, setPreselectedMatch] = useState<{ matched: number; total: number }>({ matched: 0, total: 0 });

  // Consolidated selection state
  const [selection, dispatch] = useReducer(selectionReducer, {
    preselected: [],
    bucket: [],
    interactive: [],
    pending: null,
  });

  // Derived: persistent = preselected + bucket (deduplicated)
  const persistentPoints = useMemo(
    () => dedup(selection.preselected, selection.bucket),
    [selection.preselected, selection.bucket],
  );

  // Derived: all visible = persistent + interactive (for table, selections, stats)
  const allVisiblePoints = useMemo(
    () => dedup(persistentPoints, selection.interactive),
    [persistentPoints, selection.interactive],
  );

  // URL params → preselected IDs (sticky until cleared)
  const preselectedIds = useMemo(() => {
    const single = searchParams.get('bed');
    const multi = searchParams.get('beds');
    if (single) return [single];
    if (multi) return multi.split(',').filter(Boolean);
    return [];
  }, [searchParams]);

  // Disable stale buckets on mount unless navigated via "View on UMAP"
  useEffect(() => { resetBucketsOnMount(); }, []);

  // When preselection changes (e.g. "View on UMAP" clicked from split analysis), center on the point
  const firstPreselectedId = preselectedIds[0];
  useEffect(() => {
    if (firstPreselectedId) {
      plotRef.current?.centerOnBedId(firstPreselectedId, 0.2);
    }
  }, [firstPreselectedId]);

  // Center on custom point when navigating to UMAP with an existing uploaded file
  const hasCenteredCustomRef = useRef(false);
  useEffect(() => {
    if (customCoordinates && !firstPreselectedId && !hasCenteredCustomRef.current) {
      // Delay to let EmbeddingPlot finish initializing and adding the custom point
      const timer = setTimeout(() => {
        plotRef.current?.centerOnBedId('custom_point', 0.2, true);
      }, 500);
      hasCenteredCustomRef.current = true;
      return () => clearTimeout(timer);
    }
    if (!customCoordinates) hasCenteredCustomRef.current = false;
  }, [customCoordinates, firstPreselectedId]);

  // All highlighted IDs: preselected + buckets (deduplicated)
  const bedIds = useMemo(() => {
    const ids = new Set([...preselectedIds, ...enabledBedIds]);
    return Array.from(ids);
  }, [preselectedIds, enabledBedIds]);

  const clearPreselection = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('bed');
      next.delete('beds');
      return next;
    }, { replace: true });
  };

  // Remove old point from plot when coordinates are cleared (file switch from any source)
  const prevCoordsRef = useRef(umapCoordinates);
  useEffect(() => {
    if (prevCoordsRef.current && !umapCoordinates) {
      plotRef.current?.handleFileRemove();
    }
    prevCoordsRef.current = umapCoordinates;
  }, [umapCoordinates]);

  useEffect(() => {
    if (!bedFile) {
      if (umapCoordinates) {
        setCustomCoordinates(null);
      }
      unlockFileSwitch('umap');
      return;
    }
    // Skip re-projection if coordinates are already cached (e.g., remount from split view)
    if (umapCoordinates) return;
    if (preselectedIds.length > 0) clearPreselection();
    lockFileSwitch('umap');
    getBedUmap.mutate(bedFile, {
      onSuccess: (coords) => { setCustomCoordinates(coords); unlockFileSwitch('umap'); },
      onError: () => { console.error('Failed to project file onto UMAP'); unlockFileSwitch('umap'); },
    });
  }, [bedFile]);

  // Release lock on unmount so it doesn't stay locked if UMAP tab is closed
  useEffect(() => () => unlockFileSwitch('umap'), [unlockFileSwitch]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const name = file.name.toLowerCase();
    if (!name.endsWith('.bed') && !name.endsWith('.bed.gz')) return;
    addFiles([file]);
    setBedFile(file);
    setFileVisible(true);
  };

  const handleToggleVisibility = () => {
    if (fileVisible) {
      setFileVisible(false);
      plotRef.current?.handleFileRemove();
    } else {
      setFileVisible(true);
    }
  };

  const handleSwitchFile = (file: File, idx: number) => {
    setBedFile(file);
    setActiveIndex(idx);
    setFileVisible(true);
    setShowFilePicker(false);
  };

  // Close file picker on outside click
  useEffect(() => {
    if (!showFilePicker) return;
    function handleClick(e: MouseEvent) {
      if (filePickerRef.current && !filePickerRef.current.contains(e.target as Node)) {
        setShowFilePicker(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showFilePicker]);

  const handleTogglePin = useCallback(
    (category: number) => plotRef.current?.handleTogglePin(category),
    [],
  );

  const handlePinAll = useCallback(
    () => plotRef.current?.handlePinAll(legendItems.map((item) => item.category)),
    [legendItems],
  );

  const handleUnpinAll = useCallback(
    () => plotRef.current?.handleUnpinAll(),
    [],
  );

  const handleLocateCustomPoint = () => {
    plotRef.current?.centerOnBedId('custom_point', 0.2, true);
  };

  const handleRemovePoint = useCallback((identifier: string) => {
    dispatch({ type: 'REMOVE_INTERACTIVE_POINT', identifier });
    removeBedFromEnabled(identifier);
  }, [removeBedFromEnabled]);

  return (
    <div className="flex flex-col overflow-hidden p-4 @md:p-6 gap-2" style={{ height: 'calc(100vh - 52px)' }}>
      <title>BEDbase | UMAP</title>
      <meta name="description" content="Interactive UMAP visualization of BED file embeddings. Explore similarity across genomic region datasets." />
      {/* Main: plot + sidebar */}
      <div className="flex flex-1 gap-2 overflow-hidden min-h-0">
        <div className="flex-[77.5] flex flex-col gap-2 min-w-0 overflow-hidden">
          <div className="border border-base-300 rounded-lg overflow-hidden flex-1 min-h-0 relative">
            {/* Preselection chip — top left */}
            {preselectedIds.length > 0 && (
              <div className="absolute top-2 left-2 z-10">
                {preselectedMatch.matched > 0 ? (
                  <div className="inline-flex items-center gap-1.5 text-xs font-medium bg-base-100 rounded-md overflow-hidden">
                    <div className="inline-flex items-center gap-1.5 bg-primary/10 px-2.5 py-1.5">
                    <button
                      onClick={() => {
                        if (preselectedIds.length > 0) plotRef.current?.centerOnBedId(preselectedIds[0], 0.2);
                      }}
                      className="text-primary hover:text-primary/80 cursor-pointer transition-colors shrink-0"
                      title="Locate on plot"
                    >
                      <Pin size={12} />
                    </button>
                    <span className="text-primary">
                      {preselectedMatch.matched === preselectedMatch.total
                        ? `${preselectedMatch.matched} pinned`
                        : `${preselectedMatch.matched}/${preselectedMatch.total} pinned`}
                    </span>
                    <button
                      onClick={clearPreselection}
                      className="hover:text-error text-primary/60 cursor-pointer transition-colors"
                      title="Clear pinned points"
                    >
                      <X size={12} />
                    </button>
                    </div>
                  </div>
                ) : preselectedMatch.total > 0 ? (
                  <div className="inline-flex items-center gap-1.5 text-xs font-medium bg-base-100 rounded-md overflow-hidden">
                    <div className="inline-flex items-center gap-1.5 bg-warning/10 px-2.5 py-1.5">
                    <Pin size={12} className="text-warning shrink-0" />
                    <span className="text-warning">
                      Not in UMAP
                    </span>
                    <button
                      onClick={clearPreselection}
                      className="hover:text-error text-warning/60 cursor-pointer transition-colors"
                      title="Clear"
                    >
                      <X size={12} />
                    </button>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
            {/* File controls — top right */}
            <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5" ref={filePickerRef}>
              {bedFile ? (
                <>
                  {/* Action buttons */}
                  {getBedUmap.isPending ? (
                    <div className="w-7 h-7 rounded-md bg-base-200 flex items-center justify-center">
                      <Loader2 size={12} className="animate-spin text-primary" />
                    </div>
                  ) : fileVisible ? (
                    <button
                      onClick={handleLocateCustomPoint}
                      className="w-7 h-7 rounded-md bg-base-200 hover:bg-base-300 flex items-center justify-center text-base-content/40 hover:text-primary cursor-pointer transition-colors"
                      title="Locate on plot"
                    >
                      <Crosshair size={13} />
                    </button>
                  ) : null}
                  <button
                    onClick={handleToggleVisibility}
                    disabled={getBedUmap.isPending}
                    className={`w-7 h-7 rounded-md bg-base-200 flex items-center justify-center transition-colors ${getBedUmap.isPending ? 'opacity-40 cursor-not-allowed' : `cursor-pointer hover:bg-base-300 ${fileVisible ? 'text-base-content/40 hover:text-base-content/70' : 'text-base-content/30 hover:text-base-content/50'}`}`}
                    title={fileVisible ? 'Hide from plot' : 'Show on plot'}
                  >
                    {fileVisible ? <Eye size={13} /> : <EyeOff size={13} />}
                  </button>
                  {/* Filename chip + dropdown */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        if (!getBedUmap.isPending && uploadedFiles.length > 1) setShowFilePicker(!showFilePicker);
                      }}
                      className={`inline-flex items-center gap-1 text-xs font-medium bg-base-200 rounded-md px-2.5 py-1.5 transition-colors ${getBedUmap.isPending ? 'opacity-40 cursor-not-allowed' : uploadedFiles.length > 1 ? 'cursor-pointer hover:bg-base-300' : ''}`}
                    >
                      <span className={`truncate max-w-64 ${fileVisible ? 'text-base-content/70' : 'text-base-content/40'}`}>{bedFile.name}</span>
                      {uploadedFiles.length > 1 && (
                        <ChevronDown size={12} className={`text-base-content/30 transition-transform shrink-0 ${showFilePicker ? 'rotate-180' : ''}`} />
                      )}
                    </button>
                    {showFilePicker && (
                      <div className="absolute top-full right-0 mt-1 border border-base-300 rounded-lg shadow-lg z-20 overflow-hidden">
                      <div className="bg-base-100 py-1 max-h-52 overflow-y-auto">
                        {uploadedFiles.map((file, idx) => {
                          const isActive = bedFile && `${file.name}|${file.size}|${file.lastModified}` === `${bedFile.name}|${bedFile.size}|${bedFile.lastModified}`;
                          return (
                            <button
                              key={`${file.name}|${file.size}|${file.lastModified}`}
                              onClick={() => handleSwitchFile(file, idx)}
                              className={`flex items-center gap-2 w-full px-3 py-1.5 text-left text-xs hover:bg-base-200 transition-colors cursor-pointer whitespace-nowrap ${isActive ? 'bg-primary/5 font-medium' : ''}`}
                            >
                              <span className={`truncate ${isActive ? 'text-primary' : 'text-base-content'}`}>{file.name}</span>
                            </button>
                          );
                        })}
                      </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-base-content/60 hover:text-base-content/80 bg-base-200 hover:bg-base-300 px-2.5 py-1.5 rounded-md transition-colors cursor-pointer"
                >
                  <Upload size={12} />
                  Upload BED
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".bed,.gz"
                className="hidden"
                disabled={getBedUmap.isPending}
                onChange={handleFileUpload}
              />
            </div>
            <EmbeddingPlot
              ref={plotRef}
              bedIds={bedIds.length > 0 ? bedIds : undefined}
              preselectedIds={preselectedIds.length > 0 ? preselectedIds : undefined}
              height={undefined}
              colorGrouping={colorGrouping}
              pinnedCategories={pinnedCategories}
              onPinnedCategoriesChange={setPinnedCategories}
              persistentPoints={persistentPoints}
              interactivePoints={selection.interactive}
              pendingPoints={selection.pending}
              onPreselectedChange={(points) => dispatch({ type: 'SET_PRESELECTED', points })}
              onBucketChange={(points) => dispatch({ type: 'SET_BUCKET', points })}
              onInteractiveChange={(points) => dispatch({ type: 'SET_INTERACTIVE', points })}
              onSetPending={(points) => dispatch({ type: 'SET_PENDING', points })}
              onApplyPending={() => dispatch({ type: 'APPLY_PENDING' })}
              onPreselectedMatchChange={(matched, total) => setPreselectedMatch({ matched, total })}
              onLegendItemsChange={setLegendItems}
              highlightPoints={[]}
              customCoordinates={customCoordinates}
              customFilename={bedFile?.name}
              simpleTooltip={false}
              showStatus
              className="h-full"
            />
            {/* Info button — bottom left */}
            <button
              onClick={() => setShowInfo(true)}
              className="absolute bottom-2 left-2 z-10 w-7 h-7 rounded-md bg-base-200 hover:bg-base-300 flex items-center justify-center text-base-content/40 hover:text-base-content/70 cursor-pointer transition-colors"
              title="About this visualization"
            >
              <Info size={13} />
            </button>
          </div>
          {/* Info modal */}
          {showInfo && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40" onClick={() => setShowInfo(false)}>
              <div className="bg-base-100 rounded-lg shadow-lg w-full max-w-md mx-4 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-4 py-3 border-b border-base-300 shrink-0">
                  <h3 className="text-sm font-semibold">BED File Embedding Space</h3>
                  <button onClick={() => setShowInfo(false)} className="p-1 rounded hover:bg-base-200 transition-colors cursor-pointer">
                    <X size={16} />
                  </button>
                </div>
                <div className="overflow-auto p-4 space-y-3">
                  <p className="text-xs text-base-content/60 leading-relaxed">
                    This UMAP visualizes BEDbase's hg38 BED files as points in a 2D embedding space. Files with similar genomic region content appear closer together, even if they come from different experiments or labs.
                  </p>
                  <p className="text-xs text-base-content/60 leading-relaxed">
                    Each file is embedded using a pre-trained region embedding model, and the resulting vectors are projected via UMAP for visualization.
                  </p>
                  <div className="text-xs text-base-content/60 space-y-1">
                    <p className="font-medium text-base-content">How to interact</p>
                    <ul className="list-disc pl-4 space-y-0.5">
                      <li>Click individual points to inspect them in the table</li>
                      <li>Lasso or range-select to capture groups of points</li>
                      <li>Save selections to compare across sessions</li>
                      <li>Upload a BED file to see where it falls in the space</li>
                      <li>Use the legend to filter and pin categories</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
          <EmbeddingTable
            selectedPoints={allVisiblePoints}
            preselectedIds={new Set(preselectedIds)}
            bucketIds={new Set(enabledBedIds)}
            centerOnBedId={(id, scale) => plotRef.current?.centerOnBedId(id, scale)}
            onRemovePoint={handleRemovePoint}
            className="h-48 shrink-0"
          />
        </div>
        <div className="@container flex-[22.5] flex flex-col gap-2 overflow-hidden min-h-0">
          <EmbeddingLegend
            legendItems={legendItems}
            pinnedCategories={pinnedCategories}
            onTogglePin={handleTogglePin}
            onPinAll={handlePinAll}
            onUnpinAll={handleUnpinAll}
            colorGrouping={colorGrouping}
            setColorGrouping={setColorGrouping}
          />
          <EmbeddingSelections currentSelection={allVisiblePoints} pinnedCategories={pinnedCategories} plotRef={plotRef} />
          <EmbeddingStats
            selectedPoints={allVisiblePoints}
            colorGrouping={colorGrouping}
            legendItems={legendItems}
            pinnedCategories={pinnedCategories}
          />
        </div>
      </div>
    </div>
  );
}
