"use client";

import { useI18n } from "@/lib/i18n";

type Mode = "inbox" | "work" | "personal" | "all";

interface TopBarProps {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  /** When false, the inbox (uncategorized) workspace is hidden in the selector. */
  showUncategorizedWorkspace?: boolean;
  /** Opens the slide-out nav on small screens (sidebar lives in AppSidebar). */
  onOpenMobileNav?: () => void;
  /** Hide the workspace dropdown on desktop; show only on narrow viewports (sidebar handles workspace on desktop). */
  workspaceSelectorMobileOnly?: boolean;
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
  showUncategorizedWorkspace = true,
  onOpenMobileNav,
  workspaceSelectorMobileOnly = false,
}: TopBarProps) {
  const { t } = useI18n();

  const workspaceModes = showUncategorizedWorkspace
    ? WORKSPACE_MODES
    : WORKSPACE_MODES.filter((m) => m !== "inbox");

  return (
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
        {onOpenMobileNav ? (
          <button
            type="button"
            className="bd-btn bd-topbar-menu-btn"
            onClick={onOpenMobileNav}
            title={t("sidebar.menu")}
            aria-label={t("sidebar.menu")}
            style={{
              flexShrink: 0,
              minWidth: 44,
              minHeight: 44,
              padding: "0.35rem",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <line x1="4" y1="6" x2="20" y2="6" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="18" x2="20" y2="18" />
            </svg>
          </button>
        ) : null}
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
          className={`bd-input bd-mobile-mode-select bd-topbar-workspace-select${workspaceSelectorMobileOnly ? " bd-workspace-select-mobile-only" : ""}`}
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
        className="bd-topbar-actions bd-topbar-actions--chrome-only"
        style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "0.35rem", flexShrink: 0, minWidth: 0 }}
        aria-hidden
      />
    </header>
  );
}
