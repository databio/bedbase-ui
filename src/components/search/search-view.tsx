import { useState } from 'react';
import { Search, FileText, AlertCircle, RefreshCw, X } from 'lucide-react';
import { useTab } from '../../contexts/tab-context';
import { useFile } from '../../contexts/file-context';
import { useTextSearch } from '../../queries/use-text-search';
import { useBedSearch } from '../../queries/use-bed-search';
import { useGenomes } from '../../queries/use-genomes';
import { useAssays } from '../../queries/use-assays';
import { SearchEmpty } from './search-empty';
import { ResultsTable } from './results-table';
import type { components } from '../../bedbase-types';

type SearchResponse = components['schemas']['BedListSearchResult'];

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

function SkeletonTable() {
  return (
    <div className="border border-base-300 rounded-lg overflow-hidden">
      <div className="animate-pulse">
        <div className="h-9 bg-base-200/50 border-b border-base-300" />
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-base-300 last:border-b-0">
            <div className="h-3 w-32 bg-base-300 rounded" />
            <div className="h-4 w-12 bg-base-300 rounded-full" />
            <div className="h-3 w-20 bg-base-300 rounded" />
            <div className="h-3 w-20 bg-base-300 rounded" />
            <div className="h-3 w-20 bg-base-300 rounded" />
            <div className="h-3 w-20 bg-base-300 rounded" />
            <div className="h-3 flex-1 bg-base-300 rounded" />
            <div className="h-3 w-12 bg-base-300 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

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
          className="select select-xs select-bordered"
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
          className="select select-xs select-bordered"
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
          className="select select-xs select-bordered"
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
}) {
  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="px-6 pt-4 pb-2 flex flex-col gap-2">
        {header}
        {filters}
      </div>
      <div className="flex-1 px-6 pb-6">
        {isLoading ? (
          <SkeletonTable />
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
            <ResultsTable results={data.results} />
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
    <div className="flex items-center gap-2 border border-base-300 rounded-lg px-3 py-2">
      <input
        type="text"
        className="flex-1 bg-transparent outline-none text-sm text-base-content placeholder:text-base-content/50"
        value={editQuery}
        onChange={(e) => setEditQuery(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
      />
      <button
        type="button"
        onClick={handleSubmit}
        className="btn btn-primary btn-sm"
        disabled={!editQuery.trim()}
      >
        <Search size={16} />
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
    />
  );
}

// --- Bed-to-bed search mode ---

function BedSearchResults() {
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(20);
  const { uploadedFile, setUploadedFile } = useFile();
  const { openTab } = useTab();
  const { data, isLoading, error, refetch } = useBedSearch(uploadedFile ?? undefined, {
    limit,
    offset,
  });

  // No file in context — redirect to empty state
  if (!uploadedFile) {
    return <SearchEmpty />;
  }

  const header = (
    <div className="flex items-center gap-3 border border-base-300 rounded-lg px-3 py-2">
      <FileText size={16} className="text-primary shrink-0" />
      <span className="text-sm font-medium text-base-content truncate">{uploadedFile.name}</span>
      <span className="text-xs text-base-content/40">{formatBytes(uploadedFile.size)}</span>
      <button
        onClick={() => { setUploadedFile(null); openTab('search'); }}
        className="p-0.5 rounded hover:bg-base-300 transition-colors cursor-pointer ml-auto"
      >
        <X size={14} className="text-base-content/40" />
      </button>
    </div>
  );

  const filters = (
    <div className="flex items-center text-xs ml-auto">
      <label className="flex items-center gap-1.5 text-base-content/60 ml-auto">
        Limit
        <select
          className="select select-xs select-bordered"
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
    />
  );
}

// --- Main search view (routes on param) ---

export function SearchView({ param }: { param?: string }) {
  if (!param) return <SearchEmpty />;
  if (param === 'upload') return <BedSearchResults />;
  return <TextSearchResults query={param} />;
}
