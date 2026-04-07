/**
 * Plot specs for local multi-file collection analysis.
 *
 * These are computed client-side from raw BED data (via WASM or JS).
 * They compare individual files within a collection: similarity heatmaps,
 * chromosome distributions, consensus regions, positional density, and
 * width distributions.
 */

import * as Plot from '@observablehq/plot';
import type { PlotSlot } from '../../../../lib/plot-specs';
import type {
  ChrRegionCount,
  ConsensusRegion,
  FilePartitions,
  FileStats,
  TssHistPoint,
  PositionalBin,
  WidthHistPoint,
} from '../../../../lib/multi-file-analysis';
import { chrBinCounts } from '../../../../lib/multi-file-analysis';
import { REGION_DIST_BINS } from '../../../../lib/bed-analysis';

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

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = q * (sorted.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

function makeLabels(fileNames: string[]): string[] {
  return fileNames.map((f) => f.replace(/\.(bed|bed\.gz)$/i, ''));
}

function formatBp(bp: number): string {
  if (bp >= 1e6) return `${(bp / 1e6).toFixed(1)}M`;
  if (bp >= 1e3) return `${(bp / 1e3).toFixed(1)}K`;
  return `${Math.round(bp)}`;
}

// ---------------------------------------------------------------------------
// 1. Pairwise similarity (Jaccard + Overlap heatmaps)
// ---------------------------------------------------------------------------

type Cell = { fileA: string; fileB: string; value: number };

function matrixToCells(matrix: number[][], fileNames: string[]): Cell[] {
  const cells: Cell[] = [];
  const n = Math.min(matrix.length, fileNames.length);
  for (let i = 0; i < n; i++) {
    const row = matrix[i];
    if (!row) continue;
    for (let j = 0; j < n; j++) {
      cells.push({ fileA: fileNames[i], fileB: fileNames[j], value: row[j] ?? 0 });
    }
  }
  return cells;
}

function estimateHeatmapMargins(labels: string[]): { left: number; bottom: number } {
  const longest = Math.max(...labels.map((l) => l.length));
  const left = Math.max(40, longest * 7 + 16);
  const bottom = Math.max(40, longest * 5 + 16);
  return { left, bottom };
}

function renderHeatmap(
  cells: Cell[],
  labels: string[],
  fileNames: string[],
  opts: { width: number; height: number; maxVal: number; scheme: string; label: string; format: (v: number) => string; legend: boolean },
): Element {
  const margins = opts.legend ? estimateHeatmapMargins(labels) : { left: 4, bottom: 4 };
  return Plot.plot({
    width: opts.width,
    height: opts.height,
    marginLeft: margins.left,
    marginBottom: margins.bottom,
    x: opts.legend ? { domain: labels, label: null, tickRotate: -45 } : { domain: labels, axis: null },
    y: opts.legend ? { domain: labels, label: null } : { domain: labels, axis: null },
    color: { domain: [0, opts.maxVal], scheme: opts.scheme as Plot.ColorScheme, label: opts.legend ? opts.label : undefined, legend: opts.legend },
    marks: [
      Plot.cell(cells, {
        x: (d: Cell) => labels[fileNames.indexOf(d.fileA)],
        y: (d: Cell) => labels[fileNames.indexOf(d.fileB)],
        fill: 'value',
        inset: 0.5,
      }),
      ...(opts.legend ? [
        Plot.text(cells, {
          x: (d: Cell) => labels[fileNames.indexOf(d.fileA)],
          y: (d: Cell) => labels[fileNames.indexOf(d.fileB)],
          text: (d: Cell) => opts.format(d.value),
          fill: (d: Cell) => (d.value > opts.maxVal * 0.5 ? 'white' : 'black'),
          fontSize: 11,
        }),
      ] : []),
    ],
  });
}

export function similarityHeatmapSlot(
  jaccardMatrix: number[][],
  overlapMatrix: number[][],
  fileNames: string[],
): PlotSlot {
  const labels = makeLabels(fileNames);
  const jCells = matrixToCells(jaccardMatrix, fileNames);
  const oCells = matrixToCells(overlapMatrix, fileNames);

  const n = fileNames.length;
  const margins = estimateHeatmapMargins(labels);
  function fullSize(width: number) {
    const cellSize = Math.min(60, Math.floor((width - margins.left) / n));
    return cellSize * n + margins.bottom;
  }

  function renderThumbnail(width: number, height: number): Element {
    const size = Math.min(width, height);
    return renderHeatmap(jCells, labels, fileNames, {
      width: size, height: size, maxVal: 1, scheme: 'blues', label: '', format: () => '', legend: false,
    });
  }

  function renderJaccard(width: number): Element {
    return renderHeatmap(jCells, labels, fileNames, {
      width, height: fullSize(width), maxVal: 1, scheme: 'blues',
      label: 'Jaccard similarity', format: (v) => v.toFixed(3), legend: true,
    });
  }

  function renderOverlap(width: number): Element {
    return renderHeatmap(oCells, labels, fileNames, {
      width, height: fullSize(width), maxVal: 100, scheme: 'greens',
      label: 'Region overlap %', format: (v) => `${v.toFixed(1)}%`, legend: true,
    });
  }

  return {
    id: 'similarityHeatmap',
    title: 'Pairwise similarity',
    description: 'Pairwise comparison of genomic coverage between files, measured in base pairs. Jaccard similarity is the ratio of shared bases to total bases covered by either file (0 = no shared bases, 1 = identical coverage). It is symmetric — comparing A to B gives the same value as B to A. Overlap % is asymmetric: it shows what fraction of each file\'s bases are covered by the other, so A→B and B→A can differ when files have different total coverage. Use Jaccard to assess overall concordance; use Overlap % to identify when one file is a subset of another.',
    type: 'observable',
    renderThumbnail,
    render: renderJaccard,
    variants: [
      { label: 'Jaccard', render: renderJaccard },
      { label: 'Overlap %', render: renderOverlap },
    ],
  };
}

// ---------------------------------------------------------------------------
// 2. Regions per chromosome — bar chart with IQR error bars
// ---------------------------------------------------------------------------

type ChrBarRow = {
  chr: string;
  median: number;
  q25: number;
  q75: number;
};

function buildChrBarRows(
  chrCounts: ChrRegionCount[],
  fileNames: string[],
  getValue: (d: ChrRegionCount) => number,
): ChrBarRow[] {
  const allChrs = sortChromosomes([...new Set(chrCounts.map((d) => d.chr))]);

  const byChr = new Map<string, Map<string, number>>();
  for (const chr of allChrs) {
    const m = new Map<string, number>();
    for (const fn of fileNames) m.set(fn, 0);
    byChr.set(chr, m);
  }
  for (const d of chrCounts) {
    byChr.get(d.chr)?.set(d.fileName, getValue(d));
  }

  const rows: ChrBarRow[] = [];
  for (const chr of allChrs) {
    const values = [...byChr.get(chr)!.values()].sort((a, b) => a - b);
    if (values.length === 0) continue;
    rows.push({
      chr,
      median: quantile(values, 0.5),
      q25: quantile(values, 0.25),
      q75: quantile(values, 0.75),
    });
  }
  return rows;
}

function buildChrAlias(chromSizes: Record<string, number>): Map<string, string> {
  const alias = new Map<string, string>();
  for (const canonical of Object.keys(chromSizes)) {
    alias.set(canonical, canonical);
    if (canonical.startsWith('chr')) {
      alias.set(canonical.slice(3), canonical);
    }
  }
  return alias;
}

export function chrRegionBarSlot(
  chrCounts: ChrRegionCount[],
  fileNames: string[],
  chromSizes?: Record<string, number>,
): PlotSlot | null {
  if (chrCounts.length === 0 || fileNames.length < 2) return null;

  const chrAlias = chromSizes ? buildChrAlias(chromSizes) : null;
  const filtered = chrAlias
    ? chrCounts
        .map((d) => {
          const canonical = chrAlias.get(d.chr);
          return canonical ? { ...d, chr: canonical } : null;
        })
        .filter((d): d is ChrRegionCount => d !== null)
    : chrCounts;

  const countRows = buildChrBarRows(filtered, fileNames, (d) => d.count);
  if (countRows.length === 0) return null;

  const chrOrder = countRows.map((r) => r.chr);
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
        Plot.barX(countRows, { y: 'chr', x: 'median', fill: 'teal', rx2: rx, insetTop: 0.2, insetBottom: 0.2 }),
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
        Plot.barX(countRows, {
          y: 'chr',
          x: 'median',
          fill: 'teal',
          rx2: 2,
          tip: true,
        }),
        Plot.ruleY(countRows, { y: 'chr', x1: 'q25', x2: 'q75', stroke: 'black', strokeWidth: 1.5 }),
        Plot.ruleX([0]),
      ],
    });
  }

  return {
    id: 'chromosomeBar',
    title: 'Regions per chromosome',
    description:
      'Median region count per chromosome across all compared files, with IQR (25th\u201375th percentile) error bars. Differences reflect both chromosome size and biological enrichment of the assay.',
    type: 'observable',
    renderThumbnail,
    render,
  };
}

