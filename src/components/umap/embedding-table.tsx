import { useMemo } from 'react';
import { FlaskConical, MinusCircle, Table2 } from 'lucide-react';
import { useTab } from '../../contexts/tab-context';
import type { UmapPoint } from '../../lib/umap-utils';

type Props = {
  selectedPoints: UmapPoint[];
  preselectedIds?: Set<string>;
  bucketIds?: Set<string>;
  centerOnBedId?: (bedId: string, scale?: number) => void;
  onRemovePoint?: (identifier: string) => void;
  className?: string;
};

// DOM performance guard for large lasso selections.
// In the future, row searching/filtering should be considered as an alternative.
const TABLE_ROW_LIMIT = 200;

type RowKind = 'pinned' | 'custom' | 'bucket' | 'interactive';

function classifyPoint(
  identifier: string,
  preselectedIds?: Set<string>,
  bucketIds?: Set<string>,
): RowKind {
  if (preselectedIds?.has(identifier)) return 'pinned';
  if (identifier === 'custom_point') return 'custom';
  if (bucketIds?.has(identifier)) return 'bucket';
  return 'interactive';
}

const kindOrder: Record<RowKind, number> = { pinned: 0, custom: 1, bucket: 2, interactive: 3 };

const kindRowClass: Record<RowKind, string> = {
  pinned: 'bg-primary/5 hover:bg-primary/10',
  custom: 'bg-accent/5 hover:bg-accent/10',
  bucket: 'bg-secondary/5 hover:bg-secondary/10',
  interactive: 'hover:bg-base-200',
};

export function EmbeddingTable({
  selectedPoints,
  preselectedIds,
  bucketIds,
  centerOnBedId,
  onRemovePoint,
  className,
}: Props) {
  const { openTab } = useTab();

  const sorted = useMemo(() => {
    const valid = selectedPoints.filter((p) => p != null);
    return [...valid].sort((a, b) => {
      const ka = classifyPoint(a.identifier, preselectedIds, bucketIds);
      const kb = classifyPoint(b.identifier, preselectedIds, bucketIds);
      return kindOrder[ka] - kindOrder[kb];
    });
  }, [selectedPoints, preselectedIds, bucketIds]);

  const visible = sorted.length > TABLE_ROW_LIMIT ? sorted.slice(0, TABLE_ROW_LIMIT) : sorted;
  const truncated = sorted.length > TABLE_ROW_LIMIT;

  return (
    <div className={`border border-base-300 rounded-lg overflow-auto overscroll-contain bg-base-100 ${className || ''}`}>
      {sorted.length === 0 ? (
        <div className="h-full flex items-center justify-center">
          <span className="text-xs text-base-content/40 flex items-center gap-1.5">
            <Table2 size={12} />
            Select points on the plot to see details
          </span>
        </div>
      ) : (
        <table className="table w-full text-[11px] [&_th]:py-1 [&_th]:px-2 [&_td]:py-0.5 [&_td]:px-2">
          <thead className="sticky top-0 bg-base-200 z-10 text-[11px] font-bold text-base-content">
            <tr className="whitespace-nowrap">
              <th>BED Name</th>
              <th>Assay</th>
              <th>Cell Line</th>
              <th>Description</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {visible.map((point, index) => {
              const kind = classifyPoint(point.identifier, preselectedIds, bucketIds);
              const isCustom = kind === 'custom';
              const isRemovable = kind === 'bucket' || kind === 'interactive';

              return (
                <tr
                  key={`${point.identifier}_${index}`}
                  className={`cursor-pointer transition-colors ${kindRowClass[kind]}`}
                  onClick={() => centerOnBedId?.(point.identifier, 0.2)}
                >
                  <td className="whitespace-nowrap max-w-40 truncate text-base-content/70">
                    {isCustom ? (point.text || 'Your uploaded file') : (point.text || point.identifier)}
                  </td>
                  <td className="whitespace-nowrap text-base-content/50">{isCustom ? null : point.fields?.Assay}</td>
                  <td className="whitespace-nowrap text-base-content/50">{isCustom ? null : point.fields?.['Cell Line']}</td>
                  <td className="max-w-xs truncate text-base-content/50">{isCustom ? null : point.fields?.Description}</td>
                  <td>
                    <span className="flex items-center justify-end gap-1">
                      {isRemovable && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemovePoint?.(point.identifier);
                          }}
                          className="text-base-content/30 hover:text-error cursor-pointer transition-colors"
                          title="Remove from selection"
                        >
                          <MinusCircle size={11} />
                        </button>
                      )}
                      {!isCustom && (
                        <a
                          onClick={(e) => {
                            e.stopPropagation();
                            openTab('analysis', 'bed/' + point.identifier);
                          }}
                          className="text-base-content/30 hover:text-primary cursor-pointer transition-colors"
                          title="View analysis"
                        >
                          <FlaskConical size={11} />
                        </a>
                      )}
                    </span>
                  </td>
                </tr>
              );
            })}
            {truncated && (
              <tr>
                <td colSpan={5} className="text-center text-base-content/40 py-1.5">
                  Showing {TABLE_ROW_LIMIT} of {sorted.length.toLocaleString()} selected
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
