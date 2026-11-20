import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import type {
  DirListing,
  FileListing,
  ScanJobInfo,
  ScanOptions,
  ScanSummary
} from "../../../shared/types";
import { resolveScanRoot, scanDirectory, type ScanSnapshot } from "./scanner";
import { getDirListing, getFileListing, type FileQuery } from "./query";
import { AppError, errorMessage, isAbortError } from "./errors";
import { revealInExplorer } from "./reveal";

interface InternalJob {
  info: ScanJobInfo;
  controller: AbortController;
  emitter: EventEmitter;
  snapshot: ScanSnapshot | null;
  startedAtMs: number;
  done: Promise<void>;
  resolveDone: () => void;
}

const MAX_RETAINED_JOBS = 5;

function normalizeOptions(options: ScanOptions): ScanOptions {
  const patterns = [
    ...new Set(
      options.excludePatterns
        .map((pattern) => pattern.trim())
        .filter((pattern) => pattern.length > 0)
    )
  ]
    .slice(0, 100)
    .map((pattern) => pattern.slice(0, 500));

  return {
    ...options,
    excludePatterns: patterns,
    excludeSystemDirs: Boolean(options.excludeSystemDirs),
    maxDepth:
      options.maxDepth === null || !Number.isFinite(options.maxDepth)
        ? null
        : Math.max(0, Math.min(100, Math.trunc(options.maxDepth)))
  };
}

export class ScanManager {
  private readonly jobs = new Map<string, InternalJob>();
  private activeId: string | null = null;
  private starting = false;

  async start(options: ScanOptions, replace = false): Promise<ScanJobInfo> {
    if (this.starting) {
      throw new AppError(409, "SCAN_ACTIVE", "Ya hay un escaneo en preparación.");
    }

    if (this.activeId && !replace) {
      throw new AppError(409, "SCAN_ACTIVE", "Ya hay un escaneo en curso.");
    }

    this.starting = true;

    try {
      if (this.activeId) {
        const active = this.jobs.get(this.activeId);
        if (active) {
          active.controller.abort();
          await active.done;
        }
      }

      const root = await resolveScanRoot(options.root);
      const normalized = normalizeOptions({ ...options, root });
      const id = randomUUID();
      const controller = new AbortController();
      const emitter = new EventEmitter();
      emitter.setMaxListeners(100);

      let resolveDone!: () => void;
      const done = new Promise<void>((resolve) => {
        resolveDone = resolve;
      });

      const startedAtMs = Date.now();
      const info: ScanJobInfo = {
        id,
        status: "running",
        options: normalized,
        progress: {
          dirsScanned: 0,
          filesScanned: 0,
          bytesScanned: 0,
          errorCount: 0,
          currentPath: normalized.root
        },
        startedAt: new Date(startedAtMs).toISOString(),
        finishedAt: null,
        elapsedMs: 0,
        error: null,
        summary: null
      };

      const job: InternalJob = {
        info,
        controller,
        emitter,
        snapshot: null,
        startedAtMs,
        done,
        resolveDone
      };

      this.jobs.set(id, job);
      this.activeId = id;
      this.prune();

      void this.run(job);
      return this.toInfo(job);
    } finally {
      this.starting = false;
    }
  }

  getJobInfo(id: string): ScanJobInfo {
    return this.toInfo(this.requireJob(id));
  }

  getSummary(id: string): ScanSummary {
    return this.requireSnapshot(id).summary;
  }

  getFiles(id: string, query: FileQuery): FileListing {
    return getFileListing(this.requireSnapshot(id), query);
  }

  getDirs(id: string, targetPath?: string): DirListing {
    return getDirListing(this.requireSnapshot(id), targetPath);
  }

  getJobRoot(id: string): string {
    return this.requireJob(id).info.options.root;
  }

  cancel(id: string): ScanJobInfo {
    const job = this.requireJob(id);
    if (job.info.status === "running") job.controller.abort();
    return this.toInfo(job);
  }

  cancelActive(): void {
    if (!this.activeId) return;
    this.jobs.get(this.activeId)?.controller.abort();
  }

  subscribe(
    id: string,
    event: "progress" | "status",
    listener: (info: ScanJobInfo) => void
  ): () => void {
    const job = this.requireJob(id);
    job.emitter.on(event, listener);
    return () => {
      job.emitter.off(event, listener);
    };
  }

  async reveal(id: string, targetPath: string): Promise<void> {
    const job = this.requireJob(id);
    await revealInExplorer(job.info.options.root, targetPath);
  }

  shutdown(): void {
    this.cancelActive();
    for (const job of this.jobs.values()) job.emitter.removeAllListeners();
    this.jobs.clear();
    this.activeId = null;
  }

  private requireJob(id: string): InternalJob {
    const job = this.jobs.get(id);
    if (!job) throw new AppError(404, "SCAN_NOT_FOUND", "El escaneo no existe o expiró.");
    return job;
  }

  private requireSnapshot(id: string): ScanSnapshot {
    const job = this.requireJob(id);
    if (!job.snapshot) {
      if (job.info.status === "running") {
        throw new AppError(409, "SCAN_IN_PROGRESS", "El escaneo todavía está en curso.");
      }
      throw new AppError(409, "SCAN_NOT_COMPLETED", "El escaneo no tiene resultados disponibles.");
    }
    return job.snapshot;
  }

  private async run(job: InternalJob): Promise<void> {
    try {
      const snapshot = await scanDirectory(
        job.info.options.root,
        job.info.options,
        job.controller.signal,
        (progress) => {
          if (job.info.status !== "running") return;
          job.info.progress = progress;
          job.info.elapsedMs = Date.now() - job.startedAtMs;
          job.emitter.emit("progress", this.toInfo(job));
        }
      );

      job.snapshot = snapshot;
      job.info.status = "completed";
      job.info.summary = snapshot.summary;
    } catch (error) {
      if (isAbortError(error) || job.controller.signal.aborted) {
        job.info.status = "cancelled";
      } else {
        job.info.status = "failed";
        job.info.error =
          error instanceof AppError
            ? { code: error.code, message: error.message }
            : { code: "SCAN_FAILED", message: errorMessage(error) };
        job.controller.abort();
      }
    } finally {
      const finishedAtMs = Date.now();
      job.info.finishedAt = new Date(finishedAtMs).toISOString();
      job.info.elapsedMs = finishedAtMs - job.startedAtMs;
      this.activeId = null;
      job.emitter.emit("status", this.toInfo(job));
      job.resolveDone();
    }
  }

  private toInfo(job: InternalJob): ScanJobInfo {
    const elapsedMs =
      job.info.status === "running" ? Date.now() - job.startedAtMs : job.info.elapsedMs;

    return {
      ...job.info,
      elapsedMs,
      options: {
        ...job.info.options,
        excludePatterns: [...job.info.options.excludePatterns]
      },
      progress: { ...job.info.progress },
      summary: job.info.summary
        ? {
            ...job.info.summary,
            categories: [...job.info.summary.categories],
            extensions: [...job.info.summary.extensions],
            errors: [...job.info.summary.errors]
          }
        : null,
      error: job.info.error ? { ...job.info.error } : null
    };
  }

  private prune(): void {
    if (this.jobs.size <= MAX_RETAINED_JOBS) return;

    const removable = [...this.jobs.values()]
      .filter((job) => job.info.id !== this.activeId && job.info.status !== "running")
      .sort((a, b) => a.startedAtMs - b.startedAtMs);

    while (this.jobs.size > MAX_RETAINED_JOBS && removable.length > 0) {
      const job = removable.shift();
      if (!job) break;
      this.jobs.delete(job.info.id);
    }
  }
}
