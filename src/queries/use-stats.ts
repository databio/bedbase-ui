import { useQuery } from '@tanstack/react-query';
import type { components } from '../bedbase-types';
import { useApi } from '../contexts/api-context';

type StatsResponse = components['schemas']['StatsReturn'];

export function useStats() {
  const { api } = useApi();
  return useQuery({
    queryKey: ['stats'],
    queryFn: async () => {
      const { data } = await api.get<StatsResponse>('/stats');
      return data;
    },
  });
}
