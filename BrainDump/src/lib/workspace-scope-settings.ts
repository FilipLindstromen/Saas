/**
 * Restores work/personal (etc.), project, area, due-date chip, Today sheet, and item-type filter after reload.
 */
import type { DueDateFilterPreset } from "@/lib/due-date-filter";

export const WORKSPACE_SCOPE_STORAGE_KEY = "braindump_workspace_scope";

/** Desktop only: remember due-date filter for this tab (session). Absent = show no filtering until you pick one; shared prefs stay unchanged for other tabs / mobile. */
export const TAB_DUE_DATE_FILTER_KEY = "braindump_tab_due_date_filter";

export type WorkspaceMode = "inbox" | "work" | "personal" | "all";

export type WorkspaceScopePersisted = {
  mode: WorkspaceMode;
  projectId: string | null;
  category: string | null;
  itemType: string | null;
  dueDateFilter: DueDateFilterPreset;
  todayViewActive: boolean;
};

const DEFAULTS: WorkspaceScopePersisted = {
  mode: "work",
  projectId: null,
  category: null,
  itemType: null,
  dueDateFilter: "all",
  todayViewActive: false,
};

const DUE: DueDateFilterPreset[] = ["all", "today", "tomorrow", "this_week", "no_date"];

function isWorkspaceMode(s: unknown): s is WorkspaceMode {
  return s === "inbox" || s === "work" || s === "personal" || s === "all";
}

function isDuePreset(s: unknown): s is DueDateFilterPreset {
  return typeof s === "string" && (DUE as string[]).includes(s);
}

function strOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

/** Normalize JSON from localStorage or server `clientPreferences`. */
export function normalizeWorkspaceScope(raw: unknown): WorkspaceScopePersisted {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...DEFAULTS };
  }
  const o = raw as Record<string, unknown>;
  return {
    mode: isWorkspaceMode(o.mode) ? o.mode : DEFAULTS.mode,
    projectId: strOrNull(o.projectId),
    category: strOrNull(o.category),
    itemType: strOrNull(o.itemType),
    dueDateFilter: isDuePreset(o.dueDateFilter) ? o.dueDateFilter : DEFAULTS.dueDateFilter,
    todayViewActive: typeof o.todayViewActive === "boolean" ? o.todayViewActive : DEFAULTS.todayViewActive,
  };
}

export function loadWorkspaceScope(): WorkspaceScopePersisted {
  if (typeof window === "undefined") return { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(WORKSPACE_SCOPE_STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    return normalizeWorkspaceScope(JSON.parse(raw));
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveWorkspaceScope(scope: WorkspaceScopePersisted): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(WORKSPACE_SCOPE_STORAGE_KEY, JSON.stringify(scope));
    void import("@/lib/client-preferences-sync").then((m) => m.scheduleClientPreferencesUpload());
  } catch {
    /* ignore */
  }
}

export function readTabDueDateFilter(): DueDateFilterPreset | null {
  if (typeof window === "undefined") return null;
  try {
    const v = sessionStorage.getItem(TAB_DUE_DATE_FILTER_KEY);
    return isDuePreset(v) ? v : null;
  } catch {
    return null;
  }
}

export function writeTabDueDateFilter(preset: DueDateFilterPreset): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(TAB_DUE_DATE_FILTER_KEY, preset);
  } catch {
    /* ignore */
  }
}
