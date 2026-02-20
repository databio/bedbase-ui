import { useState } from 'react';
import { Search, AlertCircle, RefreshCw, ChevronLeft } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useTab } from '../../contexts/tab-context';
import { useBedsetList } from '../../queries/use-bedset-list';

const LIMIT_OPTIONS = [10, 20, 50] as const;

function SkeletonTable() {
  return (
    <div className="border border-base-300 rounded-lg overflow-hidden">
      <div className="animate-pulse">
        <div className="h-9 bg-base-200 border-b border-base-300" />
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-base-300 last:border-b-0">
            <div className="h-3 w-40 bg-base-300/80 rounded" />
            <div className="h-3 flex-1 bg-base-300/80 rounded" />
            <div className="h-3 w-12 bg-base-300/80 rounded" />
            <div className="h-3 w-24 bg-base-300/80 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

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
        Showing {start}–{end} of {count.toLocaleString()} BEDsets
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

export function BedsetList() {
  const { openTab } = useTab();
  const location = useLocation();
  const initialQuery = new URLSearchParams(location.search).get('q') || '';

  const [query, setQuery] = useState(initialQuery);
  const [submitted, setSubmitted] = useState(initialQuery);
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(10);

  const { data, isLoading, error, refetch } = useBedsetList({
    query: submitted || undefined,
    limit,
    offset,
  });

  const handleSubmit = () => {
    setSubmitted(query.trim());
    setOffset(0);
  };

  return (
    <div className="flex flex-col h-full overflow-auto px-4 @md:px-6">
      <div className="pt-4 pb-4">
        <button
          onClick={() => openTab('collections', '')}
          className="inline-flex items-center gap-0.5 text-xs text-base-content/40 hover:text-base-content/60 transition-colors cursor-pointer w-fit"
        >
          <ChevronLeft size={14} />
          Collections
        </button>
      </div>

      <div className="space-y-2 pb-6">
        <h3 className="text-lg font-semibold text-base-content">BEDsets</h3>
        <p className="text-xs text-base-content/40">
          Curated collections of BED files grouped by experiment, cell type, or other criteria.
        </p>
        <div className="flex flex-col gap-2 pt-1">
          <div className="flex items-center gap-2 border border-base-300 rounded-lg px-3 py-2 bg-white">
            <input
              type="text"
              className="flex-1 bg-transparent outline-none text-sm text-base-content placeholder:text-base-content/50"
              placeholder="Search BEDsets..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
            <button
              type="button"
              onClick={handleSubmit}
              className="btn btn-primary btn-sm"
            >
              <Search size={16} />
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
        <div>
          {isLoading ? (
            <SkeletonTable />
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <AlertCircle size={24} className="text-error" />
              <p className="text-sm text-error text-center max-w-md">
                {error instanceof Error ? error.message : 'Failed to load BEDsets.'}
              </p>
              <button onClick={() => refetch()} className="btn btn-sm btn-ghost gap-1">
                <RefreshCw size={14} /> Retry
              </button>
            </div>
          ) : data?.results && data.results.length > 0 ? (
            <>
              <div className="overflow-x-auto border border-base-300 rounded-lg bg-white">
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
    </div>
  );
}
