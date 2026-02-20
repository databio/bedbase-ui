import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Upload, X, Crosshair, Loader2, Pin } from 'lucide-react';
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

export function UmapView() {
  const { bedFile, setBedFile } = useFile();
  const { enabledBedIds, createBucket } = useBucket();
  const [searchParams, setSearchParams] = useSearchParams();
  const getBedUmap = useBedUmap();

  const plotRef = useRef<EmbeddingPlotRef>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State managed here, not in context
  const [colorGrouping, setColorGrouping] = useState('cell_line_category');
  const [legendItems, setLegendItems] = useState<LegendItem[]>([]);
  const [filterSelection, setFilterSelection] = useState<LegendItem | null>(null);
  const [selectedPoints, setSelectedPoints] = useState<UmapPoint[]>([]);
  const [persistentPoints, setPersistentPoints] = useState<UmapPoint[]>([]);
  const [customCoordinates, setCustomCoordinates] = useState<number[] | null>(null);
  const [preselectedMatch, setPreselectedMatch] = useState<{ matched: number; total: number }>({ matched: 0, total: 0 });

  // URL params → preselected IDs (sticky until cleared)
  const preselectedIds = useMemo(() => {
    const single = searchParams.get('bed');
    const multi = searchParams.get('beds');
    if (single) return [single];
    if (multi) return multi.split(',').filter(Boolean);
    return [];
  }, [searchParams]);

  // All highlighted IDs: preselected + buckets (deduplicated)
  const bedIds = useMemo(() => {
    const ids = new Set([...preselectedIds, ...enabledBedIds]);
    return Array.from(ids);
  }, [preselectedIds, enabledBedIds]);

  // Combined view: persistent + interactive (for table, selections, stats)
  const allVisiblePoints = useMemo(() => {
    const seen = new Set<string>();
    const merged: UmapPoint[] = [];
    for (const p of persistentPoints) {
      if (!seen.has(p.identifier)) { seen.add(p.identifier); merged.push(p); }
    }
    for (const p of selectedPoints) {
      if (!seen.has(p.identifier)) { seen.add(p.identifier); merged.push(p); }
    }
    return merged;
  }, [persistentPoints, selectedPoints]);

  const clearPreselection = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('bed');
      next.delete('beds');
      return next;
    }, { replace: true });
  };

  useEffect(() => {
    if (!bedFile) {
      if (customCoordinates) {
        setCustomCoordinates(null);
        plotRef.current?.handleFileRemove();
      }
      return;
    }
    if (preselectedIds.length > 0) clearPreselection();
    getBedUmap.mutate(bedFile, {
      onSuccess: (coords) => setCustomCoordinates(coords),
      onError: () => console.error('Failed to project file onto UMAP'),
    });
  }, [bedFile]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const name = file.name.toLowerCase();
    if (!name.endsWith('.bed') && !name.endsWith('.bed.gz')) return;
    setBedFile(file);
  };

  const handleRemoveFile = () => {
    setBedFile(null);
    setCustomCoordinates(null);
    plotRef.current?.handleFileRemove();
  };

  const handleLegendClick = useCallback(
    (item: LegendItem) => plotRef.current?.handleLegendClick(item),
    [],
  );

  const handleSaveCategory = useCallback(
    async (item: LegendItem) => {
      const points = await plotRef.current?.queryByCategory(String(item.category));
      if (points && points.length > 0) {
        const ids = points.map((p) => p.identifier).filter((id) => id !== 'custom_point');
        createBucket(`Category: ${item.name}`, ids);
      }
    },
    [createBucket],
  );

  const handleLocateCustomPoint = () => {
    plotRef.current?.centerOnBedId('custom_point', 0.3);
  };

  return (
    <div className="flex flex-col overflow-hidden p-4 @md:p-6 gap-2" style={{ height: 'calc(100vh - 52px)' }}>
      {/* Main: plot + sidebar */}
      <div className="flex flex-1 gap-2 overflow-hidden min-h-0">
        <div className="flex-[77.5] flex flex-col gap-2 min-w-0 overflow-hidden">
          <div className="border border-base-300 rounded-lg overflow-hidden flex-1 min-h-0 relative">
            {/* Preselection chip — top left */}
            {preselectedIds.length > 0 && (
              <div className="absolute top-2 left-2 z-10">
                {preselectedMatch.matched > 0 ? (
                  <div className="inline-flex items-center gap-1.5 text-xs font-medium bg-white rounded-md overflow-hidden">
                    <div className="inline-flex items-center gap-1.5 bg-primary/10 px-2.5 py-1.5">
                    <button
                      onClick={() => {
                        if (preselectedIds.length > 0) plotRef.current?.centerOnBedId(preselectedIds[0], 0.1);
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
                  <div className="inline-flex items-center gap-1.5 text-xs font-medium bg-white rounded-md overflow-hidden">
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
            <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5">
              {bedFile ? (
                <div className="inline-flex items-center gap-1.5 text-xs font-medium bg-base-200 rounded-md px-2.5 py-1.5 transition-colors">
                  {getBedUmap.isPending ? (
                    <Loader2 size={12} className="animate-spin text-primary" />
                  ) : (
                    <button
                      onClick={handleLocateCustomPoint}
                      className="hover:text-primary cursor-pointer transition-colors"
                      title="Locate on plot"
                    >
                      <Crosshair size={12} />
                    </button>
                  )}
                  <span className="text-base-content/70 truncate max-w-64">{bedFile.name}</span>
                  <button onClick={handleRemoveFile} className="hover:text-error cursor-pointer transition-colors">
                    <X size={12} />
                  </button>
                </div>
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
                onChange={handleFileUpload}
              />
            </div>
            <EmbeddingPlot
              ref={plotRef}
              bedIds={bedIds.length > 0 ? bedIds : undefined}
              preselectedIds={preselectedIds.length > 0 ? preselectedIds : undefined}
              height={undefined}
              colorGrouping={colorGrouping}
              filterSelection={filterSelection}
              onFilterSelectionChange={setFilterSelection}
              selectedPoints={selectedPoints}
              onSelectedPointsChange={setSelectedPoints}
              onPersistentPointsChange={setPersistentPoints}
              onPreselectedMatchChange={(matched, total) => setPreselectedMatch({ matched, total })}
              onLegendItemsChange={setLegendItems}
              highlightPoints={[]}
              customCoordinates={customCoordinates}
              customFilename={bedFile?.name}
              simpleTooltip={false}
              showStatus
              className="h-full"
            />
          </div>
          <EmbeddingTable
            selectedPoints={allVisiblePoints}
            centerOnBedId={(id, scale) => plotRef.current?.centerOnBedId(id, scale)}
            className="h-48 shrink-0"
          />
        </div>
        <div className="flex-[22.5] flex flex-col gap-3 overflow-y-auto overscroll-contain">
          <EmbeddingLegend
            legendItems={legendItems}
            filterSelection={filterSelection}
            handleLegendClick={handleLegendClick}
            colorGrouping={colorGrouping}
            setColorGrouping={setColorGrouping}
            onSaveCategory={handleSaveCategory}
          />
          <EmbeddingSelections currentSelection={allVisiblePoints} />
          <EmbeddingStats
            selectedPoints={allVisiblePoints}
            colorGrouping={colorGrouping}
            legendItems={legendItems}
            filterSelection={filterSelection}
          />
        </div>
      </div>
    </div>
  );
}
