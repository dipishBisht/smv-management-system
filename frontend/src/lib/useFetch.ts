'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from './api';

export function useFetch<T>(path: string | null) {
  const [state, setState] = useState<{ data?: T; error?: string; loading: boolean }>({ loading: !!path });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!path) { setState({ loading: false }); return; }
    let cancelled = false;
    setState((s) => ({ data: s.data, loading: true }));
    api<T>(path)
      .then((data) => !cancelled && setState({ data, loading: false }))
      .catch((e) => !cancelled && setState({ error: e.message, loading: false }));
    return () => { cancelled = true; };
  }, [path, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}
