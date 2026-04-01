"use client";

import { useEffect, useState } from "react";
import { BRAINDUMP_CLIENT_PREFS_APPLIED_EVENT } from "@/lib/client-preferences-sync";

/** Resolved app theme from `data-theme` / localStorage (matches ThemeToggle). */
export function useSaasTheme(): "light" | "dark" {
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("saas-apps-theme");
      if (stored === "light" || stored === "dark") setTheme(stored);
      else if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) setTheme("dark");
      else setTheme("light");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const onStorage = () => {
      try {
        const next = localStorage.getItem("saas-apps-theme");
        if (next === "light" || next === "dark") setTheme(next);
      } catch {
        /* ignore */
      }
    };
    const onThemeChange = (e: Event) => {
      try {
        const d = (e as CustomEvent<string>).detail;
        if (d === "light" || d === "dark") {
          setTheme(d);
          return;
        }
        onStorage();
      } catch {
        /* ignore */
      }
    };
    const onPrefsApplied = () => onStorage();
    window.addEventListener("storage", onStorage);
    window.addEventListener("saas-theme-change", onThemeChange);
    window.addEventListener(BRAINDUMP_CLIENT_PREFS_APPLIED_EVENT, onPrefsApplied);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("saas-theme-change", onThemeChange);
      window.removeEventListener(BRAINDUMP_CLIENT_PREFS_APPLIED_EVENT, onPrefsApplied);
    };
  }, []);

  return theme;
}
