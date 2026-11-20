export const CATEGORY_IDS = [
  "video",
  "image",
  "audio",
  "archive",
  "document",
  "code",
  "installer",
  "system",
  "database",
  "other"
] as const;

export type CategoryId = (typeof CATEGORY_IDS)[number];

const EXTENSIONS_BY_CATEGORY: Record<CategoryId, readonly string[]> = {
  video: [
    "mp4", "mkv", "avi", "mov", "wmv", "webm", "m4v", "flv", "mpg", "mpeg", "3gp",
    "ts", "mts", "m2ts", "vob", "ogv", "rmvb", "asf"
  ],
  image: [
    "jpg", "jpeg", "png", "gif", "webp", "bmp", "tif", "tiff", "svg", "ico",
    "heic", "heif", "avif", "raw", "cr2", "cr3", "nef", "arw", "dng", "psd",
    "ai", "eps"
  ],
  audio: [
    "mp3", "wav", "flac", "aac", "ogg", "oga", "m4a", "wma", "opus", "aiff",
    "aif", "alac", "mid", "midi", "amr"
  ],
  archive: [
    "zip", "rar", "7z", "tar", "gz", "gzip", "bz2", "xz", "zst", "cab", "iso",
    "img", "dmg", "tgz", "tbz2", "lz", "lzma", "jar", "war", "apk", "ipa"
  ],
  document: [
    "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "md", "rtf",
    "odt", "ods", "odp", "csv", "tsv", "epub", "mobi", "pages", "numbers",
    "key", "tex", "log"
  ],
  code: [
    "js", "jsx", "mjs", "cjs", "ts", "tsx", "json", "jsonc", "html", "htm",
    "css", "scss", "sass", "less", "vue", "svelte", "py", "pyc", "java", "class",
    "kt", "kts", "c", "h", "cpp", "cc", "cxx", "hpp", "cs", "go", "rs", "php",
    "rb", "swift", "dart", "lua", "pl", "r", "sql", "sh", "bash", "zsh", "ps1",
    "psm1", "bat", "cmd", "xml", "yml", "yaml", "toml", "ini", "cfg", "conf",
    "gradle", "makefile", "dockerfile", "gitignore", "editorconfig", "map"
  ],
  installer: [
    "exe", "msi", "msix", "appx", "msixbundle", "appxbundle", "dmg", "pkg",
    "deb", "rpm", "appimage", "snap", "flatpak"
  ],
  system: [
    "sys", "dll", "drv", "ocx", "cpl", "scr", "efi", "mui", "manifest", "cat",
    "inf", "reg", "tmp", "temp", "swap", "dmp", "etl", "evtx", "pf", "lnk",
    "url", "ttf", "otf", "woff", "woff2", "eot"
  ],
  database: [
    "db", "sqlite", "sqlite3", "mdb", "accdb", "dbf", "mdf", "ndf", "ldf",
    "bak", "dump", "parquet", "avro", "orc", "dat", "bin"
  ],
  other: []
};

const EXTENSION_TO_CATEGORY = new Map<string, CategoryId>();

for (const category of CATEGORY_IDS) {
  for (const extension of EXTENSIONS_BY_CATEGORY[category]) {
    EXTENSION_TO_CATEGORY.set(extension, category);
  }
}

export function extensionOf(fileName: string): string {
  const lower = fileName.toLowerCase();
  const dot = lower.lastIndexOf(".");
  if (dot <= 0 || dot === lower.length - 1) return "";
  return lower.slice(dot + 1);
}

export function categoryForExtension(extension: string): CategoryId {
  return EXTENSION_TO_CATEGORY.get(extension) ?? "other";
}
