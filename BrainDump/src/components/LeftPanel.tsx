"use client";

import { useCallback, useEffect, useState } from "react";

interface Project {
  id: string;
  name: string;
  domain: string;
}

interface LeftPanelProps {
  mode: string;
  selectedProjectId: string | null;
  selectedCategory: string | null;
  selectedItemType: string | null;
  onProjectSelect: (id: string | null) => void;
  onCategorySelect: (category: string | null) => void;
  onItemTypeSelect: (type: string | null) => void;
}

function formatTypeLabel(value: string): string {
  const label = value
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
  return label.endsWith("s") ? label : label + "s";
}

function NavItem({
  label,
  selected,
  onClick,
  indent = false,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  indent?: boolean;
}) {
  return (
    <button
      type="button"
      className="bd-btn"
      onClick={onClick}
      style={{
        width: "100%",
        justifyContent: "flex-start",
        padding: "0.5rem 0.75rem",
        marginBottom: "0.125rem",
        background: selected ? "var(--bg-hover)" : undefined,
        borderRadius: "var(--button-radius)",
        fontSize: "0.8125rem",
        fontWeight: selected ? 600 : 400,
        ...(indent ? { paddingLeft: "1.25rem", borderLeft: "2px solid var(--border-default)", marginLeft: "0.25rem" } : {}),
      }}
    >
      {label}
    </button>
  );
}

interface CountsResponse {
  projectCounts?: Record<string, number>;
  categoryCounts?: Record<string, number>;
  itemTypeCounts?: Record<string, number>;
}

function fetchCounts(domain: string, projectId?: string | null, category?: string | null): Promise<CountsResponse> {
  const params = new URLSearchParams({ domain });
  if (projectId) params.set("projectId", projectId);
  if (category) params.set("category", category);
  return fetch(`/api/organized-items/counts?${params}`)
    .then((r) => r.json())
    .then((d) => ({ projectCounts: d.projectCounts ?? {}, categoryCounts: d.categoryCounts ?? {}, itemTypeCounts: d.itemTypeCounts ?? {} }))
    .catch(() => ({}));
}

export function LeftPanel({
  mode,
  selectedProjectId,
  selectedCategory,
  selectedItemType,
  onProjectSelect,
  onCategorySelect,
  onItemTypeSelect,
}: LeftPanelProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [counts, setCounts] = useState<CountsResponse | null>(null);

  useEffect(() => {
    const domain = mode === "work" ? "work" : mode === "personal" ? "personal" : undefined;
    const q = domain ? `?domain=${domain}` : "";
    fetch(`/api/projects${q}`)
      .then((r) => r.json())
      .then((d) => setProjects(d.projects || []))
      .catch(() => setProjects([]));
  }, [mode]);

  const loadCounts = useCallback(() => {
    if (mode !== "work" && mode !== "personal") return;
    setCounts(null);
    fetchCounts(
      mode,
      mode === "work" ? selectedProjectId : undefined,
      mode === "personal" ? selectedCategory : undefined
    ).then(setCounts);
  }, [mode, selectedProjectId, selectedCategory]);

  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  const itemTypeLabel = (value: string) =>
    value === "calendar" ? "Calendar" : mode === "personal" && value === "task" ? "Todo" : formatTypeLabel(value);
  const itemTypes =
    counts?.itemTypeCounts && Object.keys(counts.itemTypeCounts).length > 0
      ? Object.keys(counts.itemTypeCounts)
          .filter((v) => (counts!.itemTypeCounts![v] ?? 0) > 0)
          .sort((a, b) => a.localeCompare(b))
          .map((value) => ({ value, label: itemTypeLabel(value) }))
      : mode === "personal"
        ? [
            { value: "task", label: "Todo" },
            { value: "note", label: "Notes" },
            { value: "idea", label: "Ideas" },
            { value: "reflection", label: "Reflections" },
            { value: "calendar", label: "Calendar" },
          ]
        : [
            { value: "task", label: "Tasks" },
            { value: "note", label: "Notes" },
            { value: "idea", label: "Ideas" },
            { value: "calendar", label: "Calendar" },
            ...(mode === "inbox" ? [{ value: "emotion", label: "Emotions" }, { value: "reflection", label: "Reflections" }] : []),
          ];

  const selectedProjectName = selectedProjectId ? projects.find((p) => p.id === selectedProjectId)?.name : null;
  const showProjectSection = mode === "inbox";

  return (
    <div className="bd-panel" style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {showProjectSection && (
        <section>
          <h2 style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--text-tertiary)", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Projects
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.125rem" }}>
            <NavItem label="All projects" selected={!selectedProjectId} onClick={() => onProjectSelect(null)} />
            {projects.map((p) => (
              <NavItem
                key={p.id}
                label={p.name}
                selected={selectedProjectId === p.id}
                onClick={() => onProjectSelect(p.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Content type – tasks, notes, ideas, etc. */}
      <section>
        <h2 style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--text-tertiary)", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          {!showProjectSection && selectedProjectName ? `In ${selectedProjectName}` : "Content type"}
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.125rem" }}>
          <NavItem
            label="All types"
            selected={!selectedItemType}
            onClick={() => onItemTypeSelect(null)}
            indent
          />
          {itemTypes.map(({ value, label }) => (
            <NavItem
              key={value}
              label={label}
              selected={selectedItemType === value}
              onClick={() => onItemTypeSelect(value)}
              indent
            />
          ))}
        </div>
      </section>
    </div>
  );
}
