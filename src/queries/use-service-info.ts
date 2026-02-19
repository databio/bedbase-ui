import { useQuery } from '@tanstack/react-query';
import type { components } from '../bedbase-types';
import { useApi } from '../contexts/api-context';

type ServiceInfoResponse = components['schemas']['ServiceInfoResponse'];

export function useServiceInfo() {
  const { api } = useApi();
  return useQuery({
    queryKey: ['service-info'],
    queryFn: async () => {
      const { data } = await api.get<ServiceInfoResponse>('/service-info');
      return data;
    },
  });
}
