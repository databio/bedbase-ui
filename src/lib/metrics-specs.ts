import * as Plot from '@observablehq/plot';
import type { components } from '../bedbase-types';

type BinValues = components['schemas']['BinValues'];

type PlotSpec = {
  thumbnail: (width: number, height: number) => Element;
  full: (width: number) => Element;
  variants?: { label: string; render: (width: number) => Element }[];
  defaultVariant?: number;
};

function barWaffleVariants(
  entries: { key: string; value: number }[],
  roundedTotal: number,
  unit: number,
) {
  const maxLabel = Math.max(...entries.map((e) => e.key.length));
  return [
    {
      label: 'Bar',
      render: (width: number) =>
        Plot.plot({
          width,
          marginLeft: Math.min(maxLabel * 7 + 16, width * 0.3),
          x: { label: 'Count', labelArrow: 'none' },
          y: { label: null },
          marks: [
            Plot.barX(entries, { x: 'value', y: 'key', sort: { y: '-x' }, fill: 'teal', rx2: 2 }),
            Plot.ruleX([0]),
          ],
        }),
    },
    {
      label: 'Waffle',
      render: (width: number) =>
        Plot.plot({
          width,
          margin: 0,
          color: { legend: true },
          x: { label: null, axis: null, domain: [0, roundedTotal] },
          y: { axis: null },
          marks: [
            Plot.waffleX(entries, Plot.stackX({ x: 'value', fill: 'key', order: 'value', reverse: true, unit, round: true })),
          ],
        }),
    },
  ];
}

export function barSpec(data: Record<string, number>): PlotSpec {
  const entries = Object.entries(data)
    .sort((a, b) => b[1] - a[1])
    .map(([key, value]) => ({ key, value }));
  const maxLabel = Math.max(...entries.map((e) => e.key.length));
  const total = entries.reduce((s, e) => s + e.value, 0);
  const unit = Math.max(1, Math.ceil(total / 1000));
  const roundedTotal = entries.reduce((s, e) => s + Math.ceil(e.value / unit) * unit, 0);

  return {
    thumbnail: (width, height) =>
      Plot.plot({
        width,
        height,
        marginLeft: Math.min(maxLabel * 4.5 + 8, width * 0.4),
        marginTop: 0,
        marginBottom: 0,
        style: { fontSize: '7px' },
        x: { axis: null },
        y: { label: null, tickSize: 0 },
        marks: [
          Plot.barX(entries, { x: 'value', y: 'key', sort: { y: '-x' }, fill: 'teal', rx2: 2 }),
        ],
      }),
    full: (width) =>
      Plot.plot({
        width,
        marginLeft: Math.min(maxLabel * 7 + 16, width * 0.3),
        x: { label: 'Count', labelArrow: 'none' },
        y: { label: null },
        marks: [
          Plot.barX(entries, { x: 'value', y: 'key', sort: { y: '-x' }, fill: 'teal', rx2: 2 }),
          Plot.ruleX([0]),
        ],
      }),
    variants: barWaffleVariants(entries, roundedTotal, unit),
  };
}

export function waffleSpec(data: Record<string, number>): PlotSpec {
  const entries = Object.entries(data)
    .sort((a, b) => b[1] - a[1])
    .map(([key, value]) => ({ key, value }));
  const total = entries.reduce((s, e) => s + e.value, 0);
  const unit = Math.max(1, Math.ceil(total / 1000));
  const roundedTotal = entries.reduce((s, e) => s + Math.ceil(e.value / unit) * unit, 0);

  return {
    thumbnail: (width, height) => {
      const svg = Plot.plot({
        width,
        height,
        margin: 0,
        color: { legend: false },
        x: { label: null, axis: null, domain: [0, roundedTotal] },
        y: { axis: null },
        marks: [
          Plot.waffleX(entries, Plot.stackX({ x: 'value', fill: 'key', order: 'value', reverse: true, unit, round: true })),
        ],
      });
      // Observable Plot's waffle mark overflows its SVG bounds by a few pixels
      // due to gap/rounding in the cell grid layout. Work around this by measuring
      // the actual rendered bounding box and setting viewBox to match, so the
      // browser scales the content to fit rather than clipping.
      document.body.appendChild(svg);
      const bbox = svg.getBBox();
      document.body.removeChild(svg);
      if (bbox.width > 0 && bbox.height > 0) {
        svg.setAttribute('viewBox', `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`);
      }
      return svg;
    },
    full: (width) =>
      Plot.plot({
        width,
        margin: 0,
        color: { legend: true },
        x: { label: null, axis: null, domain: [0, roundedTotal] },
        y: { axis: null },
        marks: [
          Plot.waffleX(entries, Plot.stackX({ x: 'value', fill: 'key', order: 'value', reverse: true, unit, round: true })),
        ],
      }),
    variants: barWaffleVariants(entries, roundedTotal, unit),
    defaultVariant: 1,
  };
}

