import { useQuery } from '@tanstack/react-query';
import type { components } from '../bedbase-types';
import { useApi } from '../contexts/api-context';

type BedSetBedFiles = components['schemas']['BedSetBedFiles'];

export function useBedsetBedfiles(bedsetId: string | undefined) {
  const { api } = useApi();
  return useQuery({
    queryKey: ['bedset-bedfiles', bedsetId],
    queryFn: async () => {
      const { data } = await api.get<BedSetBedFiles>(`/bedset/${bedsetId}/bedfiles`);
      return data;
    },
    enabled: !!bedsetId,
  });
}
