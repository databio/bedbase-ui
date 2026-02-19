import type { RegionSet, ChromosomeStatistics } from '@databio/gtars';
import type { components } from '../bedbase-types';
import type { PlotSlot } from './plot-specs';
import { fileModelToUrl, fileModelToPlotSlot } from './file-model-utils';

type BedMetadataAll = components['schemas']['BedMetadataAll'];

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

  // Database only — image-based plots from server
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

  // Build server plot slots
  const serverPlots: PlotSlot[] = [];
  if (plots) {
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
          globalSampleId: annotation.global_sample_id?.filter(Boolean).join(', ') || undefined,
          globalExperimentId: annotation.global_experiment_id?.filter(Boolean).join(', ') || undefined,
          originalFileName: nonEmpty((annotation as Record<string, unknown>).original_file_name as string),
        }
      : data.description
        ? { description: nonEmpty(data.description) }
        : undefined,
    genomicFeatures,
    chromosomeStats: [],
    plots: {},
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
  const regionDistribution = (rs.regionDistribution(300) as DistributionPoint[]) ?? [];
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
  };
}

/** Yield to the main thread so the browser can repaint */
function yieldToMain(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
