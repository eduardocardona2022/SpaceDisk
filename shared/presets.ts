export interface ExclusionPreset {
  id: string;
  patterns: string[];
}

export const EXCLUSION_PRESETS: ExclusionPreset[] = [
  {
    id: "node_modules",
    patterns: ["**/node_modules", "**/node_modules/**"]
  },
  {
    id: "git",
    patterns: ["**/.git", "**/.git/**"]
  },
  {
    id: "build",
    patterns: [
      "**/dist",
      "**/dist/**",
      "**/build",
      "**/build/**",
      "**/out",
      "**/out/**",
      "**/.next",
      "**/.next/**",
      "**/.nuxt",
      "**/.nuxt/**",
      "**/target",
      "**/target/**"
    ]
  },
  {
    id: "caches",
    patterns: [
      "**/.cache",
      "**/.cache/**",
      "**/cache",
      "**/cache/**",
      "**/Cache",
      "**/Cache/**",
      "**/CachedData",
      "**/CachedData/**"
    ]
  },
  {
    id: "temp",
    patterns: [
      "**/temp",
      "**/temp/**",
      "**/Temp",
      "**/Temp/**",
      "**/tmp",
      "**/tmp/**",
      "**/tmpdata",
      "**/tmpdata/**"
    ]
  }
];
