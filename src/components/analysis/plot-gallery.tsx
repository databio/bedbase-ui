import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
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

/**
 * Find the main plot SVG inside a container. Observable Plot wraps plots with
 * legend: true in a <figure> that contains small legend-swatch SVGs before the
 * main plot SVG. We pick the largest SVG by area to avoid grabbing a swatch.
 */
function findPlotSvg(container: HTMLElement): SVGSVGElement | null {
  const svgs = container.querySelectorAll('svg');
  if (svgs.length === 0) return null;
  if (svgs.length === 1) return svgs[0];
  let best: SVGSVGElement = svgs[0];
  let bestArea = 0;
  for (const svg of svgs) {
    const area = svg.clientWidth * svg.clientHeight;
    if (area > bestArea) {
      bestArea = area;
      best = svg;
    }
  }
  return best;
}

/**
 * Extract categorical legend entries from an Observable Plot figure.
 * Observable Plot renders swatches in two layouts:
 * - Wrap mode: <div class="...-swatches-wrap"> > <span class="...-swatch"> > <svg fill="color"> + text node
 * - Columns mode: <div class="...-swatches-columns"> > <div class="...-swatch"> > <svg fill="color"> + <div class="...-swatch-label">
 */
function extractCategoricalLegend(figure: HTMLElement): { label: string; color: string }[] {
  const items: { label: string; color: string }[] = [];
  // Find swatch container by partial class match
  const swatchContainer = figure.querySelector('[class*="-swatches"]');
  if (!swatchContainer) return items;
  const swatches = swatchContainer.querySelectorAll('[class*="-swatch"]:not([class*="-swatches"])');
  for (const swatch of swatches) {
    const svg = swatch.querySelector('svg');
    if (!svg) continue;
    // Color is on the svg's fill attribute or on the rect inside
    const color = svg.getAttribute('fill') || svg.querySelector('rect')?.getAttribute('fill') || '';
    // Label: from the label div (columns) or text nodes (wrap)
    const labelDiv = swatch.querySelector('[class*="-swatch-label"]');
    let text = '';
    if (labelDiv) {
      text = labelDiv.textContent?.trim() || '';
    } else {
      for (const node of swatch.childNodes) {
        if (node.nodeType === Node.TEXT_NODE) text += node.textContent;
      }
      text = text.trim();
    }
    if (color && text) items.push({ label: text, color });
  }
  return items;
}

/**
 * Extract a continuous legend SVG (color ramp) from an Observable Plot figure.
 * Observable Plot renders continuous legends as an SVG with class "...-ramp"
 * containing a gradient image and tick labels.
 */
function extractContinuousLegendSvg(figure: HTMLElement): SVGSVGElement | null {
  // Ramp legends are direct-child SVGs of the figure with class containing "-ramp"
  const ramp = figure.querySelector(':scope > svg[class*="-ramp"]') as SVGSVGElement | null;
  if (ramp) return ramp;
  // Fallback: any direct-child SVG that's not the main plot (has image or gradient)
  const svgs = figure.querySelectorAll(':scope > svg');
  for (const svg of svgs) {
    if (svg.querySelector('image') || svg.querySelector('linearGradient')) {
      return svg as SVGSVGElement;
    }
  }
  return null;
}

/**
 * Build a self-contained SVG string for download that includes the legend.
 * Uses nested <svg> elements to compose legend + main plot without breaking
 * internal references (clip-paths, defs, etc.).
 */
