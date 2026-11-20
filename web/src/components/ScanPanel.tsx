import { useEffect, useMemo, useState } from "react";
import { EXCLUSION_PRESETS } from "../../../shared/presets";
import type { ScanJobInfo, ScanOptions, VolumeInfo } from "../../../shared/types";
import { ApiError } from "../api";
import { translateApiError, useI18n } from "../i18n";
import { isDriveRootPath } from "../lib/format";
import { ConfirmDialog } from "./ConfirmDialog";
import { FolderPicker } from "./FolderPicker";
import { Icon } from "./Icon";

interface ScanPreferences {
  path?: string;
  excludeSystemDirs?: boolean;
  presets?: string[];
  customPatterns?: string;
  maxDepth?: number | null;
}

const PREFS_KEY = "spacedisk.scanPrefs";

function readPreferences(): ScanPreferences {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as ScanPreferences;
  } catch {
    return {};
  }
}

export function ScanPanel({
  volumes,
  job,
  pathRequest,
  onStart
}: {
  volumes: VolumeInfo[];
  job: ScanJobInfo | null;
  pathRequest?: { path: string; token: number } | null;
  onStart: (options: ScanOptions, replace: boolean) => Promise<void>;
}) {
  const { t, presetLabel } = useI18n();
  const [initialPreferences] = useState(readPreferences);
  const [targetPath, setTargetPath] = useState(initialPreferences.path ?? "");
  const [excludeSystemDirs, setExcludeSystemDirs] = useState(
    initialPreferences.excludeSystemDirs ?? true
  );
  const [selectedPresets, setSelectedPresets] = useState<string[]>(
    initialPreferences.presets ?? []
  );
  const [customPatterns, setCustomPatterns] = useState(initialPreferences.customPatterns ?? "");
  const [maxDepth, setMaxDepth] = useState(
    initialPreferences.maxDepth === null || initialPreferences.maxDepth === undefined
      ? ""
      : String(initialPreferences.maxDepth)
  );
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (pathRequest) setTargetPath(pathRequest.path);
  }, [pathRequest?.token, pathRequest?.path]);

  useEffect(() => {
    const preferences: ScanPreferences = {
      path: targetPath,
      excludeSystemDirs,
      presets: selectedPresets,
      customPatterns,
      maxDepth: maxDepth === "" ? null : Number(maxDepth)
    };
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(preferences));
    } catch {
      // Ignore storage errors.
    }
  }, [targetPath, excludeSystemDirs, selectedPresets, customPatterns, maxDepth]);

  const excludePatterns = useMemo(() => {
    const presets = EXCLUSION_PRESETS.filter((preset) => selectedPresets.includes(preset.id)).flatMap(
      (preset) => preset.patterns
    );
    const custom = customPatterns
      .split(/[\n,]+/)
      .map((pattern) => pattern.trim())
      .filter(Boolean);
    return [...new Set([...presets, ...custom])];
  }, [selectedPresets, customPatterns]);

  const trimmedPath = targetPath.trim();
  const activeVolume = volumes.find(
    (volume) => volume.ready && trimmedPath.toLowerCase().startsWith(volume.mountPath.toLowerCase())
  );
  const driveWarning = isDriveRootPath(trimmedPath);
  const networkWarning = activeVolume?.type === "network" || trimmedPath.startsWith("\\\\");
  const hasExistingScan =
    job?.status === "running" || job?.status === "completed";

  const startNow = async (replace: boolean): Promise<void> => {
    setStarting(true);
    setError(null);
    try {
      await onStart(
        {
          root: trimmedPath,
          excludePatterns,
          excludeSystemDirs,
          maxDepth: maxDepth === "" ? null : Number(maxDepth)
        },
        replace
      );
    } catch (caught) {
      if (caught instanceof ApiError) setError(translateApiError(caught, t));
      else setError(t("scan.errorStart"));
    } finally {
      setStarting(false);
    }
  };

  const requestStart = (): void => {
    if (!trimmedPath) {
      setError(t("scan.errorPath"));
      return;
    }
    if (hasExistingScan) {
      setConfirmOpen(true);
      return;
    }
    void startNow(false);
  };

  const togglePreset = (presetId: string): void => {
    setSelectedPresets((current) =>
      current.includes(presetId)
        ? current.filter((id) => id !== presetId)
        : [...current, presetId]
    );
  };

  return (
    <section className="panel scan-panel">
      <div className="panel-heading">
        <div>
          <h2>{t("scan.title")}</h2>
          <p>{t("scan.subtitle")}</p>
        </div>
        <span className="panel-step">01</span>
      </div>

      <div className="scan-path-row">
        <div className="path-field">
          <Icon name="folder" size={18} />
          <input
            value={targetPath}
            onChange={(event) => setTargetPath(event.target.value)}
            placeholder={t("scan.pathPlaceholder")}
            aria-label={t("scan.path")}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
          />
        </div>
        <button type="button" className="button button-secondary" onClick={() => setPickerOpen(true)}>
          <Icon name="folder" size={16} />
          {t("scan.browse")}
        </button>
        <button
          type="button"
          className="button button-primary"
          onClick={requestStart}
          disabled={starting || !trimmedPath}
        >
          {starting ? <span className="spinner" /> : <Icon name="search" size={16} />}
          {starting
            ? t("scan.starting")
            : hasExistingScan
              ? t("scan.replaceStart")
              : t("scan.start")}
        </button>
      </div>

      {volumes.length > 0 ? (
        <div className="drive-shortcuts">
          <span className="muted small">{t("scan.drives")}</span>
          <div className="chip-row">
            {volumes
              .filter((volume) => volume.ready)
              .map((volume) => (
                <button
                  key={volume.id}
                  type="button"
                  className={`chip chip-button ${targetPath === volume.mountPath ? "chip-active" : ""}`}
                  onClick={() => setTargetPath(volume.mountPath)}
                  title={volume.name || volume.mountPath}
                >
                  <Icon name="hard-drive" size={14} />
                  {volume.id}
                  {volume.name ? <span className="chip-name">{volume.name}</span> : null}
                </button>
              ))}
          </div>
        </div>
      ) : null}

      <button
        type="button"
        className="advanced-toggle"
        onClick={() => setAdvancedOpen((value) => !value)}
        aria-expanded={advancedOpen}
      >
        <Icon name={advancedOpen ? "chevron-down" : "chevron-right"} size={15} />
        {advancedOpen ? t("scan.advancedHide") : t("scan.advanced")}
      </button>

      {advancedOpen ? (
        <div className="advanced-grid">
          <label className="switch-row">
            <span className="switch">
              <input
                type="checkbox"
                checked={excludeSystemDirs}
                onChange={(event) => setExcludeSystemDirs(event.target.checked)}
              />
              <span className="switch-track">
                <span className="switch-thumb" />
              </span>
            </span>
            <span>
              <strong>{t("scan.excludeSystem")}</strong>
              <small>{t("scan.excludeSystemHint")}</small>
            </span>
          </label>

          <div className="field-group">
            <span className="field-label">{t("scan.presets")}</span>
            <div className="chip-row">
              {EXCLUSION_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={`chip chip-button ${selectedPresets.includes(preset.id) ? "chip-active" : ""}`}
                  onClick={() => togglePreset(preset.id)}
                  title={preset.patterns.join(", ")}
                >
                  {presetLabel(preset.id)}
                </button>
              ))}
            </div>
            <small className="field-hint">{t("scan.presetsHint")}</small>
          </div>

          <div className="field-group">
            <label className="field-label" htmlFor="custom-patterns">
              {t("scan.customPatterns")}
            </label>
            <textarea
              id="custom-patterns"
              value={customPatterns}
              onChange={(event) => setCustomPatterns(event.target.value)}
              placeholder={t("scan.customPatternsPlaceholder")}
              rows={3}
              spellCheck={false}
            />
          </div>

          <div className="field-group">
            <label className="field-label" htmlFor="max-depth">
              {t("scan.maxDepth")}
            </label>
            <select
              id="max-depth"
              value={maxDepth}
              onChange={(event) => setMaxDepth(event.target.value)}
            >
              <option value="">{t("scan.depthUnlimited")}</option>
              {[0, 1, 2, 3, 5, 10].map((depth) => (
                <option key={depth} value={String(depth)}>
                  {t("scan.depthLevels", { count: depth })}
                </option>
              ))}
            </select>
            <small className="field-hint">{t("scan.depthHint")}</small>
          </div>
        </div>
      ) : null}

      {driveWarning ? (
        <div className="notice notice-warning">
          <Icon name="alert" size={17} />
          {t("scan.warningDrive")}
        </div>
      ) : null}
      {networkWarning ? (
        <div className="notice notice-warning">
          <Icon name="globe" size={17} />
          {t("scan.warningNetwork")}
        </div>
      ) : null}
      {error ? (
        <div className="notice notice-error" role="alert">
          <Icon name="alert" size={17} />
          {error}
          <button
            type="button"
            className="notice-close"
            onClick={() => setError(null)}
            aria-label={t("common.close")}
          >
            <Icon name="x" size={14} />
          </button>
        </div>
      ) : null}

      <p className="muted tiny">{t("scan.oneAtATime")}</p>

      <ConfirmDialog
        open={confirmOpen}
        title={t("scan.replaceTitle")}
        message={t("scan.replaceMessage")}
        confirmLabel={t("scan.replaceConfirm")}
        cancelLabel={t("common.cancel")}
        danger
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          void startNow(true);
        }}
      />

      <FolderPicker
        open={pickerOpen}
        initialPath={targetPath}
        volumes={volumes}
        onClose={() => setPickerOpen(false)}
        onSelect={(path) => {
          setTargetPath(path);
          setPickerOpen(false);
        }}
      />
    </section>
  );
}
