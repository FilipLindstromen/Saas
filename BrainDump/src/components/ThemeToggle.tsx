"use client";

import { Moon, Sun } from "lucide-react";
import { scheduleClientPreferencesUpload } from "@/lib/client-preferences-sync";
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
      scheduleClientPreferencesUpload();
    } catch {
      /* ignore */
    }
  };

  const actionLabel = theme === "dark" ? t("theme.switchToLight") : t("theme.switchToDark");
  const modeLabel = theme === "dark" ? t("theme.darkMode") : t("theme.lightMode");

  const icon =
    theme === "dark" ? (
      <Sun size={20} strokeWidth={2} aria-hidden />
    ) : (
      <Moon size={20} strokeWidth={2} aria-hidden />
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
