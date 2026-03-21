"use client";

import { ThemeToggle } from "./ThemeToggle";
import { useI18n } from "@/lib/i18n";

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
  const { t } = useI18n();

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
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V15a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          <span className="bd-mobile-btn-text" style={{ marginLeft: "0.35rem" }}>
            {t("topBar.settings")}
          </span>
        </button>
      </div>
    </header>
  );
}
