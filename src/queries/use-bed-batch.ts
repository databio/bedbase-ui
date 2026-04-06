import { useQuery } from '@tanstack/react-query';
import { useApi } from '../contexts/api-context';

type BedStatsModel = {
  number_of_regions?: number | null;
  gc_content?: number | null;
  median_tss_dist?: number | null;
  mean_region_width?: number | null;
};

export type BatchBedResult = {
  id: string;
  name?: string | null;
  genome_alias?: string | null;
  stats?: BedStatsModel | null;
};

type BatchResponse = {
  count: number;
  results: BatchBedResult[];
};

export function useBedBatch(bedIds: string[] | undefined) {
  const { api } = useApi();
  return useQuery({
    queryKey: ['bed-batch', bedIds],
    queryFn: async () => {
      const { data } = await api.post<BatchResponse>('/bed/batch', { ids: bedIds });
      return data.results;
    },
    enabled: !!bedIds && bedIds.length > 0,
  });
}
