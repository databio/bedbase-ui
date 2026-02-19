import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import { RegionSet } from '@databio/gtars';
import { parseBedFile } from '../lib/bed-parser';
import { fromRegionSet, type BedAnalysis } from '../lib/bed-analysis';

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
  const rsRef = useRef<RegionSet | null>(null);

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
      return;
    }

    let cancelled = false;

    async function parse(file: File) {
      setParsing(true);
      setParseError(null);
      setParseTime(null);
      setParseProgress(0);

      try {
        const start = performance.now();
        const entries = await parseBedFile(file, (p) => {
          if (!cancelled) setParseProgress(p);
        });
        const rs = new RegionSet(entries);
        const elapsed = performance.now() - start;

        if (cancelled) {
          try {
            (rs as unknown as { free?: () => void }).free?.();
          } catch {
            /* ignore */
          }
          return;
        }

        // Free previous RegionSet
        if (rsRef.current) {
          try {
            (rsRef.current as unknown as { free?: () => void }).free?.();
          } catch {
            /* ignore */
          }
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
            const result = await fromRegionSet(rs, file, elapsed, (p) => {
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
    }

    parse(bedFile);

    return () => {
      cancelled = true;
    };
  }, [bedFile]);

  return (
    <FileContext.Provider
      value={{ bedFile, setBedFile, regionSet, parsing, parseProgress, parseError, parseTime, analysis, analyzing, analysisProgress }}
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
