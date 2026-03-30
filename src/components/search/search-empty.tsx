import { useRef, useState, useEffect } from 'react';
import { ArrowRight, FileText, ChevronDown, Plus, CircleArrowRight } from 'lucide-react';
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
    <div className="flex-1 overflow-auto">
    <div className="px-4 md:px-6 pt-12 pb-20">
      <div className="max-w-3xl mx-auto flex flex-col items-center">
      <h2 className="text-2xl font-bold text-base-content mb-8 text-center">Search BEDbase</h2>

      <p className="text-base-content/50 text-sm text-center mb-3">
        {searchMode === 'bed'
          ? <>Search by text, or <a href="/upload" onClick={(e) => { e.preventDefault(); openTab('file'); }} className="text-primary hover:underline cursor-pointer">upload</a> a file to search by similarity.</>
          : 'Find curated BEDset collections.'}
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
            className="flex items-center gap-1 text-xs font-medium text-base-content/50 hover:text-base-content/70 transition-colors cursor-pointer shrink-0 select-none"
          >
            {searchMode === 'bed' ? 'BED' : 'BEDset'}
            <ChevronDown size={12} className="text-base-content/30" />
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="w-7 h-7 rounded-full bg-primary text-primary-content hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center shrink-0"
            disabled={!query.trim()}
          >
            <ArrowRight size={14} />
          </button>
        </div>

        {/* File indicator — if a file is already loaded, show quick link to BED2BED search */}
        {searchMode === 'bed' && (bedFile || files.length > 0) && (
          <div className="relative mt-2" ref={pickerRef}>
            <button
              type="button"
              onClick={() => {
                if (files.length <= 1 && bedFile) {
                  openTab('search', 'file');
                } else {
                  setShowFilePicker(!showFilePicker);
                }
              }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-base-300 w-full text-left cursor-pointer hover:bg-base-200/30 transition-colors"
            >
              <FileText size={14} className="text-primary shrink-0" />
              {bedFile ? (
                <span className="text-sm text-base-content/70 truncate flex-1">Search by similarity to {bedFile.name}</span>
              ) : (
                <span className="text-sm text-base-content/40 truncate flex-1">No file selected</span>
              )}
              {files.length > 1 && (
                <ChevronDown size={14} className={`text-base-content/40 transition-transform shrink-0 ${showFilePicker ? 'rotate-180' : ''}`} />
              )}
            </button>

            {showFilePicker && (
              <div className="absolute top-full left-0 right-0 mt-1 border border-base-300 rounded-lg bg-base-100 shadow-lg z-20 max-h-52 overflow-hidden">
              <div className="py-1 max-h-52 overflow-y-auto">
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
                      className={`group flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-base-200 transition-colors cursor-pointer ${isActive ? 'bg-primary/5' : ''}`}
                    >
                      <FileText size={12} className={isActive ? 'text-primary shrink-0' : 'text-base-content/30 shrink-0'} />
                      <span className={`text-xs truncate flex-1 ${isActive ? 'font-medium text-base-content' : 'text-base-content'}`}>{file.name}</span>
                      <span className="w-10 h-3.5 shrink-0 flex items-center justify-end">
                        <span className="text-[11px] text-base-content/30 group-hover:hidden">{formatBytes(file.size)}</span>
                        <CircleArrowRight size={14} className="text-primary hidden group-hover:block" />
                      </span>
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

      {/* --- Overview sections (wider) --- */}
      <div className="max-w-5xl mx-auto mt-16 space-y-12">

        {/* Text search */}
        <div className="flex flex-col md:flex-row gap-6 items-center">
          <div className="flex-1">
            <h3 className="text-base font-semibold text-base-content mb-3">Text to BED</h3>
            <p className="text-sm text-base-content/60 leading-relaxed mb-3">
              BEDbase text search accepts free-form, natural language queries and returns relevant BED files. For each file in the database, biologically relevant metadata annotations — experiment type, biosample, cell type, tissue — are packed into a text summary and embedded as a vector using a sentence-transformer model.
            </p>
            <p className="text-sm text-base-content/60 leading-relaxed">
              This enables meaning-based queries rather than exact keyword matching. Searching for "H3K27ac in liver" will surface relevant ChIP-seq files even if they don't contain those exact words in their metadata.
            </p>
          </div>
          <div className="w-full md:w-64 shrink-0 border border-base-300 rounded-lg bg-base-200/30 aspect-[4/3] flex items-center justify-center">
            <svg viewBox="0 0 160 130" className="w-full h-full p-3" preserveAspectRatio="xMidYMid meet">
              {/* Query box */}
              <rect x="20" y="20" width="120" height="16" rx="3" fill="none" stroke="teal" strokeWidth="1" opacity={0.5} />
              <text x="80" y="31" fontSize="7" textAnchor="middle" fill="currentColor" opacity={0.7} fontFamily="system-ui">H3K27ac in liver</text>
              {/* Arrow */}
              <line x1="80" y1="38" x2="80" y2="44" stroke="teal" strokeWidth="1" opacity={0.5} />
              <polygon points="76.5,44 83.5,44 80,50" fill="teal" opacity={0.5} />
              {/* Results label */}
              <text x="80" y="60" fontSize="6" textAnchor="middle" fill="currentColor" opacity={0.7} fontFamily="system-ui">semantic matches</text>
              {/* Result rows */}
              {[0, 1, 2, 3].map((i) => {
                const y = 66 + i * 11;
                const w = [110, 95, 80, 65][i];
                const op = [0.65, 0.55, 0.45, 0.35][i];
                return (
                  <rect key={i} x="25" y={y} width={w} height="7" rx="2" fill="teal" opacity={op} />
                );
              })}
            </svg>
          </div>
        </div>

        {/* BED-to-BED similarity */}
        <div className="flex flex-col md:flex-row-reverse gap-6 items-center">
          <div className="flex-1">
            <h3 className="text-base font-semibold text-base-content mb-3">BED to BED</h3>
            <p className="text-sm text-base-content/60 leading-relaxed mb-3">
              Upload a BED file and find the most similar files in BEDbase based on genomic interval content, not metadata. Each file is embedded into a vector representation of its actual regions, so similarity reflects shared genomic coordinates rather than text annotations.
            </p>
            <p className="text-sm text-base-content/60 leading-relaxed">
              This is useful for identifying functionally similar experiments, validating results against existing data, quality control and outlier detection, and finding related datasets for meta-analysis.
            </p>
          </div>
          <div className="w-full md:w-64 shrink-0 border border-base-300 rounded-lg bg-base-200/30 aspect-[4/3] flex items-center justify-center">
            <svg viewBox="0 0 160 140" className="w-full h-full p-3" preserveAspectRatio="xMidYMid meet">
              {/* BED file card (compact) */}
              <rect x="30" y="4" width="100" height="34" rx="3" fill="none" stroke="teal" strokeWidth="1" opacity={0.45} />
              {/* Column headers */}
              <text x="40" y="14" fontSize="6" fill="teal" opacity={0.7} fontFamily="monospace">chr</text>
              <text x="65" y="14" fontSize="6" fill="teal" opacity={0.7} fontFamily="monospace">start</text>
              <text x="98" y="14" fontSize="6" fill="teal" opacity={0.7} fontFamily="monospace">end</text>
              {/* Rows */}
              {[0, 1, 2].map((i) => {
                const y = 19 + i * 5.5;
                return (
                  <g key={i}>
                    <rect x="40" y={y} width="14" height="2.5" rx="1" fill="teal" opacity={0.55} />
                    <rect x="65" y={y} width={[18, 14, 20][i]} height="2.5" rx="1" fill="teal" opacity={0.55} />
                    <rect x="98" y={y} width={[16, 20, 14][i]} height="2.5" rx="1" fill="teal" opacity={0.55} />
                  </g>
                );
              })}
              {/* Arrow down to embedding */}
              <line x1="80" y1="40" x2="80" y2="44" stroke="teal" strokeWidth="1" opacity={0.5} />
              <polygon points="76.5,44 83.5,44 80,50" fill="teal" opacity={0.5} />
              {/* Query embedding label */}
              <text x="80" y="60" fontSize="6" textAnchor="middle" fill="currentColor" opacity={0.7} fontFamily="system-ui">region embedding</text>
              {/* Query embedding row (matches db row style) */}
              <rect x="30" y="66" width="100" height="10" rx="2" fill="teal" opacity={0.12} stroke="teal" strokeWidth="0.5" strokeOpacity={0.4} />
              <text x="80" y="73.5" fontSize="6" textAnchor="middle" fill="teal" opacity={0.7} fontFamily="monospace">.31 .08 .72 .45 .19</text>
              {/* Arrow down to database */}
              <line x1="80" y1="78" x2="80" y2="82" stroke="teal" strokeWidth="1" opacity={0.5} />
              <polygon points="76.5,82 83.5,82 80,88" fill="teal" opacity={0.5} />
              {/* Embedding database label */}
              <text x="80" y="98" fontSize="6" textAnchor="middle" fill="currentColor" opacity={0.7} fontFamily="system-ui">embedding database</text>
              {/* Database rows */}
              {[
                { y: 104, vals: '.29 .10 .68 .42 .21', match: true },
                { y: 116, vals: '.33 .06 .75 .48 .17', match: true },
                { y: 128, vals: '.82 .44 .15 .61 .37', match: false },
              ].map((row, i) => (
                <g key={i}>
                  <rect x="30" y={row.y} width="100" height="10" rx="2" fill={row.match ? 'teal' : 'currentColor'} opacity={row.match ? 0.12 : 0.05} stroke={row.match ? 'teal' : 'none'} strokeWidth="0.5" strokeOpacity={0.35} />
                  <text x="80" y={row.y + 7.5} fontSize="6" textAnchor="middle" fill={row.match ? 'teal' : 'currentColor'} opacity={row.match ? 0.6 : 0.25} fontFamily="monospace">{row.vals}</text>
                </g>
              ))}
            </svg>
          </div>
        </div>

        {/* BEDset search */}
        <div className="flex flex-col md:flex-row gap-6 items-center">
          <div className="flex-1">
            <h3 className="text-base font-semibold text-base-content mb-3">Text to BEDset</h3>
            <p className="text-sm text-base-content/60 leading-relaxed mb-3">
              BEDsets are curated collections of BED files grouped by shared experiment, project, or biological interest. BEDbase automatically generates a BEDset for each GEO project (GSE), so searching for a project identifier retrieves all associated BED files at once.
            </p>
            <p className="text-sm text-base-content/60 leading-relaxed">
              BEDset search currently uses exact text matching on names and identifiers. Users can also create custom BEDsets tailored to their research, grouping files across projects and data sources.
            </p>
          </div>
          <div className="w-full md:w-64 shrink-0 border border-base-300 rounded-lg bg-base-200/30 aspect-[4/3] flex items-center justify-center">
            <svg viewBox="0 0 160 130" className="w-full h-full p-3" preserveAspectRatio="xMidYMid meet">
              {/* Search box (matches text-to-bed) */}
              <rect x="20" y="12" width="120" height="16" rx="3" fill="none" stroke="teal" strokeWidth="1" opacity={0.5} />
              <text x="80" y="23" fontSize="7" textAnchor="middle" fill="currentColor" opacity={0.7} fontFamily="system-ui">ChIP-seq liver</text>
              {/* Arrow */}
              <line x1="80" y1="30" x2="80" y2="36" stroke="teal" strokeWidth="1" opacity={0.5} />
              <polygon points="76.5,36 83.5,36 80,42" fill="teal" opacity={0.5} />
              {/* Label */}
              <text x="80" y="52" fontSize="6" textAnchor="middle" fill="currentColor" opacity={0.7} fontFamily="system-ui">matching collections</text>
              {/* BEDset result rows with file count badges */}
              {[
                { y: 58, name: 'GSE118327', files: 24, op: 0.9 },
                { y: 74, name: 'GSE104812', files: 16, op: 0.75 },
                { y: 90, name: 'GSE91928', files: 8, op: 0.55 },
                { y: 106, name: 'excluderanges', files: 3, op: 0.4 },
              ].map((row) => (
                <g key={row.name}>
                  <rect x="20" y={row.y} width="120" height="12" rx="2" fill="teal" opacity={row.op * 0.18} stroke="teal" strokeWidth="0.5" strokeOpacity={row.op * 0.6} />
                  <text x="28" y={row.y + 8.5} fontSize="6" fill="teal" opacity={row.op} fontFamily="monospace">{row.name}</text>
                  <rect x="113" y={row.y + 2.5} width="22" height="7" rx="3.5" fill="teal" opacity={row.op * 0.25} />
                  <text x="124" y={row.y + 6} fontSize="5" textAnchor="middle" fill="teal" opacity={row.op * 0.9} fontFamily="system-ui" dominantBaseline="central">{row.files}</text>
                </g>
              ))}
            </svg>
          </div>
        </div>

      </div>
    </div>
    </div>
  );
}
