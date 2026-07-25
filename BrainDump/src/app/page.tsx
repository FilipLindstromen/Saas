"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getProviders, signIn, useSession } from "next-auth/react";
import Link from "next/link";
import { AppSidebar } from "@/components/AppSidebar";
import { TopBar } from "@/components/TopBar";
import { ScopeBar } from "@/components/ScopeBar";
import { CenterPanel, type BrainDumpCenterHandle, type OrganizedItemPreview } from "@/components/CenterPanel";
import { RightPanel } from "@/components/RightPanel";
import { CoachChatOverlay } from "@/components/CoachChatOverlay";
import { SettingsModal } from "@/components/SettingsModal";
import { ProfileOverlay } from "@/components/ProfileOverlay";
import { TodayView } from "@/components/TodayView";
import { MobileBottomBarPill } from "@/components/MobileBottomBarPill";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { DumpSuccessBar } from "@/components/DumpSuccessBar";
import { WelcomeOverlay, WELCOME_COMPLETE_EVENT } from "@/components/WelcomeOverlay";
import { loadViewPreference, type ItemsViewType } from "@/components/ItemsViewArea";
import type { DueDateFilterPreset } from "@/lib/due-date-filter";
import { useHabitRemindersTick } from "@/hooks/useHabitRemindersTick";
import {
  BRAINDUMP_CLIENT_PREFS_APPLIED_EVENT,
  scheduleClientPreferencesUpload,
} from "@/lib/client-preferences-sync";
import { useI18n } from "@/lib/i18n";
import { saveLastNewBatchIds } from "@/lib/newBatch";
import { recordOrganizedDump } from "@/lib/dump-streak";
import {
  loadWorkspaceScope,
  readTabDueDateFilter,
  saveWorkspaceScope,
  writeTabDueDateFilter,
} from "@/lib/workspace-scope-settings";
import { emitGamificationFromResponseBody } from "@/lib/gamification-client";

const VIEW_STORAGE_KEY = "braindump-items-view";

const TRASH_UNDO_MS = 8000;

type Mode = "inbox" | "work" | "personal" | "all";
type DumpMode = "inbox" | "work" | "personal";

function inferDumpModeFromItems(items: OrganizedItemPreview[], fallback: DumpMode = "inbox"): DumpMode {
  const domains = new Set(items.map((it) => it.domain).filter(Boolean));
  if (domains.size === 1) {
    const only = Array.from(domains)[0];
    if (only === "inbox" || only === "work" || only === "personal") return only;
  }
  if (domains.has("work") && domains.has("personal")) return "inbox";
  return fallback;
}

