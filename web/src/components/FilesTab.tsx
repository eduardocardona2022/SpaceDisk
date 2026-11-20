import { useEffect, useState } from "react";
import type { FileListing } from "../../../shared/types";
import { ApiError, api, type FileSort } from "../api";
import { translateApiError, useI18n } from "../i18n";
import { CATEGORY_COLORS } from "../lib/categoryColors";
import {
  basenameOfPath,
  formatBytes,
  formatDate,
  formatNumber,
  formatPercent
} from "../lib/format";
import { Icon } from "./Icon";
import { useToast } from "./Toast";

const MIN_SIZE_OPTIONS = [
  { value: 0, labelKey: "files.minSizeAll" },
  { value: 10 * 1024 ** 2, labelKey: "files.minSize10" },
  { value: 100 * 1024 ** 2, labelKey: "files.minSize100" },
  { value: 1024 ** 3, labelKey: "files.minSize1g" }
] as const;

export function FilesTab({
  scanId,
  folderFilter,
  onClearFolder
}: {
  scanId: string;
  folderFilter: string | null;
  onClearFolder: () => void;
}) {
  const { t, lang } = useI18n();
  const { notify } = useToast();
  const [top, setTop] = useState(100);
  const [minSize, setMinSize] = useState(0);
  const [extensions, setExtensions] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sort, setSort] = useState<FileSort>("size_desc");
  const [listing, setListing] = useState<FileListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    void api
      .getScanFiles(
        scanId,
        {
          top,
          minSize,
          extensions,
          q: debouncedSearch,
          sort,
          folder: folderFilter
        },
        controller.signal
      )
      .then((nextListing) => {
        setListing(nextListing);
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        if (caught instanceof ApiError) setError(caught);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [scanId, top, minSize, extensions, debouncedSearch, sort, folderFilter, reloadToken]);

  const copyPath = async (path: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(path);
      notify(t("toast.copied"), "success");
    } catch {
      notify(t("toast.copyFailed"), "error");
    }
  };

  const reveal = async (path: string): Promise<void> => {
    try {
      await api.reveal(scanId, path);
    } catch (caught) {
      if (caught instanceof ApiError) {
        notify(translateApiError(caught, t), "error");
      } else {
        notify(t("toast.revealFailed"), "error");
      }
    }
  };

  return (
    <section className="panel files-panel">
      <div className="panel-heading">
        <div>
          <h2>{t("files.title")}</h2>
          <p>{t("files.subtitle")}</p>
        </div>
        <span className="panel-step">03</span>
      </div>

      <div className="files-toolbar">
        <div className="search-field files-search">
          <Icon name="search" size={16} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("files.searchPlaceholder")}
            aria-label={t("files.searchPlaceholder")}
          />
          {search ? (
            <button
              type="button"
              className="search-clear"
              onClick={() => setSearch("")}
              aria-label={t("common.clear")}
            >
              <Icon name="x" size={14} />
            </button>
          ) : null}
        </div>

        <label className="inline-field">
          <span>{t("files.minSize")}</span>
          <select value={minSize} onChange={(event) => setMinSize(Number(event.target.value))}>
            {MIN_SIZE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.labelKey)}
              </option>
            ))}
          </select>
        </label>

        <label className="inline-field">
          <span>{t("files.extensions")}</span>
          <input
            className="extensions-input"
            value={extensions}
            onChange={(event) => setExtensions(event.target.value)}
            placeholder={t("files.extensionsPlaceholder")}
            spellCheck={false}
          />
        </label>

        <label className="inline-field">
          <span>{t("files.top")}</span>
          <select value={top} onChange={(event) => setTop(Number(event.target.value))}>
            {[50, 100, 500].map((value) => (
              <option key={value} value={value}>
                {t("files.topOption", { count: value })}
              </option>
            ))}
          </select>
        </label>

        <label className="inline-field">
          <span>{t("files.sort")}</span>
          <select value={sort} onChange={(event) => setSort(event.target.value as FileSort)}>
            <option value="size_desc">{t("files.sortSizeDesc")}</option>
            <option value="size_asc">{t("files.sortSizeAsc")}</option>
            <option value="date_desc">{t("files.sortDateDesc")}</option>
            <option value="name_asc">{t("files.sortNameAsc")}</option>
          </select>
        </label>
      </div>

      <div className="files-meta-row">
        {folderFilter ? (
          <span className="filter-chip" title={folderFilter}>
            <Icon name="folder" size={14} />
            {t("files.scopeFolder", { path: basenameOfPath(folderFilter) })}
            <button
              type="button"
              className="filter-chip-clear"
              onClick={onClearFolder}
              aria-label={t("files.clearFolder")}
            >
              <Icon name="x" size={12} />
            </button>
          </span>
        ) : (
          <span className="filter-chip filter-chip-neutral">
            <Icon name="layers" size={14} />
            {t("files.scopeAll")}
          </span>
        )}
        <span className="muted small">{t("files.storedNote", { limit: listing?.storedLimit ?? 1000 })}</span>
        {listing ? (
          <span className="muted small files-count">
            {t("files.showing", {
              shown: formatNumber(listing.files.length, lang, 0),
              matched: formatNumber(listing.matched, lang, 0)
            })}
          </span>
        ) : null}
      </div>

      {error ? (
        <div className="notice notice-error">
          <Icon name="alert" size={17} />
          {translateApiError(error, t)}
          <button
            type="button"
            className="button button-ghost button-small"
            onClick={() => setReloadToken((value) => value + 1)}
          >
            {t("common.retry")}
          </button>
        </div>
      ) : null}

      {loading && !listing ? (
        <div className="state-panel state-panel-inline">
          <span className="spinner spinner-large" />
          <p>{t("files.loading")}</p>
        </div>
      ) : !listing || listing.files.length === 0 ? (
        <div className="empty-inline">{t("files.empty")}</div>
      ) : (
        <div className={`table-wrap ${loading ? "table-loading" : ""}`}>
          <table className="files-table">
            <thead>
              <tr>
                <th className="col-rank">{t("files.columnRank")}</th>
                <th>{t("files.columnName")}</th>
                <th className="col-number">{t("files.columnSize")}</th>
                <th className="col-number">{t("files.columnPercent")}</th>
                <th className="col-date">{t("files.columnModified")}</th>
                <th className="col-path">{t("files.columnPath")}</th>
                <th className="col-actions">{t("files.columnActions")}</th>
              </tr>
            </thead>
            <tbody>
              {listing.files.map((file, index) => (
                <tr key={file.path}>
                  <td className="col-rank">{index + 1}</td>
                  <td>
                    <div className="file-name-cell">
                      <span
                        className="file-category-dot"
                        style={{ background: CATEGORY_COLORS[file.category] }}
                      />
                      <span className="file-name" title={file.name}>
                        {file.name}
                      </span>
                      <span className="file-ext-badge">
                        {file.extension ? file.extension.toUpperCase() : "—"}
                      </span>
                    </div>
                  </td>
                  <td className="col-number mono">{formatBytes(file.size, lang)}</td>
                  <td className="col-number">
                    <span className="percent-cell">
                      {formatPercent(file.percentOfScope, lang)}
                    </span>
                  </td>
                  <td className="col-date">{formatDate(file.modifiedAt, lang)}</td>
                  <td className="col-path">
                    <code title={file.path}>{file.path}</code>
                  </td>
                  <td className="col-actions">
                    <button
                      type="button"
                      className="icon-button icon-button-small"
                      onClick={() => void copyPath(file.path)}
                      title={t("common.copy")}
                      aria-label={t("common.copy")}
                    >
                      <Icon name="copy" size={15} />
                    </button>
                    <button
                      type="button"
                      className="icon-button icon-button-small"
                      onClick={() => void reveal(file.path)}
                      title={t("common.openInExplorer")}
                      aria-label={t("common.openInExplorer")}
                    >
                      <Icon name="external" size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
