import { useRef, useState, useEffect } from 'react';
import { Search, FileText, ChevronDown, Plus } from 'lucide-react';
import { useTab } from '../../contexts/tab-context';
import { useFile } from '../../contexts/file-context';
import { useUploadedFiles } from '../../contexts/uploaded-files-context';
import { EXAMPLE_QUERIES, EXAMPLE_BEDSET_QUERIES } from '../../lib/const';

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export function SearchEmpty({ initialMode = 'bed' }: { initialMode?: 'bed' | 'bedset' } = {}) {
  const [query, setQuery] = useState('');
  const [searchMode, setSearchMode] = useState<'bed' | 'bedset'>(initialMode);
  const [showFilePicker, setShowFilePicker] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { bedFile, setBedFile } = useFile();
  const { files, addFiles, setActiveIndex } = useUploadedFiles();
  const { openTab } = useTab();

  // Close dropdown on outside click
  useEffect(() => {
    if (!showFilePicker) return;
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowFilePicker(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showFilePicker]);

  const handleSubmit = () => {
    const q = query.trim();
    if (!q) return;
    openTab('search', searchMode === 'bedset' ? 'bedset:' + q : q);
  };

  const examples = searchMode === 'bed' ? EXAMPLE_QUERIES : EXAMPLE_BEDSET_QUERIES;

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-64 px-4 py-12">
      <h2 className="text-2xl font-bold text-base-content mb-1">Search BEDbase</h2>
      <p className="text-base-content/50 text-sm max-w-md mx-auto text-center mb-8">
        {searchMode === 'bed'
          ? <>Search by text query to find BED files, or upload your own in the <a href="/upload" onClick={(e) => { e.preventDefault(); openTab('file'); }} className="text-primary hover:underline cursor-pointer">Upload</a> tab to search by similarity.</>
          : 'Search for curated BEDset collections.'}
      </p>

      <div className="w-full max-w-xl">
        {/* Text search */}
        <div className="flex items-center gap-2 border-[1.5px] border-primary/30 rounded-lg px-3 py-2.5">
          <input
            ref={inputRef}
            type="text"
            placeholder={searchMode === 'bed' ? 'Search for BED files...' : 'Search for BEDsets...'}
            className="flex-1 bg-transparent outline-none text-sm text-base-content placeholder:text-base-content/50"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            autoFocus
          />
          <button
            type="button"
            onClick={() => {
              const next = searchMode === 'bed' ? 'bedset' : 'bed';
              setSearchMode(next);
              openTab('search', next === 'bedset' ? 'bedset:' : '');
              inputRef.current?.focus();
            }}
            className="text-xs text-base-content/40 hover:text-base-content/60 transition-colors cursor-pointer shrink-0 select-none"
          >
            {searchMode === 'bed' ? 'BED Search' : 'BEDset Search'}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="btn btn-primary btn-sm"
            disabled={!query.trim()}
          >
            <Search size={16} />
          </button>
        </div>

        {/* File indicator — if a file is already loaded, show quick link to BED2BED search */}
        {searchMode === 'bed' && (bedFile || files.length > 0) && (
          <div className="relative mt-3" ref={pickerRef}>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-base-300 w-full">
              <FileText size={14} className="text-primary shrink-0" />
              {bedFile ? (
                <button
                  className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer hover:opacity-70 transition-opacity"
                  onClick={() => openTab('search', 'file')}
                >
                  <span className="text-sm text-base-content/70 truncate">Search by similarity to {bedFile.name}</span>
                </button>
              ) : (
                <span className="text-sm text-base-content/40 truncate flex-1">No file selected</span>
              )}
              <button
                onClick={() => setShowFilePicker(!showFilePicker)}
                className="p-0.5 cursor-pointer hover:opacity-70 transition-opacity shrink-0"
              >
                <ChevronDown size={14} className={`text-base-content/40 transition-transform ${showFilePicker ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {showFilePicker && (
              <div className="absolute top-full left-0 right-0 mt-1 border border-base-300 rounded-lg bg-base-100 shadow-lg z-20 py-1 max-h-52 overflow-y-auto">
                {files.map((file, idx) => {
                  const isActive = bedFile && `${file.name}|${file.size}|${file.lastModified}` === `${bedFile.name}|${bedFile.size}|${bedFile.lastModified}`;
                  return (
                    <button
                      key={`${file.name}|${file.size}|${file.lastModified}`}
                      onClick={() => {
                        setBedFile(file);
                        setActiveIndex(idx);
                        setShowFilePicker(false);
                        openTab('search', 'file');
                      }}
                      className={`flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-base-200 transition-colors cursor-pointer ${isActive ? 'bg-primary/5' : ''}`}
                    >
                      <FileText size={12} className={isActive ? 'text-primary shrink-0' : 'text-base-content/30 shrink-0'} />
                      <span className={`text-xs truncate flex-1 ${isActive ? 'font-medium text-base-content' : 'text-base-content'}`}>{file.name}</span>
                      <span className="text-[11px] text-base-content/30 shrink-0">{formatBytes(file.size)}</span>
                    </button>
                  );
                })}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-base-200 transition-colors cursor-pointer"
                >
                  <Plus size={12} className="text-secondary shrink-0" />
                  <span className="text-xs text-secondary font-medium">Upload new file</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".bed,.gz"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      const newFiles = Array.from(e.target.files);
                      addFiles(newFiles);
                      const first = newFiles[0];
                      if (first) {
                        setBedFile(first);
                        setActiveIndex(files.length);
                      }
                      setShowFilePicker(false);
                      openTab('search', 'file');
                    }
                    e.target.value = '';
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* Example queries */}
        <div className="flex items-center gap-1.5 mt-4 flex-wrap justify-center">
          <span className="text-base-content/30 text-xs">Try:</span>
          {examples.map((term) => (
            <a
              key={term}
              href={searchMode === 'bedset' ? `/search?type=bedset&q=${encodeURIComponent(term)}` : `/search?q=${encodeURIComponent(term)}`}
              onClick={(e) => { e.preventDefault(); openTab('search', searchMode === 'bedset' ? 'bedset:' + term : term); }}
              className="text-xs px-2.5 py-1 rounded-full border border-base-300 text-base-content/50 hover:text-base-content hover:border-base-content/30 transition-colors cursor-pointer"
            >
              {term}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
