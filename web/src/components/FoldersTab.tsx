import type { DirListing } from "../../../shared/types";
import type { ApiError } from "../api";
import { translateApiError, useI18n } from "../i18n";
import { formatBytes, formatNumber, formatPercent } from "../lib/format";
import { Icon } from "./Icon";
import { Treemap } from "./Treemap";

export function FoldersTab({
  listing,
  loading,
  error,
  onNavigate,
  onShowFiles,
  onRetry
}: {
  listing: DirListing | null;
  loading: boolean;
  error: ApiError | null;
  onNavigate: (path: string) => void;
  onShowFiles: (path: string) => void;
  onRetry: () => void;
}) {
  const { t, lang } = useI18n();

  if (loading && !listing) {
    return (
      <section className="panel state-panel">
        <span className="spinner spinner-large" />
        <p>{t("folders.loading")}</p>
      </section>
    );
  }

  if (error && !listing) {
    return (
      <section className="panel state-panel">
        <Icon name="alert" size={28} />
        <h2>{t("folders.error")}</h2>
        <p>{translateApiError(error, t)}</p>
        <button type="button" className="button button-secondary" onClick={onRetry}>
          <Icon name="refresh" size={16} />
          {t("common.retry")}
        </button>
      </section>
    );
  }

  if (!listing) {
    return <section className="panel state-panel">{t("folders.empty")}</section>;
  }

  const parent =
    listing.breadcrumb.length > 1
      ? listing.breadcrumb[listing.breadcrumb.length - 2]
      : null;
  const hasContent = listing.children.length > 0 || listing.ownBytes > 0;

  return (
    <div className="folders-tab">
      <section className="panel folder-header">
        <div className="folder-breadcrumb-row">
          <button
            type="button"
            className="icon-button"
            onClick={() => parent && onNavigate(parent.path)}
            disabled={!parent}
            title={t("folders.up")}
            aria-label={t("folders.up")}
          >
            <Icon name="arrow-up" />
          </button>
          <div className="breadcrumbs">
            {listing.breadcrumb.map((item, index) => {
              const isLast = index === listing.breadcrumb.length - 1;
              return (
                <span className="breadcrumb-item-wrap" key={item.path}>
                  {index > 0 ? (
                    <Icon name="chevron-right" size={12} className="breadcrumb-sep" />
                  ) : null}
                  <button
                    type="button"
                    className={`breadcrumb-button ${isLast ? "breadcrumb-current" : ""}`}
                    onClick={() => onNavigate(item.path)}
                    disabled={isLast}
                  >
                    {item.name}
                  </button>
                </span>
              );
            })}
          </div>
        </div>

        <div className="folder-summary-row">
          <div className="folder-title">
            <span className="folder-icon-large">
              <Icon name="folder" size={24} />
            </span>
            <div>
              <h2>{listing.name}</h2>
              <p title={listing.path}>{listing.path}</p>
            </div>
          </div>
          <div className="folder-totals">
            <span>
              <small>{t("summary.total")}</small>
              <strong>{formatBytes(listing.bytes, lang)}</strong>
            </span>
            <span>
              <small>{t("summary.files")}</small>
              <strong>{formatNumber(listing.files, lang, 0)}</strong>
            </span>
            <span>
              <small>{t("summary.folders")}</small>
              <strong>{formatNumber(listing.dirs + 1, lang, 0)}</strong>
            </span>
          </div>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => onShowFiles(listing.path)}
          >
            <Icon name="file" size={16} />
            {t("folders.viewFiles")}
          </button>
        </div>
      </section>

      <Treemap listing={listing} onNavigate={onNavigate} />

      <section className="panel folder-list-panel">
        <div className="panel-heading compact">
          <div>
            <h2>{t("folders.subfolders")}</h2>
            <p>{t("folders.subtitle")}</p>
          </div>
          <span className="panel-badge">
            {formatNumber(listing.childrenTotal, lang, 0)}
          </span>
        </div>

        {!hasContent ? (
          <div className="empty-inline">{t("folders.empty")}</div>
        ) : (
          <div className="folder-list">
            {listing.children.map((child) => {
              const percent = listing.bytes > 0 ? (child.bytes / listing.bytes) * 100 : 0;
              return (
                <button
                  type="button"
                  className="folder-row"
                  key={child.path}
                  onClick={() => onNavigate(child.path)}
                  title={child.path}
                >
                  <span className="folder-row-icon">
                    <Icon name="folder" size={18} />
                  </span>
                  <span className="folder-row-main">
                    <span className="folder-row-name">{child.name}</span>
                    <span className="folder-row-meta">
                      {t("folders.filesCount", {
                        count: formatNumber(child.files, lang, 0)
                      })}
                      <span className="dot-sep">·</span>
                      {t("folders.dirsCount", {
                        count: formatNumber(child.dirs, lang, 0)
                      })}
                    </span>
                  </span>
                  <span className="folder-row-bar" aria-hidden="true">
                    <span style={{ width: `${Math.max(1.5, percent)}%` }} />
                  </span>
                  <span className="folder-row-size">{formatBytes(child.bytes, lang)}</span>
                  <span className="folder-row-percent">{formatPercent(percent, lang)}</span>
                  <Icon name="chevron-right" size={16} className="folder-row-chevron" />
                </button>
              );
            })}

            {listing.ownBytes > 0 ? (
              <div className="folder-row folder-row-static">
                <span className="folder-row-icon">
                  <Icon name="file" size={18} />
                </span>
                <span className="folder-row-main">
                  <span className="folder-row-name">{t("folders.looseFiles")}</span>
                  <span className="folder-row-meta">
                    {t("folders.filesCount", {
                      count: formatNumber(listing.looseFiles.files, lang, 0)
                    })}
                  </span>
                </span>
                <span className="folder-row-bar" aria-hidden="true">
                  <span
                    style={{
                      width: `${
                        listing.bytes > 0
                          ? Math.max(1.5, (listing.ownBytes / listing.bytes) * 100)
                          : 0
                      }%`
                    }}
                  />
                </span>
                <span className="folder-row-size">{formatBytes(listing.ownBytes, lang)}</span>
                <span className="folder-row-percent">
                  {formatPercent(
                    listing.bytes > 0 ? (listing.ownBytes / listing.bytes) * 100 : 0,
                    lang
                  )}
                </span>
                <span className="folder-row-chevron" />
              </div>
            ) : null}
          </div>
        )}

        {listing.truncated ? (
          <p className="muted small">
            {t("folders.truncated", {
              shown: formatNumber(listing.children.length, lang, 0),
              total: formatNumber(listing.childrenTotal, lang, 0)
            })}
          </p>
        ) : null}
      </section>

      {loading ? (
        <div className="floating-loading">
          <span className="spinner" />
          {t("folders.loading")}
        </div>
      ) : null}
    </div>
  );
}