export default function BrainDumpPage() {
  const { t } = useI18n();
  useHabitRemindersTick(t);
  const { data: session, status } = useSession();
  const [mode, setMode] = useState<Mode>("all");
  const [organizedItems, setOrganizedItems] = useState<OrganizedItemPreview[]>([]);
  const [organizedTranscript, setOrganizedTranscript] = useState<string>("");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedItemType, setSelectedItemType] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState("");
  const [dueDateFilter, setDueDateFilter] = useState<DueDateFilterPreset>("all");
  const [showSettings, setShowSettings] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [coachChatOpen, setCoachChatOpen] = useState(false);
  const [todayViewActive, setTodayViewActive] = useState(false);
  const [workspaceScopeHydrated, setWorkspaceScopeHydrated] = useState(false);
  const [projectNames, setProjectNames] = useState<string[]>([]);
  const [viewType, setViewType] = useState<ItemsViewType>(loadViewPreference);
  const [hasUncategorizedEntries, setHasUncategorizedEntries] = useState(false);
  const [mobileTopBarBeforeMenu, setMobileTopBarBeforeMenu] = useState<ReactNode>(null);
  const [desktopScopeBeforeFilter, setDesktopScopeBeforeFilter] = useState<ReactNode>(null);
  const [topBarEnd, setTopBarEnd] = useState<ReactNode>(null);
  const [dumpRecordingActive, setDumpRecordingActive] = useState(false);
  const [dumpEmptyHintActive, setDumpEmptyHintActive] = useState(false);
  const [dumpSuccess, setDumpSuccess] = useState<{ count: number } | null>(null);
  const [authProviders, setAuthProviders] = useState<Awaited<ReturnType<typeof getProviders>>>(null);

  useEffect(() => {
    void getProviders().then(setAuthProviders);
  }, []);

  useEffect(() => {
    const onWelcomeComplete = () => {
      setTodayViewActive(true);
      setMode("all");
    };
    window.addEventListener(WELCOME_COMPLETE_EVENT, onWelcomeComplete);
    return () => window.removeEventListener(WELCOME_COMPLETE_EVENT, onWelcomeComplete);
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      void getProviders().then(setAuthProviders);
    }
  }, [status]);

  const [isMobileLayout, setIsMobileLayout] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches
  );
  const centerPanelRef = useRef<BrainDumpCenterHandle>(null);
  /** Desktop: new browser tab shows no date filter until you pick one; then we remember the tab choice in sessionStorage. */
  const dueDateFilterFromUserRef = useRef(false);
  const trashUndoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [trashUndo, setTrashUndo] = useState<{ id: string; title: string } | null>(null);

  const clearTrashUndoTimer = useCallback(() => {
    if (trashUndoTimeoutRef.current != null) {
      clearTimeout(trashUndoTimeoutRef.current);
      trashUndoTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => () => clearTrashUndoTimer(), [clearTrashUndoTimer]);

  const onItemMovedToTrash = useCallback(
    (id: string, title: string) => {
      clearTrashUndoTimer();
      setTrashUndo({ id, title });
      trashUndoTimeoutRef.current = setTimeout(() => {
        setTrashUndo(null);
        trashUndoTimeoutRef.current = null;
      }, TRASH_UNDO_MS);
    },
    [clearTrashUndoTimer]
  );

  const undoMoveToTrash = useCallback(async () => {
    if (!trashUndo) return;
    const { id } = trashUndo;
    try {
      const r = await fetch(`/api/organized-items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restore: true }),
      });
      if (r.ok) {
        clearTrashUndoTimer();
        setTrashUndo(null);
        window.dispatchEvent(new Event("braindump-reload-items"));
      }
    } catch {
      /* keep bar visible */
    }
  }, [trashUndo, clearTrashUndoTimer]);

  const onSidebarCapturePhoto = useCallback(() => {
    centerPanelRef.current?.openPhotoCaptureMenu();
  }, []);

  const onSidebarCaptureText = useCallback(() => {
    centerPanelRef.current?.openTypedDumpSheet();
  }, []);

  const goToTodayItemWorkspace = useCallback(
    (domain: "work" | "personal", opts: { projectId: string | null; category: string | null }) => {
      setTodayViewActive(false);
      setMode(domain);
      setSelectedProjectId(opts.projectId);
      setSelectedCategory(opts.category);
      setSelectedItemType(null);
      setSearchFilter("");
      dueDateFilterFromUserRef.current = true;
      setDueDateFilter("today");
    },
    []
  );

  const onDueDateFilterChangeFromUser = useCallback((preset: DueDateFilterPreset) => {
    dueDateFilterFromUserRef.current = true;
    setDueDateFilter(preset);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 768px)");
    const sync = () => setIsMobileLayout(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const scopeBarSlot = useMemo(
    () =>
      !todayViewActive && (mode === "work" || mode === "personal" || mode === "all") ? (
        <ScopeBar
          key="bd-scope-main"
          mode={mode}
          selectedProjectId={selectedProjectId}
          selectedCategory={selectedCategory}
          onProjectSelect={setSelectedProjectId}
          onCategorySelect={setSelectedCategory}
          searchFilter={searchFilter}
          onSearchFilterChange={setSearchFilter}
          dueDateFilter={dueDateFilter}
          onDueDateFilterChange={onDueDateFilterChangeFromUser}
          beforeFilterSlot={desktopScopeBeforeFilter}
        />
      ) : null,
    [
      todayViewActive,
      mode,
      selectedProjectId,
      selectedCategory,
      searchFilter,
      dueDateFilter,
      desktopScopeBeforeFilter,
      onDueDateFilterChangeFromUser,
    ]
  );

  const refreshUncategorizedAvailability = useCallback(async () => {
    if (status !== "authenticated") return;
    try {
      const r = await fetch(
        "/api/organized-items?domain=inbox&category=uncategorized&countOnly=true"
      );
      const d = (await r.json()) as { count?: number };
      if (!r.ok) return;
      setHasUncategorizedEntries((d.count ?? 0) > 0);
    } catch {
      setHasUncategorizedEntries(false);
    }
  }, [status]);

  useEffect(() => {
    void refreshUncategorizedAvailability();
  }, [refreshUncategorizedAvailability]);

  useEffect(() => {
    const onReload = () => void refreshUncategorizedAvailability();
    window.addEventListener("braindump-reload-items", onReload);
    return () => window.removeEventListener("braindump-reload-items", onReload);
  }, [refreshUncategorizedAvailability]);

  useEffect(() => {
    if (!hasUncategorizedEntries && mode === "inbox") {
      setMode("all");
    }
  }, [hasUncategorizedEntries, mode]);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const s = loadWorkspaceScope();
    const mobile = window.matchMedia("(max-width: 768px)").matches;
    setMode(s.mode);
    setSelectedProjectId(s.projectId);
    setSelectedCategory(s.category);
    setSelectedItemType(s.itemType);
    dueDateFilterFromUserRef.current = false;
    if (mobile) {
      setDueDateFilter(s.dueDateFilter);
    } else {
      setDueDateFilter(readTabDueDateFilter() ?? "all");
    }
    setTodayViewActive(s.todayViewActive);
    setWorkspaceScopeHydrated(true);
  }, []);

  useEffect(() => {
    if (!workspaceScopeHydrated || typeof window === "undefined") return;
    const mobile = window.matchMedia("(max-width: 768px)").matches;
    if (!mobile && dueDateFilterFromUserRef.current) {
      writeTabDueDateFilter(dueDateFilter);
    }
    let persistDue = dueDateFilter;
    if (!mobile) {
      const tab = readTabDueDateFilter();
      if (tab === null && !dueDateFilterFromUserRef.current) {
        persistDue = loadWorkspaceScope().dueDateFilter;
      }
    }
    saveWorkspaceScope({
      mode,
      projectId: selectedProjectId,
      category: selectedCategory,
      itemType: selectedItemType,
      dueDateFilter: persistDue,
      todayViewActive,
    });
  }, [
    workspaceScopeHydrated,
    mode,
    selectedProjectId,
    selectedCategory,
    selectedItemType,
    dueDateFilter,
    todayViewActive,
  ]);

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, viewType);
      scheduleClientPreferencesUpload();
    } catch {}
  }, [viewType]);

  useEffect(() => {
    const sync = () => {
      let next = loadViewPreference();
      if (typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches) {
        if (next === "kanban" || next === "postits") next = "list";
      }
      setViewType(next);
      const ws = loadWorkspaceScope();
      const mobile = window.matchMedia("(max-width: 768px)").matches;
      setMode(ws.mode);
      setSelectedProjectId(ws.projectId);
      setSelectedCategory(ws.category);
      setSelectedItemType(ws.itemType);
      dueDateFilterFromUserRef.current = false;
      if (mobile) {
        setDueDateFilter(ws.dueDateFilter);
      } else {
        setDueDateFilter(readTabDueDateFilter() ?? "all");
      }
      setTodayViewActive(ws.todayViewActive);
    };
    window.addEventListener(BRAINDUMP_CLIENT_PREFS_APPLIED_EVENT, sync);
    return () => window.removeEventListener(BRAINDUMP_CLIENT_PREFS_APPLIED_EVENT, sync);
  }, []);

  useEffect(() => {
    if (!isMobileLayout) return;
    setViewType((v) => (v === "kanban" || v === "postits" ? "list" : v));
  }, [isMobileLayout]);

  const refreshWorkProjectNames = useCallback(() => {
    fetch("/api/projects?domain=work")
      .then((r) => r.json())
      .then((d) => setProjectNames((d.projects ?? []).map((p: { name: string }) => p.name)))
      .catch(() => setProjectNames([]));
  }, []);

  useEffect(() => {
    refreshWorkProjectNames();
  }, [refreshWorkProjectNames]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onReloadProjects = () => refreshWorkProjectNames();
    window.addEventListener("braindump-reload-projects", onReloadProjects);
    return () => window.removeEventListener("braindump-reload-projects", onReloadProjects);
  }, [refreshWorkProjectNames]);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const check = async () => {
      if (Notification.permission === "default") await Notification.requestPermission();
      if (Notification.permission !== "granted") return;
      try {
        const res = await fetch("/api/organized-items/reminders");
        const data = await res.json();
        const list: { id: string; title: string; reminderAt: string; reminderMinutesBefore: number | null; reminderNotifiedAt: string | null; reminderEarlyNotifiedAt: string | null }[] = data.items ?? [];
        const now = Date.now();
        for (const it of list) {
          const at = it.reminderAt ? new Date(it.reminderAt).getTime() : 0;
          const minBefore = it.reminderMinutesBefore ?? 0;
          const earlyAt = minBefore > 0 ? at - minBefore * 60 * 1000 : 0;
          if (at && !it.reminderNotifiedAt && now >= at) {
            new Notification(t("notification.reminder"), { body: it.title });
            await fetch(`/api/organized-items/${it.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ reminderNotifiedAt: new Date().toISOString() }),
            });
          } else if (earlyAt && !it.reminderEarlyNotifiedAt && now >= earlyAt) {
            new Notification(t("notification.reminderSoon"), { body: `${it.title} (in ${minBefore} min)` });
            await fetch(`/api/organized-items/${it.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ reminderEarlyNotifiedAt: new Date().toISOString() }),
            });
          }
        }
      } catch (e) {
        console.warn("Reminder check failed", e);
      }
    };
    check();
    const intervalId = setInterval(check, 60 * 1000);
    return () => clearInterval(intervalId);
  }, [t]);

  const handleOrganized = useCallback((items: OrganizedItemPreview[], transcript: string) => {
    setOrganizedItems(items);
    setOrganizedTranscript(transcript);
  }, []);

  const handleAutoSave = useCallback(
    async (items: OrganizedItemPreview[], transcript: string) => {
      if (items.length === 0) {
        setOrganizedItems([]);
        setOrganizedTranscript("");
        return;
      }
      try {
        const dumpMode: DumpMode = mode === "all" ? inferDumpModeFromItems(items, "inbox") : mode;
        const resDump = await fetch("/api/dumps", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: dumpMode,
            transcriptRaw: transcript,
            transcriptEdited: transcript,
            status: "organized",
          }),
        });
        const dataDump = await resDump.json();
        if (!resDump.ok) throw new Error((dataDump as { error?: string }).error || "Failed to create dump");
        emitGamificationFromResponseBody(dataDump);
        const dump = (dataDump as { dump?: { id: string } }).dump;
        if (!dump?.id) throw new Error("Failed to create dump");
        const n = new Date();
        const referenceLocalDate = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
        const payload = items.map((it) => ({
          domain: it.domain,
          category: it.category,
          subcategory: it.subcategory ?? "",
          project_name: it.project_name,
          item_type: it.item_type,
          title: it.title,
          content: it.content ?? "",
          emotion_label: it.emotion_label,
          recommended_view: it.recommended_view ?? "note_cards",
          confidence_score: it.confidence_score ?? 0.8,
          tags: it.tags ?? [],
          ...(it.item_type === "calendar"
            ? {
                ...(it.scheduled_date ? { scheduled_date: it.scheduled_date } : {}),
                ...(it.scheduled_time ? { scheduled_time: it.scheduled_time } : {}),
                ...(it.recurrence ? { recurrence: it.recurrence } : {}),
                ...(it.send_notification !== undefined ? { send_notification: it.send_notification } : {}),
                ...(it.reminder_minutes_before !== undefined
                  ? { reminder_minutes_before: it.reminder_minutes_before }
                  : {}),
              }
            : {}),
          ...((it.item_type === "task" || it.item_type === "task_completed" || it.item_type === "shopping") &&
          it.scheduled_date
            ? {
                scheduled_date: it.scheduled_date,
                ...(it.scheduled_time ? { scheduled_time: it.scheduled_time } : {}),
              }
            : {}),
        }));
        const resBatch = await fetch("/api/organized-items/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dumpId: dump.id, items: payload, referenceLocalDate }),
        });
        const dataBatch = await resBatch.json();
        if (!resBatch.ok) {
          throw new Error((dataBatch as { error?: string }).error ?? "Failed to save items");
        }
        emitGamificationFromResponseBody(dataBatch);
        const created = (dataBatch as { created?: { id: string }[] }).created ?? [];
        saveLastNewBatchIds(created.map((c) => c.id));
        recordOrganizedDump();
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("braindump-reload-items"));
        }
        await fetch(`/api/dumps/${dump.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "saved", organizedAt: new Date().toISOString() }),
        });
        setOrganizedItems([]);
        setOrganizedTranscript("");
      } catch (e) {
        console.error("Auto-save failed:", e);
        setOrganizedItems(items);
        setOrganizedTranscript(transcript);
        throw e instanceof Error ? e : new Error("Auto-save failed");
      }
    },
    [mode]
  );

  const handleDumpFinished = useCallback(() => {
    setMode("all");
    setSelectedProjectId(null);
    setSelectedCategory(null);
    setSelectedItemType("new");
    setSearchFilter("");
  }, []);

  const handleDumpSaved = useCallback((count: number) => {
    if (count > 0) setDumpSuccess({ count });
  }, []);

  const handleViewNewDumpItems = useCallback(() => {
    setDumpSuccess(null);
    handleDumpFinished();
  }, [handleDumpFinished]);

  const handleSaveComplete = useCallback((createdIds?: string[]) => {
    setOrganizedItems([]);
    setOrganizedTranscript("");
    if (createdIds && createdIds.length > 0) {
      saveLastNewBatchIds(createdIds);
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("braindump-reload-items"));
    }
  }, []);

  if (status === "loading") {
    return (
      <div
        className="bd-page-gate"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg-primary)",
          color: "var(--text-primary)",
        }}
      >
        <p style={{ fontSize: "0.95rem", color: "var(--text-secondary)" }}>{t("loading.workspace")}</p>
      </div>
    );
  }

  if (!session) {
    const googleAvailable = Boolean(authProviders?.google);
    const appleAvailable = Boolean(authProviders?.apple);

    return (
      <div
        className="bd-page-gate"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg-primary)",
          color: "var(--text-primary)",
          padding: "1.5rem",
        }}
      >
        <div className="bd-auth-gate-card">
          <div>
            <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 600 }}>{t("topBar.title")}</h1>
            <p style={{ marginTop: "0.4rem", fontSize: "0.95rem", color: "var(--text-secondary)" }}>
              {t("auth.signInPrompt")}
            </p>
            <ul className="bd-auth-gate-value-list">
              <li>{t("auth.valueCapture")}</li>
              <li>{t("auth.valueOrganize")}</li>
              <li>{t("auth.valueToday")}</li>
            </ul>
          </div>
          <nav className="bd-auth-gate-actions" aria-label={t("auth.gateNavAria")}>
            <Link href="/login" className="bd-btn bd-btn-primary">
              {t("auth.signIn")}
            </Link>
            <Link href="/register" className="bd-btn">
              {t("auth.createAccount")}
            </Link>
            <button
              type="button"
              className="bd-btn"
              disabled={!googleAvailable}
              title={!googleAvailable ? t("auth.providerNotConfigured") : undefined}
              onClick={() => {
                if (googleAvailable) void signIn("google", { callbackUrl: "/" });
              }}
            >
              {t("auth.signInWithGoogle")}
            </button>
            <button
              type="button"
              className="bd-btn"
              disabled={!appleAvailable}
              title={!appleAvailable ? t("auth.providerNotConfigured") : undefined}
              onClick={() => {
                if (appleAvailable) void signIn("apple", { callbackUrl: "/" });
              }}
            >
              {t("auth.signInWithApple")}
            </button>
          </nav>
          <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-tertiary)" }}>{t("auth.cookieNote")}</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="bd-app-shell" style={{ background: "var(--bg-primary)" }}>
        <TopBar
          mode={mode}
          onModeChange={(next) => {
            setTodayViewActive(false);
            setMode(next);
          }}
          showUncategorizedWorkspace={hasUncategorizedEntries}
          onOpenMobileNav={() => setMobileNavOpen(true)}
          beforeMenuSlot={mobileTopBarBeforeMenu}
          endSlot={topBarEnd}
          scopeSlot={isMobileLayout || todayViewActive ? null : scopeBarSlot}
        />

      <div
        className="bd-layout-main bd-main-scroll"
        style={{
          display: "flex",
          flex: 1,
          minHeight: 0,
          alignItems: "stretch",
        }}
      >
        <AppSidebar
          mode={mode}
          onModeChange={(next) => {
            setTodayViewActive(false);
            setMode(next);
          }}
          showUncategorizedWorkspace={hasUncategorizedEntries}
          onOpenSettings={() => setShowSettings(true)}
          onOpenProfile={() => setShowProfile(true)}
          mobileOpen={mobileNavOpen}
          onMobileOpenChange={setMobileNavOpen}
          onCapturePhoto={onSidebarCapturePhoto}
          onCaptureText={onSidebarCaptureText}
          onOpenCoach={() => setCoachChatOpen(true)}
        />
        <div className="bd-workspace-column" style={{ gap: "0" }}>
          <div className="bd-page-content-padding" style={{ display: todayViewActive ? "none" : undefined }}>
            <CenterPanel
              ref={centerPanelRef}
              mode={mode}
              onTranscriptReady={() => {}}
              onOrganized={handleOrganized}
              onAutoSave={handleAutoSave}
              onDumpFinished={handleDumpFinished}
              onDumpSaved={handleDumpSaved}
              onOpenSettings={() => setShowSettings(true)}
              onWorkProjectsChanged={refreshWorkProjectNames}
              projectNames={projectNames}
              projectId={selectedProjectId}
              category={selectedCategory}
              itemType={selectedItemType}
              onItemTypeSelect={setSelectedItemType}
              viewType={viewType}
              onViewTypeChange={(v) => {
                setTodayViewActive(false);
                setViewType(v);
              }}
              searchFilter={searchFilter}
              dueDateFilter={dueDateFilter}
              scopeSlot={isMobileLayout ? scopeBarSlot : null}
              onMobileTopBarBeforeMenuSlot={setMobileTopBarBeforeMenu}
              onDesktopScopeBeforeFilterSlot={setDesktopScopeBeforeFilter}
              onTopBarEndSlot={setTopBarEnd}
              onDumpRecordingChange={setDumpRecordingActive}
              onDumpEmptyHintChange={setDumpEmptyHintActive}
              dumpHintSuppressed={todayViewActive}
            />
          </div>
          {todayViewActive ? (
            <div className="bd-page-content-padding bd-today-timeline-shell">
              <TodayView onGoToWorkspace={goToTodayItemWorkspace} isMobile={isMobileLayout} />
            </div>
          ) : null}
          {mode === "inbox" && !todayViewActive && (
            <div style={{ width: 320, flexShrink: 0, minWidth: 0, overflow: "auto" }}>
              <RightPanel
                mode={mode}
                items={organizedItems}
                transcript={organizedTranscript}
                onSaveComplete={handleSaveComplete}
                projectId={selectedProjectId}
                category={selectedCategory}
                itemType={selectedItemType}
                onItemMovedToTrash={onItemMovedToTrash}
              />
            </div>
          )}
        </div>
      </div>

      <div className="bd-bottom-bar" role="navigation" aria-label={t("bottom.navAria")}>
        <div className="bd-bottom-bar-mobile-col">
          <MobileBottomBarPill
            viewType={viewType}
            todayViewActive={todayViewActive}
            dumpRecordingActive={dumpRecordingActive}
            centerPanelRef={centerPanelRef}
            showDumpEmptyHint={dumpEmptyHintActive}
            onTodayClick={() => setTodayViewActive((v) => !v)}
            onSelectList={() => {
              setTodayViewActive(false);
              setViewType("list");
            }}
            onSelectCalendar={() => {
              setTodayViewActive(false);
              setViewType("calendar");
            }}
          />
        </div>
      </div>

      {dumpSuccess ? (
        <DumpSuccessBar
          count={dumpSuccess.count}
          onViewNewItems={handleViewNewDumpItems}
          onDismiss={() => setDumpSuccess(null)}
        />
      ) : null}

      {trashUndo ? (
        <div className="bd-trash-undo-bar" role="status" aria-live="polite">
          <span className="bd-trash-undo-bar-text">{t("trash.movedToTrash")}</span>
          <button type="button" className="bd-btn bd-trash-undo-bar-action" onClick={() => void undoMoveToTrash()}>
            {t("trash.undo")}
          </button>
        </div>
      ) : null}

      <CoachChatOverlay open={coachChatOpen} onClose={() => setCoachChatOpen(false)} />

      <ProfileOverlay
        isOpen={showProfile}
        onClose={() => setShowProfile(false)}
        onOpenSettings={() => {
          setShowProfile(false);
          setShowSettings(true);
        }}
      />
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
      <WelcomeOverlay />
    </div>
    </ErrorBoundary>
  );
}
