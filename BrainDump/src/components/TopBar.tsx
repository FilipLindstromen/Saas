"use client";

import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n";

type Mode = "inbox" | "work" | "personal" | "all";

interface TopBarProps {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  /** When false, the inbox (uncategorized) workspace is hidden in the selector. */
  showUncategorizedWorkspace?: boolean;
  /** Opens the slide-out nav on small screens (sidebar lives in AppSidebar). */
  onOpenMobileNav?: () => void;
  /** Project / area scope controls (ScopeBar); omit in inbox mode. */
  scopeSlot?: ReactNode;
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
  scopeSlot = null,
}: TopBarProps) {
  const { t } = useI18n();

  const workspaceModes = showUncategorizedWorkspace
    ? WORKSPACE_MODES
    : WORKSPACE_MODES.filter((m) => m !== "inbox");

  return (
    <header className="bd-topbar">
      <div className="bd-topbar-row">
        <div className="bd-topbar-pinned">
          <span className="bd-topbar-brand" aria-hidden>
            BD
          </span>
          <select
            id="bd-topbar-workspace"
            className="bd-input bd-topbar-workspace-select"
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
        </div>
        {scopeSlot ? <div className="bd-topbar-scope-slot">{scopeSlot}</div> : <div className="bd-topbar-grow" aria-hidden />}
        {onOpenMobileNav ? (
          <div className="bd-topbar-end">
            <button
              type="button"
              className="bd-btn bd-topbar-menu-btn"
              onClick={onOpenMobileNav}
              title={t("sidebar.menu")}
              aria-label={t("sidebar.menu")}
            >
              <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <line x1="4" y1="6" x2="20" y2="6" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="18" x2="20" y2="18" />
              </svg>
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
