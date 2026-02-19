import type { components } from '../../bedbase-types';
import { useTab } from '../../contexts/tab-context';

type QdrantSearchResult = components['schemas']['QdrantSearchResult'];

function roundScore(score: number): string {
  return (score * 100).toFixed(1);
}

export function ResultsTable({ results }: { results: QdrantSearchResult[] }) {
  const { openTab } = useTab();

  return (
    <div className="overflow-x-auto border border-base-300 rounded-lg">
      <table className="table table-sm text-xs">
        <thead>
          <tr>
            <th>Name</th>
            <th>Genome</th>
            <th>Tissue</th>
            <th>Cell line</th>
            <th>Cell type</th>
            <th>Assay</th>
            <th>Description</th>
            <th className="text-right">Score</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r) => {
            const meta = r.metadata;
            const anno = meta?.annotation;
            return (
              <tr
                key={r.id}
                onClick={() => meta?.id && openTab('analysis', meta.id)}
                className="hover:bg-primary/5 cursor-pointer transition-colors"
              >
                <td className="font-medium max-w-48 truncate">{meta?.name || 'Unnamed'}</td>
                <td>
                  {meta?.genome_alias ? (
                    <span className="badge badge-sm badge-primary">{meta.genome_alias}</span>
                  ) : (
                    <span className="text-base-content/30">—</span>
                  )}
                </td>
                <td className="max-w-32 truncate">{anno?.tissue || <span className="text-base-content/30">—</span>}</td>
                <td className="max-w-32 truncate">{anno?.cell_line || <span className="text-base-content/30">—</span>}</td>
                <td className="max-w-32 truncate">{anno?.cell_type || <span className="text-base-content/30">—</span>}</td>
                <td className="max-w-32 truncate">{anno?.assay || <span className="text-base-content/30">—</span>}</td>
                <td className="max-w-64 truncate text-base-content/50">{meta?.description || ''}</td>
                <td className="text-right font-semibold text-primary">{roundScore(r.score ?? 0)}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
