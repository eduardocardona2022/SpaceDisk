import type { ScanSummary } from "../../../shared/types";
import { useI18n } from "../i18n";
import { formatNumber } from "../lib/format";
import { Icon } from "./Icon";

export function ErrorPanel({ summary }: { summary: ScanSummary }) {
  const { t, lang } = useI18n();

  if (summary.errorCount === 0 && summary.errors.length === 0) return null;

  return (
    <details className="panel error-panel">
      <summary>
        <span className="error-summary-icon">
          <Icon name="alert" size={17} />
        </span>
        <span className="error-summary-title">{t("summary.accessErrors")}</span>
        <span className="error-count">
          {formatNumber(summary.errorCount, lang, 0)}
        </span>
        <Icon name="chevron-down" size={16} className="details-chevron" />
      </summary>
      <div className="error-list">
        {summary.errors.map((error) => (
          <div className="error-row" key={`${error.path}:${error.code}`}>
            <span className="error-code">{error.code}</span>
            <code title={error.path}>{error.path}</code>
            <span className="error-message" title={error.message}>
              {error.message}
            </span>
          </div>
        ))}
        {summary.errorCount > summary.errors.length ? (
          <p className="muted small">
            {t("summary.moreErrors", {
              shown: summary.errors.length,
              total: summary.errorCount
            })}
          </p>
        ) : null}
      </div>
    </details>
  );
}
