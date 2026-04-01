"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  BRAINDUMP_CLIENT_PREFS_APPLIED_EVENT,
  scheduleClientPreferencesUpload,
} from "@/lib/client-preferences-sync";
import { BRAINDUMP_LOCALE_KEY, interpolate, messages, type Locale } from "./messages";

export type { Locale };

type TFn = (key: string, vars?: Record<string, string | number>) => string;

interface I18nContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: TFn;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function readStoredLocale(): Locale {
  if (typeof window === "undefined") return "en";
  try {
    const s = localStorage.getItem(BRAINDUMP_LOCALE_KEY);
    if (s === "sv" || s === "en") return s;
  } catch {
    /* ignore */
  }
  return "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    const l = readStoredLocale();
    setLocaleState(l);
    if (typeof document !== "undefined") {
      document.documentElement.lang = l === "sv" ? "sv" : "en";
    }
  }, []);

  useEffect(() => {
    const sync = () => {
      const l = readStoredLocale();
      setLocaleState(l);
      if (typeof document !== "undefined") {
        document.documentElement.lang = l === "sv" ? "sv" : "en";
      }
    };
    window.addEventListener(BRAINDUMP_CLIENT_PREFS_APPLIED_EVENT, sync);
    return () => window.removeEventListener(BRAINDUMP_CLIENT_PREFS_APPLIED_EVENT, sync);
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem(BRAINDUMP_LOCALE_KEY, l);
    } catch {
      /* ignore */
    }
    if (typeof document !== "undefined") {
      document.documentElement.lang = l === "sv" ? "sv" : "en";
    }
    scheduleClientPreferencesUpload();
  }, []);

  const t = useCallback<TFn>(
    (key, vars) => {
      const table = messages[locale] ?? messages.en;
      const fallback = messages.en;
      let raw = table[key] ?? fallback[key] ?? key;
      if (vars && Object.keys(vars).length) raw = interpolate(raw, vars);
      return raw;
    },
    [locale]
  );

  const value = useMemo(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
