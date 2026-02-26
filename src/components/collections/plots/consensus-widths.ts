import * as Plot from '@observablehq/plot';
import type { PlotSlot } from '../../../lib/plot-specs';
import type { ConsensusRegion } from '../../../lib/multi-file-analysis';

function formatBp(bp: number): string {
  if (bp >= 1e6) return `${(bp / 1e6).toFixed(1)}M`;
  if (bp >= 1e3) return `${(bp / 1e3).toFixed(1)}K`;
  return `${Math.round(bp)}`;
}

const LOG_MIN = 0;  // log10(1bp)
const LOG_MAX = 7;  // log10(10Mbp)
const N_BINS = 28;
const BIN_W = (LOG_MAX - LOG_MIN) / N_BINS;

type WidthBin = {
  binCenter: number;
  count: number;
  fraction: number;
};

type SupportWidthBin = WidthBin & { support: string };

/** Bin widths on log10 scale, dropping empty bins. */
function binWidths(widths: number[]): WidthBin[] {
  return binWidthsFull(widths).filter((d) => d.count > 0);
}

/** Bin widths on log10 scale, keeping all bins (zeros included). */
function binWidthsFull(widths: number[]): WidthBin[] {
  if (widths.length === 0) return [];
  const counts = new Array<number>(N_BINS).fill(0);
  for (const w of widths) {
    if (w <= 0) continue;
    const idx = Math.min(Math.max(Math.floor((Math.log10(w) - LOG_MIN) / BIN_W), 0), N_BINS - 1);
    counts[idx]++;
  }
  const total = widths.length;
  return counts.map((c, i) => ({
    binCenter: Math.pow(10, LOG_MIN + (i + 0.5) * BIN_W),
    count: c,
    fraction: c / total,
  }));
}

export function consensusWidthsSlot(
  consensus: ConsensusRegion[],
  nFiles: number,
): PlotSlot | null {
  if (consensus.length < 10) return null;

  const widths = consensus.map((r) => r.end - r.start).filter((w) => w > 0);
  if (widths.length < 10) return null;

  const allBins = binWidths(widths);

  // One group per support level: 1/N, 2/N, ..., N/N
  const supportOrder: string[] = [];
  const widthsBySupport = new Map<string, number[]>();
  for (let s = 1; s <= nFiles; s++) {
    const label = `${s}/${nFiles}`;
    supportOrder.push(label);
    widthsBySupport.set(label, []);
  }
  for (const r of consensus) {
    const w = r.end - r.start;
    if (w <= 0) continue;
    const label = `${r.count}/${nFiles}`;
    widthsBySupport.get(label)?.push(w);
  }

  const supportBins: SupportWidthBin[] = [];
  for (const label of supportOrder) {
    const ws = widthsBySupport.get(label)!;
    if (ws.length === 0) continue;
    for (const bin of binWidthsFull(ws)) {
      supportBins.push({ ...bin, support: label });
    }
  }

  function renderThumbnail(width: number, height: number): Element {
    return Plot.plot({
      width,
      height,
      marginLeft: 0,
      marginBottom: 0,
      x: { type: 'log', axis: null },
      y: { axis: null },
      marks: [
        Plot.areaY(allBins, { x: 'binCenter', y: 'fraction', fill: 'teal', fillOpacity: 0.3, curve: 'basis' }),
        Plot.lineY(allBins, { x: 'binCenter', y: 'fraction', stroke: 'teal', strokeWidth: 1.5, curve: 'basis' }),
      ],
    });
  }

  function renderAll(width: number): Element {
    return Plot.plot({
      width,
      height: 300,
      marginLeft: 60,
      marginBottom: 40,
      x: {
        type: 'log',
        label: 'Region width (bp)',
        labelArrow: 'none',
        tickFormat: (d: number) => formatBp(d),
      },
      y: { label: 'Fraction of consensus regions', labelArrow: 'none', grid: true },
      marks: [
        Plot.areaY(allBins, { x: 'binCenter', y: 'fraction', fill: 'teal', fillOpacity: 0.15, curve: 'basis' }),
        Plot.lineY(allBins, {
          x: 'binCenter',
          y: 'fraction',
          stroke: 'teal',
          strokeWidth: 2,
          curve: 'basis',
          tip: true,
          channels: {
            'Width': (d: WidthBin) => `~${formatBp(d.binCenter)}`,
            'Regions': 'count',
          },
        }),
        Plot.ruleY([0]),
      ],
    });
  }

  function renderBySupport(width: number): Element {
    return Plot.plot({
      width,
      height: 300,
      marginLeft: 60,
      marginBottom: 40,
      x: {
        type: 'log',
        label: 'Region width (bp)',
        labelArrow: 'none',
        tickFormat: (d: number) => formatBp(d),
      },
      y: { label: 'Fraction of group', labelArrow: 'none', grid: true },
      color: { domain: supportOrder, legend: true },
      marks: [
        Plot.lineY(supportBins, {
          x: 'binCenter',
          y: 'fraction',
          stroke: 'support',
          strokeWidth: 2,
          curve: 'basis',
          tip: true,
          channels: {
            'Width': (d: SupportWidthBin) => `~${formatBp(d.binCenter)}`,
            'Regions': 'count',
          },
        }),
        Plot.ruleY([0]),
      ],
    });
  }

  return {
    id: 'consensusWidths',
    title: 'Consensus region widths',
    description:
      'Distribution of consensus region widths on a log\u2081\u2080 scale. Narrow consensus regions (left) suggest sharply defined functional elements like transcription factor binding sites. Broad regions (right) suggest histone marks or structural domains. The "By support" variant breaks this down by how many files share each region \u2014 if high-support regions are consistently narrower, the shared signal is likely from well-defined functional elements.',
    type: 'observable',
    renderThumbnail,
    render: renderAll,
    variants: [
      { label: 'All widths', render: renderAll },
      { label: 'By support', render: renderBySupport },
    ],
  };
}
