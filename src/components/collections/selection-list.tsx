import { useMemo, useState } from 'react';
import { ChevronLeft, GripVertical, Trash2 } from 'lucide-react';
import { useTab } from '../../contexts/tab-context';
import { useBucket } from '../../contexts/bucket-context';

export function SelectionList() {
  const { buckets, deleteBucket, reorderBuckets } = useBucket();
  const { openTab } = useTab();
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOrder, setDragOrder] = useState<string[] | null>(null);

  const displayBuckets = useMemo(() => {
    if (!dragOrder) return buckets;
    return dragOrder.map((id) => buckets.find((b) => b.id === id)).filter(Boolean) as typeof buckets;
  }, [buckets, dragOrder]);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
    requestAnimationFrame(() => {
      setDragId(id);
      setDragOrder(buckets.map((b) => b.id));
    });
  };

  const handleDragOverRow = (index: number) => {
    if (!dragId || !dragOrder) return;
    const from = dragOrder.indexOf(dragId);
    if (from === index) return;
    const next = [...dragOrder];
    next.splice(from, 1);
    next.splice(index, 0, dragId);
    setDragOrder(next);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (dragOrder) reorderBuckets(dragOrder);
    setDragId(null);
    setDragOrder(null);
  };

  const handleDragEnd = () => {
    setDragId(null);
    setDragOrder(null);
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
          <div className="overflow-x-auto border border-base-300 rounded-lg bg-base-100">
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
                {displayBuckets.map((bucket, index) => {
                  const isDragging = dragId === bucket.id;
                  return isDragging ? (
                    <tr
                      key={bucket.id}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={handleDrop}
                      onDragEnd={handleDragEnd}
                    >
                      <td colSpan={5} className="px-4 py-2">
                        <div className="h-4 bg-base-300/50 rounded animate-pulse" />
                      </td>
                    </tr>
                  ) : (
                    <tr
                      key={bucket.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, bucket.id)}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) => { e.preventDefault(); handleDragOverRow(index); }}
                      onDrop={handleDrop}
                      onClick={() => openTab('collections', 'selection/' + bucket.id)}
                      className="transition-colors cursor-pointer hover:bg-primary/5"
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
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
