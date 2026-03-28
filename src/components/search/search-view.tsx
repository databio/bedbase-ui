import { useState, useRef, useEffect } from 'react';
import { FileText, AlertCircle, RefreshCw, X, ScatterChart, ChevronDown, Plus, ArrowRight } from 'lucide-react';
import { Breadcrumb } from '../shared/breadcrumb';
import { useTab } from '../../contexts/tab-context';
import { useFile } from '../../contexts/file-context';
import { useUploadedFiles } from '../../contexts/uploaded-files-context';
import { useBucket } from '../../contexts/bucket-context';
import { useTextSearch } from '../../queries/use-text-search';
import { useBedSearch } from '../../queries/use-bed-search';
import { useBedsetList } from '../../queries/use-bedset-list';
import { useGenomes } from '../../queries/use-genomes';
import { useAssays } from '../../queries/use-assays';
import { SearchEmpty } from './search-empty';
import { ResultsTable } from './results-table';
import { SkeletonTable } from '../skeleton-table';
import type { components } from '../../bedbase-types';

type SearchResponse = components['schemas']['BedListSearchResult'];

const BEDSET_PREFIX = 'bedset:';

const LIMIT_OPTIONS = [10, 20, 50, 100] as const;

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const resp = (error as { response?: { status?: number } }).response;
    if (resp?.status === 413) return 'File is too large for bed-to-bed search. Try a smaller BED file.';
    if (resp?.status === 415) return 'Invalid BED format. Please upload a valid BED file.';
  }
  return error instanceof Error ? error.message : 'An error occurred while searching.';
}

// --- Skeleton loader ---

const SEARCH_SKELETON_COLUMNS = [
  'h-3 w-32 rounded',
  'h-4 w-12 rounded-full',
  'h-3 w-20 rounded',
  'h-3 w-20 rounded',
  'h-3 w-20 rounded',
  'h-3 w-20 rounded',
  'h-3 flex-1 rounded',
  'h-3 w-12 rounded',
];

// --- Pagination ---

function Pagination({
  count,
  offset,
  limit,
  onOffsetChange,
}: {
  count: number;
  offset: number;
  limit: number;
  onOffsetChange: (offset: number) => void;
}) {
  const start = offset + 1;
  const end = Math.min(offset + limit, count);

  return (
    <div className="flex items-center justify-between pt-4 text-sm text-base-content/50">
      <span>
        Showing {start}–{end} of {count.toLocaleString()} results
      </span>
      <div className="flex gap-2">
        <button
          className="btn btn-sm btn-ghost"
          disabled={offset === 0}
          onClick={() => onOffsetChange(Math.max(0, offset - limit))}
        >
          Previous
        </button>
        <button
          className="btn btn-sm btn-ghost"
          disabled={offset + limit >= count}
          onClick={() => onOffsetChange(offset + limit)}
        >
          Next
        </button>
      </div>
    </div>
  );
}

// --- Filter bar ---

