import type { CategoryId } from "../../../shared/categories";

export const CATEGORY_COLORS: Record<CategoryId, string> = {
  video: "#6ea2ff",
  image: "#2dd4bf",
  audio: "#c084fc",
  archive: "#f59e0b",
  document: "#34d399",
  code: "#38bdf8",
  installer: "#fb7185",
  system: "#94a3b8",
  database: "#a3e635",
  other: "#64748b"
};

export const TREEMAP_COLORS = [
  "#4f8cff",
  "#7c5cff",
  "#2dd4bf",
  "#f59e0b",
  "#fb7185",
  "#38bdf8",
  "#a3e635",
  "#c084fc",
  "#f97316",
  "#14b8a6"
];

export function treemapColor(index: number): string {
  return TREEMAP_COLORS[index % TREEMAP_COLORS.length] ?? "#4f8cff";
}
