import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { MultiFileResult, PerFileGenomeResult } from '../lib/multi-file-analysis';

type CachedComparison = {
  fileNames: string[];
  result: MultiFileResult;
  chromSizes?: Record<string, number>;
  genomeResults?: PerFileGenomeResult[];
  majorityGenome?: string;
  genomeDefaulted?: boolean;
  parsedFiles?: Map<string, File>;
};

type FileSetContextValue = {
  files: File[];
  setFiles: (files: File[]) => void;
  clearFiles: () => void;
  cached: CachedComparison | null;
  setCached: (c: CachedComparison) => void;
  clearCached: () => void;
};

const FileSetContext = createContext<FileSetContextValue | null>(null);

// Module-level cache survives provider unmount/remount (tab switches)
let _moduleCache: CachedComparison | null = null;

export function FileSetProvider({ children }: { children: ReactNode }) {
  const [files, setFiles] = useState<File[]>([]);
  const [cached, setCachedState] = useState<CachedComparison | null>(() => _moduleCache);
  const setCached = useCallback((c: CachedComparison) => { _moduleCache = c; setCachedState(c); }, []);
  const clearCached = useCallback(() => { _moduleCache = null; setCachedState(null); }, []);

  return (
    <FileSetContext.Provider value={{ files, setFiles, clearFiles: () => setFiles([]), cached, setCached, clearCached }}>
      {children}
    </FileSetContext.Provider>
  );
}

export function useFileSet() {
  const ctx = useContext(FileSetContext);
  if (!ctx) throw new Error('useFileSet must be used within a FileSetProvider');
  return ctx;
}
