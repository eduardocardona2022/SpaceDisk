import { execFile } from "node:child_process";
import fsp from "node:fs/promises";
import type { VolumeInfo, VolumeType } from "../../../shared/types";
import { AppError, errorMessage } from "./errors";

interface RawVolume {
  DeviceID?: string | null;
  VolumeName?: string | null;
  DriveType?: number | string | null;
  FileSystem?: string | null;
  Size?: number | string | null;
  FreeSpace?: number | string | null;
  ProviderName?: string | null;
}

const VOLUME_CACHE_MS = 10_000;
let volumeCache: { at: number; promise: Promise<VolumeInfo[]> } | null = null;

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function mapDriveType(value: unknown): VolumeType {
  switch (toNumber(value)) {
    case 2:
      return "removable";
    case 3:
      return "fixed";
    case 4:
      return "network";
    case 5:
      return "optical";
    default:
      return "unknown";
  }
}

function parseVolumes(raw: RawVolume[]): VolumeInfo[] {
  const volumes: VolumeInfo[] = [];

  for (const item of raw) {
    const id = typeof item.DeviceID === "string" ? item.DeviceID.trim().toUpperCase() : "";
    if (!/^[A-Z]:$/.test(id)) continue;

    const totalBytes = toNumber(item.Size);
    const freeBytes = Math.min(toNumber(item.FreeSpace), totalBytes || Number.MAX_SAFE_INTEGER);
    const usedBytes = Math.max(0, totalBytes - freeBytes);

    volumes.push({
      id,
      name: typeof item.VolumeName === "string" ? item.VolumeName.trim() : "",
      mountPath: `${id}\\`,
      type: mapDriveType(item.DriveType),
      fileSystem:
        typeof item.FileSystem === "string" && item.FileSystem.trim()
          ? item.FileSystem.trim()
          : null,
      providerName:
        typeof item.ProviderName === "string" && item.ProviderName.trim()
          ? item.ProviderName.trim()
          : null,
      totalBytes,
      freeBytes: totalBytes > 0 ? freeBytes : 0,
      usedBytes,
      ready: totalBytes > 0
    });
  }

  return volumes.sort((a, b) => a.id.localeCompare(b.id));
}

export function parseVolumesJson(rawJson: string): VolumeInfo[] {
  const cleaned = rawJson.replace(/^\uFEFF/, "").trim();
  if (!cleaned) return [];

  const parsed: unknown = JSON.parse(cleaned);
  if (Array.isArray(parsed)) return parseVolumes(parsed as RawVolume[]);
  if (parsed && typeof parsed === "object") return parseVolumes([parsed as RawVolume]);
  return [];
}

function runPowerShell(script: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", script],
      {
        encoding: "utf8",
        timeout: 10_000,
        windowsHide: true,
        maxBuffer: 2 * 1024 * 1024
      },
      (error, stdout) => {
        if (error) reject(error);
        else resolve(stdout);
      }
    );
  });
}

async function statfsVolume(mountPath: string, timeoutMs = 1_500): Promise<{ total: number; free: number } | null> {
  try {
    const stats = await Promise.race([
      fsp.statfs(mountPath),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs))
    ]);
    if (!stats) return null;
    const total = Number(stats.blocks) * Number(stats.bsize);
    const free = Number(stats.bavail) * Number(stats.bsize);
    if (!Number.isFinite(total) || total <= 0) return null;
    return {
      total,
      free: Number.isFinite(free) ? Math.max(0, free) : 0
    };
  } catch {
    return null;
  }
}

async function fillMissingSizes(volumes: VolumeInfo[]): Promise<void> {
  await Promise.all(
    volumes.map(async (volume) => {
      if (volume.totalBytes > 0) return;
      const stats = await statfsVolume(volume.mountPath);
      if (!stats) return;
      volume.totalBytes = stats.total;
      volume.freeBytes = stats.free;
      volume.usedBytes = Math.max(0, stats.total - stats.free);
      volume.ready = true;
    })
  );
}

async function queryVolumesFromPowerShell(): Promise<VolumeInfo[]> {
  const script = [
    "[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)",
    "$ProgressPreference = 'SilentlyContinue'",
    "Get-CimInstance -ClassName Win32_LogicalDisk | Select-Object DeviceID, VolumeName, DriveType, FileSystem, Size, FreeSpace, ProviderName | ConvertTo-Json -Compress"
  ].join("\n");

  const output = await runPowerShell(script);
  return parseVolumesJson(output);
}

async function fallbackVolumes(): Promise<VolumeInfo[]> {
  const letters = "CDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const results = await Promise.all(
    letters.map(async (letter): Promise<VolumeInfo | null> => {
      const id = `${letter}:`;
      const stats = await statfsVolume(`${id}\\`);
      if (!stats) return null;
      return {
        id,
        name: "",
        mountPath: `${id}\\`,
        type: "unknown" as VolumeType,
        fileSystem: null,
        providerName: null,
        totalBytes: stats.total,
        freeBytes: stats.free,
        usedBytes: Math.max(0, stats.total - stats.free),
        ready: true
      };
    })
  );

  return results.filter((volume): volume is VolumeInfo => volume !== null);
}

async function loadVolumes(): Promise<VolumeInfo[]> {
  try {
    const volumes = await queryVolumesFromPowerShell();
    await fillMissingSizes(volumes);
    if (volumes.length > 0) return volumes;
  } catch {
    // Fall through to the portable statfs implementation.
  }

  try {
    const volumes = await fallbackVolumes();
    if (volumes.length > 0) return volumes;
  } catch {
    // Fall through to the friendly error below.
  }

  throw new AppError(500, "VOLUMES_UNAVAILABLE", "No se pudieron leer las unidades del sistema.");
}

export function getVolumes(force = false): Promise<VolumeInfo[]> {
  const now = Date.now();
  if (!force && volumeCache && now - volumeCache.at < VOLUME_CACHE_MS) {
    return volumeCache.promise;
  }

  const promise = loadVolumes().catch((error: unknown) => {
    volumeCache = null;
    if (error instanceof AppError) throw error;
    throw new AppError(500, "VOLUMES_UNAVAILABLE", errorMessage(error));
  });

  volumeCache = { at: now, promise };
  return promise;
}

export function clearVolumeCache(): void {
  volumeCache = null;
}
