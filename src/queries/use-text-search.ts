import { useQuery } from '@tanstack/react-query';
import type { components } from '../bedbase-types';
import { useApi } from '../contexts/api-context';

type SearchResponse = components['schemas']['BedListSearchResult'];

export function useTextSearch(
  query: string,
  opts?: {
    limit?: number;
    offset?: number;
    genome?: string;
    assay?: string;
    enabled?: boolean;
  },
) {
  const { api } = useApi();
  return useQuery({
    queryKey: ['text-search', query, opts?.limit, opts?.offset, opts?.genome, opts?.assay],
    queryFn: async () => {
      const params: Record<string, string | number> = {
        query,
        limit: opts?.limit ?? 10,
        offset: opts?.offset ?? 0,
      };
      if (opts?.genome) params.genome = opts.genome;
      if (opts?.assay) params.assay = opts.assay;
      const { data } = await api.get<SearchResponse>('/bed/search/text', { params });
      return data;
    },
    enabled: opts?.enabled !== false && !!query,
  });
}
