import * as Plot from '@observablehq/plot';
import type { ChromosomeRow } from '../../../lib/bed-analysis';
import type { PlotSlot } from '../../../lib/plot-specs';

const STANDARD_CHR_ORDER = [
  'chr1', 'chr2', 'chr3', 'chr4', 'chr5', 'chr6', 'chr7', 'chr8', 'chr9', 'chr10',
  'chr11', 'chr12', 'chr13', 'chr14', 'chr15', 'chr16', 'chr17', 'chr18', 'chr19',
  'chr20', 'chr21', 'chr22', 'chrX', 'chrY', 'chrM',
];

/** Resolve bare names ("1", "X") to canonical chr-prefixed form for sorting. */
function toCanonical(c: string, standardSet: Set<string>): string {
  if (standardSet.has(c)) return c;
  const prefixed = 'chr' + c;
  return standardSet.has(prefixed) ? prefixed : c;
}

function sortChromosomes(chrs: string[]): string[] {
  const standardSet = new Set(STANDARD_CHR_ORDER);
  const known = chrs
    .filter((c) => standardSet.has(toCanonical(c, standardSet)))
    .sort((a, b) => STANDARD_CHR_ORDER.indexOf(toCanonical(a, standardSet)) - STANDARD_CHR_ORDER.indexOf(toCanonical(b, standardSet)));
  const unknown = chrs
    .filter((c) => !standardSet.has(toCanonical(c, standardSet)))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  return [...known, ...unknown];
}

function estimateMargin(labels: string[]): number {
  const longest = Math.max(...labels.map((l) => l.length));
  return Math.max(40, longest * 7 + 16);
}

export function chromosomeBarSlot(rows: ChromosomeRow[]): PlotSlot | null {
  if (rows.length === 0) return null;

  const chrOrder = sortChromosomes(rows.map((r) => r.chromosome));
  const data = rows.map((r) => ({ chr: r.chromosome, count: r.count }));
  const marginLeft = estimateMargin(chrOrder);

  function renderThumbnail(width: number, height: number): Element {
    return Plot.plot({
      width,
      height,
      marginLeft: 0,
      marginBottom: 0,
      y: { domain: chrOrder, axis: null },
      x: { axis: null },
      marks: [
        Plot.barX(data, { y: 'chr', x: 'count', fill: 'teal', rx2: 2 }),
      ],
    });
  }

  function render(width: number): Element {
    const height = chrOrder.length * 22 + 80;
    return Plot.plot({
      width,
      height,
      marginLeft,
      marginBottom: 40,
      y: { domain: chrOrder, label: 'Chromosome' },
      x: { label: 'Regions', grid: true },
      marks: [
        Plot.barX(data, {
          y: 'chr',
          x: 'count',
          fill: 'teal',
          rx2: 2,
          tip: true,
        }),
        Plot.ruleX([0]),
      ],
    });
  }

  return {
    id: 'chromosomeBar',
    title: 'Regions per chromosome',
    description: 'Total number of regions on each chromosome. Differences in bar length reflect both chromosome size and biological enrichment of the assay across the genome.',
    type: 'observable',
    renderThumbnail,
    render,
  };
}
