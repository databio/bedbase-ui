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

type FileContextValue = {
  uploadedFile: File | null;
  setUploadedFile: (file: File | null) => void;
  regionSet: RegionSet | null;
  parsing: boolean;
  parseProgress: number;
  parseError: string | null;
  parseTime: number | null;
};

const FileContext = createContext<FileContextValue | null>(null);

export function FileProvider({ children }: { children: ReactNode }) {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [regionSet, setRegionSet] = useState<RegionSet | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseProgress, setParseProgress] = useState(0);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parseTime, setParseTime] = useState<number | null>(null);
  const rsRef = useRef<RegionSet | null>(null);

  useEffect(() => {
    if (!uploadedFile) {
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
      } catch (err) {
        if (!cancelled) {
          setParseError(err instanceof Error ? err.message : 'Failed to parse BED file');
          setRegionSet(null);
        }
      } finally {
        if (!cancelled) setParsing(false);
      }
    }

    parse(uploadedFile);

    return () => {
      cancelled = true;
    };
  }, [uploadedFile]);

  return (
    <FileContext.Provider
      value={{ uploadedFile, setUploadedFile, regionSet, parsing, parseProgress, parseError, parseTime }}
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
