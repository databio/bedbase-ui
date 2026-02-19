import { useState, useEffect, useRef } from 'react';
import { ShoppingCart, X, Download, Search, Trash2, Copy, CheckCheck, Terminal } from 'lucide-react';
import { useTab } from '../../contexts/tab-context';
import { useCart } from '../../contexts/cart-context';
import { generateDownloadScript, downloadAsFile } from '../../lib/download-script';
import type { CartItem } from '../../contexts/cart-context';

function DownloadModal({ items, onClose }: { items: CartItem[]; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const script = generateDownloadScript(items);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(script);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-base-100 rounded-lg shadow-lg w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-base-300 shrink-0">
          <h3 className="text-sm font-semibold">Download Cart</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-base-200 transition-colors cursor-pointer">
            <X size={16} />
          </button>
        </div>
        <div className="overflow-auto p-4 space-y-3">
          <p className="text-xs text-base-content/60">
            Run this script to download {items.length} {items.length === 1 ? 'file' : 'files'} from BEDbase. Copy the commands below or download as a shell script.
          </p>
          <div className="relative">
            <pre className="bg-base-200 rounded-lg p-4 text-xs font-mono text-base-content overflow-auto max-h-64 whitespace-pre-wrap">
              {script}
            </pre>
            <button
              onClick={handleCopy}
              className="absolute top-2 right-2 btn btn-xs btn-ghost gap-1"
            >
              {copied ? <><CheckCheck size={12} className="text-success" /> Copied</> : <><Copy size={12} /> Copy</>}
            </button>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-base-300 shrink-0">
          <button onClick={onClose} className="btn btn-sm btn-ghost">Close</button>
          <button
            onClick={() => downloadAsFile(script, 'bedbase-download.sh')}
            className="btn btn-sm btn-primary gap-1.5"
          >
            <Download size={14} />
            Download .sh
          </button>
        </div>
      </div>
    </div>
  );
}

export function CartView() {
  const { openTab } = useTab();
  const { cart, removeFromCart, clearCart, cartCount } = useCart();
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const [showDownload, setShowDownload] = useState(false);
  const items = Object.values(cart);

  useEffect(() => {
    if (countdown > 0) {
      timerRef.current = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) {
            clearInterval(timerRef.current);
            return 0;
          }
          return c - 1;
        });
      }, 1000);
      return () => clearInterval(timerRef.current);
    }
  }, [countdown > 0]);

  if (cartCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-3 px-4">
        <ShoppingCart size={32} className="text-base-content/20" />
        <p className="text-base-content/50 text-sm">Your cart is empty</p>
        <button
          onClick={() => openTab('search')}
          className="btn btn-sm btn-primary gap-1.5"
        >
          <Search size={14} />
          Search for BED files
        </button>
      </div>
    );
  }

  const handleClear = () => {
    if (countdown > 0) {
      clearCart();
      setCountdown(0);
    } else {
      setCountdown(5);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-auto p-4 @md:p-6">
      <div className="flex items-center justify-between pb-4">
        <h2 className="text-lg font-semibold text-base-content">
          Cart ({cartCount} {cartCount === 1 ? 'file' : 'files'})
        </h2>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowDownload(true)} className="btn btn-sm btn-primary gap-1.5">
            <Terminal size={14} />
            Download
          </button>
          <button
            onClick={handleClear}
            className={`btn btn-sm gap-1.5 ${countdown > 0 ? 'btn-error' : 'btn-ghost'}`}
          >
            <Trash2 size={14} />
            {countdown > 0 ? `Confirm? (${countdown})` : 'Clear all'}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto border border-base-300 rounded-lg bg-white">
        <table className="table table-sm text-xs w-full">
          <thead className="text-base-content">
            <tr>
              <th>Name</th>
              <th>Genome</th>
              <th className="w-12"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                onClick={() => openTab('analysis', item.id)}
                className="hover:bg-primary/5 cursor-pointer transition-colors"
              >
                <td className="font-medium max-w-64 truncate">{item.name}</td>
                <td>
                  {item.genome ? (
                    <span className="badge badge-xs badge-primary font-semibold">{item.genome}</span>
                  ) : (
                    <span className="text-base-content/30">—</span>
                  )}
                </td>
                <td>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFromCart(item.id);
                    }}
                    className="p-1 rounded hover:bg-error/10 transition-colors cursor-pointer"
                    title="Remove from cart"
                  >
                    <X size={14} className="text-base-content/40 hover:text-error" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showDownload && <DownloadModal items={items} onClose={() => setShowDownload(false)} />}
    </div>
  );
}
