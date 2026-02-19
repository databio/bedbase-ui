import { useQuery } from '@tanstack/react-query';
import type { components } from '../bedbase-types';
import { useApi } from '../contexts/api-context';

type UsageStats = components['schemas']['UsageStats'];

export function useDetailedUsage() {
  const { api } = useApi();
  return useQuery({
    queryKey: ['detailed-usage'],
    queryFn: async () => {
      const { data } = await api.get<UsageStats>('/detailed-usage');
      return data;
    },
  });
}
