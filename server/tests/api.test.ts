import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ScanJobInfo } from "../../shared/types";
import { createApp } from "../src/app";

let root: string;
let outsideFile: string;
let app: ReturnType<typeof createApp>["app"];
let manager: ReturnType<typeof createApp>["manager"];

async function writeFixture(filePath: string, size: number): Promise<void> {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, Buffer.alloc(size));
}

async function waitForScan(id: string): Promise<ScanJobInfo> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const response = await request(app).get(`/api/scans/${id}`);
    expect(response.status).toBe(200);
    const job = response.body as ScanJobInfo;
    if (job.status !== "running") return job;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("Scan did not finish in time");
}

beforeAll(async () => {
  const parent = await fsp.mkdtemp(path.join(os.tmpdir(), "spacedisk-api-"));
  root = path.join(parent, "root");
  await writeFixture(path.join(root, "a.txt"), 10);
  await writeFixture(path.join(root, "sub", "b.mp4"), 100);
  await writeFixture(path.join(root, "sub", "c.zip"), 50);
  await writeFixture(path.join(root, "skip", "d.bin"), 900);
  outsideFile = path.join(parent, "outside.txt");
  await fsp.writeFile(outsideFile, "outside");

  const created = createApp({ serveStatic: false });
  app = created.app;
  manager = created.manager;
});

afterAll(async () => {
  manager.shutdown();
  if (root) {
    const parent = path.dirname(root);
    await fsp.rm(parent, { recursive: true, force: true });
  }
});

describe("API", () => {
  it("responde el estado de salud", async () => {
    const response = await request(app).get("/api/health");
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ ok: true, platform: "win32" });
  });

  it("valida que la raíz sea absoluta", async () => {
    const response = await request(app).post("/api/scans").send({ root: "relative/path" });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("ROOT_NOT_ABSOLUTE");
  });

  it("escanea, pagina resultados y calcula el resumen", async () => {
    const createResponse = await request(app)
      .post("/api/scans")
      .send({
        root,
        excludePatterns: ["**/skip/**"],
        excludeSystemDirs: true,
        maxDepth: null
      });

    expect(createResponse.status).toBe(202);
    const created = createResponse.body as ScanJobInfo;
    expect(["running", "completed"]).toContain(created.status);

    const job = await waitForScan(created.id);
    expect(job.status).toBe("completed");
    expect(job.summary).toMatchObject({
      totalBytes: 160,
      totalFiles: 3,
      totalDirs: 2,
      errorCount: 0
    });

    const filesResponse = await request(app).get(`/api/scans/${created.id}/files?top=100`);
    expect(filesResponse.status).toBe(200);
    expect(filesResponse.body.files).toHaveLength(3);
    expect(filesResponse.body.files[0]).toMatchObject({
      name: "b.mp4",
      size: 100,
      category: "video"
    });

    const filteredResponse = await request(app).get(
      `/api/scans/${created.id}/files?top=100&extensions=mp4`
    );
    expect(filteredResponse.body.matched).toBe(1);
    expect(filteredResponse.body.files[0].name).toBe("b.mp4");

    const dirsResponse = await request(app).get(`/api/scans/${created.id}/dirs`);
    expect(dirsResponse.status).toBe(200);
    expect(dirsResponse.body.children).toHaveLength(1);
    expect(dirsResponse.body.children[0]).toMatchObject({ name: "sub", bytes: 150 });

    const subListing = await request(app)
      .get(`/api/scans/${created.id}/dirs`)
      .query({ path: path.join(root, "sub") });
    expect(subListing.status).toBe(200);
    expect(subListing.body.files).toBe(2);

    const summaryResponse = await request(app).get(`/api/scans/${created.id}/summary`);
    expect(summaryResponse.status).toBe(200);
    expect(summaryResponse.body.categories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "video", bytes: 100 }),
        expect.objectContaining({ id: "archive", bytes: 50 }),
        expect.objectContaining({ id: "document", bytes: 10 })
      ])
    );
  });

  it("navega carpetas y valida que la ruta sea un directorio", async () => {
    const listing = await request(app).get("/api/fs/dirs").query({ path: root });
    expect(listing.status).toBe(200);
    expect(listing.body.entries.map((entry: { name: string }) => entry.name)).toContain("sub");
    expect(listing.body.breadcrumb.at(-1)?.path).toBe(root);

    const relative = await request(app).get("/api/fs/dirs").query({ path: "relative" });
    expect(relative.status).toBe(400);
    expect(relative.body.error.code).toBe("PATH_NOT_ABSOLUTE");

    const file = await request(app)
      .get("/api/fs/dirs")
      .query({ path: path.join(root, "a.txt") });
    expect(file.status).toBe(400);
    expect(file.body.error.code).toBe("FS_NOT_DIRECTORY");
  });

  it("rechaza rutas fuera del escaneo al abrir Explorer", async () => {
    const createResponse = await request(app)
      .post("/api/scans")
      .send({ root, excludePatterns: [], excludeSystemDirs: true, maxDepth: null });
    const job = await waitForScan(createResponse.body.id);

    const response = await request(app)
      .post(`/api/scans/${job.id}/reveal`)
      .send({ path: outsideFile });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("PATH_OUTSIDE_SCAN");
  });

  it("devuelve 404 para un escaneo inexistente", async () => {
    const response = await request(app).get("/api/scans/no-existe");
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("SCAN_NOT_FOUND");
  });
});
