/**
 * Plot specs for collection-level aggregated distributions (BedSetDistributions).
 *
 * These render mean ± SD across member BED files using Observable Plot.
 * The data shape differs from per-file CompressedDistributions — these are
 * aggregated statistics (histograms of scalar means, bin-wise mean±SD, etc.)
 * produced by bbconf's SQL aggregation.
 *
 * Forward-compatible: the bedhost endpoint may not exist yet. Components
 * should only call these builders when the data is present.
 */

import * as Plot from '@observablehq/plot';
import type { PlotSlot } from '../../../lib/plot-specs';

// ---------------------------------------------------------------------------
// Types matching bbconf BedSetDistributions model
// ---------------------------------------------------------------------------

export type ScalarSummary = {
  mean: number;
  sd: number;
  n: number;
  histogram: {
    counts: number[];
    edges: number[];
  };
};

export type BedSetDistributions = {
  n_files: number;
  composition?: Record<string, Record<string, number>> | null;
  scalar_summaries?: Record<string, ScalarSummary> | null;
  tss_histogram?: {
    mean: number[];
    sd: number[];
    n: number;
    x_min?: number;
    x_max?: number;
    bins?: number;
  } | null;
  region_distribution?: Record<
    string,
    { mean: number[]; sd: number[]; n: number }
  > | null;
  partitions?: Record<
    string,
    { mean_pct: number; sd_pct: number; n: number }
  > | null;
};

// ---------------------------------------------------------------------------
// Scalar histogram slots
// ---------------------------------------------------------------------------

const SCALAR_LABELS: Record<string, { title: string; unit: string; description: string }> = {
  number_of_regions: {
    title: 'Number of regions',
    unit: 'regions',
    description: 'Distribution of region counts across member BED files.',
  },
  mean_region_width: {
    title: 'Mean region width',
    unit: 'bp',
    description: 'Distribution of mean region widths (bp) across member BED files.',
  },
  median_tss_dist: {
    title: 'Median TSS distance',
    unit: 'bp',
    description: 'Distribution of median distances to the nearest transcription start site across member BED files.',
  },
  gc_content: {
    title: 'GC content',
    unit: '',
    description: 'Distribution of GC content fractions across member BED files.',
  },
  median_neighbor_distance: {
    title: 'Median neighbor distance',
    unit: 'bp',
    description: 'Distribution of median distances between adjacent regions across member BED files.',
  },
};

function scalarHistogramSlot(key: string, summary: ScalarSummary): PlotSlot | null {
  const { counts, edges } = summary.histogram;
  if (!counts || !edges || counts.length === 0) return null;

  const bins = counts.map((count, i) => ({
    x1: edges[i],
    x2: edges[i + 1],
    count,
  }));

  const meta = SCALAR_LABELS[key] ?? { title: key, unit: '', description: '' };
  const meanLine = summary.mean;

  return {
    id: `scalar-${key}`,
    title: meta.title,
    description: `${meta.description} Mean: ${summary.mean.toLocaleString(undefined, { maximumFractionDigits: 3 })} ± ${summary.sd.toLocaleString(undefined, { maximumFractionDigits: 3 })} (n=${summary.n}).`,
    type: 'observable',
    renderThumbnail: (width, height) =>
      Plot.plot({
        width,
        height,
        style: { fontSize: '8px' },
        x: { label: null, tickSize: 0 },
        y: { label: null, tickSize: 0 },
        marks: [
          Plot.rectY(bins, { x1: 'x1', x2: 'x2', y: 'count', fill: 'teal' }),
          Plot.ruleY([0]),
          Plot.ruleX([meanLine], { stroke: 'orange', strokeWidth: 1.5, strokeDasharray: '3,2' }),
        ],
      }),
    render: (width) =>
      Plot.plot({
        width,
        x: { label: meta.unit || meta.title, labelArrow: 'none' },
        y: { label: 'Files', labelArrow: 'none' },
        marks: [
          Plot.rectY(bins, { x1: 'x1', x2: 'x2', y: 'count', fill: 'teal', tip: true }),
          Plot.ruleY([0]),
          Plot.ruleX([meanLine], { stroke: 'orange', strokeWidth: 2, strokeDasharray: '4,3' }),
        ],
      }),
  };
}

