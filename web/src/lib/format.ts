import type { Language } from "../i18n";

export function formatNumber(
  value: number,
  lang: Language,
  maximumFractionDigits = 1
): string {
  return new Intl.NumberFormat(lang === "es" ? "es-ES" : "en-US", {
    maximumFractionDigits,
    minimumFractionDigits: 0
  }).format(Number.isFinite(value) ? value : 0);
}

export function formatBytes(bytes: number, lang: Language): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  let value = bytes;
  let index = 0;

  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }

  const digits = value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${formatNumber(value, lang, digits)} ${units[index]}`;
}

export function formatPercent(value: number, lang: Language): string {
  const suffix = lang === "es" ? " %" : "%";
  if (!Number.isFinite(value) || value <= 0) return `0${suffix}`;
  if (value < 0.1) return `<${formatNumber(0.1, lang, 1)}${suffix}`;
  return `${formatNumber(value, lang, 1)}${suffix}`;
}

export function formatDuration(ms: number, lang: Language): string {
  if (!Number.isFinite(ms) || ms < 0) return "0 s";
  if (ms < 1_000) return `${Math.round(ms)} ms`;

  const seconds = ms / 1_000;
  if (seconds < 60) return `${formatNumber(seconds, lang, 1)} s`;

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  if (minutes < 60) return `${minutes} min ${remainingSeconds} s`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours} h ${remainingMinutes} min`;
}

export function formatDate(iso: string, lang: Language): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(lang === "es" ? "es-ES" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

export function basenameOfPath(target: string): string {
  const trimmed = target.replace(/[\\/]+$/, "");
  const parts = trimmed.split(/[\\/]/);
  return parts.at(-1) || target;
}

export function isDriveRootPath(target: string): boolean {
  return /^[a-zA-Z]:[\\/]?$/.test(target.trim());
}

export function isPathWithinRoot(root: string, target: string): boolean {
  const normalize = (value: string) => value.replace(/[\\/]+$/, "").toLowerCase();
  const normalizedRoot = normalize(root);
  const normalizedTarget = normalize(target);
  if (!normalizedRoot) return false;
  return (
    normalizedTarget === normalizedRoot ||
    normalizedTarget.startsWith(`${normalizedRoot}\\`) ||
    normalizedTarget.startsWith(`${normalizedRoot}/`)
  );
}
