import type { RegionSet, ChromosomeStatistics } from '@databio/gtars';
import type { components } from '../bedbase-types';
import type { PlotSlot } from './plot-specs';
import type { CompressedDistributions } from '../components/analysis/plots/compressed-plots';
import { fileModelToUrl, fileModelToPlotSlot } from './file-model-utils';

type BedMetadataAll = components['schemas']['BedMetadataAll'];

export const REGION_DIST_BINS = 250;

// --- Normalized data types consumed by all analysis panels ---

export type ChromosomeRow = {
  chromosome: string;
  count: number;
  start: number;
  end: number;
  min: number;
  max: number;
  mean: number;
  median: number;
};

export type DistributionPoint = {
  chr: string;
  start: number;
  end: number;
  n: number;
  rid: number;
};

export type GenomicDistResult = {
  widths: number[];
  neighborDistances: number[] | null;
  nearestNeighbors: unknown[] | null;
  reducedCount: number;
  promotersCount: number;
};

export type PartitionRow = { name: string; count: number };
export type ExpectedPartitionRow = {
  partition: string;
  observed: number;
  expected: number;
  log10Oe: number;
  pvalue: number;
};

export type RefGenomicDistResult = {
  genome: string;
  tssDistances: (number | null)[];
  featureDistances: (number | null)[];
  partitions: { partitions: PartitionRow[]; total: number } | null;
  expectedPartitions: ExpectedPartitionRow[] | null;
};

export type BedAnalysis = {
  source: 'local' | 'database';

  // Identity
  id?: string;
  fileName?: string;
  fileSize?: number;
  parseTime?: number;

  // Summary stats (both sources)
  summary: {
    regions: number;
    meanRegionWidth: number;
    nucleotides: number;
    gcContent?: number;
    medianTssDist?: number;
    dataFormat: string | null;
    bedCompliance: string | null;
  };

  // Overview metadata (database only)
  metadata?: {
    species?: string;
    speciesId?: string;
    cellLine?: string;
    cellType?: string;
    assay?: string;
    antibody?: string;
    target?: string;
    tissue?: string;
    treatment?: string;
    librarySource?: string;
    description?: string;
    globalSampleId?: string;
    globalExperimentId?: string;
    originalFileName?: string;
  };

  // Genomic feature percentages (database only)
  genomicFeatures?: {
    exon: number;
    intron: number;
    intergenic: number;
    promoterCore: number;
    promoterProx: number;
    fiveUtr: number;
    threeUtr: number;
  };

  // Table data
  chromosomeStats: ChromosomeRow[];

  // Plot data — keyed by plot ID, each holds raw data for spec builders
  plots: {
    regionDistribution?: DistributionPoint[];
  };

  // New genomicdist results (local only)
  genomicdist?: GenomicDistResult;

  // Database only — compressed distributions from server (preferred over serverPlots)
  compressedDistributions?: CompressedDistributions;
  // Database only — image-based plots from server (fallback when distributions absent)
  serverPlots?: PlotSlot[];
  bedsets?: { id: string; name: string; description?: string }[];
  genomeAlias?: string;
  genomeDigest?: string;
  downloadUrls?: { bed?: string; bigBed?: string };
  submissionDate?: string;
  lastUpdateDate?: string;
  isUniverse?: boolean;
  licenseId?: string;
};

// --- Helpers ---

function nonEmpty(s: string | null | undefined): string | undefined {
  return s && s.trim() ? s.trim() : undefined;
}

// --- Producers ---

