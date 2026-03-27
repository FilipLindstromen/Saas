"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

type Mode = "inbox" | "work" | "personal" | "all";

interface TopBarProps {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  /** When false, the inbox (uncategorized) workspace is hidden in the selector. */
  showUncategorizedWorkspace?: boolean;
  /** Opens the slide-out nav on small screens (sidebar lives in AppSidebar). */
  onOpenMobileNav?: () => void;
  /** Placed just left of the hamburger on small screens (e.g. AI next-actions). */
  beforeMenuSlot?: ReactNode;
  /** Project / area scope controls (ScopeBar); omit in inbox mode. Desktop only — mobile uses the items strip. */
  scopeSlot?: ReactNode;
}

const MODE_KEY: Record<Mode, string> = {
  work: "mode.work",
  personal: "mode.personal",
  inbox: "mode.inbox",
  all: "mode.all",
};

const WORKSPACE_MODES: Mode[] = ["all", "work", "personal", "inbox"];

function ModeGlyph({ mode }: { mode: Mode }) {
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true as const };
  switch (mode) {
    case "all":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      );
    case "work":
      return (
        <svg {...common}>
          <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
          <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
        </svg>
      );
    case "personal":
      return (
        <svg {...common}>
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
    case "inbox":
      return (
        <svg {...common}>
          <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
          <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
        </svg>
      );
  }
}

export function TopBar({
  mode,
  onModeChange,
  showUncategorizedWorkspace = true,
  onOpenMobileNav,
  beforeMenuSlot = null,
  scopeSlot = null,
}: TopBarProps) {
  const { t } = useI18n();
  const [isMobile, setIsMobile] = useState(false);
  const [workspaceSheetOpen, setWorkspaceSheetOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 768px)");
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!isMobile) setWorkspaceSheetOpen(false);
  }, [isMobile]);

  const workspaceModes = showUncategorizedWorkspace
    ? WORKSPACE_MODES
    : WORKSPACE_MODES.filter((m) => m !== "inbox");

  const pickMode = (m: Mode) => {
    onModeChange(m);
    setWorkspaceSheetOpen(false);
  };

  return (
    <header className="bd-topbar">
      <div className="bd-topbar-row">
        <div className="bd-topbar-pinned">
          <span className="bd-topbar-brand" aria-hidden>
            BD
          </span>
          {isMobile ? (
            <button
              type="button"
              className="bd-topbar-workspace-pill"
              aria-label={t("topBar.workspace")}
              aria-expanded={workspaceSheetOpen}
              aria-haspopup="listbox"
              onClick={() => setWorkspaceSheetOpen(true)}
            >
              <span className="bd-topbar-workspace-pill__label">{t(MODE_KEY[mode])}</span>
              <span className="bd-topbar-workspace-pill__icon">
                <ModeGlyph mode={mode} />
              </span>
            </button>
          ) : (
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
          )}
        </div>
        {scopeSlot && !isMobile ? (
          <div className="bd-topbar-scope-slot">{scopeSlot}</div>
        ) : (
          <div className="bd-topbar-grow" aria-hidden />
        )}
        {onOpenMobileNav ? (
          <div className="bd-topbar-end">
            {beforeMenuSlot}
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

      {isMobile && workspaceSheetOpen && (
        <div
          className="bd-scope-picker-backdrop"
          role="presentation"
          onClick={() => setWorkspaceSheetOpen(false)}
        >
          <div
            className="bd-panel bd-topbar-workspace-sheet"
            role="listbox"
            aria-label={t("topBar.workspace")}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bd-topbar-workspace-sheet__grab" aria-hidden />
            <div className="bd-topbar-workspace-sheet__head">
              <h3 className="bd-topbar-workspace-sheet__title">{t("topBar.workspace")}</h3>
              <button
                type="button"
                className="bd-btn"
                onClick={() => setWorkspaceSheetOpen(false)}
                aria-label={t("scope.cancel")}
                style={{ minWidth: 44, minHeight: 44, padding: "0.45rem", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="bd-topbar-workspace-sheet__list">
              {workspaceModes.map((m) => {
                const sel = mode === m;
                return (
                  <button
                    key={m}
                    type="button"
                    className="bd-btn bd-topbar-workspace-sheet__option"
                    role="option"
                    aria-selected={sel}
                    onClick={() => pickMode(m)}
                  >
                    <span className="bd-topbar-workspace-sheet__option-glyph" aria-hidden>
                      <ModeGlyph mode={m} />
                    </span>
                    <span className="bd-topbar-workspace-sheet__option-label">{t(MODE_KEY[m])}</span>
                    {sel ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <span style={{ width: 18 }} aria-hidden />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
