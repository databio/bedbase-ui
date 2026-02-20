import { Plus, Check } from 'lucide-react';
import type { components } from '../../bedbase-types';
import { useTab } from '../../contexts/tab-context';
import { useCart } from '../../contexts/cart-context';

type QdrantSearchResult = components['schemas']['QdrantSearchResult'];

function roundScore(score: number): string {
  return (score * 100).toFixed(1);
}

export function ResultsTable({ results }: { results: QdrantSearchResult[] }) {
  const { openTab } = useTab();
  const { addToCart, removeFromCart, isInCart } = useCart();

  return (
    <div className="overflow-x-auto border border-base-300 rounded-lg bg-white">
      <table className="table table-sm text-xs w-full">
        <thead className="text-base-content">
          <tr>
            <th>Name</th>
            <th>Genome</th>
            <th>Tissue</th>
            <th>Cell line</th>
            <th>Cell type</th>
            <th>Assay</th>
            <th>Description</th>
            <th className="text-right">Score</th>
            <th className="w-20">Cart</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r) => {
            const meta = r.metadata;
            const anno = meta?.annotation;
            const inCart = meta?.id ? isInCart(meta.id) : false;
            return (
              <tr
                key={r.id}
                onClick={() => meta?.id && openTab('analysis', 'bed/' + meta.id)}
                className="hover:bg-primary/5 cursor-pointer transition-colors"
              >
                <td className="font-medium max-w-48 truncate">{meta?.name || 'Unnamed'}</td>
                <td>
                  {meta?.genome_alias ? (
                    <span className="badge badge-xs badge-primary font-semibold">{meta.genome_alias}</span>
                  ) : (
                    <span className="text-base-content/30">—</span>
                  )}
                </td>
                <td className="max-w-32 truncate">{anno?.tissue || <span className="text-base-content/30">—</span>}</td>
                <td className="max-w-32 truncate">{anno?.cell_line || <span className="text-base-content/30">—</span>}</td>
                <td className="max-w-32 truncate">{anno?.cell_type || <span className="text-base-content/30">—</span>}</td>
                <td className="max-w-32 truncate">{anno?.assay || <span className="text-base-content/30">—</span>}</td>
                <td className="max-w-xs truncate text-base-content/50">{meta?.description || ''}</td>
                <td className="text-right font-semibold text-primary">{roundScore(r.score ?? 0)}%</td>
                <td>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!meta?.id) return;
                      if (inCart) {
                        removeFromCart(meta.id);
                      } else {
                        addToCart({
                          id: meta.id,
                          name: meta.name || 'Unnamed',
                          genome: meta.genome_alias || '',
                        });
                      }
                    }}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                      inCart
                        ? 'bg-success/10 text-success hover:bg-success/20'
                        : 'bg-base-200 text-base-content/60 hover:bg-primary/10 hover:text-primary'
                    }`}
                  >
                    {inCart ? <Check size={12} /> : <Plus size={12} />}
                    {inCart ? 'Added' : 'Add'}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
