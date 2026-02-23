import * as Plot from '@observablehq/plot';
import type { PlotSlot } from '../../../lib/plot-specs';
import type { PositionalBin } from '../../../lib/multi-file-analysis';
import { chrBinCounts } from '../../../lib/multi-file-analysis';

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

type AggCell = { chr: string; bin: number; fileCount: number; totalCount: number };

function estimateMargin(labels: string[]): number {
  const longest = Math.max(...labels.map((l) => l.length));
  return Math.max(40, longest * 7 + 16);
}

/** Move the auto-generated color legend to the top-right of the figure. */

export function positionalHeatmapSlot(
  bins: PositionalBin[],
  fileNames: string[],
  chromSizes?: Record<string, number>,
): PlotSlot | null {
  if (bins.length === 0) return null;

  const nFiles = fileNames.length;
  const chrOrder = sortChromosomes([...new Set(bins.map((d) => d.chr))]);

  // Aggregate across files: for each chr×bin, count files with regions and total regions
  const keyMap = new Map<string, { fileCount: number; totalCount: number }>();
  for (const b of bins) {
    const key = `${b.chr}\0${b.bin}`;
    const entry = keyMap.get(key);
    if (entry) {
      if (b.count > 0) entry.fileCount++;
      entry.totalCount += b.count;
    } else {
      keyMap.set(key, { fileCount: b.count > 0 ? 1 : 0, totalCount: b.count });
    }
  }

  // Per-chromosome bin limits (shorter chrs get fewer bins)
  const maxBinsPerChr = chromSizes ? chrBinCounts(chromSizes) : null;
  const globalMaxBin = maxBinsPerChr
    ? Math.max(...chrOrder.map((c) => maxBinsPerChr[c] ?? 1))
    : Math.max(...bins.map((d) => d.bin)) + 1;

  // Build grid: each chr only gets cells up to its proportional extent
  const marginLeft = estimateMargin(chrOrder);
  const binSet = Array.from({ length: globalMaxBin }, (_, i) => i);
  const data: AggCell[] = [];
  for (const chr of chrOrder) {
    const chrMax = maxBinsPerChr?.[chr] ?? globalMaxBin;
    for (let bin = 0; bin < chrMax; bin++) {
      const key = `${chr}\0${bin}`;
      const entry = keyMap.get(key);
      data.push({ chr, bin, fileCount: entry?.fileCount ?? 0, totalCount: entry?.totalCount ?? 0 });
    }
  }

  function renderThumbnail(width: number, height: number): Element {
    return Plot.plot({
      width,
      height,
      margin: 4,
      x: { domain: binSet, axis: null },
      y: { domain: chrOrder, axis: null },
      color: { scheme: 'bupu' as Plot.ColorScheme, type: 'sqrt' },
      marks: [
        Plot.cell(data, { x: 'bin', y: 'chr', fill: 'totalCount', inset: 0 }),
      ],
    });
  }

  function renderSupport(width: number): Element {
    const height = chrOrder.length * 22 + 80;
    return Plot.plot({
      width,
      height,
      marginLeft,
      marginBottom: 40,
      x: {
        domain: binSet,
        label: 'Genomic position',
        labelAnchor: 'center',
        labelArrow: 'none',
        ticks: [binSet[0], binSet[binSet.length - 1]],
        tickFormat: (d) => (d === binSet[0] ? 'start' : 'end'),
      },
      y: { domain: chrOrder, label: 'Chromosome' },
      color: { domain: [0, nFiles], scheme: 'bupu' as Plot.ColorScheme, type: 'linear', label: `Files (of ${nFiles})`, legend: true },
      marks: [
        Plot.cell(data, {
          x: 'bin',
          y: 'chr',
          fill: 'fileCount',
          inset: 0,
          tip: true,
          channels: {
            'Files with regions': 'fileCount',
            'Total regions': 'totalCount',
          },
        }),
      ],
    });
  }

  function renderTotal(width: number): Element {
    const height = chrOrder.length * 22 + 80;
    return Plot.plot({
      width,
      height,
      marginLeft,
      marginBottom: 40,
      x: {
        domain: binSet,
        label: 'Genomic position',
        labelAnchor: 'center',
        labelArrow: 'none',
        ticks: [binSet[0], binSet[binSet.length - 1]],
        tickFormat: (d) => (d === binSet[0] ? 'start' : 'end'),
      },
      y: { domain: chrOrder, label: 'Chromosome' },
      color: { scheme: 'bupu' as Plot.ColorScheme, type: 'sqrt', label: 'Total regions', legend: true },
      marks: [
        Plot.cell(data, {
          x: 'bin',
          y: 'chr',
          fill: 'totalCount',
          inset: 0,
          tip: true,
          channels: {
            'Files with regions': 'fileCount',
            'Total regions': 'totalCount',
          },
        }),
      ],
    });
  }

  return {
    id: 'positionalHeatmap',
    title: 'Aggregated region density',
    description: 'Heatmap of region density across the genome using a universal bin width derived from the reference genome (hg38). Shorter chromosomes have proportionally fewer bins, preserving their relative extent. Each cell aggregates across selected files. "Total regions" shows absolute count; "File support" shows how many files contribute regions to each bin.',
    type: 'observable',
    renderThumbnail,
    render: renderTotal,
    variants: [
      { label: 'Total regions', render: renderTotal },
      { label: 'File support', render: renderSupport },
    ],
  };
}
