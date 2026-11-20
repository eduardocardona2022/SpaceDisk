import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import type { CategoryId } from "../../../shared/categories";
import { en } from "./en";
import { es, type TranslationKey } from "./es";

export type Language = "es" | "en";
export type { TranslationKey };

const dictionaries: Record<Language, Record<TranslationKey, string>> = { es, en };
const STORAGE_KEY = "spacedisk.lang";

interface I18nContextValue {
  lang: Language;
  setLang: (language: Language) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  categoryLabel: (category: CategoryId) => string;
  presetLabel: (presetId: string) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function readInitialLanguage(): Language {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "en" ? "en" : "es";
  } catch {
    return "es";
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Language>(readInitialLanguage);

  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // Storage can be unavailable in private mode.
    }
  }, [lang]);

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>) => {
      const template = dictionaries[lang][key] ?? key;
      if (!params) return template;
      return template.replace(/\{\{(\w+)\}\}/g, (_match, name: string) =>
        params[name] !== undefined ? String(params[name]) : `{{${name}}}`
      );
    },
    [lang]
  );

  useEffect(() => {
    document.title = t("app.title");
  }, [t]);

  const categoryLabel = useCallback(
    (category: CategoryId) => t(`category.${category}` as TranslationKey),
    [t]
  );

  const presetLabel = useCallback(
    (presetId: string) => {
      const key = `preset.${presetId}` as TranslationKey;
      return key in dictionaries[lang] ? t(key) : presetId;
    },
    [lang, t]
  );

  const value = useMemo<I18nContextValue>(
    () => ({ lang, setLang, t, categoryLabel, presetLabel }),
    [lang, setLang, t, categoryLabel, presetLabel]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used inside I18nProvider");
  return context;
}

export function translateApiError(
  error: { code?: string; message?: string } | null | undefined,
  t: I18nContextValue["t"]
): string {
  if (!error) return t("error.generic");
  if (error.code) {
    const key = `error.${error.code}` as TranslationKey;
    if (key in es) return t(key);
  }
  return error.message || t("error.generic");
}
