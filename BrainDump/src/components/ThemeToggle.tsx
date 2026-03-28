"use client";

import { useI18n } from "@/lib/i18n";
import { useSaasTheme } from "@/lib/saas-theme-client";

type ThemeToggleProps = {
  /** When true, show the current mode label (Light / Dark) like other sidebar rows. */
  showLabels: boolean;
};

export function ThemeToggle({ showLabels }: ThemeToggleProps) {
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

  const actionLabel = theme === "dark" ? t("theme.switchToLight") : t("theme.switchToDark");
  const modeLabel = theme === "dark" ? t("theme.darkMode") : t("theme.lightMode");

  const icon =
    theme === "dark" ? (
      <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
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
      <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    );

  return (
    <button
      type="button"
      className="bd-app-sidebar-nav-btn"
      data-collapsed={!showLabels ? "true" : "false"}
      onClick={toggle}
      title={actionLabel}
      aria-label={actionLabel}
    >
      <span className="bd-app-sidebar-nav-icon">{icon}</span>
      {showLabels ? <span className="bd-app-sidebar-nav-label">{modeLabel}</span> : null}
    </button>
  );
}
