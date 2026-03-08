"use client";

import { useEffect, useState } from "react";
import type { OrganizedItemPreview } from "./CenterPanel";
import { SavedItemsList } from "./SavedItemsList";

interface EditableItem extends OrganizedItemPreview {
  _localId?: string;
}

interface RightPanelProps {
  mode: string;
  items: EditableItem[];
  transcript?: string;
  onSaveComplete: () => void;
  projectId?: string | null;
  category?: string | null;
  itemType?: string | null;
}

export function RightPanel({ mode, items, transcript, onSaveComplete, projectId, category, itemType }: RightPanelProps) {
  const [editing, setEditing] = useState<EditableItem[]>([]);

  useEffect(() => {
    if (items.length > 0) {
      setEditing(items.map((it, i) => ({ ...it, _localId: `local-${i}` })));
    }
  }, [items]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateItem = (localId: string, updates: Partial<EditableItem>) => {
    setEditing((prev) =>
      prev.map((it) => (it._localId === localId ? { ...it, ...updates } : it))
    );
  };

  const handleSave = async () => {
    if (editing.length === 0) {
      setError("No items to save.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const resDump = await fetch("/api/dumps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          transcriptRaw: transcript ?? "",
          transcriptEdited: transcript ?? "",
          status: "organized",
        }),
      });
      const dataDump = await resDump.json();
      if (!resDump.ok) throw new Error((dataDump as { error?: string }).error || "Failed to create dump");
      const dump = (dataDump as { dump?: { id: string } }).dump;
      if (!dump?.id) throw new Error("Failed to create dump");

      const payload = editing.map((it) => ({
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
      if (!resBatch.ok) throw new Error(dataBatch.error || "Failed to save items");

      await fetch(`/api/dumps/${dump.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "saved", organizedAt: new Date().toISOString() }),
      });

      setEditing([]);
      onSaveComplete();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const moveToNeedsReview = (localId: string) => {
    updateItem(localId, { domain: "inbox", category: "needs_review" });
  };

  if (mode !== "inbox") {
    return null;
  }

  if (items.length === 0 && editing.length === 0) {
    return (
      <SavedItemsList
        mode={mode}
        projectId={projectId ?? null}
        category={category ?? null}
        itemType={itemType ?? null}
      />
    );
  }

  const list = editing.length > 0 ? editing : items.map((it, i) => ({ ...it, _localId: `local-${i}` }));

  return (
    <div className="bd-panel" style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
        <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
          Review & save
        </h3>
        <button type="button" className="bd-btn bd-btn-primary" onClick={handleSave} disabled={saving || list.length === 0}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
      {error && (
        <div style={{ padding: "0.5rem", background: "rgba(255,71,87,0.1)", borderRadius: "var(--button-radius)", color: "#ff4757", fontSize: "0.875rem" }}>
          {error}
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", overflow: "auto" }}>
        {list.map((it) => (
          <ItemCard
            key={it._localId ?? it.title}
            item={it}
            onUpdate={(updates) => it._localId && updateItem(it._localId, updates)}
            onMoveToNeedsReview={it._localId ? () => moveToNeedsReview(it._localId!) : undefined}
          />
        ))}
      </div>
    </div>
  );
}

function ItemCard({
  item,
  onUpdate,
  onMoveToNeedsReview,
}: {
  item: EditableItem;
  onUpdate: (u: Partial<EditableItem>) => void;
  onMoveToNeedsReview?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      style={{
        border: "1px solid var(--border-default)",
        borderRadius: "var(--button-radius)",
        padding: "0.75rem",
        background: "var(--bg-tertiary)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
        <input
          className="bd-input"
          value={item.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
          placeholder="Headline"
          style={{ flex: 1, fontWeight: 600 }}
        />
        <span style={{ fontSize: "0.7rem", color: "var(--text-tertiary)" }}>{item.item_type}</span>
      </div>
      {(item.content ?? "").trim() && (
        <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginTop: "0.35rem", lineHeight: 1.4 }}>
          {item.content?.trim()}
        </div>
      )}
      <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <select
          className="bd-input"
          value={item.domain}
          onChange={(e) => onUpdate({ domain: e.target.value })}
          style={{ width: "auto", minWidth: "6rem" }}
        >
          <option value="inbox">inbox</option>
          <option value="work">work</option>
          <option value="personal">personal</option>
        </select>
        <input
          className="bd-input"
          value={item.category}
          onChange={(e) => onUpdate({ category: e.target.value })}
          placeholder="Category"
          style={{ width: "auto", minWidth: "6rem" }}
        />
        <input
          className="bd-input"
          value={item.project_name ?? ""}
          onChange={(e) => onUpdate({ project_name: e.target.value || undefined })}
          placeholder="Project"
          style={{ width: "auto", minWidth: "6rem" }}
        />
        {onMoveToNeedsReview && (
          <button type="button" className="bd-btn" onClick={onMoveToNeedsReview} style={{ marginLeft: "auto" }}>
            Move to needs_review
          </button>
        )}
      </div>
      <div style={{ marginTop: "0.5rem" }}>
        <button type="button" className="bd-btn" onClick={() => setExpanded(!expanded)} style={{ fontSize: "0.75rem" }}>
          {expanded ? "Hide description" : "Edit description"}
        </button>
        {expanded && (
          <textarea
            className="bd-textarea"
            value={item.content ?? ""}
            onChange={(e) => onUpdate({ content: e.target.value })}
            placeholder="Description (what you said)"
            style={{ marginTop: "0.5rem", minHeight: "80px" }}
          />
        )}
      </div>
    </div>
  );
}
