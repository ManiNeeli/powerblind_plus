import { useApi } from './useApi';

export function useDashboard() {
  const { data, loading, error, refetch } = useApi('/api/dashboard/summary');
  return {
    summary: data,
    counts:           data?.counts           ?? null,
    topRisk:          data?.topRisk          ?? [],
    trend:            data?.trend            ?? [],
    inspectionStats:  data?.inspectionStats  ?? null,
    totalConsumers:   data?.totalConsumers   ?? null,
    loading, error, refetch,
  };
}
