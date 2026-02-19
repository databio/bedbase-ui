import { useQuery } from '@tanstack/react-query';
import type { components } from '../bedbase-types';
import { useApi } from '../contexts/api-context';

type BedMetadataAll = components['schemas']['BedMetadataAll'];

export function useBedMetadata(bedId: string | undefined) {
  const { api } = useApi();
  return useQuery({
    queryKey: ['bed-metadata', bedId],
    queryFn: async () => {
      const { data } = await api.get<BedMetadataAll>(`/bed/${bedId}/metadata`, {
        params: { full: true },
      });
      return data;
    },
    enabled: !!bedId,
  });
}
