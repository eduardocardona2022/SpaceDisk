import type {
  ApiErrorPayload,
  DirListing,
  FileListing,
  FsListing,
  ScanJobInfo,
  ScanOptions,
  VolumeInfo
} from "../../shared/types";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export type FileSort = "size_desc" | "size_asc" | "date_desc" | "name_asc";

export interface FileQueryParams {
  top: number;
  minSize: number;
  extensions: string;
  q: string;
  sort: FileSort;
  folder?: string | null;
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  signal?: AbortSignal
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(path, { ...init, headers, signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(
      0,
      "NETWORK_ERROR",
      "No se pudo conectar con el servidor local de SpaceDisk."
    );
  }

  if (!response.ok) {
    let payload: { error?: ApiErrorPayload } | null = null;
    try {
      payload = (await response.json()) as { error?: ApiErrorPayload };
    } catch {
      payload = null;
    }

    throw new ApiError(
      response.status,
      payload?.error?.code ?? "HTTP_ERROR",
      payload?.error?.message ?? response.statusText,
      payload?.error?.details
    );
  }

  return (await response.json()) as T;
}

export const api = {
  getVolumes(force = false, signal?: AbortSignal): Promise<VolumeInfo[]> {
    return request<VolumeInfo[]>(`/api/volumes${force ? "?refresh=1" : ""}`, {}, signal);
  },

  startScan(options: ScanOptions, replace = false): Promise<ScanJobInfo> {
    return request<ScanJobInfo>("/api/scans", {
      method: "POST",
      body: JSON.stringify({ ...options, replace })
    });
  },

  getScan(id: string, signal?: AbortSignal): Promise<ScanJobInfo> {
    return request<ScanJobInfo>(`/api/scans/${encodeURIComponent(id)}`, {}, signal);
  },

  cancelScan(id: string): Promise<ScanJobInfo> {
    return request<ScanJobInfo>(`/api/scans/${encodeURIComponent(id)}/cancel`, {
      method: "POST"
    });
  },

  getScanFiles(
    id: string,
    params: FileQueryParams,
    signal?: AbortSignal
  ): Promise<FileListing> {
    const search = new URLSearchParams();
    search.set("top", String(params.top));
    search.set("minSize", String(params.minSize));
    search.set("sort", params.sort);
    if (params.extensions.trim()) search.set("extensions", params.extensions.trim());
    if (params.q.trim()) search.set("q", params.q.trim());
    if (params.folder) search.set("folder", params.folder);

    return request<FileListing>(
      `/api/scans/${encodeURIComponent(id)}/files?${search.toString()}`,
      {},
      signal
    );
  },

  getScanDirs(id: string, targetPath?: string, signal?: AbortSignal): Promise<DirListing> {
    const search = new URLSearchParams();
    if (targetPath) search.set("path", targetPath);
    const suffix = search.size > 0 ? `?${search.toString()}` : "";
    return request<DirListing>(
      `/api/scans/${encodeURIComponent(id)}/dirs${suffix}`,
      {},
      signal
    );
  },

  reveal(id: string, targetPath: string): Promise<{ ok: boolean }> {
    return request<{ ok: boolean }>(`/api/scans/${encodeURIComponent(id)}/reveal`, {
      method: "POST",
      body: JSON.stringify({ path: targetPath })
    });
  },

  browseDirs(targetPath: string, signal?: AbortSignal): Promise<FsListing> {
    const search = new URLSearchParams({ path: targetPath });
    return request<FsListing>(`/api/fs/dirs?${search.toString()}`, {}, signal);
  }
};