export function fromApiResponse(data: BedMetadataAll): BedAnalysis {
  const { stats, plots, files, annotation } = data;

  // Extract compressed distributions (not in generated types yet — cast through any)
  const compressedDistributions =
    (stats as Record<string, unknown> | undefined)?.distributions as CompressedDistributions | undefined;

  // Build server plot slots (fallback when compressed distributions are absent)
  const serverPlots: PlotSlot[] = [];
  if (!compressedDistributions && plots) {
    const plotEntries: [string, string][] = [
      ['chrombins', 'Chromosome bins'],
      ['gccontent', 'GC content'],
      ['partitions', 'Partitions'],
      ['cumulative_partitions', 'Cumulative partitions'],
      ['widths_histogram', 'Region widths'],
      ['neighbor_distances', 'Neighbor distances'],
      ['open_chromatin', 'Open chromatin'],
      ['tss_distance', 'TSS distance'],
    ];
    for (const [key, title] of plotEntries) {
      const fm = plots[key as keyof typeof plots];
      const slot = fileModelToPlotSlot(fm, key, fm?.title ?? title);
      if (slot) serverPlots.push(slot);
    }
  }

  // Build genomic features if any percentage data exists
  const hasFeatures =
    stats?.exon_percentage != null ||
    stats?.intron_percentage != null ||
    stats?.intergenic_percentage != null;

  const genomicFeatures = hasFeatures
    ? {
        exon: stats?.exon_percentage ?? 0,
        intron: stats?.intron_percentage ?? 0,
        intergenic: stats?.intergenic_percentage ?? 0,
        promoterCore: stats?.promotercore_percentage ?? 0,
        promoterProx: stats?.promoterprox_percentage ?? 0,
        fiveUtr: stats?.fiveutr_percentage ?? 0,
        threeUtr: stats?.threeutr_percentage ?? 0,
      }
    : undefined;

  // Build bedsets
  const bedsets = data.bedsets?.map((bs) => ({
    id: bs.id,
    name: bs.name ?? bs.id,
    description: bs.description ?? undefined,
  }));

  return {
    source: 'database',
    id: data.id,
    fileName: data.name || undefined,
    summary: {
      regions: stats?.number_of_regions ?? 0,
      meanRegionWidth: stats?.mean_region_width ?? 0,
      nucleotides: 0,
      gcContent: stats?.gc_content ?? undefined,
      medianTssDist: stats?.median_tss_dist ?? undefined,
      dataFormat: data.data_format ?? null,
      bedCompliance: data.bed_compliance ?? null,
    },
    metadata: annotation
      ? {
          species: nonEmpty((annotation as Record<string, unknown>).species_name as string) || nonEmpty(annotation.organism),
          speciesId: nonEmpty(annotation.species_id),
          cellLine: nonEmpty(annotation.cell_line),
          cellType: nonEmpty(annotation.cell_type),
          assay: nonEmpty(annotation.assay),
          antibody: nonEmpty(annotation.antibody),
          target: nonEmpty(annotation.target),
          tissue: nonEmpty(annotation.tissue),
          treatment: nonEmpty(annotation.treatment),
          librarySource: nonEmpty(annotation.library_source),
          description: nonEmpty(data.description),
          globalSampleId: nonEmpty(Array.isArray(annotation.global_sample_id) ? annotation.global_sample_id.filter(Boolean).join(', ') : String(annotation.global_sample_id ?? '')),
          globalExperimentId: nonEmpty(Array.isArray(annotation.global_experiment_id) ? annotation.global_experiment_id.filter(Boolean).join(', ') : String(annotation.global_experiment_id ?? '')),
          originalFileName: nonEmpty((annotation as Record<string, unknown>).original_file_name as string),
        }
      : data.description
        ? { description: nonEmpty(data.description) }
        : undefined,
    genomicFeatures,
    chromosomeStats: [],
    plots: {},
    compressedDistributions: compressedDistributions || undefined,
    serverPlots: serverPlots.length > 0 ? serverPlots : undefined,
    bedsets: bedsets && bedsets.length > 0 ? bedsets : undefined,
    genomeAlias: data.genome_alias || undefined,
    genomeDigest: data.genome_digest || undefined,
    downloadUrls: {
      bed: fileModelToUrl(files?.bed_file),
      bigBed: fileModelToUrl(files?.bigbed_file),
    },
    submissionDate: data.submission_date,
    lastUpdateDate: data.last_update_date ?? undefined,
    isUniverse: data.is_universe ?? undefined,
    licenseId: data.license_id ?? undefined,
  };
}

/**
 * Build a BedAnalysis from a RegionSet in steps, yielding between each
 * so the browser can repaint and update a progress bar.
 *
 * @param onProgress - called with 0–1 between steps
 */
