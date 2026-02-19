import { createContext, useContext, useState, type ReactNode } from 'react';

type FileContextValue = {
  uploadedFile: File | null;
  setUploadedFile: (file: File | null) => void;
};

const FileContext = createContext<FileContextValue | null>(null);

export function FileProvider({ children }: { children: ReactNode }) {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  return (
    <FileContext.Provider value={{ uploadedFile, setUploadedFile }}>
      {children}
    </FileContext.Provider>
  );
}

export function useFile() {
  const ctx = useContext(FileContext);
  if (!ctx) throw new Error('useFile must be used within a FileProvider');
  return ctx;
}
