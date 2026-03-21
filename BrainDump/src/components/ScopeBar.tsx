"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";

interface Project {
  id: string;
  name: string;
  domain: string;
}

type Mode = "inbox" | "work" | "personal" | "all";

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
  onMore,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onMore?: () => void;
}) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
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
      {onMore && (
        <button
          type="button"
          className="bd-btn"
          onClick={onMore}
          aria-label={`More actions for ${label}`}
          style={{ minWidth: 32, padding: "0.4rem 0.45rem", fontSize: "0.9rem", lineHeight: 1 }}
        >
          ⋮
        </button>
      )}
    </div>
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
  const { t } = useI18n();
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
  const [areaPickerOpen, setAreaPickerOpen] = useState(false);
  const [showAddProject, setShowAddProject] = useState(false);
  const [addProjectName, setAddProjectName] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const [scopeFilterOpen, setScopeFilterOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => setIsMobile(window.matchMedia("(max-width: 768px)").matches);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    if (searchFilter.trim()) setScopeFilterOpen(true);
  }, [searchFilter]);

  useEffect(() => {
    if (!isMobile) setAreaPickerOpen(false);
  }, [isMobile]);

  useEffect(() => {
    if (!isMobile) setScopeFilterOpen(false);
  }, [isMobile]);

  const showScopeFilterInput = !isMobile || scopeFilterOpen || searchFilter.trim().length > 0;

  const loadProjects = useCallback(() => {
    if (mode !== "work") return;
    fetchWorkProjects().then(setProjects);
  }, [mode]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    setCounts(null);
    if (mode === "work" || mode === "personal") {
      fetchCounts(mode).then(setCounts);
    } else if (mode === "all") {
      Promise.all([fetchCounts("work"), fetchCounts("personal")])
        .then(([work, personal]) => {
          const combined: CountsResponse = {
            projectCounts: {},
            categoryCounts: {},
            itemTypeCounts: {},
          };
          for (const source of [work.projectCounts, personal.projectCounts]) {
            if (!source) continue;
            for (const [key, value] of Object.entries(source)) {
              combined.projectCounts![key] = (combined.projectCounts![key] ?? 0) + value;
            }
          }
          for (const source of [work.categoryCounts, personal.categoryCounts]) {
            if (!source) continue;
            for (const [key, value] of Object.entries(source)) {
              combined.categoryCounts![key] = (combined.categoryCounts![key] ?? 0) + value;
            }
          }
          for (const source of [work.itemTypeCounts, personal.itemTypeCounts]) {
            if (!source) continue;
            for (const [key, value] of Object.entries(source)) {
              combined.itemTypeCounts![key] = (combined.itemTypeCounts![key] ?? 0) + value;
            }
          }
          setCounts(combined);
        })
        .catch(() => setCounts(null));
    }
  }, [mode]);

  useEffect(() => {
    if (mode === "personal" || mode === "all") setCustomAreasState(loadCustomAreas());
  }, [mode]);

  useEffect(() => {
    if (!contextMenu) return;
    if (isMobile) return;
    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [contextMenu, isMobile]);

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
            flexDirection: isMobile ? "column" : "row",
            alignItems: isMobile ? "stretch" : "center",
            gap: isMobile ? "0.75rem" : "1rem",
            padding: isMobile ? "0.15rem 0" : "0.25rem 0",
            background: "transparent",
            overflowX: isMobile ? "visible" : "auto",
          }}
        >
          <div
            className={`bd-scope-strip${isMobile ? " bd-scope-chip-touch" : ""}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              overflowX: "auto",
              minWidth: 0,
              width: "100%",
            }}
          >
          <span className="bd-scope-label">
            {t("scope.project")}
          </span>
          <div style={{ display: "flex", gap: "0.35rem", flexWrap: "nowrap", alignItems: "center", flex: 1, minWidth: 0 }}>
            <ScopeChip
              label={t("scope.all")}
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
                  onMore={isMobile ? () => setContextMenu({ x: window.innerWidth / 2, y: window.innerHeight, project: p }) : undefined}
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
                  placeholder={t("scope.newProject")}
                  autoFocus
                  style={{ width: 120, padding: "0.3rem 0.5rem", fontSize: "0.8125rem" }}
                />
                <button type="button" className="bd-btn" onClick={() => { setAddProjectName(""); setShowAddProject(false); }} style={{ padding: "0.3rem 0.5rem" }}>
                  {t("scope.cancel")}
                </button>
              </span>
            ) : (
              <button
                type="button"
                className="bd-btn"
                onClick={() => setShowAddProject(true)}
                title={t("scope.addProject")}
                style={{ padding: "0.4rem 0.5rem", minWidth: 32 }}
              >
                +
              </button>
            )}
          </div>
          {isMobile && onSearchFilterChange && (
            <button
              type="button"
              className="bd-btn"
              onClick={() => setScopeFilterOpen((o) => !o)}
              aria-pressed={scopeFilterOpen}
              aria-label={scopeFilterOpen ? t("scope.hideFilter") : t("scope.showFilter")}
              title={scopeFilterOpen ? t("scope.hideFilter") : t("scope.showFilter")}
              style={{
                flexShrink: 0,
                minWidth: 44,
                minHeight: 44,
                padding: "0.4rem",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background: scopeFilterOpen ? "var(--accent-soft)" : "var(--bg-elevated)",
                borderColor: scopeFilterOpen ? "var(--accent)" : "var(--border-default)",
                color: "var(--accent)",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
            </button>
          )}
          </div>
          {onSearchFilterChange && showScopeFilterInput && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                marginLeft: isMobile ? 0 : "auto",
                flexShrink: 0,
                width: isMobile ? "100%" : undefined,
              }}
            >
              <span className="bd-scope-label">{t("scope.filter")}</span>
              <div style={{ position: "relative", width: isMobile ? "100%" : 180, flexShrink: 0, flex: isMobile ? 1 : undefined, minWidth: 0 }}>
                <input
                  type="search"
                  enterKeyHint="search"
                  className="bd-input"
                  value={searchFilter}
                  onChange={(e) => onSearchFilterChange(e.target.value)}
                  placeholder={t("scope.searchPlaceholder")}
                  style={{ width: "100%", padding: "0.45rem 1.9rem 0.45rem 0.65rem", fontSize: isMobile ? "16px" : "0.8125rem", minHeight: isMobile ? 44 : undefined }}
                />
                {searchFilter && (
                  <button
                    type="button"
                    aria-label={t("scope.clearFilter")}
                    onClick={() => onSearchFilterChange("")}
                    style={{
                      position: "absolute",
                      right: 6,
                      top: "50%",
                      transform: "translateY(-50%)",
                      width: 28,
                      height: 28,
                      borderRadius: "999px",
                      border: "none",
                      background: "transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--text-tertiary)",
                      cursor: "pointer",
                      fontSize: "0.875rem",
                      padding: 0,
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {contextMenu && (
          <div
            style={isMobile ? {
              position: "fixed",
              inset: 0,
              zIndex: 1090,
              background: "rgba(0,0,0,0.35)",
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
              padding: "0.75rem",
            } : undefined}
            onClick={isMobile ? () => setContextMenu(null) : undefined}
          >
          <div
            ref={menuRef}
            style={{
              position: isMobile ? "relative" : "fixed",
              left: isMobile ? undefined : contextMenu.x,
              top: isMobile ? undefined : contextMenu.y,
              zIndex: 1000,
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-default)",
              borderRadius: isMobile ? "16px" : "var(--button-radius)",
              boxShadow: "var(--shadow-md)",
              padding: "0.25rem 0",
              minWidth: "120px",
              width: isMobile ? "min(100%, 420px)" : undefined,
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
              {t("scope.rename")}
            </button>
            <button
              type="button"
              className="bd-btn"
              style={{ width: "100%", justifyContent: "flex-start", color: "var(--text-danger, #c53030)" }}
              onClick={() => handleDeleteProject(contextMenu.project)}
            >
              {t("scope.deleteProject")}
            </button>
            {isMobile && (
              <button type="button" className="bd-btn" style={{ width: "100%" }} onClick={() => setContextMenu(null)}>
                {t("scope.cancel")}
              </button>
            )}
          </div>
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
              <h3 style={{ margin: "0 0 0.75rem", fontSize: "1rem" }}>{t("scope.renameProject")}</h3>
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
                placeholder={t("scope.projectName")}
                autoFocus
                style={{ width: "100%", marginBottom: "1rem" }}
              />
              <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                <button type="button" className="bd-btn" onClick={() => { setRenameProject(null); setRenameValue(""); }}>
                  {t("scope.cancel")}
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
                  {t("scope.save")}
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
              <h3 style={{ margin: "0 0 0.75rem", fontSize: "1rem" }}>{t("scope.deleteProjectConfirm")}</h3>
              <p style={{ margin: "0 0 1rem", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                &ldquo;{confirmProject.name}&rdquo; {t("scope.deleteProjectBody")}
              </p>
              <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                <button type="button" className="bd-btn" onClick={() => setConfirmProject(null)}>
                  {t("scope.no")}
                </button>
                <button
                  type="button"
                  className="bd-btn"
                  style={{ background: "var(--text-danger, #c53030)", color: "#fff", borderColor: "var(--text-danger, #c53030)" }}
                  onClick={confirmDeleteProject}
                >
                  {t("scope.yesDelete")}
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  if (mode === "personal" || mode === "all") {
    const apiCategories = counts?.categoryCounts ? Object.keys(counts.categoryCounts).filter((k) => (counts!.categoryCounts![k] ?? 0) > 0) : [];
    const customAreas = (customAreasState.length ? customAreasState : loadCustomAreas()).filter((c) => !apiCategories.includes(c));
    const allAreas = [...apiCategories, ...customAreas].sort((a, b) => a.localeCompare(b));

    return (
      <>
        <div
          style={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            alignItems: isMobile ? "stretch" : "center",
            gap: isMobile ? "0.75rem" : "1rem",
            padding: isMobile ? "0.15rem 0" : "0.25rem 0",
            background: "transparent",
            overflowX: isMobile ? "visible" : "auto",
          }}
        >
          <div
            className={`bd-scope-strip${isMobile ? " bd-scope-chip-touch" : ""}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              overflowX: isMobile ? "visible" : "auto",
              minWidth: 0,
              width: "100%",
            }}
          >
            {isMobile ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem", width: "100%" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", width: "100%", flexWrap: "nowrap" }}>
                  <span className="bd-scope-label" style={{ flexShrink: 0 }}>
                    {t("scope.area")}
                  </span>
                  <button
                    type="button"
                    className="bd-btn"
                    aria-haspopup="listbox"
                    aria-expanded={areaPickerOpen}
                    aria-label={t("scope.openAreaMenu")}
                    onClick={() => setAreaPickerOpen(true)}
                    style={{
                      flex: "0 1 auto",
                      width: "max-content",
                      maxWidth: "min(70vw, 280px)",
                      minWidth: 0,
                      minHeight: 44,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "0.5rem",
                      padding: "0.45rem 0.75rem",
                      borderRadius: "var(--button-radius)",
                      fontSize: "0.875rem",
                      fontWeight: 600,
                      background: !selectedCategory ? "var(--accent)" : "var(--bg-elevated)",
                      color: !selectedCategory ? "#fff" : "var(--text-primary)",
                      borderColor: !selectedCategory ? "var(--accent)" : "var(--border-default)",
                      boxShadow: "var(--shadow-sm)",
                    }}
                  >
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "left" }}>
                      {selectedCategory ? formatCategoryLabel(selectedCategory) : t("scope.all")}
                    </span>
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                      style={{ flexShrink: 0, opacity: 0.92 }}
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>
                  {onSearchFilterChange && (
                    <button
                      type="button"
                      className="bd-btn"
                      onClick={() => setScopeFilterOpen((o) => !o)}
                      aria-pressed={scopeFilterOpen}
                      aria-label={scopeFilterOpen ? t("scope.hideFilter") : t("scope.showFilter")}
                      title={scopeFilterOpen ? t("scope.hideFilter") : t("scope.showFilter")}
                      style={{
                        flexShrink: 0,
                        marginLeft: "auto",
                        minWidth: 44,
                        minHeight: 44,
                        padding: "0.4rem",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: scopeFilterOpen ? "var(--accent-soft)" : "var(--bg-elevated)",
                        borderColor: scopeFilterOpen ? "var(--accent)" : "var(--border-default)",
                        color: "var(--accent)",
                      }}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                      </svg>
                    </button>
                  )}
                </div>
                {showAddArea && (
                  <span style={{ display: "flex", alignItems: "center", gap: "0.35rem", flexWrap: "wrap" }}>
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
                      placeholder={t("scope.newArea")}
                      autoFocus
                      style={{ flex: 1, minWidth: 0, padding: "0.45rem 0.65rem", fontSize: "16px", minHeight: 44 }}
                    />
                    <button type="button" className="bd-btn" onClick={() => { setAddAreaValue(""); setShowAddArea(false); }} style={{ padding: "0.4rem 0.65rem", minHeight: 44 }}>
                      {t("scope.cancel")}
                    </button>
                  </span>
                )}
              </div>
            ) : (
              <>
                <span className="bd-scope-label">
                  {t("scope.area")}
                </span>
                <div style={{ display: "flex", gap: "0.35rem", flexWrap: "nowrap", alignItems: "center", flex: 1, minWidth: 0 }}>
                  <ScopeChip
                    label={t("scope.all")}
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
                      onMore={
                        isMobile && customAreas.includes(value)
                          ? () =>
                              setAreaContextMenu({
                                value,
                                x: window.innerWidth / 2,
                                y: window.innerHeight,
                                isCustom: true,
                              })
                          : undefined
                      }
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
                        placeholder={t("scope.newArea")}
                        autoFocus
                        style={{ width: 100, padding: "0.3rem 0.5rem", fontSize: "0.8125rem" }}
                      />
                      <button type="button" className="bd-btn" onClick={() => { setAddAreaValue(""); setShowAddArea(false); }} style={{ padding: "0.3rem 0.5rem" }}>
                        {t("scope.cancel")}
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="bd-btn"
                      onClick={() => setShowAddArea(true)}
                      title={t("scope.addArea")}
                      style={{ padding: "0.4rem 0.5rem", minWidth: 32 }}
                    >
                      +
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        {onSearchFilterChange && showScopeFilterInput && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              marginLeft: isMobile ? 0 : "auto",
              flexShrink: 0,
              width: isMobile ? "100%" : undefined,
            }}
          >
            <span className="bd-scope-label">{t("scope.filter")}</span>
            <div style={{ position: "relative", width: isMobile ? "100%" : 180, flexShrink: 0, flex: isMobile ? 1 : undefined, minWidth: 0 }}>
              <input
                type="search"
                enterKeyHint="search"
                className="bd-input"
                value={searchFilter}
                onChange={(e) => onSearchFilterChange(e.target.value)}
                placeholder={t("scope.searchPlaceholder")}
                style={{ width: "100%", padding: "0.45rem 1.9rem 0.45rem 0.65rem", fontSize: isMobile ? "16px" : "0.8125rem", minHeight: isMobile ? 44 : undefined }}
              />
              {searchFilter && (
                <button
                  type="button"
                  aria-label={t("scope.clearFilter")}
                  onClick={() => onSearchFilterChange("")}
                  style={{
                    position: "absolute",
                    right: 6,
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: 28,
                    height: 28,
                    borderRadius: "999px",
                    border: "none",
                    background: "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--text-tertiary)",
                    cursor: "pointer",
                    fontSize: "0.875rem",
                    padding: 0,
                  }}
                >
                  ×
                </button>
              )}
            </div>
          </div>
        )}
        </div>
        {isMobile && areaPickerOpen && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 1095,
              background: "rgba(0,0,0,0.45)",
              backdropFilter: "blur(6px)",
              WebkitBackdropFilter: "blur(6px)",
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
              padding: 0,
              paddingBottom: "env(safe-area-inset-bottom, 0px)",
            }}
            onClick={() => setAreaPickerOpen(false)}
          >
            <div
              className="bd-panel"
              style={{
                width: "100%",
                maxHeight: "min(85dvh, 85vh)",
                borderRadius: "22px 22px 0 0",
                padding: "1rem 1rem 1.15rem",
                overflow: "auto",
                WebkitOverflowScrolling: "touch",
                boxShadow: "0 -12px 48px rgba(0,0,0,0.35)",
              }}
              onClick={(e) => e.stopPropagation()}
              role="listbox"
              aria-label={t("scope.chooseArea")}
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
                <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600, color: "var(--text-primary)" }}>{t("scope.chooseArea")}</h3>
                <button
                  type="button"
                  className="bd-btn"
                  onClick={() => setAreaPickerOpen(false)}
                  aria-label={t("scope.cancel")}
                  style={{ minWidth: 44, minHeight: 44, padding: "0.45rem", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                <button
                  type="button"
                  className="bd-btn"
                  role="option"
                  aria-selected={!selectedCategory}
                  onClick={() => {
                    onCategorySelect(null);
                    setAreaPickerOpen(false);
                  }}
                  style={{
                    minHeight: 48,
                    justifyContent: "space-between",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    background: !selectedCategory ? "var(--accent)" : "var(--bg-elevated)",
                    color: !selectedCategory ? "#fff" : "var(--text-primary)",
                    borderColor: !selectedCategory ? "var(--accent)" : "var(--border-default)",
                    fontWeight: 600,
                  }}
                >
                  {t("scope.all")}
                  {!selectedCategory ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <span style={{ width: 18 }} aria-hidden />
                  )}
                </button>
                {allAreas.map((value) => {
                  const sel = selectedCategory === value;
                  return (
                    <div key={value} style={{ display: "flex", alignItems: "stretch", gap: "0.35rem" }}>
                      <button
                        type="button"
                        className="bd-btn"
                        role="option"
                        aria-selected={sel}
                        onClick={() => {
                          onCategorySelect(value);
                          setAreaPickerOpen(false);
                        }}
                        style={{
                          flex: 1,
                          minHeight: 48,
                          justifyContent: "space-between",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                          background: sel ? "var(--accent)" : "var(--bg-elevated)",
                          color: sel ? "#fff" : "var(--text-primary)",
                          borderColor: sel ? "var(--accent)" : "var(--border-default)",
                          fontWeight: 600,
                        }}
                      >
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "left" }}>
                          {formatCategoryLabel(value)}
                        </span>
                        {sel ? (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        ) : (
                          <span style={{ width: 18 }} aria-hidden />
                        )}
                      </button>
                      {customAreas.includes(value) && (
                        <button
                          type="button"
                          className="bd-btn"
                          aria-label={t("scope.areaOptions")}
                          title={t("scope.areaOptions")}
                          onClick={() => {
                            setAreaPickerOpen(false);
                            setAreaContextMenu({
                              value,
                              x: window.innerWidth / 2,
                              y: window.innerHeight,
                              isCustom: true,
                            });
                          }}
                          style={{
                            minWidth: 48,
                            minHeight: 48,
                            padding: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "1.1rem",
                            color: "var(--text-tertiary)",
                          }}
                        >
                          ⋮
                        </button>
                      )}
                    </div>
                  );
                })}
                <button
                  type="button"
                  className="bd-btn"
                  onClick={() => {
                    setAreaPickerOpen(false);
                    setShowAddArea(true);
                  }}
                  style={{ minHeight: 48, marginTop: "0.35rem", justifyContent: "center" }}
                >
                  + {t("scope.addArea")}
                </button>
              </div>
            </div>
          </div>
        )}
        {areaContextMenu?.isCustom && (
          <div
            style={isMobile ? {
              position: "fixed",
              inset: 0,
              zIndex: 1090,
              background: "rgba(0,0,0,0.35)",
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
              padding: "0.75rem",
            } : undefined}
            onClick={isMobile ? () => setAreaContextMenu(null) : undefined}
          >
          <div
            style={{
              position: isMobile ? "relative" : "fixed",
              left: isMobile ? undefined : areaContextMenu.x,
              top: isMobile ? undefined : areaContextMenu.y,
              zIndex: 1000,
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-default)",
              borderRadius: isMobile ? "16px" : "var(--button-radius)",
              boxShadow: "var(--shadow-md)",
              padding: "0.25rem 0",
              minWidth: "120px",
              width: isMobile ? "min(100%, 420px)" : undefined,
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
              {t("scope.removeArea")}
            </button>
            {isMobile && (
              <button type="button" className="bd-btn" style={{ width: "100%" }} onClick={() => setAreaContextMenu(null)}>
                {t("scope.cancel")}
              </button>
            )}
          </div>
          </div>
        )}
      </>
    );
  }

  return null;
}
