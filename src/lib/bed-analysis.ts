import type { RegionSet, ChromosomeStatistics } from '@databio/gtars';

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
  id?: string; // database bed file ID (e.g. md5 hash)
  fileName?: string;
  fileSize?: number;
  parseTime?: number;

  // Summary stats (both sources)
  summary: {
    regions: number;
    meanRegionWidth: number;
    nucleotides: number;
    dataFormat: string | null;
    bedCompliance: string | null;
  };

  // Overview metadata (database only — species, cell line, assay, etc.)
  metadata?: {
    species?: string;
    cellLine?: string;
    assay?: string;
    antibody?: string;
    tissue?: string;
    description?: string;
  };

  // Table data
  chromosomeStats: ChromosomeRow[];

  // Plot data — keyed by plot ID, each holds raw data for spec builders
  plots: {
    regionDistribution?: DistributionPoint[];
    // Future: gcContent, partitions, widthsHistogram, neighborDistances,
    // openChromatin, tssDistance, cumulativePartitions
  };
};

// --- Producers ---

export function fromRegionSet(
  rs: RegionSet,
  file: File,
  parseTime: number | null,
): BedAnalysis {
  const classify = rs.classify;

  // Chromosome stats
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

  // Region distribution
  const regionDistribution = (rs.regionDistribution(300) as DistributionPoint[]) ?? [];

  return {
    source: 'local',
    fileName: file.name,
    fileSize: file.size,
    parseTime: parseTime ?? undefined,
    summary: {
      regions: rs.numberOfRegions,
      meanRegionWidth: rs.meanRegionWidth,
      nucleotides: rs.nucleotidesLength,
      dataFormat: classify?.data_format ?? null,
      bedCompliance: classify?.bed_compliance ?? null,
    },
    chromosomeStats,
    plots: {
      regionDistribution: regionDistribution.length > 0 ? regionDistribution : undefined,
    },
  };
}