// ---------------------------------------------------------------------------
// Partition mean ± SD bar chart
// ---------------------------------------------------------------------------

const PARTITION_DISPLAY: Record<string, string> = {
  exon: 'Exon',
  intron: 'Intron',
  intergenic: 'Intergenic',
  promoterprox: 'Promoter prox.',
  promotercore: 'Promoter core',
  fiveutr: "5' UTR",
  threeutr: "3' UTR",
};

function partitionsBarSlot(
  partitions: Record<string, { mean_pct: number; sd_pct: number; n: number }>,
): PlotSlot | null {
  const entries = Object.entries(partitions);
  if (entries.length === 0) return null;

  const data = entries.map(([key, val]) => ({
    partition: PARTITION_DISPLAY[key] ?? key,
    pct: +val.mean_pct.toFixed(2),
    lo: +Math.max(0, val.mean_pct - val.sd_pct).toFixed(2),
    hi: +(val.mean_pct + val.sd_pct).toFixed(2),
  }));

  const maxLabel = Math.max(...data.map((d) => d.partition.length));

  return {
    id: 'partitions',
    title: 'Genomic partitions (mean ± SD)',
    description: 'Mean percentage of regions falling into each genomic partition across member files, with ±1 SD error bars.',
    type: 'observable',
    renderThumbnail: (width, height) =>
      Plot.plot({
        width,
        height,
        marginTop: 8,
        marginRight: 8,
        marginLeft: 8,
        marginBottom: Math.min(maxLabel * 4 + 8, height * 0.5),
        style: { fontSize: '7px' },
        x: { label: null, tickSize: 0, tickRotate: -45 },
        y: { axis: null },
        marks: [
          Plot.barY(data, { x: 'partition', y: 'pct', fill: 'teal', ry1: 2 }),
        ],
      }),
    render: (width) =>
      Plot.plot({
        width,
        marginBottom: Math.min(maxLabel * 6 + 20, 80),
        x: { label: 'Genomic Partition', labelArrow: 'none', tickRotate: -33 },
        y: { label: 'Percentage', labelArrow: 'none' },
        marks: [
          Plot.barY(data, { x: 'partition', y: 'pct', fill: 'teal', ry1: 2, tip: true }),
          Plot.ruleX(data, { x: 'partition', y1: 'lo', y2: 'hi', stroke: '#333', strokeWidth: 1.5 }),
          Plot.tickY(data, { x: 'partition', y: 'lo', stroke: '#333', strokeWidth: 1.5 }),
          Plot.tickY(data, { x: 'partition', y: 'hi', stroke: '#333', strokeWidth: 1.5 }),
          Plot.ruleY([0]),
        ],
      }),
  };
}

// ---------------------------------------------------------------------------
// TSS histogram with mean ± SD band
// ---------------------------------------------------------------------------

