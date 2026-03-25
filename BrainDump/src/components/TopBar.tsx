"use client";

import { useEffect, useState } from "react";
import { ThemeToggle } from "./ThemeToggle";
import { StreaksModal } from "./StreaksModal";
import { useI18n } from "@/lib/i18n";
import { getDumpStreakState, STREAK_RECORDED_EVENT, type DumpStreakState } from "@/lib/dump-streak";

type Mode = "inbox" | "work" | "personal" | "all";

interface TopBarProps {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  onOpenSettings?: () => void;
  /** When false, the inbox (uncategorized) workspace is hidden in the selector. */
  showUncategorizedWorkspace?: boolean;
}

const MODE_KEY: Record<Mode, string> = {
  work: "mode.work",
  personal: "mode.personal",
  inbox: "mode.inbox",
  all: "mode.all",
};

const WORKSPACE_MODES: Mode[] = ["all", "work", "personal", "inbox"];

export function TopBar({
  mode,
  onModeChange,
  onOpenSettings,
  showUncategorizedWorkspace = true,
}: TopBarProps) {
  const { t } = useI18n();
  const [streakState, setStreakState] = useState<DumpStreakState>(() => getDumpStreakState());
  const [streaksOpen, setStreaksOpen] = useState(false);

  useEffect(() => {
    const sync = () => setStreakState(getDumpStreakState());
    sync();
    window.addEventListener(STREAK_RECORDED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(STREAK_RECORDED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const workspaceModes = showUncategorizedWorkspace
    ? WORKSPACE_MODES
    : WORKSPACE_MODES.filter((m) => m !== "inbox");

  return (
    <>
    <header
      className="bd-topbar"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        position: "relative",
      }}
    >
      <div
        className="bd-topbar-left"
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          minWidth: 0,
          justifyContent: "flex-start",
        }}
      >
        <h1
          className="bd-display-heading bd-mobile-hide"
          style={{
            fontWeight: 600,
            fontSize: "clamp(1.15rem, 3.8vw, 1.45rem)",
            color: "var(--text-primary)",
            margin: 0,
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
        <select
          id="bd-topbar-workspace"
          className="bd-input bd-mobile-mode-select bd-topbar-workspace-select"
          aria-label={t("topBar.workspace")}
          value={mode}
          onChange={(e) => onModeChange(e.target.value as Mode)}
        >
          {workspaceModes.map((m) => (
            <option key={m} value={m}>
              {t(MODE_KEY[m])}
            </option>
          ))}
        </select>
        <span className="bd-mobile-hide" style={{ fontSize: "0.875rem", color: "var(--text-tertiary)", flexShrink: 0 }}>
          {t(MODE_KEY[mode])}
        </span>
      </div>
      <span className="bd-topbar-mark" aria-hidden>
        BD
      </span>
      <div
        className="bd-topbar-actions"
        style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "0.35rem", flexShrink: 0, minWidth: 0 }}
      >
        <ThemeToggle />
        <button
          type="button"
          className="bd-btn bd-mobile-icon-btn bd-topbar-streaks-btn"
          onClick={() => setStreaksOpen(true)}
          title={t("topBar.streaks")}
          aria-label={t("topBar.streaks")}
          style={{
            padding: "0.45rem 0.65rem",
            fontSize: "0.8125rem",
            minWidth: "44px",
            minHeight: "44px",
            position: "relative",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.25rem",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3.5a2.5 2.5 0 0 0 2.5 2.5z" />
          </svg>
          <span
            className="bd-topbar-streaks-badge"
            style={{
              fontSize: "0.65rem",
              fontWeight: 700,
              minWidth: "1.1rem",
              height: "1.1rem",
              padding: "0 0.35rem",
              borderRadius: "999px",
              background: "var(--accent-muted)",
              color: "var(--accent)",
              lineHeight: 1.1,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            aria-hidden
          >
            {streakState.currentStreak}
          </span>
          <span className="bd-mobile-btn-text" style={{ marginLeft: "0.35rem" }}>
            {t("topBar.streaks")}
          </span>
        </button>
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
    <StreaksModal isOpen={streaksOpen} onClose={() => setStreaksOpen(false)} state={streakState} />
    </>
  );
}
