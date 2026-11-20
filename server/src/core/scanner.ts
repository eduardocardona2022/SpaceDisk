import fsp from "node:fs/promises";
import type { Dirent } from "node:fs";
import path from "node:path";
import {
  CATEGORY_IDS,
  categoryForExtension,
  extensionOf,
  type CategoryId
} from "../../../shared/categories";
import type {
  ScanError,
  ScanOptions,
  ScanProgress,
  ScanSummary
} from "../../../shared/types";
import { createAbortError, errorCode, errorMessage, isAbortError, AppError } from "./errors";
import { createExclusionMatcher, isSystemDirectory } from "./exclusions";
import { MinHeap } from "./heap";
import { displayNameForPath, isAbsolutePath } from "./pathUtils";

export const TOP_FILES_LIMIT = 1000;
const MAX_ERRORS = 50;
const MAX_DIRECTORIES = 1_000_000;
const CONCURRENCY = 32;
const PROGRESS_INTERVAL_MS = 200;

export interface DirNode {
  path: string;
  name: string;
  parent: string | null;
  depth: number;
  ownBytes: number;
  ownFiles: number;
  bytes: number;
  files: number;
  dirs: number;
  children: Set<string>;
}

export interface ScannedFile {
  path: string;
  name: string;
  size: number;
  mtimeMs: number;
  extension: string;
  category: CategoryId;
}

export interface ScanSnapshot {
  root: string;
  options: ScanOptions;
  nodes: Map<string, DirNode>;
  topFiles: ScannedFile[];
  categories: Map<CategoryId, { bytes: number; files: number }>;
  extensions: Map<string, { bytes: number; files: number }>;
  summary: ScanSummary;
}

export type ProgressListener = (progress: ScanProgress) => void;

export async function resolveScanRoot(input: string): Promise<string> {
  const trimmed = input.trim();
  if (!trimmed || trimmed.includes("\0")) {
    throw new AppError(400, "INVALID_ROOT", "La ruta no es válida.");
  }
  if (!isAbsolutePath(trimmed)) {
    throw new AppError(400, "ROOT_NOT_ABSOLUTE", "La ruta debe ser absoluta.");
  }

  const resolved = path.resolve(trimmed);
  let realPath: string;
  try {
    realPath = await fsp.realpath(resolved);
  } catch (error) {
    const code = errorCode(error);
    if (code === "ENOENT") {
      throw new AppError(404, "ROOT_NOT_FOUND", "La carpeta no existe.");
    }
    if (code === "EACCES" || code === "EPERM") {
      throw new AppError(403, "ROOT_ACCESS_DENIED", "No hay permiso para acceder a la carpeta.");
    }
    throw new AppError(400, "ROOT_UNAVAILABLE", errorMessage(error));
  }

  let stats;
  try {
    stats = await fsp.stat(realPath);
  } catch (error) {
    throw new AppError(400, "ROOT_UNAVAILABLE", errorMessage(error));
  }

  if (!stats.isDirectory()) {
    throw new AppError(400, "ROOT_NOT_DIRECTORY", "La ruta seleccionada no es una carpeta.");
  }

  return path.resolve(realPath);
}

