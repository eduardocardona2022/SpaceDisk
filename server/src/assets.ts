import fs from "node:fs";
import path from "node:path";
import express, { type Express } from "express";
import { getAsset, getAssetKeys, isSea } from "node:sea";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8"
};

function contentTypeFor(filePath: string): string {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

function serveEmbedded(app: Express): void {
  const keys = new Set(getAssetKeys());
  const cache = new Map<string, Buffer>();

  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (req.path.startsWith("/api")) return next();

    let pathname: string;
    try {
      pathname = decodeURIComponent(req.path);
    } catch {
      res.status(400).end("Bad request");
      return;
    }

    if (pathname.includes("\0") || pathname.includes("..")) {
      res.status(400).end("Bad request");
      return;
    }

    const relative = pathname.replace(/^\/+/, "");
    let assetKey = `web/${relative || "index.html"}`;

    if (!keys.has(assetKey)) {
      if (path.extname(relative) !== "") return next();
      assetKey = "web/index.html";
    }

    let buffer = cache.get(assetKey);
    if (!buffer) {
      buffer = Buffer.from(getAsset(assetKey));
      cache.set(assetKey, buffer);
    }

    res.setHeader("Content-Type", contentTypeFor(assetKey));
    res.setHeader("Content-Length", String(buffer.byteLength));
    res.setHeader(
      "Cache-Control",
      assetKey === "web/index.html"
        ? "no-cache"
        : "public, max-age=31536000, immutable"
    );

    if (req.method === "HEAD") {
      res.status(200).end();
      return;
    }

    res.status(200).end(buffer);
  });
}

function serveFromDisk(app: Express): void {
  const webRoot = path.resolve(process.cwd(), "dist", "web");
  const indexPath = path.join(webRoot, "index.html");

  if (!fs.existsSync(indexPath)) return;

  app.use(
    express.static(webRoot, {
      index: false,
      maxAge: "1h",
      setHeaders: (res, filePath) => {
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
      }
    })
  );

  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (req.path.startsWith("/api")) return next();
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(indexPath);
  });
}

export function attachWebAssets(app: Express): void {
  if (isSea()) {
    serveEmbedded(app);
  } else {
    serveFromDisk(app);
  }
}
