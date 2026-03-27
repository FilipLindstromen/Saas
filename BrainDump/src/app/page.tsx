"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { AppSidebar } from "@/components/AppSidebar";
import { TopBar } from "@/components/TopBar";
import { ScopeBar } from "@/components/ScopeBar";
import { CenterPanel, type BrainDumpCenterHandle, type OrganizedItemPreview } from "@/components/CenterPanel";
import { RightPanel } from "@/components/RightPanel";
import { SettingsModal } from "@/components/SettingsModal";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { loadViewPreference, type ItemsViewType } from "@/components/ItemsViewArea";
import { useI18n } from "@/lib/i18n";
import { saveLastNewBatchIds } from "@/lib/newBatch";
import { recordOrganizedDump } from "@/lib/dump-streak";

const VIEW_STORAGE_KEY = "braindump-items-view";

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
  const { data: session, status } = useSession();
  const [mode, setMode] = useState<Mode>("work");
  const [organizedItems, setOrganizedItems] = useState<OrganizedItemPreview[]>([]);
  const [organizedTranscript, setOrganizedTranscript] = useState<string>("");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedItemType, setSelectedItemType] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [projectNames, setProjectNames] = useState<string[]>([]);
  const [viewType, setViewType] = useState<ItemsViewType>(loadViewPreference);
  const [hasUncategorizedEntries, setHasUncategorizedEntries] = useState(false);
  const [mobileTopBarBeforeMenu, setMobileTopBarBeforeMenu] = useState<ReactNode>(null);
  const [dumpRecordingActive, setDumpRecordingActive] = useState(false);
  const [isMobileLayout, setIsMobileLayout] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches
  );
  const centerPanelRef = useRef<BrainDumpCenterHandle>(null);

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
      mode === "work" || mode === "personal" || mode === "all" ? (
        <ScopeBar
          key="bd-scope-main"
          mode={mode}
          selectedProjectId={selectedProjectId}
          selectedCategory={selectedCategory}
          onProjectSelect={setSelectedProjectId}
          onCategorySelect={setSelectedCategory}
          searchFilter={searchFilter}
          onSearchFilterChange={setSearchFilter}
        />
      ) : null,
    [mode, selectedProjectId, selectedCategory, searchFilter]
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

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, viewType);
    } catch {}
  }, [viewType]);

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
        const dump = (dataDump as { dump?: { id: string } }).dump;
        if (!dump?.id) throw new Error("Failed to create dump");
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
          body: JSON.stringify({ dumpId: dump.id, items: payload }),
        });
        const dataBatch = await resBatch.json();
        if (!resBatch.ok) {
          throw new Error((dataBatch as { error?: string }).error ?? "Failed to save items");
        }
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
        <div
          style={{
            width: "100%",
            maxWidth: 420,
            padding: "1.75rem 1.5rem",
            borderRadius: "var(--card-radius)",
            background: "var(--bg-elevated)",
            boxShadow: "var(--shadow-md)",
            border: "1px solid var(--border-subtle)",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 600 }}>{t("topBar.title")}</h1>
            <p style={{ marginTop: "0.4rem", fontSize: "0.95rem", color: "var(--text-secondary)" }}>
              {t("auth.signInPrompt")}
            </p>
          </div>
          <Link
            href="/login"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              padding: "0.7rem 1.2rem",
              borderRadius: "var(--button-radius)",
              border: "none",
              background: "var(--accent)",
              color: "#fff",
              fontSize: "0.95rem",
              fontWeight: 600,
              textDecoration: "none",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            Sign in
          </Link>
          <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-tertiary)" }}>
            Use a secure cookie-based session (up to 30 days with &quot;Remember me&quot;).
          </p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="bd-app-shell" style={{ background: "var(--bg-primary)" }}>
        <TopBar
          mode={mode}
          onModeChange={setMode}
          showUncategorizedWorkspace={hasUncategorizedEntries}
          onOpenMobileNav={() => setMobileNavOpen(true)}
          beforeMenuSlot={mobileTopBarBeforeMenu}
          scopeSlot={isMobileLayout ? null : scopeBarSlot}
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
        <div className="bd-workspace-column" style={{ gap: "0" }}>
          <div className="bd-page-content-padding">
            <CenterPanel
              ref={centerPanelRef}
              mode={mode}
              onTranscriptReady={() => {}}
              onOrganized={handleOrganized}
              onAutoSave={handleAutoSave}
              onDumpFinished={handleDumpFinished}
              onOpenSettings={() => setShowSettings(true)}
              onWorkProjectsChanged={refreshWorkProjectNames}
              projectNames={projectNames}
              projectId={selectedProjectId}
              category={selectedCategory}
              itemType={selectedItemType}
              onItemTypeSelect={setSelectedItemType}
              viewType={viewType}
              onViewTypeChange={setViewType}
              searchFilter={searchFilter}
              scopeSlot={isMobileLayout ? scopeBarSlot : null}
              onMobileTopBarBeforeMenuSlot={setMobileTopBarBeforeMenu}
              onDumpRecordingChange={setDumpRecordingActive}
            />
          </div>
          {mode === "inbox" && (
            <div style={{ width: 320, flexShrink: 0, minWidth: 0, overflow: "auto" }}>
              <RightPanel
                mode={mode}
                items={organizedItems}
                transcript={organizedTranscript}
                onSaveComplete={handleSaveComplete}
                projectId={selectedProjectId}
                category={selectedCategory}
                itemType={selectedItemType}
              />
            </div>
          )}
        </div>

        <AppSidebar
          mode={mode}
          onModeChange={setMode}
          showUncategorizedWorkspace={hasUncategorizedEntries}
          onOpenSettings={() => setShowSettings(true)}
          mobileOpen={mobileNavOpen}
          onMobileOpenChange={setMobileNavOpen}
        />
      </div>

      <div className="bd-bottom-bar" role="navigation" aria-label={t("bottom.navAria")}>
        <div className="bd-bottom-bar-mobile-col">
          <nav className="bd-bottom-bar-pill" aria-label={t("items.chooseView")}>
            <button
              type="button"
              className={`bd-bottom-bar-pill-item${viewType === "list" ? " bd-bottom-bar-pill-item--active" : ""}`}
              onClick={() => setViewType("list")}
              title={t("items.viewList")}
              aria-label={t("items.viewList")}
              aria-current={viewType === "list" ? "page" : undefined}
            >
              {viewType === "list" ? (
                <svg className="bd-bottom-bar-pill-icon" width="24" height="24" viewBox="0 0 24 24" aria-hidden>
                  <rect x="4" y="4" width="16" height="16" rx="4" fill="var(--accent)" stroke="none" />
                  <path
                    d="M8.5 12.5 11 15l4.5-5.5"
                    fill="none"
                    stroke="rgba(255,255,255,0.96)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                <svg className="bd-bottom-bar-pill-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <rect x="4" y="4" width="16" height="16" rx="4" stroke="currentColor" strokeWidth="2" />
                  <path
                    d="M8.5 12.5 11 15l4.5-5.5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
            <button
              type="button"
              className={`bd-bottom-bar-pill-item${viewType === "text" ? " bd-bottom-bar-pill-item--active" : ""}`}
              onClick={() => setViewType("text")}
              title={t("items.viewText")}
              aria-label={t("items.viewText")}
              aria-current={viewType === "text" ? "page" : undefined}
            >
              <svg className="bd-bottom-bar-pill-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M4 6h16M4 12h16M4 18h11" />
              </svg>
            </button>
            <div className="bd-bottom-bar-pill-mic-wrap">
              <button
                type="button"
                className={`bd-bottom-dump-mic${dumpRecordingActive ? " bd-bottom-dump-mic--recording" : ""}`}
                onClick={() => centerPanelRef.current?.toggleDumpRecording()}
                title={dumpRecordingActive ? t("center.stopOrganize") : t("center.recordNewDump")}
                aria-label={dumpRecordingActive ? t("center.stopOrganize") : t("center.recordNewDump")}
              >
                {dumpRecordingActive ? (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                  </svg>
                ) : (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3Z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="22" />
                  </svg>
                )}
              </button>
            </div>
            <button
              type="button"
              className={`bd-bottom-bar-pill-item${viewType === "calendar" ? " bd-bottom-bar-pill-item--active" : ""}`}
              onClick={() => setViewType("calendar")}
              title={t("items.viewCalendar")}
              aria-label={t("items.viewCalendar")}
              aria-current={viewType === "calendar" ? "page" : undefined}
            >
              <svg className="bd-bottom-bar-pill-icon bd-bottom-bar-pill-icon--calendar" width="24" height="24" viewBox="0 0 24 24" aria-hidden>
                <rect x="3" y="4" width="18" height="18" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
                <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <text
                  x="12"
                  y="17.5"
                  textAnchor="middle"
                  fontSize="9"
                  fontWeight="600"
                  fill="currentColor"
                  className="bd-bottom-bar-cal-day"
                >
                  {new Date().getDate()}
                </text>
              </svg>
            </button>
            <button
              type="button"
              className={`bd-bottom-bar-pill-item${viewType === "flowchart" ? " bd-bottom-bar-pill-item--active" : ""}`}
              onClick={() => setViewType("flowchart")}
              title={t("items.viewFlowchart")}
              aria-label={t("items.viewFlowchart")}
              aria-current={viewType === "flowchart" ? "page" : undefined}
            >
              <svg className="bd-bottom-bar-pill-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle cx="12" cy="12" r="2.25" fill="currentColor" stroke="none" />
                <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" fill="none" />
              </svg>
            </button>
          </nav>
        </div>
      </div>

      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </div>
    </ErrorBoundary>
  );
}
