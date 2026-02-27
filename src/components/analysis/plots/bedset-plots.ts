/**
 * Plot specs for BedSetStats JSON — the aggregated statistics for a collection
 * of BED files produced by bbconf's aggregate_collection().
 *
 * Each curve carries mean + sd arrays (one value per bin/point), plus axis
 * metadata (x_min, x_max, bins/n_points).
 *
 * Visual style is based on the production plots:
 * - Histograms (widths, partitions): match genomicdist-plots.ts (per-file view)
 * - TSS: match consensus-tss.ts (collection view) — area+line with SD ribbon
 * - KDE curves (neighbor, GC): match genomicdist-plots.ts neighborDistanceSlot
 * - Chromosome: boxplot (mean ± SD), based on chr-region-boxplot.ts (collection view)
 * - Region dist: custom with Mean/SD variants
 */

import * as Plot from '@observablehq/plot';
import type { PlotSlot } from '../../../lib/plot-specs';

// ---------------------------------------------------------------------------
// Types for the BedSetStats JSON
// ---------------------------------------------------------------------------

export type BedSetHistogram = {
  x_min: number;
  x_max: number;
  bins: number;
  mean: number[];
  sd: number[];
  n: number;
};

export type BedSetKde = {
  x_min: number;
  x_max: number;
  n_points: number;
  mean: number[];
  sd: number[];
  n: number;
  file_mean?: number;
};

export type BedSetPartition = {
  mean_pct: number;
  sd_pct: number;
  n: number;
};

export type BedSetChromosomeSummary = {
  n: number;
  [field: string]: number | { mean: number; sd: number };
};

export type BedSetRegionDistribution = {
  mean: number[];
  sd: number[];
  n: number;
};

