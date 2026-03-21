import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { RegionSet } from '@databio/gtars';
import type { BedEntry } from '../lib/bed-parser';
import { fromRegionSet, type BedAnalysis } from '../lib/bed-analysis';
import { useAnalyzeGenome } from '../queries/use-analyze-genome';
import { useApi } from './api-context';

type FileContextValue = {
  bedFile: File | null;
  setBedFile: (file: File | null) => void;
  regionSet: RegionSet | null;
  parsing: boolean;
  parseProgress: number;
  parseError: string | null;
  parseTime: number | null;
  analysis: BedAnalysis | null;
  analyzing: boolean;
  analysisProgress: number;
  umapCoordinates: number[] | null;
  setUmapCoordinates: (coords: number[] | null) => void;
  genome: string | null;
  genomeTier: number | null;
};

const FileContext = createContext<FileContextValue | null>(null);

export function FileProvider({ children }: { children: ReactNode }) {
  const [bedFile, setBedFile] = useState<File | null>(null);
  const [regionSet, setRegionSet] = useState<RegionSet | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseProgress, setParseProgress] = useState(0);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parseTime, setParseTime] = useState<number | null>(null);
  const [analysis, setAnalysis] = useState<BedAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [umapCoordinates, setUmapCoordinates] = useState<number[] | null>(null);
  const rsRef = useRef<RegionSet | null>(null);

  // --- Genome detection (runs after analysis completes) ---
  const bedFileData = useMemo(() => {
    if (!analysis || analysis.chromosomeStats.length === 0) return undefined;
    const d: Record<string, number> = {};
    for (const row of analysis.chromosomeStats) d[row.chromosome] = row.end;
    return d;
  }, [analysis]);

  const { data: genomeStats } = useAnalyzeGenome(bedFileData);

  const { genome, genomeTier } = useMemo<{ genome: string | null; genomeTier: number | null }>(() => {
    if (!genomeStats?.compared_genome) return { genome: null, genomeTier: null };
    const sorted = [...genomeStats.compared_genome].sort(
      (a, b) => a.tier_ranking - b.tier_ranking || b.xs - a.xs,
    );
    const top = sorted[0];
    if (!top) return { genome: null, genomeTier: null };
    const name = top.compared_genome;
    if (name?.includes('hg38') || name?.includes('GRCh38')) return { genome: 'hg38', genomeTier: top.tier_ranking };
    if (name?.includes('hg19') || name?.includes('GRCh37')) return { genome: 'hg19', genomeTier: top.tier_ranking };
    return { genome: name ?? null, genomeTier: top.tier_ranking };
  }, [genomeStats]);

  // --- Auto-fetch UMAP coordinates for hg38 files ---
  const { api } = useApi();

  useEffect(() => {
    if (!bedFile || !genome || umapCoordinates) return;
    if (genome !== 'hg38') return;
    let cancelled = false;

    const fetchUmap = async () => {
      try {
        const formData = new FormData();
        formData.append('file', bedFile);
        const { data } = await api.post<number[]>('/bed/umap', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        if (!cancelled && data && data.length >= 2) {
          setUmapCoordinates(data);
        }
      } catch {
        /* UMAP coords are optional — silently fail */
      }
    };

    fetchUmap();
    return () => { cancelled = true; };
  }, [bedFile, genome, api]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!bedFile) {
      // Clean up previous RegionSet
      if (rsRef.current) {
        try {
          (rsRef.current as unknown as { free?: () => void }).free?.();
        } catch {
          /* ignore */
        }
        rsRef.current = null;
      }
      setRegionSet(null);
      setParseError(null);
      setParseTime(null);
      setParseProgress(0);
      setAnalysis(null);
      setAnalyzing(false);
      setAnalysisProgress(0);
      setUmapCoordinates(null);
      return;
    }

    let cancelled = false;

    setParsing(true);
    setParseError(null);
    setParseTime(null);
    setParseProgress(0);

    const start = performance.now();
    const worker = new Worker(
      new URL('../lib/bed-parser.worker.ts', import.meta.url),
      { type: 'module' },
    );

    worker.onmessage = async (e: MessageEvent<{ type: string; value?: number; entries?: BedEntry[]; message?: string }>) => {
      if (cancelled) return;
      const msg = e.data;

      if (msg.type === 'progress') {
        setParseProgress(msg.value!);
      } else if (msg.type === 'error') {
        setParseError(msg.message || 'Failed to parse BED file');
        setRegionSet(null);
        setParsing(false);
        worker.terminate();
      } else if (msg.type === 'result') {
        const entries = msg.entries!;
        try {
          const rs = new RegionSet(entries);
          const elapsed = performance.now() - start;

          if (cancelled) {
            try { (rs as unknown as { free?: () => void }).free?.(); } catch { /* ignore */ }
            worker.terminate();
            return;
          }

          // Free previous RegionSet
          if (rsRef.current) {
            try { (rsRef.current as unknown as { free?: () => void }).free?.(); } catch { /* ignore */ }
          }

          rsRef.current = rs;
          setRegionSet(rs);
          setParseTime(elapsed);
          setParsing(false);

          // Run stepped analysis
          if (!cancelled) {
            setAnalyzing(true);
            setAnalysisProgress(0);
            try {
              const result = await fromRegionSet(rs, bedFile, elapsed, (p) => {
                if (!cancelled) setAnalysisProgress(p);
              });
              if (!cancelled) setAnalysis(result);
            } catch {
              // Analysis failed — regionSet is still available
            } finally {
              if (!cancelled) setAnalyzing(false);
            }
          }
        } catch (err) {
          if (!cancelled) {
            setParseError(err instanceof Error ? err.message : 'Failed to parse BED file');
            setRegionSet(null);
            setParsing(false);
          }
        }
        worker.terminate();
      }
    };

    worker.onerror = () => {
      if (!cancelled) {
        setParseError('Failed to parse BED file');
        setRegionSet(null);
        setParsing(false);
      }
      worker.terminate();
    };

    worker.postMessage({ file: bedFile });

    return () => {
      cancelled = true;
      worker.terminate();
    };
  }, [bedFile]);

  return (
    <FileContext.Provider
      value={{ bedFile, setBedFile, regionSet, parsing, parseProgress, parseError, parseTime, analysis, analyzing, analysisProgress, umapCoordinates, setUmapCoordinates, genome, genomeTier }}
    >
      {children}
    </FileContext.Provider>
  );
}

export function useFile() {
  const ctx = useContext(FileContext);
  if (!ctx) throw new Error('useFile must be used within a FileProvider');
  return ctx;
}
