import { useCallback, useEffect, useRef, useState } from "react";
import type {
  DirListing,
  ScanJobInfo,
  ScanOptions
} from "../../../shared/types";
import { ApiError, api } from "../api";
import { isPathWithinRoot } from "../lib/format";

const SCAN_STORAGE_KEY = "spacedisk.scanId";

export function useScan(): {
  job: ScanJobInfo | null;
  listing: DirListing | null;
  listingLoading: boolean;
  listingError: ApiError | null;
  currentPath: string | null;
  connected: boolean;
  error: ApiError | null;
  start: (options: ScanOptions, replace?: boolean) => Promise<void>;
  cancel: () => Promise<void>;
  navigate: (targetPath: string) => void;
  reloadListing: () => void;
  reset: () => void;
  clearError: () => void;
} {
  const [job, setJob] = useState<ScanJobInfo | null>(null);
  const [listing, setListing] = useState<DirListing | null>(null);
  const [listingLoading, setListingLoading] = useState(false);
  const [listingError, setListingError] = useState<ApiError | null>(null);
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [listingReload, setListingReload] = useState(0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const activeIdRef = useRef<string | null>(null);

  const closeEvents = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setConnected(false);
  }, []);

  const applyJob = useCallback(
    (info: ScanJobInfo) => {
      setJob(info);

      if (info.status === "completed") {
        closeEvents();
        setCurrentPath((previous) =>
          previous && isPathWithinRoot(info.options.root, previous)
            ? previous
            : info.options.root
        );
      } else if (info.status === "cancelled" || info.status === "failed") {
        closeEvents();
        setListing(null);
      }
    },
    [closeEvents]
  );

  const connect = useCallback(
    (id: string) => {
      closeEvents();
      activeIdRef.current = id;
      setConnected(false);

      const source = new EventSource(`/api/scans/${encodeURIComponent(id)}/events`);
      eventSourceRef.current = source;

      source.onopen = () => {
        if (activeIdRef.current === id) setConnected(true);
      };
      source.onerror = () => {
        if (activeIdRef.current !== id) return;
        setConnected(false);
        if (source.readyState === EventSource.CLOSED) {
          void api
            .getScan(id)
            .then((info) => {
              if (activeIdRef.current === id) applyJob(info);
            })
            .catch((caught: unknown) => {
              if (caught instanceof ApiError && caught.status === 404) {
                sessionStorage.removeItem(SCAN_STORAGE_KEY);
                if (activeIdRef.current === id) setJob(null);
              }
            });
        }
      };

      const handleEvent = (event: Event): void => {
        if (activeIdRef.current !== id) return;
        const message = event as MessageEvent<string>;
        try {
          const info = JSON.parse(message.data) as ScanJobInfo;
          applyJob(info);
        } catch {
          // Ignore malformed events; the next progress event will recover state.
        }
      };

      source.addEventListener("snapshot", handleEvent);
      source.addEventListener("progress", handleEvent);
      source.addEventListener("status", handleEvent);
    },
    [applyJob, closeEvents]
  );

  const start = useCallback(
    async (options: ScanOptions, replace = false) => {
      const info = await api.startScan(options, replace);
      sessionStorage.setItem(SCAN_STORAGE_KEY, info.id);
      activeIdRef.current = info.id;
      setListing(null);
      setListingError(null);
      setCurrentPath(null);
      setError(null);
      setJob(info);
      connect(info.id);
    },
    [connect]
  );

  const cancel = useCallback(async () => {
    if (!job) return;
    const info = await api.cancelScan(job.id);
    applyJob(info);
  }, [applyJob, job]);

  const navigate = useCallback((targetPath: string) => {
    setCurrentPath(targetPath);
    setListing(null);
  }, []);

  useEffect(() => {
    const storedId = sessionStorage.getItem(SCAN_STORAGE_KEY);
    if (!storedId) return;

    const controller = new AbortController();

    void api
      .getScan(storedId, controller.signal)
      .then((info) => {
        setJob(info);
        if (info.status === "completed") setCurrentPath(info.options.root);
        connect(info.id);
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        if (caught instanceof ApiError && (caught.status === 404 || caught.status === 409)) {
          sessionStorage.removeItem(SCAN_STORAGE_KEY);
          return;
        }
        if (caught instanceof ApiError) setError(caught);
      });

    return () => {
      controller.abort();
      closeEvents();
    };
  }, [connect, closeEvents]);

  useEffect(() => {
    return () => closeEvents();
  }, [closeEvents]);

  const scanId = job?.id;
  const scanStatus = job?.status;
  const scanRoot = job?.options.root;

  useEffect(() => {
    if (!scanId || scanStatus !== "completed") return;
    const targetPath = currentPath ?? scanRoot;
    if (!targetPath) return;

    const controller = new AbortController();
    setListingLoading(true);
    setListingError(null);

    void api
      .getScanDirs(scanId, targetPath, controller.signal)
      .then((nextListing) => {
        setListing(nextListing);
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        if (caught instanceof ApiError) setListingError(caught);
      })
      .finally(() => {
        if (!controller.signal.aborted) setListingLoading(false);
      });

    return () => controller.abort();
  }, [scanId, scanStatus, currentPath, scanRoot, listingReload]);

  const reloadListing = useCallback(() => setListingReload((value) => value + 1), []);
  const reset = useCallback(() => {
    closeEvents();
    activeIdRef.current = null;
    sessionStorage.removeItem(SCAN_STORAGE_KEY);
    setJob(null);
    setListing(null);
    setListingError(null);
    setListingLoading(false);
    setCurrentPath(null);
    setError(null);
  }, [closeEvents]);
  const clearError = useCallback(() => setError(null), []);

  return {
    job,
    listing,
    listingLoading,
    listingError,
    currentPath,
    connected,
    error,
    start,
    cancel,
    navigate,
    reloadListing,
    reset,
    clearError
  };
}
