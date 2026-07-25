"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Menu } from "lucide-react";
import { useI18n } from "@/lib/i18n";

type Mode = "inbox" | "work" | "personal" | "all";

interface TopBarProps {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  /** When false, the inbox (uncategorized) workspace is hidden in the selector. */
  showUncategorizedWorkspace?: boolean;
  /** Opens the slide-out nav on small screens (sidebar lives in AppSidebar). */
  onOpenMobileNav?: () => void;
  /** Project / area scope controls (ScopeBar); omit in inbox mode. Desktop only — mobile uses the items strip. */
  scopeSlot?: ReactNode;
}

const MODE_KEY: Record<Mode, string> = {
  work: "mode.work",
  personal: "mode.personal",
  inbox: "mode.inbox",
  all: "mode.all",
};

/** Modes cycled by swiping the workspace label. */
const SWIPE_MODES: Mode[] = ["all", "personal", "work"];

const SWIPE_THRESHOLD_PX = 48;

function workspaceSwipeIndex(mode: Mode): number {
  const idx = SWIPE_MODES.indexOf(mode);
  return idx >= 0 ? idx : 0;
}

function WorkspaceSwipeLabel({
  mode,
  onModeChange,
}: {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
}) {
  const { t } = useI18n();
  const pointerRef = useRef<{ x: number; y: number; active: boolean } | null>(null);
  const [dragOffset, setDragOffset] = useState(0);

  const swipeIndex = workspaceSwipeIndex(mode);
  const displayMode = mode === "inbox" ? mode : SWIPE_MODES[swipeIndex];

  const cycle = useCallback(
    (direction: -1 | 1) => {
      const next = SWIPE_MODES[(swipeIndex + direction + SWIPE_MODES.length) % SWIPE_MODES.length];
      onModeChange(next);
    },
    [onModeChange, swipeIndex]
  );

  const resetDrag = useCallback(() => {
    pointerRef.current = null;
    setDragOffset(0);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    pointerRef.current = { x: e.clientX, y: e.clientY, active: true };
    setDragOffset(0);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const p = pointerRef.current;
    if (!p?.active) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    if (Math.abs(dy) > Math.abs(dx) * 1.25) return;
    setDragOffset(dx);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const p = pointerRef.current;
    if (!p?.active) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    if (Math.abs(dx) >= SWIPE_THRESHOLD_PX && Math.abs(dx) > Math.abs(dy)) {
      cycle(dx < 0 ? 1 : -1);
    }
    resetDrag();
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const onPointerCancel = () => resetDrag();

  const prevMode = SWIPE_MODES[(swipeIndex - 1 + SWIPE_MODES.length) % SWIPE_MODES.length];
  const nextMode = SWIPE_MODES[(swipeIndex + 1) % SWIPE_MODES.length];

  return (
    <div
      className="bd-topbar-workspace-swipe"
      role="group"
      aria-label={t("topBar.workspaceSwipe")}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onPointerLeave={onPointerCancel}
    >
      <span className="bd-topbar-workspace-swipe__peek bd-topbar-workspace-swipe__peek--prev" aria-hidden>
        {t(MODE_KEY[prevMode])}
      </span>
      <span
        className="bd-topbar-workspace-swipe__label"
        style={{ transform: dragOffset ? `translateX(${dragOffset * 0.35}px)` : undefined }}
      >
        {t(MODE_KEY[displayMode])}
      </span>
      <span className="bd-topbar-workspace-swipe__peek bd-topbar-workspace-swipe__peek--next" aria-hidden>
        {t(MODE_KEY[nextMode])}
      </span>
    </div>
  );
}

export function TopBar({
  mode,
  onModeChange,
  showUncategorizedWorkspace: _showUncategorizedWorkspace = true,
  onOpenMobileNav,
  scopeSlot = null,
}: TopBarProps) {
  const { t } = useI18n();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 768px)");
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return (
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
              <circle cx="14" cy="14" r="13" fill="url(#bd-logo-bg)" opacity="0.15" />
              <path
                d="M14 5.5C11.5 5.5 9.5 7 9 9c-1.2.3-2.5 1.4-2.5 3 0 1 .5 2 1.2 2.5C7.25 15.3 7 16.2 7 17c0 2.5 1.8 4 3.5 4 .6 0 1.2-.2 1.7-.5.5.3 1.1.5 1.8.5s1.3-.2 1.8-.5c.5.3 1.1.5 1.7.5 1.7 0 3.5-1.5 3.5-4 0-.8-.25-1.7-.7-2.5.7-.5 1.2-1.5 1.2-2.5 0-1.6-1.3-2.7-2.5-3-.5-2-2.5-3.5-5-3.5z"
                fill="url(#bd-logo-fill)"
                stroke="url(#bd-logo-stroke)"
                strokeWidth="0.75"
              />
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
          <WorkspaceSwipeLabel mode={mode} onModeChange={onModeChange} />
        </div>
        {scopeSlot && !isMobile ? (
          <div className="bd-topbar-scope-slot">{scopeSlot}</div>
        ) : (
          <div className="bd-topbar-grow" aria-hidden />
        )}
        {onOpenMobileNav && isMobile ? (
          <div className="bd-topbar-end">
            <button
              type="button"
              className="bd-btn bd-topbar-menu-btn"
              onClick={onOpenMobileNav}
              title={t("sidebar.menu")}
              aria-label={t("sidebar.menu")}
            >
              <Menu size={22} strokeWidth={2} aria-hidden />
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
