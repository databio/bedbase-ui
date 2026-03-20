import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { toast } from 'sonner';

const MAX_UPLOADED_FILES = 15;

type UploadedFilesContextValue = {
  files: File[];
  activeIndex: number | null;
  addFiles: (newFiles: File[]) => void;
  removeFile: (index: number) => void;
  setActiveIndex: (index: number | null) => void;
  clearAll: () => void;
};

const UploadedFilesContext = createContext<UploadedFilesContextValue | null>(null);

function fileKey(f: File): string {
  return `${f.name}|${f.size}|${f.lastModified}`;
}

function isBedFile(f: File): boolean {
  const name = f.name.toLowerCase();
  return name.endsWith('.bed') || name.endsWith('.bed.gz');
}

// Module-level state survives provider unmount/remount (tab switches)
let _files: File[] = [];
let _activeIndex: number | null = null;

export function UploadedFilesProvider({ children }: { children: ReactNode }) {
  const [files, setFilesState] = useState<File[]>(() => _files);
  const [activeIndex, setActiveIndexState] = useState<number | null>(() => _activeIndex);

  const setFiles = useCallback((f: File[]) => { _files = f; setFilesState(f); }, []);
  const setActiveIdx = useCallback((i: number | null) => { _activeIndex = i; setActiveIndexState(i); }, []);

  const addFiles = useCallback((newFiles: File[]) => {
    const valid = newFiles.filter((f) => {
      if (!isBedFile(f)) {
        toast.warning(`Skipped ${f.name} — only .bed and .bed.gz files are supported.`);
        return false;
      }
      return true;
    });
    if (valid.length === 0) return;

    setFilesState((prev) => {
      const existingKeys = new Set(prev.map(fileKey));
      const deduped = valid.filter((f) => !existingKeys.has(fileKey(f)));
      if (deduped.length < valid.length && deduped.length > 0) {
        toast.info(`${valid.length - deduped.length} duplicate file(s) skipped.`);
      }
      const combined = [...prev, ...deduped];
      if (combined.length > MAX_UPLOADED_FILES) {
        toast.warning(`Maximum ${MAX_UPLOADED_FILES} files. Some files were not added.`);
        const result = combined.slice(0, MAX_UPLOADED_FILES);
        _files = result;
        return result;
      }
      _files = combined;
      return combined;
    });
  }, []);

  const removeFile = useCallback((index: number) => {
    setFilesState((prev) => {
      const next = prev.filter((_, i) => i !== index);
      _files = next;
      return next;
    });
    setActiveIdx((prev) => {
      if (prev === null) return null;
      if (prev === index) return null;
      if (prev > index) return prev - 1;
      return prev;
    });
  }, [setActiveIdx]);

  const clearAll = useCallback(() => {
    _files = [];
    _activeIndex = null;
    setFilesState([]);
    setActiveIndexState(null);
  }, []);

  return (
    <UploadedFilesContext.Provider value={{ files, activeIndex, addFiles, removeFile, setActiveIndex: setActiveIdx, clearAll }}>
      {children}
    </UploadedFilesContext.Provider>
  );
}

export function useUploadedFiles() {
  const ctx = useContext(UploadedFilesContext);
  if (!ctx) throw new Error('useUploadedFiles must be used within an UploadedFilesProvider');
  return ctx;
}
