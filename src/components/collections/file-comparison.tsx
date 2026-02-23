import { useReducer, useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { ChevronLeft, AlertTriangle, Plus, GitCompareArrows, ArrowRight } from 'lucide-react';
import { RegionSet, type ChromosomeStatistics } from '@databio/gtars';
import { useTab } from '../../contexts/tab-context';
import { useFileSet } from '../../contexts/fileset-context';
import { useFile } from '../../contexts/file-context';
import { useApi } from '../../contexts/api-context';
import { parseBedFile, type BedEntry } from '../../lib/bed-parser';
import {
  computeMultiFileAnalysis,
  hasSetOperations,
  binByAbsolutePosition,
  type MultiFileResult,
  type PositionalBin,
  type PerFileGenomeResult,
} from '../../lib/multi-file-analysis';
import { loadRefBase } from '../../lib/reference-data';
import { PlotGallery } from '../analysis/plot-gallery';
import { GenomeCompatModal } from '../analysis/genome-compat-modal';
import { similarityHeatmapSlot } from './plots/jaccard-heatmap';
import { consensusPlotSlot } from './plots/consensus-plot';
import { consensusByChrSlot } from './plots/consensus-by-chr';
import { positionalHeatmapSlot } from './plots/positional-heatmap';
import type { PlotSlot } from '../../lib/plot-specs';
import type { components } from '../../bedbase-types';

type RefGenValidReturnModel = components['schemas']['RefGenValidReturnModel'];

/**
 * Normalize genome names from the API to the ref data names we have locally (hg38, hg19).
 */
function normalizeGenomeName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('hg38') || lower.includes('grch38')) return 'hg38';
  if (lower.includes('hg19') || lower.includes('grch37')) return 'hg19';
  return name;
}

/**
 * Given per-file genome results, determine the majority genome.
 * Prefers tier-1 matches, then counts occurrences. Falls back to 'hg38'.
 */
