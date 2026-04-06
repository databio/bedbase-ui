import { Plus, Check } from 'lucide-react';
import type { components } from '../../bedbase-types';
import { useTab } from '../../contexts/tab-context';
import { useCart } from '../../contexts/cart-context';
import type { BatchBedResult } from '../../queries/use-bed-batch';

type BedMetadataBasic = components['schemas']['BedMetadataBasic'];

function fmtNum(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function BedfileTable({
  bedfiles,
  batchStats,
}: {
  bedfiles: BedMetadataBasic[];
  batchStats?: BatchBedResult[];
}) {
  const { openTab } = useTab();
  const { addToCart, removeFromCart, isInCart } = useCart();

  const statsMap = new Map<string, BatchBedResult>();
  if (batchStats) {
    for (const b of batchStats) statsMap.set(b.id, b);
  }
  const hasStats = statsMap.size > 0;

  return (
    <div className="overflow-x-auto border border-base-300 rounded-lg bg-base-100">
      <table className="table table-sm text-xs w-full">
        <thead className="text-base-content">
          <tr>
            <th>Name</th>
            <th>Genome</th>
            <th>Tissue</th>
            <th>Cell type</th>
            <th>Assay</th>
            {hasStats && <th className="text-right">Regions</th>}
            {hasStats && <th className="text-right">Mean width</th>}
            {hasStats && <th className="text-right">GC</th>}
            <th>Description</th>
            <th className="w-20">Cart</th>
          </tr>
        </thead>
        <tbody>
          {bedfiles.map((bed) => {
            const inCart = isInCart(bed.id);
            const stats = statsMap.get(bed.id)?.stats;
            return (
              <tr
                key={bed.id}
                onClick={() => openTab('analysis', 'bed/' + bed.id)}
                className="hover:bg-primary/5 cursor-pointer transition-colors"
              >
                <td className="font-medium max-w-48 truncate">
                  <a
                    href={`/analysis/bed/${bed.id}`}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); openTab('analysis', 'bed/' + bed.id); }}
                    className="hover:underline"
                  >{bed.name || 'Unnamed'}</a>
                </td>
                <td>
                  {bed.genome_alias ? (
                    <span className="badge badge-xs badge-primary font-semibold">{bed.genome_alias}</span>
                  ) : (
                    <span className="text-base-content/30">—</span>
                  )}
                </td>
                <td className="max-w-24 truncate text-base-content/50">{bed.annotation?.tissue || '—'}</td>
                <td className="max-w-24 truncate text-base-content/50">{bed.annotation?.cell_type || '—'}</td>
                <td className="max-w-24 truncate text-base-content/50">{bed.annotation?.assay || '—'}</td>
                {hasStats && <td className="text-right tabular-nums">{fmtNum(stats?.number_of_regions)}</td>}
                {hasStats && <td className="text-right tabular-nums">{fmtNum(stats?.mean_region_width)}</td>}
                {hasStats && <td className="text-right tabular-nums">{fmtNum(stats?.gc_content)}</td>}
                <td className="max-w-xs truncate text-base-content/50">{bed.description || ''}</td>
                <td>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (inCart) {
                        removeFromCart(bed.id);
                      } else {
                        addToCart({
                          id: bed.id,
                          name: bed.name || 'Unnamed',
                          genome: bed.genome_alias || '',
                          tissue: bed.annotation?.tissue || '',
                          cell_line: bed.annotation?.cell_line || '',
                          cell_type: bed.annotation?.cell_type || '',
                          description: bed.description || '',
                          assay: bed.annotation?.assay || '',
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