export type BedSetStats = {
  n_files: number;
  composition?: Record<string, Record<string, number>>;
  tss_histogram?: BedSetHistogram;
  neighbor_distances?: BedSetKde;
  gc_content?: BedSetKde;
  region_distribution?: Record<string, BedSetRegionDistribution>;
  partitions?: Record<string, BedSetPartition>;
  chromosome_summaries?: Record<string, BedSetChromosomeSummary>;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type KdePoint = { x: number; mean: number; lo: number; hi: number };

/** Expand histogram bins as midpoints for area+line rendering (like consensus-tss). */
function expandHistogramPoints(hist: BedSetHistogram): { binMid: number; mean: number; lo: number; hi: number }[] {
  const { x_min, x_max, bins, mean, sd } = hist;
  const binWidth = (x_max - x_min) / bins;
  const total = mean.reduce((s, v) => s + v, 0);
  if (total === 0) return [];
  return mean.map((m, i) => {
    const pct = (m / total) * 100;
    const sdPct = (sd[i] / total) * 100;
    return {
      binMid: x_min + (i + 0.5) * binWidth,
      mean: +pct.toFixed(2),
      lo: +Math.max(0, pct - sdPct).toFixed(2),
      hi: +(pct + sdPct).toFixed(2),
    };
  });
}

function expandKdePoints(kde: BedSetKde): KdePoint[] {
  const { x_min, x_max, n_points, mean, sd } = kde;
  const step = (x_max - x_min) / (n_points - 1);
  return mean.map((m, i) => ({
    x: x_min + i * step,
    mean: m,
    lo: Math.max(0, m - sd[i]),
    hi: m + sd[i],
  }));
}

function tssTickFormat(d: number): string {
  if (d === 0) return 'TSS';
  const kb = d / 1000;
  return `${kb > 0 ? '+' : ''}${kb}kb`;
}

// ---------------------------------------------------------------------------
// TSS Distance — based on consensusTssSlot (consensus-tss.ts):
// area+line with SD ribbon, color legend, y="Frequency (%)"
// ---------------------------------------------------------------------------

export function bedsetTssSlot(hist: BedSetHistogram): PlotSlot | null {
  const points = expandHistogramPoints(hist);
  if (points.length === 0) return null;
  const { x_min, x_max } = hist;

  return {
    id: 'tssDistance',
    title: 'TSS distance',
    description:
      'Average distance from regions to the nearest transcription start site (TSS) across all files in the collection. The teal line shows the mean frequency per distance bin; the shaded band shows ±1 SD across files. A sharp peak at TSS indicates promoter-proximal regions. A narrow band means files agree on the TSS proximity profile; a wide band suggests variability across files.',
    type: 'observable',
    renderThumbnail: (width, height) =>
      Plot.plot({
        width,
        height,
        style: { fontSize: '8px' },
        x: { domain: [x_min, x_max], label: null, tickSize: 0 },
        y: { label: null, tickSize: 0 },
        marks: [
          Plot.areaY(points, { x: 'binMid', y1: 'lo', y2: 'hi', fill: 'teal', fillOpacity: 0.15 }),
          Plot.lineY(points, { x: 'binMid', y: 'mean', stroke: 'teal', strokeWidth: 1.5 }),
          Plot.ruleX([0], { stroke: '#F1C40F', strokeWidth: 1.5, strokeDasharray: '3 3' }),
        ],
      }),
    render: (width) =>
      Plot.plot({
        width,
        height: 300,
        marginLeft: 60,
        marginBottom: 40,
        x: {
          domain: [x_min, x_max],
          label: 'Distance to TSS',
          labelArrow: 'none',
          tickFormat: tssTickFormat,
        },
        y: { label: 'Frequency (%)', labelArrow: 'none', grid: true },
        marks: [
          // SD shaded area
          Plot.areaY(points, {
            x: 'binMid',
            y1: 'lo',
            y2: 'hi',
            fill: 'teal',
            fillOpacity: 0.1,
          }),
          // Mean line
          Plot.lineY(points, {
            x: 'binMid',
            y: 'mean',
            stroke: 'teal',
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
          Plot.tip(points, Plot.pointerX({
            x: 'binMid',
            y: 'mean',
            channels: {
              'Mean': (d: typeof points[0]) => `${d.mean.toFixed(2)}%`,
              '+1 SD': (d: typeof points[0]) => `${d.hi.toFixed(2)}%`,
              '\u22121 SD': (d: typeof points[0]) => `${d.lo.toFixed(2)}%`,
            },
            format: { x: true, y: false },
          })),
          Plot.ruleY([0]),
        ],
      }),
  };
}

// ---------------------------------------------------------------------------
// Neighbor Distances — based on neighborDistanceSlot (genomicdist-plots.ts):
// area + line KDE, with SD ribbon added for collection data
// ---------------------------------------------------------------------------

export function bedsetNeighborDistSlot(kde: BedSetKde): PlotSlot | null {
  const points = expandKdePoints(kde);
  if (points.length === 0) return null;

  return {
    id: 'neighborDistances',
    title: 'Neighboring regions distance distribution',
    description:
      'Density curve of distances between consecutive regions on a log₁₀ scale, averaged across all files in the collection. The teal line shows the mean density; the shaded band shows ±1 SD across files. Clustered regions produce a peak at short distances; uniformly spaced regions produce a peak at longer distances. A narrow band means files agree on the spacing pattern; a wide band suggests variability.',
    type: 'observable',
    renderThumbnail: (width, height) =>
      Plot.plot({
        width,
        height,
        style: { fontSize: '8px' },
        x: { label: null, tickSize: 0 },
        y: { label: null, tickSize: 0 },
        marks: [
          Plot.lineY(points, { x: 'x', y: 'mean', stroke: 'teal', strokeWidth: 1.5 }),
        ],
      }),
    render: (width) =>
      Plot.plot({
        width,
        x: {
          label: 'BP Distance (log\u2081\u2080)',
          labelArrow: 'none',
          tickFormat: (d: number) => `10^${Math.round(d)}`,
        },
        y: { label: 'Density', labelArrow: 'none' },
        marks: [
          Plot.areaY(points, { x: 'x', y1: 'lo', y2: 'hi', fill: 'teal', fillOpacity: 0.1 }),
          Plot.lineY(points, { x: 'x', y: 'mean', stroke: 'teal', strokeWidth: 1.5 }),
          Plot.tip(points, Plot.pointerX({ x: 'x', y: 'mean' })),
          Plot.ruleY([0]),
        ],
      }),
  };
}

// ---------------------------------------------------------------------------
// GC Content — follows neighborDistanceSlot pattern (area + line KDE),
// with mean marker line like the old GC plot
// ---------------------------------------------------------------------------

export function bedsetGcContentSlot(kde: BedSetKde): PlotSlot | null {
  const points = expandKdePoints(kde);
  if (points.length === 0) return null;

  const meanVal = kde.file_mean != null ? Number(kde.file_mean) : null;
  const meanRule = meanVal != null && !isNaN(meanVal)
    ? [Plot.ruleX([meanVal], { stroke: '#3B82F6', strokeWidth: 2, strokeDasharray: '4 4' })]
    : [];
  const meanLabel = meanVal != null && !isNaN(meanVal)
    ? [
        Plot.text([String(meanVal)], {
          x: () => meanVal,
          text: (d: string) => `Mean (${parseFloat(Number(d).toPrecision(4))})`,
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
      'Distribution of GC content (guanine-cytosine fraction) across regions, averaged over all files in the collection. The teal line shows the mean density; the shaded band shows ±1 SD across files. A peak near 0.5 suggests regions from GC-neutral genomic background; a shift toward higher values may indicate promoter or CpG-island enrichment. A narrow band means files have consistent GC profiles; a wide band suggests heterogeneity.',
    type: 'observable',
    renderThumbnail: (width, height) =>
      Plot.plot({
        width,
        height,
        style: { fontSize: '8px' },
        x: { label: null, tickSize: 0 },
        y: { label: null, tickSize: 0 },
        marks: [
          Plot.lineY(points, { x: 'x', y: 'mean', stroke: 'teal', strokeWidth: 1.5 }),
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
          Plot.areaY(points, { x: 'x', y1: 'lo', y2: 'hi', fill: 'teal', fillOpacity: 0.1 }),
          Plot.lineY(points, { x: 'x', y: 'mean', stroke: 'teal', strokeWidth: 1.5 }),
          Plot.tip(points, Plot.pointerX({ x: 'x', y: 'mean' })),
          Plot.ruleY([0]),
          ...meanRule,
          ...meanLabel,
        ],
      }),
  };
}

// ---------------------------------------------------------------------------
// Region Distribution — two variants: "Mean" and "SD"
// Based on regionDistributionSlot (region-distribution.ts)
// ---------------------------------------------------------------------------

const STANDARD_CHR_ORDER = [
  'chr1', 'chr2', 'chr3', 'chr4', 'chr5', 'chr6', 'chr7', 'chr8', 'chr9', 'chr10',
  'chr11', 'chr12', 'chr13', 'chr14', 'chr15', 'chr16', 'chr17', 'chr18', 'chr19',
  'chr20', 'chr21', 'chr22', 'chrX', 'chrY', 'chrM',
];

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

type HeatCell = { chr: string; bin: number; totalCount: number };
type DensityBin = { chr: string; bin: number; mean: number; lo: number; hi: number };

export function bedsetRegionDistributionSlot(
  regionDist: Record<string, BedSetRegionDistribution>,
  nFiles: number,
): PlotSlot | null {
  const chrOrder = sortChromosomes(Object.keys(regionDist));
  if (chrOrder.length === 0) return null;

  const nBins = Object.values(regionDist)[0]?.mean.length ?? 250;
  const binSet = Array.from({ length: nBins }, (_, i) => i);
  const marginLeft = estimateMargin(chrOrder);

  // Heatmap data: total regions per bin (mean × nFiles)
  const heatData: HeatCell[] = [];
  for (const chr of chrOrder) {
    const rd = regionDist[chr];
    for (let bin = 0; bin < rd.mean.length; bin++) {
      const total = Math.round(rd.mean[bin] * nFiles);
      if (total > 0) heatData.push({ chr, bin, totalCount: total });
    }
  }

  // Density data: mean bars + SD ribbon
  const densityData: DensityBin[] = [];
  const densityDataPadded: DensityBin[] = [];
  for (const chr of chrOrder) {
    const rd = regionDist[chr];
    const chrBins: DensityBin[] = [];
    for (let bin = 0; bin < rd.mean.length; bin++) {
      chrBins.push({
        chr,
        bin,
        mean: rd.mean[bin],
        lo: Math.max(0, rd.mean[bin] - rd.sd[bin]),
        hi: rd.mean[bin] + rd.sd[bin],
      });
    }
    densityData.push(...chrBins);
    if (chrBins.length > 0) {
      const first = chrBins[0];
      const last = chrBins[chrBins.length - 1];
      densityDataPadded.push({ ...first, bin: first.bin - 0.5 });
      densityDataPadded.push(...chrBins);
      densityDataPadded.push({ ...last, bin: last.bin + 0.5 });
    }
  }

  if (heatData.length === 0 && densityData.length === 0) return null;

  function renderThumbnail(width: number, height: number): Element {
    return Plot.plot({
      width,
      height,
      margin: 4,
      x: { domain: binSet, axis: null },
      y: { domain: chrOrder, axis: null },
      color: { scheme: 'bupu' as Plot.ColorScheme, type: 'sqrt' },
      marks: [
        Plot.cell(heatData, { x: 'bin', y: 'chr', fill: 'totalCount', inset: 0 }),
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
        ticks: [0, nBins - 1],
        tickFormat: (d: number) => (d === 0 ? 'start' : 'end'),
      },
      y: { domain: chrOrder, label: 'Chromosome' },
      color: { scheme: 'bupu' as Plot.ColorScheme, type: 'sqrt', label: 'Total regions', legend: true },
      marks: [
        Plot.cell(heatData, {
          x: 'bin',
          y: 'chr',
          fill: 'totalCount',
          insetLeft: 0.15,
          insetRight: 0.15,
          tip: true,
          channels: { 'Total regions': 'totalCount' },
        }),
      ],
    });
  }

  function renderDensity(width: number): Element {
    const height = chrOrder.length * 25 + 40;
    return Plot.plot({
      width,
      height,
      marginLeft,
      marginTop: 10,
      marginBottom: 30,
      x: {
        domain: [0, nBins],
        label: 'Genomic position',
        labelArrow: 'none',
        labelAnchor: 'center',
        ticks: [0, nBins],
        tickFormat: (d: number) => (d === 0 ? 'start' : 'end'),
      },
      y: { axis: null },
      fy: { domain: chrOrder, label: 'Chromosome', padding: 0 },
      color: {
        domain: ['Mean', 'SD (±1)'],
        range: ['teal', 'orange'],
        legend: true,
      },
      marks: [
        // Mean bars
        Plot.rect(densityData, {
          x1: (d: DensityBin) => d.bin - 0.5,
          x2: (d: DensityBin) => d.bin + 0.5,
          y1: 0,
          y2: 'mean',
          fy: 'chr',
          fill: () => 'Mean',
          insetLeft: 0.15,
          insetRight: 0.15,
        }),
        // SD ribbon
        Plot.areaY(densityDataPadded, {
          x: 'bin',
          y1: 'lo',
          y2: 'hi',
          fy: 'chr',
          fill: 'orange',
          fillOpacity: 0.25,
          curve: 'step',
        }),
        // SD boundary lines
        Plot.line(densityDataPadded, {
          x: 'bin',
          y: 'hi',
          fy: 'chr',
          stroke: () => 'SD (±1)',
          strokeWidth: 0.75,
          strokeOpacity: 0.5,
          curve: 'step',
        }),
        Plot.line(densityDataPadded, {
          x: 'bin',
          y: 'lo',
          fy: 'chr',
          stroke: () => 'SD (±1)',
          strokeWidth: 0.75,
          strokeOpacity: 0.5,
          curve: 'step',
        }),
        // Tooltip
        Plot.tip(densityData, Plot.pointer({
          x: 'bin',
          y: 'mean',
          fy: 'chr',
          channels: {
            'Mean regions': (d: DensityBin) => d.mean.toFixed(1),
            '\u00b11 SD': (d: DensityBin) => `${d.lo.toFixed(1)} \u2013 ${d.hi.toFixed(1)}`,
          },
          format: { x: false, y: false, fy: false },
        })),
      ],
    });
  }

  return {
    id: 'regionDistribution',
    title: 'Aggregated region density',
    description:
      'Genome-wide view of where regions concentrate across chromosomes, aggregated across all files. "Total regions" shows a heatmap of summed counts per positional bin. "Average density" shows the mean count per bin as bars with a ±1 SD ribbon showing inter-file variability.',
    type: 'observable',
    renderThumbnail,
    render: renderTotal,
    variants: [
      { label: 'Total regions', render: renderTotal },
      { label: 'Average density', render: renderDensity },
    ],
  };
}

// ---------------------------------------------------------------------------
// Chromosome Boxplot — based on chr-region-boxplot.ts (collection view)
// Uses mean ± SD to approximate box-and-whisker (mean ± 1 SD = box,
// mean ± 2 SD = whiskers)
// ---------------------------------------------------------------------------

type ChrBoxRow = {
  chr: string;
  mean: number;
  lower_box: number;
  upper_box: number;
  lower_whisker: number;
  upper_whisker: number;
};

export function bedsetChromosomeBoxplotSlot(
  summaries: Record<string, BedSetChromosomeSummary>,
): PlotSlot | null {
  const rows: ChrBoxRow[] = Object.entries(summaries)
    .map(([chr, s]) => {
      const nr = s.number_of_regions;
      if (!nr || typeof nr === 'number') return null;
      const sd = (nr as { mean: number; sd: number }).sd;
      return {
        chr,
        mean: nr.mean,
        lower_box: Math.max(0, nr.mean - sd),
        upper_box: nr.mean + sd,
        lower_whisker: Math.max(0, nr.mean - 2 * sd),
        upper_whisker: nr.mean + 2 * sd,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (rows.length === 0) return null;

  const chrOrder = sortChromosomes(rows.map((r) => r.chr));
  const longestLabel = Math.max(...chrOrder.map((c) => c.length));
  const dynamicMarginLeft = Math.max(40, longestLabel * 7 + 16);

  function renderThumbnail(width: number, height: number): Element {
    return Plot.plot({
      width,
      height,
      marginLeft: 0,
      marginBottom: 0,
      y: { domain: chrOrder, axis: null },
      x: { axis: null },
      marks: [
        Plot.ruleY(rows, {
          y: 'chr',
          x1: 'lower_whisker',
          x2: 'upper_whisker',
          stroke: '#999',
          strokeWidth: 0.5,
        }),
        Plot.rect(rows, {
          y: 'chr',
          x1: 'lower_box',
          x2: 'upper_box',
          fill: 'teal',
          fillOpacity: 0.6,
          ry: 1,
        }),
        Plot.tickX(rows, {
          y: 'chr',
          x: 'mean',
          stroke: 'black',
          strokeWidth: 1.5,
        }),
      ],
    });
  }

  function render(width: number): Element {
    const height = chrOrder.length * 18 + 60;
    return Plot.plot({
      width,
      height,
      marginLeft: dynamicMarginLeft,
      marginBottom: 40,
      y: { domain: chrOrder, label: 'Chromosome', tickSize: 0 },
      x: { label: 'Region count', labelArrow: 'none', grid: true },
      marks: [
        Plot.ruleY(rows, {
          y: 'chr',
          x1: 'lower_whisker',
          x2: 'upper_whisker',
          stroke: '#999',
        }),
        Plot.rect(rows, {
          y: 'chr',
          x1: 'lower_box',
          x2: 'upper_box',
          fill: 'teal',
          fillOpacity: 0.6,
          ry: 1,
        }),
        Plot.tickX(rows, {
          y: 'chr',
          x: 'mean',
          stroke: 'black',
          strokeWidth: 2,
        }),
        Plot.tip(rows, Plot.pointerY({
          y: 'chr',
          x: 'mean',
          channels: {
            'Mean \u2212 2 SD': (d: ChrBoxRow) => Math.round(d.lower_whisker),
            'Mean \u2212 1 SD': (d: ChrBoxRow) => Math.round(d.lower_box),
            'Mean': (d: ChrBoxRow) => Math.round(d.mean),
            'Mean + 1 SD': (d: ChrBoxRow) => Math.round(d.upper_box),
            'Mean + 2 SD': (d: ChrBoxRow) => Math.round(d.upper_whisker),
          },
          format: { x: false, y: false },
        })),
      ],
    });
  }

  return {
    id: 'chromosomeBoxplot',
    title: 'Regions per chromosome',
    description:
      'Distribution of region counts per chromosome across all files in the collection. The box spans ±1 SD around the mean; whiskers extend to ±2 SD. Tight boxes indicate files agree on per-chromosome counts; wide boxes suggest variability across files.',
    type: 'observable',
    renderThumbnail,
    render,
  };
}

// ---------------------------------------------------------------------------
// Partitions — based on partitionsSlot (genomicdist-plots.ts):
// barY with rotated labels, ry1 rounding, margin from label length,
// plus SD error bars for collection data
// ---------------------------------------------------------------------------

export function bedsetPartitionsSlot(
  partitions: Record<string, BedSetPartition>,
): PlotSlot | null {
  const data = Object.entries(partitions)
    .map(([name, p]) => ({ partition: name, pct: p.mean_pct, sd: p.sd_pct }));
  if (data.length === 0) return null;

  const maxLabel = Math.max(...data.map((d) => d.partition.length));

  return {
    id: 'partitions',
    title: 'Genomic partitions',
    description:
      'Percentage of regions falling into each genomic partition (e.g. exon, intron, intergenic, promoter), averaged across all files in the collection. Error bars show ±1 SD across files. Shows where in the genome the regions are concentrated relative to gene structure. Small error bars mean files agree on the partition distribution; large error bars suggest the files target different genomic compartments.',
    type: 'observable',
    renderThumbnail: (width, height) =>
      Plot.plot({
        width,
        height,
        style: { fontSize: '7px' },
        marginBottom: Math.min(maxLabel * 4 + 8, height * 0.5),
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
          Plot.ruleX(data, {
            x: 'partition',
            y1: (d: typeof data[0]) => Math.max(0, d.pct - d.sd),
            y2: (d: typeof data[0]) => d.pct + d.sd,
            stroke: 'black',
            strokeWidth: 1.5,
          }),
        ],
      }),
  };
}

// ---------------------------------------------------------------------------
// Top-level: build all available slots from a BedSetStats JSON
// ---------------------------------------------------------------------------

export function bedsetStatsSlots(stats: BedSetStats): PlotSlot[] {
  const slots: PlotSlot[] = [];

  if (stats.neighbor_distances) {
    const s = bedsetNeighborDistSlot(stats.neighbor_distances);
    if (s) slots.push(s);
  }

  if (stats.tss_histogram) {
    const s = bedsetTssSlot(stats.tss_histogram);
    if (s) slots.push(s);
  }

  if (stats.gc_content) {
    const s = bedsetGcContentSlot(stats.gc_content);
    if (s) slots.push(s);
  }

  if (stats.region_distribution) {
    const s = bedsetRegionDistributionSlot(stats.region_distribution, stats.n_files);
    if (s) slots.push(s);
  }

  if (stats.chromosome_summaries) {
    const s = bedsetChromosomeBoxplotSlot(stats.chromosome_summaries);
    if (s) slots.push(s);
  }

  if (stats.partitions) {
    const s = bedsetPartitionsSlot(stats.partitions);
    if (s) slots.push(s);
  }

  return slots;
}
