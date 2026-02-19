import { useQuery } from '@tanstack/react-query';
import type { components } from '../bedbase-types';
import { useApi } from '../contexts/api-context';

type RefGenValidReturnModel = components['schemas']['RefGenValidReturnModel'];

export function useAnalyzeGenome(bedFile: Record<string, number> | undefined) {
  const { api } = useApi();
  return useQuery({
    queryKey: ['analyze-genome', bedFile],
    queryFn: async () => {
      const { data } = await api.post<RefGenValidReturnModel>('/bed/analyze-genome', {
        bed_file: bedFile,
      });
      return data;
    },
    enabled: !!bedFile && Object.keys(bedFile).length > 0,
  });
}
