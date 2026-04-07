/**
 * Plot specs for collection-level aggregated distributions (BedSetDistributions).
 *
 * These render mean ± SD across member BED files using Observable Plot.
 * The data shape is produced by bbconf's SQL aggregation.
 *
 * Plot specs for TSS, region distribution, chromosome boxplot, and partitions
 * are ported from the original bedset-plots.ts (BedSetStats era) and adapted
 * to the BedSetDistributions shape. Scalar histograms are native to this shape.
 */

import * as Plot from '@observablehq/plot';
import type { PlotSlot } from '../../../../lib/plot-specs';

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
// Shared helpers
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

// ---------------------------------------------------------------------------
// 1. TSS Distance — ported from bedsetTssSlot (bedset-plots.ts)
//    area+line with SD ribbon, TSS marker, frequency % on y-axis
// ---------------------------------------------------------------------------

function tssTickFormat(d: number): string {
  if (d === 0) return 'TSS';
  const kb = d / 1000;
  return `${kb > 0 ? '+' : ''}${kb}kb`;
}

function tssDistanceSlot(
  tss: NonNullable<BedSetDistributions['tss_histogram']>,
): PlotSlot | null {
  const { mean: means, sd: sds } = tss;
  if (!means || means.length === 0) return null;

  const nBins = tss.bins ?? means.length;
  const x_min = tss.x_min ?? -100000;
  const x_max = tss.x_max ?? 100000;
  const binWidth = (x_max - x_min) / nBins;

  const total = means.reduce((s, v) => s + v, 0);
  if (total === 0) return null;

  const points = means.map((m, i) => {
    const pct = (m / total) * 100;
    const sdPct = ((sds?.[i] ?? 0) / total) * 100;
    return {
      binMid: x_min + (i + 0.5) * binWidth,
      mean: +pct.toFixed(2),
      lo: +Math.max(0, pct - sdPct).toFixed(2),
      hi: +(pct + sdPct).toFixed(2),
    };
  });

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
          Plot.areaY(points, {
            x: 'binMid',
            y1: 'lo',
            y2: 'hi',
            fill: 'teal',
            fillOpacity: 0.1,
          }),
          Plot.lineY(points, {
            x: 'binMid',
            y: 'mean',
            stroke: 'teal',
            strokeWidth: 2,
          }),
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
// 2. Region Distribution — ported from bedsetRegionDistributionSlot
//    heatmap (total regions) + density variant (mean bars + SD ribbon)
// ---------------------------------------------------------------------------

type HeatCell = { chr: string; bin: number; totalCount: number };
type DensityBin = { chr: string; bin: number; mean: number; lo: number; hi: number };

function regionDistributionSlot(
  regionDist: Record<string, { mean: number[]; sd: number[]; n: number }>,
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
        Plot.areaY(densityDataPadded, {
          x: 'bin',
          y1: 'lo',
          y2: 'hi',
          fy: 'chr',
          fill: 'orange',
          fillOpacity: 0.25,
          curve: 'step',
        }),
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
// 3. Regions per Chromosome — horizontal bar chart with ±1 SD error bars,
//    styled to match the single-file chromosomeBarSlot
// ---------------------------------------------------------------------------

type ChrBarRow = {
  chr: string;
  mean: number;
  lo: number;
  hi: number;
};

function chromosomeBarSlot(
  regionDist: Record<string, { mean: number[]; sd: number[]; n: number }>,
): PlotSlot | null {
  const chrOrder = sortChromosomes(Object.keys(regionDist));
  if (chrOrder.length === 0) return null;

  const rows: ChrBarRow[] = [];
  for (const chr of chrOrder) {
    const { mean: means, sd: sds } = regionDist[chr];
    const totalMean = means.reduce((s, v) => s + v, 0);
    const totalSd = Math.sqrt(sds.reduce((s, v) => s + v * v, 0));
    if (totalMean === 0 && totalSd === 0) continue;
    rows.push({
      chr,
      mean: totalMean,
      lo: Math.max(0, totalMean - totalSd),
      hi: totalMean + totalSd,
    });
  }

  if (rows.length === 0) return null;

  const orderedChrs = rows.map((r) => r.chr);
  const marginLeft = estimateMargin(orderedChrs);

  function renderThumbnail(width: number, height: number): Element {
    const barHeight = (height - 8) / orderedChrs.length;
    const rx = barHeight > 6 ? 2 : barHeight > 3 ? 1 : 0;
    return Plot.plot({
      width,
      height,
      margin: 4,
      y: { domain: orderedChrs, axis: null },
      x: { axis: null },
      marks: [
        Plot.barX(rows, { y: 'chr', x: 'mean', fill: 'teal', rx2: rx, insetTop: 0.2, insetBottom: 0.2 }),
      ],
    });
  }

  function render(width: number): Element {
    const height = orderedChrs.length * 22 + 80;
    return Plot.plot({
      width,
      height,
      marginLeft,
      marginBottom: 40,
      y: { domain: orderedChrs, label: 'Chromosome' },
      x: { label: 'Regions', grid: true },
      marks: [
        Plot.barX(rows, {
          y: 'chr',
          x: 'mean',
          fill: 'teal',
          rx2: 2,
          tip: true,
        }),
        Plot.ruleY(rows, { y: 'chr', x1: 'lo', x2: 'hi', stroke: 'black', strokeWidth: 1.5 }),
        Plot.ruleX([0]),
      ],
    });
  }

  return {
    id: 'chromosomeBar',
    title: 'Regions per chromosome',
    description:
      'Mean total region count per chromosome across all files in the collection, with ±1 SD error bars. Differences reflect both chromosome size and biological enrichment of the assay.',
    type: 'observable',
    renderThumbnail,
    render,
  };
}

// ---------------------------------------------------------------------------
// 4. Partitions — ported from bedsetPartitionsSlot, styled to match the
//    single-file partitionsSlot (genomicdist-plots.ts) with SD error bars added
// ---------------------------------------------------------------------------

function partitionsSlot(
  partitions: Record<string, { mean_pct: number; sd_pct: number; n: number }>,
): PlotSlot | null {
  const data = Object.entries(partitions)
    .map(([name, p]) => ({ partition: name, pct: p.mean_pct, sd: p.sd_pct }));
  if (data.length === 0) return null;

  const maxLabel = Math.max(...data.map((d) => d.partition.length));

  return {
    id: 'partitions',
    title: 'Genomic partitions',
    description:
      'Percentage of regions falling into each genomic partition (e.g. exon, intron, intergenic, promoter), averaged across all files in the collection. Error bars show ±1 SD across files. Shows where in the genome the regions are concentrated relative to gene structure.',
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
          Plot.ruleX(data, {
            x: 'partition',
            y1: (d: typeof data[0]) => Math.max(0, d.pct - d.sd),
            y2: (d: typeof data[0]) => d.pct + d.sd,
            stroke: 'black',
            strokeWidth: 1.5,
          }),
          Plot.ruleY([0]),
        ],
      }),
  };
}

// ---------------------------------------------------------------------------
// 7. Scalar histograms — native to BedSetDistributions
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

  // Region distribution (heatmap + density)
  if (distributions.region_distribution) {
    const s = regionDistributionSlot(distributions.region_distribution, distributions.n_files);
    if (s) slots.push(s);
  }

  // Regions per chromosome (bar chart with SD)
  if (distributions.region_distribution) {
    const s = chromosomeBarSlot(distributions.region_distribution);
    if (s) slots.push(s);
  }

  // Partitions
  if (distributions.partitions) {
    const s = partitionsSlot(distributions.partitions);
    if (s) slots.push(s);
  }

  // TSS distance
  if (distributions.tss_histogram) {
    const s = tssDistanceSlot(distributions.tss_histogram);
    if (s) slots.push(s);
  }

  return slots;
}