function detectMajorityGenome(results: PerFileGenomeResult[]): { genome: string; defaulted: boolean } {
  const counts = new Map<string, number>();
  for (const r of results) {
    if (r.genome && r.tier === 1) {
      counts.set(r.genome, (counts.get(r.genome) ?? 0) + 1);
    }
  }
  if (counts.size === 0) {
    // No tier-1 matches — try any match
    for (const r of results) {
      if (r.genome) {
        counts.set(r.genome, (counts.get(r.genome) ?? 0) + 1);
      }
    }
  }
  if (counts.size === 0) return { genome: 'hg38', defaulted: true };
  let best = 'hg38';
  let bestCount = 0;
  for (const [g, c] of counts) {
    if (c > bestCount) { best = g; bestCount = c; }
  }
  return { genome: best, defaulted: false };
}

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
  const { setBedFile } = useFile();
  const { api } = useApi();
  const [state, dispatch] = useReducer(reducer, initialState);
  const regionSetsRef = useRef<RegionSet[]>([]);
  const chromSizesRef = useRef<Record<string, number>>({});
  const parsedFilesRef = useRef<Map<string, File>>(new Map());
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelledRef = useRef(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [genomeResults, setGenomeResults] = useState<PerFileGenomeResult[]>([]);
  const [majorityGenome, setMajorityGenome] = useState<string>('hg38');
  const [genomeDefaulted, setGenomeDefaulted] = useState(false);
  const [genomeModalFile, setGenomeModalFile] = useState<string | null>(null);

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
    setGenomeResults([]);
    setGenomeDefaulted(false);
    parsedFilesRef.current = new Map();
    dispatch({ type: 'START_PARSE', files });

    try {
      // Parse files sequentially, extracting bedFileData for genome detection
      const regionSets: RegionSet[] = [];
      const fileNames: string[] = [];
      const allEntries: BedEntry[][] = [];
      const bedFileDataList: Record<string, number>[] = [];

      for (let i = 0; i < files.length; i++) {
        if (cancelledRef.current) return;
        dispatch({ type: 'PARSE_PROGRESS', done: i, total: files.length, current: files[i].name });

        const entries: BedEntry[] = await parseBedFile(files[i]);
        allEntries.push(entries);

        const rs = new RegionSet(entries);
        regionSets.push(rs);
        fileNames.push(files[i].name);
        parsedFilesRef.current.set(files[i].name, files[i]);

        // Extract chromosome endpoint data for genome detection
        const chrStats = rs.chromosomeStatistics();
        const bedFileData: Record<string, number> = {};
        if (chrStats) {
          for (const entry of Array.from(chrStats.entries())) {
            const [chrom, stats] = entry as [unknown, ChromosomeStatistics];
            bedFileData[String(chrom)] = stats.end_nucleotide_position;
            try { (stats as unknown as { free?: () => void }).free?.(); } catch { /* */ }
          }
        }
        bedFileDataList.push(bedFileData);
      }

      if (cancelledRef.current) {
        for (const rs of regionSets) {
          try { (rs as unknown as { free?: () => void }).free?.(); } catch { /* */ }
        }
        return;
      }

      // Fire genome detection API calls in parallel
      const genomeSettled = await Promise.allSettled(
        bedFileDataList.map((bedFileData) =>
          api.post<RefGenValidReturnModel>('/bed/analyze-genome', { bed_file: bedFileData })
            .then(r => r.data)
        )
      );

      // Build per-file genome results
      const perFileGenome: PerFileGenomeResult[] = genomeSettled.map((result, i) => {
        if (result.status === 'fulfilled' && result.value.compared_genome?.length > 0) {
          const sorted = [...result.value.compared_genome].sort(
            (a, b) => a.tier_ranking - b.tier_ranking || b.xs - a.xs
          );
          const top = sorted[0];
          return {
            fileName: fileNames[i],
            genome: normalizeGenomeName(top.compared_genome ?? top.provided_genome),
            tier: top.tier_ranking,
            raw: result.value,
          };
        }
        return { fileName: fileNames[i], genome: null, tier: null, raw: null };
      });

      setGenomeResults(perFileGenome);

      // Determine majority genome
      const { genome: majority, defaulted } = detectMajorityGenome(perFileGenome);
      setMajorityGenome(majority);
      setGenomeDefaulted(defaulted);

      // Load reference chromSizes using detected majority genome
      let chromSizes: Record<string, number> = {};
      try {
        const ref = await loadRefBase(majority);
        chromSizes = ref.chromSizes;
      } catch {
        // If detected genome has no local ref data, fall back to hg38
        if (majority !== 'hg38') {
          try {
            const ref = await loadRefBase('hg38');
            chromSizes = ref.chromSizes;
            setMajorityGenome('hg38');
            setGenomeDefaulted(true);
          } catch { /* proceed without — bins will be empty */ }
        }
      }
      chromSizesRef.current = chromSizes;

      // Bin entries by absolute genomic position
      const positionalBins: PositionalBin[] = [];
      if (Object.keys(chromSizes).length > 0) {
        for (let i = 0; i < allEntries.length; i++) {
          positionalBins.push(...binByAbsolutePosition(allEntries[i], fileNames[i], chromSizes));
        }
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
      const rawResult = await computeMultiFileAnalysis(regionSets, fileNames, (fraction) => {
        if (!cancelledRef.current) dispatch({ type: 'ANALYSIS_PROGRESS', fraction });
      });

      if (!cancelledRef.current) {
        const result = { ...rawResult, positionalBins };
        dispatch({ type: 'ANALYSIS_DONE', result });
      }
    } catch (err) {
      console.error('File comparison failed:', err);
      if (!cancelledRef.current) {
        const message = err instanceof Error ? err.message : String(err);
        dispatch({ type: 'ERROR', error: message });
      }
    }
  }, [api]);

  // Restore from cache if available
  useEffect(() => {
    if (state.phase === 'idle' && cached && contextFiles.length === 0) {
      dispatch({
        type: 'RESTORE_CACHED',
        fileNames: cached.fileNames,
        result: cached.result,
      });
      if (cached.chromSizes) chromSizesRef.current = cached.chromSizes;
      if (cached.genomeResults) setGenomeResults(cached.genomeResults);
      if (cached.majorityGenome) setMajorityGenome(cached.majorityGenome);
      if (cached.genomeDefaulted != null) setGenomeDefaulted(cached.genomeDefaulted);
      if (cached.parsedFiles) parsedFilesRef.current = cached.parsedFiles;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- only on mount

  // Auto-start when files arrive from context
  useEffect(() => {
    if (contextFiles.length >= 2 && state.phase === 'idle') {
      startPipeline(contextFiles);
      clearFiles();
    }
  }, [contextFiles, state.phase, startPipeline, clearFiles]);

  // Cache results when analysis completes + reset selection to all files
  useEffect(() => {
    if (state.phase === 'done' && state.result) {
      setCached({
        fileNames: state.fileNames,
        result: state.result,
        chromSizes: chromSizesRef.current,
        genomeResults,
        majorityGenome,
        genomeDefaulted,
        parsedFiles: new Map(parsedFilesRef.current),
      });
      setSelectedFiles(new Set(state.result.fileStats.map((f) => f.fileName)));
    }
  }, [state.phase, state.result, state.fileNames, setCached, genomeResults, majorityGenome, genomeDefaulted]);

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

  // --- Build plots (recompute when selection changes) ---
  const plots = useMemo<PlotSlot[]>(() => {
    if (state.phase !== 'done' || !state.result) return [];
    const { jaccardMatrix, overlapMatrix, positionalBins, consensus, fileStats } = state.result;
    const allNames = fileStats.map((f) => f.fileName);
    const sel = allNames.filter((n) => selectedFiles.has(n));
    const selIndices = sel.map((n) => allNames.indexOf(n));
    const out: PlotSlot[] = [];

    // Jaccard/overlap: extract sub-matrix for selected files
    if (sel.length >= 1) {
      const filtJaccard = selIndices.map((i) => selIndices.map((j) => jaccardMatrix[i][j]));
      const filtOverlap = selIndices.map((i) => selIndices.map((j) => overlapMatrix[i][j]));
      out.push(similarityHeatmapSlot(filtJaccard, filtOverlap, sel));
    }

    // Positional: filter bins to selected files
    if (sel.length >= 1) {
      const filtBins = positionalBins.filter((b) => selectedFiles.has(b.fileName));
      const posPlot = positionalHeatmapSlot(filtBins, sel, chromSizesRef.current);
      if (posPlot) out.push(posPlot);
    }

    // Consensus: always all files (requires WASM recomputation to filter)
    const cbcPlot = consensusByChrSlot(consensus, allNames.length);
    if (cbcPlot) out.push(cbcPlot);
    const cp = consensusPlotSlot(consensus, allNames.length);
    if (cp) out.push(cp);

    return out;
  }, [state.phase, state.result, selectedFiles]);

  // Genome warning data (derived from genomeResults)
  const mismatched = useMemo(() => genomeResults.filter((r) => r.genome && r.genome !== majorityGenome), [genomeResults, majorityGenome]);
  const lowConfidence = useMemo(() => genomeResults.filter((r) => r.tier != null && r.tier > 1), [genomeResults]);
  const hasGenomeWarnings = mismatched.length > 0 || lowConfidence.length > 0;
  const genomeModalData = genomeResults.find((r) => r.fileName === genomeModalFile);

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

          {/* Per-file breakdown table */}
          {state.result.perFile.length > 0 ? (
            <div>
              <h3 className="text-sm font-semibold text-base-content/50 uppercase tracking-wide mb-2">Per-file breakdown</h3>

              {/* Genome warning banners */}
              {hasGenomeWarnings && (
                <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-warning/10 border border-warning/30 text-xs mb-2">
                  <AlertTriangle size={14} className="text-warning shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    {mismatched.length > 0 && (
                      <p>
                        <span className="font-medium">Genome mismatch: </span>
                        <span className="text-base-content/60">
                          {mismatched.map((r) => r.fileName).join(', ')} detected as {mismatched[0].genome} while the majority is {majorityGenome}. Results may be unreliable for mismatched files.
                        </span>
                      </p>
                    )}
                    {lowConfidence.length > 0 && (
                      <p>
                        <span className="font-medium">Low confidence: </span>
                        <span className="text-base-content/60">
                          {lowConfidence.map((r) => `${r.fileName} (Tier ${r.tier})`).join(', ')}
                        </span>
                      </p>
                    )}
                  </div>
                </div>
              )}

              {genomeDefaulted && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-base-200 text-xs mb-2 text-base-content/60">
                  <AlertTriangle size={13} className="text-base-content/40 shrink-0" />
                  Genome detection unavailable — defaulted to hg38 for positional binning.
                </div>
              )}

              <div className="overflow-x-auto border border-base-300 rounded-lg bg-base-100">
                <table className="table table-sm text-xs w-full">
                  <thead className="text-base-content">
                    <tr>
                      <th className="w-8">
                        <input
                          type="checkbox"
                          className="checkbox checkbox-xs"
                          checked={selectedFiles.size === state.result.fileStats.length}
                          onChange={() => {
                            const allNames = state.result!.fileStats.map((f) => f.fileName);
                            setSelectedFiles((prev) => prev.size === allNames.length ? new Set() : new Set(allNames));
                          }}
                        />
                      </th>
                      <th>File</th>
                      <th className="text-right">Regions</th>
                      <th className="text-right">Shared</th>
                      <th className="text-right">Unique</th>
                      <th className="text-right">Overlap %</th>
                      {genomeResults.length > 0 && <th>Genome</th>}
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {state.result.perFile.map((f) => {
                      const gr = genomeResults.find((r) => r.fileName === f.fileName);
                      const isMismatch = gr?.genome != null && gr.genome !== majorityGenome;
                      const isLowTier = gr?.tier != null && gr.tier > 1;
                      return (
                      <tr key={f.fileName} className={selectedFiles.has(f.fileName) ? '' : 'opacity-40'}>
                        <td>
                          <input
                            type="checkbox"
                            className="checkbox checkbox-xs"
                            checked={selectedFiles.has(f.fileName)}
                            onChange={() => {
                              setSelectedFiles((prev) => {
                                const next = new Set(prev);
                                if (next.has(f.fileName)) next.delete(f.fileName);
                                else next.add(f.fileName);
                                return next;
                              });
                            }}
                          />
                        </td>
                        <td className="max-w-[200px] truncate">{f.fileName}</td>
                        <td className="text-right">{formatNumber(f.regions)}</td>
                        <td className="text-right">{formatNumber(f.shared)}</td>
                        <td className="text-right">{formatNumber(f.unique)}</td>
                        <td className="text-right">{f.overlapPct.toFixed(1)}%</td>
                        {genomeResults.length > 0 && (
                          <td>
                            {gr?.genome ? (
                              <button
                                onClick={() => gr.raw && setGenomeModalFile(f.fileName)}
                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium transition-colors ${
                                  gr.raw ? 'cursor-pointer hover:opacity-80' : ''
                                } ${
                                  gr.tier === 1 && !isMismatch
                                    ? 'bg-success/15 text-success'
                                    : gr.tier === 2 || isMismatch
                                      ? 'bg-warning/15 text-warning'
                                      : 'bg-error/15 text-error'
                                }`}
                              >
                                {gr.genome}
                                {gr.tier != null && <span className="opacity-70">T{gr.tier}</span>}
                                {(isMismatch || isLowTier) && <AlertTriangle size={10} />}
                              </button>
                            ) : (
                              <span className="text-base-content/30">&mdash;</span>
                            )}
                          </td>
                        )}
                        <td>
                          {parsedFilesRef.current.has(f.fileName) && (
                            <button
                              onClick={() => {
                                const file = parsedFilesRef.current.get(f.fileName);
                                if (file) {
                                  setBedFile(file);
                                  openTab('analysis', 'file');
                                }
                              }}
                              className="inline-flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 transition-colors cursor-pointer"
                              title={`Analyze ${f.fileName}`}
                            >
                              Analyze
                              <ArrowRight size={11} />
                            </button>
                          )}
                        </td>
                      </tr>
                      );
                    })}
                    {state.result.unionStats && (
                      <tr className="border-t border-base-300 bg-primary/5 font-semibold">
                        <td />
                        <td>Union</td>
                        <td className="text-right">{formatNumber(state.result.unionStats.regions)}</td>
                        <td />
                        <td />
                        <td className="text-right">{formatBp(state.result.unionStats.nucleotides)}</td>
                        {genomeResults.length > 0 && <td />}
                        <td />
                      </tr>
                    )}
                    {state.result.intersectionStats && (
                      <tr className="border-t border-base-300 bg-secondary/5 font-semibold">
                        <td />
                        <td>All shared</td>
                        <td className="text-right">{formatNumber(state.result.intersectionStats.regions)}</td>
                        <td />
                        <td />
                        <td className="text-right">{formatBp(state.result.intersectionStats.nucleotides)}</td>
                        {genomeResults.length > 0 && <td />}
                        <td />
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {selectedFiles.size < state.result!.fileStats.length && selectedFiles.size > 0 ? (
                <p className="text-xs text-base-content/40 mt-1">
                  Showing {selectedFiles.size} of {state.result!.fileStats.length} files in plots
                </p>
              ) : null}

              {/* Genome compatibility modal */}
              {genomeModalFile != null && genomeModalData?.raw != null && (
                <GenomeCompatModal
                  open
                  onClose={() => setGenomeModalFile(null)}
                  genomeStats={genomeModalData.raw as RefGenValidReturnModel}
                />
              )}
            </div>
          ) : null}

          {/* Plots gallery */}
          {plots.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-base-content/50 uppercase tracking-wide mb-2">Visualizations</h3>
              <PlotGallery plots={plots} />
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
