import { Download } from 'lucide-react';
import type { ChromosomeRow } from '../../lib/bed-analysis';

interface Props {
  rows: ChromosomeRow[];
  fileName: string;
}

export function ChromosomeStats({ rows, fileName }: Props) {
  if (rows.length === 0) return null;

  function downloadCsv() {
    const headers = [
      'Chromosome',
      'Regions',
      'Start',
      'End',
      'Min length',
      'Max length',
      'Mean length',
      'Median length',
    ];
    const csvRows = rows.map((s) =>
      [s.chromosome, s.count, s.start, s.end, s.min, s.max, s.mean.toFixed(2), s.median.toFixed(2)]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(','),
    );
    const csv = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}-chromosome-stats.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between">
        <h3 className="text-sm font-semibold text-base-content/50 uppercase tracking-wide">Chromosome statistics</h3>
        <button
          onClick={downloadCsv}
          className="btn btn-xs btn-ghost gap-1 text-base-content/50"
        >
          <Download size={12} />
          CSV
        </button>
      </div>
      <div className="border border-base-300 rounded-lg overflow-hidden bg-base-100">
        <div className="overflow-auto" style={{ maxHeight: '500px' }}>
          <table className="table table-xs table-pin-rows">
            <thead className="text-base-content">
              <tr className="bg-base-200">
                <th className="whitespace-nowrap text-base-content">Chromosome</th>
                <th className="whitespace-nowrap text-base-content text-right">Regions</th>
                <th className="whitespace-nowrap text-base-content text-right">Start</th>
                <th className="whitespace-nowrap text-base-content text-right">End</th>
                <th className="whitespace-nowrap text-base-content text-right">Min</th>
                <th className="whitespace-nowrap text-base-content text-right">Max</th>
                <th className="whitespace-nowrap text-base-content text-right">Mean</th>
                <th className="whitespace-nowrap text-base-content text-right">Median</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.chromosome}>
                  <th className="font-medium">{s.chromosome}</th>
                  <td className="text-right">{s.count.toLocaleString()}</td>
                  <td className="text-right">{s.start.toLocaleString()}</td>
                  <td className="text-right">{s.end.toLocaleString()}</td>
                  <td className="text-right">{s.min.toLocaleString()}</td>
                  <td className="text-right">{s.max.toLocaleString()}</td>
                  <td className="text-right">{s.mean.toFixed(2)}</td>
                  <td className="text-right">{s.median.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
