"use client";

import { useCallback, useEffect, useState } from "react";

interface SavedItem {
  id: string;
  domain: string;
  category: string;
  subcategory: string;
  itemType: string;
  title: string;
  content: string;
  status: string;
  progress?: string;
  recommendedView: string;
  reminderAt?: string | null;
  reminderMinutesBefore?: number | null;
  project?: { id: string; name: string } | null;
  tags?: { tag: { name: string } }[];
}

interface SavedItemsListProps {
  mode: string;
  projectId: string | null;
  category: string | null;
  itemType: string | null;
}

const PROGRESS_OPTIONS = ["todo", "started", "completed"] as const;

function entryTypeLabel(itemType: string): string {
  return (itemType || "note").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const ENTRY_TYPES_BY_DOMAIN: Record<string, { value: string; label: string }[]> = {
  work: [
    { value: "task", label: "Task" },
    { value: "note", label: "Note" },
    { value: "idea", label: "Idea" },
    { value: "calendar", label: "Calendar" },
  ],
  personal: [
    { value: "task", label: "Task" },
    { value: "note", label: "Note" },
    { value: "idea", label: "Idea" },
    { value: "emotion", label: "Emotion" },
    { value: "reflection", label: "Reflection" },
    { value: "calendar", label: "Calendar" },
  ],
  inbox: [
    { value: "task", label: "Task" },
    { value: "note", label: "Note" },
    { value: "idea", label: "Idea" },
    { value: "emotion", label: "Emotion" },
    { value: "reflection", label: "Reflection" },
    { value: "calendar", label: "Calendar" },
  ],
};

export function SavedItemsList({ mode, projectId, category, itemType }: SavedItemsListProps) {
  const [items, setItems] = useState<SavedItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(() => {
    const params = new URLSearchParams();
    params.set("domain", mode);
    if (projectId) params.set("projectId", projectId);
    if (category) params.set("category", category);
    if (itemType) params.set("itemType", itemType);
    setLoading(true);
    fetch(`/api/organized-items?${params}`)
      .then((r) => r.json())
      .then((d) => setItems(d.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [mode, projectId, category, itemType]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const updateProgress = useCallback((id: string, progress: string) => {
    fetch(`/api/organized-items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ progress }),
    })
      .then((r) => {
        if (r.ok) setItems((prev) => prev.map((it) => (it.id === id ? { ...it, progress } : it)));
      })
      .catch(() => {});
  }, []);

  const deleteItem = useCallback((id: string, skipConfirm?: boolean) => {
    if (!skipConfirm && !confirm("Delete this item?")) return;
    fetch(`/api/organized-items/${id}`, { method: "DELETE" })
      .then((r) => {
        if (r.ok) setItems((prev) => prev.filter((it) => it.id !== id));
      })
      .catch(() => {});
  }, []);

  const updateItemType = useCallback((id: string, newType: string) => {
    fetch(`/api/organized-items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemType: newType }),
    })
      .then((r) => {
        if (r.ok) setItems((prev) => prev.map((it) => (it.id === id ? { ...it, itemType: newType } : it)));
      })
      .catch(() => {});
  }, []);

  const updateEntryContent = useCallback((id: string, updates: { title?: string; content?: string }) => {
    fetch(`/api/organized-items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    })
      .then((r) => {
        if (r.ok) setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...updates } : it)));
      })
      .catch(() => {});
  }, []);

  const REMINDER_MINUTES_OPTIONS = [0, 5, 10, 15, 30, 60] as const;
  const updateReminder = useCallback(
    (id: string, reminderDate: string, reminderTime: string, reminderMinutesBefore: number) => {
      const clearReminder = !reminderDate.trim();
      const payload = clearReminder
        ? { reminderAt: null, reminderMinutesBefore: null, reminderNotifiedAt: null, reminderEarlyNotifiedAt: null }
        : {
            reminderAt: new Date(reminderDate + "T" + (reminderTime || "00:00") + ":00").toISOString(),
            reminderMinutesBefore: reminderMinutesBefore || 0,
            reminderNotifiedAt: null,
            reminderEarlyNotifiedAt: null,
          };
      fetch(`/api/organized-items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then((r) => {
          if (r.ok)
            setItems((prev) =>
              prev.map((it) =>
                it.id === id
                  ? {
                      ...it,
                      reminderAt: clearReminder ? undefined : payload.reminderAt,
                      reminderMinutesBefore: clearReminder ? undefined : payload.reminderMinutesBefore,
                    }
                  : it
              )
            );
        })
        .catch(() => {});
    },
    []
  );

  const [itemContextMenu, setItemContextMenu] = useState<{ id: string; x: number; y: number; domain: string; currentType: string } | null>(null);
  const [editingEntry, setEditingEntry] = useState<{ id: string; title: string; content: string } | null>(null);
  const [reminderEntry, setReminderEntry] = useState<{
    id: string;
    title: string;
    reminderDate: string;
    reminderTime: string;
    reminderMinutesBefore: number;
  } | null>(null);
  useEffect(() => {
    if (!itemContextMenu) return;
    const close = () => setItemContextMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [itemContextMenu]);

  if (loading) {
    return (
      <div className="bd-panel" style={{ padding: "1.5rem" }}>
        <p className="bd-empty">Loading…</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="bd-panel" style={{ padding: "1.5rem" }}>
        <p className="bd-empty">No saved items yet. Record, transcribe, organize, then save.</p>
      </div>
    );
  }

  return (
    <div className="bd-panel" style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
        Saved items
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", overflow: "auto" }}>
        {items.map((it) => (
          <div
            key={it.id}
            onDoubleClick={() => setEditingEntry({ id: it.id, title: it.title, content: it.content ?? "" })}
            onContextMenu={(e) => {
              e.preventDefault();
              setItemContextMenu({ id: it.id, x: e.clientX, y: e.clientY, domain: it.domain, currentType: it.itemType });
            }}
            style={{
              padding: "0.75rem",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--button-radius)",
              background: "var(--bg-tertiary)",
              cursor: "pointer",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{it.title}</div>
                <div
                  style={{
                    fontSize: "0.8125rem",
                    color: "var(--text-secondary)",
                    marginTop: "0.25rem",
                    lineHeight: 1.4,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {it.content?.trim() ? (it.content.length > 160 ? `${it.content.slice(0, 160)}…` : it.content) : "—"}
                </div>
                <div style={{ fontSize: "0.7rem", color: "var(--text-tertiary)", marginTop: "0.25rem" }}>
                  {entryTypeLabel(it.itemType)}
                  {it.category && ` · ${it.category}`}
                  {it.project && ` · ${it.project.name}`}
                </div>
              </div>
              {it.itemType === "task" && (
                <div style={{ flexShrink: 0 }}>
                  <select
                    className="bd-input"
                    value={it.progress || "todo"}
                    onChange={(e) => updateProgress(it.id, e.target.value)}
                    style={{ width: "auto", fontSize: "0.75rem", padding: "0.2rem 0.4rem" }}
                  >
                    {PROGRESS_OPTIONS.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {itemContextMenu && (() => {
        const types = ENTRY_TYPES_BY_DOMAIN[itemContextMenu.domain] ?? ENTRY_TYPES_BY_DOMAIN.inbox;
        return (
          <div
            style={{
              position: "fixed",
              left: itemContextMenu.x,
              top: itemContextMenu.y,
              zIndex: 1000,
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--button-radius)",
              boxShadow: "var(--shadow-md)",
              padding: "0.25rem 0",
              minWidth: "140px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: "0.25rem 0.5rem", fontSize: "0.7rem", fontWeight: 600, color: "var(--text-tertiary)", borderBottom: "1px solid var(--border-default)" }}>
              Change type
            </div>
            {types.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                className="bd-btn"
                style={{
                  width: "100%",
                  justifyContent: "flex-start",
                  fontWeight: itemContextMenu.currentType === value ? 600 : 400,
                }}
                onClick={() => {
                  updateItemType(itemContextMenu.id, value);
                  setItemContextMenu(null);
                }}
              >
                {label}
                {itemContextMenu.currentType === value ? " ✓" : ""}
              </button>
            ))}
            <button
              type="button"
              className="bd-btn"
              style={{ width: "100%", justifyContent: "flex-start" }}
              onClick={() => {
                const it = items.find((i) => i.id === itemContextMenu.id);
                if (it) setEditingEntry({ id: it.id, title: it.title, content: it.content ?? "" });
                setItemContextMenu(null);
              }}
            >
              Edit
            </button>
            <button
              type="button"
              className="bd-btn"
              style={{ width: "100%", justifyContent: "flex-start" }}
              onClick={() => {
                const it = items.find((i) => i.id === itemContextMenu.id);
                if (it) {
                  const at = it.reminderAt ? String(it.reminderAt) : "";
                  const datePart = at ? at.slice(0, 10) : "";
                  const timePart = at && at.length >= 16 ? at.slice(11, 16) : "09:00";
                  setReminderEntry({
                    id: it.id,
                    title: it.title,
                    reminderDate: datePart,
                    reminderTime: timePart,
                    reminderMinutesBefore: it.reminderMinutesBefore ?? 0,
                  });
                }
                setItemContextMenu(null);
              }}
            >
              Set reminder
            </button>
            <div style={{ borderTop: "1px solid var(--border-default)", marginTop: "0.25rem", paddingTop: "0.25rem" }}>
              <button
                type="button"
                className="bd-btn"
                style={{ width: "100%", justifyContent: "flex-start", color: "var(--text-danger, #c53030)" }}
                onClick={() => {
                  deleteItem(itemContextMenu.id, true);
                  setItemContextMenu(null);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        );
      })()}

      {editingEntry && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1100,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
          onClick={() => setEditingEntry(null)}
        >
          <div
            className="bd-panel"
            style={{ padding: "1.25rem", maxWidth: 480, width: "100%" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 0.75rem", fontSize: "1rem" }}>Edit entry</h3>
            <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-tertiary)", marginBottom: "0.25rem" }}>Headline</label>
            <input
              className="bd-input"
              value={editingEntry.title}
              onChange={(e) => setEditingEntry((prev) => prev && { ...prev, title: e.target.value })}
              placeholder="Title"
              style={{ width: "100%", marginBottom: "0.75rem" }}
              autoFocus
            />
            <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-tertiary)", marginBottom: "0.25rem" }}>Description</label>
            <textarea
              className="bd-textarea"
              value={editingEntry.content}
              onChange={(e) => setEditingEntry((prev) => prev && { ...prev, content: e.target.value })}
              placeholder="What you said (description)"
            style={{ width: "100%", minHeight: 120, marginBottom: "1rem", borderRadius: 18 }}
            />
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button type="button" className="bd-btn" onClick={() => setEditingEntry(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="bd-btn bd-btn-primary"
                onClick={() => {
                  updateEntryContent(editingEntry.id, { title: editingEntry.title, content: editingEntry.content });
                  setEditingEntry(null);
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {reminderEntry && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1100,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
          onClick={() => setReminderEntry(null)}
        >
          <div
            className="bd-panel"
            style={{ padding: "1.25rem", maxWidth: 400, width: "100%" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 0.75rem", fontSize: "1rem" }}>Set reminder</h3>
            <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", margin: "0 0 0.75rem" }}>{reminderEntry.title}</p>
            <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-tertiary)", marginBottom: "0.25rem" }}>Date & time</label>
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
              <input
                type="date"
                className="bd-input"
                value={reminderEntry.reminderDate}
                onChange={(e) => setReminderEntry((p) => p && { ...p, reminderDate: e.target.value })}
                style={{ flex: "1 1 120px", padding: "0.35rem 0.5rem" }}
              />
              <input
                type="time"
                className="bd-input"
                value={reminderEntry.reminderTime}
                onChange={(e) => setReminderEntry((p) => p && { ...p, reminderTime: e.target.value })}
                style={{ flex: "1 1 100px", padding: "0.35rem 0.5rem" }}
              />
            </div>
            <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-tertiary)", marginBottom: "0.25rem" }}>Also notify this many minutes before</label>
            <select
              className="bd-input"
              value={reminderEntry.reminderMinutesBefore}
              onChange={(e) => setReminderEntry((p) => p && { ...p, reminderMinutesBefore: Number(e.target.value) })}
              style={{ width: "100%", marginBottom: "1rem", padding: "0.35rem 0.5rem" }}
            >
              {REMINDER_MINUTES_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m === 0 ? "No early notification" : `${m} minutes before`}
                </option>
              ))}
            </select>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button type="button" className="bd-btn" onClick={() => setReminderEntry(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="bd-btn"
                style={{ color: "var(--text-secondary)" }}
                onClick={() => {
                  updateReminder(reminderEntry.id, "", "", 0);
                  setReminderEntry(null);
                }}
              >
                Clear reminder
              </button>
              <button
                type="button"
                className="bd-btn bd-btn-primary"
                onClick={() => {
                  if (reminderEntry.reminderDate.trim()) {
                    updateReminder(
                      reminderEntry.id,
                      reminderEntry.reminderDate,
                      reminderEntry.reminderTime || "00:00",
                      reminderEntry.reminderMinutesBefore
                    );
                  }
                  setReminderEntry(null);
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
