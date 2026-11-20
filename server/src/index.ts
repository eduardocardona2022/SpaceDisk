import { spawn } from "node:child_process";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { isSea } from "node:sea";
import { createApp } from "./app";
import { APP_VERSION } from "./version";

function listenOnce(server: http.Server, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onError = (error: Error): void => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = (): void => {
      server.off("error", onError);
      resolve();
    };

    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, "127.0.0.1");
  });
}

function openBrowser(url: string): void {
  try {
    const child = spawn("cmd.exe", ["/c", "start", "", url], {
      detached: true,
      stdio: "ignore",
      windowsHide: true
    });
    child.unref();
  } catch {
    // The console still shows the URL if the browser cannot be opened.
  }
}

async function main(): Promise<void> {
  const seaMode = isSea();
  const { app, manager } = createApp();

  const envPort = Number.parseInt(process.env.PORT ?? "", 10);
  const preferredPort = Number.isFinite(envPort) && envPort >= 0 ? envPort : 3001;
  const maxAttempts = seaMode ? 20 : 1;

  const server = http.createServer(app);
  let lastError: unknown = null;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidate = preferredPort === 0 ? 0 : preferredPort + attempt;
    try {
      await listenOnce(server, candidate);
      lastError = null;
      break;
    } catch (error) {
      lastError = error;
      const code =
        error && typeof error === "object" && "code" in error
          ? (error as NodeJS.ErrnoException).code
          : undefined;
      if (code !== "EADDRINUSE") break;
    }
  }

  if (!server.listening) {
    if (
      lastError &&
      typeof lastError === "object" &&
      "code" in lastError &&
      (lastError as NodeJS.ErrnoException).code === "EADDRINUSE"
    ) {
      throw new Error(
        `El puerto ${preferredPort} está ocupado. Define otra variable PORT o cierra la aplicación que lo está usando.`
      );
    }
    throw lastError instanceof Error ? lastError : new Error("No se pudo iniciar el servidor.");
  }

  const address = server.address() as AddressInfo;
  const url = `http://127.0.0.1:${address.port}`;

  console.log("");
  console.log(`  SpaceDisk ${APP_VERSION}`);
  console.log(`  Servidor local: ${url}`);
  if (!seaMode) {
    console.log("  Interfaz de desarrollo: http://127.0.0.1:5173");
  }
  console.log("  Cierra esta ventana para detener la aplicacion.");
  console.log("");

  if (seaMode || process.env.SPACEDISK_OPEN === "1") {
    if (process.env.SPACEDISK_NO_OPEN !== "1") openBrowser(url);
  }

  let shuttingDown = false;
  const shutdown = (): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    manager.shutdown();
    server.closeAllConnections();
    server.close(() => {
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 2_000).unref();
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error: unknown) => {
  console.error("[SpaceDisk] No se pudo iniciar:", error);
  process.exitCode = 1;
});
