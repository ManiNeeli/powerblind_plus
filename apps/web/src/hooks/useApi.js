import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../lib/api';

/**
 * Generic data-fetching hook.
 *
 * const { data, loading, error, refetch } = useApi('/api/consumers?page=1');
 *
 * - Automatically aborts in-flight requests on unmount or URL change
 * - Exposes a `refetch` function to manually re-trigger
 * - `transform` optionally reshapes the raw response before storing
 */
export function useApi(path, { transform, skip } = {}) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(!skip);
  const [error,   setError]   = useState(null);
  const abortRef = useRef(null);

  const fetch_ = useCallback(async (overridePath) => {
    const target = overridePath ?? path;
    if (!target || skip) return;

    if (abortRef.current) abortRef.current.abort();
    const controller  = new AbortController();
    abortRef.current  = controller;

    setLoading(true);
    setError(null);
    try {
      const raw = await api.get(target, { signal: controller.signal });
      if (!controller.signal.aborted) {
        setData(transform ? transform(raw) : raw);
      }
    } catch (err) {
      if (err.name !== 'AbortError') setError(err.message ?? 'Unknown error');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [path, skip, transform]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetch_();
    return () => abortRef.current?.abort();
  }, [fetch_]);

  return { data, loading, error, refetch: () => fetch_() };
}

/**
 * Mutation hook — returns an async `mutate` function plus state.
 * Ideal for POST / PATCH / DELETE calls triggered by user action.
 *
 * const { mutate, loading, error } = useMutation();
 * await mutate(() => api.post('/api/inspections', { ... }));
 */
export function useMutation() {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const mutate = useCallback(async (fn) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fn();
      return result;
    } catch (err) {
      setError(err.message ?? 'Unknown error');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { mutate, loading, error, clearError: () => setError(null) };
}
