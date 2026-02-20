import { ArrowUpRight, Table2 } from 'lucide-react';
import { useTab } from '../../contexts/tab-context';
import type { UmapPoint } from '../../lib/umap-utils';

type Props = {
  selectedPoints: UmapPoint[];
  centerOnBedId?: (bedId: string, scale?: number) => void;
  className?: string;
};

export function EmbeddingTable({ selectedPoints, centerOnBedId, className }: Props) {
  const { openTab } = useTab();
  const filtered = selectedPoints.filter((p) => p != null && p.identifier !== 'custom_point');

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
          <thead className="sticky top-0 bg-white z-10 text-[11px] text-black">
            <tr className="whitespace-nowrap">
              <th>BED Name</th>
              <th>Assay</th>
              <th>Cell Line</th>
              <th>Description</th>
              <th className="w-6" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((point, index) => (
              <tr
                key={`${point.identifier}_${index}`}
                className="cursor-pointer hover:bg-base-200 transition-colors"
                onClick={() => centerOnBedId?.(point.identifier, 0.5)}
              >
                <td className="whitespace-nowrap max-w-40 truncate">{point.text}</td>
                <td className="whitespace-nowrap">{point.fields?.Assay}</td>
                <td className="whitespace-nowrap">{point.fields?.['Cell Line']}</td>
                <td className="max-w-xs truncate">{point.fields?.Description}</td>
                <td>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openTab('analysis', point.identifier);
                    }}
                    className="btn btn-xs btn-ghost p-0.5"
                    title="View analysis"
                  >
                    <ArrowUpRight size={10} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
