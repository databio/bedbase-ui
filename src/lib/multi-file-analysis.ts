import { RegionSet, RegionSetList, type ChromosomeStatistics } from '@databio/gtars';
import type { ProgressCallback, BedEntry } from './bed-parser';
import { REGION_DIST_BINS } from './bed-analysis';

export type FileStats = {
  fileName: string;
  regions: number;
  meanWidth: number;
  nucleotides: number;
};

export type FileBreakdown = {
  fileName: string;
  regions: number;
  shared: number;
  unique: number;
  overlapPct: number;
};

export type ConsensusRegion = {
  chr: string;
  start: number;
  end: number;
  count: number;
};

export type ChrRegionCount = {
  fileName: string;
  chr: string;
  count: number;
  fraction: number;  // count / total regions in this file (0–1)
};

export type WidthHistPoint = {
  fileName: string;
  binCenter: number;   // geometric center of the bin (bp)
  count: number;
  fraction: number;    // count / total regions in this file (0–1)
};

export type PositionalBin = {
  fileName: string;
  chr: string;
  bin: number;     // 0 to N_POS_BINS-1
  count: number;
};

export const N_POS_BINS = REGION_DIST_BINS;

/**
 * Compute the bin width (in bp) used for positional binning.
 * The longest chromosome gets exactly N_POS_BINS bins; shorter chromosomes
 * get proportionally fewer, preserving relative chromosome extent.
 */
export function posBinWidth(chromSizes: Record<string, number>): number {
  const maxSize = Math.max(...Object.values(chromSizes));
  return maxSize > 0 ? maxSize / N_POS_BINS : 1;
}

/**
 * Return the number of bins each chromosome should have, based on a universal
 * bin width derived from the longest chromosome.
 */
export function chrBinCounts(chromSizes: Record<string, number>): Record<string, number> {
  const bw = posBinWidth(chromSizes);
  const result: Record<string, number> = {};
  for (const [chr, size] of Object.entries(chromSizes)) {
    result[chr] = Math.max(1, Math.ceil(size / bw));
  }
  return result;
}

/**
 * Build a lookup that maps bare chromosome names (e.g. "1") to the canonical
 * names used in chromSizes (e.g. "chr1"). Returns identity for names that
 * already match.
 */
function buildChrAlias(chromSizes: Record<string, number>): Map<string, string> {
  const alias = new Map<string, string>();
  for (const canonical of Object.keys(chromSizes)) {
    alias.set(canonical, canonical);
    // Map bare name → prefixed name (e.g. "1" → "chr1", "X" → "chrX")
    if (canonical.startsWith('chr')) {
      alias.set(canonical.slice(3), canonical);
    }
  }
  return alias;
}

/**
 * Bin BED entries by absolute genomic position using reference chromosome sizes.
 * Uses a universal bin width so that the longest chromosome spans N_POS_BINS bins
 * and shorter chromosomes get proportionally fewer bins, preserving their relative
 * extent while keeping bins aligned across files.
 *
 * Chromosome names are normalized so that bare names ("1", "X") match
 * chr-prefixed reference names ("chr1", "chrX").
 */
