import { useReducer, useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { ChevronLeft, AlertTriangle, Plus, GitCompareArrows } from 'lucide-react';
import { RegionSet } from '@databio/gtars';
import { useTab } from '../../contexts/tab-context';
import { useFileSet } from '../../contexts/fileset-context';
import { parseBedFile, type BedEntry } from '../../lib/bed-parser';
import {
  computeMultiFileAnalysis,
  hasSetOperations,
  type MultiFileResult,
} from '../../lib/multi-file-analysis';
import { PlotGallery } from '../analysis/plot-gallery';
import { similarityHeatmapSlot } from './plots/jaccard-heatmap';
import { consensusPlotSlot } from './plots/consensus-plot';
import { chromosomeHeatmapSlot } from './plots/chromosome-heatmap';
import { consensusByChrSlot } from './plots/consensus-by-chr';
import type { PlotSlot } from '../../lib/plot-specs';

// --- State machine ---

type Phase = 'idle' | 'parsing' | 'analyzing' | 'done' | 'error';

type State = {
  phase: Phase;
  files: File[];
  parseProgress: { done: number; total: number; current: string };
  analysisProgress: number;
  regionSets: RegionSet[];
  fileNames: string[];
  result: MultiFileResult | null;
  error: string | null;
  wasmAvailable: boolean;
};

type Action =
  | { type: 'START_PARSE'; files: File[] }
  | { type: 'PARSE_PROGRESS'; done: number; total: number; current: string }
  | { type: 'PARSE_DONE'; regionSets: RegionSet[]; fileNames: string[]; wasmAvailable: boolean }
  | { type: 'ANALYSIS_PROGRESS'; fraction: number }
  | { type: 'ANALYSIS_DONE'; result: MultiFileResult }
  | { type: 'ERROR'; error: string }
  | { type: 'RESET' }
  | { type: 'RESTORE_CACHED'; fileNames: string[]; result: MultiFileResult };

const initialState: State = {
  phase: 'idle',
  files: [],
  parseProgress: { done: 0, total: 0, current: '' },
  analysisProgress: 0,
  regionSets: [],
  fileNames: [],
  result: null,
  error: null,
  wasmAvailable: true,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'START_PARSE':
      return { ...initialState, phase: 'parsing', files: action.files, parseProgress: { done: 0, total: action.files.length, current: '' } };
    case 'PARSE_PROGRESS':
      return { ...state, parseProgress: { done: action.done, total: action.total, current: action.current } };
    case 'PARSE_DONE':
      return { ...state, phase: 'analyzing', regionSets: action.regionSets, fileNames: action.fileNames, wasmAvailable: action.wasmAvailable };
    case 'ANALYSIS_PROGRESS':
      return { ...state, analysisProgress: Math.max(state.analysisProgress, action.fraction) };
    case 'ANALYSIS_DONE':
      return { ...state, phase: 'done', result: action.result };
    case 'ERROR':
      return { ...state, phase: 'error', error: action.error };
    case 'RESTORE_CACHED':
      return { ...initialState, phase: 'done', fileNames: action.fileNames, result: action.result, wasmAvailable: true };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

// --- Helpers ---

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function formatBp(bp: number): string {
  if (bp >= 1e9) return `${(bp / 1e9).toFixed(1)}G bp`;
  if (bp >= 1e6) return `${(bp / 1e6).toFixed(1)}M bp`;
  if (bp >= 1e3) return `${(bp / 1e3).toFixed(1)}K bp`;
  return `${bp} bp`;
}

async function collectBedFiles(items: DataTransferItemList): Promise<File[]> {
  const files: File[] = [];

  async function traverseEntry(entry: FileSystemEntry): Promise<void> {
    if (entry.isFile) {
      const file = await new Promise<File>((resolve) =>
        (entry as FileSystemFileEntry).file(resolve),
      );
      const name = file.name.toLowerCase();
      if (name.endsWith('.bed') || name.endsWith('.bed.gz')) {
        files.push(file);
      }
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      const entries = await new Promise<FileSystemEntry[]>((resolve) =>
        reader.readEntries(resolve),
      );
      for (const e of entries) await traverseEntry(e);
    }
  }

  const entries: FileSystemEntry[] = [];
  for (let i = 0; i < items.length; i++) {
    const entry = items[i].webkitGetAsEntry?.();
    if (entry) entries.push(entry);
  }

  if (entries.length > 0) {
    for (const entry of entries) await traverseEntry(entry);
  } else {
    // Fallback: no webkitGetAsEntry support
    for (let i = 0; i < items.length; i++) {
      const file = items[i].getAsFile();
      if (file) {
        const name = file.name.toLowerCase();
        if (name.endsWith('.bed') || name.endsWith('.bed.gz')) {
          files.push(file);
        }
      }
    }
  }

  return files;
}

// --- Component ---

export function FileComparison() {
  const { openTab } = useTab();
  const { files: contextFiles, clearFiles, cached, setCached, clearCached } = useFileSet();
  const [state, dispatch] = useReducer(reducer, initialState);
  const regionSetsRef = useRef<RegionSet[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelledRef = useRef(false);
  const [warning, setWarning] = useState<string | null>(null);

  // Cleanup RegionSets on unmount
  useEffect(() => {
    return () => {
      for (const rs of regionSetsRef.current) {
        try { (rs as unknown as { free?: () => void }).free?.(); } catch { /* */ }
      }
      regionSetsRef.current = [];
    };
  }, []);

  const startPipeline = useCallback(async (files: File[]) => {
    cancelledRef.current = false;
    dispatch({ type: 'START_PARSE', files });

    try {
      // Parse files sequentially
      const regionSets: RegionSet[] = [];
      const fileNames: string[] = [];

      for (let i = 0; i < files.length; i++) {
        if (cancelledRef.current) return;
        dispatch({ type: 'PARSE_PROGRESS', done: i, total: files.length, current: files[i].name });

        const entries: BedEntry[] = await parseBedFile(files[i]);
        const rs = new RegionSet(entries);
        regionSets.push(rs);
        fileNames.push(files[i].name);
      }

      if (cancelledRef.current) {
        for (const rs of regionSets) {
          try { (rs as unknown as { free?: () => void }).free?.(); } catch { /* */ }
        }
        return;
      }

      // Store refs for cleanup
      regionSetsRef.current = regionSets;

      const wasmAvailable = regionSets.length > 0 && hasSetOperations(regionSets[0]);
      dispatch({ type: 'PARSE_DONE', regionSets, fileNames, wasmAvailable });

      if (!wasmAvailable) {
        dispatch({ type: 'ERROR', error: 'Set operations (jaccard, union, consensus) are not available in this build. Run with GTARS_LOCAL=1 to enable them.' });
        return;
      }

      // Run analysis
      const result = await computeMultiFileAnalysis(regionSets, fileNames, (fraction) => {
        if (!cancelledRef.current) dispatch({ type: 'ANALYSIS_PROGRESS', fraction });
      });

      if (!cancelledRef.current) {
        dispatch({ type: 'ANALYSIS_DONE', result });
      }
    } catch (err) {
      console.error('File comparison failed:', err);
      if (!cancelledRef.current) {
        const message = err instanceof Error ? err.message : String(err);
        dispatch({ type: 'ERROR', error: message });
      }
    }
  }, []);

  // Restore from cache if available
  useEffect(() => {
    if (state.phase === 'idle' && cached && contextFiles.length === 0) {
      dispatch({
        type: 'RESTORE_CACHED',
        fileNames: cached.fileNames,
        result: cached.result,
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- only on mount

  // Auto-start when files arrive from context
  useEffect(() => {
    if (contextFiles.length >= 2 && state.phase === 'idle') {
      startPipeline(contextFiles);
      clearFiles();
    }
  }, [contextFiles, state.phase, startPipeline, clearFiles]);

  // Cache results when analysis completes
  useEffect(() => {
    if (state.phase === 'done' && state.result) {
      setCached({ fileNames: state.fileNames, result: state.result });
    }
  }, [state.phase, state.result, state.fileNames, setCached]);

  function handleFileDrop(files: File[]) {
    if (files.length < 2) {
      setWarning(files.length === 0 ? 'No BED files found' : 'Drop at least 2 files to compare');
      setTimeout(() => setWarning(null), 3000);
      return;
    }
    setWarning(null);
    // Free previous
    for (const rs of regionSetsRef.current) {
      try { (rs as unknown as { free?: () => void }).free?.(); } catch { /* */ }
    }
    regionSetsRef.current = [];
    clearCached();
    startPipeline(files);
  }

  // --- Build plots (only when we have a complete result) ---
  const plots = useMemo<PlotSlot[]>(() => {
    if (state.phase !== 'done' || !state.result) return [];
    const { jaccardMatrix, overlapMatrix, chrCounts, consensus, fileStats } = state.result;
    const names = fileStats.map((f) => f.fileName);
    const out: PlotSlot[] = [];
    if (jaccardMatrix.length > 0 && jaccardMatrix[0]?.length > 0) {
      out.push(similarityHeatmapSlot(jaccardMatrix, overlapMatrix, names));
    }
    const chrPlot = chromosomeHeatmapSlot(chrCounts, names);
    if (chrPlot) out.push(chrPlot);
    const cbcPlot = consensusByChrSlot(consensus, names.length);
    if (cbcPlot) out.push(cbcPlot);
    const cp = consensusPlotSlot(consensus, names.length);
    if (cp) out.push(cp);
    return out;
  }, [state.phase, state.result]);

  return (
    <div className="flex flex-col h-full overflow-auto p-4 @md:p-6">
      {/* Back button */}
      <button
        onClick={() => openTab('collections', '')}
        className="inline-flex items-center gap-0.5 text-xs text-base-content/40 hover:text-base-content/60 transition-colors cursor-pointer w-fit mb-4"
      >
        <ChevronLeft size={14} />
        Collections
      </button>

      {/* Idle: show drop zone */}
      {state.phase === 'idle' && (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <h2 className="text-xl font-bold text-base-content">Compare BED files</h2>
          <p className="text-sm text-base-content/50 max-w-md text-center">
            Drop multiple BED files or a folder to compute pairwise Jaccard similarity, consensus regions, and set operation statistics. All computation runs locally in your browser.
          </p>
          <button
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              e.currentTarget.classList.add('border-success', 'bg-success/10');
            }}
            onDragLeave={(e) => {
              e.currentTarget.classList.remove('border-success', 'bg-success/10');
            }}
            onDrop={async (e) => {
              e.preventDefault();
              e.currentTarget.classList.remove('border-success', 'bg-success/10');
              const files = await collectBedFiles(e.dataTransfer.items);
              handleFileDrop(files);
            }}
            className="flex flex-col items-center justify-center w-full max-w-lg h-48 rounded-lg border-2 border-dashed border-success/30 bg-success/5 hover:bg-success/10 hover:border-success/50 transition-colors cursor-pointer gap-2"
          >
            <div className="flex items-center gap-2">
              <GitCompareArrows size={20} className="text-success" />
              <span className="text-sm font-medium text-base-content">Drop BED files or a folder here</span>
            </div>
            <span className="text-xs text-base-content/40">or click to browse</span>
          </button>
          {warning && (
            <p className="text-xs text-warning mt-2">{warning}</p>
          )}
        </div>
      )}

      {/* Parsing phase */}
      {state.phase === 'parsing' && (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <h2 className="text-lg font-semibold text-base-content">Parsing files...</h2>
          <div className="w-full max-w-sm">
            <div className="flex justify-between text-xs text-base-content/50 mb-1">
              <span>{state.parseProgress.current}</span>
              <span>{state.parseProgress.done}/{state.parseProgress.total}</span>
            </div>
            <progress
              className="progress progress-primary w-full"
              value={state.parseProgress.done}
              max={state.parseProgress.total}
            />
          </div>
        </div>
      )}

      {/* Analyzing phase */}
      {state.phase === 'analyzing' && (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <h2 className="text-lg font-semibold text-base-content">Computing comparisons...</h2>
          <div className="w-full max-w-sm">
            <div className="flex justify-between text-xs text-base-content/50 mb-1">
              <span>
                {state.analysisProgress < 0.6 ? 'Pairwise Jaccard similarity' :
                 state.analysisProgress < 0.8 ? 'Consensus regions' :
                 'Union / intersection'}
              </span>
              <span>{Math.round(state.analysisProgress * 100)}%</span>
            </div>
            <progress
              className="progress progress-primary w-full"
              value={state.analysisProgress}
              max={1}
            />
          </div>
        </div>
      )}

      {/* Error */}
      {state.phase === 'error' && (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <AlertTriangle size={24} className="text-warning" />
          <p className="text-sm text-base-content/70 max-w-md text-center">{state.error}</p>
          <button
            onClick={() => dispatch({ type: 'RESET' })}
            className="btn btn-sm btn-ghost"
          >
            Try again
          </button>
        </div>
      )}

      {/* Results */}
      {state.phase === 'done' && state.result && (
        <div className="space-y-6 pb-8">
          {/* Header card */}
          <div className="flex items-center gap-3 rounded-lg border border-success/30 bg-success/5 px-4 py-3">
            <div className="p-1.5 rounded-md bg-success/10 shrink-0">
              <GitCompareArrows size={14} className="text-success" />
            </div>
            <p className="text-sm font-medium text-base-content shrink-0">
              {state.result.fileStats.length} files
            </p>
            <div className="flex items-center gap-1.5 flex-1 min-w-0 text-xs text-base-content/40 overflow-hidden">
              <span className="shrink-0">{formatNumber(state.result.fileStats.reduce((s, f) => s + f.regions, 0))} regions</span>
              {state.result.consensus.length > 0 && (
                <><span className="shrink-0 hidden @xs:inline">·</span><span className="shrink-0 hidden @xs:inline">{formatNumber(state.result.consensus.length)} consensus</span></>
              )}
              {state.result.jaccardMatrix.length > 1 && (
                <><span className="shrink-0 hidden @sm:inline">·</span><span className="shrink-0 hidden @sm:inline">avg Jaccard {(state.result.jaccardMatrix.flatMap((row, i) => row.filter((_, j) => j > i)).reduce((s, v, _, a) => s + v / a.length, 0)).toFixed(3)}</span></>
              )}
              {state.result.unionStats && (
                <><span className="shrink-0 hidden @md:inline">·</span><span className="shrink-0 hidden @md:inline">{formatNumber(state.result.unionStats.regions)} union</span></>
              )}
              {state.result.intersectionStats && (
                <><span className="shrink-0 hidden @md:inline">·</span><span className="shrink-0 hidden @md:inline">{formatNumber(state.result.intersectionStats.regions)} shared</span></>
              )}
            </div>
            <button
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-base-content/60 hover:text-base-content/80 bg-base-200 hover:bg-base-300 px-2.5 py-1.5 rounded-md transition-colors cursor-pointer shrink-0"
            >
              <Plus size={13} />
              <span className="hidden @xs:inline">New Comparison</span>
            </button>
          </div>

          {/* Plots gallery */}
          {plots.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-base-content/50 uppercase tracking-wide mb-2">Visualizations</h3>
              <PlotGallery plots={plots} />
            </div>
          )}

          {/* Per-file breakdown table */}
          {state.result.perFile.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-base-content/50 uppercase tracking-wide mb-2">Per-file breakdown</h3>
              <div className="overflow-x-auto border border-base-300 rounded-lg bg-base-100">
                <table className="table table-sm text-xs w-full">
                  <thead className="text-base-content">
                    <tr>
                      <th>File</th>
                      <th className="text-right">Regions</th>
                      <th className="text-right">Shared</th>
                      <th className="text-right">Unique</th>
                      <th className="text-right">Overlap %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.result.perFile.map((f) => (
                      <tr key={f.fileName}>
                        <td className="max-w-[200px] truncate">{f.fileName}</td>
                        <td className="text-right">{formatNumber(f.regions)}</td>
                        <td className="text-right">{formatNumber(f.shared)}</td>
                        <td className="text-right">{formatNumber(f.unique)}</td>
                        <td className="text-right">{f.overlapPct.toFixed(1)}%</td>
                      </tr>
                    ))}
                    {state.result.unionStats && (
                      <tr className="border-t border-base-300 bg-primary/5 font-semibold">
                        <td>Union</td>
                        <td className="text-right">{formatNumber(state.result.unionStats.regions)}</td>
                        <td />
                        <td />
                        <td className="text-right">{formatBp(state.result.unionStats.nucleotides)}</td>
                      </tr>
                    )}
                    {state.result.intersectionStats && (
                      <tr className="border-t border-base-300 bg-secondary/5 font-semibold">
                        <td>All shared</td>
                        <td className="text-right">{formatNumber(state.result.intersectionStats.regions)}</td>
                        <td />
                        <td />
                        <td className="text-right">{formatBp(state.result.intersectionStats.nucleotides)}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".bed,.gz"
        className="hidden"
        onChange={(e) => {
          const fileList = e.target.files;
          if (!fileList || fileList.length === 0) return;
          const files = Array.from(fileList).filter((f) => {
            const name = f.name.toLowerCase();
            return name.endsWith('.bed') || name.endsWith('.bed.gz');
          });
          if (files.length > 0) handleFileDrop(files);
          e.target.value = '';
        }}
      />
    </div>
  );
}
