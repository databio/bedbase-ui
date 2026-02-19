import { useQuery } from '@tanstack/react-query';
import type { components } from '../bedbase-types';
import { useApi } from '../contexts/api-context';

type ListResponse = components['schemas']['BaseListResponse'];

export function useAssays() {
  const { api } = useApi();
  return useQuery({
    queryKey: ['assays'],
    queryFn: async () => {
      const { data } = await api.get<ListResponse>('/assays');
      return data.results as string[];
    },
  });
}
