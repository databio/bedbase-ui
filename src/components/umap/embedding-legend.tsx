import { Dna, FlaskConical } from 'lucide-react';
import { tableau20 } from '../../lib/tableau20';
import type { LegendItem } from '../../lib/umap-utils';

function getCategoryColor(category: number): string {
  return tableau20[category] ?? '#888888';
}

type Props = {
  legendItems: LegendItem[];
  filterSelection: LegendItem | null;
  handleLegendClick: (item: LegendItem) => void;
  colorGrouping: string;
  setColorGrouping: (grouping: string) => void;
  onSaveCategory?: (item: LegendItem) => void;
};

export function EmbeddingLegend({
  legendItems,
  filterSelection,
  handleLegendClick,
  colorGrouping,
  setColorGrouping,
  onSaveCategory,
}: Props) {
  return (
    <div className="border border-base-300 rounded-lg overflow-clip bg-white flex flex-col min-h-0 flex-1">
      <div className="px-3 py-2 border-b border-base-300 bg-base-200 flex items-center justify-between">
        <span className="text-xs font-bold">Legend</span>
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
            {legendItems?.map((item) => (
              <tr
                key={item.category}
                onClick={() => handleLegendClick(item)}
                className={`cursor-pointer transition-colors ${
                  filterSelection?.category === item.category
                    ? 'bg-primary/10'
                    : 'hover:bg-base-200'
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
                  {filterSelection?.category === item.category && (
                    <span className="flex gap-1">
                      <button className="btn btn-xs h-5 min-h-0 text-[10px] px-1.5 btn-error">Clear</button>
                      <button
                        className="btn btn-xs h-5 min-h-0 text-[10px] px-1.5 btn-ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSaveCategory?.(item);
                        }}
                      >
                        Save
                      </button>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
