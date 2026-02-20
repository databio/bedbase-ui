import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, Check, X, Trash2, ScatterChart, Pencil } from 'lucide-react';
import { useTab } from '../../contexts/tab-context';
import { useBucket } from '../../contexts/bucket-context';

export function SelectionDetail({ selectionId }: { selectionId: string }) {
  const { openTab } = useTab();
  const { buckets, renameBucket, deleteBucket, removeBedFromBucket, focusBucket } = useBucket();
  const bucket = buckets.find((b) => b.id === selectionId);

  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
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
      <div className="flex flex-col h-full overflow-auto px-4 @md:px-6">
        <div className="pt-4 pb-4">
          <button
            onClick={() => openTab('collections', 'selection')}
            className="inline-flex items-center gap-0.5 text-xs text-base-content/40 hover:text-base-content/60 transition-colors cursor-pointer w-fit"
          >
            <ChevronLeft size={14} />
            Selections
          </button>
        </div>
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <p className="text-sm font-medium text-base-content">Selection not found</p>
          <p className="text-xs text-base-content/50 max-w-md text-center">
            This selection may have been deleted or is no longer in your browser's local storage.
          </p>
          <button
            onClick={() => openTab('collections', 'selection')}
            className="btn btn-sm btn-ghost gap-1.5 mt-1"
          >
            <ChevronLeft size={14} /> Back to selections
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-auto px-4 @md:px-6">
      <div className="pt-4 pb-4">
        <button
          onClick={() => openTab('collections', 'selection')}
          className="inline-flex items-center gap-0.5 text-xs text-base-content/40 hover:text-base-content/60 transition-colors cursor-pointer w-fit"
        >
          <ChevronLeft size={14} />
          Selections
        </button>
      </div>

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

        {/* BED files table */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-base-content/50 uppercase tracking-wide">
            BED files ({bucket.bedIds.length})
          </h3>
          {bucket.bedIds.length > 0 ? (
            <div className="overflow-x-auto border border-base-300 rounded-lg bg-white">
              <table className="table table-sm text-xs w-full">
                <thead className="text-base-content">
                  <tr>
                    <th>BED ID</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {bucket.bedIds.map((bedId) => (
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
          ) : (
            <p className="text-sm text-base-content/40 py-4">No BED files in this selection.</p>
          )}
        </div>
      </div>
    </div>
  );
}
