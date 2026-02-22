import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useApi } from '../contexts/api-context';
import type { components } from '../bedbase-types';

type BedMetadataAll = components['schemas']['BedMetadataAll'];

export type Breakdown = { label: string; count: number };

export type SelectionStats = {
  loaded: number;
  queried: number;

  // Composition breakdowns
  genomes: Breakdown[];
  assays: Breakdown[];
  cellTypes: Breakdown[];
  tissues: Breakdown[];
  targets: Breakdown[];

  // Per-file stat distributions (sorted arrays for charts)
  regionCounts: number[];
  widths: number[];
  gcValues: number[];
  tssDistances: number[];

  // Averaged stats
  avgRegions: number | null;
  avgGc: number | null;
  avgWidth: number | null;
  avgTssDist: number | null;

  // Partition averages
  avgExonPct: number | null;
  avgIntronPct: number | null;
  avgIntergenicPct: number | null;
  avgPromoterPct: number | null;
};

function avg(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function countBy(values: (string | undefined | null)[]): Breakdown[] {
  const map = new Map<string, number>();
  for (const v of values) {
    if (!v) continue;
    map.set(v, (map.get(v) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

function collectStat(
  results: BedMetadataAll[],
  key: keyof NonNullable<BedMetadataAll['stats']>,
): number[] {
  const values: number[] = [];
  for (const r of results) {
    const v = r.stats?.[key];
    if (v != null) values.push(v);
  }
  return values;
}

/** Fetch metadata for the given bedIds and aggregate stats. Pass the visible page slice. */
export function useSelectionStats(bedIds: string[]) {
  const { api } = useApi();

  const queries = useQueries({
    queries: bedIds.map((id) => ({
      queryKey: ['bed-metadata', id],
      queryFn: async () => {
        const { data } = await api.get<BedMetadataAll>(`/bed/${id}/metadata`, {
          params: { full: true },
        });
        return data;
      },
      staleTime: Infinity,
    })),
  });

  const loaded = queries.filter((q) => q.isSuccess).length;
  const isLoading = queries.some((q) => q.isLoading) && bedIds.length > 0;
  const idsKey = bedIds.join(',');

  const stats = useMemo<SelectionStats>(() => {
    const results = queries.filter((q) => q.data).map((q) => q.data!);

    const regionCounts = collectStat(results, 'number_of_regions');
    const widths = collectStat(results, 'mean_region_width');
    const gcValues = collectStat(results, 'gc_content');
    const tssDistances = collectStat(results, 'median_tss_dist');

    return {
      loaded,
      queried: bedIds.length,

      genomes: countBy(results.map((r) => r.genome_alias)),
      assays: countBy(results.map((r) => r.annotation?.assay)),
      cellTypes: countBy(results.map((r) => r.annotation?.cell_type)),
      tissues: countBy(results.map((r) => r.annotation?.tissue)),
      targets: countBy(results.map((r) => r.annotation?.target)),

      regionCounts: [...regionCounts].sort((a, b) => a - b),
      widths: [...widths].sort((a, b) => a - b),
      gcValues: [...gcValues].sort((a, b) => a - b),
      tssDistances: [...tssDistances].sort((a, b) => a - b),

      avgRegions: avg(regionCounts),
      avgGc: avg(gcValues),
      avgWidth: avg(widths),
      avgTssDist: avg(tssDistances),
      avgExonPct: avg(collectStat(results, 'exon_percentage')),
      avgIntronPct: avg(collectStat(results, 'intron_percentage')),
      avgIntergenicPct: avg(collectStat(results, 'intergenic_percentage')),
      avgPromoterPct: avg(collectStat(results, 'promotercore_percentage')),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, idsKey]);

  return { stats, isLoading };
}
