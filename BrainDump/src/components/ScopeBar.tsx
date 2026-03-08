"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Project {
  id: string;
  name: string;
  domain: string;
}

type Mode = "inbox" | "work" | "personal";

interface ScopeBarProps {
  mode: Mode;
  selectedProjectId: string | null;
  selectedCategory: string | null;
  onProjectSelect: (id: string | null) => void;
  onCategorySelect: (category: string | null) => void;
  searchFilter?: string;
  onSearchFilterChange?: (value: string) => void;
}

const CUSTOM_AREAS_KEY = "braindump_custom_areas";

function formatCategoryLabel(value: string): string {
  return value
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function loadCustomAreas(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CUSTOM_AREAS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((c: unknown) => typeof c === "string" && c.trim()) : [];
  } catch {
    return [];
  }
}

function saveCustomAreas(areas: string[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CUSTOM_AREAS_KEY, JSON.stringify(areas));
  } catch {}
}

function ScopeChip({
  label,
  selected,
  onClick,
  onContextMenu,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onContextMenu={onContextMenu}
      className="bd-btn"
      style={{
        padding: "0.4rem 0.75rem",
        fontSize: "0.8125rem",
        borderRadius: "var(--button-radius)",
        whiteSpace: "nowrap",
        background: selected ? "var(--accent)" : "var(--bg-elevated)",
        borderColor: selected ? "var(--accent)" : "var(--border-default)",
        color: selected ? "#fff" : "var(--text-primary)",
      }}
    >
      {label}
    </button>
  );
}

function fetchWorkProjects(): Promise<Project[]> {
  return fetch("/api/projects?domain=work")
    .then((r) => r.json())
    .then((d) => d.projects || [])
    .catch(() => []);
}

interface CountsResponse {
  projectCounts?: Record<string, number>;
  categoryCounts?: Record<string, number>;
  itemTypeCounts?: Record<string, number>;
}

function fetchCounts(domain: string): Promise<CountsResponse> {
  return fetch(`/api/organized-items/counts?domain=${domain}`)
    .then((r) => r.json())
    .then((d) => ({ projectCounts: d.projectCounts ?? {}, categoryCounts: d.categoryCounts ?? {}, itemTypeCounts: d.itemTypeCounts ?? {} }))
    .catch(() => ({}));
}

