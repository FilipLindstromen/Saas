"use client";

import { useCallback, useEffect, useState } from "react";

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
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    setTheme(readTheme());
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && (e.newValue === "light" || e.newValue === "dark")) setTheme(e.newValue);
    };
    const onCustom = (e: Event) => {
      const d = (e as CustomEvent<string>).detail;
      if (d === "light" || d === "dark") setTheme(d);
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("saas-theme-change", onCustom as EventListener);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("saas-theme-change", onCustom as EventListener);
    };
  }, []);

  const toggle = useCallback(() => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
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
