import { useState, useCallback } from 'react';
import { useApi } from './useApi';

export function useConsumers({ page = 1, limit = 25, label, consumerType, search } = {}) {
  const params = new URLSearchParams({ page, limit });
  if (label        && label !== 'All')       params.set('label',        label);
  if (consumerType && consumerType !== 'All') params.set('consumerType', consumerType);
  if (search)                                params.set('search',       search);

  const { data, loading, error, refetch } = useApi(`/api/consumers?${params}`);
  return {
    consumers:    data?.consumers ?? [],
    total:        data?.total     ?? 0,
    loading, error, refetch,
  };
}

export function useConsumer(id) {
  const { data, loading, error, refetch } = useApi(id ? `/api/consumers/${id}` : null, { skip: !id });
  return { consumer: data, loading, error, refetch };
}

export function useTimeseries(consumerId) {
  const { data, loading, error } = useApi(consumerId ? `/api/consumers/${consumerId}/timeseries` : null, { skip: !consumerId });
  return { readings: data?.readings ?? [], loading, error };
}

export function usePredictions(consumerId) {
  const { data, loading, error, refetch } = useApi(
    consumerId ? `/api/consumers/${consumerId}/predictions` : null,
    { skip: !consumerId },
  );
  return { predictions: data?.predictions ?? [], loading, error, refetch };
}

export function usePredictionHistory(consumerId, limit = 20) {
  const { data, loading, error, refetch } = useApi(
    consumerId ? `/api/consumers/${consumerId}/predictions?limit=${limit}` : null,
    { skip: !consumerId }
  );
  return { predictions: data?.predictions ?? [], loading, error, refetch };
}
