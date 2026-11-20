import { useCallback, useEffect, useRef, useState } from "react";
import type { VolumeInfo } from "../../../shared/types";
import { ApiError, api } from "../api";

export function useVolumes(): {
  volumes: VolumeInfo[];
  loading: boolean;
  refreshing: boolean;
  error: ApiError | null;
  refresh: () => Promise<void>;
} {
  const [volumes, setVolumes] = useState<VolumeInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const mountedRef = useRef(true);
  const requestRef = useRef(0);

  const load = useCallback(async (force: boolean) => {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;

    if (force) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const nextVolumes = await api.getVolumes(force);
      if (mountedRef.current && requestRef.current === requestId) {
        setVolumes(nextVolumes);
      }
    } catch (caught) {
      if (!mountedRef.current || requestRef.current !== requestId) return;
      if (caught instanceof ApiError) setError(caught);
      else {
        setError(new ApiError(0, "NETWORK_ERROR", "No se pudo conectar con el servidor."));
      }
    } finally {
      if (mountedRef.current && requestRef.current === requestId) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void load(false);
    return () => {
      mountedRef.current = false;
    };
  }, [load]);

  const refresh = useCallback(() => load(true), [load]);

  return { volumes, loading, refreshing, error, refresh };
}
