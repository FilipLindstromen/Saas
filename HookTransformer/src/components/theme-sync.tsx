"use client";

import { useEffect } from "react";

const STORAGE_KEY = "saas-apps-theme";

function getInitialTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // ignore
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
}

export function ThemeSync() {
  useEffect(() => {
    const apply = (theme: string) => document.documentElement.setAttribute("data-theme", theme);
    apply(getInitialTheme());

    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && (e.newValue === "light" || e.newValue === "dark")) {
        apply(e.newValue);
      }
    };

    const onCustom = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (detail === "light" || detail === "dark") apply(detail);
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("saas-theme-change", onCustom as EventListener);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("saas-theme-change", onCustom as EventListener);
    };
  }, []);

  return null;
}
