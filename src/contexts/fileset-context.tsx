import { createContext, useContext, useState, type ReactNode } from 'react';

type FileSetContextValue = {
  files: File[];
  setFiles: (files: File[]) => void;
  clearFiles: () => void;
};

const FileSetContext = createContext<FileSetContextValue | null>(null);

export function FileSetProvider({ children }: { children: ReactNode }) {
  const [files, setFiles] = useState<File[]>([]);

  return (
    <FileSetContext.Provider value={{ files, setFiles, clearFiles: () => setFiles([]) }}>
      {children}
    </FileSetContext.Provider>
  );
}

export function useFileSet() {
  const ctx = useContext(FileSetContext);
  if (!ctx) throw new Error('useFileSet must be used within a FileSetProvider');
  return ctx;
}
