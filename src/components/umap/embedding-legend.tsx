import { Dna, FlaskConical, Pin } from 'lucide-react';
import { tableau20 } from '../../lib/tableau20';
import type { LegendItem } from '../../lib/umap-utils';

function getCategoryColor(category: number): string {
  return tableau20[category] ?? '#888888';
}

type Props = {
  legendItems: LegendItem[];
  pinnedCategories: number[];
  onTogglePin: (category: number) => void;
  onPinAll: () => void;
  onUnpinAll: () => void;
  colorGrouping: string;
  setColorGrouping: (grouping: string) => void;
};

export function EmbeddingLegend({
  legendItems,
  pinnedCategories,
  onTogglePin,
  onPinAll,
  onUnpinAll,
  colorGrouping,
  setColorGrouping,
}: Props) {
  const pinnedSet = new Set(pinnedCategories);

  return (
    <div className="border border-base-300 rounded-lg overflow-clip bg-base-100 flex flex-col min-h-0 flex-1">
      <div className="px-3 py-2 border-b border-base-300 bg-base-200 flex items-center justify-between">
        <span className="flex items-center gap-1.5">
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
        {/* Narrow: icon toggle */}
        <button
          className="@2xs:hidden btn btn-xs btn-ghost h-[18px] min-h-0 px-1 -my-0.5"
          onClick={() => setColorGrouping(colorGrouping === 'cell_line_category' ? 'assay_category' : 'cell_line_category')}
          title={colorGrouping === 'cell_line_category' ? 'Cell Line' : 'Assay'}
        >
          {colorGrouping === 'cell_line_category' ? <Dna size={12} /> : <FlaskConical size={12} />}
        </button>
        {/* Wide: radio group */}
        <div className="join -my-0.5 hidden @2xs:flex">
          <input
            type="radio"
            name="color_legend"
            className="join-item btn btn-xs h-[18px] min-h-0 text-[10px] px-1.5"
            aria-label="Cell Line"
            value="cell_line_category"
            checked={colorGrouping === 'cell_line_category'}
            onChange={(e) => setColorGrouping(e.target.value)}
          />
          <input
            type="radio"
            name="color_legend"
            className="join-item btn btn-xs h-[18px] min-h-0 text-[10px] px-1.5"
            aria-label="Assay"
            value="assay_category"
            checked={colorGrouping === 'assay_category'}
            onChange={(e) => setColorGrouping(e.target.value)}
          />
        </div>
      </div>
      <div className="overflow-y-auto overscroll-contain flex-1 min-h-0">
        <table className="table table-sm text-xs w-full">
          <tbody>
            {legendItems?.map((item) => {
              const isPinned = pinnedSet.has(item.category);
              return (
                <tr
                  key={item.category}
                  onClick={() => onTogglePin(item.category)}
                  className={`cursor-pointer transition-colors ${
                    isPinned ? 'bg-primary/10' : 'hover:bg-base-200'
                  }`}
                >
                  <td className="flex items-center justify-between" style={{ height: 30 }}>
                    <span className="flex items-center gap-2 whitespace-nowrap">
                      <span
                        className="inline-block w-3 h-3 rounded-sm shrink-0"
                        style={{ backgroundColor: getCategoryColor(item.category) }}
                      />
                      {item.name}
                    </span>
                    <Pin
                      size={12}
                      className={`shrink-0 transition-colors ${
                        isPinned ? 'text-primary' : 'text-base-content/20'
                      }`}
                      fill={isPinned ? 'currentColor' : 'none'}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
