import { useState, useCallback } from 'react';
import { api } from '../lib/api';

export function usePrediction(consumerId) {
  const [prediction, setPrediction] = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);

  const run = useCallback(async () => {
    if (!consumerId) return;
    setLoading(true); setError(null);
    try {
      const p = await api.get(`/api/consumers/${consumerId}/predict`);
      setPrediction(p);
      return p;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [consumerId]);

  const clear = useCallback(() => { setPrediction(null); setError(null); }, []);

  return { prediction, loading, error, run, clear };
}

export function useBatchPredict() {
  const [loading,  setLoading]  = useState(false);
  const [progress, setProgress] = useState(0);
  const [error,    setError]    = useState(null);
  const [result,   setResult]   = useState(null);

  const runBatch = useCallback(async (consumerIds) => {
    setLoading(true); setError(null); setProgress(0);
    try {
      // Split into chunks of 50
      const CHUNK = 50;
      let done = 0;
      const results = [];
      for (let i = 0; i < consumerIds.length; i += CHUNK) {
        const chunk = consumerIds.slice(i, i + CHUNK);
        const r = await api.post('/api/consumers/batch-predict', { consumerIds: chunk });
        results.push(r);
        done += chunk.length;
        setProgress(Math.round((done / consumerIds.length) * 100));
      }
      const totalDone = results.reduce((a, r) => a + (r.results ?? 0), 0);
      setResult({ total: consumerIds.length, done: totalDone });
      return totalDone;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  return { runBatch, loading, progress, error, result };
}
