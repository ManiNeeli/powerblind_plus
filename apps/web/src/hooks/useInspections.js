import { useApi, useMutation } from './useApi';
import { api } from '../lib/api';

export function useInspections({ page = 1, limit = 25, status } = {}) {
  const params = new URLSearchParams({ page, limit });
  if (status) params.set('status', status);

  const { data, loading, error, refetch } = useApi(`/api/inspections?${params}`);
  return {
    inspections: data?.inspections ?? [],
    total:       data?.total       ?? 0,
    loading, error, refetch,
  };
}

export function useLogInspection() {
  const { mutate, loading, error } = useMutation();

  const logInspection = (consumerId, status, notes) =>
    mutate(() => api.post('/api/inspections', { consumerId, status, notes }));

  return { logInspection, loading, error };
}
