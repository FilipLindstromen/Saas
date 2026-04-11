"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
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
  /** Placed on the right end of the top bar (both mobile and desktop). */
  endSlot?: ReactNode;
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
  const common = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true as const };
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
  endSlot = null,
  scopeSlot = null,
}: TopBarProps) {
  const { t } = useI18n();
  const [isMobile, setIsMobile] = useState(false);
  const [workspaceSheetOpen, setWorkspaceSheetOpen] = useState(false);
  const [sheetMount, setSheetMount] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setSheetMount(document.body);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 768px)");
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!workspaceSheetOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setWorkspaceSheetOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [workspaceSheetOpen]);

  useEffect(() => {
    if (!workspaceSheetOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [workspaceSheetOpen]);

  const workspaceModes = showUncategorizedWorkspace
    ? WORKSPACE_MODES
    : WORKSPACE_MODES.filter((m) => m !== "inbox");

  const pickMode = (m: Mode) => {
    onModeChange(m);
    setWorkspaceSheetOpen(false);
  };

  const workspaceSheet =
    workspaceSheetOpen && sheetMount
      ? createPortal(
          <div
            className="bd-scope-picker-backdrop bd-topbar-workspace-backdrop"
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
                  style={{
                    minWidth: 44,
                    minHeight: 44,
                    padding: "0.45rem",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
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
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : (
                        <span style={{ width: 20 }} aria-hidden />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>,
          sheetMount
        )
      : null;

  return (
    <>
    <header className="bd-topbar">
      <div className="bd-topbar-row">
        <div className="bd-topbar-pinned">
          <span className="bd-topbar-brand" aria-label="BrainDump">
            <svg
              width="28"
              height="28"
              viewBox="0 0 28 28"
              fill="none"
              aria-hidden="true"
              style={{ display: "block", flexShrink: 0 }}
            >
              {/* Outer glow ring */}
              <circle cx="14" cy="14" r="13" fill="url(#bd-logo-bg)" opacity="0.15" />
              {/* Brain outline */}
              <path
                d="M14 5.5C11.5 5.5 9.5 7 9 9c-1.2.3-2.5 1.4-2.5 3 0 1 .5 2 1.2 2.5C7.25 15.3 7 16.2 7 17c0 2.5 1.8 4 3.5 4 .6 0 1.2-.2 1.7-.5.5.3 1.1.5 1.8.5s1.3-.2 1.8-.5c.5.3 1.1.5 1.7.5 1.7 0 3.5-1.5 3.5-4 0-.8-.25-1.7-.7-2.5.7-.5 1.2-1.5 1.2-2.5 0-1.6-1.3-2.7-2.5-3-.5-2-2.5-3.5-5-3.5z"
                fill="url(#bd-logo-fill)"
                stroke="url(#bd-logo-stroke)"
                strokeWidth="0.75"
              />
              {/* Neural highlight lines */}
              <path d="M14 9v4m-2.5-2h5m-4 2.5 1.5 2.5 1.5-2.5" stroke="url(#bd-logo-lines)" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
              <defs>
                <linearGradient id="bd-logo-bg" x1="1" y1="1" x2="27" y2="27" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#ff8f6b" />
                  <stop offset="1" stopColor="#e85d2d" />
                </linearGradient>
                <linearGradient id="bd-logo-fill" x1="7" y1="5.5" x2="21" y2="21" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#ff9e7a" />
                  <stop offset="1" stopColor="#e85d2d" />
                </linearGradient>
                <linearGradient id="bd-logo-stroke" x1="7" y1="5.5" x2="21" y2="21" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#ffb89a" />
                  <stop offset="1" stopColor="#c2410c" />
                </linearGradient>
                <linearGradient id="bd-logo-lines" x1="11.5" y1="9" x2="14" y2="16" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#fff5f0" />
                  <stop offset="1" stopColor="#fff0ea" />
                </linearGradient>
              </defs>
            </svg>
            <span className="bd-topbar-brand-text">BrainDump</span>
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
            <button
              id="bd-topbar-workspace"
              type="button"
              className="bd-input bd-topbar-workspace-select bd-topbar-workspace-desktop-trigger"
              aria-label={t("topBar.workspace")}
              aria-expanded={workspaceSheetOpen}
              aria-haspopup="listbox"
              onClick={() => setWorkspaceSheetOpen(true)}
            >
              <span className="bd-topbar-workspace-desktop-trigger__label">{t(MODE_KEY[mode])}</span>
              <svg
                className="bd-topbar-workspace-desktop-trigger__chev"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
          )}
        </div>
        {scopeSlot && !isMobile ? (
          <div className="bd-topbar-scope-slot">{scopeSlot}</div>
        ) : (
          <div className="bd-topbar-grow" aria-hidden />
        )}
        {onOpenMobileNav && isMobile ? (
          <div className="bd-topbar-end">
            {endSlot}
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
        {!isMobile && endSlot ? (
          <div className="bd-topbar-end" style={{ display: "flex", alignItems: "center" }}>
            {endSlot}
          </div>
        ) : null}
      </div>
    </header>
    {workspaceSheet}
    </>
  );
}
