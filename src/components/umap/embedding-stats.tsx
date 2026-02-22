import { useEffect, useMemo, useState } from 'react';
import * as vg from '@uwdata/vgplot';
import { useMosaicCoordinator } from '../../contexts/mosaic-coordinator-context';
import type { UmapPoint, LegendItem } from '../../lib/umap-utils';

type Props = {
  selectedPoints: UmapPoint[];
  colorGrouping: string;
  legendItems: LegendItem[];
  pinnedCategories: number[];
};

export function EmbeddingStats({ selectedPoints, colorGrouping, legendItems, pinnedCategories }: Props) {
  const { coordinator } = useMosaicCoordinator();
  const [totalCounts, setTotalCounts] = useState<Map<number, number>>(new Map());

  useEffect(() => {
    if (!coordinator || legendItems.length === 0) return;
    const q = vg.Query.from('data')
      .select({ category: vg.column(colorGrouping), count: vg.sql`COUNT(*)` })
      .groupby(vg.column(colorGrouping));
    coordinator
      .query(q, { type: 'json' })
      .then((result: any) => {
        const map = new Map<number, number>();
        for (const row of result) map.set(row.category, Number(row.count));
        setTotalCounts(map);
      })
      .catch(() => {});
  }, [coordinator, colorGrouping, legendItems.length]);

  const hasSelection = selectedPoints.length > 0;

  const rows = useMemo(() => {
    if (hasSelection) {
      const counts = new Map<number, number>();
      for (const p of selectedPoints) {
        const cat = (p as any)[colorGrouping] ?? p.category;
        if (cat != null) counts.set(cat, (counts.get(cat) || 0) + 1);
      }
      return legendItems.map((item) => ({
        name: item.name,
        category: item.category,
        count: counts.get(item.category) || 0,
      }));
    }
    if (pinnedCategories.length > 0) {
      const pinnedSet = new Set(pinnedCategories);
      return legendItems.map((item) => ({
        name: item.name,
        category: item.category,
        count: pinnedSet.has(item.category)
          ? (totalCounts.get(item.category) ?? 0)
          : 0,
      }));
    }
    return legendItems.map((item) => ({
      name: item.name,
      category: item.category,
      count: totalCounts.get(item.category) ?? 0,
    }));
  }, [selectedPoints, colorGrouping, legendItems, hasSelection, totalCounts, pinnedCategories]);

  const showBackground = hasSelection || pinnedCategories.length > 0;
  const maxTotal = useMemo(
    () => Math.max(1, ...legendItems.map((item) => totalCounts.get(item.category) ?? 0)),
    [legendItems, totalCounts],
  );
  const maxRows = useMemo(() => Math.max(1, ...rows.map((r) => r.count)), [rows]);
  const maxCount = showBackground ? maxTotal : maxRows;

  // Header ~33px + inner padding 16px + rows (14px each) + gaps (2px between rows)
  const maxHeight = rows.length > 0
    ? 33 + 16 + rows.length * 14 + Math.max(0, rows.length - 1) * 2
    : undefined;

  return (
    <div className="border border-base-300 rounded-lg bg-base-100 flex flex-col min-h-0 flex-1" style={{ maxHeight }}>
      <div className="px-3 py-2 border-b border-base-300 bg-base-200 text-xs font-bold">
        Selection Count
      </div>
      <div className="p-2 overflow-y-auto overscroll-contain flex-1 min-h-0">
        <div className="flex flex-col gap-0.5">
          {rows.length === 0
            ? [55, 80, 48, 70, 62, 90, 45, 75, 58, 85].map((w, i) => (
                <div key={i} className="flex items-center gap-1 opacity-75" style={{ height: 14 }}>
                  <span className="skeleton skeleton-subtle shrink-0 h-2 rounded" style={{ width: 70 }} />
                  <div className="flex-1 h-2 relative">
                    <div className="skeleton skeleton-subtle absolute inset-y-0 left-0 rounded" style={{ width: `${w}%` }} />
                  </div>
                  <span className="skeleton skeleton-subtle shrink-0 h-2 rounded w-6" />
                </div>
              ))
            : rows.map((row) => {
                const total = totalCounts.get(row.category) ?? 0;
                return (
                  <div key={row.category} className="flex items-center gap-1" style={{ height: 14 }}>
                    <span
                      className="shrink-0 text-right overflow-hidden text-ellipsis whitespace-nowrap"
                      style={{ width: 70, fontSize: 9 }}
                      title={row.name}
                    >
                      {row.name}
                    </span>
                    <div className="flex-1 h-2.5 relative">
                      {showBackground && total > 0 && (
                        <div
                          className="absolute inset-y-0 left-0"
                          style={{
                            width: `${(total / maxTotal) * 100}%`,
                            backgroundColor: 'steelblue',
                            opacity: 0.15,
                            borderRadius: 2,
                          }}
                        />
                      )}
                      {row.count > 0 && (
                        <div
                          className="absolute inset-y-0 left-0"
                          style={{
                            width: `${(row.count / maxCount) * 100}%`,
                            backgroundColor: 'steelblue',
                            borderRadius: 2,
                          }}
                        />
                      )}
                    </div>
                    <span className={`shrink-0 text-right whitespace-nowrap ${row.count > 0 ? 'text-base-content/40' : 'text-base-content/15'}`} style={{ fontSize: 8 }}>
                      {row.count}/{total}
                    </span>
                  </div>
                );
              })}
        </div>
      </div>
    </div>
  );
}
