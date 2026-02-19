import { useQuery } from '@tanstack/react-query';
import type { components } from '../bedbase-types';
import { useApi } from '../contexts/api-context';

type BedSetListResult = components['schemas']['BedSetListResult'];

export function useBedsetList(opts?: {
  query?: string;
  limit?: number;
  offset?: number;
}) {
  const { api } = useApi();
  return useQuery({
    queryKey: ['bedset-list', opts?.query, opts?.limit, opts?.offset],
    queryFn: async () => {
      const params: Record<string, string | number> = {
        query: opts?.query ?? '',
        limit: opts?.limit ?? 10,
        offset: opts?.offset ?? 0,
      };
      const { data } = await api.get<BedSetListResult>('/bedset/list', { params });
      return data;
    },
  });
}
