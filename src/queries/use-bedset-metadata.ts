import { useQuery } from '@tanstack/react-query';
import type { components } from '../bedbase-types';
import { useApi } from '../contexts/api-context';

type BedSetMetadata = components['schemas']['BedSetMetadata'];

export function useBedsetMetadata(bedsetId: string | undefined) {
  const { api } = useApi();
  return useQuery({
    queryKey: ['bedset-metadata', bedsetId],
    queryFn: async () => {
      const { data } = await api.get<BedSetMetadata>(`/bedset/${bedsetId}/metadata`);
      return data;
    },
    enabled: !!bedsetId,
  });
}