export async function scanDirectory(
  root: string,
  options: ScanOptions,
  signal: AbortSignal,
  onProgress?: ProgressListener
): Promise<ScanSnapshot> {
  const startedAt = Date.now();
  const matcher = createExclusionMatcher(options.excludePatterns);
  const nodes = new Map<string, DirNode>();
  const heap = new MinHeap<ScannedFile>((a, b) => a.size - b.size || a.path.localeCompare(b.path));
  const topFiles: ScannedFile[] = [];
  const categories = new Map<CategoryId, { bytes: number; files: number }>();
  const extensions = new Map<string, { bytes: number; files: number }>();
  const errors: ScanError[] = [];
  const progress: ScanProgress = {
    dirsScanned: 0,
    filesScanned: 0,
    bytesScanned: 0,
    errorCount: 0,
    currentPath: root
  };

  let lastProgressAt = 0;

  const emitProgress = (force = false): void => {
    const now = Date.now();
    if (!force && now - lastProgressAt < PROGRESS_INTERVAL_MS) return;
    lastProgressAt = now;
    onProgress?.({ ...progress });
  };

  const recordError = (targetPath: string, error: unknown): void => {
    progress.errorCount += 1;
    if (errors.length < MAX_ERRORS) {
      errors.push({
        path: targetPath,
        code: errorCode(error),
        message: errorMessage(error)
      });
    }
  };

  const rootNode: DirNode = {
    path: root,
    name: displayNameForPath(root),
    parent: null,
    depth: 0,
    ownBytes: 0,
    ownFiles: 0,
    bytes: 0,
    files: 0,
    dirs: 0,
    children: new Set()
  };
  nodes.set(root, rootNode);

  const queue: string[] = [root];
  let queueIndex = 0;

  const createDirectory = (
    directoryPath: string,
    name: string,
    parent: DirNode
  ): DirNode => {
    if (nodes.size >= MAX_DIRECTORIES) {
      throw new AppError(
        413,
        "SCAN_TOO_LARGE",
        "El escaneo superó el límite de carpetas permitido. Analiza una carpeta más específica."
      );
    }

    const node: DirNode = {
      path: directoryPath,
      name,
      parent: parent.path,
      depth: parent.depth + 1,
      ownBytes: 0,
      ownFiles: 0,
      bytes: 0,
      files: 0,
      dirs: 0,
      children: new Set()
    };
    nodes.set(directoryPath, node);
    parent.children.add(directoryPath);
    queue.push(directoryPath);
    return node;
  };

  const addFile = (parent: DirNode, filePath: string, name: string, size: number, mtimeMs: number): void => {
    const extension = extensionOf(name);
    const category = categoryForExtension(extension);
    const file: ScannedFile = {
      path: filePath,
      name,
      size,
      mtimeMs,
      extension,
      category
    };

    parent.ownBytes += size;
    parent.ownFiles += 1;
    progress.filesScanned += 1;
    progress.bytesScanned += size;

    const categoryStat = categories.get(category) ?? { bytes: 0, files: 0 };
    categoryStat.bytes += size;
    categoryStat.files += 1;
    categories.set(category, categoryStat);

    const extensionStat = extensions.get(extension) ?? { bytes: 0, files: 0 };
    extensionStat.bytes += size;
    extensionStat.files += 1;
    extensions.set(extension, extensionStat);

    if (heap.size < TOP_FILES_LIMIT) {
      heap.push(file);
    } else {
      const smallest = heap.peek();
      if (smallest && file.size > smallest.size) heap.replaceMin(file);
    }
  };

  const processEntry = async (parent: DirNode, entry: Dirent): Promise<void> => {
    if (signal.aborted) throw createAbortError();

    const childPath = path.join(parent.path, entry.name);
    const relativePath = path.relative(root, childPath);

    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) return;
    if (entry.isSymbolicLink()) return;

    if (entry.isDirectory()) {
      if (options.maxDepth !== null && parent.depth >= options.maxDepth) return;
      if (options.excludeSystemDirs && isSystemDirectory(childPath)) return;
      if (matcher(relativePath, childPath, true)) return;
      createDirectory(childPath, entry.name, parent);
      return;
    }

    if (!entry.isFile()) return;

    let stats;
    try {
      stats = await fsp.lstat(childPath);
    } catch (error) {
      recordError(childPath, error);
      return;
    }

    if (stats.isSymbolicLink() || !stats.isFile()) return;
    if (matcher(relativePath, childPath, false)) return;

    addFile(parent, childPath, entry.name, stats.size, stats.mtimeMs);
  };

  const processBatch = async (parent: DirNode, entries: Dirent[]): Promise<void> => {
    await Promise.all(entries.map((entry) => processEntry(parent, entry)));
  };

  const processDirectory = async (node: DirNode): Promise<void> => {
    if (signal.aborted) throw createAbortError();

    progress.dirsScanned += 1;
    progress.currentPath = node.path;
    emitProgress();

    let directory;
    try {
      directory = await fsp.opendir(node.path);
    } catch (error) {
      recordError(node.path, error);
      return;
    }

    const batch: Dirent[] = [];

    try {
      while (!signal.aborted) {
        const entry = await directory.read();
        if (!entry) break;

        batch.push(entry);
        if (batch.length >= 64) {
          await processBatch(node, batch);
          batch.length = 0;
          emitProgress();
        }
      }

      if (batch.length > 0) await processBatch(node, batch);
      emitProgress();
    } catch (error) {
      if (isAbortError(error) || error instanceof AppError) throw error;
      recordError(node.path, error);
    } finally {
      try {
        await directory.close();
      } catch {
        // The directory may already be closed by the runtime after an error.
      }
    }

    if (signal.aborted) throw createAbortError();
  };

  emitProgress(true);

  await new Promise<void>((resolve, reject) => {
    let active = 0;
    let settled = false;

    const finishWithError = (error: unknown): void => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    const pump = (): void => {
      if (settled) return;
      if (signal.aborted) {
        finishWithError(createAbortError());
        return;
      }

      while (active < CONCURRENCY && queueIndex < queue.length) {
        const nextPath = queue[queueIndex];
        queueIndex += 1;
        if (!nextPath) continue;
        const node = nodes.get(nextPath);
        if (!node) continue;

        active += 1;
        processDirectory(node)
          .then(() => {
            active -= 1;
            if (settled) return;
            pump();
          })
          .catch(finishWithError);
      }

      if (active === 0 && queueIndex >= queue.length) {
        settled = true;
        resolve();
      }
    };

    pump();
  });

  if (signal.aborted) throw createAbortError();

  for (const node of nodes.values()) {
    node.bytes = node.ownBytes;
    node.files = node.ownFiles;
  }

  const orderedNodes = [...nodes.values()].sort((a, b) => b.depth - a.depth);
  for (const node of orderedNodes) {
    if (!node.parent) continue;
    const parent = nodes.get(node.parent);
    if (!parent) continue;
    parent.bytes += node.bytes;
    parent.files += node.files;
    parent.dirs += node.dirs + 1;
  }

  topFiles.push(...heap.toArray());
  topFiles.sort((a, b) => b.size - a.size || a.path.localeCompare(b.path));

  const categoryStats = CATEGORY_IDS.map((id) => {
    const stat = categories.get(id);
    return { id, bytes: stat?.bytes ?? 0, files: stat?.files ?? 0 };
  })
    .filter((stat) => stat.bytes > 0)
    .sort((a, b) => b.bytes - a.bytes);

  const extensionStats = [...extensions.entries()]
    .map(([extension, stat]) => ({ extension, ...stat }))
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 20);

  const finishedAt = Date.now();
  const summary: ScanSummary = {
    totalBytes: rootNode.bytes,
    totalFiles: rootNode.files,
    totalDirs: nodes.size,
    errorCount: progress.errorCount,
    durationMs: finishedAt - startedAt,
    categories: categoryStats,
    extensions: extensionStats,
    uniqueExtensions: extensions.size,
    errors
  };

  progress.currentPath = root;
  emitProgress(true);

  return {
    root,
    options,
    nodes,
    topFiles,
    categories,
    extensions,
    summary
  };
}
