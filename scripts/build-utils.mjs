import path from "node:path";
import { build } from "esbuild";

export async function bundleServer() {
  await build({
    entryPoints: [path.resolve(process.cwd(), "server", "src", "index.ts")],
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node26",
    outfile: path.resolve(process.cwd(), "dist", "server.cjs"),
    sourcemap: false,
    legalComments: "none",
    define: {
      "process.env.NODE_ENV": '"production"'
    },
    logLevel: "info"
  });
}
