import * as Plot from '@observablehq/plot';
import type { PlotSlot } from '../../../lib/plot-specs';
import type { PartitionRow, ExpectedPartitionRow } from '../../../lib/bed-analysis';

// --- Binning helpers ---

function quantileTrimmedHistogram(
  values: number[],
  numBins: number,
  trimQuantile = 0.99,
): { x1: number; x2: number; count: number }[] {
  if (values.length === 0) return [];
  const sorted = [...values].sort((a, b) => a - b);
  const trimIdx = Math.floor(sorted.length * trimQuantile);
  const trimmed = sorted.slice(0, trimIdx + 1);
  const min = trimmed[0];
  const max = trimmed[trimmed.length - 1];
  if (min === max) return [{ x1: min, x2: max + 1, count: trimmed.length }];

  const binWidth = (max - min) / numBins;
  const bins: { x1: number; x2: number; count: number }[] = [];
  for (let i = 0; i < numBins; i++) {
    bins.push({ x1: min + i * binWidth, x2: min + (i + 1) * binWidth, count: 0 });
  }
  for (const v of trimmed) {
    const idx = Math.min(Math.floor((v - min) / binWidth), numBins - 1);
    bins[idx].count++;
  }
  // Add overflow bin for trimmed-out values
  const overflow = values.length - trimmed.length;
  if (overflow > 0) {
    bins.push({ x1: max, x2: max + binWidth, count: overflow });
  }
  return bins.filter((b) => b.count > 0);
}

function binValues(
  values: number[],
  numBins: number,
  rangeMin?: number,
  rangeMax?: number,
): { x1: number; x2: number; count: number }[] {
  if (values.length === 0) return [];
  const min = rangeMin ?? Math.min(...values);
  const max = rangeMax ?? Math.max(...values);
  if (min === max) return [{ x1: min, x2: max + 1, count: values.length }];

  const binWidth = (max - min) / numBins;
  const bins: { x1: number; x2: number; count: number }[] = [];
  for (let i = 0; i < numBins; i++) {
    bins.push({ x1: min + i * binWidth, x2: min + (i + 1) * binWidth, count: 0 });
  }
  for (const v of values) {
    if (v < min || v > max) continue;
    const idx = Math.min(Math.floor((v - min) / binWidth), numBins - 1);
    bins[idx].count++;
  }
  return bins;
}

// --- 1D Gaussian KDE ---

function gaussianKde(
  values: number[],
  numPoints = 256,
  trimQuantile = 0.99,
  maxSamples = 5000,
): { x: number; density: number }[] {
  if (values.length === 0) return [];
  const sorted = [...values].sort((a, b) => a - b);
  const trimIdx = Math.floor(sorted.length * trimQuantile);
  const trimmed = sorted.slice(0, trimIdx + 1);

  // Downsample for KDE evaluation (evenly spaced from sorted array preserves distribution shape)
  const sample = trimmed.length <= maxSamples
    ? trimmed
    : Array.from({ length: maxSamples }, (_, i) =>
        trimmed[Math.floor(i * (trimmed.length - 1) / (maxSamples - 1))],
      );
  const n = sample.length;

  // Silverman's rule of thumb for bandwidth (use full data stats)
  const mean = trimmed.reduce((s, v) => s + v, 0) / trimmed.length;
  const variance = trimmed.reduce((s, v) => s + (v - mean) ** 2, 0) / trimmed.length;
  const sd = Math.sqrt(variance);
  const iqr = trimmed[Math.floor(trimmed.length * 0.75)] - trimmed[Math.floor(trimmed.length * 0.25)];
  const h = 0.9 * Math.min(sd, iqr / 1.34) * trimmed.length ** -0.2;
  if (h <= 0) return [];

  // Evaluate over grid
  const min = trimmed[0] - 3 * h;
  const max = trimmed[trimmed.length - 1] + 3 * h;
  const step = (max - min) / (numPoints - 1);
  const inv = 1 / (n * h);
  const result: { x: number; density: number }[] = [];
  for (let i = 0; i < numPoints; i++) {
    const x = min + i * step;
    let sum = 0;
    for (let j = 0; j < n; j++) {
      const z = (x - sample[j]) / h;
      sum += Math.exp(-0.5 * z * z);
    }
    result.push({ x, density: sum * inv * 0.3989422804014327 }); // 1/sqrt(2pi)
  }
  return result;
}