function FilterBar({
  genome,
  setGenome,
  assay,
  setAssay,
  limit,
  setLimit,
}: {
  genome: string;
  setGenome: (g: string) => void;
  assay: string;
  setAssay: (a: string) => void;
  limit: number;
  setLimit: (l: number) => void;
}) {
  const { data: genomes } = useGenomes();
  const { data: assays } = useAssays();

  return (
    <div className="flex items-center gap-3 flex-wrap text-xs">
      <label className="flex items-center gap-1.5 text-base-content/60">
        Genome
        <select
          className="select select-xs border border-base-300"
          value={genome}
          onChange={(e) => setGenome(e.target.value)}
        >
          <option value="">All</option>
          {genomes?.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-1.5 text-base-content/60">
        Assay
        <select
          className="select select-xs border border-base-300"
          value={assay}
          onChange={(e) => setAssay(e.target.value)}
        >
          <option value="">All</option>
          {assays?.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-1.5 text-base-content/60 ml-auto">
        Limit
        <select
          className="select select-xs border border-base-300"
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
        >
          {LIMIT_OPTIONS.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </label>
    </div>
  );
}

// --- Results layout (shared between text and bed-to-bed) ---

function SearchResults({
  header,
  filters,
  data,
  isLoading,
  error,
  refetch,
  offset,
  limit,
  onOffsetChange,
  bucketLabel,
  searchQuery,
}: {
  header: React.ReactNode;
  filters?: React.ReactNode;
  data: SearchResponse | undefined;
  isLoading: boolean;
  error: unknown;
  refetch: () => void;
  offset: number;
  limit: number;
  onOffsetChange: (offset: number) => void;
  bucketLabel?: string;
  searchQuery?: string;
}) {
  const { openTab } = useTab();
  const { createBucket, focusBucket } = useBucket();

  const handleViewOnUmap = () => {
    if (!data?.results) return;
    const ids = data.results.map((r) => r.metadata?.id).filter(Boolean) as string[];
    if (ids.length === 0) return;
    const id = createBucket(bucketLabel || 'Search results', ids);
    focusBucket(id);
    openTab('umap', '');
  };

  return (
    <div className="flex flex-col h-full overflow-auto p-4 @md:p-6">
      <div className="flex items-center justify-between mb-4">
        <Breadcrumb className="" crumbs={[
          { label: 'Search', onClick: () => openTab('search') },
          { label: searchQuery ? 'Text2BED search' : 'BED2BED search' },
        ]} />
        <button
          onClick={handleViewOnUmap}
          className={`inline-flex items-center gap-1 text-xs text-base-content hover:text-base-content/70 transition-colors cursor-pointer ${!(data?.results && data.results.length > 0) ? 'invisible' : ''}`}
        >
          <ScatterChart size={12} /> View on UMAP
        </button>
      </div>
      <div className="flex flex-col gap-2 mb-4">
        {header}
        {filters}
      </div>
      <div className="flex-1">
        {isLoading ? (
          <SkeletonTable columns={SEARCH_SKELETON_COLUMNS} />
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <AlertCircle size={24} className="text-error" />
            <p className="text-sm text-error text-center max-w-md">{errorMessage(error)}</p>
            <button onClick={refetch} className="btn btn-sm btn-ghost gap-1">
              <RefreshCw size={14} /> Retry
            </button>
          </div>
        ) : data?.results && data.results.length > 0 ? (
          <>
            <ResultsTable results={data.results} searchQuery={searchQuery} />
            {data.count > limit && (
              <Pagination
                count={data.count}
                offset={offset}
                limit={limit}
                onOffsetChange={onOffsetChange}
              />
            )}
          </>
        ) : (
          <p className="text-center text-sm text-base-content/40 py-12">No results found.</p>
        )}
      </div>
    </div>
  );
}

// --- Text search mode ---

function TextSearchResults({ query }: { query: string }) {
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(20);
  const [genome, setGenome] = useState('');
  const [assay, setAssay] = useState('');
  const [editQuery, setEditQuery] = useState(query);
  const { openTab } = useTab();
  const { data, isLoading, error, refetch } = useTextSearch(query, {
    limit,
    offset,
    genome: genome || undefined,
    assay: assay || undefined,
  });

  const handleSubmit = () => {
    const q = editQuery.trim();
    if (q && q !== query) {
      setOffset(0);
      openTab('search', q);
    }
  };

  const header = (
    <div className="flex items-center gap-2 border border-base-300 rounded-lg bg-base-100 px-3 py-2">
      <input
        type="text"
        className="flex-1 bg-transparent outline-none text-sm text-base-content placeholder:text-base-content/50"
        value={editQuery}
        onChange={(e) => setEditQuery(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
      />
      {editQuery && (
        <button
          type="button"
          onClick={() => { setEditQuery(''); openTab('search'); }}
          title="Clear search"
          className="p-0.5 rounded hover:bg-base-300 transition-colors cursor-pointer"
        >
          <X size={14} className="text-base-content/40" />
        </button>
      )}
      <SearchModeToggle mode="bed" query={query} />
      <button
        type="button"
        onClick={handleSubmit}
        className="w-6 h-6 rounded-full bg-primary text-primary-content hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center shrink-0"
        disabled={!editQuery.trim()}
      >
        <ArrowRight size={12} />
      </button>
    </div>
  );

  const filters = (
    <FilterBar
      genome={genome}
      setGenome={(g) => { setGenome(g); setOffset(0); }}
      assay={assay}
      setAssay={(a) => { setAssay(a); setOffset(0); }}
      limit={limit}
      setLimit={(l) => { setLimit(l); setOffset(0); }}
    />
  );

  return (
    <SearchResults
      header={header}
      filters={filters}
      data={data}
      isLoading={isLoading}
      error={error}
      refetch={refetch}
      offset={offset}
      limit={limit}
      onOffsetChange={setOffset}
      bucketLabel={`Search: ${query}`}
      searchQuery={query}
    />
  );
}

// --- Bed-to-bed search mode ---

function BedSearchResults() {
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(20);
  const [showFilePicker, setShowFilePicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { bedFile, setBedFile } = useFile();
  const { files, addFiles, setActiveIndex } = useUploadedFiles();
  const { data, isLoading, error, refetch } = useBedSearch(bedFile ?? undefined, {
    limit,
    offset,
  });

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

  // No file in context — redirect to empty state
  if (!bedFile) {
    return <SearchEmpty />;
  }

  function switchToFile(file: File, index: number) {
    setBedFile(file);
    setActiveIndex(index);
    setOffset(0);
    setShowFilePicker(false);
  }

  function handleNewFiles(newFiles: File[]) {
    addFiles(newFiles);
    const first = newFiles[0];
    if (first) {
      setBedFile(first);
      setActiveIndex(files.length); // will be at end after addFiles
    }
    setOffset(0);
    setShowFilePicker(false);
  }

  const activeKey = `${bedFile.name}|${bedFile.size}|${bedFile.lastModified}`;
  const otherFiles = files.filter((f) => `${f.name}|${f.size}|${f.lastModified}` !== activeKey);
  const hasOptions = otherFiles.length > 0;

  const header = (
    <div className="relative" ref={pickerRef}>
      <button
        type="button"
        onClick={() => setShowFilePicker(!showFilePicker)}
        className="flex items-center gap-3 border border-base-300 rounded-lg px-3 py-2 bg-base-100 w-full text-left cursor-pointer hover:bg-base-200/30 transition-colors"
      >
        <FileText size={16} className="text-primary shrink-0" />
        <span className="text-sm font-medium text-base-content truncate">{bedFile.name}</span>
        <span className="text-xs text-base-content/40 ml-auto shrink-0">{formatBytes(bedFile.size)}</span>
        <ChevronDown size={14} className={`text-base-content/40 transition-transform shrink-0 ${showFilePicker ? 'rotate-180' : ''}`} />
      </button>

      {showFilePicker && (
        <div className="absolute top-full left-0 right-0 mt-1 border border-base-300 rounded-lg bg-base-100 shadow-lg z-20 py-1 max-h-52 overflow-y-auto">
          {hasOptions && otherFiles.map((file) => {
            const idx = files.indexOf(file);
            return (
              <button
                key={`${file.name}|${file.size}|${file.lastModified}`}
                onClick={() => switchToFile(file, idx)}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-base-200 transition-colors cursor-pointer"
              >
                <FileText size={12} className="text-base-content/30 shrink-0" />
                <span className="text-xs text-base-content truncate flex-1">{file.name}</span>
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
              if (e.target.files && e.target.files.length > 0) handleNewFiles(Array.from(e.target.files));
              e.target.value = '';
            }}
          />
        </div>
      )}
    </div>
  );

  const filters = (
    <div className="flex items-center text-xs ml-auto">
      <label className="flex items-center gap-1.5 text-base-content/60 ml-auto">
        Limit
        <select
          className="select select-xs border border-base-300"
          value={limit}
          onChange={(e) => { setLimit(Number(e.target.value)); setOffset(0); }}
        >
          {LIMIT_OPTIONS.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </label>
    </div>
  );

  return (
    <SearchResults
      header={header}
      filters={filters}
      data={data}
      isLoading={isLoading}
      error={error}
      refetch={refetch}
      offset={offset}
      limit={limit}
      onOffsetChange={setOffset}
      bucketLabel={`Similar: ${bedFile?.name || 'uploaded file'}`}
    />
  );
}

// --- Search mode toggle ---

function SearchModeToggle({ mode, query }: { mode: 'bed' | 'bedset'; query: string }) {
  const { openTab } = useTab();
  return (
    <button
      type="button"
      onClick={() => {
        openTab('search', mode === 'bed' ? BEDSET_PREFIX + query : query);
      }}
      className="flex items-center gap-1 text-xs font-medium text-base-content/50 hover:text-base-content/70 transition-colors cursor-pointer shrink-0 select-none"
    >
      {mode === 'bed' ? 'BED' : 'BEDset'}
      <ChevronDown size={12} className="text-base-content/30" />
    </button>
  );
}

// --- BEDset search mode ---

const BEDSET_SKELETON_COLUMNS = [
  'h-3 w-40 rounded',
  'h-3 flex-1 rounded',
  'h-3 w-12 rounded',
  'h-3 w-24 rounded',
];

function BedsetSearchResults({ query }: { query: string }) {
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(20);
  const [editQuery, setEditQuery] = useState(query);
  const { openTab } = useTab();
  const { data, isLoading, error, refetch } = useBedsetList({
    query: query || undefined,
    limit,
    offset,
  });

  const handleSubmit = () => {
    const q = editQuery.trim();
    if (q && q !== query) {
      setOffset(0);
      openTab('search', BEDSET_PREFIX + q);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-auto p-4 @md:p-6">
      <div className="flex items-center justify-between mb-4">
        <Breadcrumb className="" crumbs={[
          { label: 'Search', onClick: () => openTab('search') },
          { label: 'Text2BEDset search' },
        ]} />
      </div>
      <div className="flex flex-col gap-2 mb-4">
        <div className="flex items-center gap-2 border border-base-300 rounded-lg bg-base-100 px-3 py-2">
          <input
            type="text"
            className="flex-1 bg-transparent outline-none text-sm text-base-content placeholder:text-base-content/50"
            placeholder="Search for BEDsets..."
            value={editQuery}
            onChange={(e) => setEditQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          />
          {editQuery && (
            <button
              type="button"
              onClick={() => { setEditQuery(''); openTab('search'); }}
              title="Clear search"
              className="p-0.5 rounded hover:bg-base-300 transition-colors cursor-pointer"
            >
              <X size={14} className="text-base-content/40" />
            </button>
          )}
          <SearchModeToggle mode="bedset" query={query} />
          <button
            type="button"
            onClick={handleSubmit}
            className="w-6 h-6 rounded-full bg-primary text-primary-content hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center shrink-0"
            disabled={!editQuery.trim()}
          >
            <ArrowRight size={12} />
          </button>
        </div>
        <div className="flex items-center gap-3 flex-wrap text-xs">
          <label className="flex items-center gap-1.5 text-base-content/60 ml-auto">
            Limit
            <select
              className="select select-xs border border-base-300"
              value={limit}
              onChange={(e) => { setLimit(Number(e.target.value)); setOffset(0); }}
            >
              {LIMIT_OPTIONS.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <div className="flex-1">
        {isLoading ? (
          <SkeletonTable columns={BEDSET_SKELETON_COLUMNS} />
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <AlertCircle size={24} className="text-error" />
            <p className="text-sm text-error text-center max-w-md">
              {error instanceof Error ? error.message : 'Failed to search BEDsets.'}
            </p>
            <button onClick={() => refetch()} className="btn btn-sm btn-ghost gap-1">
              <RefreshCw size={14} /> Retry
            </button>
          </div>
        ) : data?.results && data.results.length > 0 ? (
          <>
            <div className="overflow-x-auto border border-base-300 rounded-lg bg-base-100">
              <table className="table table-sm text-xs w-full">
                <thead className="text-base-content">
                  <tr>
                    <th>Name</th>
                    <th>Description</th>
                    <th className="text-right">BED files</th>
                    <th>Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {data.results.map((bs) => (
                    <tr
                      key={bs.id}
                      onClick={() => openTab('collections', 'bedset/' + bs.id)}
                      className="hover:bg-primary/5 cursor-pointer transition-colors"
                    >
                      <td className="font-medium max-w-48 truncate text-primary">{bs.name}</td>
                      <td className="max-w-xs truncate text-base-content/50">
                        {bs.description || <span className="text-base-content/30">—</span>}
                      </td>
                      <td className="text-right">{bs.bed_ids?.length ?? '—'}</td>
                      <td className="text-base-content/40">
                        {bs.submission_date
                          ? new Date(bs.submission_date).toLocaleDateString()
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.count > limit && (
              <Pagination
                count={data.count}
                offset={offset}
                limit={limit}
                onOffsetChange={setOffset}
              />
            )}
          </>
        ) : (
          <p className="text-center text-sm text-base-content/40 py-12">No BEDsets found.</p>
        )}
      </div>
    </div>
  );
}

// --- Main search view (routes on param) ---

export function SearchView({ param }: { param?: string }) {
  if (!param) return <SearchEmpty />;
  if (param === 'file') return <BedSearchResults />;
  if (param === BEDSET_PREFIX) return <SearchEmpty initialMode="bedset" />;
  if (param.startsWith(BEDSET_PREFIX)) return <BedsetSearchResults query={param.slice(BEDSET_PREFIX.length)} />;
  return <TextSearchResults query={param} />;
}