export function histogramSpec(data: BinValues): PlotSpec {
  const numericBins = data.bins.map(Number);
  const allNumeric = numericBins.every((n) => !isNaN(n));

  if (allNumeric) {
    // bins may be edges (N+1 for N counts) or centers (N for N counts)
    const isEdges = numericBins.length === data.counts.length + 1;

    const rects = isEdges
      ? data.counts.map((count, i) => ({ x1: numericBins[i], x2: numericBins[i + 1], count }))
      : numericBins.map((bin, i) => {
          const values = numericBins;
          const prev = i > 0 ? values[i - 1] : bin - (values[1] - values[0] || 1);
          const next = i < values.length - 1 ? values[i + 1] : bin + (bin - (values[i - 1] ?? bin) || 1);
          return { x1: (prev + bin) / 2, x2: (bin + next) / 2, count: data.counts[i] ?? 0 };
        });

    const maxCount = Math.max(...rects.map((r) => r.count));
    const maxCountLen = maxCount.toLocaleString().length;

    const meanRule = data.mean != null
      ? [Plot.ruleX([data.mean], { stroke: 'red', strokeWidth: 2, strokeDasharray: '4 4' })]
      : [];

    return {
      thumbnail: (width, height) =>
        Plot.plot({
          width,
          height,
          style: { fontSize: '8px' },
          x: { label: null, tickSize: 0 },
          y: { label: null, tickSize: 0 },
          marks: [
            Plot.rectY(rects, { x1: 'x1', x2: 'x2', y: 'count', fill: 'teal', ry1: 2 }),
            ...meanRule,
            Plot.ruleY([0]),
          ],
        }),
      full: (width) =>
        Plot.plot({
          width,
          marginLeft: Math.min(maxCountLen * 7 + 16, width * 0.15),
          x: { label: 'Value', labelArrow: 'none' },
          y: { label: 'Count' },
          marks: [
            Plot.rectY(rects, { x1: 'x1', x2: 'x2', y: 'count', fill: 'teal', ry1: 2 }),
            ...meanRule,
            Plot.ruleY([0]),
          ],
        }),
    };
  }

  const values = data.bins.map((bin, i) => ({
    bin: String(bin),
    count: data.counts[i] ?? 0,
  }));

  return {
    thumbnail: (width, height) =>
      Plot.plot({
        width,
        height,
        style: { fontSize: '8px' },
        x: { label: null, tickSize: 0, tickRotate: -45 },
        y: { axis: null },
        marks: [
          Plot.barY(values, { x: 'bin', y: 'count', fill: 'teal', ry1: 2 }),
        ],
      }),
    full: (width) =>
      Plot.plot({
        width,
        x: { label: 'Bin', labelArrow: 'none', tickRotate: -45 },
        y: { label: 'Count', labelArrow: 'none' },
        marks: [
          Plot.barY(values, { x: 'bin', y: 'count', fill: 'teal', ry1: 2 }),
          Plot.ruleY([0]),
        ],
      }),
  };
}

export function timeBarSpec(data: Record<string, number>): PlotSpec {
  const entries = Object.entries(data)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, value]) => ({ key: Number(key), value }));
  const maxCount = Math.max(...entries.map((e) => e.value));
  const maxCountLen = maxCount.toLocaleString().length;

  return {
    thumbnail: (width, height) =>
      Plot.plot({
        width,
        height,
        style: { fontSize: '8px' },
        x: { label: null, tickSize: 0, interval: 1 },
        y: { axis: null },
        marks: [
          Plot.barY(entries, { x: 'key', y: 'value', fill: 'teal', ry1: 2 }),
        ],
      }),
    full: (width) =>
      Plot.plot({
        width,
        marginLeft: Math.min(maxCountLen * 7 + 16, width * 0.15),
        x: { label: 'Year', labelArrow: 'none', interval: 1 },
        y: { label: 'Count' },
        marks: [
          Plot.barY(entries, { x: 'key', y: 'value', fill: 'teal', ry1: 2 }),
          Plot.ruleY([0]),
        ],
      }),
  };
}