// --- Plot slot builders ---

/**
 * Region widths histogram (quantile-trimmed).
 * Matches the old "Quantile Trimmed Histogram" Vega-Lite spec.
 */
export function widthsHistogramSlot(widths: number[]): PlotSlot | null {
  if (widths.length === 0) return null;
  const bins = quantileTrimmedHistogram(widths, 50);
  if (bins.length === 0) return null;

  const total = bins.reduce((s, b) => s + b.count, 0);
  const pctBins = bins.map((b) => ({ x1: Math.round(b.x1), x2: Math.round(b.x2), pct: +((b.count / total) * 100).toFixed(2) }));

  return {
    id: 'widths',
    title: 'Quantile-trimmed histogram of widths',
    description: 'Distribution of region widths in base pairs, trimmed at the 99th percentile to remove outliers. Reveals whether the file contains mostly narrow peaks (e.g. transcription factor ChIP-seq) or broad domains (e.g. histone marks).',
    type: 'observable',
    renderThumbnail: (width, height) =>
      Plot.plot({
        width,
        height,
        style: { fontSize: '8px' },
        x: { label: null, tickSize: 0 },
        y: { label: null, tickSize: 0 },
        marks: [
          Plot.rectY(pctBins, { x1: 'x1', x2: 'x2', y: 'pct', fill: 'teal', ry1: 2 }),
          Plot.ruleY([0]),
        ],
      }),
    render: (width) =>
      Plot.plot({
        width,
        x: { label: 'Region width (bp)', labelArrow: 'none' },
        y: { label: 'Percentage', labelArrow: 'none' },
        marks: [
          Plot.rectY(pctBins, { x1: 'x1', x2: 'x2', y: 'pct', fill: 'teal', ry1: 2, tip: true }),
          Plot.ruleY([0]),
        ],
      }),
  };
}

/**
 * Neighbor distance density curve (Gaussian KDE on log10-transformed distances).
 * The R package uses log10 x-axis because distances span bp to millions.
 * We KDE in log-space, then label the axis with 10^n notation.
 */
export function neighborDistanceSlot(distances: number[]): PlotSlot | null {
  if (distances.length === 0) return null;
  // Filter zeros/negatives (overlapping regions) and log10-transform
  const logDist = distances.filter((d) => d > 0).map((d) => Math.log10(d));
  if (logDist.length === 0) return null;

  const kde = gaussianKde(logDist, 512);
  if (kde.length === 0) return null;

  return {
    id: 'neighborDistances',
    title: 'Neighboring regions distance distribution',
    description: 'Density curve of distances between consecutive regions on a log₁₀ scale, estimated with Gaussian kernel density estimation (KDE). Clustered regions produce a peak at short distances; uniformly spaced regions produce a peak at longer distances.',
    type: 'observable',
    renderThumbnail: (width, height) =>
      Plot.plot({
        width,
        height,
        style: { fontSize: '8px' },
        x: { label: null, tickSize: 0 },
        y: { label: null, tickSize: 0 },
        marks: [
          Plot.areaY(kde, { x: 'x', y: 'density', fill: 'teal', fillOpacity: 0.3 }),
          Plot.lineY(kde, { x: 'x', y: 'density', stroke: 'teal', strokeWidth: 1.5 }),
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
          Plot.areaY(kde, { x: 'x', y: 'density', fill: 'teal', fillOpacity: 0.15 }),
          Plot.lineY(kde, { x: 'x', y: 'density', stroke: 'teal', strokeWidth: 1.5 }),
          Plot.tip(kde, Plot.pointerX({ x: 'x', y: 'density' })),
          Plot.ruleY([0]),
        ],
      }),
  };
}

/**
 * TSS distance distribution using signed feature distances.
 * calcTssDistances returns unsigned (absolute) distances;
 * calcFeatureDistances returns signed distances (negative = upstream).
 * Bins into 100 bins centered at TSS (0).
 * Matches the old "Distance Relative to TSS" layered Vega-Lite spec.
 */
