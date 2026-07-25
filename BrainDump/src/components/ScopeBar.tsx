"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Calendar, Check, ChevronDown, Funnel, Plus, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { DueDateFilterPreset } from "@/lib/due-date-filter";
import { scheduleClientPreferencesUpload } from "@/lib/client-preferences-sync";
import { CUSTOM_AREAS_KEY, PERSONAL_AREA_DEFAULTS } from "@/lib/personal-areas";
import { ScopeActiveFilterPills } from "@/components/ScopeActiveFilterPills";

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
  /** Filter entries by due date (tasks, calendar) â€” shown with search when filter is open. */
  dueDateFilter?: DueDateFilterPreset;
  onDueDateFilterChange?: (preset: DueDateFilterPreset) => void;
  /** Desktop: content immediately left of the filter field (e.g. â€œNext 5 â€” coach (AI)â€). */
  beforeFilterSlot?: ReactNode;
}

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
    scheduleClientPreferencesUpload();
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
          background: selected ? "var(--bd-chrome-selected-bg)" : "var(--bd-chrome-muted-bg)",
          borderColor: selected ? "var(--bd-chrome-selected-border)" : "var(--border-default)",
          color: selected ? "var(--bd-chrome-selected-text)" : "var(--text-primary)",
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
          â‹®
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

const DUE_DATE_LABEL_KEY: Record<DueDateFilterPreset, string> = {
  all: "scope.dateFilterNone",
  today: "scope.dateFilterToday",
  tomorrow: "scope.dateFilterTomorrow",
  this_week: "scope.dateFilterThisWeek",
  no_date: "scope.dateFilterNoDate",
};

