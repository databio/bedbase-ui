import { RegionSet, type ChromosomeStatistics } from '@databio/gtars';
import type { ProgressCallback } from './bed-parser';

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

export const N_POS_BINS = 100;

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
 * Bin BED entries by absolute genomic position using reference chromosome sizes.
 * Uses a universal bin width so that the longest chromosome spans N_POS_BINS bins
 * and shorter chromosomes get proportionally fewer bins, preserving their relative
 * extent while keeping bins aligned across files.
 */
export function binByAbsolutePosition(
  entries: [string, number, number, string][],
  fileName: string,
  chromSizes: Record<string, number>,
): PositionalBin[] {
  const bw = posBinWidth(chromSizes);
  const maxBins = chrBinCounts(chromSizes);

  const counts = new Map<string, number>();
  for (const [chr, start, end] of entries) {
    const chrSize = chromSizes[chr];
    if (!chrSize || chrSize <= 0) continue;
    const mid = (start + end) / 2;
    const chrMax = (maxBins[chr] ?? 1) - 1;
    const bin = Math.min(Math.floor(mid / bw), chrMax);
    const key = `${chr}\0${bin}`;
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

export type MultiFileResult = {
  fileStats: FileStats[];
  jaccardMatrix: number[][];
  overlapMatrix: number[][];       // asymmetric: [i][j] = % of file i's regions overlapping file j
  perFile: FileBreakdown[];
  chrCounts: ChrRegionCount[];     // flat array for plotting: file × chromosome region counts
  widthHist: WidthHistPoint[];     // flat array for plotting: file × width bin
  positionalBins: PositionalBin[]; // flat array for plotting: file × chr × positional bin
  consensus: ConsensusRegion[];
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
 * Progress phases:
 *   0.00–0.05  per-file stats
 *   0.05–0.45  pairwise Jaccard + overlap fractions
 *   0.45–0.60  consensus
 *   0.60–0.80  union / intersection
 *   0.80–1.00  per-file unique (setdiff)
 */
export async function computeMultiFileAnalysis(
  regionSets: RegionSet[],
  fileNames: string[],
  onProgress?: ProgressCallback,
): Promise<MultiFileResult> {
  const n = regionSets.length;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sets = regionSets as any[];

  // --- 0–5%: per-file stats + chromosome counts ---
  const fileStats: FileStats[] = regionSets.map((rs, i) => ({
    fileName: fileNames[i],
    regions: rs.numberOfRegions,
    meanWidth: rs.meanRegionWidth,
    nucleotides: rs.nucleotidesLength,
  }));

  const chrCounts: ChrRegionCount[] = [];
  for (let i = 0; i < n; i++) {
    const total = fileStats[i].regions;
    const calc = regionSets[i].chromosomeStatistics();
    if (calc) {
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
  }

  // Width distributions (per-file, binned on log scale)
  const widthHist: WidthHistPoint[] = [];
  for (let i = 0; i < n; i++) {
    try {
      const widths = sets[i].calcWidths() as number[];
      widthHist.push(...binWidths(Array.from(widths), fileNames[i]));
    } catch { /* calcWidths not available */ }
  }

  onProgress?.(0.05);
  await yieldToMain();

  // --- 5–45%: pairwise Jaccard + overlap fractions ---
  const jaccardMatrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  const overlapMatrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    jaccardMatrix[i][i] = 1;
    overlapMatrix[i][i] = 100;
  }

  const totalPairs = (n * (n - 1)) / 2;
  let pairsDone = 0;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      // Jaccard (symmetric)
      const jVal = sets[i].jaccard(sets[j]) as number;
      jaccardMatrix[i][j] = jVal;
      jaccardMatrix[j][i] = jVal;

      // Overlap fractions (asymmetric) via pintersect
      const inter = sets[i].pintersect(sets[j]) as RegionSet;
      const interCount = inter.numberOfRegions;
      freeRs(inter);

      const countI = fileStats[i].regions;
      const countJ = fileStats[j].regions;
      overlapMatrix[i][j] = countI > 0 ? (interCount / countI) * 100 : 0;
      overlapMatrix[j][i] = countJ > 0 ? (interCount / countJ) * 100 : 0;

      pairsDone++;
      onProgress?.(0.05 + 0.4 * (pairsDone / totalPairs));
      await yieldToMain();
    }
  }

  // --- 45–60%: consensus ---
  let consensus: ConsensusRegion[] = [];

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gtars = await import('@databio/gtars') as any;
    if (typeof gtars.ConsensusBuilder === 'function') {
      const builder = new gtars.ConsensusBuilder();
      for (const rs of regionSets) {
        builder.add(rs);
      }
      onProgress?.(0.55);
      await yieldToMain();

      const raw = builder.compute() as Array<{ chr: string; start: number; end: number; count: number }>;
      consensus = raw;
      try { builder.free?.(); } catch { /* */ }
    }
  } catch (err) { console.warn('ConsensusBuilder failed:', err); }

  onProgress?.(0.6);
  await yieldToMain();

  // --- 60–80%: union / intersection via left fold ---
  let unionStats: MultiFileResult['unionStats'] = null;
  let intersectionStats: MultiFileResult['intersectionStats'] = null;
  let unionRs: RegionSet | null = null;

  if (n >= 2 && typeof sets[0].union === 'function') {
    try {
      let acc: RegionSet = sets[0].union(sets[1]) as RegionSet;
      for (let i = 2; i < n; i++) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const next = (acc as any).union(sets[i]) as RegionSet;
        freeRs(acc);
        acc = next;
      }
      unionStats = {
        regions: acc.numberOfRegions,
        nucleotides: acc.nucleotidesLength,
      };
      unionRs = acc; // keep for setdiff below
    } catch (err) { console.warn('Union failed:', err); }

    onProgress?.(0.7);
    await yieldToMain();

    try {
      let acc: RegionSet = sets[0].pintersect(sets[1]) as RegionSet;
      for (let i = 2; i < n; i++) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const next = (acc as any).pintersect(sets[i]) as RegionSet;
        freeRs(acc);
        acc = next;
      }
      intersectionStats = {
        regions: acc.numberOfRegions,
        nucleotides: acc.nucleotidesLength,
      };
      freeRs(acc);
    } catch (err) { console.warn('Intersection failed:', err); }
  }

  onProgress?.(0.8);
  await yieldToMain();

  // --- 80–100%: per-file breakdown (unique via setdiff) ---
  const perFile: FileBreakdown[] = [];
  const hasSetdiff = typeof sets[0]?.setdiff === 'function';

  for (let i = 0; i < n; i++) {
    let unique = 0;
    let shared = 0;

    if (hasSetdiff && n >= 2) {
      // Build union of all OTHER files
      const others = sets.filter((_: unknown, idx: number) => idx !== i);
      try {
        let othersUnion: RegionSet = others[0].union(others[1 % others.length]) as RegionSet;
        for (let k = 1; k < others.length; k++) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const next = (othersUnion as any).union(others[k]) as RegionSet;
          freeRs(othersUnion);
          othersUnion = next;
        }

        // Unique = this file minus all others
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const diff = (sets[i] as any).setdiff(othersUnion) as RegionSet;
        unique = diff.numberOfRegions;
        freeRs(diff);
        freeRs(othersUnion);

        shared = fileStats[i].regions - unique;
      } catch (err) {
        console.warn(`setdiff failed for file ${i}:`, err);
        shared = fileStats[i].regions;
      }
    } else {
      shared = fileStats[i].regions;
    }

    perFile.push({
      fileName: fileStats[i].fileName,
      regions: fileStats[i].regions,
      shared,
      unique,
      overlapPct: fileStats[i].regions > 0 ? (shared / fileStats[i].regions) * 100 : 0,
    });

    onProgress?.(0.8 + 0.2 * ((i + 1) / n));
    await yieldToMain();
  }

  // Free the union RS we kept
  if (unionRs) freeRs(unionRs);

  onProgress?.(1);
  return { fileStats, jaccardMatrix, overlapMatrix, perFile, chrCounts, widthHist, positionalBins: [], consensus, unionStats, intersectionStats };
}
