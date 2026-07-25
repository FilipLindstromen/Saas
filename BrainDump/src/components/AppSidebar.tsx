"use client";

import {
  useCallback,
  useEffect,
  useState,
  type AnimationEvent,
  type ReactNode,
} from "react";
import { useSession } from "next-auth/react";
import { DeleteEntriesOverlay } from "./DeleteEntriesOverlay";
import { BrainDumpHabitReminderModal } from "./BrainDumpHabitReminderModal";
import { StreaksModal } from "./StreaksModal";
import { GamificationModal } from "./GamificationModal";
import { TrashModal } from "./TrashModal";
import { ThemeToggle } from "./ThemeToggle";
import { useI18n } from "@/lib/i18n";
import {
  BRAINDUMP_CLIENT_PREFS_APPLIED_EVENT,
  scheduleClientPreferencesUpload,
} from "@/lib/client-preferences-sync";
import { getDumpStreakState, STREAK_RECORDED_EVENT, type DumpStreakState } from "@/lib/dump-streak";
import { streakLevelFromTotal } from "@/lib/streak-gamification";

const SIDEBAR_EXPANDED_KEY = "braindump-sidebar-expanded";

type Mode = "inbox" | "work" | "personal" | "all";

const MODE_KEY: Record<Mode, string> = {
  all: "mode.all",
  work: "mode.work",
  personal: "mode.personal",
  inbox: "mode.inbox",
};

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
  onOpenProfile: () => void;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
  onCapturePhoto?: () => void;
  onCaptureText?: () => void;
  onOpenDebug?: () => void;
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
  mode,
  onModeChange,
  showUncategorizedWorkspace,
  onOpenSettings,
  onOpenProfile,
  mobileOpen,
  onMobileOpenChange,
  onCapturePhoto,
  onCaptureText,
  onOpenDebug,
}: AppSidebarProps) {
  const { t } = useI18n();
  const { data: session } = useSession();
  const isMobile = useIsMobile();
  const [expanded, setExpanded] = useState(false);
  const [streakState, setStreakState] = useState<DumpStreakState>(() => getDumpStreakState());
  const [streaksOpen, setStreaksOpen] = useState(false);
  const [gamificationOpen, setGamificationOpen] = useState(false);
  const [habitRemindersOpen, setHabitRemindersOpen] = useState(false);
  const [deleteEntriesOpen, setDeleteEntriesOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const [mobileDrawerExiting, setMobileDrawerExiting] = useState(false);

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
      scheduleClientPreferencesUpload();
    } catch {
      /* ignore */
    }
  }, []);

  /** All / Work / Personal live in the main scope UI; sidebar only exposes Inbox when available. */
  const sidebarWorkspaceModes: Mode[] = showUncategorizedWorkspace ? ["inbox"] : [];

  const showLabels = isMobile || expanded;

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
    onOpenSettings();
    if (isMobile) closeMobileDrawerAnimated();
  };

  const openProfile = () => {
    onOpenProfile();
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

      <div className="bd-app-sidebar-profile-wrap">
        <button
          type="button"
          className="bd-app-sidebar-profile-trigger"
          data-collapsed={!showLabels ? "true" : "false"}
          onClick={openProfile}
          aria-haspopup="dialog"
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
      </div>

      {sidebarWorkspaceModes.length > 0 ? (
        <nav className="bd-app-sidebar-nav" aria-label={t("sidebar.navAria")}>
          {sidebarWorkspaceModes.map((m) => (
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
      ) : null}

      {onCapturePhoto || onCaptureText ? (
        <nav className="bd-app-sidebar-nav" aria-label={t("sidebar.dumpInputsAria")}>
          {onCaptureText ? (
            <button
              type="button"
              className="bd-app-sidebar-nav-btn"
              data-collapsed={!showLabels ? "true" : "false"}
              onClick={() => {
                onCaptureText();
                if (isMobile) closeMobileDrawerAnimated();
              }}
              title={t("sidebar.captureText")}
              aria-label={t("sidebar.captureText")}
            >
              <span className="bd-app-sidebar-nav-icon">
                <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M4 6h16M4 12h16M4 18h11" />
                </svg>
              </span>
              {showLabels ? <span className="bd-app-sidebar-nav-label">{t("sidebar.captureText")}</span> : null}
            </button>
          ) : null}
          {onCapturePhoto ? (
            <button
              type="button"
              className="bd-app-sidebar-nav-btn"
              data-collapsed={!showLabels ? "true" : "false"}
              onClick={() => {
                onCapturePhoto();
                if (isMobile) closeMobileDrawerAnimated();
              }}
              title={t("sidebar.capturePhoto")}
              aria-label={t("sidebar.capturePhoto")}
            >
              <span className="bd-app-sidebar-nav-icon">
                <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                  <circle cx="12" cy="13" r="3" />
                </svg>
              </span>
              {showLabels ? <span className="bd-app-sidebar-nav-label">{t("sidebar.capturePhoto")}</span> : null}
            </button>
          ) : null}
        </nav>
      ) : null}

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
          title={`${t("topBar.streaks")} · ${t("streaks.levelShort", { n: streakLevelFromTotal(streakState.totalOrganizedDumps) })}`}
          aria-label={`${t("topBar.streaks")}. ${t("streaks.levelShort", { n: streakLevelFromTotal(streakState.totalOrganizedDumps) })}`}
        >
          <span className="bd-app-sidebar-nav-icon">
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3.5a2.5 2.5 0 0 0 2.5 2.5z" />
            </svg>
            <span className="bd-app-sidebar-streak-badge">{streakState.currentStreak}</span>
          </span>
          {showLabels ? <span className="bd-app-sidebar-nav-label">{t("topBar.streaks")}</span> : null}
        </button>

        {user ? (
          <button
            type="button"
            className="bd-app-sidebar-nav-btn"
            data-collapsed={!showLabels ? "true" : "false"}
            onClick={() => {
              setGamificationOpen(true);
              if (isMobile) closeMobileDrawerAnimated();
            }}
            title={t("gamification.title")}
            aria-label={t("gamification.title")}
          >
            <span className="bd-app-sidebar-nav-icon">
              <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 15c-3.866 0-7-1.567-7-3.5V6.5C5 4.567 8.134 3 12 3s7 1.567 7 3.5V11.5c0 1.933-3.134 3.5-7 3.5z" />
                <path d="M5 10v4c0 2 3 4 7 4s7-2 7-4v-4" />
                <path d="M12 11v6" />
              </svg>
            </span>
            {showLabels ? <span className="bd-app-sidebar-nav-label">{t("gamification.shortLabel")}</span> : null}
          </button>
        ) : null}

        <button
          type="button"
          className="bd-app-sidebar-nav-btn"
          data-collapsed={!showLabels ? "true" : "false"}
          onClick={() => {
            setHabitRemindersOpen(true);
            if (isMobile) closeMobileDrawerAnimated();
          }}
          title={t("sidebar.habitReminders")}
          aria-label={t("sidebar.habitReminders")}
        >
          <span className="bd-app-sidebar-nav-icon">
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </span>
          {showLabels ? <span className="bd-app-sidebar-nav-label">{t("sidebar.habitReminders")}</span> : null}
        </button>

        <ThemeToggle showLabels={showLabels} />

        <button
          type="button"
          className="bd-app-sidebar-nav-btn"
          data-collapsed={!showLabels ? "true" : "false"}
          onClick={() => {
            setTrashOpen(true);
            if (isMobile) closeMobileDrawerAnimated();
          }}
          title={t("sidebar.trash")}
          aria-label={t("sidebar.trash")}
        >
          <span className="bd-app-sidebar-nav-icon">
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
          </span>
          {showLabels ? <span className="bd-app-sidebar-nav-label">{t("sidebar.trash")}</span> : null}
        </button>

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

        {onOpenDebug ? (
          <button
            type="button"
            className="bd-app-sidebar-nav-btn"
            data-collapsed={!showLabels ? "true" : "false"}
            onClick={() => {
              onOpenDebug();
              if (isMobile) closeMobileDrawerAnimated();
            }}
            title="Debug — last organize"
            aria-label="Debug — last organize"
          >
            <span className="bd-app-sidebar-nav-icon">
              <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 22c1.1 0 2-.9 2-2H10c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
                <circle cx="18" cy="8" r="4" fill="var(--accent)" stroke="none" />
              </svg>
            </span>
            {showLabels ? <span className="bd-app-sidebar-nav-label">Debug</span> : null}
          </button>
        ) : null}

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

  const streaksModal = <StreaksModal isOpen={streaksOpen} onClose={() => setStreaksOpen(false)} state={streakState} />;
  const gamificationModal = (
    <GamificationModal isOpen={gamificationOpen} onClose={() => setGamificationOpen(false)} />
  );
  const habitReminderModal = (
    <BrainDumpHabitReminderModal isOpen={habitRemindersOpen} onClose={() => setHabitRemindersOpen(false)} />
  );
  const deleteEntriesOverlay = (
    <DeleteEntriesOverlay isOpen={deleteEntriesOpen} onClose={() => setDeleteEntriesOpen(false)} />
  );
  const trashModal = <TrashModal isOpen={trashOpen} onClose={() => setTrashOpen(false)} />;

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
        {streaksModal}
        {gamificationModal}
        {habitReminderModal}
        {trashModal}
        {deleteEntriesOverlay}
      </>
    );
  }

  return (
    <>
      <aside
        className="bd-app-sidebar bd-sidebar-rail"
        data-expanded={expanded ? "true" : "false"}
        aria-label={t("sidebar.navAria")}
      >
        {sidebarBody}
      </aside>
      {streaksModal}
      {gamificationModal}
      {habitReminderModal}
      {trashModal}
      {deleteEntriesOverlay}
    </>
  );
}
