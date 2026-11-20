import type { VolumeInfo } from "../../../shared/types";
import type { Language } from "../i18n";
import { useI18n } from "../i18n";
import { formatBytes, formatPercent } from "../lib/format";

function volumeLabel(volume: VolumeInfo, t: ReturnType<typeof useI18n>["t"]): string {
  if (volume.name) return volume.name;
  return t(`volumes.type.${volume.type}` as Parameters<typeof t>[0]);
}

export function VolumeCard({
  volume,
  language,
  onScan
}: {
  volume: VolumeInfo;
  language: Language;
  onScan: (path: string) => void;
}) {
  const { t } = useI18n();
  const percent = volume.totalBytes > 0 ? (volume.usedBytes / volume.totalBytes) * 100 : 0;
  const tone = percent >= 92 ? "critical" : percent >= 78 ? "warning" : "normal";

  return (
    <button
      type="button"
      className={`volume-card volume-${tone} ${volume.ready ? "" : "volume-disabled"}`}
      onClick={() => volume.ready && onScan(volume.mountPath)}
      disabled={!volume.ready}
      title={volume.ready ? t("volumes.scan") : t("volumes.notReady")}
    >
      <div className="volume-top">
        <div className="volume-donut-wrap">
          <svg viewBox="0 0 44 44" className="volume-donut" aria-hidden="true">
            <circle className="donut-track" cx="22" cy="22" r="17" />
            <circle
              className="donut-value"
              cx="22"
              cy="22"
              r="17"
              pathLength={100}
              strokeDasharray={`${Math.min(100, percent)} 100`}
              transform="rotate(-90 22 22)"
            />
          </svg>
          <span className="volume-donut-label">{Math.round(percent)}%</span>
        </div>
        <div className="volume-heading">
          <div className="volume-title-row">
            <span className="volume-name">{volumeLabel(volume, t)}</span>
            <span className="drive-badge">{volume.id}</span>
          </div>
          <span className="volume-type">
            {t(`volumes.type.${volume.type}` as Parameters<typeof t>[0])}
            {volume.fileSystem ? ` · ${volume.fileSystem}` : ""}
          </span>
        </div>
      </div>

      {volume.ready ? (
        <>
          <div className="volume-stats">
            <span>
              <small>{t("volumes.used")}</small>
              {formatBytes(volume.usedBytes, language)}
            </span>
            <span>
              <small>{t("volumes.free")}</small>
              {formatBytes(volume.freeBytes, language)}
            </span>
            <span>
              <small>{t("volumes.total")}</small>
              {formatBytes(volume.totalBytes, language)}
            </span>
          </div>
          <div className="volume-bar" aria-hidden="true">
            <span style={{ width: `${Math.min(100, percent)}%` }} />
          </div>
          <span className="volume-scan-label">
            {t("volumes.scan")} · {formatPercent(percent, language)}
          </span>
        </>
      ) : (
        <div className="volume-unavailable">{t("volumes.notReady")}</div>
      )}
    </button>
  );
}
