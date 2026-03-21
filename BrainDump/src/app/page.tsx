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

const VIEW_STORAGE_KEY = "braindump-items-view";

type Mode = "inbox" | "work" | "personal" | "all";
type DumpMode = "inbox" | "work" | "personal";

/** Icons for All / Work / Personal — match desktop sidebar (stroke icons). */
function WorkspaceModeIcon({ which, size = 20 }: { which: "all" | "work" | "personal"; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24" as const, fill: "none" as const, stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true as const };
  if (which === "all") {
    return (
      <svg {...common}>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    );
  }
  if (which === "work") {
    return (
      <svg {...common}>
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

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
  const [mobileModeMenuOpen, setMobileModeMenuOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, viewType);
    } catch {}
  }, [viewType]);

  useEffect(() => {
    setMobileModeMenuOpen(false);
  }, [mode]);

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
        if (!resBatch.ok) {
          const data = await resBatch.json();
          throw new Error(data.error ?? "Failed to save items");
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
      }
    },
    [mode]
  );

  const handleSaveComplete = useCallback(() => {
    setOrganizedItems([]);
    setOrganizedTranscript("");
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
          className="bd-mobile-hide"
          style={{
            width: 56,
            flexShrink: 0,
            background: "var(--bg-secondary)",
            borderRight: "1px solid var(--border-subtle)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "0.5rem 0",
            gap: "0.25rem",
          }}
        >
          <button
            type="button"
            onClick={() => setMode("all")}
            title={t("mode.all")}
            aria-label={t("mode.all")}
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              border: "none",
              background: mode === "all" ? "var(--accent)" : "transparent",
              color: mode === "all" ? "#fff" : "var(--text-tertiary)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
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
            onClick={() => setMode("work")}
            title={t("mode.work")}
            aria-label={t("mode.work")}
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              border: "none",
              background: mode === "work" ? "var(--accent)" : "transparent",
              color: mode === "work" ? "#fff" : "var(--text-tertiary)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setMode("personal")}
            title={t("mode.personal")}
            aria-label={t("mode.personal")}
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              border: "none",
              background: mode === "personal" ? "var(--accent)" : "transparent",
              color: mode === "personal" ? "#fff" : "var(--text-tertiary)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </button>
        </aside>

        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "0" }}>
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
        <button
          type="button"
          className="bd-bottom-mode-trigger"
          onClick={() => setMobileModeMenuOpen(true)}
          aria-expanded={mobileModeMenuOpen}
          aria-haspopup="dialog"
          aria-label={t("bottom.chooseMode")}
          title={t("bottom.chooseMode")}
        >
          <span className="bd-bottom-mode-trigger-inner">
            <WorkspaceModeIcon
              which={mode === "work" ? "work" : mode === "personal" ? "personal" : "all"}
              size={22}
            />
          </span>
        </button>
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

      {mobileModeMenuOpen && (
        <div
          className="bd-mobile-mode-sheet-backdrop"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 960,
            background: "rgba(0,0,0,0.45)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            padding: 0,
            paddingBottom: "env(safe-area-inset-bottom, 0px)",
          }}
          onClick={() => setMobileModeMenuOpen(false)}
          role="presentation"
        >
          <div
            className="bd-panel bd-mobile-mode-sheet"
            style={{
              width: "100%",
              maxHeight: "min(70dvh, 70vh)",
              borderRadius: "22px 22px 0 0",
              padding: "1rem 1rem 1.15rem",
              overflow: "auto",
              WebkitOverflowScrolling: "touch",
              boxShadow: "0 -12px 48px rgba(0,0,0,0.35)",
            }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="bd-mobile-mode-sheet-title"
          >
            <div
              style={{
                width: 40,
                height: 5,
                borderRadius: 999,
                background: "var(--border-strong)",
                margin: "0 auto 0.85rem",
                opacity: 0.85,
              }}
              aria-hidden
            />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", marginBottom: "0.75rem" }}>
              <h2 id="bd-mobile-mode-sheet-title" style={{ margin: 0, fontSize: "1rem", fontWeight: 600, color: "var(--text-primary)" }}>
                {t("bottom.chooseMode")}
              </h2>
              <button
                type="button"
                className="bd-btn"
                onClick={() => setMobileModeMenuOpen(false)}
                aria-label={t("scope.cancel")}
                style={{ minWidth: 44, minHeight: 44, padding: "0.45rem", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {(
                [
                  { key: "all" as const, label: t("mode.all"), which: "all" as const },
                  { key: "work" as const, label: t("mode.work"), which: "work" as const },
                  { key: "personal" as const, label: t("mode.personal"), which: "personal" as const },
                ] as const
              ).map(({ key, label, which }) => {
                const active = mode === key;
                return (
                  <button
                    key={key}
                    type="button"
                    className="bd-btn bd-mobile-mode-sheet-row"
                    onClick={() => {
                      setMode(key);
                      setMobileModeMenuOpen(false);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.75rem",
                      minHeight: 52,
                      padding: "0.5rem 0.75rem",
                      justifyContent: "flex-start",
                      width: "100%",
                      background: active ? "var(--bg-hover)" : "var(--bg-elevated)",
                      borderColor: active ? "var(--accent)" : "var(--border-default)",
                      fontWeight: 600,
                    }}
                  >
                    <span
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        background: active ? "var(--accent)" : "transparent",
                        color: active ? "#fff" : "var(--text-tertiary)",
                      }}
                    >
                      <WorkspaceModeIcon which={which} size={20} />
                    </span>
                    <span style={{ flex: 1, textAlign: "left", fontSize: "0.9375rem", color: "var(--text-primary)" }}>{label}</span>
                    {active && (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </div>
    </ErrorBoundary>
  );
}
