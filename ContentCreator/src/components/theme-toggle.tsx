"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "saas-apps-theme";

function readTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    /* ignore */
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
}

function getThemeSnapshot(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "light" || attr === "dark") return attr;
  return readTheme();
}

function subscribe(onChange: () => void) {
  const handler = () => onChange();
  window.addEventListener("storage", handler);
  window.addEventListener("saas-theme-change", handler as EventListener);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener("saas-theme-change", handler as EventListener);
  };
}

function applyTheme(theme: "light" | "dark") {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
    window.dispatchEvent(new CustomEvent("saas-theme-change", { detail: theme }));
  } catch {
    /* ignore */
  }
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getThemeSnapshot, () => "light");

  const toggle = useCallback(() => {
    applyTheme(theme === "dark" ? "light" : "dark");
  }, [theme]);

  return (
    <button
      type="button"
      onClick={toggle}
      className="cc-btn-secondary !px-3 !py-2 !text-sm"
      title={theme === "dark" ? "Use light theme" : "Use dark theme"}
      aria-label={theme === "dark" ? "Use light theme" : "Use dark theme"}
      aria-pressed={theme === "dark"}
    >
      {theme === "dark" ? "Light" : "Dark"}
    </button>
  );
}
