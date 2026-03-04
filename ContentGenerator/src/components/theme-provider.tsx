"use client";

import { useEffect } from "react";

/**
 * Initializes shared Saas theme (applyTheme, initThemeSync).
 * ThemeToggle is rendered in the page header.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    try {
      const { applyTheme, initThemeSync } = require("@shared/theme");
      applyTheme?.();
      return initThemeSync?.();
    } catch {
      // Theme module may be unavailable; app still works
    }
  }, []);

  return <>{children}</>;
}