// ---------------------------------------------------------------------------
// 3. Chromosome heatmap
// ---------------------------------------------------------------------------

export function chromosomeHeatmapSlot(
  chrCounts: ChrRegionCount[],
  fileNames: string[],
): PlotSlot | null {
  if (chrCounts.length === 0) return null;

  const labels = makeLabels(fileNames);
  const labelMap = new Map(fileNames.map((f, i) => [f, labels[i]]));
  const chrOrder = sortChromosomes([...new Set(chrCounts.map((d) => d.chr))]);

  const data = chrCounts.map((d) => ({
    ...d,
    label: labelMap.get(d.fileName) ?? d.fileName,
  }));

  function renderThumbnail(width: number, height: number): Element {
    return Plot.plot({
      width,
      height,
      margin: 8,
      x: { domain: chrOrder, axis: null },
      y: { domain: labels, axis: null },
      color: { scheme: 'ylgnbu', type: 'linear' },
      marks: [
        Plot.cell(data, {
          x: 'chr',
          y: 'label',
          fill: 'fraction',
          inset: 0.5,
        }),
      ],
    });
  }

  function renderFraction(width: number): Element {
    const height = labels.length * 24 + 100;
    return Plot.plot({
      width,
      height,
      marginLeft: 120,
      marginBottom: 80,
      x: { domain: chrOrder, label: null, tickRotate: -45 },
      y: { domain: labels, label: null },
      color: { scheme: 'ylgnbu', type: 'linear', label: 'Fraction of regions', legend: true },
      marks: [
        Plot.cell(data, {
          x: 'chr',
          y: 'label',
          fill: 'fraction',
          inset: 0.5,
          tip: true,
          channels: {
            Regions: 'count',
            '% of file': (d: typeof data[0]) => `${(d.fraction * 100).toFixed(1)}%`,
          },
        }),
      ],
    });
  }

  function renderCount(width: number): Element {
    const height = labels.length * 24 + 100;
    return Plot.plot({
      width,
      height,
      marginLeft: 120,
      marginBottom: 80,
      x: { domain: chrOrder, label: null, tickRotate: -45 },
      y: { domain: labels, label: null },
      color: { scheme: 'ylgnbu', type: 'linear', label: 'Region count', legend: true },
      marks: [
        Plot.cell(data, {
          x: 'chr',
          y: 'label',
          fill: 'count',
          inset: 0.5,
          tip: true,
          channels: {
            Regions: 'count',
            '% of file': (d: typeof data[0]) => `${(d.fraction * 100).toFixed(1)}%`,
          },
        }),
      ],
    });
  }

  return {
    id: 'chromosomeHeatmap',
    title: 'Regions by chromosome',
    description: 'Heatmap of region counts per chromosome for each file. "Normalized" shows the fraction of each file\'s total regions on each chromosome, enabling comparison across files with different sizes. "Raw counts" shows absolute region counts.',
    type: 'observable',
    renderThumbnail,
    render: renderFraction,
    variants: [
      { label: 'Normalized', render: renderFraction },
      { label: 'Raw counts', render: renderCount },
    ],
  };
}

