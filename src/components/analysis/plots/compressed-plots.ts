/**
 * Plot specs for the compressed distributions format produced by bedboss bedstat.
 *
 * These are a parallel set of slot builders — the existing specs in
 * genomicdist-plots.ts, region-distribution.ts, and chromosome-bar.ts are
 * untouched and continue to serve local WASM analysis with raw arrays.
 *
 * The compressed format ships pre-computed histograms, KDEs, and dense count
 * arrays so no client-side binning or density estimation is needed.
 */

import * as Plot from '@observablehq/plot';
import type { PlotSlot } from '../../../lib/plot-specs';
import { type DistributionPoint, type ChromosomeRow } from '../../../lib/bed-analysis';
import { regionDistributionSlot } from './region-distribution';
import { chromosomeBarSlot } from './chromosome-bar';
import { partitionsSlot, expectedPartitionsSlot } from './genomicdist-plots';

// ---------------------------------------------------------------------------
// Types for the compressed distributions blob
// ---------------------------------------------------------------------------

export type CompressedHistogram = {
  x_min: number;
  x_max: number;
  bins: number;
  counts: number[];
  total: number;
  overflow?: number;
};

export type CompressedKde = {
  x_min: number;
  x_max: number;
  n: number;
  densities: number[];
  mean?: number;
};

export type CompressedRegionDistribution = Record<string, number[]>;

export type CompressedChromosomeStats = Record<
  string,
  {
    chromosome: string;
    number_of_regions: number;
    start_nucleotide_position: number;
    end_nucleotide_position: number;
    minimum_region_length: number;
    maximum_region_length: number;
    mean_region_length: number;
    median_region_length: number;
  }
>;

export type CompressedPartitions = {
  counts: [string, number][];
  total: number;
};

export type CompressedExpectedPartitions = {
  rows: {
    partition: string;
    observed: number;
    expected: number;
    log10_oe: number;
    chi_sq_pval: number;
  }[];
};

export type CompressedOpenSignalStat = {
  condition: string;
  lower_whisker: number;
  lower_hinge: number;
  median: number;
  upper_hinge: number;
  upper_whisker: number;
};

export type CompressedOpenSignal = {
  condition_names: string[];
  matrix_stats: CompressedOpenSignalStat[];
};

/** The full blob stored at `distributions` in a compressed bedstat record. */
export type CompressedDistributions = {
  scalars?: Record<string, number>;
  partitions?: CompressedPartitions;
  expected_partitions?: CompressedExpectedPartitions;
  open_signal?: CompressedOpenSignal;
  distributions?: {
    widths?: CompressedHistogram;
    tss_distances?: CompressedHistogram;
    neighbor_distances?: CompressedKde;
    region_distribution?: CompressedRegionDistribution;
    chromosome_stats?: CompressedChromosomeStats;
    gc_content?: CompressedKde;
  };
};

// ---------------------------------------------------------------------------
// Histogram expansion helper
// ---------------------------------------------------------------------------

function expandHistogram(hist: CompressedHistogram): { x1: number; x2: number; pct: number }[] {
  const { x_min, x_max, bins, counts, total, overflow } = hist;
  if (bins === 0 || total === 0) return [];
  const binWidth = (x_max - x_min) / bins;
  const result: { x1: number; x2: number; pct: number }[] = [];
  for (let i = 0; i < counts.length; i++) {
    if (counts[i] === 0) continue;
    result.push({
      x1: Math.round(x_min + i * binWidth),
      x2: Math.round(x_min + (i + 1) * binWidth),
      pct: +((counts[i] / total) * 100).toFixed(2),
    });
  }
  // Add overflow bin for trimmed-out outliers (matches UI's quantileTrimmedHistogram)
  if (overflow && overflow > 0) {
    result.push({
      x1: Math.round(x_max),
      x2: Math.round(x_max + binWidth),
      pct: +((overflow / total) * 100).toFixed(2),
    });
  }
  return result;
}

// ---------------------------------------------------------------------------
// KDE expansion helper
// ---------------------------------------------------------------------------

function expandKde(kde: CompressedKde): { x: number; density: number }[] {
  const { x_min, x_max, n, densities } = kde;
  if (n === 0 || densities.length === 0) return [];
  const step = (x_max - x_min) / (n - 1);
  return densities.map((d, i) => ({ x: x_min + i * step, density: d }));
}

// ---------------------------------------------------------------------------
// Individual slot builders
// ---------------------------------------------------------------------------

