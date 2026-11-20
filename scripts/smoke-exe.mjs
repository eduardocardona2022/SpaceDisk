import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const exePath = path.join(root, "release", "SpaceDisk.exe");
const scanRoot = path.join(root, "web", "src");
const timeoutMs = 25_000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}: ${await response.text()}`);
  }
  return response.json();
}

async function waitFor(fn, description) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < timeoutMs) {
    try {
      const result = await fn();
      if (result) return result;
    } catch (error) {
      lastError = error;
    }
    await sleep(250);
  }
  throw new Error(`Timeout waiting for ${description}${lastError ? `: ${lastError.message}` : ""}`);
}

if (!(await fs.stat(exePath).catch(() => null))) {
  throw new Error("No existe release/SpaceDisk.exe. Ejecuta primero: npm run build:exe");
}

const port = await getFreePort();
const baseUrl = `http://127.0.0.1:${port}`;
const runCwd = await fs.mkdtemp(path.join(os.tmpdir(), "spacedisk-smoke-"));
const child = spawn(exePath, [], {
  cwd: runCwd,
  env: { ...process.env, PORT: String(port), SPACEDISK_NO_OPEN: "1" },
  windowsHide: true,
  stdio: "ignore"
});

try {
  const health = await waitFor(
    () => fetchJson(`${baseUrl}/api/health`),
    "the portable executable to start"
  );
  console.log(`[smoke] health: ${health.ok} · version ${health.version}`);

  const indexResponse = await fetch(`${baseUrl}/`);
  if (!indexResponse.ok) throw new Error(`Index returned ${indexResponse.status}`);
  const html = await indexResponse.text();
  const scriptPath = html.match(/src="([^"]+\.js)"/)?.[1];
  if (!scriptPath) throw new Error("The embedded index.html has no script tag");

  const scriptResponse = await fetch(`${baseUrl}${scriptPath}`);
  if (!scriptResponse.ok) throw new Error(`Embedded JS returned ${scriptResponse.status}`);
  const script = await scriptResponse.text();
  if (!script.includes("SpaceDisk")) throw new Error("Embedded JavaScript looks invalid");
  console.log(`[smoke] embedded UI: index ${html.length} bytes · JS ${script.length} bytes`);

  const volumes = await fetchJson(`${baseUrl}/api/volumes`);
  if (!Array.isArray(volumes) || volumes.length === 0) {
    throw new Error("No volumes were returned");
  }
  console.log(`[smoke] volumes: ${volumes.map((volume) => volume.id).join(", ")}`);

  const job = await fetchJson(`${baseUrl}/api/scans`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      root: scanRoot,
      excludePatterns: [],
      excludeSystemDirs: true,
      maxDepth: 2
    })
  });

  const completed = await waitFor(async () => {
    const info = await fetchJson(`${baseUrl}/api/scans/${job.id}`);
    return info.status === "running" ? null : info;
  }, "the smoke-test scan to finish");

  if (completed.status !== "completed") {
    throw new Error(`Scan finished with status ${completed.status}: ${JSON.stringify(completed.error)}`);
  }
  if (!completed.summary || completed.summary.totalFiles === 0) {
    throw new Error("Scan completed without files");
  }

  console.log(
    `[smoke] scan: ${completed.summary.totalFiles} files · ${completed.summary.totalBytes} bytes · ${completed.summary.durationMs} ms`
  );
  console.log("[smoke] OK");
} finally {
  child.kill();
  await fs.rm(runCwd, { recursive: true, force: true }).catch(() => {});
}