// ---------------------------------------------------------------------------
// 4. Consensus support distribution
// ---------------------------------------------------------------------------

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
      marginTop: 8,
      marginRight: 8,
      marginLeft: 8,
      marginBottom: Math.min(Math.max(...bins.map((b) => b.label.length)) * 6 + 8, height * 0.5),
      style: { fontSize: '7px' },
      x: { domain: bins.map((b) => b.label), label: null, tickSize: 0 },
      y: { axis: null },
      marks: [
        Plot.barY(bins, { x: 'label', y: 'count', fill: 'teal', ry1: 2 }),
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
          ry1: 2,
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
    description: 'Distribution of consensus regions by support level. All regions across files are merged into a non-overlapping union, then each merged region is counted by how many input files overlap it. A region with support 3/5 means 3 of 5 files had at least one region there. If most regions have low support (left-skewed), the files share little; if most have high support (right-skewed), the files agree on where regions are. A uniform distribution suggests partially overlapping files with no strong consensus.',
    type: 'observable',
    renderThumbnail,
    render,
  };
}

export { buildSupportBins, type SupportBin };

// ---------------------------------------------------------------------------
// 5. Consensus TSS distance
// ---------------------------------------------------------------------------

const TSS_RANGE = 100_000;

function tssTickFormat(d: number): string {
  if (d === 0) return 'TSS';
  const kb = d / 1000;
  return `${kb > 0 ? '+' : ''}${kb}kb`;
}

