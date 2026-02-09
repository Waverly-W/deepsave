"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import type { Locale, TranslationKey } from "./i18n";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE_NAME,
  LOCALE_STORAGE_KEY,
  createTranslator,
  resolveLocale
} from "./i18n";

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  initialLocale,
  children
}: {
  initialLocale?: Locale;
  children: React.ReactNode;
}) {
  const [locale, setLocale] = useState<Locale>(initialLocale ?? DEFAULT_LOCALE);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    const resolved = resolveLocale(stored);
    if (resolved && resolved !== locale) {
      setLocale(resolved);
      persistLocale(resolved);
      return;
    }
    persistLocale(locale);
  }, [locale]);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const value = useMemo(() => {
    const t = createTranslator(locale);
    return {
      locale,
      setLocale: (next: Locale) => {
        setLocale(next);
        persistLocale(next);
      },
      t
    };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return context;
}

function persistLocale(locale: Locale) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  document.cookie = `${LOCALE_COOKIE_NAME}=${encodeURIComponent(
    locale
  )}; path=/; max-age=31536000; samesite=lax`;
  document.documentElement.lang = locale;
}
