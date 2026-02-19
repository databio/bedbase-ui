import { Plus, Check } from 'lucide-react';
import type { components } from '../../bedbase-types';
import { useTab } from '../../contexts/tab-context';
import { useCart } from '../../contexts/cart-context';

type BedMetadataBasic = components['schemas']['BedMetadataBasic'];

export function BedfileTable({ bedfiles }: { bedfiles: BedMetadataBasic[] }) {
  const { openTab } = useTab();
  const { addToCart, removeFromCart, isInCart } = useCart();

  return (
    <div className="overflow-x-auto border border-base-300 rounded-lg bg-white">
      <table className="table table-sm text-xs w-full">
        <thead className="text-base-content">
          <tr>
            <th>Name</th>
            <th>Genome</th>
            <th>Description</th>
            <th className="w-20">Cart</th>
          </tr>
        </thead>
        <tbody>
          {bedfiles.map((bed) => {
            const inCart = isInCart(bed.id);
            return (
              <tr
                key={bed.id}
                onClick={() => openTab('analysis', bed.id)}
                className="hover:bg-primary/5 cursor-pointer transition-colors"
              >
                <td className="font-medium max-w-48 truncate">{bed.name || 'Unnamed'}</td>
                <td>
                  {bed.genome_alias ? (
                    <span className="badge badge-xs badge-primary font-semibold">{bed.genome_alias}</span>
                  ) : (
                    <span className="text-base-content/30">—</span>
                  )}
                </td>
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