function tssHistogramSlot(
  tss: NonNullable<BedSetDistributions['tss_histogram']>,
): PlotSlot | null {
  const { mean: means, sd: sds, x_min, x_max } = tss;
  if (!means || means.length === 0) return null;

  const nBins = means.length;
  const lo = x_min ?? -100000;
  const hi = x_max ?? 100000;
  const step = (hi - lo) / nBins;

  const data = means.map((m, i) => ({
    x: lo + (i + 0.5) * step,
    mean: m,
    lo: Math.max(0, m - (sds?.[i] ?? 0)),
    hi: m + (sds?.[i] ?? 0),
  }));

  return {
    id: 'tss-histogram',
    title: 'TSS distance (mean ± SD)',
    description: 'Mean histogram of distances to the nearest transcription start site across member files, with ±1 SD band. Dashed line marks TSS (0).',
    type: 'observable',
    renderThumbnail: (width, height) =>
      Plot.plot({
        width,
        height,
        style: { fontSize: '8px' },
        x: { label: null, tickSize: 0 },
        y: { label: null, tickSize: 0 },
        marks: [
          Plot.areaY(data, { x: 'x', y1: 'lo', y2: 'hi', fill: 'teal', fillOpacity: 0.2 }),
          Plot.lineY(data, { x: 'x', y: 'mean', stroke: 'teal', strokeWidth: 1.5 }),
          Plot.ruleX([0], { stroke: '#d4a017', strokeWidth: 1, strokeDasharray: '3,2' }),
          Plot.ruleY([0]),
        ],
      }),
    render: (width) =>
      Plot.plot({
        width,
        x: { label: 'Distance to TSS (bp)', labelArrow: 'none' },
        y: { label: 'Mean count', labelArrow: 'none' },
        marks: [
          Plot.areaY(data, { x: 'x', y1: 'lo', y2: 'hi', fill: 'teal', fillOpacity: 0.2 }),
          Plot.lineY(data, { x: 'x', y: 'mean', stroke: 'teal', strokeWidth: 2 }),
          Plot.ruleX([0], { stroke: '#d4a017', strokeWidth: 1.5, strokeDasharray: '4,3' }),
          Plot.ruleY([0]),
        ],
      }),
  };
}

// ---------------------------------------------------------------------------
// Region distribution (per-chrom mean ± SD across files)
// Matches the visual pattern of positional-heatmap.ts (file comparison)
// ---------------------------------------------------------------------------

const STANDARD_CHR_ORDER = [
  'chr1', 'chr2', 'chr3', 'chr4', 'chr5', 'chr6', 'chr7', 'chr8', 'chr9', 'chr10',
  'chr11', 'chr12', 'chr13', 'chr14', 'chr15', 'chr16', 'chr17', 'chr18', 'chr19',
  'chr20', 'chr21', 'chr22', 'chrX', 'chrY', 'chrM',
];

function toCanonical(c: string): string {
  const standardSet = new Set(STANDARD_CHR_ORDER);
  if (standardSet.has(c)) return c;
  const prefixed = 'chr' + c;
  return standardSet.has(prefixed) ? prefixed : c;
}

function sortChromosomes(chrs: string[]): string[] {
  const standardSet = new Set(STANDARD_CHR_ORDER);
  const known = chrs
    .filter((c) => standardSet.has(toCanonical(c)))
    .sort((a, b) => STANDARD_CHR_ORDER.indexOf(toCanonical(a)) - STANDARD_CHR_ORDER.indexOf(toCanonical(b)));
  const unknown = chrs
    .filter((c) => !standardSet.has(toCanonical(c)))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  return [...known, ...unknown];
}

function estimateMargin(labels: string[]): number {
  const longest = Math.max(...labels.map((l) => l.length));
  return Math.max(40, longest * 7 + 16);
}

type BinRow = { chr: string; bin: number; mean: number; lo: number; hi: number };