export function binByAbsolutePosition(
  entries: [string, number, number, string][],
  fileName: string,
  chromSizes: Record<string, number>,
): PositionalBin[] {
  const bw = posBinWidth(chromSizes);
  const maxBins = chrBinCounts(chromSizes);
  const chrAlias = buildChrAlias(chromSizes);

  const counts = new Map<string, number>();
  for (const [chr, start, end] of entries) {
    const canonical = chrAlias.get(chr);
    if (!canonical) continue;
    const chrSize = chromSizes[canonical];
    if (!chrSize || chrSize <= 0) continue;
    const mid = (start + end) / 2;
    const chrMax = (maxBins[canonical] ?? 1) - 1;
    const bin = Math.min(Math.floor(mid / bw), chrMax);
    const key = `${canonical}\0${bin}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const bins: PositionalBin[] = [];
  for (const [key, count] of counts) {
    const sep = key.indexOf('\0');
    bins.push({ fileName, chr: key.slice(0, sep), bin: parseInt(key.slice(sep + 1)), count });
  }
  return bins;
}

export type PerFileGenomeResult = {
  fileName: string;
  genome: string | null;       // normalized top match genome name
  tier: number | null;
  raw: unknown;                // RefGenValidReturnModel from the API, opaque here
};

/** Per-file TSS distance histogram bin. */
export type TssHistPoint = {
  fileName: string;
  binMid: number;     // bin center (bp, signed)
  freq: number;       // fraction of file's clamped regions in this bin (0–1)
};

export type MultiFileResult = {
  fileStats: FileStats[];
  jaccardMatrix: number[][];
  overlapMatrix: number[][];       // asymmetric: [i][j] = % of file i's regions overlapping file j
  perFile: FileBreakdown[];
  chrCounts: ChrRegionCount[];     // flat array for plotting: file × chromosome region counts
  widthHist: WidthHistPoint[];     // flat array for plotting: file × width bin
  positionalBins: PositionalBin[]; // flat array for plotting: file × chr × positional bin
  consensus: ConsensusRegion[];
  tssHist: TssHistPoint[] | null;  // null if ref data unavailable
  unionStats: { regions: number; nucleotides: number } | null;
  intersectionStats: { regions: number; nucleotides: number } | null;
};

function yieldToMain(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function freeRs(rs: unknown) {
  try {
    (rs as { free?: () => void }).free?.();
  } catch { /* ignore */ }
}

/** Bin region widths on a log10 scale (1bp – 10Mbp, 28 bins). */
function binWidths(widths: number[], fileName: string): WidthHistPoint[] {
  const total = widths.length;
  if (total === 0) return [];
  const LOG_MIN = 0;   // log10(1)
  const LOG_MAX = 7;   // log10(10M)
  const N_BINS = 28;
  const BIN_W = (LOG_MAX - LOG_MIN) / N_BINS;
  const counts = new Array<number>(N_BINS).fill(0);
  for (const w of widths) {
    if (w <= 0) continue;
    const idx = Math.min(Math.max(Math.floor((Math.log10(w) - LOG_MIN) / BIN_W), 0), N_BINS - 1);
    counts[idx]++;
  }
  return counts
    .map((c, i) => ({
      fileName,
      binCenter: Math.pow(10, LOG_MIN + (i + 0.5) * BIN_W),
      count: c,
      fraction: c / total,
    }))
    .filter((d) => d.count > 0);
}

/**
 * Run the full multi-file comparison pipeline.
 *
 * Uses RegionSetList.fromEntries() to build a single collection in Rust,
 * then indexed operations (pintersectCount, unionExcept, etc.) to avoid
 * cloning RegionSets across the wasm boundary.
 */
export async function computeMultiFileAnalysis(
  allEntries: BedEntry[][],
  fileNames: string[],
  onProgress?: ProgressCallback,
): Promise<MultiFileResult> {
  const n = allEntries.length;

  // --- 0–10%: build RegionSetList + per-file stats ---
  const rsl = RegionSetList.fromEntries(allEntries, fileNames);

  const fileStats: FileStats[] = [];
  const chrCounts: ChrRegionCount[] = [];
  const widthHist: WidthHistPoint[] = [];

  for (let i = 0; i < n; i++) {
    const rs = rsl.get(i);
    fileStats.push({
      fileName: fileNames[i],
      regions: rs.numberOfRegions,
      meanWidth: rs.meanRegionWidth,
      nucleotides: rs.nucleotidesLength,
    });

    const calc = rs.chromosomeStatistics();
    if (calc) {
      const total = fileStats[i].regions;
      for (const entry of Array.from(calc.entries())) {
        const [chrom, stats] = entry as [unknown, ChromosomeStatistics];
        const count = stats.number_of_regions;
        chrCounts.push({
          fileName: fileNames[i],
          chr: String(chrom),
          count,
          fraction: total > 0 ? count / total : 0,
        });
        try { (stats as unknown as { free?: () => void }).free?.(); } catch { /* */ }
      }
    }

    try {
      const widths = rs.calcWidths() as number[];
      widthHist.push(...binWidths(Array.from(widths), fileNames[i]));
    } catch { /* calcWidths not available */ }

    freeRs(rs);
  }

  onProgress?.(0.10);
  await yieldToMain();

  // --- 10–15%: batch pairwise Jaccard (single wasm call, near-instant) ---
  const jaccardResult = rsl.pairwiseJaccard() as { matrix: number[][]; names: string[] | null };
  const jaccardMatrix = jaccardResult.matrix;

  onProgress?.(0.15);
  await yieldToMain();

  // --- 15–75%: pairwise overlap fractions via pintersectCount (dominant cost) ---
  const overlapMatrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) overlapMatrix[i][i] = 100;

  const totalPairs = (n * (n - 1)) / 2;
  let pairsDone = 0;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const interCount = rsl.pintersectCount(i, j);
      const countI = fileStats[i].regions;
      const countJ = fileStats[j].regions;
      overlapMatrix[i][j] = countI > 0 ? (interCount / countI) * 100 : 0;
      overlapMatrix[j][i] = countJ > 0 ? (interCount / countJ) * 100 : 0;

      pairsDone++;
      onProgress?.(0.15 + 0.60 * (pairsDone / totalPairs));
      await yieldToMain();
    }
  }

  // --- 75–85%: consensus ---
  let consensus: ConsensusRegion[] = [];
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gtars = await import('@databio/gtars') as any;
    if (typeof gtars.ConsensusBuilder === 'function') {
      const builder = new gtars.ConsensusBuilder();
      for (let i = 0; i < n; i++) {
        const rs = rsl.get(i);
        builder.add(rs);
        freeRs(rs);
      }
      onProgress?.(0.80);
      await yieldToMain();
      const raw = builder.compute() as Array<{ chr: string; start: number; end: number; count: number }>;
      consensus = raw;
      try { builder.free?.(); } catch { /* */ }
    }
  } catch (err) { console.warn('ConsensusBuilder failed:', err); }

  onProgress?.(0.85);
  await yieldToMain();

  // --- 85–95%: union, intersection, and per-file breakdown (O(n) batch) ---
  let unionStats: MultiFileResult['unionStats'] = null;
  let intersectionStats: MultiFileResult['intersectionStats'] = null;
  const perFile: FileBreakdown[] = [];

  if (n >= 2) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const bulk = (rsl as any).bulkUnionExcept() as {
        union_regions: number;
        union_nucleotides: number;
        except_unique: number[];
      };

      unionStats = {
        regions: bulk.union_regions,
        nucleotides: bulk.union_nucleotides,
      };

      for (let i = 0; i < n; i++) {
        const unique = bulk.except_unique[i];
        const shared = fileStats[i].regions - unique;
        perFile.push({
          fileName: fileStats[i].fileName,
          regions: fileStats[i].regions,
          shared,
          unique,
          overlapPct: fileStats[i].regions > 0 ? (shared / fileStats[i].regions) * 100 : 0,
        });
      }
    } catch (err) {
      console.warn('bulkUnionExcept failed:', err);
      for (let i = 0; i < n; i++) {
        perFile.push({
          fileName: fileStats[i].fileName,
          regions: fileStats[i].regions,
          shared: fileStats[i].regions,
          unique: 0,
          overlapPct: 100,
        });
      }
    }

    onProgress?.(0.92);
    await yieldToMain();

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const interAll = (rsl as any).intersectAll() as RegionSet;
      intersectionStats = {
        regions: interAll.numberOfRegions,
        nucleotides: interAll.nucleotidesLength,
      };
      freeRs(interAll);
    } catch (err) { console.warn('Intersection failed:', err); }
  } else {
    for (let i = 0; i < n; i++) {
      perFile.push({
        fileName: fileStats[i].fileName,
        regions: fileStats[i].regions,
        shared: fileStats[i].regions,
        unique: 0,
        overlapPct: 100,
      });
    }
  }

  onProgress?.(0.95);
  await yieldToMain();

  freeRs(rsl);
  onProgress?.(1);
  return { fileStats, jaccardMatrix, overlapMatrix, perFile, chrCounts, widthHist, positionalBins: [], consensus, tssHist: null, unionStats, intersectionStats };
}
