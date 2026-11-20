import { useEffect, useState } from "react";
import type { FsListing, VolumeInfo } from "../../../shared/types";
import { ApiError, api } from "../api";
import { translateApiError, useI18n } from "../i18n";
import { Icon } from "./Icon";
import { Modal } from "./Modal";

export function FolderPicker({
  open,
  initialPath,
  volumes,
  onClose,
  onSelect
}: {
  open: boolean;
  initialPath: string;
  volumes: VolumeInfo[];
  onClose: () => void;
  onSelect: (path: string) => void;
}) {
  const { t } = useI18n();
  const [currentPath, setCurrentPath] = useState("");
  const [listing, setListing] = useState<FsListing | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!open) return;
    const fallback = volumes.find((volume) => volume.ready)?.mountPath ?? "";
    setCurrentPath(initialPath.trim() || fallback);
    setSearch("");
    setError(null);
    setListing(null);
    setReloadToken(0);
    // Only reset when the picker is opened, not when volumes are refreshed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialPath]);

  useEffect(() => {
    if (!open || !currentPath) return;

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    void api
      .browseDirs(currentPath, controller.signal)
      .then((nextListing) => {
        setListing(nextListing);
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setListing(null);
        setError(
          caught instanceof ApiError
            ? translateApiError(caught, t)
            : t("picker.error")
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [open, currentPath, reloadToken, t]);

  const readyVolumes = volumes.filter((volume) => volume.ready);
  const filteredEntries = (listing?.entries ?? []).filter((entry) =>
    entry.name.toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <Modal
      open={open}
      title={t("picker.title")}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <button type="button" className="button button-ghost" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className="button button-primary"
            onClick={() => {
              if (currentPath) onSelect(listing?.path ?? currentPath);
            }}
            disabled={!currentPath || loading || Boolean(error)}
          >
            <Icon name="check" size={16} />
            {t("picker.selectCurrent")}
          </button>
        </>
      }
    >
      <div className="picker-drives">
        <span className="picker-label">{t("picker.drives")}</span>
        <div className="chip-row">
          {readyVolumes.map((volume) => (
            <button
              key={volume.id}
              type="button"
              className={`chip chip-button ${currentPath.startsWith(volume.mountPath) ? "chip-active" : ""}`}
              onClick={() => setCurrentPath(volume.mountPath)}
            >
              <Icon name="hard-drive" size={14} />
              {volume.id}
            </button>
          ))}
        </div>
      </div>

      <div className="picker-pathbar">
        <button
          type="button"
          className="icon-button"
          onClick={() => listing?.parent && setCurrentPath(listing.parent)}
          disabled={!listing?.parent}
          title={t("picker.up")}
          aria-label={t("picker.up")}
        >
          <Icon name="arrow-up" />
        </button>
        <div className="breadcrumbs picker-breadcrumbs">
          {listing?.breadcrumb.map((item, index) => {
            const isLast = index === (listing.breadcrumb.length - 1);
            return (
              <span key={item.path} className="breadcrumb-item-wrap">
                {index > 0 && <Icon name="chevron-right" size={12} className="breadcrumb-sep" />}
                <button
                  type="button"
                  className={`breadcrumb-button ${isLast ? "breadcrumb-current" : ""}`}
                  onClick={() => setCurrentPath(item.path)}
                  disabled={isLast}
                >
                  {item.name}
                </button>
              </span>
            );
          })}
        </div>
      </div>

      <div className="picker-toolbar">
        <div className="search-field">
          <Icon name="search" size={16} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("picker.search")}
            aria-label={t("picker.search")}
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
        <code className="picker-current" title={currentPath}>
          {currentPath || "—"}
        </code>
      </div>

      <div className="picker-list">
        {!currentPath ? (
          <div className="empty-inline">{t("volumes.empty")}</div>
        ) : loading ? (
          <div className="inline-loading">
            <span className="spinner" />
            {t("picker.loading")}
          </div>
        ) : error ? (
          <div className="inline-error">
            <Icon name="alert" size={16} />
            <span>{error}</span>
            <button
              type="button"
              className="button button-ghost button-small"
              onClick={() => setReloadToken((value) => value + 1)}
            >
              {t("common.retry")}
            </button>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="empty-inline">{t("picker.empty")}</div>
        ) : (
          filteredEntries.map((entry) => (
            <button
              key={entry.path}
              type="button"
              className="picker-entry"
              onClick={() => {
                setSearch("");
                setCurrentPath(entry.path);
              }}
            >
              <Icon name="folder" size={17} />
              <span>{entry.name}</span>
              <Icon name="chevron-right" size={14} className="picker-entry-arrow" />
            </button>
          ))
        )}
      </div>

      {listing?.truncated ? (
        <p className="muted small">
          {t("picker.truncated", { count: listing.entries.length })}
        </p>
      ) : null}
    </Modal>
  );
}