function regionDistributionMeanSdSlot(
  regionDist: Record<string, { mean: number[]; sd: number[]; n: number }>,
): PlotSlot | null {
  const chrOrder = sortChromosomes(Object.keys(regionDist));
  if (chrOrder.length === 0) return null;

  // Build data + edge-padded version for step-curve SD band
  const data: BinRow[] = [];
  const dataPadded: BinRow[] = [];
  let globalMaxBin = 0;

  for (const chr of chrOrder) {
    const { mean: means, sd: sds } = regionDist[chr];
    globalMaxBin = Math.max(globalMaxBin, means.length);
    const chrRows: BinRow[] = [];
    for (let i = 0; i < means.length; i++) {
      const row: BinRow = {
        chr,
        bin: i,
        mean: means[i],
        lo: Math.max(0, means[i] - (sds[i] ?? 0)),
        hi: means[i] + (sds[i] ?? 0),
      };
      chrRows.push(row);
      data.push(row);
    }
    if (chrRows.length > 0) {
      const first = chrRows[0];
      const last = chrRows[chrRows.length - 1];
      dataPadded.push({ ...first, bin: first.bin - 0.5 });
      dataPadded.push(...chrRows);
      dataPadded.push({ ...last, bin: last.bin + 0.5 });
    }
  }

  const marginLeft = estimateMargin(chrOrder);

  // Heatmap variant: total (sum of means) as color intensity
  function renderTotal(width: number): Element {
    const height = chrOrder.length * 22 + 80;
    const binSet = Array.from({ length: globalMaxBin }, (_, i) => i);
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
      color: { scheme: 'bupu' as Plot.ColorScheme, type: 'sqrt', label: 'Mean regions', legend: true },
      marks: [
        Plot.cell(data, {
          x: 'bin',
          y: 'chr',
          fill: 'mean',
          insetLeft: 0.15,
          insetRight: 0.15,
          tip: true,
          channels: { 'Mean regions': 'mean' },
        }),
      ],
    });
  }

  // Average density variant: mean bars + SD band (matches positional-heatmap "Average density")
  function renderMean(width: number): Element {
    const height = chrOrder.length * 25 + 40;
    return Plot.plot({
      width,
      height,
      marginLeft,
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
        domain: ['Mean', '± 1 SD'],
        range: ['teal', 'orange'],
        legend: true,
      },
      marks: [
        // Mean bars
        Plot.rect(data, {
          x1: (d: BinRow) => d.bin - 0.5,
          x2: (d: BinRow) => d.bin + 0.5,
          y1: 0,
          y2: 'mean',
          fy: 'chr',
          fill: () => 'Mean',
          insetLeft: 0.15,
          insetRight: 0.15,
        }),
        // SD shaded area
        Plot.areaY(dataPadded, {
          x: 'bin',
          y1: 'lo',
          y2: 'hi',
          fy: 'chr',
          fill: 'orange',
          fillOpacity: 0.25,
          curve: 'step',
        }),
        // SD boundary lines
        Plot.line(dataPadded, {
          x: 'bin',
          y: 'hi',
          fy: 'chr',
          stroke: () => '± 1 SD',
          strokeWidth: 0.75,
          strokeOpacity: 0.5,
          curve: 'step',
        }),
        Plot.line(dataPadded, {
          x: 'bin',
          y: 'lo',
          fy: 'chr',
          stroke: () => '± 1 SD',
          strokeWidth: 0.75,
          strokeOpacity: 0.5,
          curve: 'step',
        }),
        // Tooltip
        Plot.tip(data, Plot.pointer({
          x: 'bin',
          y: 'mean',
          fy: 'chr',
          channels: {
            '+ SD': (d: BinRow) => d.hi.toFixed(1),
            'Mean': (d: BinRow) => d.mean.toFixed(1),
            '- SD': (d: BinRow) => d.lo.toFixed(1),
          },
          format: { x: false, y: false, fy: false },
        })),
      ],
    });
  }

  function renderThumbnail(width: number, height: number): Element {
    const binSet = Array.from({ length: globalMaxBin }, (_, i) => i);
    return Plot.plot({
      width,
      height,
      margin: 8,
      x: { domain: binSet, axis: null },
      y: { domain: chrOrder, axis: null },
      color: { scheme: 'bupu' as Plot.ColorScheme, type: 'sqrt' },
      marks: [
        Plot.cell(data, { x: 'bin', y: 'chr', fill: 'mean', inset: 0 }),
      ],
    });
  }

  return {
    id: 'regionDistribution',
    title: 'Aggregated region density',
    description: 'Genome-wide view showing where regions concentrate across chromosomes, averaged across member files. "Mean regions" shows a heatmap of mean counts per bin. "Average density" shows histogram bars of the mean count with a shaded ±1 SD ribbon.',
    type: 'observable',
    renderThumbnail,
    render: renderTotal,
    variants: [
      { label: 'Mean regions', render: renderTotal },
      { label: 'Average density', render: renderMean },
    ],
  };
}

// ---------------------------------------------------------------------------
// Regions per chromosome (mean ± SD bar chart)
// Matches the visual pattern of chr-region-boxplot.ts (file comparison)
// ---------------------------------------------------------------------------

