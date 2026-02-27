import { useState, useEffect, useRef } from 'react';
import { Check, X, Trash2, ScatterChart, Pencil } from 'lucide-react';
import { Breadcrumb } from '../shared/breadcrumb';

const PAGE_SIZE_OPTIONS = [10, 20] as const;
import { useTab } from '../../contexts/tab-context';
import { useBucket } from '../../contexts/bucket-context';
// import { SelectionStats } from './selection-stats';

export function SelectionDetail({ selectionId }: { selectionId: string }) {
  const { openTab } = useTab();
  const { buckets, renameBucket, deleteBucket, removeBedFromBucket, focusBucket } = useBucket();
  const bucket = buckets.find((b) => b.id === selectionId);

  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const prevBucketRef = useRef(bucket);

  // Auto-redirect when bucket is deleted (e.g. last bed removed → auto-delete)
  useEffect(() => {
    if (prevBucketRef.current && !bucket) {
      openTab('collections', 'selection');
    }
    prevBucketRef.current = bucket;
  }, [bucket, openTab]);

  const handleStartEdit = () => {
    if (!bucket) return;
    setEditValue(bucket.name);
    setEditing(true);
  };

  const handleConfirmEdit = () => {
    if (editValue.trim() && bucket) renameBucket(bucket.id, editValue.trim());
    setEditing(false);
  };

  const handleDelete = () => {
    if (!bucket) return;
    deleteBucket(bucket.id);
    openTab('collections', 'selection');
  };

  if (!bucket) {
    return (
      <div className="flex flex-col h-full overflow-auto p-4 @md:p-6">
        <Breadcrumb crumbs={[
          { label: 'Collections', onClick: () => openTab('collections', '') },
          { label: 'Selections', onClick: () => openTab('collections', 'selection') },
          { label: 'Not found' },
        ]} />
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <p className="text-sm font-medium text-base-content">Selection not found</p>
          <p className="text-xs text-base-content/50 max-w-md text-center">
            This selection may have been deleted or is no longer in your browser's local storage.
          </p>
          <button
            onClick={() => openTab('collections', 'selection')}
            className="btn btn-sm btn-ghost gap-1.5 mt-1"
          >
            Back to selections
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-auto p-4 @md:p-6">
      <Breadcrumb crumbs={[
        { label: 'Collections', onClick: () => openTab('collections', '') },
        { label: 'Selections', onClick: () => openTab('collections', 'selection') },
        { label: bucket.name },
      ]} />

      <div className="space-y-6 pb-6">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              {editing ? (
                <span className="flex items-center gap-1">
                  <input
                    className="input input-sm text-lg font-semibold w-64"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleConfirmEdit();
                      if (e.key === 'Escape') setEditing(false);
                    }}
                    autoFocus
                  />
                  <button
                    className="text-success cursor-pointer p-1"
                    onClick={handleConfirmEdit}
                  >
                    <Check size={16} />
                  </button>
                  <button
                    className="text-error cursor-pointer p-1"
                    onClick={() => setEditing(false)}
                  >
                    <X size={16} />
                  </button>
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <p className="text-lg font-semibold text-base-content">{bucket.name}</p>
                  <button
                    onClick={handleStartEdit}
                    className="text-base-content/30 hover:text-base-content/60 cursor-pointer p-0.5"
                    title="Rename"
                  >
                    <Pencil size={14} />
                  </button>
                </span>
              )}
              <p className="text-xs text-base-content/40 mt-1">
                {bucket.bedIds.length} BED file{bucket.bedIds.length !== 1 ? 's' : ''}
                {' · '}
                Created {new Date(bucket.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div className="shrink-0 flex items-center gap-1">
              <button
                onClick={() => {
                  focusBucket(bucket.id);
                  openTab('umap', '');
                }}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-base-content/60 hover:text-base-content/80 bg-base-200 hover:bg-base-300 px-2.5 py-1.5 rounded-md transition-colors cursor-pointer"
              >
                <ScatterChart size={13} />
                View on UMAP
              </button>
              <button
                onClick={handleDelete}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-error/60 hover:text-error bg-base-200 hover:bg-error/10 px-2.5 py-1.5 rounded-md transition-colors cursor-pointer"
              >
                <Trash2 size={13} />
                Delete
              </button>
            </div>
          </div>
        </div>

        {/* Aggregated stats — disabled until server-side collection analysis is ready */}
        {/* <SelectionStats
          bedIds={bucket.bedIds.slice(page * pageSize, (page + 1) * pageSize)}
          totalCount={bucket.bedIds.length}
        /> */}

        {/* BED files table */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-base-content/50 uppercase tracking-wide">
            BED files ({bucket.bedIds.length})
          </h3>
          {bucket.bedIds.length > 0 ? (
            <>
              <div className="overflow-x-auto border border-base-300 rounded-lg bg-base-100">
                <table className="table table-sm text-xs w-full">
                  <thead className="text-base-content">
                    <tr>
                      <th>BED ID</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {bucket.bedIds.slice(page * pageSize, (page + 1) * pageSize).map((bedId) => (
                      <tr
                        key={bedId}
                        onClick={() => openTab('analysis', 'bed/' + bedId)}
                        className="hover:bg-primary/5 cursor-pointer transition-colors group"
                      >
                        <td className="font-mono text-primary">{bedId}</td>
                        <td className="w-8">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeBedFromBucket(bucket.id, bedId);
                            }}
                            className="text-error/0 group-hover:text-error/40 hover:!text-error cursor-pointer p-0.5 transition-colors"
                            title="Remove"
                          >
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between text-sm text-base-content/50">
                <span>
                  {bucket.bedIds.length > pageSize
                    ? `Showing ${page * pageSize + 1}–${Math.min((page + 1) * pageSize, bucket.bedIds.length)} of ${bucket.bedIds.length}`
                    : `${bucket.bedIds.length} BED file${bucket.bedIds.length !== 1 ? 's' : ''}`
                  }
                </span>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs text-base-content/60">
                    Rows
                    <select
                      className="select select-xs border border-base-300"
                      value={pageSize}
                      onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
                    >
                      {PAGE_SIZE_OPTIONS.map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </label>
                  {bucket.bedIds.length > pageSize && (
                    <>
                      <button
                        className="btn btn-sm btn-ghost"
                        disabled={page === 0}
                        onClick={() => setPage((p) => p - 1)}
                      >
                        Previous
                      </button>
                      <button
                        className="btn btn-sm btn-ghost"
                        disabled={(page + 1) * pageSize >= bucket.bedIds.length}
                        onClick={() => setPage((p) => p + 1)}
                      >
                        Next
                      </button>
                    </>
                  )}
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-base-content/40 py-4">No BED files in this selection.</p>
          )}
        </div>
      </div>
    </div>
  );
}
