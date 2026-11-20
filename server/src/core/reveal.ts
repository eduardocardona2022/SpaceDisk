import { spawn } from "node:child_process";
import fsp from "node:fs/promises";
import path from "node:path";
import { AppError, errorCode, errorMessage } from "./errors";
import { isAbsolutePath, isInsideOrEqual } from "./pathUtils";

export async function revealInExplorer(scanRoot: string, input: string): Promise<void> {
  if (!input || input.includes("\0") || !isAbsolutePath(input)) {
    throw new AppError(400, "INVALID_PATH", "La ruta no es válida.");
  }

  const resolved = path.resolve(input);
  let realTarget: string;
  let realRoot: string;

  try {
    [realTarget, realRoot] = await Promise.all([fsp.realpath(resolved), fsp.realpath(scanRoot)]);
  } catch (error) {
    const code = errorCode(error);
    if (code === "ENOENT") throw new AppError(404, "PATH_NOT_FOUND", "La ruta ya no existe.");
    if (code === "EACCES" || code === "EPERM") {
      throw new AppError(403, "PATH_ACCESS_DENIED", "No hay permiso para acceder a la ruta.");
    }
    throw new AppError(400, "PATH_UNAVAILABLE", errorMessage(error));
  }

  if (!isInsideOrEqual(realRoot, realTarget)) {
    throw new AppError(403, "PATH_OUTSIDE_SCAN", "La ruta no pertenece al escaneo actual.");
  }

  try {
    await fsp.stat(realTarget);
  } catch (error) {
    throw new AppError(400, "PATH_UNAVAILABLE", errorMessage(error));
  }

  await new Promise<void>((resolve, reject) => {
    try {
      const child = spawn("explorer.exe", [`/select,${realTarget}`], {
        detached: true,
        stdio: "ignore",
        windowsHide: false
      });
      child.once("error", reject);
      child.once("spawn", () => {
        child.unref();
        resolve();
      });
    } catch (error) {
      reject(error);
    }
  }).catch((error: unknown) => {
    throw new AppError(500, "REVEAL_FAILED", `No se pudo abrir el Explorer: ${errorMessage(error)}`);
  });
}
