import * as Plot from '@observablehq/plot';
import type { PlotSlot } from '../../../lib/plot-specs';
import type { ConsensusRegion } from '../../../lib/multi-file-analysis';

type SupportBin = { label: string; count: number; fraction: number };

function buildSupportBins(consensus: ConsensusRegion[], nFiles: number): SupportBin[] {
  const counts = new Map<number, number>();
  for (const r of consensus) {
    counts.set(r.count, (counts.get(r.count) ?? 0) + 1);
  }
  const total = consensus.length;
  const bins: SupportBin[] = [];
  for (let s = 1; s <= nFiles; s++) {
    const c = counts.get(s) ?? 0;
    bins.push({ label: `${s}/${nFiles}`, count: c, fraction: total > 0 ? c / total : 0 });
  }
  return bins;
}

export function consensusPlotSlot(
  consensus: ConsensusRegion[],
  nFiles: number,
): PlotSlot | null {
  if (consensus.length === 0) return null;
  const bins = buildSupportBins(consensus, nFiles);

  function renderThumbnail(width: number, height: number): Element {
    return Plot.plot({
      width,
      height,
      marginLeft: 0,
      marginBottom: 0,
      x: { domain: bins.map((b) => b.label), axis: null },
      y: { axis: null },
      marks: [
        Plot.barY(bins, { x: 'label', y: 'count', fill: 'teal' }),
      ],
    });
  }

  function render(width: number): Element {
    return Plot.plot({
      width,
      height: 300,
      marginLeft: 60,
      marginBottom: 40,
      x: { domain: bins.map((b) => b.label), label: 'Found in N files', padding: 0.2 },
      y: { label: 'Consensus regions', grid: true },
      marks: [
        Plot.barY(bins, {
          x: 'label',
          y: 'count',
          fill: 'teal',
          tip: true,
          channels: { Fraction: (d: SupportBin) => `${(d.fraction * 100).toFixed(1)}%` },
        }),
        Plot.ruleY([0]),
      ],
    });
  }

  return {
    id: 'consensusSupport',
    title: 'Consensus support distribution',
    description: 'Distribution of consensus regions by support level. Each consensus region is formed by merging overlapping intervals across files; its support count indicates how many files contribute. Higher support means more files agree on that genomic region.',
    type: 'observable',
    renderThumbnail,
    render,
  };
}

export { buildSupportBins, type SupportBin };
