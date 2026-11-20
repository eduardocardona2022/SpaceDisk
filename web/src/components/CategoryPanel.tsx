import type { Language } from "../i18n";
import { useI18n } from "../i18n";
import type { ScanSummary } from "../../../shared/types";
import { CATEGORY_COLORS } from "../lib/categoryColors";
import { formatBytes, formatNumber, formatPercent } from "../lib/format";

export function CategoryPanel({
  summary,
  language
}: {
  summary: ScanSummary;
  language: Language;
}) {
  const { t, categoryLabel } = useI18n();
  const total = summary.totalBytes;
  const categories = summary.categories.filter((category) => category.bytes > 0);

  let cursor = 0;
  const segments = categories.map((category) => {
    const percent = total > 0 ? (category.bytes / total) * 100 : 0;
    const segment = {
      ...category,
      percent,
      start: cursor,
      end: cursor + percent,
      color: CATEGORY_COLORS[category.id]
    };
    cursor += percent;
    return segment;
  });

  const gradient =
    segments.length > 0
      ? `conic-gradient(${segments
          .map((segment) => `${segment.color} ${segment.start}% ${segment.end}%`)
          .join(", ")})`
      : "conic-gradient(var(--border-strong) 0% 100%)";

  const extensions = summary.extensions.slice(0, 8);
  const maxExtension = extensions[0]?.bytes ?? 0;

  return (
    <div className="overview-grid">
      <section className="panel category-panel">
        <div className="panel-heading compact">
          <div>
            <h2>{t("summary.categories")}</h2>
            <p>{t("summary.categoriesHint")}</p>
          </div>
        </div>

        {categories.length === 0 ? (
          <div className="empty-inline">{t("summary.empty")}</div>
        ) : (
          <div className="category-content">
            <div
              className="category-donut"
              style={{ background: gradient }}
              role="img"
              aria-label={t("summary.categories")}
            >
              <div className="category-donut-hole">
                <strong>{formatBytes(total, language)}</strong>
                <span>{t("summary.total")}</span>
              </div>
            </div>

            <div className="category-legend">
              {segments.map((segment) => (
                <div className="legend-row" key={segment.id}>
                  <span className="legend-dot" style={{ background: segment.color }} />
                  <span className="legend-name">{categoryLabel(segment.id)}</span>
                  <span className="legend-value">{formatBytes(segment.bytes, language)}</span>
                  <span className="legend-percent">{formatPercent(segment.percent, language)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="panel extensions-panel">
        <div className="panel-heading compact">
          <div>
            <h2>{t("summary.topExtensions")}</h2>
            <p>
              {t("summary.uniqueExtensions", {
                count: formatNumber(summary.uniqueExtensions, language, 0)
              })}
            </p>
          </div>
        </div>

        {extensions.length === 0 ? (
          <div className="empty-inline">{t("summary.empty")}</div>
        ) : (
          <div className="extension-list">
            {extensions.map((extension) => {
              const percent = maxExtension > 0 ? (extension.bytes / maxExtension) * 100 : 0;
              return (
                <div className="extension-row" key={extension.extension || "none"}>
                  <span className="extension-name">
                    {extension.extension ? `.${extension.extension}` : t("summary.noExtension")}
                  </span>
                  <span className="extension-bar">
                    <span style={{ width: `${Math.max(2, percent)}%` }} />
                  </span>
                  <span className="extension-size">{formatBytes(extension.bytes, language)}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
