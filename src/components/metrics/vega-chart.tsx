import { useEffect, useRef, useState } from 'react';
import embed from 'vega-embed';

export function VegaChart({ spec }: { spec: Record<string, unknown> }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setWidth(entry.contentRect.width - 16);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || width <= 0) return;

    const sized = { ...spec, width, autosize: { type: 'fit', contains: 'padding' } };

    embed(el, sized as Parameters<typeof embed>[1], {
      actions: false,
      renderer: 'svg',
    }).catch((err) => console.error('Vega chart error:', err));

    return () => {
      el.innerHTML = '';
    };
  }, [spec, width]);

  return <div ref={containerRef} className="w-full min-h-[200px]" />;
}
