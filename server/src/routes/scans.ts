import { Router, type Request, type Response } from "express";
import { z } from "zod";
import type { FileSort } from "../core/query";
import type { ScanJobInfo } from "../../../shared/types";
import type { ScanManager } from "../core/scanManager";
import { asyncHandler, requireParam } from "./helpers";

const scanBodySchema = z.object({
  root: z.string().trim().min(1).max(32_767),
  excludePatterns: z.array(z.string().max(500)).max(100).optional().default([]),
  excludeSystemDirs: z.boolean().optional().default(true),
  maxDepth: z.number().int().min(0).max(100).nullable().optional().default(null),
  replace: z.boolean().optional().default(false)
});

const fileQuerySchema = z.object({
  top: z.coerce.number().int().min(1).max(1000).optional().default(100),
  minSize: z.coerce.number().int().min(0).optional().default(0),
  extensions: z.string().max(1000).optional(),
  q: z.string().max(500).optional().default(""),
  sort: z.enum(["size_desc", "size_asc", "date_desc", "name_asc"]).optional().default("size_desc"),
  folder: z.string().max(32_767).optional()
});

const dirQuerySchema = z.object({
  path: z.string().max(32_767).optional()
});

const revealBodySchema = z.object({
  path: z.string().min(1).max(32_767)
});

function parseExtensions(value: string | undefined): string[] {
  if (!value) return [];
  return [
    ...new Set(
      value
        .split(",")
        .map((extension) => extension.trim().replace(/^\./, "").toLowerCase())
        .filter(Boolean)
    )
  ].slice(0, 50);
}

function writeSse(res: Response, event: string, payload: ScanJobInfo): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
}

function streamScan(req: Request, res: Response, manager: ScanManager): void {
  const id = requireParam(req, "id");
  manager.getJobInfo(id);

  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();
  res.setTimeout(0);

  let closed = false;
  let unsubscribeProgress: () => void = () => {};
  let unsubscribeStatus: () => void = () => {};

  const cleanup = (): void => {
    if (closed) return;
    closed = true;
    clearInterval(heartbeat);
    unsubscribeProgress();
    unsubscribeStatus();
  };

  const heartbeat = setInterval(() => {
    if (!closed) res.write(": keep-alive\n\n");
  }, 15_000);

  res.on("close", cleanup);

  unsubscribeProgress = manager.subscribe(id, "progress", (info) => {
    if (!closed) writeSse(res, "progress", info);
  });

  unsubscribeStatus = manager.subscribe(id, "status", (info) => {
    if (closed) return;
    writeSse(res, "status", info);
    cleanup();
    res.end();
  });

  const current = manager.getJobInfo(id);
  writeSse(res, "snapshot", current);

  if (current.status !== "running") {
    writeSse(res, "status", current);
    cleanup();
    res.end();
  }
}

export function createScansRouter(manager: ScanManager): Router {
  const router = Router();

  router.post(
    "/",
    asyncHandler(async (req, res) => {
      const body = scanBodySchema.parse(req.body);
      const { replace, ...options } = body;
      const job = await manager.start(options, replace);
      res.status(202).json(job);
    })
  );

  router.get("/:id/events", (req, res) => {
    streamScan(req, res, manager);
  });

  router.get(
    "/:id/files",
    asyncHandler(async (req, res) => {
      const id = requireParam(req, "id");
      const query = fileQuerySchema.parse(req.query);
      const sort = query.sort as FileSort;
      res.json(
        manager.getFiles(id, {
          top: query.top,
          minSize: query.minSize,
          extensions: parseExtensions(query.extensions),
          q: query.q,
          sort,
          folder: query.folder ?? null
        })
      );
    })
  );

  router.get(
    "/:id/dirs",
    asyncHandler(async (req, res) => {
      const id = requireParam(req, "id");
      const query = dirQuerySchema.parse(req.query);
      res.json(manager.getDirs(id, query.path));
    })
  );

  router.get(
    "/:id/summary",
    asyncHandler(async (req, res) => {
      res.json(manager.getSummary(requireParam(req, "id")));
    })
  );

  router.post(
    "/:id/cancel",
    asyncHandler(async (req, res) => {
      res.json(manager.cancel(requireParam(req, "id")));
    })
  );

  router.post(
    "/:id/reveal",
    asyncHandler(async (req, res) => {
      const id = requireParam(req, "id");
      const body = revealBodySchema.parse(req.body);
      await manager.reveal(id, body.path);
      res.json({ ok: true });
    })
  );

  router.get(
    "/:id",
    asyncHandler(async (req, res) => {
      res.json(manager.getJobInfo(requireParam(req, "id")));
    })
  );

  return router;
}
