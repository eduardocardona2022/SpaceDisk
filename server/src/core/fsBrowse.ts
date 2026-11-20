import fsp from "node:fs/promises";
import path from "node:path";
import type { FsDirectoryEntry, FsListing } from "../../../shared/types";
import { AppError, errorCode, errorMessage } from "./errors";
import { buildBreadcrumb, isAbsolutePath } from "./pathUtils";

const MAX_FS_ENTRIES = 500;

function cleanInput(input: string): string {
  const trimmed = input.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) return trimmed.slice(1, -1);
  return trimmed;
}

export async function listDirectories(input: string): Promise<FsListing> {
  const value = cleanInput(input);
  if (!value || value.includes("\0")) {
    throw new AppError(400, "INVALID_PATH", "La ruta no es válida.");
  }
  if (!isAbsolutePath(value)) {
    throw new AppError(400, "PATH_NOT_ABSOLUTE", "La ruta debe ser absoluta.");
  }

  const resolved = path.resolve(value);
  let realPath: string;
  try {
    realPath = await fsp.realpath(resolved);
  } catch (error) {
    const code = errorCode(error);
    if (code === "ENOENT") throw new AppError(404, "FS_NOT_FOUND", "La carpeta no existe.");
    if (code === "EACCES" || code === "EPERM") {
      throw new AppError(403, "FS_ACCESS_DENIED", "No hay permiso para leer esta carpeta.");
    }
    throw new AppError(400, "FS_UNAVAILABLE", errorMessage(error));
  }

  let stats;
  try {
    stats = await fsp.stat(realPath);
  } catch (error) {
    throw new AppError(400, "FS_UNAVAILABLE", errorMessage(error));
  }

  if (!stats.isDirectory()) {
    throw new AppError(400, "FS_NOT_DIRECTORY", "La ruta seleccionada no es una carpeta.");
  }

  let dirents;
  try {
    dirents = await fsp.readdir(realPath, { withFileTypes: true });
  } catch (error) {
    const code = errorCode(error);
    if (code === "EACCES" || code === "EPERM") {
      throw new AppError(403, "FS_ACCESS_DENIED", "No hay permiso para leer esta carpeta.");
    }
    throw new AppError(400, "FS_UNAVAILABLE", errorMessage(error));
  }

  const allEntries: FsDirectoryEntry[] = dirents
    .filter((entry) => entry.isDirectory() && !entry.isSymbolicLink())
    .map((entry) => ({
      name: entry.name,
      path: path.join(realPath, entry.name)
    }))
    .sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })
    );

  const root = path.parse(realPath).root;
  const breadcrumbBase = root || realPath;
  const parent = path.dirname(realPath);
  const isFilesystemRoot = parent === realPath || root === realPath;

  return {
    path: realPath,
    parent: isFilesystemRoot ? null : parent,
    breadcrumb: buildBreadcrumb(breadcrumbBase, realPath),
    entries: allEntries.slice(0, MAX_FS_ENTRIES),
    truncated: allEntries.length > MAX_FS_ENTRIES
  };
}
