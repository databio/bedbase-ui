import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useApi } from '../contexts/api-context';
import { useBedSearch } from './use-bed-search';
import type { components } from '../bedbase-types';

type BedMetadataAll = components['schemas']['BedMetadataAll'];

export type AggregatedBedset = {
  id: string;
  name: string;
  description: string;
  count: number;
  total: number;
};

export function useRelatedBedsets(file: File | undefined, enabled = true) {
  const { api } = useApi();

  // Hop 1: BED-to-BED similarity search (reuses useBedSearch cache)
  const { data: searchResults, isLoading: isSearching } = useBedSearch(
    enabled ? file : undefined,
    { limit: 10 },
  );

  const neighborIds = useMemo(
    () =>
      searchResults?.results
        ?.map((r) => r.metadata?.id)
        .filter((id): id is string => !!id) ?? [],
    [searchResults],
  );

  // Hop 2: Fetch full metadata for each neighbor in parallel
  // Shares cache key ['bed-metadata', id] with useBedMetadata
  const metadataQueries = useQueries({
    queries: neighborIds.map((id) => ({
      queryKey: ['bed-metadata', id],
      queryFn: async () => {
        const { data } = await api.get<BedMetadataAll>(`/bed/${id}/metadata`, {
          params: { full: true },
        });
        return data;
      },
    })),
  });

  const totalNeighbors = neighborIds.length;
  const neighborsLoaded = metadataQueries.filter((q) => q.isSuccess).length;
  const isLoadingMetadata =
    metadataQueries.some((q) => q.isLoading) && neighborIds.length > 0;

  // Aggregate bedsets across all neighbor metadata
  const data = useMemo(() => {
    const bedsetMap = new Map<string, { name: string; description: string; count: number }>();

    for (const query of metadataQueries) {
      if (query.data?.bedsets) {
        for (const bedset of query.data.bedsets) {
          const existing = bedsetMap.get(bedset.id);
          if (existing) {
            existing.count++;
          } else {
            bedsetMap.set(bedset.id, {
              name: bedset.name || bedset.id,
              description: bedset.description || '',
              count: 1,
            });
          }
        }
      }
    }

    return Array.from(bedsetMap.entries())
      .map(([id, { name, description, count }]) => ({
        id,
        name,
        description,
        count,
        total: totalNeighbors,
      }))
      .sort((a, b) => b.count - a.count);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [neighborsLoaded, totalNeighbors]);

  return { data, isSearching, isLoadingMetadata, totalNeighbors, neighborsLoaded };
}
