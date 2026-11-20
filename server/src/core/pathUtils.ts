import path from "node:path";

export function isDriveRoot(target: string): boolean {
  const resolved = path.resolve(target);
  const root = path.parse(resolved).root;
  return root.length > 0 && root.toLowerCase() === resolved.toLowerCase();
}

export function displayNameForPath(target: string): string {
  if (isDriveRoot(target)) return path.parse(target).root;
  return path.basename(target) || target;
}

export function isInsideOrEqual(root: string, target: string): boolean {
  const rootResolved = path.resolve(root);
  const targetResolved = path.resolve(target);
  const relative = path.relative(rootResolved, targetResolved);
  return (
    relative === "" ||
    (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
  );
}

export function buildBreadcrumb(
  base: string,
  target: string
): Array<{ path: string; name: string }> {
  const baseResolved = path.resolve(base);
  const targetResolved = path.resolve(target);
  const relative = path.relative(baseResolved, targetResolved);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return [{ path: targetResolved, name: displayNameForPath(targetResolved) }];
  }

  const items = [{ path: baseResolved, name: displayNameForPath(baseResolved) }];
  if (!relative) return items;

  let current = baseResolved;
  for (const segment of relative.split(path.sep)) {
    if (!segment) continue;
    current = path.join(current, segment);
    items.push({ path: current, name: segment });
  }
  return items;
}

export function toPosixPath(target: string): string {
  return target.split(path.sep).join("/");
}

export function isAbsolutePath(value: string): boolean {
  return path.isAbsolute(value) || /^[a-zA-Z]:[\\/]/.test(value) || value.startsWith("\\\\");
}