type TssBinStats = {
  binMid: number;
  mean: number;
  q25: number;
  q75: number;
};

export function consensusTssSlot(
  tssHist: TssHistPoint[],
  fileNames: string[],
): PlotSlot | null {
  if (tssHist.length === 0 || fileNames.length < 2) return null;

  const nFiles = fileNames.length;

  const byBin = new Map<number, number[]>();
  for (const d of tssHist) {
    const arr = byBin.get(d.binMid);
    if (arr) arr.push(d.freq);
    else byBin.set(d.binMid, [d.freq]);
  }

  const bins = [...byBin.keys()].sort((a, b) => a - b);
  const stats: TssBinStats[] = [];
  for (const binMid of bins) {
    const vals = byBin.get(binMid)!;
    while (vals.length < nFiles) vals.push(0);
    vals.sort((a, b) => a - b);
    stats.push({
      binMid,
      mean: vals.reduce((s, v) => s + v, 0) / nFiles,
      q25: quantile(vals, 0.25),
      q75: quantile(vals, 0.75),
    });
  }

  if (stats.length === 0) return null;

  const pctStats = stats.map((s) => ({
    binMid: s.binMid,
    mean: s.mean * 100,
    q25: s.q25 * 100,
    q75: s.q75 * 100,
  }));

  function renderThumbnail(width: number, height: number): Element {
    return Plot.plot({
      width,
      height,
      style: { fontSize: '8px' },
      x: { domain: [-TSS_RANGE, TSS_RANGE], label: null, tickSize: 0 },
      y: { label: null, tickSize: 0 },
      marks: [
        Plot.areaY(pctStats, { x: 'binMid', y1: 'q25', y2: 'q75', fill: 'teal', fillOpacity: 0.15 }),
        Plot.lineY(pctStats, { x: 'binMid', y: 'mean', stroke: 'teal', strokeWidth: 1.5 }),
        Plot.ruleX([0], { stroke: '#F1C40F', strokeWidth: 1.5, strokeDasharray: '3 3' }),
      ],
    });
  }

  function render(width: number): Element {
    return Plot.plot({
      width,
      height: 300,
      marginLeft: 60,
      marginBottom: 40,
      x: {
        domain: [-TSS_RANGE, TSS_RANGE],
        label: 'Distance to TSS',
        labelArrow: 'none',
        tickFormat: tssTickFormat,
      },
      y: { label: 'Frequency (%)', labelArrow: 'none', grid: true },
      marks: [
        Plot.areaY(pctStats, {
          x: 'binMid',
          y1: 'q25',
          y2: 'q75',
          fill: 'teal',
          fillOpacity: 0.1,
        }),
        Plot.lineY(pctStats, {
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
        Plot.tip(pctStats, Plot.pointerX({
          x: 'binMid',
          y: 'mean',
          channels: {
            'Q75': (d: typeof pctStats[0]) => `${d.q75.toFixed(2)}%`,
            'Mean': (d: typeof pctStats[0]) => `${d.mean.toFixed(2)}%`,
            'Q25': (d: typeof pctStats[0]) => `${d.q25.toFixed(2)}%`,
          },
          format: { x: true, y: false },
        })),
        Plot.ruleY([0]),
      ],
    });
  }

  return {
    id: 'tssDistance',
    title: 'TSS distance',
    description:
      'Average distance from regions to the nearest transcription start site (TSS) across all compared files. The teal line shows the mean frequency per distance bin; the shaded band shows the 25th\u201375th percentile range across files. A sharp peak at TSS indicates promoter-proximal regions. A narrow band means files agree on the TSS proximity profile; a wide band suggests variability across files.',
    type: 'observable',
    renderThumbnail,
    render,
  };
}

// ---------------------------------------------------------------------------
// 6. Consensus region widths
// ---------------------------------------------------------------------------

const LOG_MIN = 0;
const LOG_MAX = 7;
const N_WIDTH_BINS = 28;
const WIDTH_BIN_W = (LOG_MAX - LOG_MIN) / N_WIDTH_BINS;

type WidthBin = { binCenter: number; count: number; fraction: number };
type SupportWidthBin = WidthBin & { support: string };

function binWidths(widths: number[]): WidthBin[] {
  return binWidthsFull(widths).filter((d) => d.count > 0);
}

function binWidthsFull(widths: number[]): WidthBin[] {
  if (widths.length === 0) return [];
  const counts = new Array<number>(N_WIDTH_BINS).fill(0);
  for (const w of widths) {
    if (w <= 0) continue;
    const idx = Math.min(Math.max(Math.floor((Math.log10(w) - LOG_MIN) / WIDTH_BIN_W), 0), N_WIDTH_BINS - 1);
    counts[idx]++;
  }
  const total = widths.length;
  return counts.map((c, i) => ({
    binCenter: Math.pow(10, LOG_MIN + (i + 0.5) * WIDTH_BIN_W),
    count: c,
    fraction: c / total,
  }));
}

export function consensusWidthsSlot(
  consensus: ConsensusRegion[],
  nFiles: number,
): PlotSlot | null {
  if (consensus.length < 10) return null;

  const widths = consensus.map((r) => r.end - r.start).filter((w) => w > 0);
  if (widths.length < 10) return null;

  const allBins = binWidths(widths);

  const supportOrder: string[] = [];
  const widthsBySupport = new Map<string, number[]>();
  for (let s = 1; s <= nFiles; s++) {
    const label = `${s}/${nFiles}`;
    supportOrder.push(label);
    widthsBySupport.set(label, []);
  }
  for (const r of consensus) {
    const w = r.end - r.start;
    if (w <= 0) continue;
    const label = `${r.count}/${nFiles}`;
    widthsBySupport.get(label)?.push(w);
  }

  const supportBins: SupportWidthBin[] = [];
  for (const label of supportOrder) {
    const ws = widthsBySupport.get(label)!;
    if (ws.length === 0) continue;
    for (const bin of binWidthsFull(ws)) {
      supportBins.push({ ...bin, support: label });
    }
  }

  function renderThumbnail(width: number, height: number): Element {
    return Plot.plot({
      width,
      height,
      marginLeft: 0,
      marginBottom: 0,
      x: { type: 'log', axis: null },
      y: { axis: null },
      marks: [
        Plot.areaY(allBins, { x: 'binCenter', y: 'fraction', fill: 'teal', fillOpacity: 0.3, curve: 'basis' }),
        Plot.lineY(allBins, { x: 'binCenter', y: 'fraction', stroke: 'teal', strokeWidth: 1.5, curve: 'basis' }),
      ],
    });
  }

  function renderAll(width: number): Element {
    return Plot.plot({
      width,
      height: 300,
      marginLeft: 60,
      marginBottom: 40,
      x: {
        type: 'log',
        label: 'Region width (bp)',
        labelArrow: 'none',
        tickFormat: (d: number) => formatBp(d),
      },
      y: { label: 'Fraction of consensus regions', labelArrow: 'none', grid: true },
      marks: [
        Plot.areaY(allBins, { x: 'binCenter', y: 'fraction', fill: 'teal', fillOpacity: 0.15, curve: 'basis' }),
        Plot.lineY(allBins, {
          x: 'binCenter',
          y: 'fraction',
          stroke: 'teal',
          strokeWidth: 2,
          curve: 'basis',
          tip: true,
          channels: {
            'Width': (d: WidthBin) => `~${formatBp(d.binCenter)}`,
            'Regions': 'count',
          },
        }),
        Plot.ruleY([0]),
      ],
    });
  }

  function renderBySupport(width: number): Element {
    return Plot.plot({
      width,
      height: 300,
      marginLeft: 60,
      marginBottom: 40,
      x: {
        type: 'log',
        label: 'Region width (bp)',
        labelArrow: 'none',
        tickFormat: (d: number) => formatBp(d),
      },
      y: { label: 'Fraction of group', labelArrow: 'none', grid: true },
      color: { domain: supportOrder, legend: true },
      marks: [
        Plot.lineY(supportBins, {
          x: 'binCenter',
          y: 'fraction',
          stroke: 'support',
          strokeWidth: 2,
          curve: 'basis',
          tip: true,
          channels: {
            'Width': (d: SupportWidthBin) => `~${formatBp(d.binCenter)}`,
            'Regions': 'count',
          },
        }),
        Plot.ruleY([0]),
      ],
    });
  }

  return {
    id: 'consensusWidths',
    title: 'Consensus region widths',
    description:
      'Distribution of consensus region widths on a log\u2081\u2080 scale. Narrow consensus regions (left) suggest sharply defined functional elements like transcription factor binding sites. Broad regions (right) suggest histone marks or structural domains. The "By support" variant breaks this down by how many files share each region \u2014 if high-support regions are consistently narrower, the shared signal is likely from well-defined functional elements.',
    type: 'observable',
    renderThumbnail,
    render: renderAll,
    variants: [
      { label: 'All widths', render: renderAll },
      { label: 'By support', render: renderBySupport },
    ],
  };
}

// ---------------------------------------------------------------------------
// 7. Positional heatmap (aggregated region density)
// ---------------------------------------------------------------------------

type AggCell = { chr: string; bin: number; fileCount: number; totalCount: number; meanCount: number };
type PosBinStats = { chr: string; bin: number; mean: number; q25: number; q75: number };

export function positionalHeatmapSlot(
  bins: PositionalBin[],
  fileNames: string[],
  chromSizes?: Record<string, number>,
): PlotSlot | null {
  if (bins.length === 0) return null;

  const nFiles = fileNames.length;
  const chrOrder = sortChromosomes([...new Set(bins.map((d) => d.chr))]);

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

  const maxBinsPerChr = chromSizes ? chrBinCounts(chromSizes) : null;
  const globalMaxBin = maxBinsPerChr
    ? Math.max(...chrOrder.map((c) => maxBinsPerChr[c] ?? 1))
    : Math.max(...bins.map((d) => d.bin)) + 1;

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
      margin: 8,
      x: { domain: binSet, axis: null },
      y: { domain: chrOrder, axis: null },
      color: { scheme: 'bupu' as Plot.ColorScheme, type: 'sqrt' },
      marks: [
        Plot.cell(data, { x: 'bin', y: 'chr', fill: 'totalCount', inset: 0 }),
      ],
    });
  }

  const statsData: PosBinStats[] = [];
  const statsDataPadded: PosBinStats[] = [];
  for (const chr of chrOrder) {
    const chrMax = maxBinsPerChr?.[chr] ?? globalMaxBin;
    const chrStats: PosBinStats[] = [];
    for (let bin = 0; bin < chrMax; bin++) {
      const key = `${chr}\0${bin}`;
      const entry = keyMap.get(key);
      const counts = entry ? [...entry.counts] : [];
      while (counts.length < nFiles) counts.push(0);
      counts.sort((a, b) => a - b);
      const mean = counts.reduce((s, v) => s + v, 0) / nFiles;
      chrStats.push({ chr, bin, mean, q25: quantile(counts, 0.25), q75: quantile(counts, 0.75) });
    }
    statsData.push(...chrStats);
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
        domain: ['Mean', 'IQR (25th\u201375th)'],
        range: ['teal', 'orange'],
        legend: true,
      },
      marks: [
        Plot.rect(statsData, {
          x1: (d: PosBinStats) => d.bin - 0.5,
          x2: (d: PosBinStats) => d.bin + 0.5,
          y1: 0,
          y2: 'mean',
          fy: 'chr',
          fill: () => 'Mean',
          insetLeft: 0.15,
          insetRight: 0.15,
        }),
        Plot.areaY(statsDataPadded, {
          x: 'bin',
          y1: 'q25',
          y2: 'q75',
          fy: 'chr',
          fill: 'orange',
          fillOpacity: 0.25,
          curve: 'step',
        }),
        Plot.line(statsDataPadded, {
          x: 'bin',
          y: 'q75',
          fy: 'chr',
          stroke: () => 'IQR (25th\u201375th)',
          strokeWidth: 0.75,
          strokeOpacity: 0.5,
          curve: 'step',
        }),
        Plot.line(statsDataPadded, {
          x: 'bin',
          y: 'q25',
          fy: 'chr',
          stroke: () => 'IQR (25th\u201375th)',
          strokeWidth: 0.75,
          strokeOpacity: 0.5,
          curve: 'step',
        }),
        Plot.tip(statsData, Plot.pointer({
          x: 'bin',
          y: 'mean',
          fy: 'chr',
          channels: {
            'Q75': (d: PosBinStats) => d.q75.toFixed(1),
            'Mean regions': (d: PosBinStats) => d.mean.toFixed(1),
            'Q25': (d: PosBinStats) => d.q25.toFixed(1),
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
    description: `Genome-wide view showing where regions concentrate across chromosomes. A universal bin width is set so the longest chromosome spans ${REGION_DIST_BINS} bins; shorter chromosomes get proportionally fewer bins, preserving their relative extent. Each region is counted once in the bin containing its midpoint. "Total regions" shows a heatmap summing counts from all files per bin. "Mean per file" shows histogram bars of the mean count with a shaded 25th\u201375th percentile ribbon.`,
    type: 'observable',
    renderThumbnail,
    render: renderTotal,
    variants: [
      { label: 'Total regions', render: renderTotal },
      { label: 'Average density', render: renderMean },
    ],
  };
}

// ---------------------------------------------------------------------------
// 8. Width distribution comparison
// ---------------------------------------------------------------------------

export function widthDistributionSlot(
  widthHist: WidthHistPoint[],
): PlotSlot | null {
  if (widthHist.length === 0) return null;

  const fileNames = [...new Set(widthHist.map((d) => d.fileName))];
  const labels = makeLabels(fileNames);
  const labelMap = new Map(fileNames.map((f, i) => [f, labels[i]]));

  const data = widthHist.map((d) => ({
    ...d,
    label: labelMap.get(d.fileName) ?? d.fileName,
  }));

  function renderThumbnail(width: number, height: number): Element {
    return Plot.plot({
      width,
      height,
      marginLeft: 0,
      marginBottom: 0,
      x: { type: 'log', axis: null },
      y: { axis: null },
      marks: [
        Plot.line(data, {
          x: 'binCenter',
          y: 'fraction',
          stroke: 'label',
          strokeWidth: 1.5,
          curve: 'basis',
        }),
      ],
    });
  }

  function render(width: number): Element {
    return Plot.plot({
      width,
      height: 300,
      marginLeft: 60,
      marginBottom: 40,
      x: {
        type: 'log',
        label: 'Region width (bp)',
        tickFormat: (d: number) => formatBp(d),
      },
      y: { label: 'Fraction of regions', grid: true },
      color: { domain: labels, legend: true },
      marks: [
        Plot.areaY(data, {
          x: 'binCenter',
          y: 'fraction',
          fill: 'label',
          fillOpacity: 0.15,
          curve: 'basis',
        }),
        Plot.line(data, {
          x: 'binCenter',
          y: 'fraction',
          stroke: 'label',
          strokeWidth: 2,
          curve: 'basis',
          tip: true,
          channels: {
            'Width bin': (d: typeof data[0]) => `~${formatBp(d.binCenter)} bp`,
            'Regions': 'count',
          },
        }),
      ],
    });
  }

  return {
    id: 'widthDistribution',
    title: 'Region width distribution',
    description: 'Region width distributions compared across files on a log\u2081\u2080 scale (1 bp to 10 Mbp). Each file is shown as a separate line. Narrow peaks cluster on the left; broad domains appear on the right.',
    type: 'observable',
    renderThumbnail,
    render,
  };
}

// ---------------------------------------------------------------------------
// 9. Scalar histograms (distribution of per-file values across the collection)
// ---------------------------------------------------------------------------

type ScalarDef = {
  key: keyof FileStats;
  id: string;
  title: string;
  unit: string;
  description: string;
};

const SCALAR_DEFS: ScalarDef[] = [
  {
    key: 'regions',
    id: 'scalar-number_of_regions',
    title: 'Number of regions',
    unit: 'regions',
    description: 'Distribution of region counts across compared BED files.',
  },
  {
    key: 'meanWidth',
    id: 'scalar-mean_region_width',
    title: 'Mean region width',
    unit: 'bp',
    description: 'Distribution of mean region widths (bp) across compared BED files.',
  },
  {
    key: 'medianNeighborDistance',
    id: 'scalar-median_neighbor_distance',
    title: 'Median neighbor distance',
    unit: 'bp',
    description: 'Distribution of median distances between adjacent regions across compared BED files.',
  },
];

function scalarHistogramBins(values: number[], nBins?: number): { x1: number; x2: number; count: number }[] {
  nBins = nBins ?? Math.min(25, Math.max(3, Math.ceil(Math.sqrt(values.length))));
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return [{ x1: min, x2: max + 1, count: values.length }];
  const binWidth = (max - min) / nBins;
  const bins = Array.from({ length: nBins }, (_, i) => ({
    x1: min + i * binWidth,
    x2: min + (i + 1) * binWidth,
    count: 0,
  }));
  for (const v of values) {
    const idx = Math.min(Math.floor((v - min) / binWidth), nBins - 1);
    bins[idx].count++;
  }
  return bins;
}

export function fileStatsScalarSlots(fileStats: FileStats[]): PlotSlot[] {
  const slots: PlotSlot[] = [];

  for (const def of SCALAR_DEFS) {
    const values = fileStats
      .map((f) => f[def.key] as number | undefined)
      .filter((v): v is number => v != null && !isNaN(v));
    if (values.length < 2) continue;

    const bins = scalarHistogramBins(values);
    if (bins.length === 0) continue;

    const mean = values.reduce((s, v) => s + v, 0) / values.length;

    slots.push({
      id: def.id,
      title: def.title,
      description: `${def.description} Mean: ${mean.toLocaleString(undefined, { maximumFractionDigits: 1 })} (n=${values.length}).`,
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
            Plot.ruleX([mean], { stroke: 'orange', strokeWidth: 1.5, strokeDasharray: '3,2' }),
          ],
        }),
      render: (width) =>
        Plot.plot({
          width,
          x: { label: def.unit || def.title, labelArrow: 'none' },
          y: { label: 'Files', labelArrow: 'none' },
          marks: [
            Plot.rectY(bins, { x1: 'x1', x2: 'x2', y: 'count', fill: 'teal', tip: true }),
            Plot.ruleY([0]),
            Plot.ruleX([mean], { stroke: 'orange', strokeWidth: 2, strokeDasharray: '4,3' }),
          ],
        }),
    });
  }

  return slots;
}

