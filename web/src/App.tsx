import { useEffect, useRef, useState } from "react";
import type { ScanOptions } from "../../shared/types";
import { translateApiError, useI18n } from "./i18n";
import { useScan } from "./hooks/useScan";
import { useTheme } from "./hooks/useTheme";
import { useVolumes } from "./hooks/useVolumes";
import {
  basenameOfPath,
  formatNumber
} from "./lib/format";
import { CategoryPanel } from "./components/CategoryPanel";
import { ErrorPanel } from "./components/ErrorPanel";
import { FilesTab } from "./components/FilesTab";
import { FoldersTab } from "./components/FoldersTab";
import { Header } from "./components/Header";
import { Icon } from "./components/Icon";
import { ProgressPanel } from "./components/ProgressPanel";
import { ScanPanel } from "./components/ScanPanel";
import { SummaryCards } from "./components/SummaryCards";
import { VolumeCard } from "./components/VolumeCard";

type ResultTab = "overview" | "files" | "folders";

export function App() {
  const { t, lang, setLang } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const volumesState = useVolumes();
  const scan = useScan();
  const [tab, setTab] = useState<ResultTab>("overview");
  const [folderFilter, setFolderFilter] = useState<string | null>(null);
  const [pathRequest, setPathRequest] = useState<{ path: string; token: number } | null>(null);
  const lastStatusRef = useRef<string | null>(null);

  const { refresh: refreshVolumes } = volumesState;
  const jobStatus = scan.job?.status ?? null;

  useEffect(() => {
    if (jobStatus === "completed" && lastStatusRef.current !== "completed") {
      void refreshVolumes();
      window.setTimeout(() => {
        document.getElementById("scan-results")?.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      }, 120);
    }
    lastStatusRef.current = jobStatus;
  }, [jobStatus, refreshVolumes]);

  const handleStart = async (options: ScanOptions, replace: boolean): Promise<void> => {
    await scan.start(options, replace);
    setTab("overview");
    setFolderFilter(null);
    window.setTimeout(() => {
      document.getElementById("scan-progress")?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }, 150);
  };

  const handleSelectDrive = (path: string): void => {
    setPathRequest({ path, token: Date.now() });
    document.getElementById("scan-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleShowFiles = (path: string): void => {
    setFolderFilter(path);
    setTab("files");
  };

  const handleReset = (): void => {
    scan.reset();
    setTab("overview");
    setFolderFilter(null);
  };

  const volumeError = volumesState.error ? translateApiError(volumesState.error, t) : null;
  const scanError = scan.error ? translateApiError(scan.error, t) : null;
  const summary = scan.job?.summary ?? null;

  return (
    <div className="app-shell">
      <Header
        language={lang}
        onLanguageChange={setLang}
        theme={theme}
        onToggleTheme={toggleTheme}
        onRefreshVolumes={() => void refreshVolumes()}
        refreshingVolumes={volumesState.refreshing}
      />

      <main className="app-main">
        <section className="section-block">
          <div className="section-heading">
            <div>
              <span className="eyebrow">{t("volumes.eyebrow")}</span>
              <h2>{t("volumes.title")}</h2>
              <p>{t("volumes.subtitle")}</p>
            </div>
            <span className="section-meta">
              {formatNumber(volumesState.volumes.filter((volume) => volume.ready).length, lang, 0)}{" "}
              {t("common.of")}{" "}
              {formatNumber(volumesState.volumes.length, lang, 0)}
            </span>
          </div>

          {volumesState.loading && volumesState.volumes.length === 0 ? (
            <div className="volume-grid">
              {[0, 1, 2].map((index) => (
                <div className="volume-card volume-skeleton" key={index}>
                  <span className="skeleton skeleton-circle" />
                  <span className="skeleton skeleton-line" />
                  <span className="skeleton skeleton-line short" />
                </div>
              ))}
            </div>
          ) : volumesState.volumes.length === 0 ? (
            <div className="panel empty-inline">{t("volumes.empty")}</div>
          ) : (
            <div className="volume-grid">
              {volumesState.volumes.map((volume) => (
                <VolumeCard
                  key={volume.id}
                  volume={volume}
                  language={lang}
                  onScan={handleSelectDrive}
                />
              ))}
            </div>
          )}

          {volumeError ? (
            <div className="notice notice-error">
              <Icon name="alert" size={17} />
              {volumeError}
              <button
                type="button"
                className="button button-ghost button-small"
                onClick={() => void refreshVolumes()}
              >
                {t("common.retry")}
              </button>
            </div>
          ) : null}
        </section>

        <div id="scan-panel" className="section-anchor">
          <ScanPanel
            volumes={volumesState.volumes}
            job={scan.job}
            pathRequest={pathRequest}
            onStart={handleStart}
          />
        </div>

        {scanError ? (
          <div className="notice notice-error">
            <Icon name="alert" size={17} />
            {scanError}
            <button
              type="button"
              className="button button-ghost button-small"
              onClick={scan.clearError}
            >
              {t("common.close")}
            </button>
          </div>
        ) : null}

        {scan.job?.status === "running" ? (
          <div id="scan-progress" className="section-anchor">
            <ProgressPanel job={scan.job} onCancel={scan.cancel} />
          </div>
        ) : null}

        {(scan.job?.status === "failed" || scan.job?.status === "cancelled") && (
          <section className="panel status-panel">
            <span className="status-icon status-icon-error">
              <Icon name={scan.job.status === "failed" ? "alert" : "x"} size={22} />
            </span>
            <div className="status-copy">
              <h2>
                {scan.job.status === "failed"
                  ? t("status.failedTitle")
                  : t("status.cancelledTitle")}
              </h2>
              <p>
                {scan.job.status === "failed"
                  ? translateApiError(scan.job.error, t)
                  : t("status.cancelledMessage")}
              </p>
            </div>
            <button type="button" className="button button-secondary" onClick={handleReset}>
              <Icon name="refresh" size={16} />
              {t("status.startNew")}
            </button>
          </section>
        )}

        {scan.job?.status === "completed" && summary ? (
          <section className="results-section section-anchor" id="scan-results">
            <div className="results-heading">
              <div>
                <span className="eyebrow">{t("summary.resultsEyebrow")}</span>
                <h2>{basenameOfPath(scan.job.options.root)}</h2>
                <p title={scan.job.options.root}>{scan.job.options.root}</p>
              </div>
              <span className="status-pill">
                <Icon name="check" size={15} />
                {t("summary.completed")}
              </span>
            </div>

            <SummaryCards summary={summary} language={lang} />

            <div className="result-tabs" role="tablist" aria-label={t("summary.title")}>
              <button
                type="button"
                role="tab"
                aria-selected={tab === "overview"}
                className={`result-tab ${tab === "overview" ? "result-tab-active" : ""}`}
                onClick={() => setTab("overview")}
              >
                <Icon name="layers" size={16} />
                {t("tabs.overview")}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === "files"}
                className={`result-tab ${tab === "files" ? "result-tab-active" : ""}`}
                onClick={() => setTab("files")}
              >
                <Icon name="file" size={16} />
                {t("tabs.files")}
                <span className="tab-badge">{formatNumber(summary.totalFiles, lang, 0)}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === "folders"}
                className={`result-tab ${tab === "folders" ? "result-tab-active" : ""}`}
                onClick={() => setTab("folders")}
              >
                <Icon name="folder" size={16} />
                {t("tabs.folders")}
                <span className="tab-badge">{formatNumber(summary.totalDirs, lang, 0)}</span>
              </button>
            </div>

            <div className="result-content" role="tabpanel">
              {tab === "overview" ? (
                <div className="overview-tab">
                  <CategoryPanel summary={summary} language={lang} />
                  <ErrorPanel summary={summary} />
                </div>
              ) : null}

              {tab === "files" ? (
                <FilesTab
                  scanId={scan.job.id}
                  folderFilter={folderFilter}
                  onClearFolder={() => setFolderFilter(null)}
                />
              ) : null}

              {tab === "folders" ? (
                <FoldersTab
                  listing={scan.listing}
                  loading={scan.listingLoading}
                  error={scan.listingError}
                  onNavigate={scan.navigate}
                  onShowFiles={handleShowFiles}
                  onRetry={scan.reloadListing}
                />
              ) : null}
            </div>
          </section>
        ) : null}
      </main>

      <footer className="app-footer">
        <span>{t("app.footer")}</span>
        <span>{t("app.footerPrivacy")}</span>
      </footer>
    </div>
  );
}