export async function fromRegionSet(
  rs: RegionSet,
  file: File,
  parseTime: number | null,
  onProgress?: (p: number) => void,
): Promise<BedAnalysis> {
  // Step 1: basic stats + classify (~instant)
  const classify = rs.classify;
  const summary = {
    regions: rs.numberOfRegions,
    meanRegionWidth: rs.meanRegionWidth,
    nucleotides: rs.nucleotidesLength,
    dataFormat: classify?.data_format ?? null,
    bedCompliance: classify?.bed_compliance ?? null,
  };
  onProgress?.(0.2);
  await yieldToMain();

  // Step 2: chromosome statistics (~heavy)
  const chromosomeStats: ChromosomeRow[] = [];
  const calc = rs.chromosomeStatistics();
  if (calc) {
    for (const entry of Array.from(calc.entries())) {
      const [chrom, stats] = entry as [unknown, ChromosomeStatistics];
      chromosomeStats.push({
        chromosome: String(chrom),
        count: stats.number_of_regions,
        start: stats.start_nucleotide_position,
        end: stats.end_nucleotide_position,
        min: stats.minimum_region_length,
        max: stats.maximum_region_length,
        mean: stats.mean_region_length,
        median: stats.median_region_length,
      });
      try {
        (stats as unknown as { free?: () => void }).free?.();
      } catch {
        /* ignore */
      }
    }
    chromosomeStats.sort((a, b) =>
      a.chromosome.localeCompare(b.chromosome, undefined, { numeric: true, sensitivity: 'base' }),
    );
  }
  onProgress?.(0.7);
  await yieldToMain();

  // Step 3: region distribution (~heavy)
  const regionDistribution = (rs.regionDistribution(REGION_DIST_BINS) as DistributionPoint[]) ?? [];
  onProgress?.(0.85);
  await yieldToMain();

  // Step 4: genomicdist functions (local WASM only — types not in npm package yet)
  let genomicdist: GenomicDistResult | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rsAny = rs as any;
  try {
    const widths: number[] = Array.from(rsAny.calcWidths());

    let neighborDistances: number[] | null = null;
    try {
      neighborDistances = rsAny.calcNeighborDistances() as number[];
    } catch {
      /* may fail for single-region chromosomes */
    }

    let nearestNeighbors: unknown[] | null = null;
    try {
      nearestNeighbors = rsAny.calcNearestNeighbors() as unknown[];
    } catch {
      /* may fail for single-region chromosomes */
    }

    const reduced = rsAny.reduce() as RegionSet;
    const reducedCount = reduced.numberOfRegions;
    try {
      (reduced as unknown as { free?: () => void }).free?.();
    } catch { /* ignore */ }

    const proms = rsAny.promoters(2000, 200) as RegionSet;
    const promotersCount = proms.numberOfRegions;
    try {
      (proms as unknown as { free?: () => void }).free?.();
    } catch { /* ignore */ }

    genomicdist = { widths, neighborDistances, nearestNeighbors, reducedCount, promotersCount };
  } catch {
    /* genomicdist not available — likely using npm build without these functions */
  }
  onProgress?.(1);

  return {
    source: 'local',
    fileName: file.name,
    fileSize: file.size,
    parseTime: parseTime ?? undefined,
    summary,
    chromosomeStats,
    plots: {
      regionDistribution: regionDistribution.length > 0 ? regionDistribution : undefined,
    },
    genomicdist,
  };
}

/** Yield to the main thread so the browser can repaint */
function yieldToMain(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// --- Reference-data-dependent genomicdist computation ---

import {
  loadRefBase,
  loadRefGeneModel,
  columnsToTuples,
  columnsToStrandedTuples,
} from './reference-data';

/**
 * Compute genomicdist results that require reference annotation data
 * (TSS distances, partitions, expected partitions).
 *
 * Called after genome detection identifies the assembly.
 */
export async function computeRefGenomicdist(
  rs: RegionSet,
  genome: string,
): Promise<RefGenomicDistResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rsAny = rs as any;

  // --- TSS distances (base file only, ~160 KB) ---
  const refBase = await loadRefBase(genome);

  const tssTuples = columnsToTuples(refBase.tss);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { RegionSet: RS, TssIndex } = await import('@databio/gtars') as any;
  const tssRs = new RS(tssTuples);
  const tssIndex = new TssIndex(tssRs);

  const tssDistances = tssIndex.calcTssDistances(rs) as (number | null)[];
  const featureDistances = tssIndex.calcFeatureDistances(rs) as (number | null)[];

  try { tssIndex.free?.(); } catch { /* */ }
  try { tssRs.free?.(); } catch { /* */ }

  await yieldToMain();

  // --- Partitions (gene model file, ~2.9 MB) ---
  let partitions: RefGenomicDistResult['partitions'] = null;
  let expectedPartitions: RefGenomicDistResult['expectedPartitions'] = null;

  try {
    const refGM = await loadRefGeneModel(genome);

    const genesTuples = columnsToStrandedTuples(refGM.genes);
    const exonsTuples = columnsToTuples(refGM.exons);
    const threeUtrTuples = columnsToTuples(refGM.threeUtr);
    const fiveUtrTuples = columnsToTuples(refGM.fiveUtr);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gtars = await import('@databio/gtars') as any;
    const geneModel = new gtars.GeneModel(
      genesTuples, exonsTuples, threeUtrTuples, fiveUtrTuples,
    );
    const partitionList = gtars.PartitionList.fromGeneModel(
      geneModel, 200, 2000, refBase.chromSizes,
    );

    await yieldToMain();

    partitions = rsAny.constructor?.calcPartitions
      ? gtars.calcPartitions(rs, partitionList, false)
      : null;

    // If calcPartitions isn't a free function, try direct call
    if (!partitions) {
      partitions = gtars.calcPartitions(rs, partitionList, false);
    }

    await yieldToMain();

    expectedPartitions = gtars.calcExpectedPartitions(
      rs, partitionList, refBase.chromSizes, false,
    ) as ExpectedPartitionRow[] | null;

    try { partitionList.free?.(); } catch { /* */ }
    try { geneModel.free?.(); } catch { /* */ }
  } catch {
    /* gene model fetch or partition computation failed */
  }

  return {
    genome,
    tssDistances,
    featureDistances,
    partitions,
    expectedPartitions,
  };
}