function regionsPerChromosomeSlot(
  regionDist: Record<string, { mean: number[]; sd: number[]; n: number }>,
): PlotSlot | null {
  const chrOrder = sortChromosomes(Object.keys(regionDist));
  if (chrOrder.length === 0) return null;

  // Sum bins per chromosome → mean total and SD total
  const data: { chr: string; mean: number; lo: number; hi: number }[] = [];
  for (const chr of chrOrder) {
    const { mean: means, sd: sds } = regionDist[chr];
    const totalMean = means.reduce((s, v) => s + v, 0);
    // Approximate SD of total: sqrt(sum of sd^2) (assumes independence across bins)
    const totalSd = Math.sqrt(sds.reduce((s, v) => s + v * v, 0));
    data.push({
      chr,
      mean: totalMean,
      lo: Math.max(0, totalMean - totalSd),
      hi: totalMean + totalSd,
    });
  }

  const marginLeft = estimateMargin(chrOrder);

  function renderThumbnail(width: number, height: number): Element {
    const barHeight = (height - 8) / chrOrder.length;
    const rx = barHeight > 6 ? 2 : barHeight > 3 ? 1 : 0;
    return Plot.plot({
      width,
      height,
      margin: 4,
      y: { domain: chrOrder, axis: null },
      x: { axis: null },
      marks: [
        Plot.barX(data, { y: 'chr', x: 'mean', fill: 'teal', rx2: rx, insetTop: 0.2, insetBottom: 0.2 }),
      ],
    });
  }

  function render(width: number): Element {
    const height = chrOrder.length * 18 + 60;
    return Plot.plot({
      width,
      height,
      marginLeft,
      marginBottom: 40,
      y: { domain: chrOrder, label: 'Chromosome', tickSize: 0 },
      x: { label: 'Mean regions', labelArrow: 'none', grid: true },
      marks: [
        Plot.barX(data, {
          y: 'chr',
          x: 'mean',
          fill: 'teal',
          fillOpacity: 0.7,
          rx2: 2,
          tip: true,
        }),
        // Error bars (± SD)
        Plot.ruleY(data, { y: 'chr', x1: 'lo', x2: 'hi', stroke: '#333', strokeWidth: 1.5 }),
        Plot.tickX(data, { y: 'chr', x: 'lo', stroke: '#333', strokeWidth: 1.5 }),
        Plot.tickX(data, { y: 'chr', x: 'hi', stroke: '#333', strokeWidth: 1.5 }),
        Plot.ruleX([0]),
      ],
    });
  }

  return {
    id: 'regionsPerChromosome',
    title: 'Regions per chromosome',
    description: 'Mean total region count per chromosome across member files, with ±1 SD error bars. Differences reflect both chromosome size and biological enrichment of the assay.',
    type: 'observable',
    renderThumbnail,
    render,
  };
}

// ---------------------------------------------------------------------------
// Top-level: build all available slots from a BedSetDistributions blob
// ---------------------------------------------------------------------------

export function collectionDistributionSlots(
  distributions: BedSetDistributions,
): PlotSlot[] {
  const slots: PlotSlot[] = [];

  // Scalar histograms
  if (distributions.scalar_summaries) {
    for (const [key, summary] of Object.entries(distributions.scalar_summaries)) {
      const s = scalarHistogramSlot(key, summary as ScalarSummary);
      if (s) slots.push(s);
    }
  }

  // Partition mean ± SD
  if (distributions.partitions) {
    const s = partitionsBarSlot(distributions.partitions);
    if (s) slots.push(s);
  }

  // TSS histogram with mean ± SD band
  if (distributions.tss_histogram) {
    const s = tssHistogramSlot(distributions.tss_histogram);
    if (s) slots.push(s);
  }

  // Region distribution (per-chrom mean ± SD heatmap + density)
  if (distributions.region_distribution) {
    const s = regionDistributionMeanSdSlot(distributions.region_distribution);
    if (s) slots.push(s);
  }

  // Regions per chromosome (mean ± SD bar chart)
  if (distributions.region_distribution) {
    const s = regionsPerChromosomeSlot(distributions.region_distribution);
    if (s) slots.push(s);
  }

  return slots;
}
