import { Download, Plus, Check, ExternalLink, ScatterChart } from 'lucide-react';
import { useCart } from '../../contexts/cart-context';
import { useTab } from '../../contexts/tab-context';
import { useMosaicCoordinator } from '../../contexts/mosaic-coordinator-context';
import type { BedAnalysis } from '../../lib/bed-analysis';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'https://api.bedbase.org/v1';

const linkClass = 'inline-flex items-center gap-1.5 text-xs font-medium text-base-content/60 hover:text-base-content/80 bg-base-200 hover:bg-base-300 px-2.5 py-1.5 rounded-md transition-colors cursor-pointer';

export function ActionBar({ analysis }: { analysis: BedAnalysis }) {
  const { addToCart, removeFromCart, isInCart } = useCart();
  const { openTab } = useTab();
  const { umapBedIds } = useMosaicCoordinator();

  const inCart = analysis.id ? isInCart(analysis.id) : false;
  const { downloadUrls } = analysis;
  const isInUmap = analysis.id ? umapBedIds.has(analysis.id) : false;

  const handleCart = () => {
    if (!analysis.id) return;
    if (inCart) {
      removeFromCart(analysis.id);
    } else {
      addToCart({
        id: analysis.id,
        name: analysis.fileName || 'Unnamed',
        genome: analysis.summary.dataFormat || '',
      });
    }
  };

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {downloadUrls?.bed && (
        <a href={downloadUrls.bed} target="_blank" rel="noopener noreferrer" className={linkClass}>
          <Download size={13} />
          BED
        </a>
      )}
      {downloadUrls?.bigBed && (
        <a href={downloadUrls.bigBed} target="_blank" rel="noopener noreferrer" className={linkClass}>
          <Download size={13} />
          BigBED
        </a>
      )}
      {analysis.id && (
        <>
          {isInUmap && (
            <button
              onClick={() => openTab('umap', analysis.id)}
              className={linkClass}
            >
              <ScatterChart size={13} />
              View on UMAP
            </button>
          )}
          <button
            onClick={handleCart}
            className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md transition-colors cursor-pointer ${
              inCart
                ? 'text-success bg-success/20 hover:bg-success/30'
                : 'text-base-content/60 hover:text-base-content/80 bg-base-200 hover:bg-base-300'
            }`}
          >
            {inCart ? <Check size={13} /> : <Plus size={13} />}
            {inCart ? 'In cart' : 'Add to cart'}
          </button>
          <a
            href={`${API_BASE}/bed/${analysis.id}/metadata?full=true`}
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
          >
            <ExternalLink size={13} />
            API
          </a>
        </>
      )}
    </div>
  );
}
