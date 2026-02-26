import * as Plot from '@observablehq/plot';
import type { PlotSlot } from '../../../lib/plot-specs';
import type { TssHistPoint } from '../../../lib/multi-file-analysis';

const RANGE = 100_000;

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = q * (sorted.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

function tssTickFormat(d: number): string {
  if (d === 0) return 'TSS';
  const kb = d / 1000;
  return `${kb > 0 ? '+' : ''}${kb}kb`;
}

type BinStats = {
  binMid: number;
  mean: number;
  q25: number;
  q75: number;
};

export function consensusTssSlot(
  tssHist: TssHistPoint[],
  fileNames: string[],
): PlotSlot | null {
  if (tssHist.length === 0 || fileNames.length < 2) return null;

  const nFiles = fileNames.length;

  // Group by bin, collect per-file freq values
  const byBin = new Map<number, number[]>();
  for (const d of tssHist) {
    const arr = byBin.get(d.binMid);
    if (arr) arr.push(d.freq);
    else byBin.set(d.binMid, [d.freq]);
  }

  // Compute stats per bin, padding missing files with 0
  const bins = [...byBin.keys()].sort((a, b) => a - b);
  const stats: BinStats[] = [];
  for (const binMid of bins) {
    const vals = byBin.get(binMid)!;
    while (vals.length < nFiles) vals.push(0);
    vals.sort((a, b) => a - b);
    stats.push({
      binMid,
      mean: vals.reduce((s, v) => s + v, 0) / nFiles,
      q25: quantile(vals, 0.25),
      q75: quantile(vals, 0.75),
    });
  }

  if (stats.length === 0) return null;

  // Convert freq to percentage for display
  const pctStats = stats.map((s) => ({
    binMid: s.binMid,
    mean: s.mean * 100,
    q25: s.q25 * 100,
    q75: s.q75 * 100,
  }));

  function renderThumbnail(width: number, height: number): Element {
    return Plot.plot({
      width,
      height,
      style: { fontSize: '8px' },
      x: { domain: [-RANGE, RANGE], label: null, tickSize: 0 },
      y: { label: null, tickSize: 0 },
      marks: [
        Plot.areaY(pctStats, { x: 'binMid', y1: 'q25', y2: 'q75', fill: 'orange', fillOpacity: 0.3 }),
        Plot.lineY(pctStats, { x: 'binMid', y: 'mean', stroke: 'teal', strokeWidth: 1.5 }),
        Plot.ruleX([0], { stroke: '#F1C40F', strokeWidth: 1.5, strokeDasharray: '3 3' }),
      ],
    });
  }

  function render(width: number): Element {
    return Plot.plot({
      width,
      height: 300,
      marginLeft: 60,
      marginBottom: 40,
      x: {
        domain: [-RANGE, RANGE],
        label: 'Distance to TSS',
        labelArrow: 'none',
        tickFormat: tssTickFormat,
      },
      y: { label: 'Frequency (%)', labelArrow: 'none', grid: true },
      color: {
        domain: ['Mean', 'IQR (25th\u201375th)'],
        range: ['teal', 'orange'],
        legend: true,
      },
      marks: [
        // IQR shaded area
        Plot.areaY(pctStats, {
          x: 'binMid',
          y1: 'q25',
          y2: 'q75',
          fill: 'orange',
          fillOpacity: 0.25,
        }),
        // IQR boundary lines
        Plot.lineY(pctStats, {
          x: 'binMid',
          y: 'q75',
          stroke: () => 'IQR (25th\u201375th)',
          strokeWidth: 0.75,
          strokeOpacity: 0.5,
        }),
        Plot.lineY(pctStats, {
          x: 'binMid',
          y: 'q25',
          stroke: () => 'IQR (25th\u201375th)',
          strokeWidth: 0.75,
          strokeOpacity: 0.5,
        }),
        // Mean line
        Plot.lineY(pctStats, {
          x: 'binMid',
          y: 'mean',
          stroke: () => 'Mean',
          strokeWidth: 2,
        }),
        // TSS marker
        Plot.ruleX([0], { stroke: '#F1C40F', strokeWidth: 2, strokeDasharray: '4 4' }),
        Plot.text([0], {
          x: (d: number) => d,
          text: () => 'TSS',
          frameAnchor: 'top',
          dy: 12,
          dx: 4,
          textAnchor: 'start',
          fill: '#F1C40F',
          fontWeight: 'bold',
        }),
        // Tooltip
        Plot.tip(pctStats, Plot.pointerX({
          x: 'binMid',
          y: 'mean',
          channels: {
            'Q75': (d: typeof pctStats[0]) => `${d.q75.toFixed(2)}%`,
            'Mean': (d: typeof pctStats[0]) => `${d.mean.toFixed(2)}%`,
            'Q25': (d: typeof pctStats[0]) => `${d.q25.toFixed(2)}%`,
          },
          format: { x: true, y: false },
        })),
        Plot.ruleY([0]),
      ],
    });
  }

  return {
    id: 'tssDistance',
    title: 'TSS distance',
    description:
      'Average distance from regions to the nearest transcription start site (TSS) across all compared files. The teal line shows the mean frequency per distance bin; the orange band shows the 25th\u201375th percentile range across files. A sharp peak at TSS indicates promoter-proximal regions. A narrow IQR band means files agree on the TSS proximity profile; a wide band suggests variability across files.',
    type: 'observable',
    renderThumbnail,
    render,
  };
}
