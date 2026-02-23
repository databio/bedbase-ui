import * as Plot from '@observablehq/plot';
import type { PlotSlot } from '../../../lib/plot-specs';
import type { ConsensusRegion } from '../../../lib/multi-file-analysis';

const STANDARD_CHR_ORDER = [
  'chr1', 'chr2', 'chr3', 'chr4', 'chr5', 'chr6', 'chr7', 'chr8', 'chr9', 'chr10',
  'chr11', 'chr12', 'chr13', 'chr14', 'chr15', 'chr16', 'chr17', 'chr18', 'chr19',
  'chr20', 'chr21', 'chr22', 'chrX', 'chrY', 'chrM',
];

function sortChromosomes(chrs: string[]): string[] {
  const standardSet = new Set(STANDARD_CHR_ORDER);
  const known = chrs
    .filter((c) => standardSet.has(c))
    .sort((a, b) => STANDARD_CHR_ORDER.indexOf(a) - STANDARD_CHR_ORDER.indexOf(b));
  const unknown = chrs
    .filter((c) => !standardSet.has(c))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  return [...known, ...unknown];
}

type ChrSupportDatum = {
  chr: string;
  support: string;
  count: number;
};

export function consensusByChrSlot(
  consensus: ConsensusRegion[],
  nFiles: number,
): PlotSlot | null {
  if (consensus.length === 0) return null;

  // Group by chr x support level
  const grouped = new Map<string, Map<number, number>>();
  for (const r of consensus) {
    if (!grouped.has(r.chr)) grouped.set(r.chr, new Map());
    const chrMap = grouped.get(r.chr)!;
    chrMap.set(r.count, (chrMap.get(r.count) ?? 0) + 1);
  }

  const chrOrder = sortChromosomes([...grouped.keys()]);
  const supportLabels = Array.from({ length: nFiles }, (_, i) => `${i + 1}/${nFiles}`);

  const data: ChrSupportDatum[] = [];
  for (const chr of chrOrder) {
    const chrMap = grouped.get(chr)!;
    for (let s = 1; s <= nFiles; s++) {
      const count = chrMap.get(s) ?? 0;
      if (count > 0) {
        data.push({ chr, support: `${s}/${nFiles}`, count });
      }
    }
  }

  function renderThumbnail(width: number, height: number): Element {
    return Plot.plot({
      width,
      height,
      marginLeft: 0,
      marginBottom: 0,
      x: { domain: chrOrder, axis: null },
      y: { axis: null },
      color: { domain: supportLabels, scheme: 'blues' },
      marks: [
        Plot.barY(data, Plot.stackY({ x: 'chr', y: 'count', fill: 'support', order: 'support' })),
      ],
    });
  }

  function render(width: number): Element {
    return Plot.plot({
      width,
      height: 350,
      marginLeft: 60,
      marginBottom: 80,
      x: { domain: chrOrder, label: null, tickRotate: -45 },
      y: { label: 'Consensus regions', grid: true },
      color: {
        domain: supportLabels,
        scheme: 'blues',
        legend: true,
        label: 'Found in N files',
      },
      marks: [
        Plot.barY(data, Plot.stackY({
          x: 'chr',
          y: 'count',
          fill: 'support',
          order: 'support',
          tip: true,
        })),
        Plot.ruleY([0]),
      ],
    });
  }

  return {
    id: 'consensusByChr',
    title: 'Consensus by chromosome',
    type: 'observable',
    renderThumbnail,
    render,
  };
}