export function compressedWidthsSlot(hist: CompressedHistogram): PlotSlot | null {
  const pctBins = expandHistogram(hist);
  if (pctBins.length === 0) return null;

  return {
    id: 'widths',
    title: 'Quantile-trimmed histogram of widths',
    description:
      'Distribution of region widths in base pairs, trimmed at the 99th percentile to remove outliers. Reveals whether the file contains mostly narrow peaks (e.g. transcription factor ChIP-seq) or broad domains (e.g. histone marks).',
    type: 'observable',
    renderThumbnail: (width, height) =>
      Plot.plot({
        width,
        height,
        style: { fontSize: '8px' },
        x: { label: null, tickSize: 0 },
        y: { label: null, tickSize: 0 },
        marks: [
          Plot.rectY(pctBins, { x1: 'x1', x2: 'x2', y: 'pct', fill: 'teal' }),
          Plot.ruleY([0]),
        ],
      }),
    render: (width) =>
      Plot.plot({
        width,
        x: { label: 'Region width (bp)', labelArrow: 'none' },
        y: { label: 'Percentage', labelArrow: 'none' },
        marks: [
          Plot.rectY(pctBins, { x1: 'x1', x2: 'x2', y: 'pct', fill: 'teal', tip: true }),
          Plot.ruleY([0]),
        ],
      }),
  };
}

export function compressedTssDistanceSlot(hist: CompressedHistogram): PlotSlot | null {
  const { x_min, x_max, bins, counts, total } = hist;
  if (bins === 0 || total === 0) return null;

  // Signed distances: negative = upstream, positive = downstream.
  // Expand to frequency bins matching the local TSS distance plot style.
  // Use clamped count (sum of bin counts) as denominator, matching the local version
  // which uses total = clamped.length, not all regions.
  const binWidth = (x_max - x_min) / bins;
  const clampedTotal = counts.reduce((s, c) => s + c, 0);
  if (clampedTotal === 0) return null;
  const freqBins: { x1: number; x2: number; freq: number }[] = [];
  for (let i = 0; i < counts.length; i++) {
    if (counts[i] === 0) continue;
    freqBins.push({
      x1: Math.round(x_min + i * binWidth),
      x2: Math.round(x_min + (i + 1) * binWidth),
      freq: +((counts[i] / clampedTotal) * 100).toFixed(2),
    });
  }
  if (freqBins.length === 0) return null;

  return {
    id: 'tssDistance',
    title: 'TSS distance',
    description:
      'Distribution of signed distances from each region to the nearest transcription start site (TSS), ranging from -100kb (upstream) to +100kb (downstream). A peak near zero indicates promoter-proximal regions. Requires a reference genome for TSS annotation.',
    type: 'observable',
    renderThumbnail: (width, height) =>
      Plot.plot({
        width,
        height,
        style: { fontSize: '8px' },
        x: { domain: [x_min, x_max], label: null, tickSize: 0 },
        y: { label: null, tickSize: 0 },
        marks: [
          Plot.rectY(freqBins, { x1: 'x1', x2: 'x2', y: 'freq', fill: 'teal' }),
          Plot.ruleX([0], { stroke: '#F1C40F', strokeWidth: 1.5, strokeDasharray: '3 3' }),
          Plot.ruleY([0]),
        ],
      }),
    render: (width) =>
      Plot.plot({
        width,
        x: {
          domain: [x_min, x_max],
          label: 'Distance to TSS',
          labelArrow: 'none',
          tickFormat: (d: number) => {
            if (d === 0) return 'TSS';
            const kb = d / 1000;
            return `${kb > 0 ? '+' : ''}${kb}kb`;
          },
        },
        y: { label: 'Frequency (%)', labelArrow: 'none' },
        marks: [
          Plot.rectY(freqBins, { x1: 'x1', x2: 'x2', y: 'freq', fill: 'teal', tip: true }),
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
          Plot.ruleY([0]),
        ],
      }),
  };
}

export function compressedNeighborDistanceSlot(kde: CompressedKde): PlotSlot | null {
  const points = expandKde(kde);
  if (points.length === 0) return null;

  return {
    id: 'neighborDistances',
    title: 'Neighboring regions distance distribution',
    description:
      'Density curve of distances between consecutive regions on a log₁₀ scale, estimated with Gaussian kernel density estimation (KDE). Clustered regions produce a peak at short distances; uniformly spaced regions produce a peak at longer distances.',
    type: 'observable',
    renderThumbnail: (width, height) =>
      Plot.plot({
        width,
        height,
        style: { fontSize: '8px' },
        x: { label: null, tickSize: 0 },
        y: { label: null, tickSize: 0 },
        marks: [
          Plot.lineY(points, { x: 'x', y: 'density', stroke: 'teal', strokeWidth: 1.5 }),
        ],
      }),
    render: (width) =>
      Plot.plot({
        width,
        x: {
          label: 'BP Distance (log₁₀)',
          labelArrow: 'none',
          tickFormat: (d: number) => `10^${Math.round(d)}`,
        },
        y: { label: 'Density', labelArrow: 'none' },
        marks: [
          Plot.lineY(points, { x: 'x', y: 'density', stroke: 'teal', strokeWidth: 1.5 }),
          Plot.tip(points, Plot.pointerX({ x: 'x', y: 'density' })),
          Plot.ruleY([0]),
        ],
      }),
  };
}

