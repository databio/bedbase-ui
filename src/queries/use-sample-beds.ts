import { useQuery } from '@tanstack/react-query';
import type { components } from '../bedbase-types';
import { useApi } from '../contexts/api-context';

type BedListResult = components['schemas']['BedListResult'];

export function useSampleBeds(limit = 3) {
  const { api } = useApi();
  return useQuery({
    queryKey: ['sample-beds', limit],
    queryFn: async () => {
      const { data } = await api.get<BedListResult>('/bed/list', {
        params: { limit },
      });
      return data.results;
    },
  });
}