function buildDownloadSvg(container: HTMLElement): { data: string; width: number; height: number } | null {
  const mainSvg = findPlotSvg(container);
  if (!mainSvg) return null;

  const serializer = new XMLSerializer();
  const mainWidth = mainSvg.clientWidth || parseFloat(mainSvg.getAttribute('width') || '600');
  const mainHeight = mainSvg.clientHeight || parseFloat(mainSvg.getAttribute('height') || '400');

  const figure = container.querySelector('figure') as HTMLElement | null;
  if (!figure) {
    return { data: serializer.serializeToString(mainSvg), width: mainWidth, height: mainHeight };
  }

  // Try continuous legend first, then categorical
  const continuousSvg = extractContinuousLegendSvg(figure);
  const categoricalItems = continuousSvg ? [] : extractCategoricalLegend(figure);

  if (!continuousSvg && categoricalItems.length === 0) {
    return { data: serializer.serializeToString(mainSvg), width: mainWidth, height: mainHeight };
  }

  const ns = 'http://www.w3.org/2000/svg';

  // Build legend SVG (centered horizontally)
  let legendSvgStr: string;
  let legendHeight: number;

  if (continuousSvg) {
    legendHeight = continuousSvg.clientHeight || parseFloat(continuousSvg.getAttribute('height') || '40');
    const legendWidth = continuousSvg.clientWidth || parseFloat(continuousSvg.getAttribute('width') || '240');
    const clone = continuousSvg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('x', String((mainWidth - legendWidth) / 2));
    clone.setAttribute('y', '0');
    legendSvgStr = serializer.serializeToString(clone);
  } else {
    legendHeight = 22;
    // Calculate total legend width first
    let totalLegendWidth = 0;
    for (const item of categoricalItems) {
      totalLegendWidth += 14 + item.label.length * 6.5 + 12;
    }
    totalLegendWidth -= 12; // no trailing gap
    const startX = (mainWidth - totalLegendWidth) / 2;

    const legendSvg = document.createElementNS(ns, 'svg');
    legendSvg.setAttribute('xmlns', ns);
    legendSvg.setAttribute('x', '0');
    legendSvg.setAttribute('y', '0');
    legendSvg.setAttribute('width', String(mainWidth));
    legendSvg.setAttribute('height', String(legendHeight));
    legendSvg.setAttribute('overflow', 'visible');

    let x = startX;
    for (const item of categoricalItems) {
      const rect = document.createElementNS(ns, 'rect');
      rect.setAttribute('x', String(x));
      rect.setAttribute('y', '5');
      rect.setAttribute('width', '10');
      rect.setAttribute('height', '10');
      rect.setAttribute('fill', item.color);
      rect.setAttribute('rx', '1');
      legendSvg.appendChild(rect);

      const text = document.createElementNS(ns, 'text');
      text.setAttribute('x', String(x + 14));
      text.setAttribute('y', '14');
      text.setAttribute('font-size', '10');
      text.setAttribute('font-family', 'system-ui, -apple-system, sans-serif');
      text.textContent = item.label;
      legendSvg.appendChild(text);

      x += 14 + item.label.length * 6.5 + 12;
    }
    legendSvgStr = serializer.serializeToString(legendSvg);
  }

  // Compose: nested SVGs preserve all internal defs/clip-paths
  const mainClone = mainSvg.cloneNode(true) as SVGSVGElement;
  mainClone.setAttribute('x', '0');
  mainClone.setAttribute('y', String(legendHeight));

  const totalHeight = legendHeight + mainHeight;
  const wrapper = [
    `<svg xmlns="${ns}" width="${mainWidth}" height="${totalHeight}">`,
    legendSvgStr,
    serializer.serializeToString(mainClone),
    `</svg>`,
  ].join('\n');

  return { data: wrapper, width: mainWidth, height: totalHeight };
}

function useDownload(containerRef: React.RefObject<HTMLDivElement | null>, title: string) {
  const downloadSvg = useCallback(() => {
    if (!containerRef.current) return;
    const result = buildDownloadSvg(containerRef.current);
    if (!result) return;
    const blob = new Blob([result.data], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }, [containerRef, title]);

  const downloadPng = useCallback(() => {
    if (!containerRef.current) return;
    const result = buildDownloadSvg(containerRef.current);
    if (!result) return;
    const canvas = document.createElement('canvas');
    const scale = 4;
    canvas.width = result.width * scale;
    canvas.height = result.height * scale;
    const ctx = canvas.getContext('2d')!;
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `${title}.png`;
      a.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(result.data)));
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
            {plot.type === 'observable' && (
              <div className="dropdown">
                <div tabIndex={0} role="button" className="p-1 rounded hover:bg-base-200 transition-colors cursor-pointer text-base-content/50 hover:text-base-content [&:focus]:text-base-content [&:focus]:bg-base-200">
                  <Download size={16} />
                </div>
                <ul tabIndex={0} className="dropdown-content menu bg-base-100 rounded-box z-10 w-32 p-1 shadow-sm border border-base-300 right-0">
                  <li><button onClick={downloadSvg}>SVG</button></li>
                  <li><button onClick={downloadPng}>PNG</button></li>
                </ul>
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
        {plot.description && (
          <div className="px-5 py-4 bg-base-200 border-t border-base-300">
            <h4 className="text-xs font-semibold text-base-content/40 uppercase tracking-wide mb-1">Method</h4>
            <p className="text-sm leading-snug text-base-content/60">{plot.description}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Gallery grid ---

const GRID_COLS: Record<number, string> = {
  3: 'grid-cols-2 @3xl:grid-cols-3',
  4: 'grid-cols-2 @3xl:grid-cols-4',
  5: 'grid-cols-2 @3xl:grid-cols-5',
};

export function PlotGallery({ plots, columns = 5 }: { plots: PlotSlot[]; columns?: number }) {
  const [expanded, setExpanded] = useState<PlotSlot | null>(null);

  if (plots.length === 0) return null;

  return (
    <>
      <div className={`grid ${GRID_COLS[columns] ?? GRID_COLS[5]} gap-2`}>
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

      {expanded && createPortal(
        <PlotModal plot={expanded} onClose={() => setExpanded(null)} />,
        document.body,
      )}
    </>
  );
}
