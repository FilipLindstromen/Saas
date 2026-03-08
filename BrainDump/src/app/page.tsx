"use client";

import { useCallback, useEffect, useState } from "react";
import { TopBar } from "@/components/TopBar";
import { ScopeBar } from "@/components/ScopeBar";
import { CenterPanel, type OrganizedItemPreview } from "@/components/CenterPanel";
import { RightPanel } from "@/components/RightPanel";
import { SettingsModal } from "@/components/SettingsModal";
import { loadViewPreference, type ItemsViewType } from "@/components/ItemsViewArea";

const VIEW_STORAGE_KEY = "braindump-items-view";

type Mode = "inbox" | "work" | "personal" | "all";

export default function BrainDumpPage() {
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
            new Notification("Reminder", { body: it.title });
            await fetch(`/api/organized-items/${it.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ reminderNotifiedAt: new Date().toISOString() }),
            });
          } else if (earlyAt && !it.reminderEarlyNotifiedAt && now >= earlyAt) {
            new Notification("Reminder soon", { body: `${it.title} (in ${minBefore} min)` });
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
    const t = setInterval(check, 60 * 1000);
    return () => clearInterval(t);
  }, []);

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
        const resDump = await fetch("/api/dumps", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode,
            transcriptRaw: transcript,
            transcriptEdited: transcript,
            status: "organized",
          }),
        });
        const { dump } = await resDump.json();
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

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "var(--bg-primary)" }}>
      <TopBar mode={mode} onModeChange={setMode} onOpenSettings={() => setShowSettings(true)} />

      <div
        style={{
          display: "flex",
          flex: 1,
          minHeight: 0,
          alignItems: "stretch",
        }}
      >
        <aside
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
            onClick={() => setMode("work")}
            title="Work"
            aria-label="Work"
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
            title="Personal"
            aria-label="Personal"
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
          <button
            type="button"
            onClick={() => setMode("all")}
            title="All"
            aria-label="All"
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
        </aside>

        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "0" }}>
          {(mode === "work" || mode === "personal" || mode === "all") && (
            <div style={{ flexShrink: 0, padding: "0.5rem 1rem 0", borderBottom: "1px solid var(--border-subtle)" }}>
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
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "0.75rem", padding: "1rem", overflow: "auto" }}>
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
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
}
