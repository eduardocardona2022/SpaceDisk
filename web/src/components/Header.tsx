import type { Language } from "../i18n";
import { useI18n } from "../i18n";
import { Icon } from "./Icon";

export function Header({
  language,
  onLanguageChange,
  theme,
  onToggleTheme,
  onRefreshVolumes,
  refreshingVolumes
}: {
  language: Language;
  onLanguageChange: (language: Language) => void;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  onRefreshVolumes: () => void;
  refreshingVolumes: boolean;
}) {
  const { t } = useI18n();

  return (
    <header className="app-header">
      <div className="header-inner">
        <div className="brand">
          <span className="brand-logo" aria-hidden="true">
            <svg viewBox="0 0 64 64">
              <defs>
                <linearGradient id="brand-ring" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#6ea2ff" />
                  <stop offset="0.55" stopColor="#8b5cf6" />
                  <stop offset="1" stopColor="#2dd4bf" />
                </linearGradient>
              </defs>
              <circle cx="32" cy="32" r="17" fill="none" stroke="currentColor" strokeOpacity="0.14" strokeWidth="8" />
              <path
                d="M32 15a17 17 0 0 1 16.2 11.9"
                fill="none"
                stroke="url(#brand-ring)"
                strokeWidth="8"
                strokeLinecap="round"
              />
              <circle cx="32" cy="32" r="5.5" fill="none" stroke="#6ea2ff" strokeWidth="2" />
            </svg>
          </span>
          <div>
            <h1>{t("app.name")}</h1>
            <p>{t("app.tagline")}</p>
          </div>
        </div>

        <div className="header-controls">
          <button
            type="button"
            className="icon-button"
            onClick={onRefreshVolumes}
            title={t("header.refreshVolumes")}
            aria-label={t("header.refreshVolumes")}
          >
            <Icon name="refresh" className={refreshingVolumes ? "spin" : undefined} />
          </button>

          <label className="language-select">
            <Icon name="globe" size={16} />
            <select
              value={language}
              onChange={(event) => onLanguageChange(event.target.value as Language)}
              aria-label={t("header.language")}
            >
              <option value="es">{t("lang.es")}</option>
              <option value="en">{t("lang.en")}</option>
            </select>
          </label>

          <button
            type="button"
            className="icon-button"
            onClick={onToggleTheme}
            title={theme === "dark" ? t("header.themeLight") : t("header.themeDark")}
            aria-label={theme === "dark" ? t("header.themeLight") : t("header.themeDark")}
          >
            <Icon name={theme === "dark" ? "sun" : "moon"} />
          </button>
        </div>
      </div>
    </header>
  );
}