export function tssDistanceSlot(featureDistances: (number | null)[]): PlotSlot | null {
  const valid = featureDistances.filter((v): v is number => v !== null);
  if (valid.length === 0) return null;

  // Bin from -100kb to +100kb into 100 bins
  const range = 100_000;
  const numBins = 100;
  const clamped = valid.filter((v) => Math.abs(v) <= range);
  if (clamped.length === 0) return null;

  const bins = binValues(clamped, numBins, -range, range);
  // Convert to frequency (%)
  const total = clamped.length;
  const freqBins = bins.map((b) => ({
    x1: Math.round(b.x1),
    x2: Math.round(b.x2),
    freq: +((b.count / total) * 100).toFixed(2),
  }));

  return {
    id: 'tssDistance',
    title: 'TSS distance',
    description: 'Distribution of signed distances from each region to the nearest transcription start site (TSS), ranging from -100kb (upstream) to +100kb (downstream). A peak near zero indicates promoter-proximal regions. Requires a reference genome for TSS annotation.',
    type: 'observable',
    renderThumbnail: (width, height) =>
      Plot.plot({
        width,
        height,
        style: { fontSize: '8px' },
        x: { label: null, tickSize: 0 },
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

/**
 * Genomic partition counts.
 * Matches the old "Distribution Across Genomic Partitions" bar chart spec.
 */
export function partitionsSlot(partitions: PartitionRow[]): PlotSlot | null {
  if (partitions.length === 0) return null;

  const total = partitions.reduce((s, p) => s + p.count, 0);
  const data = partitions.map((p) => ({ partition: p.name, pct: +((p.count / total) * 100).toFixed(2) }));
  const maxLabel = Math.max(...data.map((d) => d.partition.length));

  return {
    id: 'partitions',
    title: 'Genomic partitions',
    description: 'Percentage of regions falling into each genomic partition (e.g. exon, intron, intergenic, promoter). Shows where in the genome the regions are concentrated relative to gene structure. Requires a reference genome for partition annotation.',
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
          Plot.ruleY([0]),
        ],
      }),
  };
}

/**
 * Expected vs observed partition enrichment.
 * Horizontal bar chart of log10(O/E).
 * Matches the old "Distribution Across Genomic Partitions" expected enrichment spec.
 */
export function expectedPartitionsSlot(rows: ExpectedPartitionRow[]): PlotSlot | null {
  if (rows.length === 0) return null;

  const data = rows.map((r) => ({ partition: r.partition, log10OE: +r.log10Oe.toFixed(3) }));
  const pos = data.filter((d) => d.log10OE >= 0);
  const neg = data.filter((d) => d.log10OE < 0);
  const maxLabel = Math.max(...data.map((d) => d.partition.length));

  function barMarks(tip: boolean) {
    const marks: Plot.Markish[] = [];
    if (pos.length > 0) {
      marks.push(Plot.barX(pos, { x: 'log10OE', y: 'partition', fill: 'teal', rx2: 2 }));
    }
    if (neg.length > 0) {
      marks.push(Plot.barX(neg, { x: 'log10OE', y: 'partition', fill: '#ef4444', rx1: 2 }));
    }
    marks.push(Plot.ruleX([0]));
    if (tip) {
      marks.push(Plot.tip(data, Plot.pointerY({ x: 'log10OE', y: 'partition' })));
    }
    return marks;
  }

  return {
    id: 'expectedPartitions',
    title: 'Partition enrichment',
    description: 'Log₁₀ ratio of observed to expected region counts per genomic partition. Positive values (teal) indicate enrichment; negative values (red) indicate depletion relative to a uniform genomic background. Requires a reference genome.',
    type: 'observable',
    renderThumbnail: (width, height) =>
      Plot.plot({
        width,
        height,
        style: { fontSize: '7px' },
        marginLeft: Math.min(maxLabel * 5 + 8, width * 0.55),
        marginTop: 0,
        marginBottom: 0,
        x: { axis: null },
        y: { label: null, tickSize: 0 },
        marks: barMarks(false),
      }),
    render: (width) =>
      Plot.plot({
        width,
        marginLeft: Math.min(maxLabel * 7 + 16, width * 0.3),
        x: { label: 'log₁₀(Observed / Expected)', labelArrow: 'none' },
        y: { label: null },
        marks: barMarks(true),
      }),
  };
}
