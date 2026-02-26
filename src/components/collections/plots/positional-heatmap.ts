import * as Plot from '@observablehq/plot';
import type { PlotSlot } from '../../../lib/plot-specs';
import type { PositionalBin } from '../../../lib/multi-file-analysis';
import { chrBinCounts } from '../../../lib/multi-file-analysis';
import { REGION_DIST_BINS } from '../../../lib/bed-analysis';

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

type AggCell = { chr: string; bin: number; fileCount: number; totalCount: number; meanCount: number };
type BinStats = { chr: string; bin: number; mean: number; q25: number; q75: number };

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = q * (sorted.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

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

  // Aggregate across files: for each chr×bin, collect per-file counts
  const keyMap = new Map<string, { fileCount: number; totalCount: number; counts: number[] }>();
  for (const b of bins) {
    const key = `${b.chr}\0${b.bin}`;
    const entry = keyMap.get(key);
    if (entry) {
      if (b.count > 0) entry.fileCount++;
      entry.totalCount += b.count;
      entry.counts.push(b.count);
    } else {
      keyMap.set(key, { fileCount: b.count > 0 ? 1 : 0, totalCount: b.count, counts: [b.count] });
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
      const total = entry?.totalCount ?? 0;
      data.push({ chr, bin, fileCount: entry?.fileCount ?? 0, totalCount: total, meanCount: total / nFiles });
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

  // Build per-bin stats for the mean variant
  const statsData: BinStats[] = [];
  // Edge-padded version for area/line marks so step curve reaches plot edges
  const statsDataPadded: BinStats[] = [];
  for (const chr of chrOrder) {
    const chrMax = maxBinsPerChr?.[chr] ?? globalMaxBin;
    const chrStats: BinStats[] = [];
    for (let bin = 0; bin < chrMax; bin++) {
      const key = `${chr}\0${bin}`;
      const entry = keyMap.get(key);
      // Pad with zeros for files that had no regions in this bin
      const counts = entry ? [...entry.counts] : [];
      while (counts.length < nFiles) counts.push(0);
      counts.sort((a, b) => a - b);
      const mean = counts.reduce((s, v) => s + v, 0) / nFiles;
      chrStats.push({ chr, bin, mean, q25: quantile(counts, 0.25), q75: quantile(counts, 0.75) });
    }
    statsData.push(...chrStats);
    // Add boundary points so step curve extends to bar edges
    if (chrStats.length > 0) {
      const first = chrStats[0];
      const last = chrStats[chrStats.length - 1];
      statsDataPadded.push({ ...first, bin: first.bin - 0.5 });
      statsDataPadded.push(...chrStats);
      statsDataPadded.push({ ...last, bin: last.bin + 0.5 });
    }
  }

  function renderMean(width: number): Element {
    const height = chrOrder.length * 25 + 40;
    const ml = estimateMargin(chrOrder);
    return Plot.plot({
      width,
      height,
      marginLeft: ml,
      marginTop: 10,
      marginBottom: 30,
      x: {
        domain: [0, globalMaxBin],
        label: 'Genomic position',
        labelAnchor: 'center',
        labelArrow: 'none',
        ticks: [0, globalMaxBin],
        tickFormat: (d) => (d === 0 ? 'start' : 'end'),
      },
      y: { axis: null },
      fy: { domain: chrOrder, label: 'Chromosome', padding: 0 },
      color: {
        domain: ['Mean', 'IQR (25th–75th)'],
        range: ['teal', 'orange'],
        legend: true,
      },
      marks: [
        // Mean bars
        Plot.rect(statsData, {
          x1: (d: BinStats) => d.bin - 0.5,
          x2: (d: BinStats) => d.bin + 0.5,
          y1: 0,
          y2: 'mean',
          fy: 'chr',
          fill: () => 'Mean',
          insetLeft: 0.15,
          insetRight: 0.15,
        }),
        // IQR shaded area (25th–75th percentile)
        Plot.areaY(statsDataPadded, {
          x: 'bin',
          y1: 'q25',
          y2: 'q75',
          fy: 'chr',
          fill: 'orange',
          fillOpacity: 0.25,
          curve: 'step',
        }),
        // IQR lines (25th–75th percentile)
        Plot.line(statsDataPadded, {
          x: 'bin',
          y: 'q75',
          fy: 'chr',
          stroke: () => 'IQR (25th–75th)',
          strokeWidth: 0.75,
          strokeOpacity: 0.5,
          curve: 'step',
        }),
        Plot.line(statsDataPadded, {
          x: 'bin',
          y: 'q25',
          fy: 'chr',
          stroke: () => 'IQR (25th–75th)',
          strokeWidth: 0.75,
          strokeOpacity: 0.5,
          curve: 'step',
        }),
        // Tooltip
        Plot.tip(statsData, Plot.pointer({
          x: 'bin',
          y: 'mean',
          fy: 'chr',
          channels: {
            'Q75': (d: BinStats) => d.q75.toFixed(1),
            'Mean regions': (d: BinStats) => d.mean.toFixed(1),
            'Q25': (d: BinStats) => d.q25.toFixed(1),
          },
          format: { x: false, y: false, fy: false },
        })),
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
          insetLeft: 0.15,
          insetRight: 0.15,
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
    description: `Genome-wide view showing where regions concentrate across chromosomes. A universal bin width is set so the longest chromosome spans ${REGION_DIST_BINS} bins; shorter chromosomes get proportionally fewer bins, preserving their relative extent. Each region is counted once in the bin containing its midpoint. "Total regions" shows a heatmap summing counts from all files per bin. "Mean per file" shows histogram bars of the mean count with a shaded 25th–75th percentile ribbon.`,
    type: 'observable',
    renderThumbnail,
    render: renderTotal,
    variants: [
      { label: 'Total regions', render: renderTotal },
      { label: 'Average density', render: renderMean },
    ],
  };
}
