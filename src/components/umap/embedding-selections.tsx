import { useState, useRef, useEffect } from 'react';
import { Trash2, Save, ShoppingCart, Pin, ArrowRight, Pencil, Check, X, ChevronDown } from 'lucide-react';
import { useBucket } from '../../contexts/bucket-context';
import { useCart } from '../../contexts/cart-context';
import { useTab } from '../../contexts/tab-context';
import type { UmapPoint, LegendItem } from '../../lib/umap-utils';
import type { EmbeddingPlotRef } from './embedding-plot';

type Props = {
  currentSelection: UmapPoint[];
  pinnedCategories: number[];
  plotRef: React.RefObject<EmbeddingPlotRef | null>;
  legendItems: LegendItem[];
};

export function EmbeddingSelections({ currentSelection, pinnedCategories, plotRef, legendItems }: Props) {
  const { buckets, createBucket, deleteBucket, toggleBucket, renameBucket } = useBucket();
  const { addToCart } = useCart();
  const { openTab } = useTab();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  const validPoints = currentSelection.filter((p) => p.identifier !== 'custom_point');
  const hasSelection = validPoints.length > 0 || pinnedCategories.length > 0;

  // Focus input when entering edit mode
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const handleSave = async () => {
    if (validPoints.length > 0) {
      createBucket(`Selection ${buckets.length + 1}`, validPoints.map((p) => p.identifier));
    } else if (pinnedCategories.length > 0 && plotRef.current) {
      // Query points for all pinned categories
      const results = await Promise.all(
        pinnedCategories.map((c) => plotRef.current!.queryByCategory(String(c))),
      );
      const ids = results.flat().map((p) => p.identifier).filter((id) => id !== 'custom_point');
      if (ids.length > 0) {
        // Use legend item name when exactly one category is pinned and no manual points
        const name = pinnedCategories.length === 1
          ? legendItems.find((i) => i.category === pinnedCategories[0])?.name ?? `Selection ${buckets.length + 1}`
          : `Selection ${buckets.length + 1}`;
        createBucket(name, ids);
      }
    }
  };

  const handleAddToCart = async () => {
    let points = validPoints;
    if (points.length === 0 && pinnedCategories.length > 0 && plotRef.current) {
      const results = await Promise.all(
        pinnedCategories.map((c) => plotRef.current!.queryByCategory(String(c))),
      );
      points = results.flat().filter((p) => p.identifier !== 'custom_point');
    }
    for (const p of points) {
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

  const handleStartEdit = (id: string, currentName: string) => {
    setEditingId(id);
    setEditName(currentName);
  };

  const handleConfirmEdit = () => {
    if (editingId && editName.trim()) {
      renameBucket(editingId, editName.trim());
    }
    setEditingId(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={`border border-base-300 rounded-lg overflow-clip bg-base-100 flex flex-col ${collapsed ? 'shrink-0' : 'shrink-0 max-h-[33%]'}`}>
      <div
        className={`px-3 py-2 ${collapsed ? '' : 'border-b border-base-300'} bg-base-200 flex items-center justify-between shrink-0 cursor-pointer select-none`}
        onClick={() => setCollapsed(!collapsed)}
      >
        <span className="flex items-center gap-1.5">
          <ChevronDown size={12} className={`text-base-content/40 transition-transform ${collapsed ? '-rotate-90' : ''}`} />
          <span className="text-xs font-bold">Selections{validPoints.length > 0
          ? <span className="hidden @2xs:inline font-normal text-base-content/50 ml-1">({validPoints.length})</span>
          : pinnedCategories.length > 0
            ? <span className="hidden @2xs:inline font-normal text-base-content/50 ml-1">(pinned)</span>
            : null}</span>
        </span>
        <span className="flex items-center gap-1 -my-0.5" onClick={(e) => e.stopPropagation()}>
          {/* Narrow: plain colored icons */}
          <button
            className="@2xs:hidden p-1 text-secondary disabled:opacity-30 cursor-pointer disabled:cursor-default"
            disabled={!hasSelection}
            onClick={handleSave}
            title="Save selection"
          >
            <Save size={12} />
          </button>
          <button
            className="@2xs:hidden p-1 text-primary disabled:opacity-30 cursor-pointer disabled:cursor-default"
            disabled={!hasSelection}
            onClick={handleAddToCart}
            title="Add to cart"
          >
            <ShoppingCart size={12} />
          </button>
          {/* Wide: full buttons */}
          <button
            className="hidden @2xs:inline-flex btn btn-xs btn-soft btn-secondary h-[18px] min-h-0 text-[10px] px-1.5"
            disabled={!hasSelection}
            onClick={handleSave}
          >
            Save
          </button>
          <button
            className="hidden @2xs:inline-flex btn btn-xs btn-soft btn-primary h-[18px] min-h-0 text-[10px] px-1.5"
            disabled={!hasSelection}
            onClick={handleAddToCart}
          >
            Add to Cart
          </button>
        </span>
      </div>
      {!collapsed && <div className="overflow-y-auto overscroll-contain">
        {buckets.length === 0 ? (
          <p className="text-base-content/40 text-center text-xs py-3">No saved selections</p>
        ) : (
          <table className="table table-sm text-xs w-full">
            <tbody>
              {buckets.map((bucket) => (
                <tr
                  key={bucket.id}
                  onClick={() => { if (editingId !== bucket.id) toggleBucket(bucket.id); }}
                  className={`group cursor-pointer transition-colors ${bucket.enabled ? 'bg-primary/10' : 'hover:bg-base-200'}`}
                >
                  <td className="flex items-center justify-between" style={{ height: 30 }}>
                    <span className="flex items-center gap-2">
                      <Pin
                        size={12}
                        className={`shrink-0 transition-colors ${bucket.enabled ? 'text-primary' : 'text-base-content/20'}`}
                        fill={bucket.enabled ? 'currentColor' : 'none'}
                      />
                      {editingId === bucket.id ? (
                        <>
                          <input
                            ref={editInputRef}
                            type="text"
                            className="input input-xs h-5 text-xs w-24 @2xs:w-32 @xs:w-48"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleConfirmEdit();
                              if (e.key === 'Escape') handleCancelEdit();
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <span className="flex items-center gap-0.5 shrink-0">
                            <button
                              className="text-success/70 hover:text-success cursor-pointer p-0.5"
                              onClick={(e) => { e.stopPropagation(); handleConfirmEdit(); }}
                              title="Confirm"
                            >
                              <Check size={12} />
                            </button>
                            <button
                              className="text-error/70 hover:text-error cursor-pointer p-0.5"
                              onClick={(e) => { e.stopPropagation(); handleCancelEdit(); }}
                              title="Cancel"
                            >
                              <X size={12} />
                            </button>
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="truncate max-w-20 @2xs:max-w-32 @xs:max-w-48 @sm:max-w-64" title={bucket.name}>
                            {bucket.name}
                          </span>
                          <span className="hidden @2xs:inline text-base-content/40 shrink-0">({bucket.bedIds.length})</span>
                        </>
                      )}
                    </span>
                    {editingId !== bucket.id && (
                      <span className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          className="text-base-content/40 hover:text-base-content cursor-pointer p-0.5"
                          onClick={(e) => { e.stopPropagation(); handleStartEdit(bucket.id, bucket.name); }}
                          title="Rename"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          className="text-error/60 hover:text-error cursor-pointer p-0.5"
                          onClick={(e) => { e.stopPropagation(); deleteBucket(bucket.id); }}
                        >
                          <Trash2 size={12} />
                        </button>
                        <a
                          href={`/collections/selection/${bucket.id}`}
                          className="text-base-content/40 hover:text-base-content cursor-pointer p-0.5"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); openTab('collections', 'selection/' + bucket.id); }}
                          title="View details"
                        >
                          <ArrowRight size={12} />
                        </a>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>}
    </div>
  );
}
