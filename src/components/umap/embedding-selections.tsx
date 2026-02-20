import { useState } from 'react';
import { Trash2, Check, X } from 'lucide-react';
import { useBucket } from '../../contexts/bucket-context';
import type { UmapPoint } from '../../lib/umap-utils';

type Props = {
  currentSelection: UmapPoint[];
};

export function EmbeddingSelections({ currentSelection }: Props) {
  const { buckets, createBucket, deleteBucket, toggleBucket, renameBucket } = useBucket();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const handleSave = () => {
    const ids = currentSelection
      .map((p) => p.identifier)
      .filter((id) => id !== 'custom_point');
    if (ids.length === 0) return;
    createBucket(`Selection ${buckets.length + 1}`, ids);
  };

  const handleStartEdit = (id: string, name: string) => {
    setEditingId(id);
    setEditValue(name);
  };

  const handleConfirmEdit = () => {
    if (editingId && editValue.trim()) {
      renameBucket(editingId, editValue.trim());
    }
    setEditingId(null);
  };

  const handleCancelEdit = () => setEditingId(null);

  return (
    <div className="border border-base-300 rounded-lg overflow-clip bg-white">
      <div className="px-3 py-2 border-b border-base-300 flex items-center justify-between">
        <span className="text-xs font-bold">Selections</span>
        <button
          className="btn btn-xs h-[18px] min-h-0 text-[10px] px-1.5 -my-0.5 btn-ghost"
          disabled={currentSelection.length === 0}
          onClick={handleSave}
        >
          Save Selection ({currentSelection.filter((p) => p.identifier !== 'custom_point').length})
        </button>
      </div>
      <div className="p-0">
        {buckets.length === 0 ? (
          <p className="text-base-content/40 text-center text-xs py-3">No saved selections</p>
        ) : (
          <table className="table table-sm text-xs w-full">
            <tbody>
              {buckets.map((bucket) => (
                <tr key={bucket.id} className={bucket.enabled ? 'bg-primary/10' : ''}>
                  <td className="flex items-center justify-between" style={{ height: 30 }}>
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-xs"
                        checked={bucket.enabled}
                        onChange={() => toggleBucket(bucket.id)}
                      />
                      {editingId === bucket.id ? (
                        <span className="flex items-center gap-1">
                          <input
                            className="input input-xs w-24 text-xs"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={handleCancelEdit}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleConfirmEdit();
                              if (e.key === 'Escape') handleCancelEdit();
                            }}
                            autoFocus
                          />
                          <button
                            className="text-success cursor-pointer"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handleConfirmEdit();
                            }}
                          >
                            <Check size={12} />
                          </button>
                          <button
                            className="text-error cursor-pointer"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handleCancelEdit();
                            }}
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ) : (
                        <>
                          <span
                            className="cursor-text hover:underline truncate max-w-32"
                            onClick={() => handleStartEdit(bucket.id, bucket.name)}
                            title={bucket.name}
                          >
                            {bucket.name}
                          </span>
                          <span className="text-base-content/40 shrink-0">({bucket.bedIds.length})</span>
                        </>
                      )}
                    </span>
                    <span className="flex items-center gap-1">
                      <button
                        className="text-error/60 hover:text-error cursor-pointer p-0.5"
                        onClick={() => deleteBucket(bucket.id)}
                      >
                        <Trash2 size={12} />
                      </button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
