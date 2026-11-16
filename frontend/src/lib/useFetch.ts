"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

interface FetchState<T> {
  data?: T;
  error?: string;
  loading: boolean;
}

export function useFetch<T>(path: string | null) {
  const [state, setState] = useState<FetchState<T>>({
    loading: !!path,
  });

  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!path) {
      setState({ loading: false });
      return;
    }

    let cancelled = false;

    setState({
      loading: true,
    });

    api<T>(path)
      .then((data) => {
        if (!cancelled) {
          setState({ data, loading: false });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            error:
              error instanceof Error ? error.message : "Something went wrong",
            loading: false,
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [path, tick]);

  const reload = useCallback(() => {
    setTick((t) => t + 1);
  }, []);

  return {
    ...state,
    reload,
  };
}
