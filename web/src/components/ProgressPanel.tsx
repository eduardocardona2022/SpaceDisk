import { useEffect, useState } from "react";
import type { ScanJobInfo } from "../../../shared/types";
import { useI18n } from "../i18n";
import { formatBytes, formatDuration, formatNumber } from "../lib/format";
import { Icon } from "./Icon";

export function ProgressPanel({
  job,
  onCancel
}: {
  job: ScanJobInfo;
  onCancel: () => Promise<void>;
}) {
  const { t, lang } = useI18n();
  const [now, setNow] = useState(Date.now());
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (job.status !== "running") return;
    const interval = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(interval);
  }, [job.status]);

  const elapsedMs =
    job.status === "running"
      ? Math.max(0, now - new Date(job.startedAt).getTime())
      : job.elapsedMs;

  const handleCancel = async (): Promise<void> => {
    setCancelling(true);
    setError(null);
    try {
      await onCancel();
    } catch {
      setError(t("error.generic"));
    } finally {
      setCancelling(false);
    }
  };

  return (
    <section className="panel progress-panel" aria-live="polite">
      <div className="progress-heading">
        <div className="progress-title">
          <span className="pulse-dot" aria-hidden="true" />
          <div>
            <h2>{t("progress.title")}</h2>
            <p>{t("progress.subtitle")}</p>
          </div>
        </div>
        <button
          type="button"
          className="button button-danger-ghost"
          onClick={() => void handleCancel()}
          disabled={cancelling}
        >
          {cancelling ? <span className="spinner" /> : <Icon name="x" size={16} />}
          {cancelling ? t("progress.cancelling") : t("progress.cancel")}
        </button>
      </div>

      <div className="progress-bar" role="progressbar" aria-label={t("progress.title")}>
        <span className="progress-bar-fill" />
      </div>
      <div className="progress-caption">
        <span>{t("progress.indeterminate")}</span>
        <span className="mono">{formatDuration(elapsedMs, lang)}</span>
      </div>

      <div className="progress-stats">
        <div className="stat">
          <span className="stat-icon">
            <Icon name="file" size={17} />
          </span>
          <span>
            <small>{t("progress.files")}</small>
            <strong>{formatNumber(job.progress.filesScanned, lang, 0)}</strong>
          </span>
        </div>
        <div className="stat">
          <span className="stat-icon">
            <Icon name="folder" size={17} />
          </span>
          <span>
            <small>{t("progress.folders")}</small>
            <strong>{formatNumber(job.progress.dirsScanned, lang, 0)}</strong>
          </span>
        </div>
        <div className="stat">
          <span className="stat-icon">
            <Icon name="layers" size={17} />
          </span>
          <span>
            <small>{t("progress.scanned")}</small>
            <strong>{formatBytes(job.progress.bytesScanned, lang)}</strong>
          </span>
        </div>
        <div className="stat">
          <span className="stat-icon stat-icon-warning">
            <Icon name="alert" size={17} />
          </span>
          <span>
            <small>{t("progress.errors")}</small>
            <strong>{formatNumber(job.progress.errorCount, lang, 0)}</strong>
          </span>
        </div>
      </div>

      <div className="progress-current">
        <span className="muted small">{t("progress.current")}</span>
        <code title={job.progress.currentPath ?? job.options.root}>
          {job.progress.currentPath ?? job.options.root}
        </code>
      </div>

      {error ? <div className="notice notice-error">{error}</div> : null}
      <div className="progress-root">
        <Icon name="hard-drive" size={14} />
        <span title={job.options.root}>{job.options.root}</span>
      </div>
    </section>
  );
}
