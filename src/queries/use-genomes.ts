import { useQuery } from '@tanstack/react-query';
import type { components } from '../bedbase-types';
import { useApi } from '../contexts/api-context';

type ListResponse = components['schemas']['BaseListResponse'];

export function useGenomes() {
  const { api } = useApi();
  return useQuery({
    queryKey: ['genomes'],
    queryFn: async () => {
      const { data } = await api.get<ListResponse>('/genomes');
      return data.results as string[];
    },
  });
}
