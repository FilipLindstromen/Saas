"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type AnimationEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { signOut, useSession } from "next-auth/react";
import { DeleteEntriesOverlay } from "./DeleteEntriesOverlay";
import { StreaksModal } from "./StreaksModal";
import { ThemeToggle } from "./ThemeToggle";
import { useI18n } from "@/lib/i18n";
import { getDumpStreakState, STREAK_RECORDED_EVENT, type DumpStreakState } from "@/lib/dump-streak";

const SIDEBAR_EXPANDED_KEY = "braindump-sidebar-expanded";

type Mode = "inbox" | "work" | "personal" | "all";

const MODE_KEY: Record<Mode, string> = {
  all: "mode.all",
  work: "mode.work",
  personal: "mode.personal",
  inbox: "mode.inbox",
};

const WORKSPACE_MODES: Mode[] = ["all", "work", "personal", "inbox"];

const modeIcons: Record<Mode, () => ReactNode> = {
  all: () => (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  work: () => (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
    </svg>
  ),
  personal: () => (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  inbox: () => (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  ),
};

type AppSidebarProps = {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  showUncategorizedWorkspace: boolean;
  onOpenSettings: () => void;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
};

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 768px)");
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return isMobile;
}

export function AppSidebar({
  mode: _mode,
  onModeChange: _onModeChange,
  showUncategorizedWorkspace: _showUncategorizedWorkspace,
  onOpenSettings,
  mobileOpen,
  onMobileOpenChange,
}: AppSidebarProps) {
  const { t } = useI18n();
  const { data: session } = useSession();
  const isMobile = useIsMobile();
  const [expanded, setExpanded] = useState(false);
  const [streakState, setStreakState] = useState<DumpStreakState>(() => getDumpStreakState());
  const [streaksOpen, setStreaksOpen] = useState(false);
  const [deleteEntriesOpen, setDeleteEntriesOpen] = useState(false);
  const [mobileDrawerExiting, setMobileDrawerExiting] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileBtnRef = useRef<HTMLButtonElement>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    try {
      const v = localStorage.getItem(SIDEBAR_EXPANDED_KEY);
      if (v === "1") setExpanded(true);
      else if (v === "0") setExpanded(false);
    } catch {
      /* ignore */
    }
  }, []);

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

  const persistExpanded = useCallback((next: boolean) => {
    setExpanded(next);
    try {
      localStorage.setItem(SIDEBAR_EXPANDED_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  const workspaceModes = showUncategorizedWorkspace ? WORKSPACE_MODES : WORKSPACE_MODES.filter((m) => m !== "inbox");

  const showLabels = isMobile || expanded;

  const updatePopoverPos = useCallback(() => {
    const el = profileBtnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const gap = 8;
    if (expanded || isMobile) {
      setPopoverPos({ top: r.bottom + gap, left: Math.max(12, Math.min(r.left, window.innerWidth - 268)) });
    } else {
      /* Sidebar rail on the right: open popover to the left of the avatar */
      setPopoverPos({ top: r.top, left: Math.max(12, r.left - 268) });
    }
  }, [expanded, isMobile]);

  useLayoutEffect(() => {
    if (!profileOpen || isMobile) {
      setPopoverPos(null);
      return;
    }
    updatePopoverPos();
    const onScroll = () => updatePopoverPos();
    const onResize = () => updatePopoverPos();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [profileOpen, isMobile, expanded, updatePopoverPos]);

  useEffect(() => {
    if (!isMobile || (!mobileOpen && !mobileDrawerExiting)) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isMobile, mobileOpen, mobileDrawerExiting]);

  useEffect(() => {
    setMobileDrawerExiting(false);
  }, [mobileOpen]);

  useEffect(() => {
    if (isMobile) return;
    setMobileDrawerExiting(false);
    if (mobileOpen) onMobileOpenChange(false);
  }, [isMobile, mobileOpen, onMobileOpenChange]);

  const closeMobileDrawerAnimated = useCallback(() => {
    setMobileDrawerExiting(true);
  }, []);

  const handleMobileDrawerAnimationEnd = useCallback((e: AnimationEvent<HTMLElement>) => {
    if (e.target !== e.currentTarget) return;
    const name = e.animationName || "";
    if (!name.includes("bd-sidebar-drawer-slide-out")) return;
    setMobileDrawerExiting(false);
    onMobileOpenChange(false);
  }, [onMobileOpenChange]);

  const pickMode = useCallback(
    (m: Mode) => {
      onModeChange(m);
      if (isMobile) closeMobileDrawerAnimated();
    },
    [onModeChange, isMobile, closeMobileDrawerAnimated]
  );

  const openSettings = () => {
    setProfileOpen(false);
    onOpenSettings();
    if (isMobile) closeMobileDrawerAnimated();
  };

  const user = session?.user;
  const displayName = user?.name?.trim() || user?.email?.split("@")[0] || "—";
  const email = user?.email ?? "";
  const initial = (displayName[0] || "?").toUpperCase();

  const sidebarBody = (
    <>
      {!isMobile && (
        <button
          type="button"
          className="bd-app-sidebar-fold"
          onClick={() => persistExpanded(!expanded)}
          title={expanded ? t("sidebar.collapse") : t("sidebar.expand")}
          aria-label={expanded ? t("sidebar.collapse") : t("sidebar.expand")}
          aria-expanded={expanded}
        >
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            {expanded ? <path d="m15 18-6-6 6-6" /> : <path d="m9 18 6-6-6-6" />}
          </svg>
        </button>
      )}

      {isMobile && (
        <div className="bd-app-sidebar-mobile-head">
          <span className="bd-app-sidebar-mobile-title">{t("sidebar.menu")}</span>
          <button
            type="button"
            className="bd-btn bd-app-sidebar-close"
            onClick={() => onMobileOpenChange(false)}
            aria-label={t("sidebar.closeMenu")}
          >
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <div className={`bd-app-sidebar-profile-wrap ${profileOpen ? "bd-app-sidebar-profile-wrap--open" : ""}`}>
        <button
          ref={profileBtnRef}
          type="button"
          className="bd-app-sidebar-profile-trigger"
          data-collapsed={!showLabels ? "true" : "false"}
          onClick={() => setProfileOpen((v) => !v)}
          aria-expanded={profileOpen}
          aria-haspopup="true"
          title={email || t("sidebar.profile")}
          aria-label={t("sidebar.profile")}
        >
          {user?.image ? (
            <img src={user.image} alt="" className="bd-app-sidebar-avatar" width={36} height={36} referrerPolicy="no-referrer" />
          ) : (
            <span className="bd-app-sidebar-avatar bd-app-sidebar-avatar--initial" aria-hidden>
              {initial}
            </span>
          )}
          {showLabels && (
            <span className="bd-app-sidebar-label-text">
              <span className="bd-app-sidebar-label-name">{displayName}</span>
              {email ? <span className="bd-app-sidebar-label-email">{email}</span> : null}
            </span>
          )}
        </button>

        {profileOpen && isMobile && (
          <div className="bd-app-sidebar-profile-menu bd-app-sidebar-profile-menu--inline" role="menu">
            {email ? (
              <p className="bd-app-sidebar-profile-muted">
                <span className="bd-app-sidebar-profile-muted-label">{t("sidebar.signedInAs")}</span>
                <span className="bd-app-sidebar-profile-email">{email}</span>
              </p>
            ) : null}
            <button type="button" className="bd-app-sidebar-profile-action" role="menuitem" onClick={openSettings}>
              {t("topBar.settings")}
            </button>
            <button type="button" className="bd-app-sidebar-profile-action" role="menuitem" onClick={() => void signOut({ callbackUrl: "/" })}>
              {t("sidebar.signOut")}
            </button>
          </div>
        )}
      </div>

      <nav className="bd-app-sidebar-nav" aria-label={t("sidebar.navAria")}>
        {workspaceModes.map((m) => (
          <button
            key={m}
            type="button"
            className="bd-app-sidebar-nav-btn"
            data-active={mode === m ? "true" : "false"}
            data-collapsed={!showLabels ? "true" : "false"}
            onClick={() => pickMode(m)}
            title={t(MODE_KEY[m])}
            aria-label={t(MODE_KEY[m])}
            aria-current={mode === m ? "page" : undefined}
          >
            <span className="bd-app-sidebar-nav-icon">{modeIcons[m]()}</span>
            {showLabels ? <span className="bd-app-sidebar-nav-label">{t(MODE_KEY[m])}</span> : null}
          </button>
        ))}
      </nav>

      <div className="bd-app-sidebar-spacer" />

      <div className="bd-app-sidebar-footer">
        <button
          type="button"
          className="bd-app-sidebar-nav-btn"
          data-collapsed={!showLabels ? "true" : "false"}
          onClick={() => {
            setStreaksOpen(true);
            if (isMobile) closeMobileDrawerAnimated();
          }}
          title={t("topBar.streaks")}
          aria-label={t("topBar.streaks")}
        >
          <span className="bd-app-sidebar-nav-icon">
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3.5a2.5 2.5 0 0 0 2.5 2.5z" />
            </svg>
            <span className="bd-app-sidebar-streak-badge">{streakState.currentStreak}</span>
          </span>
          {showLabels ? <span className="bd-app-sidebar-nav-label">{t("topBar.streaks")}</span> : null}
        </button>

        <div className="bd-app-sidebar-tool-row" data-collapsed={!showLabels ? "true" : "false"}>
          <ThemeToggle className="bd-app-sidebar-theme-btn" />
          {showLabels ? <span className="bd-app-sidebar-tool-label">{t("theme.appearance")}</span> : null}
        </div>

        <button
          type="button"
          className="bd-app-sidebar-nav-btn bd-app-sidebar-nav-btn--danger"
          data-collapsed={!showLabels ? "true" : "false"}
          onClick={() => {
            setDeleteEntriesOpen(true);
            if (isMobile) closeMobileDrawerAnimated();
          }}
          title={t("settings.deleteEntriesOpen")}
          aria-label={t("settings.deleteEntriesOpen")}
        >
          <span className="bd-app-sidebar-nav-icon">
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
          </span>
          {showLabels ? <span className="bd-app-sidebar-nav-label">{t("settings.deleteEntriesOpen")}</span> : null}
        </button>

        <button
          type="button"
          className="bd-app-sidebar-nav-btn"
          data-collapsed={!showLabels ? "true" : "false"}
          onClick={openSettings}
          title={t("topBar.settings")}
          aria-label={t("topBar.settings")}
        >
          <span className="bd-app-sidebar-nav-icon">
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V15a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </span>
          {showLabels ? <span className="bd-app-sidebar-nav-label">{t("topBar.settings")}</span> : null}
        </button>
      </div>
    </>
  );

  useEffect(() => {
    if (!profileOpen) return;
    const close = (e: MouseEvent) => {
      const t = e.target as Node;
      if (profileBtnRef.current?.contains(t)) return;
      const pop = document.querySelector(".bd-app-sidebar-profile-popover");
      if (pop?.contains(t)) return;
      setProfileOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [profileOpen]);

  const profilePopover =
    profileOpen && !isMobile && typeof document !== "undefined" && popoverPos
      ? createPortal(
          <div
            className="bd-app-sidebar-profile-popover bd-panel"
            style={{ top: popoverPos.top, left: popoverPos.left }}
            role="menu"
          >
            {email ? (
              <p className="bd-app-sidebar-profile-muted">
                <span className="bd-app-sidebar-profile-muted-label">{t("sidebar.signedInAs")}</span>
                <span className="bd-app-sidebar-profile-email">{email}</span>
              </p>
            ) : null}
            <button type="button" className="bd-app-sidebar-profile-action" role="menuitem" onClick={openSettings}>
              {t("topBar.settings")}
            </button>
            <button type="button" className="bd-app-sidebar-profile-action" role="menuitem" onClick={() => void signOut({ callbackUrl: "/" })}>
              {t("sidebar.signOut")}
            </button>
          </div>,
          document.body
        )
      : null;

  const streaksModal = <StreaksModal isOpen={streaksOpen} onClose={() => setStreaksOpen(false)} state={streakState} />;
  const deleteEntriesOverlay = (
    <DeleteEntriesOverlay isOpen={deleteEntriesOpen} onClose={() => setDeleteEntriesOpen(false)} />
  );

  if (isMobile) {
    return (
      <>
        {(mobileOpen || mobileDrawerExiting) && (
          <div
            className={`bd-sidebar-drawer-backdrop${mobileDrawerExiting ? " bd-sidebar-drawer-backdrop--exit" : ""}`}
            onClick={mobileDrawerExiting ? undefined : closeMobileDrawerAnimated}
            role="presentation"
          >
            <aside
              className={`bd-sidebar-drawer bd-sidebar-drawer--trailing${mobileDrawerExiting ? " bd-sidebar-drawer--exit" : ""}`}
              onClick={(e) => e.stopPropagation()}
              onAnimationEnd={handleMobileDrawerAnimationEnd}
              data-expanded="true"
              aria-hidden={!(mobileOpen || mobileDrawerExiting)}
            >
              {sidebarBody}
            </aside>
          </div>
        )}
        {profilePopover}
        {streaksModal}
        {deleteEntriesOverlay}
      </>
    );
  }

  return (
    <>
      <aside
        className="bd-app-sidebar bd-sidebar-rail bd-app-sidebar--trailing"
        data-expanded={expanded ? "true" : "false"}
        aria-label={t("sidebar.navAria")}
      >
        {sidebarBody}
      </aside>
      {profilePopover}
      {streaksModal}
      {deleteEntriesOverlay}
    </>
  );
}
