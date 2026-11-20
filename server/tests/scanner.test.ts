import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDirListing, getFileListing } from "../src/core/query";
import { resolveScanRoot, scanDirectory, type ScanSnapshot } from "../src/core/scanner";

let root: string;
let snapshot: ScanSnapshot;

async function writeFixture(filePath: string, size: number): Promise<void> {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, Buffer.alloc(size));
}

beforeAll(async () => {
  root = await fsp.mkdtemp(path.join(os.tmpdir(), "spacedisk-scanner-"));
  await writeFixture(path.join(root, "a.txt"), 10);
  await writeFixture(path.join(root, "sub1", "b.mp4"), 100);
  await writeFixture(path.join(root, "sub1", "c.zip"), 50);
  await writeFixture(path.join(root, "sub2", "d.md"), 25);
  await writeFixture(path.join(root, "excluded", "e.bin"), 500);
  await writeFixture(path.join(root, "node_modules", "f.js"), 200);
  await writeFixture(path.join(root, "System Volume Information", "g.dat"), 900);

  const resolved = await resolveScanRoot(root);
  snapshot = await scanDirectory(
    resolved,
    {
      root: resolved,
      excludePatterns: ["**/excluded/**", "**/node_modules/**"],
      excludeSystemDirs: true,
      maxDepth: null
    },
    new AbortController().signal
  );
});

afterAll(async () => {
  if (root) await fsp.rm(root, { recursive: true, force: true });
});

describe("scanner", () => {
  it("calcula totales y excluye patrones y carpetas del sistema", () => {
    expect(snapshot.summary.totalBytes).toBe(185);
    expect(snapshot.summary.totalFiles).toBe(4);
    expect(snapshot.summary.totalDirs).toBe(3);
    expect(snapshot.summary.errorCount).toBe(0);
    expect(snapshot.topFiles.map((file) => file.name)).toEqual([
      "b.mp4",
      "c.zip",
      "d.md",
      "a.txt"
    ]);
  });

  it("agrega tamaños por carpeta y categoría", () => {
    const rootNode = snapshot.nodes.get(snapshot.root);
    expect(rootNode?.bytes).toBe(185);
    expect(rootNode?.ownBytes).toBe(10);
    expect(rootNode?.files).toBe(4);

    const sub1 = snapshot.nodes.get(path.join(snapshot.root, "sub1"));
    expect(sub1?.bytes).toBe(150);
    expect(sub1?.files).toBe(2);

    const document = snapshot.categories.get("document");
    expect(document?.bytes).toBe(35);
    expect(document?.files).toBe(2);

    const video = snapshot.categories.get("video");
    expect(video?.bytes).toBe(100);
    expect(video?.files).toBe(1);
  });

  it("lista los hijos de una carpeta ordenados por tamaño", () => {
    const listing = getDirListing(snapshot);
    expect(listing.children.map((child) => child.name)).toEqual(["sub1", "sub2"]);
    expect(listing.children[0]?.bytes).toBe(150);
    expect(listing.childrenTotal).toBe(2);
    expect(listing.looseFiles).toEqual({ bytes: 10, files: 1 });
    expect(listing.breadcrumb.at(-1)?.path).toBe(snapshot.root);
  });

  it("filtra el top de archivos por carpeta y extensión", () => {
    const sub1 = path.join(snapshot.root, "sub1");
    const listing = getFileListing(snapshot, {
      top: 100,
      minSize: 0,
      extensions: ["mp4"],
      q: "",
      sort: "size_desc",
      folder: sub1
    });

    expect(listing.matched).toBe(1);
    expect(listing.files[0]?.name).toBe("b.mp4");
    expect(listing.scopeBytes).toBe(150);
    expect(listing.files[0]?.percentOfScope).toBeCloseTo(66.67, 1);
  });

  it("respeta la profundidad máxima", async () => {
    const shallow = await scanDirectory(
      snapshot.root,
      {
        root: snapshot.root,
        excludePatterns: [],
        excludeSystemDirs: true,
        maxDepth: 0
      },
      new AbortController().signal
    );

    expect(shallow.summary.totalBytes).toBe(10);
    expect(shallow.summary.totalFiles).toBe(1);
    expect(shallow.summary.totalDirs).toBe(1);
  });

  it("se cancela antes de comenzar", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      scanDirectory(
        snapshot.root,
        {
          root: snapshot.root,
          excludePatterns: [],
          excludeSystemDirs: true,
          maxDepth: null
        },
        controller.signal
      )
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});
