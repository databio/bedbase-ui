import { useQuery } from '@tanstack/react-query';
import type { components } from '../bedbase-types';
import { useApi } from '../contexts/api-context';

type RefGenValidReturnModel = components['schemas']['RefGenValidReturnModel'];

export function useGenomeStats(bedId: string | undefined) {
  const { api } = useApi();
  return useQuery({
    queryKey: ['genome-stats', bedId],
    queryFn: async () => {
      const { data } = await api.get<RefGenValidReturnModel>(`/bed/${bedId}/genome-stats`);
      return data;
    },
    enabled: !!bedId,
  });
}
