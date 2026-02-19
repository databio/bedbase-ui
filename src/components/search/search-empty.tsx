import { useState, useRef } from 'react';
import { Search, Upload, FileText, ArrowRight } from 'lucide-react';
import { useTab } from '../../contexts/tab-context';
import { useFile } from '../../contexts/file-context';

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

const exampleQueries = ['K562 CTCF', 'ENCODE DNase-seq', 'H3K27ac ChIP-seq', 'promoter regions'];

export function SearchEmpty() {
  const [query, setQuery] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadedFile, setUploadedFile } = useFile();
  const { openTab } = useTab();

  const handleSubmit = () => {
    const q = query.trim();
    if (!q) return;
    openTab('search', q);
  };

  const handleFileSelect = (file: File) => {
    setUploadedFile(file);
    openTab('search', 'upload');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFileSelect(f);
  };

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-64 px-4 py-12">
      <h2 className="text-2xl font-bold text-base-content mb-2">Search BEDbase</h2>
      <p className="text-base-content/50 text-sm mb-8 max-w-md text-center">
        Search by text query to find BED files by metadata, or upload a BED file to find similar genomic regions.
      </p>

      <div className="w-full max-w-xl">
        {/* Text search row */}
        <div className="flex items-center gap-2 border border-base-300 rounded-t-lg px-3 py-2.5">
          <input
            type="text"
            placeholder="Search for BED files..."
            className="flex-1 bg-transparent outline-none text-sm text-base-content placeholder:text-base-content/50"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            autoFocus
          />
          <button
            type="button"
            onClick={handleSubmit}
            className="btn btn-primary btn-sm"
            disabled={!query.trim()}
          >
            <Search size={16} />
          </button>
        </div>

        {/* File upload row or file indicator */}
        {uploadedFile ? (
          <div
            className="flex items-center gap-2 px-3 py-2.5 rounded-b-lg border border-base-300 border-t-0 bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors"
            onClick={() => openTab('search', 'upload')}
          >
            <FileText size={16} className="text-primary shrink-0 mx-2" />
            <span className="text-sm font-medium text-base-content/70 truncate flex-1">{uploadedFile.name}</span>
            <span className="text-xs text-base-content/40">{formatBytes(uploadedFile.size)}</span>
            <ArrowRight size={14} className="text-primary shrink-0" />
          </div>
        ) : (
          <div
            className={`flex items-center gap-2 px-3 py-2.5 rounded-b-lg border border-dashed border-t-0 transition-colors cursor-pointer ${
              isDragOver ? 'border-primary bg-primary/10' : 'border-base-300 bg-primary/5'
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={16} className="text-base-content/30 shrink-0 mx-2" />
            <div className="flex flex-col items-start">
              <span className="text-sm font-medium text-base-content/70">Upload BED file to search by similarity</span>
              <span className="text-[11px] text-base-content/45">.bed, .bigbed, .gz</span>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".bed,.bigbed,.bb,.gz,application/gzip,application/x-gzip"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileSelect(f);
              }}
            />
          </div>
        )}

        {/* Example queries */}
        <div className="flex items-center gap-2 mt-4 flex-wrap justify-center">
          <span className="text-base-content/30 text-xs">Try:</span>
          {exampleQueries.map((term) => (
            <button
              key={term}
              onClick={() => openTab('search', term)}
              className="text-xs px-2.5 py-1 rounded-full border border-base-300 text-base-content/50 hover:text-base-content hover:border-base-content/30 transition-colors cursor-pointer"
            >
              {term}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
