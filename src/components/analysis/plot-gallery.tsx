import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Download } from 'lucide-react';
import type { PlotSlot } from '../../lib/plot-specs';

// --- Plot renderers ---

function PlotThumbnail({ renderThumbnail }: { renderThumbnail: (width: number, height: number) => Element }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<[number, number]>([0, 0]);

  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setSize([e.contentRect.width, e.contentRect.height]));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = ref.current;
    const [w, h] = size;
    if (!el || w <= 0 || h <= 0) return;
    const node = renderThumbnail(w, h);
    el.replaceChildren(node);
    return () => {
      el.replaceChildren();
    };
  }, [renderThumbnail, size]);

  return <div ref={ref} className="w-full h-full [&>svg]:block" />;
}

function PlotFull({ render }: { render: (width: number) => Element }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || width <= 0) return;
    const node = render(width);
    el.replaceChildren(node);
    return () => {
      el.replaceChildren();
    };
  }, [render, width]);

  return <div ref={ref} className="w-full p-4 [&>svg]:block [&>svg]:overflow-visible [&>div>svg]:overflow-visible overflow-visible" />;
}

function useDownload(containerRef: React.RefObject<HTMLDivElement | null>, title: string) {
  const downloadSvg = useCallback(() => {
    const svg = containerRef.current?.querySelector('svg');
    if (!svg) return;
    const blob = new Blob([svg.outerHTML], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }, [containerRef, title]);

  const downloadPng = useCallback(() => {
    const svg = containerRef.current?.querySelector('svg');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const scale = 2;
    canvas.width = svg.clientWidth * scale;
    canvas.height = svg.clientHeight * scale;
    const ctx = canvas.getContext('2d')!;
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `${title}.png`;
      a.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  }, [containerRef, title]);

  return { downloadSvg, downloadPng };
}

// --- Plot modal ---

function PlotModal({
  plot,
  onClose,
}: {
  plot: PlotSlot;
  onClose: () => void;
}) {
  const plotContainerRef = useRef<HTMLDivElement>(null);
  const { downloadSvg, downloadPng } = useDownload(plotContainerRef, plot.title);
  const variants = plot.type === 'observable' ? plot.variants : undefined;
  const defaultIdx = plot.type === 'observable' ? (plot.defaultVariant ?? 0) : 0;
  const [activeVariant, setActiveVariant] = useState(defaultIdx);

  const activeRender = plot.type === 'observable'
    ? (variants && variants.length > 0 ? variants[activeVariant].render : plot.render)
    : undefined;

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
          <div className="flex items-center gap-2">
            {plot.type === 'observable' && (
              <div className="dropdown">
                <div tabIndex={0} role="button" className="cursor-pointer">
                  <Download size={16} />
                </div>
                <ul tabIndex={0} className="dropdown-content menu bg-base-100 rounded-box z-10 w-32 p-1 shadow-sm border border-base-300 right-0">
                  <li><button onClick={downloadSvg}>SVG</button></li>
                  <li><button onClick={downloadPng}>PNG</button></li>
                </ul>
              </div>
            )}
            {variants && variants.length > 1 && (
              <div className="flex items-center border border-base-300 rounded-md overflow-hidden">
                {variants.map((v, i) => (
                  <button
                    key={v.label}
                    onClick={() => setActiveVariant(i)}
                    className={`px-2 py-0.5 text-xs cursor-pointer transition-colors ${
                      activeVariant === i
                        ? 'bg-primary text-primary-content'
                        : 'text-base-content/50 hover:bg-base-200'
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            )}
            <button onClick={onClose} className="p-1 rounded hover:bg-base-200 transition-colors cursor-pointer">
              <X size={16} className="text-base-content/50" />
            </button>
          </div>
        </div>
        <div ref={plotContainerRef} className="p-4 overflow-visible">
          {plot.type === 'observable' ? (
            <PlotFull render={activeRender!} />
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
            <div className="p-4 flex items-center justify-center aspect-square overflow-hidden">
              {plot.type === 'observable' ? (
                <PlotThumbnail renderThumbnail={plot.renderThumbnail} />
              ) : (
                <img src={plot.thumbnail} alt={plot.title} className="w-full h-auto object-contain px-4 py-1" />
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