// ---------------------------------------------------------------------------
// 10. Aggregate partitions (mean bar + IQR error bars across files)
// ---------------------------------------------------------------------------

type PartitionBar = { partition: string; median: number; q25: number; q75: number };

export function aggregatePartitionsSlot(
  filePartitions: FilePartitions[],
): PlotSlot | null {
  if (filePartitions.length < 2) return null;

  // Collect all partition names
  const allNames = new Set<string>();
  for (const fp of filePartitions) {
    for (const name of Object.keys(fp.partitions)) allNames.add(name);
  }
  if (allNames.size === 0) return null;

  const data: PartitionBar[] = [];
  for (const name of allNames) {
    const values = filePartitions
      .map((fp) => fp.partitions[name] ?? 0)
      .sort((a, b) => a - b);
    data.push({
      partition: name,
      median: quantile(values, 0.5),
      q25: quantile(values, 0.25),
      q75: quantile(values, 0.75),
    });
  }

  const maxLabel = Math.max(...data.map((d) => d.partition.length));

  return {
    id: 'partitions',
    title: 'Genomic partitions',
    description:
      'Median percentage of regions falling into each genomic partition across all compared files, with IQR (25th\u201375th percentile) error bars. Shows where in the genome the regions are concentrated relative to gene structure.',
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
          Plot.barY(data, { x: 'partition', y: 'median', fill: 'teal', ry1: 2 }),
        ],
      }),
    render: (width) =>
      Plot.plot({
        width,
        marginBottom: Math.min(maxLabel * 6 + 20, 80),
        x: { label: 'Genomic Partition', labelArrow: 'none', tickRotate: -33 },
        y: { label: 'Percentage', labelArrow: 'none' },
        marks: [
          Plot.barY(data, { x: 'partition', y: 'median', fill: 'teal', ry1: 2, tip: true }),
          Plot.ruleX(data, {
            x: 'partition',
            y1: 'q25',
            y2: 'q75',
            stroke: 'black',
            strokeWidth: 1.5,
          }),
          Plot.ruleY([0]),
        ],
      }),
  };
}
