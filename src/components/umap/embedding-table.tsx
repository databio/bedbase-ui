import { FlaskConical, Table2 } from 'lucide-react';
import { useTab } from '../../contexts/tab-context';
import type { UmapPoint } from '../../lib/umap-utils';

type Props = {
  selectedPoints: UmapPoint[];
  centerOnBedId?: (bedId: string, scale?: number) => void;
  className?: string;
};

const TABLE_ROW_LIMIT = 200;

export function EmbeddingTable({ selectedPoints, centerOnBedId, className }: Props) {
  const { openTab } = useTab();
  const filtered = selectedPoints.filter((p) => p != null && p.identifier !== 'custom_point');
  const visible = filtered.length > TABLE_ROW_LIMIT ? filtered.slice(0, TABLE_ROW_LIMIT) : filtered;
  const truncated = filtered.length > TABLE_ROW_LIMIT;

  return (
    <div className={`border border-base-300 rounded-lg overflow-auto overscroll-contain bg-white ${className || ''}`}>
      {filtered.length === 0 ? (
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
              <th className="w-6" />
            </tr>
          </thead>
          <tbody>
            {visible.map((point, index) => (
              <tr
                key={`${point.identifier}_${index}`}
                className="cursor-pointer hover:bg-base-200 transition-colors"
                onClick={() => centerOnBedId?.(point.identifier, 0.2)}
              >
                <td className="whitespace-nowrap max-w-40 truncate text-base-content/70">{point.text || point.identifier}</td>
                <td className="whitespace-nowrap text-base-content/50">{point.fields?.Assay}</td>
                <td className="whitespace-nowrap text-base-content/50">{point.fields?.['Cell Line']}</td>
                <td className="max-w-xs truncate text-base-content/50">{point.fields?.Description}</td>
                <td>
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
                </td>
              </tr>
            ))}
            {truncated && (
              <tr>
                <td colSpan={5} className="text-center text-base-content/40 py-1.5">
                  Showing {TABLE_ROW_LIMIT} of {filtered.length.toLocaleString()} selected
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
