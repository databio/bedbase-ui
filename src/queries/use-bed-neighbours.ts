import { useQuery } from '@tanstack/react-query';
import type { components } from '../bedbase-types';
import { useApi } from '../contexts/api-context';

type SearchResponse = components['schemas']['BedListSearchResult'];

export function useBedNeighbours(bedId: string | undefined, limit = 10) {
  const { api } = useApi();
  return useQuery({
    queryKey: ['bed-neighbours', bedId, limit],
    queryFn: async () => {
      const { data } = await api.get<SearchResponse>(`/bed/${bedId}/neighbours`, {
        params: { limit },
      });
      return data;
    },
    enabled: !!bedId,
  });
}
