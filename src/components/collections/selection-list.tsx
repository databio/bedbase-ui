import React, { useState } from 'react';
import { ChevronLeft, GripVertical, Trash2 } from 'lucide-react';
import { useTab } from '../../contexts/tab-context';
import { useBucket } from '../../contexts/bucket-context';

export function SelectionList() {
  const { buckets, deleteBucket, reorderBuckets } = useBucket();
  const { openTab } = useTab();
  const [dragId, setDragId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
    setDragId(id);
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('text/plain');
    if (sourceId === targetId) return;
    const ids = buckets.map((b) => b.id);
    const from = ids.indexOf(sourceId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    ids.splice(from, 1);
    ids.splice(to, 0, sourceId);
    reorderBuckets(ids);
    setDragId(null);
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
        <h3 className="text-lg font-semibold text-base-content">Your Selections</h3>
        <p className="text-xs text-base-content/40">
          BED file selections you've saved from the UMAP embedding. Stored locally in your browser.
        </p>

        {buckets.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-base-content/40">No saved selections yet.</p>
            <p className="text-xs text-base-content/30 mt-1">
              Use the UMAP tab to explore BED file embeddings and save selections.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-base-300 rounded-lg bg-white">
            <table className="table table-sm text-xs w-full">
              <thead className="text-base-content">
                <tr>
                  <th className="w-6" />
                  <th>Name</th>
                  <th className="text-right">BED files</th>
                  <th>Created</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {buckets.map((bucket) => (
                  <tr
                    key={bucket.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, bucket.id)}
                    onDragEnd={() => setDragId(null)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleDrop(e, bucket.id)}
                    onClick={() => openTab('collections', 'selection/' + bucket.id)}
                    className={`transition-colors cursor-pointer ${dragId === bucket.id ? 'opacity-50' : 'hover:bg-primary/5'}`}
                  >
                    <td
                      className="w-6 cursor-grab active:cursor-grabbing"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <GripVertical size={12} className="text-base-content/30" />
                    </td>
                    <td className="font-medium text-primary">{bucket.name}</td>
                    <td className="text-right">
                      <span className="text-base-content/40">{bucket.bedIds.length}</span>
                    </td>
                    <td className="text-base-content/40">
                      {new Date(bucket.createdAt).toLocaleDateString()}
                    </td>
                    <td className="w-8">
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteBucket(bucket.id); }}
                        className="text-error/60 hover:text-error cursor-pointer p-0.5"
                        title="Delete"
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
