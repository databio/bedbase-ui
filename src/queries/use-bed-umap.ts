import { useMutation } from '@tanstack/react-query';
import { useApi } from '../contexts/api-context';

export function useBedUmap() {
  const { api } = useApi();
  return useMutation({
    mutationFn: async (file: File): Promise<number[]> => {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post<number[]>('/bed/umap', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    },
  });
}
