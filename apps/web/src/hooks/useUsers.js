import { useApi, useMutation } from './useApi';
import { api } from '../lib/api';

export function useUsers() {
  const { data, loading, error, refetch } = useApi('/api/users');
  return { users: data?.users ?? [], loading, error, refetch };
}

export function useModelVersions() {
  const { data, loading, error, refetch } = useApi('/api/model/versions');
  return {
    versions:      data?.versions      ?? [],
    activeVersion: data?.activeVersion ?? null,
    mlService:     data?.mlService     ?? null,
    loading, error, refetch,
  };
}

export function useAuditLog({ page = 1, limit = 50 } = {}) {
  const { data, loading, error } = useApi(`/api/audit-log?page=${page}&limit=${limit}`);
  return { logs: data?.logs ?? [], total: data?.total ?? 0, loading, error };
}
