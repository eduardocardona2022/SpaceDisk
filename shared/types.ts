import type { CategoryId } from "./categories";

export type VolumeType = "fixed" | "removable" | "network" | "optical" | "unknown";

export interface VolumeInfo {
  id: string;
  name: string;
  mountPath: string;
  type: VolumeType;
  fileSystem: string | null;
  providerName: string | null;
  totalBytes: number;
  freeBytes: number;
  usedBytes: number;
  ready: boolean;
}

export interface ScanOptions {
  root: string;
  excludePatterns: string[];
  excludeSystemDirs: boolean;
  maxDepth: number | null;
}

export interface ScanProgress {
  dirsScanned: number;
  filesScanned: number;
  bytesScanned: number;
  errorCount: number;
  currentPath: string | null;
}

export type ScanStatus = "running" | "completed" | "cancelled" | "failed";

export interface ScanError {
  path: string;
  code: string;
  message: string;
}

export interface CategoryStat {
  id: CategoryId;
  bytes: number;
  files: number;
}

export interface ExtensionStat {
  extension: string;
  bytes: number;
  files: number;
}

export interface ScanSummary {
  totalBytes: number;
  totalFiles: number;
  totalDirs: number;
  errorCount: number;
  durationMs: number;
  categories: CategoryStat[];
  extensions: ExtensionStat[];
  uniqueExtensions: number;
  errors: ScanError[];
}

export interface ScanFailure {
  code: string;
  message: string;
}

export interface ScanJobInfo {
  id: string;
  status: ScanStatus;
  options: ScanOptions;
  progress: ScanProgress;
  startedAt: string;
  finishedAt: string | null;
  elapsedMs: number;
  error: ScanFailure | null;
  summary: ScanSummary | null;
}

export interface FileEntry {
  path: string;
  name: string;
  size: number;
  modifiedAt: string;
  extension: string;
  category: CategoryId;
  percentOfScope: number;
}

export interface FileListing {
  files: FileEntry[];
  matched: number;
  stored: number;
  storedLimit: number;
  scopeBytes: number;
  scopePath: string | null;
}

export interface DirChild {
  path: string;
  name: string;
  bytes: number;
  ownBytes: number;
  files: number;
  dirs: number;
  hasChildren: boolean;
}

export interface BreadcrumbItem {
  path: string;
  name: string;
}

export interface DirListing {
  path: string;
  name: string;
  bytes: number;
  ownBytes: number;
  files: number;
  dirs: number;
  children: DirChild[];
  childrenTotal: number;
  truncated: boolean;
  looseFiles: {
    bytes: number;
    files: number;
  };
  breadcrumb: BreadcrumbItem[];
}

export interface FsDirectoryEntry {
  name: string;
  path: string;
}

export interface FsListing {
  path: string;
  parent: string | null;
  breadcrumb: BreadcrumbItem[];
  entries: FsDirectoryEntry[];
  truncated: boolean;
}

export interface HealthInfo {
  ok: boolean;
  version: string;
  platform: string;
}

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}