export function compressedGcContentSlot(kde: CompressedKde): PlotSlot | null {
  const points = expandKde(kde);
  if (points.length === 0) return null;

  const meanRule = kde.mean != null
    ? [Plot.ruleX([kde.mean], { stroke: '#3B82F6', strokeWidth: 2, strokeDasharray: '4 4' })]
    : [];
  const meanLabel = kde.mean != null
    ? [
        Plot.text([kde.mean], {
          x: (d: number) => d,
          text: (d: number) => `Mean (${parseFloat(d.toPrecision(4))})`,
          frameAnchor: 'top',
          dy: 12,
          dx: 4,
          textAnchor: 'start',
          fill: 'black',
          fontWeight: 'bold',
        }),
      ]
    : [];

  return {
    id: 'gcContent',
    title: 'GC content distribution',
    description:
      'Density curve of GC content (fraction of G+C bases) across all regions. Most regions cluster around the genome-wide average (~0.4 for human). Skewed distributions may indicate biased sampling or specific genomic compartments.',
    type: 'observable',
    renderThumbnail: (width, height) =>
      Plot.plot({
        width,
        height,
        style: { fontSize: '8px' },
        x: { label: null, tickSize: 0 },
        y: { label: null, tickSize: 0 },
        marks: [
          Plot.lineY(points, { x: 'x', y: 'density', stroke: 'teal', strokeWidth: 1.5 }),
          ...meanRule,
        ],
      }),
    render: (width) =>
      Plot.plot({
        width,
        x: {
          label: 'GC Content',
          labelArrow: 'none',
          tickFormat: (d: number) => d.toFixed(2),
        },
        y: { label: 'Density', labelArrow: 'none' },
        marks: [
          Plot.lineY(points, { x: 'x', y: 'density', stroke: 'teal', strokeWidth: 1.5 }),
          Plot.tip(points, Plot.pointerX({ x: 'x', y: 'density' })),
          Plot.ruleY([0]),
          ...meanRule,
          ...meanLabel,
        ],
      }),
  };
}

export function compressedRegionDistributionSlot(
  regionDist: CompressedRegionDistribution,
): PlotSlot | null {
  // Expand dense count arrays to DistributionPoint[] and delegate
  const points: DistributionPoint[] = [];
  for (const [chr, counts] of Object.entries(regionDist)) {
    for (let rid = 0; rid < counts.length; rid++) {
      if (counts[rid] === 0) continue;
      points.push({
        chr,
        start: 0, // positional start/end not available in compressed format
        end: 0,
        n: counts[rid],
        rid,
      });
    }
  }
  return regionDistributionSlot(points);
}

export function compressedChromosomeBarSlot(
  chromStats: CompressedChromosomeStats,
): PlotSlot | null {
  const rows: ChromosomeRow[] = Object.values(chromStats).map((s) => ({
    chromosome: s.chromosome,
    count: s.number_of_regions,
    start: s.start_nucleotide_position,
    end: s.end_nucleotide_position,
    min: s.minimum_region_length,
    max: s.maximum_region_length,
    mean: s.mean_region_length,
    median: s.median_region_length,
  }));
  return chromosomeBarSlot(rows);
}

export function compressedPartitionsSlot(
  partitions: CompressedPartitions,
): PlotSlot | null {
  const rows = partitions.counts.map(([name, count]) => ({ name, count }));
  return partitionsSlot(rows);
}

export function compressedExpectedPartitionsSlot(
  expectedPartitions: CompressedExpectedPartitions,
): PlotSlot | null {
  const rows = expectedPartitions.rows.map((r) => ({
    partition: r.partition,
    observed: r.observed,
    expected: r.expected,
    log10Oe: r.log10_oe,
    pvalue: r.chi_sq_pval,
  }));
  return expectedPartitionsSlot(rows);
}

