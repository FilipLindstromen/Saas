"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import { ScopeBar } from "@/components/ScopeBar";
import { CenterPanel, type OrganizedItemPreview } from "@/components/CenterPanel";
import { RightPanel } from "@/components/RightPanel";
import { SettingsModal } from "@/components/SettingsModal";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { loadViewPreference, type ItemsViewType } from "@/components/ItemsViewArea";
import { useI18n } from "@/lib/i18n";
import { saveLastNewBatchIds } from "@/lib/newBatch";

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
  const [projectNames, setProjectNames] = useState<string[]>([]);
  const [viewType, setViewType] = useState<ItemsViewType>(loadViewPreference);

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, viewType);
    } catch {}
  }, [viewType]);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => setProjectNames((d.projects ?? []).map((p: { name: string }) => p.name)))
      .catch(() => setProjectNames([]));
  }, []);

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
    setMode("work");
    setSelectedItemType("new");
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
        style={{
          minHeight: "100vh",
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
        style={{
          minHeight: "100vh",
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
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "var(--bg-primary)" }}>
        <TopBar mode={mode} onModeChange={setMode} onOpenSettings={() => setShowSettings(true)} />

      <div
        className="bd-layout-main bd-main-scroll"
        style={{
          display: "flex",
          flex: 1,
          minHeight: 0,
          alignItems: "stretch",
        }}
      >
        <aside
          className="bd-mobile-hide bd-sidebar-rail"
          style={{
            width: 56,
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "0.5rem 0",
            gap: "0.35rem",
          }}
        >
          <button
            type="button"
            className="bd-sidebar-rail-btn"
            data-active={mode === "all"}
            onClick={() => setMode("all")}
            title={t("mode.all")}
            aria-label={t("mode.all")}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          </button>
          <button
            type="button"
            className="bd-sidebar-rail-btn"
            data-active={mode === "work"}
            onClick={() => setMode("work")}
            title={t("mode.work")}
            aria-label={t("mode.work")}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
            </svg>
          </button>
          <button
            type="button"
            className="bd-sidebar-rail-btn"
            data-active={mode === "personal"}
            onClick={() => setMode("personal")}
            title={t("mode.personal")}
            aria-label={t("mode.personal")}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </button>
        </aside>

        <div className="bd-workspace-column" style={{ gap: "0" }}>
          {(mode === "work" || mode === "personal" || mode === "all") && (
            <div className="bd-scope-outer-wrap" style={{ flexShrink: 0 }}>
              <ScopeBar
                mode={mode}
                selectedProjectId={selectedProjectId}
                selectedCategory={selectedCategory}
                onProjectSelect={setSelectedProjectId}
                onCategorySelect={setSelectedCategory}
                searchFilter={searchFilter}
                onSearchFilterChange={setSearchFilter}
              />
            </div>
          )}
          <div className="bd-page-content-padding">
            <CenterPanel
              mode={mode}
              onTranscriptReady={() => {}}
              onOrganized={handleOrganized}
              onAutoSave={handleAutoSave}
              onDumpFinished={handleDumpFinished}
              onOpenSettings={() => setShowSettings(true)}
              projectNames={projectNames}
              projectId={selectedProjectId}
              category={selectedCategory}
              itemType={selectedItemType}
              onItemTypeSelect={setSelectedItemType}
              viewType={viewType}
              onViewTypeChange={setViewType}
              searchFilter={searchFilter}
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
      </div>

      <div className="bd-bottom-bar" role="navigation" aria-label={t("bottom.navAria")}>
        <div className="bd-bottom-bar-spacer" aria-hidden />
        <div className="bd-bottom-bar-center">
          <button
            type="button"
            className="bd-bottom-dump-mic"
            onClick={() => {
              if (typeof document === "undefined") return;
              const fab = document.getElementById("bd-dump-fab");
              if (fab && "click" in fab) {
                (fab as HTMLButtonElement).click();
              }
            }}
            title={t("center.recordNewDump")}
            aria-label={t("center.recordNewDump")}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="22" />
            </svg>
          </button>
        </div>
        <div className="bd-bottom-bar-spacer" aria-hidden />
      </div>

      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </div>
    </ErrorBoundary>
  );
}
