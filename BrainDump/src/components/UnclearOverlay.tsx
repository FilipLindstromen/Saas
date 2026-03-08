"use client";

import { useState } from "react";
import type { OrganizedItemPreview } from "./CenterPanel";

const DOMAINS = ["inbox", "work", "personal"] as const;
const CATEGORIES_WORK = ["projects", "tasks", "notes", "ideas", "meetings", "decisions", "problems", "opportunities"];
const CATEGORIES_PERSONAL = ["feeling", "thoughts", "hobbies", "goals", "health", "relationships", "shopping"];
const CATEGORIES_INBOX = ["unprocessed", "needs_review"];
const ITEM_TYPES = ["task", "note", "idea", "emotion", "reflection", "calendar", "problem", "decision", "journal_entry", "project_update"];

interface UnclearOverlayProps {
  items: OrganizedItemPreview[];
  projectNames: string[];
  onConfirm: (resolvedItems: OrganizedItemPreview[]) => void;
  onCancel: () => void;
}

export function UnclearOverlay({ items, projectNames, onConfirm, onCancel }: UnclearOverlayProps) {
  const [edited, setEdited] = useState<OrganizedItemPreview[]>(() =>
    items.map((it) => ({ ...it, domain: it.domain || "inbox", category: it.category || "unprocessed", item_type: it.item_type || "note" }))
  );

  const update = (index: number, updates: Partial<OrganizedItemPreview>) => {
    setEdited((prev) => prev.map((it, i) => (i === index ? { ...it, ...updates } : it)));
  };

  const categoriesForDomain = (domain: string) =>
    domain === "work" ? CATEGORIES_WORK : domain === "personal" ? CATEGORIES_PERSONAL : CATEGORIES_INBOX;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="unclear-title"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1100,
        padding: "1rem",
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--card-radius)",
          maxWidth: "560px",
          width: "100%",
          maxHeight: "85vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "var(--shadow-xl)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid var(--border-subtle)" }}>
          <h2 id="unclear-title" style={{ margin: 0, fontSize: "1rem", fontWeight: 600, color: "var(--text-primary)" }}>
            Clarify classification
          </h2>
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.8125rem", color: "var(--text-tertiary)" }}>
            The following items were unclear. Set domain, category, and type for each.
          </p>
        </div>
        <div style={{ overflow: "auto", flex: 1, padding: "1rem" }}>
          {edited.map((it, index) => (
            <div
              key={index}
              style={{
                padding: "0.75rem",
                marginBottom: "0.75rem",
                border: "1px solid var(--border-default)",
                borderRadius: "var(--button-radius)",
                background: "var(--bg-tertiary)",
              }}
            >
              <div style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--text-primary)", marginBottom: "0.5rem" }}>
                {it.title}
              </div>
              {it.content && (
                <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginBottom: "0.5rem", maxHeight: "2.5em", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {it.content}
                </div>
              )}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
                <select
                  className="bd-input"
                  value={it.domain}
                  onChange={(e) => {
                    const d = e.target.value as "inbox" | "work" | "personal";
                    const first = categoriesForDomain(d)[0];
                    update(index, { domain: d, category: first });
                  }}
                  style={{ width: "auto", minWidth: "6rem" }}
                >
                  {DOMAINS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                <select
                  className="bd-input"
                  value={it.category}
                  onChange={(e) => update(index, { category: e.target.value })}
                  style={{ width: "auto", minWidth: "7rem" }}
                >
                  {categoriesForDomain(it.domain).map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <select
                  className="bd-input"
                  value={it.item_type}
                  onChange={(e) => update(index, { item_type: e.target.value })}
                  style={{ width: "auto", minWidth: "7rem" }}
                >
                  {ITEM_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                {projectNames.length > 0 && (
                  <select
                    className="bd-input"
                    value={it.project_name ?? ""}
                    onChange={(e) => update(index, { project_name: e.target.value || undefined })}
                    style={{ width: "auto", minWidth: "6rem" }}
                  >
                    <option value="">No project</option>
                    {projectNames.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: "1rem", borderTop: "1px solid var(--border-subtle)", display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
          <button type="button" className="bd-btn" onClick={onCancel}>Cancel</button>
          <button type="button" className="bd-btn bd-btn-primary" onClick={() => onConfirm(edited)}>Apply & continue</button>
        </div>
      </div>
    </div>
  );
}