export function compressedOpenSignalSlot(
  openSignal: CompressedOpenSignal,
): PlotSlot | null {
  const stats = openSignal.matrix_stats;
  if (stats.length === 0) return null;

  // Sort by median descending for readability
  const sorted = [...stats].sort((a, b) => b.median - a.median);

  const conditionOrder = sorted.map((s) => s.condition);

  function renderThumbnail(width: number, height: number): Element {
    return Plot.plot({
      width,
      height,
      marginLeft: 0,
      marginBottom: 0,
      y: { domain: conditionOrder, axis: null },
      x: { axis: null },
      marks: [
        // Whisker lines
        Plot.ruleY(sorted, {
          y: 'condition',
          x1: 'lower_whisker',
          x2: 'upper_whisker',
          stroke: '#999',
          strokeWidth: 0.5,
        }),
        // Hinge boxes
        Plot.rect(sorted, {
          y: 'condition',
          x1: 'lower_hinge',
          x2: 'upper_hinge',
          fill: 'teal',
          fillOpacity: 0.6,
          ry: 1,
        }),
        // Median ticks
        Plot.tickX(sorted, {
          y: 'condition',
          x: 'median',
          stroke: 'black',
          strokeWidth: 1.5,
        }),
      ],
    });
  }

  function render(width: number): Element {
    const height = conditionOrder.length * 14 + 60;
    const longestLabel = Math.max(...conditionOrder.map((c) => c.length));
    const marginLeft = Math.min(longestLabel * 5.5 + 16, width * 0.35);

    return Plot.plot({
      width,
      height,
      marginLeft,
      marginBottom: 40,
      y: { domain: conditionOrder, label: null, tickSize: 0 },
      x: { label: 'Open signal', labelArrow: 'none', grid: true },
      marks: [
        // Whisker lines
        Plot.ruleY(sorted, {
          y: 'condition',
          x1: 'lower_whisker',
          x2: 'upper_whisker',
          stroke: '#999',
        }),
        // Hinge boxes
        Plot.rect(sorted, {
          y: 'condition',
          x1: 'lower_hinge',
          x2: 'upper_hinge',
          fill: 'teal',
          fillOpacity: 0.6,
          ry: 1,
        }),
        // Median ticks
        Plot.tickX(sorted, {
          y: 'condition',
          x: 'median',
          stroke: 'black',
          strokeWidth: 2,
        }),
        Plot.tip(sorted, Plot.pointerY({
          y: 'condition',
          x: 'median',
          channels: {
            'Lower whisker': 'lower_whisker',
            'Q1': 'lower_hinge',
            'Median': 'median',
            'Q3': 'upper_hinge',
            'Upper whisker': 'upper_whisker',
          },
          format: { x: false, y: false },
        })),
      ],
    });
  }

  return {
    id: 'openSignal',
    title: 'Open chromatin signal',
    description:
      'Box-and-whisker summary of open chromatin signal across cell-type conditions. Each row shows the distribution of signal values for one cell type, sorted by median signal strength. Higher values indicate stronger open chromatin overlap with the BED regions.',
    type: 'observable',
    renderThumbnail,
    render,
  };
}

// ---------------------------------------------------------------------------
// Top-level: build all available slots from a compressed distributions blob
// ---------------------------------------------------------------------------

export function compressedDistributionSlots(
  distributions: CompressedDistributions,
): PlotSlot[] {
  const slots: PlotSlot[] = [];
  const inner = distributions.distributions;

  // Order matches the local analysis view (analysis-view.tsx buildPlotSlots):
  // 1. Region distribution, 2. Chromosome bar, 3. Widths, 4. Neighbor distances,
  // 5. TSS distance, 6. GC content, 7. Partitions, 8. Expected partitions, 9. Open signal

  if (inner?.region_distribution) {
    const s = compressedRegionDistributionSlot(inner.region_distribution);
    if (s) slots.push(s);
  }

  if (inner?.chromosome_stats) {
    const s = compressedChromosomeBarSlot(inner.chromosome_stats);
    if (s) slots.push(s);
  }

  if (inner?.widths) {
    const s = compressedWidthsSlot(inner.widths);
    if (s) slots.push(s);
  }

  if (inner?.neighbor_distances) {
    const s = compressedNeighborDistanceSlot(inner.neighbor_distances);
    if (s) slots.push(s);
  }

  if (inner?.tss_distances) {
    const s = compressedTssDistanceSlot(inner.tss_distances);
    if (s) slots.push(s);
  }

  if (inner?.gc_content) {
    const s = compressedGcContentSlot(inner.gc_content);
    if (s) slots.push(s);
  }

  if (distributions.partitions) {
    const s = compressedPartitionsSlot(distributions.partitions);
    if (s) slots.push(s);
  }

  if (distributions.expected_partitions) {
    const s = compressedExpectedPartitionsSlot(distributions.expected_partitions);
    if (s) slots.push(s);
  }

  if (distributions.open_signal) {
    const s = compressedOpenSignalSlot(distributions.open_signal);
    if (s) slots.push(s);
  }

  return slots;
}
