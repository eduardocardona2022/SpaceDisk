import type { Language } from "../i18n";
import { useI18n } from "../i18n";
import type { ScanSummary } from "../../../shared/types";
import { formatBytes, formatDuration, formatNumber } from "../lib/format";
import { Icon, type IconName } from "./Icon";

export function SummaryCards({
  summary,
  language
}: {
  summary: ScanSummary;
  language: Language;
}) {
  const { t } = useI18n();

  const cards: Array<{ icon: IconName; label: string; value: string; tone?: string }> = [
    {
      icon: "layers",
      label: t("summary.total"),
      value: formatBytes(summary.totalBytes, language)
    },
    {
      icon: "file",
      label: t("summary.files"),
      value: formatNumber(summary.totalFiles, language, 0)
    },
    {
      icon: "folder",
      label: t("summary.folders"),
      value: formatNumber(summary.totalDirs, language, 0)
    },
    {
      icon: "clock",
      label: t("summary.duration"),
      value: formatDuration(summary.durationMs, language)
    },
    {
      icon: "alert",
      label: t("summary.errors"),
      value: formatNumber(summary.errorCount, language, 0),
      tone: summary.errorCount > 0 ? "warning" : undefined
    }
  ];

  return (
    <div className="summary-grid">
      {cards.map((card) => (
        <div key={card.label} className={`summary-card ${card.tone ? `summary-card-${card.tone}` : ""}`}>
          <span className="summary-icon">
            <Icon name={card.icon} size={19} />
          </span>
          <span className="summary-value">{card.value}</span>
          <span className="summary-label">{card.label}</span>
        </div>
      ))}
    </div>
  );
}