export function ScopeBar({
  mode,
  selectedProjectId,
  selectedCategory,
  onProjectSelect,
  onCategorySelect,
  searchFilter = "",
  onSearchFilterChange,
}: ScopeBarProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [counts, setCounts] = useState<CountsResponse | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; project: Project } | null>(null);
  const [confirmProject, setConfirmProject] = useState<Project | null>(null);
  const [renameProject, setRenameProject] = useState<Project | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [customAreasState, setCustomAreasState] = useState<string[]>([]);
  const [addAreaValue, setAddAreaValue] = useState("");
  const [showAddArea, setShowAddArea] = useState(false);
  const [areaContextMenu, setAreaContextMenu] = useState<{ value: string; x: number; y: number; isCustom: boolean } | null>(null);
  const [showAddProject, setShowAddProject] = useState(false);
  const [addProjectName, setAddProjectName] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  const loadProjects = useCallback(() => {
    if (mode !== "work") return;
    fetchWorkProjects().then(setProjects);
  }, [mode]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    if (mode === "work" || mode === "personal") {
      setCounts(null);
      fetchCounts(mode).then(setCounts);
    }
  }, [mode]);

  useEffect(() => {
    if (mode === "personal") setCustomAreasState(loadCustomAreas());
  }, [mode]);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [contextMenu]);

  useEffect(() => {
    if (!areaContextMenu) return;
    const close = () => setAreaContextMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [areaContextMenu]);

  const handleDeleteProject = useCallback(
    (project: Project) => {
      setContextMenu(null);
      setConfirmProject(project);
    },
    []
  );

  const confirmDeleteProject = useCallback(() => {
    if (!confirmProject) return;
    const id = confirmProject.id;
    setConfirmProject(null);
    fetch(`/api/projects/${id}`, { method: "DELETE" })
      .then((r) => {
        if (r.ok) {
          if (selectedProjectId === id) onProjectSelect(null);
          loadProjects();
        }
      })
      .catch(() => {});
  }, [confirmProject, selectedProjectId, onProjectSelect, loadProjects]);

  if (mode === "inbox") return null;

  if (mode === "work") {
    return (
      <>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.5rem 1rem",
            background: "var(--bg-secondary)",
            borderBottom: "1px solid var(--border-subtle)",
            overflowX: "auto",
          }}
        >
          <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-tertiary)", flexShrink: 0 }}>
            Project:
          </span>
          <div style={{ display: "flex", gap: "0.35rem", flexWrap: "nowrap", alignItems: "center" }}>
            <ScopeChip
              label="All"
              selected={!selectedProjectId}
              onClick={() => onProjectSelect(null)}
            />
            {projects.map((p) => (
                <ScopeChip
                  key={p.id}
                  label={p.name}
                  selected={selectedProjectId === p.id}
                  onClick={() => onProjectSelect(p.id)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContextMenu({ x: e.clientX, y: e.clientY, project: p });
                  }}
                />
              ))}
            {showAddProject ? (
              <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                <input
                  className="bd-input"
                  value={addProjectName}
                  onChange={(e) => setAddProjectName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const name = addProjectName.trim();
                      if (name) {
                        fetch("/api/projects", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ name, domain: "work" }),
                        })
                          .then((r) => r.json())
                          .then((d) => {
                            if (d.project?.id) {
                              loadProjects();
                              onProjectSelect(d.project.id);
                            }
                          })
                          .catch(() => {});
                        setAddProjectName("");
                        setShowAddProject(false);
                      }
                    } else if (e.key === "Escape") {
                      setAddProjectName("");
                      setShowAddProject(false);
                    }
                  }}
                  placeholder="New project…"
                  autoFocus
                  style={{ width: 120, padding: "0.3rem 0.5rem", fontSize: "0.8125rem" }}
                />
                <button type="button" className="bd-btn" onClick={() => { setAddProjectName(""); setShowAddProject(false); }} style={{ padding: "0.3rem 0.5rem" }}>
                  Cancel
                </button>
              </span>
            ) : (
              <button
                type="button"
                className="bd-btn"
                onClick={() => setShowAddProject(true)}
                title="Add project"
                style={{ padding: "0.4rem 0.5rem", minWidth: 32 }}
              >
                +
              </button>
            )}
          </div>
          {onSearchFilterChange && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginLeft: "auto", flexShrink: 0 }}>
              <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-tertiary)" }}>Filter:</span>
              <input
                type="text"
                className="bd-input"
                value={searchFilter}
                onChange={(e) => onSearchFilterChange(e.target.value)}
                placeholder="Search entries…"
                style={{ width: 160, padding: "0.35rem 0.5rem", fontSize: "0.8125rem" }}
              />
            </div>
          )}
        </div>

        {contextMenu && (
          <div
            ref={menuRef}
            style={{
              position: "fixed",
              left: contextMenu.x,
              top: contextMenu.y,
              zIndex: 1000,
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--button-radius)",
              boxShadow: "var(--shadow-md)",
              padding: "0.25rem 0",
              minWidth: "120px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="bd-btn"
              style={{ width: "100%", justifyContent: "flex-start" }}
              onClick={() => {
                setRenameProject(contextMenu.project);
                setRenameValue(contextMenu.project.name);
                setContextMenu(null);
              }}
            >
              Rename
            </button>
            <button
              type="button"
              className="bd-btn"
              style={{ width: "100%", justifyContent: "flex-start", color: "var(--text-danger, #c53030)" }}
              onClick={() => handleDeleteProject(contextMenu.project)}
            >
              Delete project
            </button>
          </div>
        )}

        {renameProject && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 1100,
              background: "rgba(0,0,0,0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "1rem",
            }}
            onClick={() => { setRenameProject(null); setRenameValue(""); }}
          >
            <div
              className="bd-panel"
              style={{ padding: "1.25rem", maxWidth: 360, width: "100%" }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ margin: "0 0 0.75rem", fontSize: "1rem" }}>Rename project</h3>
              <input
                className="bd-input"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const name = renameValue.trim();
                    if (name) {
                      fetch(`/api/projects/${renameProject.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ name }),
                      })
                        .then((r) => r.json())
                        .then((d) => {
                          if (d.project) {
                            loadProjects();
                            if (selectedProjectId === renameProject.id) onProjectSelect(renameProject.id);
                          }
                          setRenameProject(null);
                          setRenameValue("");
                        })
                        .catch(() => {});
                    }
                  } else if (e.key === "Escape") {
                    setRenameProject(null);
                    setRenameValue("");
                  }
                }}
                placeholder="Project name"
                autoFocus
                style={{ width: "100%", marginBottom: "1rem" }}
              />
              <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                <button type="button" className="bd-btn" onClick={() => { setRenameProject(null); setRenameValue(""); }}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="bd-btn bd-btn-primary"
                  onClick={() => {
                    const name = renameValue.trim();
                    if (!name) return;
                    fetch(`/api/projects/${renameProject.id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ name }),
                    })
                      .then((r) => r.json())
                      .then((d) => {
                        if (d.project) {
                          loadProjects();
                          if (selectedProjectId === renameProject.id) onProjectSelect(renameProject.id);
                        }
                        setRenameProject(null);
                        setRenameValue("");
                      })
                      .catch(() => {});
                  }}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {confirmProject && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 1100,
              background: "rgba(0,0,0,0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "1rem",
            }}
            onClick={() => setConfirmProject(null)}
          >
            <div
              className="bd-panel"
              style={{ padding: "1.25rem", maxWidth: 360 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ margin: "0 0 0.75rem", fontSize: "1rem" }}>Delete project?</h3>
              <p style={{ margin: "0 0 1rem", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                &ldquo;{confirmProject.name}&rdquo; and all its tasks, notes, and other items will be permanently deleted. This cannot be undone.
              </p>
              <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                <button type="button" className="bd-btn" onClick={() => setConfirmProject(null)}>
                  No
                </button>
                <button
                  type="button"
                  className="bd-btn"
                  style={{ background: "var(--text-danger, #c53030)", color: "#fff", borderColor: "var(--text-danger, #c53030)" }}
                  onClick={confirmDeleteProject}
                >
                  Yes, delete
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  if (mode === "personal") {
    const apiCategories = counts?.categoryCounts ? Object.keys(counts.categoryCounts).filter((k) => (counts!.categoryCounts![k] ?? 0) > 0) : [];
    const customAreas = (customAreasState.length ? customAreasState : loadCustomAreas()).filter((c) => !apiCategories.includes(c));
    const allAreas = [...apiCategories, ...customAreas].sort((a, b) => a.localeCompare(b));

    return (
      <>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.5rem 1rem",
            background: "var(--bg-secondary)",
            borderBottom: "1px solid var(--border-subtle)",
            overflowX: "auto",
          }}
        >
          <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-tertiary)", flexShrink: 0 }}>
            Area:
          </span>
          <div style={{ display: "flex", gap: "0.35rem", flexWrap: "nowrap", alignItems: "center" }}>
            <ScopeChip
              label="All"
              selected={!selectedCategory}
              onClick={() => onCategorySelect(null)}
            />
            {allAreas.map((value) => (
              <ScopeChip
                key={value}
                label={formatCategoryLabel(value)}
                selected={selectedCategory === value}
                onClick={() => onCategorySelect(value)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setAreaContextMenu({
                    value,
                    x: e.clientX,
                    y: e.clientY,
                    isCustom: customAreas.includes(value),
                  });
                }}
              />
            ))}
            {showAddArea ? (
              <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                <input
                  className="bd-input"
                  value={addAreaValue}
                  onChange={(e) => setAddAreaValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const v = addAreaValue.trim().toLowerCase().replace(/\s+/g, "_");
                      if (v) {
                        const current = loadCustomAreas();
                        if (!current.includes(v)) {
                          const next = [...current, v];
                          saveCustomAreas(next);
                          setCustomAreasState(next);
                          onCategorySelect(v);
                        }
                        setAddAreaValue("");
                        setShowAddArea(false);
                      }
                    } else if (e.key === "Escape") {
                      setAddAreaValue("");
                      setShowAddArea(false);
                    }
                  }}
                  placeholder="New area…"
                  autoFocus
                  style={{ width: 100, padding: "0.3rem 0.5rem", fontSize: "0.8125rem" }}
                />
                <button type="button" className="bd-btn" onClick={() => { setAddAreaValue(""); setShowAddArea(false); }} style={{ padding: "0.3rem 0.5rem" }}>
                  Cancel
                </button>
              </span>
            ) : (
              <button
                type="button"
                className="bd-btn"
                onClick={() => setShowAddArea(true)}
                title="Add area"
                style={{ padding: "0.4rem 0.5rem", minWidth: 32 }}
              >
                +
              </button>
            )}
          </div>
          {onSearchFilterChange && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginLeft: "auto", flexShrink: 0 }}>
              <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-tertiary)" }}>Filter:</span>
              <input
                type="text"
                className="bd-input"
                value={searchFilter}
                onChange={(e) => onSearchFilterChange(e.target.value)}
                placeholder="Search entries…"
                style={{ width: 160, padding: "0.35rem 0.5rem", fontSize: "0.8125rem" }}
              />
            </div>
          )}
        </div>
        {areaContextMenu?.isCustom && (
          <div
            style={{
              position: "fixed",
              left: areaContextMenu.x,
              top: areaContextMenu.y,
              zIndex: 1000,
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--button-radius)",
              boxShadow: "var(--shadow-md)",
              padding: "0.25rem 0",
              minWidth: "120px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="bd-btn"
              style={{ width: "100%", justifyContent: "flex-start", color: "var(--text-danger, #c53030)" }}
              onClick={() => {
                const next = loadCustomAreas().filter((c) => c !== areaContextMenu.value);
                saveCustomAreas(next);
                setCustomAreasState(next);
                if (selectedCategory === areaContextMenu.value) onCategorySelect(null);
                setAreaContextMenu(null);
              }}
            >
              Remove area
            </button>
          </div>
        )}
      </>
    );
  }

  return null;
}
