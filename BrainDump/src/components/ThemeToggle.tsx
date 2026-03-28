"use client";

import { useI18n } from "@/lib/i18n";
import { useSaasTheme } from "@/lib/saas-theme-client";

type ThemeToggleProps = {
  className?: string;
};

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { t } = useI18n();
  const theme = useSaasTheme();

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("saas-apps-theme", next);
      window.dispatchEvent(new CustomEvent("saas-theme-change", { detail: next }));
    } catch {
      /* ignore */
    }
  };

  const label = theme === "dark" ? t("theme.switchToLight") : t("theme.switchToDark");

  return (
    <button
      type="button"
      onClick={toggle}
      className={className ? `bd-btn bd-theme-toggle ${className}` : "bd-btn bd-theme-toggle"}
      title={label}
      aria-label={label}
      style={{ padding: "0.5rem" }}
    >
      {theme === "dark" ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}
