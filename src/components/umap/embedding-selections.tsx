import { useState } from 'react';
import { Trash2, Check, X, Save, ShoppingCart } from 'lucide-react';
import { useBucket } from '../../contexts/bucket-context';
import { useCart } from '../../contexts/cart-context';
import type { UmapPoint } from '../../lib/umap-utils';

type Props = {
  currentSelection: UmapPoint[];
};

export function EmbeddingSelections({ currentSelection }: Props) {
  const { buckets, createBucket, deleteBucket, toggleBucket, renameBucket } = useBucket();
  const { addToCart } = useCart();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const validPoints = currentSelection.filter((p) => p.identifier !== 'custom_point');

  const handleSave = () => {
    if (validPoints.length === 0) return;
    createBucket(`Selection ${buckets.length + 1}`, validPoints.map((p) => p.identifier));
  };

  const handleAddToCart = () => {
    for (const p of validPoints) {
      addToCart({ id: p.identifier, name: p.text || p.identifier, genome: '' });
    }
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
    <div className="border border-base-300 rounded-lg overflow-clip bg-base-100 shrink-0 max-h-[33%] overflow-y-auto">
      <div className="px-3 py-2 border-b border-base-300 bg-base-200 flex items-center justify-between">
        <span className="text-xs font-bold">Selections{validPoints.length > 0 && <span className="hidden @2xs:inline font-normal text-base-content/50 ml-1">({validPoints.length})</span>}</span>
        <span className="flex items-center gap-1 -my-0.5">
          {/* Narrow: plain colored icons */}
          <button
            className="@2xs:hidden p-1 text-secondary disabled:opacity-30 cursor-pointer disabled:cursor-default"
            disabled={validPoints.length === 0}
            onClick={handleSave}
            title="Save selection"
          >
            <Save size={12} />
          </button>
          <button
            className="@2xs:hidden p-1 text-primary disabled:opacity-30 cursor-pointer disabled:cursor-default"
            disabled={validPoints.length === 0}
            onClick={handleAddToCart}
            title="Add to cart"
          >
            <ShoppingCart size={12} />
          </button>
          {/* Wide: full buttons */}
          <button
            className="hidden @2xs:inline-flex btn btn-xs btn-soft btn-secondary h-[18px] min-h-0 text-[10px] px-1.5"
            disabled={validPoints.length === 0}
            onClick={handleSave}
          >
            Save
          </button>
          <button
            className="hidden @2xs:inline-flex btn btn-xs btn-soft btn-primary h-[18px] min-h-0 text-[10px] px-1.5"
            disabled={validPoints.length === 0}
            onClick={handleAddToCart}
          >
            Add to Cart
          </button>
        </span>
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
                            className="cursor-text hover:underline truncate max-w-20 @2xs:max-w-32 @xs:max-w-48 @sm:max-w-64"
                            onClick={() => handleStartEdit(bucket.id, bucket.name)}
                            title={bucket.name}
                          >
                            {bucket.name}
                          </span>
                          <span className="hidden @2xs:inline text-base-content/40 shrink-0">({bucket.bedIds.length})</span>
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
