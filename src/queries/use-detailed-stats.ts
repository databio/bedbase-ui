import { useQuery } from '@tanstack/react-query';
import type { components } from '../bedbase-types';
import { useApi } from '../contexts/api-context';

type FileStats = components['schemas']['FileStats'];

export function useDetailedStats() {
  const { api } = useApi();
  return useQuery({
    queryKey: ['detailed-stats'],
    queryFn: async () => {
      const { data } = await api.get<FileStats>('/detailed-stats', {
        params: { concise: true },
      });
      return data;
    },
  });
}
