import { useState } from 'react';
import { Pin, ChevronDown } from 'lucide-react';
import { tableau20 } from '../../lib/tableau20';
import { sequentialPalette } from '../../lib/sequential-palette';
import type { LegendItem } from '../../lib/umap-utils';
import { ColorByManager } from './color-by-manager';

const CONTINUOUS_FIELDS = ['number_of_regions', 'mean_region_width', 'gc_content', 'median_tss_dist'];

type Props = {
  legendItems: LegendItem[];
  pinnedCategories: number[];
  onTogglePin: (category: number) => void;
  onPinAll: () => void;
  onUnpinAll: () => void;
  colorGrouping: string;
  setColorGrouping: (grouping: string) => void;
  tier2Loaded: boolean;
  onLoadTier2: () => void;
  tier2Loading: boolean;
};

export function EmbeddingLegend({
  legendItems,
  pinnedCategories,
  onTogglePin,
  onPinAll,
  onUnpinAll,
  colorGrouping,
  setColorGrouping,
  tier2Loaded,
  onLoadTier2,
  tier2Loading,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const pinnedSet = new Set(pinnedCategories);
  const isContinuous = CONTINUOUS_FIELDS.includes(colorGrouping.replace('_category', ''));
  const palette = isContinuous ? sequentialPalette : tableau20;
  const getCategoryColor = (category: number) => palette[category] ?? '#888888';

  return (
    <div className={`border border-base-300 rounded-lg bg-base-100 flex flex-col ${collapsed ? 'shrink-0' : 'flex-1 min-h-0'}`}>
      <div
        className={`px-3 py-2 ${collapsed ? '' : 'border-b border-base-300'} bg-base-200 flex items-center justify-between shrink-0`}
      >
        <span className="flex items-center gap-1.5">
          <button onClick={() => setCollapsed(!collapsed)} className="cursor-pointer">
            <ChevronDown size={12} className={`text-base-content/40 transition-transform ${collapsed ? '-rotate-90' : ''}`} />
          </button>
          <span className="text-xs font-bold">Legend</span>
          {pinnedCategories.length > 0 ? (
            <button
              onClick={onUnpinAll}
              className="text-primary hover:text-primary/70 cursor-pointer transition-colors"
              title="Unpin all"
            >
              <Pin size={11} fill="currentColor" />
            </button>
          ) : (
            <button
              onClick={onPinAll}
              className="text-base-content/20 hover:text-base-content/50 cursor-pointer transition-colors"
              title="Pin all"
            >
              <Pin size={11} />
            </button>
          )}
        </span>
        <span>
          <ColorByManager
            colorGrouping={colorGrouping}
            setColorGrouping={setColorGrouping}
            tier2Loaded={tier2Loaded}
            onLoadTier2={onLoadTier2}
            tier2Loading={tier2Loading}
          />
        </span>
      </div>
      {!collapsed && (
        <div className="overflow-y-auto overscroll-contain flex-1 min-h-0">
          <table className="table table-sm table-fixed text-xs w-full">
            <tbody>
              {legendItems.length === 0
                ? [72, 56, 88, 64, 80, 48, 68, 92, 60, 76].map((w, i) => (
                    <tr key={i} className="opacity-75">
                      <td className="flex items-center justify-between" style={{ height: 30 }}>
                        <span className="flex items-center gap-2">
                          <span className="skeleton skeleton-subtle w-3 h-3 rounded-sm shrink-0" />
                          <span className="skeleton skeleton-subtle h-2.5 rounded" style={{ width: w }} />
                        </span>
                        <span className="skeleton skeleton-subtle w-3 h-3 rounded-sm shrink-0" />
                      </td>
                    </tr>
                  ))
                : legendItems.map((item) => {
                    const isPinned = pinnedSet.has(item.category);
                    return (
                      <tr
                        key={item.category}
                        onClick={() => onTogglePin(item.category)}
                        className={`cursor-pointer transition-colors ${
                          isPinned ? 'bg-primary/10' : 'hover:bg-base-200'
                        }`}
                      >
                        <td className="!p-0">
                          <div className="flex items-center justify-between gap-1 px-3 py-1" style={{ height: 30 }}>
                            <span className="flex items-center gap-2 min-w-0 overflow-hidden">
                              <span
                                className="inline-block w-3 h-3 rounded-sm shrink-0"
                                style={{ backgroundColor: getCategoryColor(item.category) }}
                              />
                              <span className="truncate">{item.name}</span>
                            </span>
                            <Pin
                              size={12}
                              className={`shrink-0 transition-colors ${
                                isPinned ? 'text-primary' : 'text-base-content/20'
                              }`}
                              fill={isPinned ? 'currentColor' : 'none'}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