function DueDateFilterMenuButton({
  value,
  onChange,
  isMobile,
  t,
  menuMode = "full",
}: {
  value: DueDateFilterPreset;
  onChange: (preset: DueDateFilterPreset) => void;
  isMobile: boolean;
  t: (key: string) => string;
  menuMode?: "full" | "overflow";
}) {
  const [open, setOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [portalMount, setPortalMount] = useState<HTMLElement | null>(null);

  useEffect(() => { setPortalMount(document.body); }, []);

  const openDropdown = () => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setDropdownPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (btnRef.current?.contains(e.target as Node)) return;
      if (dropdownRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const onScroll = () => setOpen(false);
    document.addEventListener("click", onDoc, true);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("click", onDoc, true);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  const selected = menuMode === "overflow" ? value === "no_date" : value !== "all";

  const dropdown =
    open && dropdownPos && portalMount
      ? createPortal(
          <div
            ref={dropdownRef}
            role="listbox"
            aria-label={t("scope.dateFilterMenuAria")}
            style={{
              position: "fixed",
              top: dropdownPos.top,
              right: dropdownPos.right,
              minWidth: "13rem",
              zIndex: 5000,
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-default)",
              borderRadius: 12,
              boxShadow: "var(--shadow-md)",
              padding: "0.35rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.15rem",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {(["today", "tomorrow", "this_week"] as const).map((p) => (
              <button
                key={p}
                type="button"
                role="option"
                aria-selected={value === p}
                className="bd-btn"
                onClick={() => { onChange(p); setOpen(false); }}
                style={{
                  justifyContent: "flex-start",
                  minHeight: 40,
                  fontWeight: 600,
                  fontSize: "0.8125rem",
                  background: value === p ? "var(--bd-chrome-selected-bg)" : "transparent",
                  color: value === p ? "var(--bd-chrome-selected-text)" : "var(--text-primary)",
                  borderColor: value === p ? "var(--bd-chrome-selected-border)" : "transparent",
                }}
              >
                {t(DUE_DATE_LABEL_KEY[p])}
              </button>
            ))}
            <div style={{ height: 1, background: "var(--border-subtle)", margin: "0.2rem 0" }} aria-hidden />
            {(["all", "no_date"] as const).map((p) => (
              <button
                key={p}
                type="button"
                role="option"
                aria-selected={value === p}
                className="bd-btn"
                onClick={() => { onChange(p); setOpen(false); }}
                style={{
                  justifyContent: "flex-start",
                  minHeight: 40,
                  fontWeight: 500,
                  fontSize: "0.8125rem",
                  background: value === p ? "var(--bd-chrome-selected-bg)" : "transparent",
                  color: value === p ? "var(--bd-chrome-selected-text)" : "var(--text-secondary)",
                  borderColor: value === p ? "var(--bd-chrome-selected-border)" : "transparent",
                }}
              >
                {t(DUE_DATE_LABEL_KEY[p])}
              </button>
            ))}
          </div>,
          portalMount
        )
      : null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={isMobile ? "bd-btn bd-scope-filter-circle" : "bd-btn"}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-pressed={isMobile ? selected : undefined}
        aria-label={t("scope.dateFilterMenuAria")}
        title={t("scope.dateFilterMenuAria")}
        onClick={(e) => {
          e.stopPropagation();
          open ? setOpen(false) : openDropdown();
        }}
        style={{
          minWidth: isMobile ? 44 : 40,
          minHeight: isMobile ? 44 : 36,
          padding: isMobile ? "0.4rem" : "0.35rem 0.5rem",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.35rem",
          fontSize: "0.75rem",
          fontWeight: 600,
          ...(!isMobile && selected
            ? {
                background: "var(--bd-chrome-selected-bg)",
                borderColor: "var(--bd-chrome-selected-border)",
                color: "var(--bd-chrome-selected-text)",
              }
            : {}),
        }}
      >
        <Calendar size={18} aria-hidden />
        {!isMobile && selected ? (
          <span style={{ maxWidth: "5.5rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {t(DUE_DATE_LABEL_KEY[value])}
          </span>
        ) : null}
      </button>
      {dropdown}
    </>
  );
}
function DueDateQuickPresets({
  value,
  onChange,
  isMobile,
  t,
}: {
  value: DueDateFilterPreset;
  onChange: (preset: DueDateFilterPreset) => void;
  isMobile: boolean;
  t: (key: string) => string;
}) {
  return (
    <div
      role="group"
      aria-label={t("scope.dateFilterQuickAria")}
      style={{
        display: "flex",
        alignItems: "center",
        gap: isMobile ? "0.2rem" : "0.3rem",
        flexShrink: 0,
        flexWrap: "nowrap",
      }}
    >
      {(["all", "today", "tomorrow", "this_week"] as const).map((p) => {
        const on = value === p;
        return (
          <button
            key={p}
            type="button"
            aria-pressed={on}
            className="bd-btn"
            onClick={() => {
              if (p === "all") onChange("all");
              else onChange(on ? "all" : p);
            }}
            style={{
              padding: isMobile ? "0.32rem 0.42rem" : "0.32rem 0.5rem",
              fontSize: isMobile ? "0.6875rem" : "0.75rem",
              fontWeight: 600,
              whiteSpace: "nowrap",
              minHeight: isMobile ? 36 : 34,
              lineHeight: 1.2,
              background: on ? "var(--bd-chrome-selected-bg)" : "transparent",
              borderColor: on ? "var(--bd-chrome-selected-border)" : "var(--border-default)",
              color: on ? "var(--bd-chrome-selected-text)" : "var(--text-primary)",
            }}
          >
            {t(DUE_DATE_LABEL_KEY[p])}
          </button>
        );
      })}
    </div>
  );
}

// ── Desktop scope dropdown (replaces horizontal chip row on desktop) ─────────
function ScopeDropdown({
  ariaLabel,
  selectedLabel,
  isSelected,
  portalMount,
  children,
}: {
  ariaLabel: string;
  selectedLabel: string;
  isSelected: boolean;
  portalMount: HTMLElement | null;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const openDropdown = () => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    // Clamp so the dropdown never clips the right edge of the viewport
    const left = Math.min(r.left, window.innerWidth - 224);
    setDropdownPos({ top: r.bottom + 4, left });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (btnRef.current?.contains(e.target as Node)) return;
      if (dropdownRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const onScroll = () => setOpen(false);
    document.addEventListener("click", onDoc, true);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("click", onDoc, true);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  const dropdown =
    open && dropdownPos && portalMount
      ? createPortal(
          <div
            ref={dropdownRef}
            role="listbox"
            aria-label={ariaLabel}
            style={{
              position: "fixed",
              top: dropdownPos.top,
              left: dropdownPos.left,
              minWidth: "12rem",
              maxWidth: "20rem",
              maxHeight: "min(360px, 60vh)",
              overflowY: "auto",
              zIndex: 5000,
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-default)",
              borderRadius: "16px",
              boxShadow: "var(--shadow-lg)",
              padding: "0.3rem",
              display: "flex",
              flexDirection: "column",
              gap: "1px",
              animation: "bd-desktop-sheet-in 0.18s var(--bd-ease-soft) both",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {children(() => setOpen(false))}
          </div>,
          portalMount
        )
      : null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="bd-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={(e) => {
          e.stopPropagation();
          open ? setOpen(false) : openDropdown();
        }}
        style={{
          padding: "0.4rem 0.65rem 0.4rem 0.75rem",
          fontSize: "0.8125rem",
          borderRadius: "var(--button-radius)",
          gap: "0.25rem",
          display: "inline-flex",
          alignItems: "center",
          whiteSpace: "nowrap",
          flexShrink: 0,
          background: isSelected ? "var(--bd-chrome-selected-bg)" : "var(--bd-chrome-muted-bg)",
          borderColor: isSelected ? "var(--bd-chrome-selected-border)" : "var(--border-default)",
          color: isSelected ? "var(--bd-chrome-selected-text)" : "var(--text-primary)",
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", maxWidth: "12rem" }}>
          {selectedLabel}
        </span>
        <ChevronDown
          size={13}
          strokeWidth={2.5}
          aria-hidden
          style={{ flexShrink: 0, opacity: 0.7, transform: open ? "rotate(180deg)" : undefined, transition: "transform 0.18s ease" }}
        />
      </button>
      {dropdown}
    </>
  );
}

function ScopeDropdownOption({
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
      role="option"
      aria-selected={selected}
      onContextMenu={onContextMenu}
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "0.5rem",
        width: "100%",
        padding: "0.5rem 0.65rem",
        borderRadius: "10px",
        border: "none",
        background: selected ? "var(--bd-chrome-selected-bg)" : "transparent",
        color: selected ? "var(--bd-chrome-selected-text)" : "var(--text-primary)",
        fontWeight: selected ? 600 : 400,
        fontSize: "0.8125rem",
        textAlign: "left",
        cursor: "pointer",
        transition: "background 0.12s ease",
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        if (!selected) (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)";
      }}
      onMouseLeave={(e) => {
        if (!selected) (e.currentTarget as HTMLElement).style.background = "transparent";
      }}
    >
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
        {label}
      </span>
      {selected ? (
        <Check size={14} strokeWidth={2.5} aria-hidden style={{ flexShrink: 0 }} />
      ) : (
        <span style={{ width: 14, flexShrink: 0 }} aria-hidden />
      )}
    </button>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

function ScopeFilterSearchBlock({
  isMobile,
  searchFilter,
  onSearchFilterChange,
  beforeFilterSlot,
  dueDateFilter,
  onDueDateFilterChange,
  t,
}: {
  isMobile: boolean;
  searchFilter: string;
  onSearchFilterChange: (v: string) => void;
  beforeFilterSlot?: ReactNode;
  dueDateFilter: DueDateFilterPreset;
  onDueDateFilterChange?: (preset: DueDateFilterPreset) => void;
  t: (key: string) => string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
        flexShrink: 0,
        flex: "0 0 auto",
        width: isMobile ? "100%" : "auto",
        maxWidth: isMobile ? "100%" : "none",
        alignItems: isMobile ? "stretch" : "flex-end",
        alignSelf: isMobile ? "stretch" : undefined,
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          width: "100%",
          justifyContent: isMobile ? "stretch" : "flex-end",
          flexWrap: isMobile ? "wrap" : "nowrap",
          minWidth: 0,
        }}
      >
        {!isMobile && beforeFilterSlot ? (
          <span style={{ display: "inline-flex", alignItems: "center", flexShrink: 0 }}>{beforeFilterSlot}</span>
        ) : null}
        {!isMobile && (
          <span className="bd-scope-label" style={{ flexShrink: 0 }}>
            {t("scope.filter")}
          </span>
        )}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            flex: isMobile ? "1 1 100%" : "0 0 auto",
            minWidth: isMobile ? "100%" : 0,
            width: isMobile ? "100%" : "auto",
            flexWrap: isMobile ? "wrap" : "nowrap",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              position: "relative",
              flex: isMobile ? "1 1 160px" : "0 0 auto",
              minWidth: isMobile ? "min(100%, 9rem)" : 160,
              width: isMobile ? undefined : 200,
              maxWidth: isMobile ? "100%" : 280,
              flexShrink: isMobile ? 1 : 0,
            }}
          >
            <input
              type="search"
              enterKeyHint="search"
              className="bd-input"
              value={searchFilter}
              onChange={(e) => onSearchFilterChange(e.target.value)}
              placeholder={t("scope.searchPlaceholder")}
              style={{
                width: "100%",
                padding: "0.45rem 1.9rem 0.45rem 0.65rem",
                fontSize: isMobile ? "16px" : "0.8125rem",
                minHeight: isMobile ? 44 : undefined,
              }}
            />
            {searchFilter ? (
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
                Ã—
              </button>
            ) : null}
          </div>
          {onDueDateFilterChange ? (
            <>
              <DueDateFilterMenuButton
                value={dueDateFilter}
                onChange={onDueDateFilterChange}
                isMobile={isMobile}
                t={t}
                menuMode="full"
              />
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function ScopeBar({
  mode,
  selectedProjectId,
  selectedCategory,
  onProjectSelect,
  onCategorySelect,
  searchFilter = "",
  onSearchFilterChange,
  dueDateFilter = "all",
  onDueDateFilterChange,
  beforeFilterSlot = null,
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
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [showAddProject, setShowAddProject] = useState(false);
  const [addProjectName, setAddProjectName] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const [scopeFilterOpen, setScopeFilterOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [scopeSheetMount, setScopeSheetMount] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setScopeSheetMount(document.body);
  }, []);

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
    if (dueDateFilter !== "all") setScopeFilterOpen(true);
  }, [dueDateFilter]);

  useEffect(() => {
    if (!isMobile) {
      setAreaPickerOpen(false);
      setProjectPickerOpen(false);
    }
  }, [isMobile]);

  useEffect(() => {
    const openScopePicker = () => {
      if (mode === "inbox") return;
      if (mode === "work") setProjectPickerOpen(true);
      else setAreaPickerOpen(true);
    };
    window.addEventListener("braindump-open-scope-picker", openScopePicker);
    return () => window.removeEventListener("braindump-open-scope-picker", openScopePicker);
  }, [mode]);

  useEffect(() => {
    if (!isMobile) setScopeFilterOpen(false);
  }, [isMobile]);

  const showScopeFilterInput =
    !isMobile || scopeFilterOpen || searchFilter.trim().length > 0 || dueDateFilter !== "all";

  const loadProjects = useCallback(() => {
    if (mode !== "work") return;
    fetchWorkProjects().then(setProjects);
  }, [mode]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    const onReloadProjects = () => loadProjects();
    window.addEventListener("braindump-reload-projects", onReloadProjects);
    return () => window.removeEventListener("braindump-reload-projects", onReloadProjects);
  }, [loadProjects]);

  const reloadCounts = useCallback(() => {
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
    reloadCounts();
  }, [reloadCounts]);

  useEffect(() => {
    const onItemsChanged = () => reloadCounts();
    window.addEventListener("braindump-reload-items", onItemsChanged);
    return () => window.removeEventListener("braindump-reload-items", onItemsChanged);
  }, [reloadCounts]);

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
    const countsLoaded = counts != null;
    const projectItemCount = (id: string) => counts?.projectCounts?.[id] ?? 0;
    const visibleProjects = countsLoaded
      ? projects.filter((p) => projectItemCount(p.id) > 0 || selectedProjectId === p.id)
      : projects;

    const selectedProjectLabel =
      !selectedProjectId
        ? t("scope.all")
        : projects.find((p) => p.id === selectedProjectId)?.name ?? t("scope.all");

    const addProjectInline = (
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
          style={
            isMobile
              ? { flex: 1, minWidth: 0, padding: "0.45rem 0.65rem", fontSize: "16px", minHeight: 44 }
              : { width: 140, padding: "0.3rem 0.5rem", fontSize: "0.8125rem" }
          }
        />
        <button type="button" className="bd-btn" onClick={() => { setAddProjectName(""); setShowAddProject(false); }} style={{ padding: isMobile ? "0.4rem 0.65rem" : "0.3rem 0.5rem", minHeight: isMobile ? 44 : undefined }}>
          {t("scope.cancel")}
        </button>
      </span>
    );

    return (
      <>
        <div
          style={{
            display: "flex",
            flexDirection: isMobile && onSearchFilterChange && showScopeFilterInput ? "column" : "row",
            alignItems: isMobile && onSearchFilterChange && showScopeFilterInput ? "stretch" : "center",
            gap: isMobile ? "0.75rem" : "1rem",
            padding: isMobile ? "0.15rem 0" : "0.25rem 0",
            background: "transparent",
            /* visible so native <select> dropdown is not clipped */
            overflowX: isMobile ? "visible" : "auto",
            width: !isMobile ? "100%" : undefined,
            minWidth: !isMobile ? 0 : undefined,
            flex: isMobile && onSearchFilterChange && showScopeFilterInput ? "0 0 auto" : undefined,
          }}
        >
          <div
            className={`bd-scope-strip${isMobile ? " bd-scope-chip-touch" : ""}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              overflowX: "visible",
              minWidth: 0,
              flex:
                isMobile && onSearchFilterChange && showScopeFilterInput ? "0 0 auto" : 1,
              width: isMobile ? "100%" : undefined,
            }}
          >
            {isMobile ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem", width: "100%" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", width: "100%", flexWrap: "nowrap" }}>
                  <button
                    type="button"
                    className="bd-scope-mobile-head"
                    aria-haspopup="listbox"
                    aria-expanded={projectPickerOpen}
                    aria-label={t("scope.openProjectMenu")}
                    onClick={() => setProjectPickerOpen(true)}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      width: "auto",
                      maxWidth: "none",
                      minHeight: 48,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "flex-start",
                      gap: "0.5rem",
                      padding: "0.35rem 0",
                      border: "none",
                      background: "none",
                      borderRadius: 0,
                      fontSize: "1.5rem",
                      fontWeight: 700,
                      lineHeight: 1.15,
                      letterSpacing: "-0.02em",
                      color: "var(--text-primary)",
                      cursor: "pointer",
                      WebkitTapHighlightColor: "transparent",
                    }}
                  >
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        textAlign: "left",
                        flex: "0 1 auto",
                        minWidth: 0,
                      }}
                    >
                      {selectedProjectLabel}
                    </span>
                    <ChevronDown size={22} aria-hidden style={{ flexShrink: 0, opacity: 0.85 }} />
                  </button>
                  {onSearchFilterChange && (
                    <button
                      type="button"
                      className={isMobile ? "bd-btn bd-scope-filter-circle" : "bd-btn"}
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
                        ...(isMobile
                          ? {}
                          : {
                              background: scopeFilterOpen ? "var(--bd-chrome-selected-bg)" : "transparent",
                              borderColor: scopeFilterOpen ? "var(--bd-chrome-selected-border)" : "var(--border-default)",
                              color: scopeFilterOpen ? "var(--bd-chrome-selected-text)" : "var(--text-tertiary)",
                            }),
                      }}
                    >
                      <Funnel size={20} aria-hidden />
                    </button>
                  )}
                </div>
                {showAddProject && addProjectInline}
              </div>
            ) : (
              <>
                <span className="bd-scope-label">{t("scope.project")}</span>
                {showAddProject ? (
                  addProjectInline
                ) : (
                  <ScopeDropdown
                    ariaLabel={t("scope.chooseProject")}
                    selectedLabel={selectedProjectLabel}
                    isSelected={!!selectedProjectId}
                    portalMount={scopeSheetMount}
                  >
                    {(close) => (
                      <>
                        <ScopeDropdownOption
                          label={t("scope.all")}
                          selected={!selectedProjectId}
                          onClick={() => { onProjectSelect(null); close(); }}
                        />
                        {visibleProjects.map((p) => (
                          <ScopeDropdownOption
                            key={p.id}
                            label={p.name}
                            selected={selectedProjectId === p.id}
                            onClick={() => { onProjectSelect(p.id); close(); }}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              setContextMenu({ x: e.clientX, y: e.clientY, project: p });
                              close();
                            }}
                          />
                        ))}
                        <div style={{ height: 1, background: "var(--border-subtle)", margin: "0.2rem 0.4rem" }} />
                        <button
                          type="button"
                          onClick={() => { close(); setShowAddProject(true); }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.4rem",
                            width: "100%",
                            padding: "0.5rem 0.65rem",
                            borderRadius: "10px",
                            border: "none",
                            background: "transparent",
                            color: "var(--text-tertiary)",
                            fontSize: "0.8125rem",
                            cursor: "pointer",
                            transition: "background 0.12s ease, color 0.12s ease",
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)";
                            (e.currentTarget as HTMLElement).style.color = "var(--text-primary)";
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.background = "transparent";
                            (e.currentTarget as HTMLElement).style.color = "var(--text-tertiary)";
                          }}
                        >
                          <Plus size={14} strokeWidth={2.5} aria-hidden />
                          {t("scope.addProject")}
                        </button>
                      </>
                    )}
                  </ScopeDropdown>
                )}
              </>
            )}
          </div>
          {onSearchFilterChange && showScopeFilterInput && (
            <>
              <ScopeActiveFilterPills
                searchFilter={searchFilter}
                dueDateFilter={dueDateFilter}
                scopeLabel={selectedProjectId ? selectedProjectLabel : null}
                onClearSearch={() => onSearchFilterChange("")}
                onClearDueDate={() => onDueDateFilterChange?.("all")}
                onClearScope={() => onProjectSelect(null)}
              />
              <ScopeFilterSearchBlock
              isMobile={isMobile}
              searchFilter={searchFilter}
              onSearchFilterChange={onSearchFilterChange}
              beforeFilterSlot={beforeFilterSlot}
              dueDateFilter={dueDateFilter}
              onDueDateFilterChange={onDueDateFilterChange}
              t={t}
            />
            </>
          )}
        </div>

        {isMobile && projectPickerOpen && scopeSheetMount
          ? createPortal(
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: "var(--bd-z-scope-sheet)",
              background: "rgba(0,0,0,0.45)",
              backdropFilter: "blur(6px)",
              WebkitBackdropFilter: "blur(6px)",
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
              padding: 0,
              paddingBottom: "var(--bd-bottom-bar-clearance)",
            }}
            onClick={() => setProjectPickerOpen(false)}
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
                boxShadow: "var(--shadow-lg)",
              }}
              onClick={(e) => e.stopPropagation()}
              role="listbox"
              aria-label={t("scope.chooseProject")}
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
                <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600, color: "var(--text-primary)" }}>{t("scope.chooseProject")}</h3>
                <button
                  type="button"
                  className="bd-btn"
                  onClick={() => setProjectPickerOpen(false)}
                  aria-label={t("scope.cancel")}
                  style={{ minWidth: 44, minHeight: 44, padding: "0.45rem", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                >
                  <X size={18} aria-hidden />
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                <button
                  type="button"
                  className="bd-btn"
                  role="option"
                  aria-selected={!selectedProjectId}
                  onClick={() => {
                    onProjectSelect(null);
                    setProjectPickerOpen(false);
                  }}
                  style={{
                    minHeight: 48,
                    justifyContent: "space-between",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    background: !selectedProjectId ? "var(--bd-chrome-selected-bg)" : "var(--bg-secondary)",
                    color: !selectedProjectId ? "var(--bd-chrome-selected-text)" : "var(--text-primary)",
                    borderColor: !selectedProjectId ? "var(--bd-chrome-selected-border)" : "var(--border-default)",
                    fontWeight: 600,
                  }}
                >
                  {t("scope.all")}
                  {!selectedProjectId ? (
                    <Check size={18} strokeWidth={2.5} aria-hidden />
                  ) : (
                    <span style={{ width: 18 }} aria-hidden />
                  )}
                </button>
                {visibleProjects.map((p) => {
                  const sel = selectedProjectId === p.id;
                  return (
                    <div key={p.id} style={{ display: "flex", alignItems: "stretch", gap: "0.35rem" }}>
                      <button
                        type="button"
                        className="bd-btn"
                        role="option"
                        aria-selected={sel}
                        onClick={() => {
                          onProjectSelect(p.id);
                          setProjectPickerOpen(false);
                        }}
                        style={{
                          flex: 1,
                          minHeight: 48,
                          justifyContent: "space-between",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                          background: sel ? "var(--bd-chrome-selected-bg)" : "var(--bg-secondary)",
                          color: sel ? "var(--bd-chrome-selected-text)" : "var(--text-primary)",
                          borderColor: sel ? "var(--bd-chrome-selected-border)" : "var(--border-default)",
                          fontWeight: 600,
                        }}
                      >
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "left" }}>
                          {p.name}
                        </span>
                        {sel ? (
                          <Check size={18} strokeWidth={2.5} aria-hidden />
                        ) : (
                          <span style={{ width: 18 }} aria-hidden />
                        )}
                      </button>
                      <button
                        type="button"
                        className="bd-btn"
                        aria-label={t("scope.projectOptions")}
                        title={t("scope.projectOptions")}
                        onClick={() => {
                          setProjectPickerOpen(false);
                          setContextMenu({ x: window.innerWidth / 2, y: window.innerHeight, project: p });
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
                        â‹®
                      </button>
                    </div>
                  );
                })}
                <button
                  type="button"
                  className="bd-btn"
                  onClick={() => {
                    setProjectPickerOpen(false);
                    setShowAddProject(true);
                  }}
                  style={{ minHeight: 48, marginTop: "0.35rem", justifyContent: "center" }}
                >
                  + {t("scope.addProject")}
                </button>
              </div>
            </div>
          </div>,
          scopeSheetMount
        )
        : null}

        {contextMenu && scopeSheetMount
          ? createPortal(
              isMobile ? (
                <div
                  style={{
                    position: "fixed",
                    inset: 0,
                    zIndex: "var(--bd-z-scope-sheet)",
                    background: "var(--bd-overlay-sheet)",
                    backdropFilter: "blur(8px)",
                    WebkitBackdropFilter: "blur(8px)",
                    display: "flex",
                    alignItems: "flex-end",
                    justifyContent: "center",
                    padding: "0.75rem",
                  }}
                  onClick={() => setContextMenu(null)}
                >
                  <div
                    ref={menuRef}
                    style={{
                      position: "relative",
                      zIndex: "var(--bd-z-scope-sheet)",
                      background: "var(--bg-elevated)",
                      border: "1px solid var(--border-default)",
                      borderRadius: "16px",
                      boxShadow: "var(--shadow-md)",
                      padding: "0.25rem 0",
                      minWidth: "120px",
                      width: "min(100%, 420px)",
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
                    <button type="button" className="bd-btn" style={{ width: "100%" }} onClick={() => setContextMenu(null)}>
                      {t("scope.cancel")}
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  ref={menuRef}
                  style={{
                    position: "fixed",
                    left: contextMenu.x,
                    top: contextMenu.y,
                    zIndex: "var(--bd-z-scope-sheet)",
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border-default)",
                    borderRadius: "12px",
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
                </div>
              ),
              scopeSheetMount
            )
          : null}

        {renameProject && scopeSheetMount
          ? createPortal(
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: "var(--bd-z-modal)",
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
          </div>,
          scopeSheetMount
        )
        : null}

        {confirmProject && scopeSheetMount
          ? createPortal(
              <div
                style={{
                  position: "fixed",
                  inset: 0,
                  zIndex: "var(--bd-z-modal)",
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
                      style={{
                        background: "var(--text-danger, #c53030)",
                        color: "#fff",
                        borderColor: "var(--text-danger, #c53030)",
                      }}
                      onClick={confirmDeleteProject}
                    >
                      {t("scope.yesDelete")}
                    </button>
                  </div>
                </div>
              </div>,
              scopeSheetMount
            )
          : null}
      </>
    );
  }

  if (mode === "personal" || mode === "all") {
    const countsLoaded = counts != null;
    const categoryItemCount = (key: string) => counts?.categoryCounts?.[key] ?? 0;
    const storedCustomAreas = customAreasState.length ? customAreasState : loadCustomAreas();

    const apiCategories = counts?.categoryCounts
      ? Object.keys(counts.categoryCounts).filter((k) => categoryItemCount(k) > 0)
      : [];

    const defaultAreasVisible = countsLoaded
      ? PERSONAL_AREA_DEFAULTS.filter((a) => categoryItemCount(a) > 0 || selectedCategory === a)
      : [...PERSONAL_AREA_DEFAULTS];

    const customAreasVisible = countsLoaded
      ? storedCustomAreas.filter((c) => categoryItemCount(c) > 0 || selectedCategory === c)
      : storedCustomAreas;

    const allAreas = [...new Set([...defaultAreasVisible, ...apiCategories, ...customAreasVisible])].sort((a, b) =>
      a.localeCompare(b)
    );

    const selectedAreaLabel = selectedCategory ? formatCategoryLabel(selectedCategory) : null;

    return (
      <>
        <div
          style={{
            display: "flex",
            flexDirection: isMobile && onSearchFilterChange && showScopeFilterInput ? "column" : "row",
            alignItems: isMobile && onSearchFilterChange && showScopeFilterInput ? "stretch" : "center",
            gap: isMobile ? "0.75rem" : "1rem",
            padding: isMobile ? "0.15rem 0" : "0.25rem 0",
            background: "transparent",
            overflowX: isMobile ? "visible" : "auto",
            width: !isMobile ? "100%" : undefined,
            minWidth: !isMobile ? 0 : undefined,
            flex: isMobile && onSearchFilterChange && showScopeFilterInput ? "0 0 auto" : undefined,
          }}
        >
          <div
            className={`bd-scope-strip${isMobile ? " bd-scope-chip-touch" : ""}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              overflowX: "visible",
              minWidth: 0,
              flex:
                isMobile && onSearchFilterChange && showScopeFilterInput ? "0 0 auto" : 1,
              width: isMobile ? "100%" : undefined,
            }}
          >
            {isMobile ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem", width: "100%" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", width: "100%", flexWrap: "nowrap" }}>
                  <button
                    type="button"
                    className="bd-scope-mobile-head"
                    aria-haspopup="listbox"
                    aria-expanded={areaPickerOpen}
                    aria-label={t("scope.openAreaMenu")}
                    onClick={() => setAreaPickerOpen(true)}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      width: "auto",
                      maxWidth: "none",
                      minHeight: 48,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "flex-start",
                      gap: "0.5rem",
                      padding: "0.35rem 0",
                      border: "none",
                      background: "none",
                      borderRadius: 0,
                      fontSize: "1.5rem",
                      fontWeight: 700,
                      lineHeight: 1.15,
                      letterSpacing: "-0.02em",
                      color: "var(--text-primary)",
                      cursor: "pointer",
                      WebkitTapHighlightColor: "transparent",
                    }}
                  >
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        textAlign: "left",
                        flex: "0 1 auto",
                        minWidth: 0,
                      }}
                    >
                      {selectedCategory ? formatCategoryLabel(selectedCategory) : t("scope.all")}
                    </span>
                    <ChevronDown size={22} aria-hidden style={{ flexShrink: 0, opacity: 0.85 }} />
                  </button>
                  {onSearchFilterChange && (
                    <button
                      type="button"
                      className={isMobile ? "bd-btn bd-scope-filter-circle" : "bd-btn"}
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
                        ...(isMobile
                          ? {}
                          : {
                              background: scopeFilterOpen ? "var(--bd-chrome-selected-bg)" : "transparent",
                              borderColor: scopeFilterOpen ? "var(--bd-chrome-selected-border)" : "var(--border-default)",
                              color: scopeFilterOpen ? "var(--bd-chrome-selected-text)" : "var(--text-tertiary)",
                            }),
                      }}
                    >
                      <Funnel size={20} aria-hidden />
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
                  <ScopeDropdown
                    ariaLabel={t("scope.chooseArea")}
                    selectedLabel={selectedCategory ? formatCategoryLabel(selectedCategory) : t("scope.all")}
                    isSelected={!!selectedCategory}
                    portalMount={scopeSheetMount}
                  >
                    {(close) => (
                      <>
                        <ScopeDropdownOption
                          label={t("scope.all")}
                          selected={!selectedCategory}
                          onClick={() => { onCategorySelect(null); close(); }}
                        />
                        {allAreas.map((value) => (
                          <ScopeDropdownOption
                            key={value}
                            label={formatCategoryLabel(value)}
                            selected={selectedCategory === value}
                            onClick={() => { onCategorySelect(value); close(); }}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              setAreaContextMenu({
                                value,
                                x: e.clientX,
                                y: e.clientY,
                                isCustom: storedCustomAreas.includes(value),
                              });
                              close();
                            }}
                          />
                        ))}
                        <div style={{ height: 1, background: "var(--border-subtle)", margin: "0.2rem 0.4rem" }} />
                        <button
                          type="button"
                          onClick={() => { close(); setShowAddArea(true); }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.4rem",
                            width: "100%",
                            padding: "0.5rem 0.65rem",
                            borderRadius: "10px",
                            border: "none",
                            background: "transparent",
                            color: "var(--text-tertiary)",
                            fontSize: "0.8125rem",
                            cursor: "pointer",
                            transition: "background 0.12s ease, color 0.12s ease",
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)";
                            (e.currentTarget as HTMLElement).style.color = "var(--text-primary)";
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.background = "transparent";
                            (e.currentTarget as HTMLElement).style.color = "var(--text-tertiary)";
                          }}
                        >
                          <Plus size={14} strokeWidth={2.5} aria-hidden />
                          {t("scope.addArea")}
                        </button>
                      </>
                    )}
                  </ScopeDropdown>
                )}
              </>
            )}
          </div>
        {onSearchFilterChange && showScopeFilterInput && (
          <>
            <ScopeActiveFilterPills
              searchFilter={searchFilter}
              dueDateFilter={dueDateFilter}
              scopeLabel={selectedAreaLabel}
              onClearSearch={() => onSearchFilterChange("")}
              onClearDueDate={() => onDueDateFilterChange?.("all")}
              onClearScope={() => onCategorySelect(null)}
            />
            <ScopeFilterSearchBlock
            isMobile={isMobile}
            searchFilter={searchFilter}
            onSearchFilterChange={onSearchFilterChange}
            beforeFilterSlot={beforeFilterSlot}
            dueDateFilter={dueDateFilter}
            onDueDateFilterChange={onDueDateFilterChange}
            t={t}
          />
          </>
        )}
        </div>
        {isMobile && areaPickerOpen && scopeSheetMount
          ? createPortal(
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: "var(--bd-z-scope-sheet)",
              background: "rgba(0,0,0,0.45)",
              backdropFilter: "blur(6px)",
              WebkitBackdropFilter: "blur(6px)",
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
              padding: 0,
              paddingBottom: "var(--bd-bottom-bar-clearance)",
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
                boxShadow: "var(--shadow-lg)",
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
                  <X size={18} aria-hidden />
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
                    background: !selectedCategory ? "var(--bd-chrome-selected-bg)" : "var(--bg-secondary)",
                    color: !selectedCategory ? "var(--bd-chrome-selected-text)" : "var(--text-primary)",
                    borderColor: !selectedCategory ? "var(--bd-chrome-selected-border)" : "var(--border-default)",
                    fontWeight: 600,
                  }}
                >
                  {t("scope.all")}
                  {!selectedCategory ? (
                    <Check size={18} strokeWidth={2.5} aria-hidden />
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
                          background: sel ? "var(--bd-chrome-selected-bg)" : "var(--bg-secondary)",
                          color: sel ? "var(--bd-chrome-selected-text)" : "var(--text-primary)",
                          borderColor: sel ? "var(--bd-chrome-selected-border)" : "var(--border-default)",
                          fontWeight: 600,
                        }}
                      >
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "left" }}>
                          {formatCategoryLabel(value)}
                        </span>
                        {sel ? (
                          <Check size={18} strokeWidth={2.5} aria-hidden />
                        ) : (
                          <span style={{ width: 18 }} aria-hidden />
                        )}
                      </button>
                      {storedCustomAreas.includes(value) && (
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
                          â‹®
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
          </div>,
          scopeSheetMount
        )
        : null}
        {areaContextMenu?.isCustom && scopeSheetMount
          ? createPortal(
              isMobile ? (
                <div
                  style={{
                    position: "fixed",
                    inset: 0,
                    zIndex: "var(--bd-z-scope-sheet)",
                    background: "var(--bd-overlay-sheet)",
                    backdropFilter: "blur(8px)",
                    WebkitBackdropFilter: "blur(8px)",
                    display: "flex",
                    alignItems: "flex-end",
                    justifyContent: "center",
                    padding: "0.75rem",
                  }}
                  onClick={() => setAreaContextMenu(null)}
                >
                  <div
                    style={{
                      position: "relative",
                      zIndex: "var(--bd-z-scope-sheet)",
                      background: "var(--bg-elevated)",
                      border: "1px solid var(--border-default)",
                      borderRadius: "16px",
                      boxShadow: "var(--shadow-md)",
                      padding: "0.25rem 0",
                      minWidth: "120px",
                      width: "min(100%, 420px)",
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
                    <button type="button" className="bd-btn" style={{ width: "100%" }} onClick={() => setAreaContextMenu(null)}>
                      {t("scope.cancel")}
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    position: "fixed",
                    left: areaContextMenu.x,
                    top: areaContextMenu.y,
                    zIndex: "var(--bd-z-scope-sheet)",
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border-default)",
                    borderRadius: "12px",
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
                    {t("scope.removeArea")}
                  </button>
                </div>
              ),
              scopeSheetMount
            )
          : null}
      </>
    );
  }

  return null;
}