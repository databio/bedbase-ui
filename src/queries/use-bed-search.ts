import { useQuery } from '@tanstack/react-query';
import type { components } from '../bedbase-types';
import { useApi } from '../contexts/api-context';

type SearchResponse = components['schemas']['BedListSearchResult'];

export function useBedSearch(
  file: File | undefined,
  opts?: { limit?: number; offset?: number },
) {
  const { api } = useApi();
  return useQuery({
    queryKey: ['bed-search', file?.name, file?.lastModified, opts?.limit, opts?.offset],
    queryFn: async () => {
      if (!file) throw new Error('No file provided');
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post<SearchResponse>(
        `/bed/search/bed?limit=${opts?.limit ?? 10}&offset=${opts?.offset ?? 0}`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      return data;
    },
    enabled: !!file,
    staleTime: 0,
  });
}
