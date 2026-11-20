import { execFileSync } from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { build as viteBuild } from "vite";
import { bundleServer } from "./build-utils.mjs";

const root = process.cwd();
const distWeb = path.join(root, "dist", "web");
const buildDir = path.join(root, "build");
const releaseDir = path.join(root, "release");
const outputExe = path.join(releaseDir, "SpaceDisk.exe");
const iconPath = path.join(root, "assets", "icon.ico");

async function collectFiles(directory, base = directory) {
  const files = [];
  const entries = await fsp.readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(fullPath, base)));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

console.log("[SpaceDisk] Construyendo frontend…");
await viteBuild();

console.log("[SpaceDisk] Empaquetando servidor…");
await bundleServer();

console.log("[SpaceDisk] Preparando assets embebidos…");
const webFiles = await collectFiles(distWeb);
const assets = Object.fromEntries(
  webFiles.map((file) => {
    const relative = path.relative(distWeb, file).split(path.sep).join("/");
    return [`web/${relative}`, file];
  })
);

await fsp.mkdir(buildDir, { recursive: true });
await fsp.mkdir(releaseDir, { recursive: true });

const seaConfig = {
  main: path.join(root, "dist", "server.cjs"),
  mainFormat: "commonjs",
  output: outputExe,
  disableExperimentalSEAWarning: true,
  assets
};

const configPath = path.join(buildDir, "sea-config.json");
await fsp.writeFile(configPath, JSON.stringify(seaConfig, null, 2));

console.log("[SpaceDisk] Generando ejecutable portable…");
execFileSync(process.execPath, ["--build-sea", configPath], {
  cwd: root,
  stdio: "inherit"
});

if (fs.existsSync(iconPath)) {
  console.log("[SpaceDisk] Incrustando icono y metadatos…");
  const ResEdit = await import("resedit");
  const source = await fsp.readFile(outputExe);
  const executable = ResEdit.NtExecutable.from(source, { ignoreCert: true });
  const resources = ResEdit.NtExecutableResource.from(executable);

  const iconFile = ResEdit.Data.IconFile.from(await fsp.readFile(iconPath));
  const iconGroups = ResEdit.Resource.IconGroupEntry.fromEntries(resources.entries);
  const iconGroupId = iconGroups[0]?.id ?? 101;

  ResEdit.Resource.IconGroupEntry.replaceIconsForResource(
    resources.entries,
    iconGroupId,
    1033,
    iconFile.icons.map((icon) => icon.data)
  );

  const versions = ResEdit.Resource.VersionInfo.fromEntries(resources.entries);
  const versionInfo = versions[0] ?? ResEdit.Resource.VersionInfo.createEmpty();
  versionInfo.setFileVersion(1, 0, 0, 0, 1033);
  versionInfo.setProductVersion(1, 0, 0, 0, 1033);
  versionInfo.setStringValues(
    { lang: 1033, codepage: 1200 },
    {
      ProductName: "SpaceDisk",
      FileDescription: "SpaceDisk - Analizador de espacio en disco",
      CompanyName: "SpaceDisk",
      OriginalFilename: "SpaceDisk.exe",
      FileVersion: "1.0.0",
      ProductVersion: "1.0.0"
    }
  );
  versionInfo.outputToResourceEntries(resources.entries);

  resources.outputResource(executable);
  await fsp.writeFile(outputExe, Buffer.from(executable.generate()));
} else {
  console.warn("[SpaceDisk] No se encontró assets/icon.ico; se usa el icono de Node.");
}

const stats = await fsp.stat(outputExe);
console.log(
  `[SpaceDisk] Listo: ${outputExe} (${(stats.size / 1024 / 1024).toFixed(1)} MB)`
);
