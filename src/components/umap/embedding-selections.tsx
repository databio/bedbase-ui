import { Trash2, Save, ShoppingCart, Pin, ArrowRight } from 'lucide-react';
import { useBucket } from '../../contexts/bucket-context';
import { useCart } from '../../contexts/cart-context';
import { useTab } from '../../contexts/tab-context';
import type { UmapPoint } from '../../lib/umap-utils';

type Props = {
  currentSelection: UmapPoint[];
};

export function EmbeddingSelections({ currentSelection }: Props) {
  const { buckets, createBucket, deleteBucket, toggleBucket } = useBucket();
  const { addToCart } = useCart();
  const { openTab } = useTab();

  const validPoints = currentSelection.filter((p) => p.identifier !== 'custom_point');

  const handleSave = () => {
    if (validPoints.length === 0) return;
    createBucket(`Selection ${buckets.length + 1}`, validPoints.map((p) => p.identifier));
  };

  const handleAddToCart = () => {
    for (const p of validPoints) {
      addToCart({
        id: p.identifier,
        name: p.text || p.identifier,
        genome: '',
        tissue: '',
        cell_line: '',
        cell_type: '',
        description: '',
        assay: '',
      });
    }
  };

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
                <tr
                  key={bucket.id}
                  onClick={() => toggleBucket(bucket.id)}
                  className={`group cursor-pointer transition-colors ${bucket.enabled ? 'bg-primary/10' : 'hover:bg-base-200'}`}
                >
                  <td className="flex items-center justify-between" style={{ height: 30 }}>
                    <span className="flex items-center gap-2">
                      <Pin
                        size={12}
                        className={`shrink-0 transition-colors ${bucket.enabled ? 'text-primary' : 'text-base-content/20'}`}
                        fill={bucket.enabled ? 'currentColor' : 'none'}
                      />
                      <span className="truncate max-w-20 @2xs:max-w-32 @xs:max-w-48 @sm:max-w-64" title={bucket.name}>
                        {bucket.name}
                      </span>
                      <span className="hidden @2xs:inline text-base-content/40 shrink-0">({bucket.bedIds.length})</span>
                    </span>
                    <span className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        className="text-error/60 hover:text-error cursor-pointer p-0.5"
                        onClick={(e) => { e.stopPropagation(); deleteBucket(bucket.id); }}
                      >
                        <Trash2 size={12} />
                      </button>
                      <button
                        className="text-base-content/40 hover:text-base-content cursor-pointer p-0.5"
                        onClick={(e) => { e.stopPropagation(); openTab('collections', 'selection/' + bucket.id); }}
                        title="View details"
                      >
                        <ArrowRight size={12} />
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
