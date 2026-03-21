"use client";

import { ThemeToggle } from "./ThemeToggle";
import { useI18n, type Locale } from "@/lib/i18n";

type Mode = "inbox" | "work" | "personal" | "all";

interface TopBarProps {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  onOpenSettings?: () => void;
}

const MODE_KEY: Record<Mode, string> = {
  work: "mode.work",
  personal: "mode.personal",
  inbox: "mode.inbox",
  all: "mode.all",
};

export function TopBar({ mode, onModeChange: _onModeChange, onOpenSettings }: TopBarProps) {
  const { t, locale, setLocale } = useI18n();

  return (
    <header
      className="bd-topbar"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
      }}
    >
      <h1
        className="bd-mobile-hide"
        style={{
          fontWeight: 700,
          fontSize: "clamp(1.05rem, 3.5vw, 1.25rem)",
          color: "var(--text-primary)",
          margin: 0,
          letterSpacing: "-0.02em",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          minWidth: 0,
          flex: "0 1 auto",
          maxWidth: "min(42vw, 11rem)",
        }}
      >
        {t("topBar.title")}
      </h1>
      <span className="bd-mobile-mode-pill" title={t(MODE_KEY[mode])}>
        {t(MODE_KEY[mode])}
      </span>
      <span className="bd-mobile-hide" style={{ fontSize: "0.875rem", color: "var(--text-tertiary)", flexShrink: 0 }}>
        {t(MODE_KEY[mode])}
      </span>
      <div style={{ flex: 1, minWidth: 0 }} />
      <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", flexShrink: 0 }}>
        <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.8125rem", color: "var(--text-tertiary)" }}>
          <span className="bd-mobile-hide">{t("lang.label")}</span>
          <select
            className="bd-input bd-topbar-lang"
            value={locale}
            onChange={(e) => setLocale(e.target.value as Locale)}
            aria-label={t("lang.label")}
            style={{ padding: "0.4rem 0.5rem", fontSize: "0.8125rem", minWidth: "5.5rem", cursor: "pointer" }}
          >
            <option value="en">{t("lang.english")}</option>
            <option value="sv">{t("lang.swedish")}</option>
          </select>
        </label>
        <ThemeToggle />
        <button
          type="button"
          className="bd-btn bd-mobile-icon-btn"
          onClick={onOpenSettings}
          title={t("topBar.settings")}
          aria-label={t("topBar.settings")}
          style={{ padding: "0.45rem 0.65rem", fontSize: "0.8125rem", minWidth: "44px", minHeight: "44px" }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="12" cy="12" r="3" />
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          </svg>
          <span className="bd-mobile-btn-text" style={{ marginLeft: "0.35rem" }}>
            {t("topBar.settings")}
          </span>
        </button>
      </div>
    </header>
  );
}
