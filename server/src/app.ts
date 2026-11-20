import express, { type ErrorRequestHandler, type Express } from "express";
import { ZodError } from "zod";
import type { ApiErrorPayload, HealthInfo } from "../../shared/types";
import { attachWebAssets } from "./assets";
import { AppError } from "./core/errors";
import { ScanManager } from "./core/scanManager";
import { createFsRouter } from "./routes/fs";
import { createScansRouter } from "./routes/scans";
import { createVolumesRouter } from "./routes/volumes";
import { APP_VERSION } from "./version";

export interface AppOptions {
  serveStatic?: boolean;
}

export function createApp(options: AppOptions = {}): {
  app: Express;
  manager: ScanManager;
} {
  const app = express();
  const manager = new ScanManager();

  app.disable("x-powered-by");
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
    );
    next();
  });
  app.use(express.json({ limit: "128kb" }));
  app.use("/api", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });

  app.get("/api/health", (_req, res) => {
    const payload: HealthInfo = {
      ok: true,
      version: APP_VERSION,
      platform: process.platform
    };
    res.json(payload);
  });

  app.use("/api/volumes", createVolumesRouter());
  app.use("/api/scans", createScansRouter(manager));
  app.use("/api/fs", createFsRouter());

  app.use("/api", (_req, res) => {
    const payload: { error: ApiErrorPayload } = {
      error: {
        code: "NOT_FOUND",
        message: "El endpoint solicitado no existe."
      }
    };
    res.status(404).json(payload);
  });

  if (options.serveStatic !== false) attachWebAssets(app);

  app.use((_req, res) => {
    res.status(404).type("text/plain").send("Not found");
  });

  const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    if (res.headersSent) {
      res.end();
      return;
    }

    if (error instanceof ZodError) {
      const payload = {
        error: {
          code: "INVALID_INPUT",
          message: "Los datos enviados no son válidos.",
          details: error.issues.map((issue) => ({
            path: issue.path.map(String).join("."),
            message: issue.message,
            code: issue.code
          }))
        }
      };
      res.status(400).json(payload);
      return;
    }

    if (error instanceof AppError) {
      const payload = {
        error: {
          code: error.code,
          message: error.message,
          details: error.details
        }
      };
      res.status(error.status).json(payload);
      return;
    }

    if (
      error &&
      typeof error === "object" &&
      "type" in error &&
      (error as { type?: unknown }).type === "entity.parse.failed"
    ) {
      res.status(400).json({
        error: {
          code: "INVALID_JSON",
          message: "El cuerpo de la petición no es JSON válido."
        }
      });
      return;
    }

    console.error("[SpaceDisk] Error inesperado:", error);
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Ocurrió un error inesperado."
      }
    });
  };

  app.use(errorHandler);

  return { app, manager };
}
