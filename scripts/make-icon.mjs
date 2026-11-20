import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import pngToIco from "png-to-ico";

const root = process.cwd();
const source = path.join(root, "assets", "icon.svg");
const sizes = [16, 24, 32, 48, 64, 128, 256];

const pngBuffers = await Promise.all(
  sizes.map((size) =>
    sharp(source, { density: 512 })
      .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer()
  )
);

const ico = await pngToIco(pngBuffers);
await fs.writeFile(path.join(root, "assets", "icon.ico"), ico);
await fs.writeFile(
  path.join(root, "assets", "icon-256.png"),
  await sharp(source, { density: 512 }).resize(256, 256).png().toBuffer()
);
await fs.copyFile(source, path.join(root, "web", "public", "favicon.svg"));

console.log(`[SpaceDisk] Icono generado: assets/icon.ico (${ico.length} bytes)`);
