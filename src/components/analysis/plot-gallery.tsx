import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import embed from 'vega-embed';
import type { PlotSlot } from '../../lib/plot-specs';

// --- Vega thumbnail renderer ---

function VegaThumbnail({ spec }: { spec: Record<string, unknown> }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const thumbnailSpec = { ...spec, width: 180, autosize: { type: 'fit', contains: 'padding' } };

    embed(el, thumbnailSpec as Parameters<typeof embed>[1], {
      actions: false,
      renderer: 'svg',
    }).catch((err) => console.error('Vega thumbnail error:', err));

    return () => {
      el.innerHTML = '';
    };
  }, [spec]);

  return <div ref={ref} className="flex items-center justify-center" />;
}

// --- Vega full-size renderer ---

function VegaFull({ buildSpec }: { buildSpec: (width: number) => Record<string, unknown> }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    function update() {
      if (ref.current) setWidth(ref.current.offsetWidth * 0.85);
    }
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || width <= 0) return;

    const spec = buildSpec(width);

    embed(el, spec as Parameters<typeof embed>[1], {
      actions: { export: true, source: false, compiled: false },
      renderer: 'svg',
    }).catch((err) => console.error('Vega full error:', err));

    return () => {
      el.innerHTML = '';
    };
  }, [buildSpec, width]);

  return <div ref={ref} className="w-full py-4 px-2" />;
}

// --- Plot modal ---

function PlotModal({
  plot,
  onClose,
}: {
  plot: PlotSlot;
  onClose: () => void;
}) {
  // Close on escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-base-100 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-base-300">
          <h3 className="text-sm font-semibold text-base-content">{plot.title}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-base-200 transition-colors cursor-pointer">
            <X size={16} className="text-base-content/50" />
          </button>
        </div>
        <div className="p-4">
          {plot.type === 'vega' ? (
            <VegaFull buildSpec={plot.buildFullSpec} />
          ) : (
            <img src={plot.full} alt={plot.title} className="w-full h-auto" />
          )}
        </div>
      </div>
    </div>
  );
}

// --- Gallery grid ---

export function PlotGallery({ plots }: { plots: PlotSlot[] }) {
  const [expanded, setExpanded] = useState<PlotSlot | null>(null);

  if (plots.length === 0) return null;

  return (
    <>
      <div className="grid grid-cols-2 @3xl:grid-cols-4 gap-2">
        {plots.map((plot) => (
          <button
            key={plot.id}
            onClick={() => setExpanded(plot)}
            className="border border-base-300 rounded-lg bg-base-100 overflow-hidden hover:border-base-content/20 transition-colors cursor-pointer text-left"
          >
            <div className="p-2 flex items-center justify-center min-h-[140px] overflow-hidden">
              {plot.type === 'vega' ? (
                <VegaThumbnail spec={plot.spec} />
              ) : (
                <img src={plot.thumbnail} alt={plot.title} className="max-h-[130px] object-contain" />
              )}
            </div>
            <div className="px-3 py-2 border-t border-base-300 bg-base-200/50">
              <p className="text-xs font-medium text-base-content/80 truncate text-center">{plot.title}</p>
            </div>
          </button>
        ))}
      </div>

      {expanded && <PlotModal plot={expanded} onClose={() => setExpanded(null)} />}
    </>
  );
}
