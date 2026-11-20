import path from "node:path";
import picomatch from "picomatch";
import { toPosixPath } from "./pathUtils";

interface CompiledPattern {
  matcher: (value: string) => boolean;
  absolute: boolean;
  basenameOnly: boolean;
}

function normalizePattern(pattern: string): string {
  return pattern.trim().replaceAll("\\", "/").replace(/^\.\//, "");
}

export type ExclusionMatcher = (
  relativePath: string,
  absolutePath: string,
  isDirectory: boolean
) => boolean;

export function createExclusionMatcher(patterns: string[]): ExclusionMatcher {
  const compiled: CompiledPattern[] = [];

  for (const rawPattern of patterns) {
    const pattern = normalizePattern(rawPattern);
    if (!pattern) continue;

    try {
      compiled.push({
        matcher: picomatch(pattern, { dot: true, nocase: true }),
        absolute: /^[a-zA-Z]:\//.test(pattern) || pattern.startsWith("//"),
        basenameOnly: !pattern.includes("/") && !pattern.includes("**")
      });
    } catch {
      // Ignore invalid user patterns instead of failing the whole scan.
    }
  }

  if (compiled.length === 0) return () => false;

  return (relativePath, absolutePath, isDirectory) => {
    const relative = toPosixPath(relativePath).replace(/^\/+/, "");
    const absolute = toPosixPath(absolutePath);
    const basename = path.basename(relativePath);

    for (const entry of compiled) {
      if (entry.basenameOnly) {
        if (entry.matcher(basename)) return true;
        continue;
      }

      const subject = entry.absolute ? absolute : relative;
      if (entry.matcher(subject)) return true;
      if (isDirectory && entry.matcher(`${subject}/`)) return true;
    }

    return false;
  };
}

const ALWAYS_EXCLUDED_NAMES = new Set(["$recycle.bin", "system volume information"]);
const DRIVE_ROOT_EXCLUDED_NAMES = new Set(["windows", "recovery", "config.msi"]);

export function isSystemDirectory(absolutePath: string): boolean {
  const basename = path.basename(absolutePath).toLowerCase();
  if (ALWAYS_EXCLUDED_NAMES.has(basename)) return true;

  if (DRIVE_ROOT_EXCLUDED_NAMES.has(basename)) {
    const parent = path.dirname(absolutePath);
    const parentRoot = path.parse(parent).root;
    return parentRoot.length > 0 && path.resolve(parent).toLowerCase() === parentRoot.toLowerCase();
  }

  return false;
}
