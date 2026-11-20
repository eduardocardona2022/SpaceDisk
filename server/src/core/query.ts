import type {
  DirChild,
  DirListing,
  FileEntry,
  FileListing
} from "../../../shared/types";
import type { ScanSnapshot } from "./scanner";
import { TOP_FILES_LIMIT } from "./scanner";
import { AppError } from "./errors";
import { buildBreadcrumb, isInsideOrEqual } from "./pathUtils";

export type FileSort = "size_desc" | "size_asc" | "date_desc" | "name_asc";

export interface FileQuery {
  top: number;
  minSize: number;
  extensions: string[];
  q: string;
  sort: FileSort;
  folder: string | null;
}

const MAX_DIR_CHILDREN = 300;

export function getDirListing(snapshot: ScanSnapshot, requestedPath?: string): DirListing {
  const targetPath = requestedPath ?? snapshot.root;
  const node = snapshot.nodes.get(targetPath);

  if (!node) {
    throw new AppError(400, "DIR_NOT_IN_SCAN", "La carpeta no pertenece a este escaneo.");
  }

  const children: DirChild[] = [];
  for (const childPath of node.children) {
    const child = snapshot.nodes.get(childPath);
    if (!child) continue;
    children.push({
      path: child.path,
      name: child.name,
      bytes: child.bytes,
      ownBytes: child.ownBytes,
      files: child.files,
      dirs: child.dirs,
      hasChildren: child.children.size > 0
    });
  }

  children.sort((a, b) => b.bytes - a.bytes || a.name.localeCompare(b.name));

  return {
    path: node.path,
    name: node.name,
    bytes: node.bytes,
    ownBytes: node.ownBytes,
    files: node.files,
    dirs: node.dirs,
    children: children.slice(0, MAX_DIR_CHILDREN),
    childrenTotal: children.length,
    truncated: children.length > MAX_DIR_CHILDREN,
    looseFiles: {
      bytes: node.ownBytes,
      files: node.ownFiles
    },
    breadcrumb: buildBreadcrumb(snapshot.root, node.path)
  };
}

export function getFileListing(snapshot: ScanSnapshot, query: FileQuery): FileListing {
  let scopeBytes = snapshot.summary.totalBytes;
  const folder = query.folder && query.folder.length > 0 ? query.folder : null;

  if (folder) {
    const node = snapshot.nodes.get(folder);
    if (!node) {
      throw new AppError(400, "DIR_NOT_IN_SCAN", "La carpeta no pertenece a este escaneo.");
    }
    scopeBytes = node.bytes;
  }

  const allowedExtensions = new Set(
    query.extensions.map((extension) => extension.replace(/^\./, "").toLowerCase()).filter(Boolean)
  );
  const needle = query.q.trim().toLowerCase();

  const filtered = snapshot.topFiles.filter((file) => {
    if (file.size < query.minSize) return false;
    if (folder && !isInsideOrEqual(folder, file.path)) return false;
    if (allowedExtensions.size > 0 && !allowedExtensions.has(file.extension)) return false;
    if (needle && !file.path.toLowerCase().includes(needle)) return false;
    return true;
  });

  filtered.sort((a, b) => {
    switch (query.sort) {
      case "size_asc":
        return a.size - b.size || a.path.localeCompare(b.path);
      case "date_desc":
        return b.mtimeMs - a.mtimeMs || b.size - a.size;
      case "name_asc":
        return a.name.localeCompare(b.name, undefined, {
          numeric: true,
          sensitivity: "base"
        });
      case "size_desc":
      default:
        return b.size - a.size || a.path.localeCompare(b.path);
    }
  });

  const files: FileEntry[] = filtered.slice(0, query.top).map((file) => ({
    path: file.path,
    name: file.name,
    size: file.size,
    modifiedAt: new Date(file.mtimeMs).toISOString(),
    extension: file.extension,
    category: file.category,
    percentOfScope: scopeBytes > 0 ? (file.size / scopeBytes) * 100 : 0
  }));

  return {
    files,
    matched: filtered.length,
    stored: snapshot.topFiles.length,
    storedLimit: TOP_FILES_LIMIT,
    scopeBytes,
    scopePath: folder
  };
}
