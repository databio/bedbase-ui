import { useRef, useState } from 'react';
import { Search, FileText } from 'lucide-react';
import { useTab } from '../../contexts/tab-context';
import { useFile } from '../../contexts/file-context';
import { EXAMPLE_QUERIES, EXAMPLE_BEDSET_QUERIES } from '../../lib/const';

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export function SearchEmpty({ initialMode = 'bed' }: { initialMode?: 'bed' | 'bedset' } = {}) {
  const [query, setQuery] = useState('');
  const [searchMode, setSearchMode] = useState<'bed' | 'bedset'>(initialMode);
  const inputRef = useRef<HTMLInputElement>(null);
  const { bedFile } = useFile();
  const { openTab } = useTab();

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
        {searchMode === 'bed' && bedFile && (
          <button
            className="flex items-center gap-2 mt-3 px-3 py-2 rounded-lg border border-base-300 hover:bg-base-200/30 transition-colors cursor-pointer w-full text-left"
            onClick={() => openTab('search', 'file')}
          >
            <FileText size={14} className="text-primary shrink-0" />
            <span className="text-sm text-base-content/70 truncate flex-1">Search by similarity to {bedFile.name}</span>
            <span className="text-xs text-base-content/40">{formatBytes(bedFile.size)}</span>
          </button>
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
