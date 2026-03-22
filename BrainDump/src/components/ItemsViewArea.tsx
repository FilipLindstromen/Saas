"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "@/lib/i18n";
import { getLastNewBatchIds, subscribeNewBatch } from "@/lib/newBatch";
import {
  BRAINDUMP_SUGGESTED_ITEM_TYPES_EVENT,
  type SuggestedItemTypeDetail,
} from "@/lib/item-types";
import { ENTRY_DISPLAY_CHANGED, entryPrimaryLine, loadShowEntryTitles } from "@/lib/entry-display-settings";
import { localDateTimeToDate, normalizeReminderMinutesBefore } from "@/lib/calendar-schedule";

/** Staggered fade-in for list cards, kanban, post-its (set --bd-i 0…24). */
function enterStaggerProps(i: number, quick = false): { className: string; style: CSSProperties } {
  return {
    className: quick ? "bd-enter bd-enter--quick" : "bd-enter",
    style: { ["--bd-i" as string]: Math.min(Math.max(i, 0), 24) },
  };
}

function toolbarChipProps(i: number): { className: string; style: CSSProperties } {
  return {
    className: "bd-btn bd-toolbar-chip",
    style: { ["--bd-i" as string]: Math.min(Math.max(i, 0), 14) },
  };
}

function viewChipProps(i: number): { className: string; style: CSSProperties } {
  return {
    className: "bd-btn bd-view-chip",
    style: { ["--bd-i" as string]: Math.min(Math.max(i, 0), 8) },
  };
}

const VIEW_STORAGE_KEY = "braindump-items-view";

export type ItemsViewType = "kanban" | "list" | "postits" | "calendar" | "flowchart" | "text";

export interface ViewItem {
  id: string;
  domain: string;
  category: string;
  subcategory: string;
  itemType: string;
  title: string;
  content: string;
  status: string;
  progress: string;
  recommendedView: string;
   createdAt?: string;
  positionX?: number | null;
  positionY?: number | null;
  kanbanColumn?: string | null;
  scheduledAt?: string | null;
  scheduledTime?: string | null;
  recurrence?: string | null;
  sendNotification?: boolean | null;
  reminderAt?: string | null;
  reminderMinutesBefore?: number | null;
  reminderNotifiedAt?: string | null;
  reminderEarlyNotifiedAt?: string | null;
  project?: { id: string; name: string } | null;
  tags?: { tag: { name: string } }[];
}

interface ItemsViewAreaProps {
  mode: string;
  projectId: string | null;
  category: string | null;
  itemType: string | null;
  onItemTypeSelect?: (type: string | null) => void;
  viewType?: ItemsViewType;
  onViewTypeChange?: (v: ItemsViewType) => void;
  searchFilter?: string;
  reloadKey?: number;
  /** Mobile: render ScopeBar in one row with type / view / filter (passed from page when scope is shown). */
  scopeSlot?: ReactNode;
}

const PROGRESS_OPTIONS = ["todo", "started", "completed"] as const;

const PERSONAL_AREAS_DEFAULT = ["feeling", "thoughts", "hobbies", "goals", "health", "relationships", "shopping"];
const CUSTOM_AREAS_KEY = "braindump_custom_areas";

function getPersonalAreasList(items: ViewItem[]): string[] {
  const fromItems = [...new Set(items.filter((it) => it.domain === "personal").map((it) => it.category).filter(Boolean))];
  let custom: string[] = [];
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(CUSTOM_AREAS_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      custom = Array.isArray(parsed) ? parsed.filter((c: unknown) => typeof c === "string" && c.trim()) : [];
    }
  } catch {}
  const combined = [...new Set([...PERSONAL_AREAS_DEFAULT, ...fromItems, ...custom])];
  return combined.sort((a, b) => a.localeCompare(b));
}

function formatAreaLabel(value: string): string {
  return value.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
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
  all: [
    { value: "task", label: "Task" },
    { value: "note", label: "Note" },
    { value: "idea", label: "Idea" },
    { value: "calendar", label: "Calendar" },
    { value: "emotion", label: "Emotion" },
    { value: "reflection", label: "Reflection" },
  ],
};

/** Base entry types + dynamic types from items / dump suggestions (add entry & context menu). */
function mergeEntryTypesForDomain(
  domain: string,
  items: ViewItem[],
  suggested: SuggestedItemTypeDetail[]
): { value: string; label: string }[] {
  const base = ENTRY_TYPES_BY_DOMAIN[domain] ?? ENTRY_TYPES_BY_DOMAIN.work;
  const seen = new Set(base.map((b) => b.value));
  const out = [...base];
  const itemMatchesDomain = (it: ViewItem) =>
    domain === "all" ? it.domain === "work" || it.domain === "personal" : it.domain === domain;
  for (const it of items) {
    if (!itemMatchesDomain(it) || !it.itemType || it.itemType === "reminder" || seen.has(it.itemType)) continue;
    seen.add(it.itemType);
    out.push({ value: it.itemType, label: formatTypeLabel(it.itemType) });
  }
  for (const s of suggested) {
    if (seen.has(s.type)) continue;
    if (domain === "all") {
      if (!["work", "personal", "inbox"].includes(s.domain)) continue;
    } else if (
      s.domain !== domain &&
      !(s.domain === "inbox" && (domain === "work" || domain === "personal"))
    ) {
      continue;
    }
    seen.add(s.type);
    out.push({ value: s.type, label: formatTypeLabel(s.type) });
  }
  return out;
}

const TYPE_BAR_COLORS: Record<string, string> = {
  new: "#ea580c",
  task: "#f59e0b",
  note: "#3b82f6",
  idea: "#8b5cf6",
  emotion: "#ec4899",
  reflection: "#06b6d4",
  reminder: "#10b981",
  calendar: "#10b981",
  default: "#6b7280",
};

/** Icon for each entry type (work & personal). Use on every entry and in type filters. */
function EntryTypeIcon({ type, size = 16 }: { type: string; size?: number }) {
  const t = type || "note";
  const iconProps = { width: size, height: size, strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (t) {
    case "task":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...iconProps}>
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
        </svg>
      );
    case "idea":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...iconProps}>
          <path d="M9 18h6M10 22h4M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0018 8 6 6 0 006 8c0 1 .23 2.23 1.5 3.5S10 14.09 11 14.25" />
        </svg>
      );
    case "emotion":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...iconProps}>
          <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
        </svg>
      );
    case "reflection":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...iconProps}>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4M12 8h.01" />
        </svg>
      );
    case "calendar":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...iconProps}>
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      );
    case "note":
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...iconProps}>
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
        </svg>
      );
  }
}

export function loadViewPreference(): ItemsViewType {
  if (typeof window === "undefined") return "list";
  try {
    const v = localStorage.getItem(VIEW_STORAGE_KEY);
    if (v === "kanban" || v === "list" || v === "postits" || v === "calendar" || v === "flowchart" || v === "text") return v as ItemsViewType;
  } catch {}
  return "list";
}

function formatTypeLabel(value: string): string {
  const label = value.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
  return value === "calendar" ? "Calendar" : value === "task" ? "Tasks" : label.endsWith("s") ? label : label + "s";
}

function entryTypeLabel(itemType: string): string {
  return (itemType || "note").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function entryContextLabel(it: ViewItem): string {
  const projectName = it.project?.name?.trim();
  if (projectName) return projectName;
  const category = (it.category ?? "").trim();
  if (category) return formatAreaLabel(category);
  const domain = (it.domain ?? "").trim();
  if (!domain) return "";
  return domain.charAt(0).toUpperCase() + domain.slice(1);
}

const NEW_ENTRY_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function isNewEntry(it: ViewItem): boolean {
  if (!it.createdAt) return false;
  const ts = new Date(it.createdAt).getTime();
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts < NEW_ENTRY_WINDOW_MS;
}

function formatCalendarScheduleLabel(it: { scheduledAt?: string | null; scheduledTime?: string | null; recurrence?: string | null }): string | null {
  const hasSchedule = it.scheduledAt || (it.recurrence && it.recurrence !== "none");
  if (!hasSchedule) return null;
  const time = it.scheduledTime ? ` · ${it.scheduledTime}` : "";
  if (it.recurrence === "daily") return `Daily${time}`;
  if (it.recurrence === "weekly") {
    const datePart = it.scheduledAt ? new Date(it.scheduledAt + "T00:00:00").toLocaleDateString("default", { day: "numeric", month: "short", year: "numeric" }) : "";
    return datePart ? `Weekly · ${datePart}${time}` : `Weekly${time}`;
  }
  if (it.recurrence === "monthly") {
    const datePart = it.scheduledAt ? new Date(it.scheduledAt + "T00:00:00").toLocaleDateString("default", { day: "numeric", month: "short" }) : "";
    return datePart ? `Monthly · ${datePart}${time}` : `Monthly${time}`;
  }
  if (it.scheduledAt) {
    const datePart = new Date(it.scheduledAt + "T00:00:00").toLocaleDateString("default", { day: "numeric", month: "short", year: "numeric" });
    return `${datePart}${time}`;
  }
  return null;
}


function filterItemsBySearch(items: ViewItem[], searchFilter: string): ViewItem[] {
  const q = searchFilter.trim().toLowerCase();
  if (!q) return items;
  const words = q.split(/\s+/).filter(Boolean);
  return items.filter((it) => {
    const text = `${it.title ?? ""} ${it.content ?? ""}`.toLowerCase();
    return words.every((w) => text.includes(w));
  });
}

function filterItemsByType(items: ViewItem[], itemType: string | null): ViewItem[] {
  if (!itemType) return items;
  if (itemType === "new") {
    const ids = getLastNewBatchIds();
    if (ids.size === 0) return [];
    return items.filter((it) => ids.has(it.id));
  }
  return items.filter((it) => it.itemType === itemType);
}

export function ItemsViewArea({
  mode,
  projectId,
  category,
  itemType,
  onItemTypeSelect,
  viewType: controlledViewType,
  onViewTypeChange,
  searchFilter = "",
  reloadKey = 0,
  scopeSlot,
}: ItemsViewAreaProps) {
  const { t } = useI18n();
  const [items, setItems] = useState<ViewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newBatchTick, setNewBatchTick] = useState(0);
  useEffect(() => subscribeNewBatch(() => setNewBatchTick((n) => n + 1)), []);
  const [showEntryTitles, setShowEntryTitles] = useState(() => (typeof window !== "undefined" ? loadShowEntryTitles() : true));
  useEffect(() => {
    const sync = () => setShowEntryTitles(loadShowEntryTitles());
    window.addEventListener(ENTRY_DISPLAY_CHANGED, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(ENTRY_DISPLAY_CHANGED, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  const filteredItems = useMemo(
    () => filterItemsBySearch(filterItemsByType(items, itemType), searchFilter),
    [items, itemType, searchFilter, newBatchTick]
  );
  const [suggestedItemTypesFromDump, setSuggestedItemTypesFromDump] = useState<SuggestedItemTypeDetail[]>([]);
  const [internalViewType, setInternalViewType] = useState<ItemsViewType>(loadViewPreference);
  const viewType = controlledViewType ?? internalViewType;
  const setViewType = onViewTypeChange ?? setInternalViewType;
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [postitPositions, setPostitPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [itemContextMenu, setItemContextMenu] = useState<{ id: string; x: number; y: number; domain: string; currentType: string } | null>(null);
  const [projectsList, setProjectsList] = useState<{ id: string; name: string }[]>([]);
  const [moveToProjectForId, setMoveToProjectForId] = useState<string | null>(null);
  const [moveToAreaForId, setMoveToAreaForId] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<{
    id: string;
    title: string;
    content: string;
    progress?: string;
    scheduledAt?: string;
    scheduledTime?: string;
    recurrence?: string;
    sendNotification?: boolean;
    /** Minutes before event for advance notification (0, 10, 30, 60) */
    reminderMinutesBefore?: number;
  } | null>(null);
  const [reminderEntry, setReminderEntry] = useState<{
    id: string;
    title: string;
    reminderDate: string;
    reminderTime: string;
    reminderMinutesBefore: number;
  } | null>(null);
  const [addEntryOpen, setAddEntryOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [viewPickerOpen, setViewPickerOpen] = useState(false);
  const [typePickerOpen, setTypePickerOpen] = useState(false);
  const [addEntryForm, setAddEntryForm] = useState({
    itemType: "note",
    title: "",
    content: "",
    progress: "todo",
    projectId: "" as string | null,
    scheduledAt: "",
    scheduledTime: "",
    recurrence: "none",
    sendNotification: false,
    reminderMinutesBefore: 30,
  });

  const toEditEntry = useCallback((it: ViewItem) => ({
    id: it.id,
    title: it.title,
    content: it.content ?? "",
    progress: it.progress || it.kanbanColumn || "todo",
    scheduledAt: it.scheduledAt ? String(it.scheduledAt).slice(0, 10) : "",
    scheduledTime: it.scheduledTime ?? "",
    recurrence: it.recurrence ?? "none",
    sendNotification: it.sendNotification ?? false,
    reminderMinutesBefore: normalizeReminderMinutesBefore(it.reminderMinutesBefore ?? 30),
  }), []);
  const [lineToolActive, setLineToolActive] = useState(false);
  const [postitLinks, setPostitLinks] = useState<{ fromId: string; toId: string }[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => setIsMobile(window.matchMedia("(max-width: 768px)").matches);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    if (!isMobile) setViewPickerOpen(false);
  }, [isMobile]);

  useEffect(() => {
    if (!isMobile) setTypePickerOpen(false);
  }, [isMobile]);

  const FETCH_TIMEOUT_MS = 15000;

  const fetchWithTimeout = useCallback((url: string) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    return fetch(url, { signal: controller.signal })
      .then((r) => {
        clearTimeout(timeoutId);
        return r.json();
      })
      .catch((e) => {
        clearTimeout(timeoutId);
        if (e.name === "AbortError") return { items: [] };
        throw e;
      });
  }, []);

  const fetchItems = useCallback(() => {
    if (mode === "all") {
      setLoading(true);
      Promise.all([
        fetchWithTimeout("/api/organized-items?domain=work").then((d) => d.items || []),
        fetchWithTimeout("/api/organized-items?domain=personal").then((d) => d.items || []),
      ])
        .then(([workItems, personalItems]) => {
          let merged: ViewItem[] = [...workItems, ...personalItems];
          if (category) {
            merged = merged.filter((it) => it.category === category);
          }
          merged.sort((a, b) => new Date((b as { createdAt?: string }).createdAt ?? 0).getTime() - new Date((a as { createdAt?: string }).createdAt ?? 0).getTime());
          setItems(merged);
        })
        .catch(() => setItems([]))
        .finally(() => setLoading(false));
      return;
    }
    const params = new URLSearchParams();
    params.set("domain", mode);
    if (projectId) params.set("projectId", projectId);
    if (category) params.set("category", category);
    setLoading(true);
    fetchWithTimeout(`/api/organized-items?${params}`)
      .then((d) => setItems(d.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [mode, projectId, category, fetchWithTimeout, reloadKey]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    const onReload = () => fetchItems();
    window.addEventListener("braindump-reload-items", onReload);
    return () => window.removeEventListener("braindump-reload-items", onReload);
  }, [fetchItems]);

  useEffect(() => {
    const h = (e: Event) => {
      const detail = (e as CustomEvent<SuggestedItemTypeDetail[]>).detail;
      if (!Array.isArray(detail)) return;
      setSuggestedItemTypesFromDump((prev) => {
        const map = new Map<string, SuggestedItemTypeDetail>();
        const key = (x: SuggestedItemTypeDetail) => `${x.domain}:${x.type}`;
        for (const x of prev) map.set(key(x), x);
        for (const x of detail) map.set(key(x), x);
        return [...map.values()];
      });
    };
    window.addEventListener(BRAINDUMP_SUGGESTED_ITEM_TYPES_EVENT, h);
    return () => window.removeEventListener(BRAINDUMP_SUGGESTED_ITEM_TYPES_EVENT, h);
  }, []);

  useEffect(() => {
    setSuggestedItemTypesFromDump((prev) =>
      prev.filter((s) => !items.some((it) => it.itemType === s.type))
    );
  }, [items]);

  /** "New" filter only if at least one loaded item is in the last dump batch. */
  const hasNewEntries = useMemo(() => {
    const ids = getLastNewBatchIds();
    if (ids.size === 0) return false;
    return items.some((it) => ids.has(it.id));
  }, [items, newBatchTick]);

  /** Count entries per type in current scope — hide type chips with zero entries. */
  const typesWithEntries = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of items) {
      if (!it.itemType || it.itemType === "reminder") continue;
      m.set(it.itemType, (m.get(it.itemType) ?? 0) + 1);
    }
    return m;
  }, [items]);

  const addEntryTypeOptions = useMemo(
    () => mergeEntryTypesForDomain(mode, items, suggestedItemTypesFromDump),
    [mode, items, suggestedItemTypesFromDump]
  );

  useEffect(() => {
    if (!onItemTypeSelect) return;
    const cur = itemType ?? "";
    if (!cur) return;
    if (cur === "new") {
      if (!hasNewEntries) onItemTypeSelect(null);
      return;
    }
    if ((typesWithEntries.get(cur) ?? 0) === 0) onItemTypeSelect(null);
  }, [hasNewEntries, typesWithEntries, itemType, onItemTypeSelect]);

  const typeColor = (value: string | ""): string | undefined => {
    if (!value) return undefined;
    switch (value) {
      case "new":
        return "#ea580c";
      case "task":
        return "#ff9f1c";
      case "note":
        return "#2472ff";
      case "idea":
        return "#a855ff";
      case "calendar":
        return "#16a34a";
      case "emotion":
        return "#f97373";
      case "reflection":
        return "#14b8a6";
      default:
        return undefined;
    }
  };

  const typeOptions = useMemo(() => {
    const allLabel = t("items.allTypes");
    const opts: { value: string; label: string }[] = [{ value: "", label: allLabel }];
    if (hasNewEntries) {
      opts.push({ value: "new", label: t("items.typeNew") });
    }
    const sorted = [...typesWithEntries.keys()].sort((a, b) => a.localeCompare(b));
    for (const value of sorted) {
      opts.push({ value, label: formatTypeLabel(value) });
    }
    return opts;
  }, [t, hasNewEntries, typesWithEntries]);

  const selectedTypeLabel = useMemo(() => {
    const key = itemType ?? "";
    const opt = typeOptions.find((o) => o.value === key);
    return opt?.label ?? t("items.allTypes");
  }, [typeOptions, itemType, t]);

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, viewType);
    } catch {}
  }, [viewType]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("braindump_postit_links");
      const parsed: Record<string, { fromId: string; toId: string }[]> = raw ? JSON.parse(raw) : {};
      setPostitLinks(parsed[mode] ?? []);
    } catch {}
  }, [mode]);

  useEffect(() => {
    try {
      const key = "braindump_postit_links";
      const raw = localStorage.getItem(key);
      const parsed: Record<string, { fromId: string; toId: string }[]> = raw ? JSON.parse(raw) : {};
      parsed[mode] = postitLinks;
      localStorage.setItem(key, JSON.stringify(parsed));
    } catch {}
  }, [mode, postitLinks]);


  useEffect(() => {
    if (!itemContextMenu) return;
    if (isMobile) return;
    const close = () => {
      setItemContextMenu(null);
      setMoveToProjectForId(null);
      setMoveToAreaForId(null);
    };
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [itemContextMenu, isMobile]);

  const updateProgress = useCallback((id: string, progress: string, kanbanColumn?: string) => {
    const col = kanbanColumn ?? progress;
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, progress, kanbanColumn: col } : it))
    );
    fetch(`/api/organized-items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ progress, kanbanColumn: col }),
    }).catch(() => {
      // Keep optimistic update; state stays as user set it
    });
  }, []);

  const updatePosition = useCallback((id: string, x: number, y: number) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, positionX: x, positionY: y } : it))
    );
    fetch(`/api/organized-items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ positionX: x, positionY: y }),
    }).catch(() => {
      // Keep optimistic update; position stays where user dropped it
    });
  }, []);

  const deleteItem = useCallback(
    (id: string, skipConfirm?: boolean) => {
      if (!skipConfirm && !confirm("Delete this item?")) return;
      fetch(`/api/organized-items/${id}`, { method: "DELETE" })
        .then((r) => {
          if (r.ok) setItems((prev) => prev.filter((it) => it.id !== id));
        })
        .catch(() => {});
    },
    []
  );

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

  const updateProject = useCallback((id: string, projectId: string | null) => {
    fetch(`/api/organized-items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId }),
    })
      .then((r) => {
        if (r.ok) {
          const project = projectId ? projectsList.find((p) => p.id === projectId) ?? null : null;
          setItems((prev) => prev.map((it) => (it.id === id ? { ...it, project: project ? { id: project.id, name: project.name } : null } : it)));
        }
      })
      .catch(() => {});
  }, [projectsList]);

  const updateCategory = useCallback((id: string, category: string) => {
    fetch(`/api/organized-items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, subcategory: "" }),
    })
      .then((r) => {
        if (r.ok) setItems((prev) => prev.map((it) => (it.id === id ? { ...it, category, subcategory: "" } : it)));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (mode !== "work") return;
    fetch("/api/projects?domain=work")
      .then((r) => r.json())
      .then((d) => setProjectsList((d.projects ?? []).map((p: { id: string; name: string }) => ({ id: p.id, name: p.name }))))
      .catch(() => setProjectsList([]));
  }, [mode]);

  const updateEntryContent = useCallback((id: string, updates: { title?: string; content?: string }) => {
    fetch(`/api/organized-items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    })
      .then((r) => {
        if (r.ok)
          setItems((prev) =>
            prev.map((it) => (it.id === id ? { ...it, ...updates } : it))
          );
      })
      .catch(() => {});
  }, []);

  const createEntry = useCallback(
    async (form: typeof addEntryForm) => {
      const title = form.title.trim();
      if (!title) return;
      const resDump = await fetch("/api/dumps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          transcriptRaw: "",
          transcriptEdited: "",
          status: "organized",
        }),
      });
      const { dump } = await resDump.json();
      if (!dump?.id) return;
      const payload: Record<string, unknown> = {
        dumpId: dump.id,
        domain: mode,
        category: form.itemType,
        subcategory: "",
        projectId: form.projectId || null,
        itemType: form.itemType,
        title,
        content: form.content?.trim() ?? "",
      };
      if (form.itemType === "task") {
        payload.progress = form.progress;
        payload.kanbanColumn = form.progress;
      }
      if (form.itemType === "calendar") {
        payload.scheduledAt = form.scheduledAt || null;
        payload.scheduledTime = form.scheduledTime || null;
        payload.recurrence = form.recurrence === "none" ? null : form.recurrence;
        payload.sendNotification = form.sendNotification;
        const rMin = normalizeReminderMinutesBefore(form.reminderMinutesBefore ?? 0);
        if (form.sendNotification && form.scheduledAt?.trim()) {
          const at = localDateTimeToDate(form.scheduledAt.trim(), form.scheduledTime || "09:00");
          if (at) {
            payload.reminderAt = at.toISOString();
            payload.reminderMinutesBefore = rMin;
          }
        }
      }
      const resItem = await fetch("/api/organized-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (resItem.ok) {
        fetchItems();
        setAddEntryOpen(false);
      }
    },
    [mode, fetchItems]
  );

  const updateSchedule = useCallback(
    (
      id: string,
      schedule: {
        scheduledAt?: string | null;
        scheduledTime?: string | null;
        recurrence?: string | null;
        sendNotification?: boolean;
        reminderAt?: string | null;
        reminderMinutesBefore?: number | null;
      }
    ) => {
    fetch(`/api/organized-items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(schedule),
    })
      .then((r) => {
        if (r.ok)
          setItems((prev) =>
            prev.map((it) => (it.id === id ? { ...it, ...schedule } : it))
          );
      })
      .catch(() => {});
  }, []);

  /** Advance notification for calendar (matches server / organize). */
  const CALENDAR_NOTIFY_BEFORE_OPTIONS = [60, 30, 10, 0] as const;
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
                      reminderNotifiedAt: undefined,
                      reminderEarlyNotifiedAt: undefined,
                    }
                  : it
              )
            );
        })
        .catch(() => {});
    },
    []
  );

  const viewButtons: { value: ItemsViewType; label: string; icon: ReactNode }[] = useMemo(
    () => [
      { value: "list", label: t("items.viewList"), icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg> },
      { value: "text", label: t("items.viewText"), icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /><line x1="8" y1="7" x2="16" y2="7" /><line x1="8" y1="11" x2="16" y2="11" /><line x1="8" y1="15" x2="12" y2="15" /></svg> },
      { value: "kanban", label: t("items.viewKanban"), icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="5" height="18" rx="1" /><rect x="9.5" y="3" width="5" height="18" rx="1" /><rect x="16" y="3" width="5" height="18" rx="1" /></svg> },
      { value: "postits", label: t("items.viewPostits"), icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M9 9h6" /><path d="M9 13h6" /><path d="M9 17h4" /></svg> },
      { value: "calendar", label: t("items.viewCalendar"), icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg> },
      { value: "flowchart", label: t("items.viewFlowchart"), icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="4" r="2.5" /><path d="M12 6.5v3" /><circle cx="6" cy="14" r="2.5" /><circle cx="12" cy="14" r="2.5" /><circle cx="18" cy="14" r="2.5" /><path d="M12 9.5c-2.5 0-4.5 1.2-6 3M12 9.5c2.5 0 4.5 1.2 6 3" /><path d="M12 16.5v3.5" /><circle cx="12" cy="22" r="1.5" fill="currentColor" stroke="none" /></svg> },
    ],
    [t]
  );

  const [bottomViewSlotEl, setBottomViewSlotEl] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (typeof document === "undefined") return;
    setBottomViewSlotEl(document.getElementById("bd-bottom-view-slot"));
  }, []);

  if (loading) {
    return (
      <div style={{ padding: "1.5rem" }}>
        <p className="bd-empty">{t("items.loading")}</p>
      </div>
    );
  }

  const mobileModesToolbar = mode === "work" || mode === "personal" || mode === "all";
  const showUnifiedMobileChrome = Boolean(isMobile && mobileModesToolbar && scopeSlot);

  const mobileViewPickerButton = (
    <button
      type="button"
      className="bd-btn bd-bottom-view-btn"
      aria-haspopup="listbox"
      aria-expanded={viewPickerOpen}
      aria-label={t("items.openViewMenu")}
      title={viewButtons.find((b) => b.value === viewType)?.label}
      onClick={() => setViewPickerOpen(true)}
      style={{
        flexShrink: 0,
        minWidth: 44,
        minHeight: 44,
        width: 44,
        padding: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bd-chrome-selected-bg)",
        borderColor: "var(--bd-chrome-selected-border)",
        color: "var(--bd-chrome-selected-text)",
        boxShadow: "none",
      }}
    >
      <span style={{ display: "flex", alignItems: "center", justifyContent: "center" }} aria-hidden>
        {viewButtons.find((b) => b.value === viewType)?.icon}
      </span>
    </button>
  );

  const mobileToolbarCompactInner = (
    <>
      {onItemTypeSelect && (
        <button
          type="button"
          className="bd-btn"
          aria-haspopup="listbox"
          aria-expanded={typePickerOpen}
          aria-label={t("items.openTypeMenu")}
          title={selectedTypeLabel}
          onClick={() => setTypePickerOpen(true)}
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 44,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.5rem",
            padding: "0.4rem 0.65rem",
            fontSize: "0.8125rem",
            fontWeight: 600,
            background: "var(--bd-chrome-selected-bg)",
            borderColor: "var(--bd-chrome-selected-border)",
            color: "var(--bd-chrome-selected-text)",
            boxShadow: "none",
          }}
        >
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "left" }}>{selectedTypeLabel}</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.95 }} aria-hidden>
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      )}
      {viewType === "postits" && (
        <button
          type="button"
          className="bd-btn"
          title={t("items.connectPostits")}
          aria-label={t("items.connectPostits")}
          style={{
            padding: "0.4rem",
            minWidth: 44,
            minHeight: 44,
            flexShrink: 0,
            background: lineToolActive ? "var(--bd-chrome-selected-bg)" : undefined,
            color: lineToolActive ? "var(--bd-chrome-selected-text)" : undefined,
            borderColor: lineToolActive ? "var(--bd-chrome-selected-border)" : "transparent",
          }}
          onClick={() => setLineToolActive((a) => !a)}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      )}
    </>
  );

  return (
    <div className="bd-items-view-root">
      {isMobile && bottomViewSlotEl && createPortal(mobileViewPickerButton, bottomViewSlotEl)}
      {showUnifiedMobileChrome && (
        <div className="bd-mobile-unified-chrome">
          <div className="bd-mobile-unified-chrome__scope">{scopeSlot}</div>
          <div className="bd-mobile-unified-chrome__tools">
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                gap: "0.4rem",
                width: "100%",
                minWidth: 0,
                flexWrap: "nowrap",
              }}
            >
              {mobileToolbarCompactInner}
            </div>
          </div>
        </div>
      )}
      {!showUnifiedMobileChrome && (
      <div className="bd-items-toolbar">
        {isMobile && mobileModesToolbar ? (
          <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "0.4rem", width: "100%", minWidth: 0, gridColumn: "1 / -1", flexWrap: "nowrap" }}>
              {mobileToolbarCompactInner}
          </div>
        ) : (
          <>
            <div className="bd-items-toolbar-left">
              {onItemTypeSelect && (mode === "work" || mode === "personal" || mode === "all") && (
                <div
                  className={isMobile ? "bd-scope-strip bd-items-type-filters" : undefined}
                  style={{
                    display: "flex",
                    gap: "0.4rem",
                    alignItems: "center",
                    flexWrap: isMobile ? "nowrap" : "wrap",
                    overflowX: isMobile ? "auto" : "visible",
                    minWidth: 0,
                    width: isMobile ? "100%" : "auto",
                    paddingBottom: isMobile ? 2 : 0,
                  }}
                >
                  {typeOptions.map((opt, i) => {
                    const isSelected = (itemType ?? "") === opt.value;
                    const color = typeColor(opt.value);
                    const chip = toolbarChipProps(i);
                    return (
                      <button
                        key={opt.value || "all"}
                        type="button"
                        className={chip.className}
                        style={{
                          ...chip.style,
                          padding: isMobile ? "0.45rem 0.75rem" : "0.4rem 0.65rem",
                          fontSize: "0.8125rem",
                          minHeight: isMobile ? 44 : undefined,
                          flexShrink: 0,
                          background: isSelected ? "var(--bd-chrome-selected-bg)" : undefined,
                          color: isSelected ? "var(--bd-chrome-selected-text)" : undefined,
                          borderColor: isSelected ? "var(--bd-chrome-selected-border)" : color ?? "var(--border-default)",
                          borderLeft: isSelected && color ? `3px solid ${color}` : undefined,
                          paddingLeft: isSelected && color ? "0.55rem" : undefined,
                        }}
                        onClick={() => onItemTypeSelect(opt.value || null)}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div
              className={
                isMobile ? "bd-items-toolbar-right" : "bd-items-toolbar-right bd-items-toolbar-views"
              }
            >
              {isMobile ? (
                <>
                  {viewType === "postits" && (
                    <button
                      type="button"
                      className="bd-btn"
                      title={t("items.connectPostits")}
                      aria-label={t("items.connectPostits")}
                      style={{
                        padding: "0.4rem",
                        minWidth: 44,
                        minHeight: 44,
                        flexShrink: 0,
                        background: lineToolActive ? "var(--bd-chrome-selected-bg)" : undefined,
                        color: lineToolActive ? "var(--bd-chrome-selected-text)" : undefined,
                        borderColor: lineToolActive ? "var(--bd-chrome-selected-border)" : "transparent",
                      }}
                      onClick={() => setLineToolActive((a) => !a)}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </button>
                  )}
                </>
              ) : (
                <>
                  {viewButtons.map(({ value, label, icon }, i) => {
                    const vc = viewChipProps(i);
                    return (
                    <button
                      key={value}
                      type="button"
                      className={vc.className}
                      title={label}
                      aria-label={label}
                      style={{
                        ...vc.style,
                        padding: "0.4rem",
                        flexShrink: 0,
                        background: viewType === value ? "var(--bd-chrome-selected-bg)" : "transparent",
                        borderColor: viewType === value ? "var(--bd-chrome-selected-border)" : "var(--border-default)",
                        color: viewType === value ? "var(--bd-chrome-selected-text)" : "var(--text-primary)",
                      }}
                      onClick={() => setViewType(value)}
                    >
                      {icon}
                    </button>
                    );
                  })}
                  {viewType === "postits" && (
                    <button
                      type="button"
                      className="bd-btn"
                      title={t("items.connectPostits")}
                      aria-label={t("items.connectPostits")}
                      style={{
                        marginLeft: "0.25rem",
                        padding: "0.4rem",
                        flexShrink: 0,
                        background: lineToolActive ? "var(--bd-chrome-selected-bg)" : undefined,
                        color: lineToolActive ? "var(--bd-chrome-selected-text)" : undefined,
                        borderColor: lineToolActive ? "var(--bd-chrome-selected-border)" : "transparent",
                      }}
                      onClick={() => setLineToolActive((a) => !a)}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </button>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>
      )}
        {isMobile && viewPickerOpen && (
          <div
            className="bd-items-sheet-backdrop"
            onClick={() => setViewPickerOpen(false)}
          >
            <div
              className="bd-panel bd-items-sheet-panel"
              onClick={(e) => e.stopPropagation()}
              role="listbox"
              aria-label={t("items.chooseView")}
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
                <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600, color: "var(--text-primary)" }}>{t("items.chooseView")}</h3>
                <button
                  type="button"
                  className="bd-btn"
                  onClick={() => setViewPickerOpen(false)}
                  aria-label={t("scope.cancel")}
                  style={{ minWidth: 44, minHeight: 44, padding: "0.45rem", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                {viewButtons.map(({ value, label, icon }, i) => {
                  const sel = viewType === value;
                  const vc = viewChipProps(i);
                  return (
                    <button
                      key={value}
                      type="button"
                      className={`bd-btn ${vc.className}`.trim()}
                      role="option"
                      aria-selected={sel}
                      title={label}
                      onClick={() => {
                        setViewType(value);
                        setViewPickerOpen(false);
                      }}
                      style={{
                        ...vc.style,
                        minHeight: 52,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "0.75rem",
                        padding: "0.5rem 0.75rem",
                        background: sel ? "var(--bd-chrome-selected-bg)" : "var(--bg-secondary)",
                        color: sel ? "var(--bd-chrome-selected-text)" : "var(--text-primary)",
                        borderColor: sel ? "var(--bd-chrome-selected-border)" : "var(--border-default)",
                        fontWeight: 600,
                      }}
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: "0.65rem", minWidth: 0, flex: 1 }}>
                        <span style={{ display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }} aria-hidden>
                          {icon}
                        </span>
                        <span style={{ fontSize: "0.9375rem", textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {label}
                        </span>
                      </span>
                      {sel ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : (
                        <span style={{ width: 18 }} aria-hidden />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
        {isMobile && typePickerOpen && onItemTypeSelect && mobileModesToolbar && (
          <div
            className="bd-items-sheet-backdrop"
            onClick={() => setTypePickerOpen(false)}
          >
            <div
              className="bd-panel bd-items-sheet-panel"
              onClick={(e) => e.stopPropagation()}
              role="listbox"
              aria-label={t("items.chooseType")}
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
                <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600, color: "var(--text-primary)" }}>{t("items.chooseType")}</h3>
                <button
                  type="button"
                  className="bd-btn"
                  onClick={() => setTypePickerOpen(false)}
                  aria-label={t("scope.cancel")}
                  style={{ minWidth: 44, minHeight: 44, padding: "0.45rem", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                {typeOptions.map((opt, i) => {
                  const sel = (itemType ?? "") === opt.value;
                  const color = typeColor(opt.value);
                  const chip = toolbarChipProps(i);
                  return (
                    <button
                      key={opt.value || "all"}
                      type="button"
                      className={chip.className}
                      role="option"
                      aria-selected={sel}
                      onClick={() => {
                        onItemTypeSelect(opt.value || null);
                        setTypePickerOpen(false);
                      }}
                      style={{
                        ...chip.style,
                        minHeight: 52,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "0.75rem",
                        padding: "0.5rem 0.75rem",
                        background: sel ? "var(--bd-chrome-selected-bg)" : "var(--bg-secondary)",
                        color: sel ? "var(--bd-chrome-selected-text)" : "var(--text-primary)",
                        borderColor: sel ? "var(--bd-chrome-selected-border)" : "var(--border-default)",
                        borderLeft: sel && color ? `3px solid ${color}` : undefined,
                        paddingLeft: sel && color ? "0.65rem" : undefined,
                        fontWeight: 600,
                      }}
                    >
                      <span style={{ fontSize: "0.9375rem", textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>
                        {opt.label}
                      </span>
                      {sel ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : (
                        <span style={{ width: 18 }} aria-hidden />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

      {items.length === 0 ? (
        <p className="bd-empty">{t("items.emptyFilters")}</p>
      ) : filteredItems.length === 0 ? (
        <p className="bd-empty">{t("items.emptySearch")}</p>
      ) : viewType === "list" ? (
        <ListView showEntryTitles={showEntryTitles} items={filteredItems} onProgress={updateProgress} onDelete={deleteItem} onItemContextMenu={(e, id, domain, currentType) => setItemContextMenu({ id, x: e.clientX, y: e.clientY, domain, currentType })} onEdit={(it) => setEditingEntry(toEditEntry(it))} />
      ) : viewType === "text" ? (
        <TextView showEntryTitles={showEntryTitles} items={filteredItems} onUpdate={updateEntryContent} onItemContextMenu={(e, id, domain, currentType) => setItemContextMenu({ id, x: e.clientX, y: e.clientY, domain, currentType })} />
      ) : viewType === "kanban" ? (
            <KanbanView showEntryTitles={showEntryTitles} items={filteredItems} onProgress={updateProgress} onDelete={deleteItem} onItemContextMenu={(e, id, domain, currentType) => setItemContextMenu({ id, x: e.clientX, y: e.clientY, domain, currentType })} onEdit={(it) => setEditingEntry(toEditEntry(it))} isMobile={isMobile} />
      ) : viewType === "calendar" ? (
        <CalendarView
          showEntryTitles={showEntryTitles}
          items={filteredItems}
          onSchedule={updateSchedule}
          onEdit={(it) => setEditingEntry(toEditEntry(it))}
          onItemContextMenu={(e, id, domain, currentType) => setItemContextMenu({ id, x: e.clientX, y: e.clientY, domain, currentType })}
          isMobile={isMobile}
        />
      ) : viewType === "flowchart" ? (
        <MindmapView
          showEntryTitles={showEntryTitles}
          items={filteredItems}
          onEdit={(it) => setEditingEntry(toEditEntry(it))}
          onItemContextMenu={(e, id, domain, currentType) => setItemContextMenu({ id, x: e.clientX, y: e.clientY, domain, currentType })}
          isMobile={isMobile}
        />
      ) : (
        <PostitsView
          showEntryTitles={showEntryTitles}
          items={filteredItems}
          onProgress={updateProgress}
          onDelete={deleteItem}
          onPosition={updatePosition}
          postitPositions={postitPositions}
          setPostitPositions={setPostitPositions}
          onItemContextMenu={(e, id, domain, currentType) => setItemContextMenu({ id, x: e.clientX, y: e.clientY, domain, currentType })}
          onEdit={(it) => setEditingEntry(toEditEntry(it))}
          lineToolActive={lineToolActive}
          links={postitLinks}
          onAddLink={(fromId, toId) => setPostitLinks((prev) => (prev.some((l) => l.fromId === fromId && l.toId === toId) ? prev : [...prev, { fromId, toId }]))}
          onRemoveLink={(fromId, toId) => setPostitLinks((prev) => prev.filter((l) => !(l.fromId === fromId && l.toId === toId)))}
        />
      )}

      {itemContextMenu && (() => {
        const types = mergeEntryTypesForDomain(itemContextMenu.domain, items, suggestedItemTypesFromDump);
        const selectedItem = items.find((i) => i.id === itemContextMenu.id);
        const personalAreas = getPersonalAreasList(items);
        const closeMenu = () => {
          setItemContextMenu(null);
          setMoveToProjectForId(null);
          setMoveToAreaForId(null);
        };
        return (
          <div
            className={isMobile ? "bd-items-sheet-backdrop bd-items-context-menu-backdrop" : undefined}
            onClick={isMobile ? closeMenu : undefined}
          >
          <div
            style={{
              position: isMobile ? "relative" : "fixed",
              left: isMobile ? undefined : itemContextMenu.x,
              top: isMobile ? undefined : itemContextMenu.y,
              zIndex: 1000,
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-default)",
              borderRadius: isMobile ? "16px" : "var(--button-radius)",
              boxShadow: "var(--shadow-md)",
              padding: "0.25rem 0",
              minWidth: "140px",
              width: isMobile ? "min(100%, 560px)" : undefined,
              maxHeight: isMobile ? "80dvh" : undefined,
              overflow: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: "0.25rem 0.5rem", fontSize: "0.7rem", fontWeight: 600, color: "var(--text-tertiary)", borderBottom: "1px solid var(--border-default)" }}>
              {isMobile ? t("menu.actions") : t("menu.changeType")}
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
                  closeMenu();
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
                if (it) setEditingEntry(toEditEntry(it));
                closeMenu();
              }}
            >
              {t("menu.edit")}
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
                closeMenu();
              }}
            >
              {t("menu.setReminder")}
            </button>
            {mode === "work" && (
              <button
                type="button"
                className="bd-btn"
                style={{ width: "100%", justifyContent: "flex-start" }}
                onClick={() => setMoveToProjectForId((prev) => (prev === itemContextMenu.id ? null : itemContextMenu.id))}
              >
                {t("menu.moveToProject")}
              </button>
            )}
            {itemContextMenu.domain === "personal" && (
              <button
                type="button"
                className="bd-btn"
                style={{ width: "100%", justifyContent: "flex-start" }}
                onClick={() => setMoveToAreaForId((prev) => (prev === itemContextMenu.id ? null : itemContextMenu.id))}
              >
                {t("menu.moveToArea")}
              </button>
            )}
            {mode === "work" && moveToProjectForId === itemContextMenu.id && !isMobile && (
              <div
                style={{
                  position: "fixed",
                  left: itemContextMenu.x + 148,
                  top: itemContextMenu.y,
                  zIndex: 1001,
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border-default)",
                  borderRadius: "var(--button-radius)",
                  boxShadow: "var(--shadow-md)",
                  padding: "0.25rem 0",
                  minWidth: "160px",
                  maxHeight: "280px",
                  overflow: "auto",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ padding: "0.25rem 0.5rem", fontSize: "0.7rem", fontWeight: 600, color: "var(--text-tertiary)", borderBottom: "1px solid var(--border-default)" }}>
                  {t("menu.selectProject")}
                </div>
                {(() => {
                  const it = items.find((i) => i.id === itemContextMenu.id);
                  const currentProjectId = it?.project?.id ?? null;
                  return (
                    <>
                      <button
                        type="button"
                        className="bd-btn"
                        style={{ width: "100%", justifyContent: "flex-start", fontWeight: currentProjectId === null ? 600 : 400 }}
                        onClick={() => {
                          updateProject(itemContextMenu.id, null);
                          setMoveToProjectForId(null);
                          setItemContextMenu(null);
                        }}
                      >
                        {t("menu.noProject")}
                        {currentProjectId === null ? " ✓" : ""}
                      </button>
                      {projectsList.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          className="bd-btn"
                          style={{ width: "100%", justifyContent: "flex-start", fontWeight: currentProjectId === p.id ? 600 : 400 }}
                          onClick={() => {
                            updateProject(itemContextMenu.id, p.id);
                            setMoveToProjectForId(null);
                            setItemContextMenu(null);
                          }}
                        >
                          {p.name}
                          {currentProjectId === p.id ? " ✓" : ""}
                        </button>
                      ))}
                    </>
                  );
                })()}
              </div>
            )}
            {itemContextMenu.domain === "personal" && moveToAreaForId === itemContextMenu.id && !isMobile && (() => {
              const areas = getPersonalAreasList(items);
              const it = items.find((i) => i.id === itemContextMenu.id);
              const currentCategory = it?.category ?? "";
              return (
                <div
                  style={{
                    position: "fixed",
                    left: itemContextMenu.x + 148,
                    top: itemContextMenu.y,
                    zIndex: 1001,
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border-default)",
                    borderRadius: "var(--button-radius)",
                    boxShadow: "var(--shadow-md)",
                    padding: "0.25rem 0",
                    minWidth: "160px",
                    maxHeight: "280px",
                    overflow: "auto",
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div style={{ padding: "0.25rem 0.5rem", fontSize: "0.7rem", fontWeight: 600, color: "var(--text-tertiary)", borderBottom: "1px solid var(--border-default)" }}>
                    {t("menu.selectArea")}
                  </div>
                  {areas.map((areaKey) => (
                    <button
                      key={areaKey}
                      type="button"
                      className="bd-btn"
                      style={{ width: "100%", justifyContent: "flex-start", fontWeight: currentCategory === areaKey ? 600 : 400 }}
                      onClick={() => {
                        updateCategory(itemContextMenu.id, areaKey);
                        setMoveToAreaForId(null);
                        setItemContextMenu(null);
                      }}
                    >
                      {formatAreaLabel(areaKey)}
                      {currentCategory === areaKey ? " ✓" : ""}
                    </button>
                  ))}
                </div>
              );
            })()}
            {isMobile && mode === "work" && moveToProjectForId === itemContextMenu.id && (
              <div style={{ borderTop: "1px solid var(--border-default)", marginTop: "0.25rem", paddingTop: "0.25rem" }}>
                <div style={{ padding: "0.25rem 0.5rem", fontSize: "0.7rem", fontWeight: 600, color: "var(--text-tertiary)" }}>
                  {t("menu.selectProject")}
                </div>
                <button
                  type="button"
                  className="bd-btn"
                  style={{ width: "100%", justifyContent: "flex-start", fontWeight: selectedItem?.project?.id == null ? 600 : 400 }}
                  onClick={() => {
                    updateProject(itemContextMenu.id, null);
                    closeMenu();
                  }}
                >
                  {t("menu.noProject")}
                  {selectedItem?.project?.id == null ? " ✓" : ""}
                </button>
                {projectsList.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="bd-btn"
                    style={{ width: "100%", justifyContent: "flex-start", fontWeight: selectedItem?.project?.id === p.id ? 600 : 400 }}
                    onClick={() => {
                      updateProject(itemContextMenu.id, p.id);
                      closeMenu();
                    }}
                  >
                    {p.name}
                    {selectedItem?.project?.id === p.id ? " ✓" : ""}
                  </button>
                ))}
              </div>
            )}
            {isMobile && itemContextMenu.domain === "personal" && moveToAreaForId === itemContextMenu.id && (
              <div style={{ borderTop: "1px solid var(--border-default)", marginTop: "0.25rem", paddingTop: "0.25rem" }}>
                <div style={{ padding: "0.25rem 0.5rem", fontSize: "0.7rem", fontWeight: 600, color: "var(--text-tertiary)" }}>
                  {t("menu.selectArea")}
                </div>
                {personalAreas.map((areaKey) => (
                  <button
                    key={areaKey}
                    type="button"
                    className="bd-btn"
                    style={{ width: "100%", justifyContent: "flex-start", fontWeight: selectedItem?.category === areaKey ? 600 : 400 }}
                    onClick={() => {
                      updateCategory(itemContextMenu.id, areaKey);
                      closeMenu();
                    }}
                  >
                    {formatAreaLabel(areaKey)}
                    {selectedItem?.category === areaKey ? " ✓" : ""}
                  </button>
                ))}
              </div>
            )}
            <div style={{ borderTop: "1px solid var(--border-default)", marginTop: "0.25rem", paddingTop: "0.25rem" }}>
              <button
                type="button"
                className="bd-btn"
                style={{ width: "100%", justifyContent: "flex-start", color: "var(--text-danger, #c53030)" }}
                onClick={() => {
                  deleteItem(itemContextMenu.id, true);
                  closeMenu();
                }}
              >
                {t("menu.delete")}
              </button>
            </div>
            {isMobile && (
              <div style={{ borderTop: "1px solid var(--border-default)", marginTop: "0.25rem", paddingTop: "0.25rem" }}>
                <button type="button" className="bd-btn" style={{ width: "100%" }} onClick={closeMenu}>
                  {t("menu.cancel")}
                </button>
              </div>
            )}
          </div>
          </div>
        );
      })()}

      {editingEntry && (
        <div
          className="bd-modal-backdrop"
          onClick={() => setEditingEntry(null)}
        >
          <div
            className="bd-panel bd-modal-panel"
            style={{ padding: "1.25rem", maxWidth: 480, width: "100%" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 0.75rem", fontSize: "1rem" }}>{t("items.editEntry")}</h3>
            <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-tertiary)", marginBottom: "0.25rem" }}>{t("items.headline")}</label>
            <input
              className="bd-input"
              value={editingEntry.title}
              onChange={(e) => setEditingEntry((prev) => prev && { ...prev, title: e.target.value })}
              placeholder={t("items.titlePlaceholder")}
              style={{ width: "100%", marginBottom: "0.75rem" }}
              autoFocus
            />
            <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-tertiary)", marginBottom: "0.25rem" }}>{t("items.description")}</label>
            <textarea
              className="bd-textarea"
              value={editingEntry.content}
              onChange={(e) => setEditingEntry((prev) => prev && { ...prev, content: e.target.value })}
              placeholder={t("items.descPlaceholder")}
              style={{ width: "100%", minHeight: 100, marginBottom: "1rem", borderRadius: 18 }}
            />
            {items.find((i) => i.id === editingEntry.id)?.itemType === "task" && (
              <div style={{ borderTop: "1px solid var(--border-default)", paddingTop: "0.75rem", marginBottom: "1rem" }}>
                <h4 style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", margin: "0 0 0.5rem" }}>{t("items.progress")}</h4>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  {PROGRESS_OPTIONS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      className="bd-btn"
                      style={{
                        padding: "0.35rem 0.6rem",
                        fontSize: "0.8125rem",
                        background: (editingEntry.progress || "todo") === p ? "var(--bg-hover)" : undefined,
                        borderColor: (editingEntry.progress || "todo") === p ? "var(--bd-chrome-selected-border)" : undefined,
                      }}
                      onClick={() => setEditingEntry((prev) => prev ? { ...prev, progress: p } : null)}
                    >
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {items.find((i) => i.id === editingEntry.id)?.itemType === "calendar" && (
              <div style={{ borderTop: "1px solid var(--border-default)", paddingTop: "0.75rem", marginBottom: "1rem" }}>
                <h4 style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", margin: "0 0 0.5rem" }}>Calendar</h4>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem 1rem", alignItems: "center" }}>
                  <label style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
                    Date
                    <input
                      type="date"
                      className="bd-input"
                      value={editingEntry.scheduledAt ?? ""}
                      onChange={(e) => setEditingEntry((prev) => prev && { ...prev, scheduledAt: e.target.value })}
                      style={{ marginLeft: "0.35rem", padding: "0.25rem 0.5rem" }}
                    />
                  </label>
                  <label style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
                    Time
                    <input
                      type="time"
                      className="bd-input"
                      value={editingEntry.scheduledTime ?? ""}
                      onChange={(e) => setEditingEntry((prev) => prev && { ...prev, scheduledTime: e.target.value })}
                      style={{ marginLeft: "0.35rem", padding: "0.25rem 0.5rem" }}
                    />
                  </label>
                  <label style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
                    Repeats
                    <select
                      className="bd-input"
                      value={editingEntry.recurrence ?? "none"}
                      onChange={(e) => setEditingEntry((prev) => prev && { ...prev, recurrence: e.target.value })}
                      style={{ marginLeft: "0.35rem", padding: "0.25rem 0.5rem" }}
                    >
                      <option value="none">None</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
                    <input
                      type="checkbox"
                      checked={editingEntry.sendNotification ?? false}
                      onChange={(e) => setEditingEntry((prev) => prev && { ...prev, sendNotification: e.target.checked })}
                    />
                    Send notification
                  </label>
                  {editingEntry.sendNotification && (
                    <label style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", display: "flex", flexDirection: "column", gap: "0.25rem", minWidth: "12rem" }}>
                      Notify before event
                      <select
                        className="bd-input"
                        value={editingEntry.reminderMinutesBefore ?? 30}
                        onChange={(e) =>
                          setEditingEntry((prev) =>
                            prev ? { ...prev, reminderMinutesBefore: Number(e.target.value) } : null
                          )
                        }
                        style={{ padding: "0.25rem 0.5rem" }}
                      >
                        {CALENDAR_NOTIFY_BEFORE_OPTIONS.map((m) => (
                          <option key={m} value={m}>
                            {m === 0 ? "At event time only" : m === 60 ? "1 hour before" : `${m} minutes before`}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap" }}>
              <button
                type="button"
                className="bd-btn bd-btn-danger"
                onClick={() => {
                  if (!confirm(t("items.confirmDeleteEntry"))) return;
                  deleteItem(editingEntry.id, true);
                  setEditingEntry(null);
                }}
                aria-label={t("items.ariaDeleteEntry")}
                title={t("items.ariaDeleteEntry")}
                style={{ minWidth: 44, minHeight: 44, padding: "0.55rem", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M3 6h18" />
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                  <line x1="10" y1="11" x2="10" y2="17" />
                  <line x1="14" y1="11" x2="14" y2="17" />
                </svg>
              </button>
              <div style={{ display: "flex", gap: "0.5rem", marginLeft: "auto" }}>
                <button
                  type="button"
                  className="bd-btn"
                  onClick={() => setEditingEntry(null)}
                  aria-label={t("items.ariaCancelEdit")}
                  title={t("items.ariaCancelEdit")}
                  style={{ minWidth: 44, minHeight: 44, padding: "0.55rem", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="bd-btn bd-btn-primary"
                  onClick={() => {
                    updateEntryContent(editingEntry.id, { title: editingEntry.title, content: editingEntry.content });
                    const currentItem = items.find((i) => i.id === editingEntry.id);
                    if (currentItem?.itemType === "task" && editingEntry.progress) {
                      updateProgress(editingEntry.id, editingEntry.progress, editingEntry.progress);
                    }
                    if (currentItem?.itemType === "calendar") {
                      const rMin = normalizeReminderMinutesBefore(editingEntry.reminderMinutesBefore ?? 0);
                      const dateStr = editingEntry.scheduledAt?.trim();
                      const timeStr = editingEntry.scheduledTime?.trim() || "09:00";
                      let reminderAtIso: string | null = null;
                      if (editingEntry.sendNotification && dateStr) {
                        const dt = localDateTimeToDate(dateStr, timeStr);
                        reminderAtIso = dt ? dt.toISOString() : null;
                      }
                      updateSchedule(editingEntry.id, {
                        scheduledAt: editingEntry.scheduledAt || null,
                        scheduledTime: editingEntry.scheduledTime || null,
                        recurrence: (editingEntry.recurrence === "none" ? null : editingEntry.recurrence) || null,
                        sendNotification: editingEntry.sendNotification ?? false,
                        reminderAt: editingEntry.sendNotification && reminderAtIso ? reminderAtIso : null,
                        reminderMinutesBefore:
                          editingEntry.sendNotification && reminderAtIso ? rMin : null,
                      });
                    }
                    setEditingEntry(null);
                  }}
                  aria-label={t("items.ariaSaveEntry")}
                  title={t("items.ariaSaveEntry")}
                  style={{ minWidth: 44, minHeight: 44, padding: "0.55rem", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {reminderEntry && (
        <div
          className="bd-modal-backdrop"
          onClick={() => setReminderEntry(null)}
        >
          <div
            className="bd-panel bd-modal-panel"
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

      {addEntryOpen && (
        <div
          className="bd-modal-backdrop"
          onClick={() => setAddEntryOpen(false)}
        >
          <div
            className="bd-panel bd-modal-panel"
            style={{ padding: "1.25rem", maxWidth: 480, width: "100%", maxHeight: "90vh", overflow: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 0.75rem", fontSize: "1rem" }}>Add new Entry</h3>
            <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-tertiary)", marginBottom: "0.25rem" }}>Type</label>
            <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
              {addEntryTypeOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className="bd-btn"
                  style={{
                    padding: "0.3rem 0.5rem",
                    fontSize: "0.8125rem",
                    background: addEntryForm.itemType === opt.value ? "var(--bg-hover)" : undefined,
                    borderColor: addEntryForm.itemType === opt.value ? "var(--bd-chrome-selected-border)" : undefined,
                  }}
                  onClick={() => setAddEntryForm((f) => ({ ...f, itemType: opt.value }))}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {mode === "work" && projectsList.length > 0 && (
              <>
                <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-tertiary)", marginBottom: "0.25rem" }}>Project</label>
                <select
                  className="bd-input"
                  value={addEntryForm.projectId ?? ""}
                  onChange={(e) => setAddEntryForm((f) => ({ ...f, projectId: e.target.value || null }))}
                  style={{ width: "100%", marginBottom: "0.75rem", padding: "0.35rem 0.5rem" }}
                >
                  <option value="">No project</option>
                  {projectsList.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </>
            )}
            <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-tertiary)", marginBottom: "0.25rem" }}>Headline</label>
            <input
              className="bd-input"
              value={addEntryForm.title}
              onChange={(e) => setAddEntryForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Title"
              style={{ width: "100%", marginBottom: "0.75rem" }}
              autoFocus
            />
            <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-tertiary)", marginBottom: "0.25rem" }}>Description</label>
            <textarea
              className="bd-textarea"
              value={addEntryForm.content}
              onChange={(e) => setAddEntryForm((f) => ({ ...f, content: e.target.value }))}
              placeholder="Description (optional)"
              style={{ width: "100%", minHeight: 80, marginBottom: "1rem" }}
            />
            {addEntryForm.itemType === "task" && (
              <div style={{ borderTop: "1px solid var(--border-default)", paddingTop: "0.75rem", marginBottom: "1rem" }}>
                <h4 style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", margin: "0 0 0.5rem" }}>Progress</h4>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  {PROGRESS_OPTIONS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      className="bd-btn"
                      style={{
                        padding: "0.35rem 0.6rem",
                        fontSize: "0.8125rem",
                        background: addEntryForm.progress === p ? "var(--bg-hover)" : undefined,
                        borderColor: addEntryForm.progress === p ? "var(--bd-chrome-selected-border)" : undefined,
                      }}
                      onClick={() => setAddEntryForm((f) => ({ ...f, progress: p }))}
                    >
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {addEntryForm.itemType === "calendar" && (
              <div style={{ borderTop: "1px solid var(--border-default)", paddingTop: "0.75rem", marginBottom: "1rem" }}>
                <h4 style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", margin: "0 0 0.5rem" }}>Calendar</h4>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem 1rem", alignItems: "center" }}>
                  <label style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
                    Date
                    <input
                      type="date"
                      className="bd-input"
                      value={addEntryForm.scheduledAt}
                      onChange={(e) => setAddEntryForm((f) => ({ ...f, scheduledAt: e.target.value }))}
                      style={{ marginLeft: "0.35rem", padding: "0.25rem 0.5rem" }}
                    />
                  </label>
                  <label style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
                    Time
                    <input
                      type="time"
                      className="bd-input"
                      value={addEntryForm.scheduledTime}
                      onChange={(e) => setAddEntryForm((f) => ({ ...f, scheduledTime: e.target.value }))}
                      style={{ marginLeft: "0.35rem", padding: "0.25rem 0.5rem" }}
                    />
                  </label>
                  <label style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
                    Repeats
                    <select
                      className="bd-input"
                      value={addEntryForm.recurrence}
                      onChange={(e) => setAddEntryForm((f) => ({ ...f, recurrence: e.target.value }))}
                      style={{ marginLeft: "0.35rem", padding: "0.25rem 0.5rem" }}
                    >
                      <option value="none">None</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
                    <input
                      type="checkbox"
                      checked={addEntryForm.sendNotification}
                      onChange={(e) => setAddEntryForm((f) => ({ ...f, sendNotification: e.target.checked }))}
                    />
                    Send notification
                  </label>
                  {addEntryForm.sendNotification && (
                    <label style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", display: "flex", flexDirection: "column", gap: "0.25rem", minWidth: "12rem" }}>
                      Notify before event
                      <select
                        className="bd-input"
                        value={addEntryForm.reminderMinutesBefore}
                        onChange={(e) =>
                          setAddEntryForm((f) => ({ ...f, reminderMinutesBefore: Number(e.target.value) }))
                        }
                        style={{ padding: "0.25rem 0.5rem" }}
                      >
                        {CALENDAR_NOTIFY_BEFORE_OPTIONS.map((m) => (
                          <option key={m} value={m}>
                            {m === 0 ? "At event time only" : m === 60 ? "1 hour before" : `${m} minutes before`}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
              </div>
            )}
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button type="button" className="bd-btn" onClick={() => setAddEntryOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="bd-btn bd-btn-primary"
                onClick={() => createEntry(addEntryForm)}
                disabled={!addEntryForm.title.trim()}
              >
                Add entry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function CalendarView({
  items,
  showEntryTitles = true,
  onSchedule,
  onEdit,
  onItemContextMenu,
  isMobile = false,
}: {
  items: ViewItem[];
  showEntryTitles?: boolean;
  onSchedule: (id: string, schedule: { scheduledAt?: string | null; scheduledTime?: string | null; recurrence?: string | null; sendNotification?: boolean }) => void;
  onEdit: (item: ViewItem) => void;
  onItemContextMenu?: (e: React.MouseEvent, id: string, domain: string, currentType: string) => void;
  isMobile?: boolean;
}) {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [hoveredCell, setHoveredCell] = useState<number | null>(null);
  const today = new Date();
  const scheduledItems = items.filter((it) => it.scheduledAt || (it.recurrence && it.recurrence !== "none"));
  const firstDay = new Date(month.year, month.month, 1).getDay();
  const startPad = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(month.year, month.month + 1, 0).getDate();
  const totalCells = Math.ceil((startPad + daysInMonth) / 7) * 7;
  const leadingEmpty = startPad;
  const trailingEmpty = totalCells - leadingEmpty - daysInMonth;

  const getItemsForDay = (day: number) => {
    if (day < 1 || day > daysInMonth) return [];
    const dateStr = `${month.year}-${String(month.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const cellDate = new Date(month.year, month.month, day);
    return scheduledItems.filter((it) => {
      const at = it.scheduledAt ? String(it.scheduledAt).slice(0, 10) : null;
      const startDate = at ? new Date(at + "T00:00:00") : null;
      if (it.recurrence === "daily" && startDate) {
        return cellDate.getTime() >= startDate.getTime();
      }
      if (it.recurrence === "weekly" && at) {
        const start = new Date(at + "T00:00:00");
        const diffDays = Math.floor((cellDate.getTime() - start.getTime()) / 86400000);
        return diffDays >= 0 && diffDays % 7 === 0;
      }
      if (it.recurrence === "monthly" && at) {
        const d = new Date(at + "T00:00:00");
        return cellDate.getTime() >= d.getTime() && new Date(month.year, month.month, day).getDate() === new Date(at).getDate();
      }
      return at === dateStr;
    });
  };

  const isToday = (day: number) =>
    month.year === today.getFullYear() && month.month === today.getMonth() && day === today.getDate();

  const prevMonth = () => setMonth((m) => (m.month === 0 ? { year: m.year - 1, month: 11 } : { year: m.year, month: m.month - 1 }));
  const nextMonth = () => setMonth((m) => (m.month === 11 ? { year: m.year + 1, month: 0 } : { year: m.year, month: m.month + 1 }));
  const goToday = () => setMonth({ year: today.getFullYear(), month: today.getMonth() });
  const monthLabel = new Date(month.year, month.month).toLocaleString("default", { month: "long", year: "numeric" });
  const headerDateLabel = new Date(month.year, month.month, 1).toLocaleString("default", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  /* Mobile: short rows so ~6 week rows + header fit without heavy scroll */
  const cellMinH = isMobile ? 44 : 88;
  const maxEventChips = isMobile ? 1 : 3;
  const gridRadius = 0;
  const unscheduledRadius = 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? "0.5rem" : "1rem", flex: 1, minHeight: 0 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? "0.45rem" : "0.75rem" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <h2 style={{ fontSize: isMobile ? "1.05rem" : "1.25rem", fontWeight: 700, color: "var(--text-primary)", margin: 0, letterSpacing: "-0.02em" }}>
              {headerDateLabel}
            </h2>
            <p style={{ fontSize: isMobile ? "0.8125rem" : "0.875rem", color: "var(--text-tertiary)", margin: "0.25rem 0 0" }}>{monthLabel}</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <button type="button" className="bd-btn" onClick={goToday} style={{ padding: "0.4rem 0.65rem", fontSize: "0.8125rem" }}>
              Today
            </button>
            <button type="button" className="bd-btn" onClick={prevMonth} style={{ padding: "0.4rem 0.5rem" }} aria-label="Previous month">
              ‹
            </button>
            <button type="button" className="bd-btn" onClick={nextMonth} style={{ padding: "0.4rem 0.5rem" }} aria-label="Next month">
              ›
            </button>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: "1px",
            background: "var(--border-subtle)",
            borderRadius: gridRadius,
            overflow: "hidden",
            border: "1px solid var(--border-subtle)",
          }}
        >
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              style={{
                fontSize: isMobile ? "0.62rem" : "0.7rem",
                fontWeight: 600,
                color: "var(--text-tertiary)",
                padding: isMobile ? "0.3rem 0.2rem" : "0.5rem 0.35rem",
                textAlign: "center",
                background: "var(--bg-secondary)",
              }}
            >
              {d}
            </div>
          ))}
          {Array.from({ length: totalCells }, (_, i) => {
            const day = i - startPad + 1;
            const isCurrentMonth = day >= 1 && day <= daysInMonth;
            const dayItems = isCurrentMonth ? getItemsForDay(day) : [];
            const cellDateNum = isCurrentMonth ? day : (i < startPad ? new Date(month.year, month.month, 0).getDate() - startPad + i + 1 : i - startPad - daysInMonth + 1);
            const isHovered = hoveredCell === i;
            const isTodayCell = isCurrentMonth && isToday(day);
            return (
              <div
                key={i}
                onMouseEnter={() => setHoveredCell(i)}
                onMouseLeave={() => setHoveredCell(null)}
                style={{
                  minHeight: cellMinH,
                  padding: isMobile ? "0.2rem" : "0.4rem",
                  background: isCurrentMonth ? (isHovered ? "var(--bg-hover)" : "var(--bg-primary)") : "var(--bg-secondary)",
                  boxShadow: isTodayCell && isHovered && isCurrentMonth ? "0 0 0 1px var(--bd-chrome-selected-border), var(--shadow-sm)" : isTodayCell ? "0 0 0 1px var(--bd-chrome-selected-border)" : isHovered && isCurrentMonth ? "var(--shadow-sm)" : "none",
                  transition:
                    "background var(--bd-duration-fast) var(--bd-ease-soft), box-shadow var(--bd-duration-fast) var(--bd-ease-soft)",
                }}
              >
                <div
                  style={{
                    fontSize: isCurrentMonth ? (isMobile ? "0.8rem" : "0.9375rem") : isMobile ? "0.65rem" : "0.75rem",
                    fontWeight: isTodayCell ? 700 : 500,
                    color: isCurrentMonth ? "var(--text-primary)" : "var(--text-quaternary)",
                    marginBottom: isMobile ? "0.15rem" : "0.3rem",
                    lineHeight: 1.2,
                  }}
                >
                  {isCurrentMonth ? day : cellDateNum}
                </div>
                {dayItems.length > 0 && !isMobile && (
                  <div style={{ fontSize: "0.65rem", color: "var(--text-tertiary)", marginBottom: "0.25rem" }}>
                    {dayItems.length} {dayItems.length === 1 ? "item" : "items"}
                  </div>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? "0.15rem" : "0.25rem" }}>
                  {dayItems.slice(0, maxEventChips).map((it) => {
                    const past = it.scheduledAt && new Date(String(it.scheduledAt).slice(0, 10)) < new Date(today.getFullYear(), today.getMonth(), today.getDate());
                    return (
                      <button
                        key={it.id}
                        type="button"
                        onClick={() => onEdit(it)}
                        onContextMenu={onItemContextMenu ? (e) => { e.preventDefault(); onItemContextMenu(e, it.id, it.domain, it.itemType); } : undefined}
                        style={{
                          textAlign: "left",
                          fontSize: isMobile ? "0.6rem" : "0.7rem",
                          padding: isMobile ? "0.15rem 0.3rem" : "0.3rem 0.45rem",
                          background: past ? "var(--bg-tertiary)" : "var(--bd-chrome-selected-bg)",
                          color: past ? "var(--text-tertiary)" : "var(--bd-chrome-selected-text)",
                          border: past ? "none" : "1px solid var(--border-default)",
                          borderRadius: 6,
                          cursor: "pointer",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          boxShadow: "none",
                        }}
                        title={`${it.title}${it.content?.trim() ? ` — ${it.content.trim().slice(0, 200)}` : ""}${it.scheduledTime ? ` ${it.scheduledTime}` : ""}${it.recurrence && it.recurrence !== "none" ? ` (${it.recurrence})` : ""}`}
                      >
                        {it.scheduledTime && <span style={{ marginRight: "0.25rem", opacity: 0.9 }}>{it.scheduledTime}</span>}
                        {entryPrimaryLine(it, showEntryTitles)}
                      </button>
                    );
                  })}
                  {dayItems.length > maxEventChips && (
                    <span style={{ fontSize: isMobile ? "0.58rem" : "0.65rem", color: "var(--text-tertiary)" }}>
                      +{dayItems.length - maxEventChips} more
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div
        style={{
          borderTop: "1px solid var(--border-default)",
          paddingTop: isMobile ? "0.65rem" : "1rem",
          background: "var(--bg-secondary)",
          borderRadius: unscheduledRadius,
          padding: isMobile ? "0.65rem" : "1rem",
        }}
      >
        <h4 style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)", margin: "0 0 0.35rem" }}>Unscheduled</h4>
        <p style={{ fontSize: "0.8125rem", color: "var(--text-tertiary)", margin: 0 }}>
          Edit an entry and set a date (and optional time, repeat, notification) in the Calendar section to show it here.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", marginTop: "0.6rem", maxHeight: 140, overflow: "auto" }}>
          {items.filter((it) => !it.scheduledAt && !it.recurrence).slice(0, 8).map((it, i) => {
            const ep = enterStaggerProps(i);
            return (
            <button
              key={it.id}
              type="button"
              className={`bd-btn ${ep.className}`.trim()}
              style={{
                ...ep.style,
                justifyContent: "flex-start",
                fontSize: "0.8125rem",
                padding: "0.5rem 0.75rem",
                borderRadius: 6,
                background: "var(--bg-tertiary)",
                border: "1px solid var(--border-subtle)",
              }}
              onClick={() => onEdit(it)}
              onContextMenu={onItemContextMenu ? (e) => { e.preventDefault(); onItemContextMenu(e, it.id, it.domain, it.itemType); } : undefined}
              title={!showEntryTitles && it.title ? `${it.title}` : undefined}
            >
              {entryPrimaryLine(it, showEntryTitles)}
            </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function flowSectionLabel(domain: string, sectionKey: string): string {
  if (domain === "work") return sectionKey === "__none" ? "No project" : sectionKey;
  return sectionKey
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

const MINDMAP_BRANCH_PALETTE = ["#8b5cf6", "#22c55e", "#ef4444", "#f97316", "#171717", "#6366f1", "#ec4899", "#0ea5e9"];

function mindmapBranchColor(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return MINDMAP_BRANCH_PALETTE[h % MINDMAP_BRANCH_PALETTE.length]!;
}

const MINDMAP_DOMAIN: Record<"work" | "personal", string> = {
  work: "#2563eb",
  personal: "#a855f7",
};

function MindmapFanDown({ n, colors }: { n: number; colors: string[] }) {
  if (n <= 0) return null;
  const w = 100;
  const h = 38;
  const cx = w / 2;
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="bd-mindmap-fan" aria-hidden>
      {Array.from({ length: n }, (_, i) => {
        const tx = n === 1 ? cx : ((i + 0.5) / n) * w;
        const stroke = colors[i] ?? "var(--border-strong)";
        const d =
          n === 1
            ? `M ${cx} 0 C ${cx} ${h * 0.55}, ${cx} ${h * 0.45}, ${tx} ${h}`
            : `M ${cx} 0 C ${cx} ${h * 0.62}, ${tx} ${h * 0.38}, ${tx} ${h}`;
        return <path key={i} d={d} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />;
      })}
    </svg>
  );
}

function MindmapPill({
  icon,
  label,
  count,
  color,
  onClick,
  expanded,
  variant = "branch",
}: {
  icon: ReactNode;
  label: string;
  count: number;
  color: string;
  onClick?: () => void;
  expanded?: boolean;
  variant?: "root" | "branch";
}) {
  const Cmp = onClick ? "button" : "div";
  const props = onClick ? { type: "button" as const, onClick } : {};
  return (
    <Cmp {...props} className={`bd-mindmap-pill ${variant === "root" ? "bd-mindmap-pill--root" : ""}`}>
      <span className="bd-mindmap-pill-icon" style={{ color }}>
        {icon}
      </span>
      <span className="bd-mindmap-pill-dash" style={{ background: color }} />
      <span className="bd-mindmap-pill-label">{label}</span>
      <span className="bd-mindmap-pill-badge" style={{ background: color }}>
        {count}
      </span>
      {onClick && expanded !== undefined && <span className="bd-mindmap-pill-chevron">{expanded ? "▼" : "▶"}</span>}
    </Cmp>
  );
}

function MindmapView({
  items,
  showEntryTitles = true,
  onEdit,
  onItemContextMenu,
  isMobile = false,
}: {
  items: ViewItem[];
  showEntryTitles?: boolean;
  onEdit: (item: ViewItem) => void;
  onItemContextMenu?: (e: React.MouseEvent, id: string, domain: string, currentType: string) => void;
  isMobile?: boolean;
}) {
  const { t } = useI18n();
  const [collapsedDomains, setCollapsedDomains] = useState<Set<string>>(new Set());
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [collapsedTypes, setCollapsedTypes] = useState<Set<string>>(new Set());

  const toggleDomain = (key: string) =>
    setCollapsedDomains((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  const toggleSection = (key: string) =>
    setCollapsedSections((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  const toggleType = (key: string) =>
    setCollapsedTypes((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });

  const workItems = items.filter((it) => it.domain === "work");
  const personalItems = items.filter((it) => it.domain === "personal");

  const workSections = (() => {
    const byProject = new Map<string, ViewItem[]>();
    for (const it of workItems) {
      const key = it.project?.id ?? "__none";
      if (!byProject.has(key)) byProject.set(key, []);
      byProject.get(key)!.push(it);
    }
    return Array.from(byProject.entries()).map(([id, list]) => ({
      key: id,
      label: id === "__none" ? t("items.flowchartNoProject") : (list[0]?.project?.name ?? id),
      items: list,
    }));
  })();

  const personalSections = (() => {
    const byCategory = new Map<string, ViewItem[]>();
    for (const it of personalItems) {
      const key = it.category || "__none";
      if (!byCategory.has(key)) byCategory.set(key, []);
      byCategory.get(key)!.push(it);
    }
    return Array.from(byCategory.entries()).map(([key, list]) => ({
      key,
      label: flowSectionLabel("personal", key),
      items: list,
    }));
  })();

  const groupByType = (list: ViewItem[]) => {
    const byType = new Map<string, ViewItem[]>();
    for (const it of list) {
      const ty = it.itemType || "note";
      if (!byType.has(ty)) byType.set(ty, []);
      byType.get(ty)!.push(it);
    }
    return Array.from(byType.entries()).map(([type, entries]) => ({ type, entries }));
  };

  const iconBriefcase = (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
    </svg>
  );
  const iconUser = (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
  const iconRoot = (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );

  const renderEntry = (it: ViewItem, index: number) => {
    const ep = enterStaggerProps(index);
    const barColor = TYPE_BAR_COLORS[it.itemType] ?? TYPE_BAR_COLORS.default;
    const isNew = isNewEntry(it);
    return (
      <button
        key={it.id}
        type="button"
        className={`bd-mindmap-entry ${ep.className}`.trim()}
        style={{
          ...ep.style,
          borderLeft: `3px solid ${barColor}`,
          position: "relative",
        }}
        onClick={() => onEdit(it)}
        onContextMenu={onItemContextMenu ? (e) => { e.preventDefault(); onItemContextMenu(e, it.id, it.domain, it.itemType); } : undefined}
      >
        {isNew && (
          <span
            style={{
              position: "absolute",
              top: 6,
              right: 8,
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "var(--text-primary)",
              boxShadow: "0 0 6px rgba(255,255,255,0.25)",
            }}
            aria-hidden
          />
        )}
        <span className="bd-mindmap-entry-type">
          <EntryTypeIcon type={it.itemType} size={14} />
        </span>
        <span className="bd-mindmap-entry-text">
          {entryPrimaryLine(it, showEntryTitles)}
          {showEntryTitles && it.content?.trim() && (
            <span style={{ display: "block", fontSize: "0.72rem", color: "var(--text-tertiary)", marginTop: "0.15rem" }}>
              {it.content.slice(0, 48)}
              {it.content.length > 48 ? "…" : ""}
            </span>
          )}
        </span>
      </button>
    );
  };

  const renderTypeBlock = (domain: string, sectionKey: string, type: string, entries: ViewItem[]) => {
    const typeKey = `${domain}:${sectionKey}:${type}`;
    const isCollapsed = collapsedTypes.has(typeKey);
    const label = formatTypeLabel(type);
    const typeColor = TYPE_BAR_COLORS[type] ?? TYPE_BAR_COLORS.default;
    return (
      <div key={typeKey} className="bd-mindmap-type-col" style={{ ["--bd-mindmap-branch" as string]: typeColor }}>
        <MindmapPill
          icon={<EntryTypeIcon type={type} size={16} />}
          label={label}
          count={entries.length}
          color={typeColor}
          onClick={() => toggleType(typeKey)}
          expanded={!isCollapsed}
        />
        {!isCollapsed && <div className="bd-mindmap-entries">{entries.map((it, idx) => renderEntry(it, idx))}</div>}
      </div>
    );
  };

  const renderSection = (domain: string, sectionKey: string, label: string, sectionItems: ViewItem[]) => {
    const sectionId = `${domain}:${sectionKey}`;
    const isCollapsed = collapsedSections.has(sectionId);
    const byType = groupByType(sectionItems);
    const branchColor = mindmapBranchColor(sectionId);
    const typeColors = byType.map(({ type }) => TYPE_BAR_COLORS[type] ?? TYPE_BAR_COLORS.default);
    return (
      <div key={sectionId} className="bd-mindmap-section">
        <MindmapPill
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={branchColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
          }
          label={label}
          count={sectionItems.length}
          color={branchColor}
          onClick={() => toggleSection(sectionId)}
          expanded={!isCollapsed}
        />
        {!isCollapsed && byType.length > 0 && (
          <>
            <MindmapFanDown n={byType.length} colors={typeColors} />
            <div className="bd-mindmap-types-row">
              {byType.map(({ type, entries }) => renderTypeBlock(domain, sectionKey, type, entries))}
            </div>
          </>
        )}
      </div>
    );
  };

  const renderDomainMindmap = (
    domain: "work" | "personal",
    label: string,
    sections: { key: string; label: string; items: ViewItem[] }[],
  ) => {
    const color = MINDMAP_DOMAIN[domain];
    const isCollapsed = collapsedDomains.has(domain);
    const total = sections.reduce((s, sec) => s + sec.items.length, 0);
    const filled = sections.filter((s) => s.items.length > 0);
    const sectionColors = filled.map((s) => mindmapBranchColor(`${domain}:${s.key}`));
    return (
      <div className="bd-mindmap-domain" key={domain}>
        <MindmapPill
          icon={domain === "work" ? iconBriefcase : iconUser}
          label={label}
          count={total}
          color={color}
          onClick={() => toggleDomain(domain)}
          expanded={!isCollapsed}
        />
        {!isCollapsed && filled.length > 0 && (
          <>
            <MindmapFanDown n={filled.length} colors={sectionColors} />
            <div className="bd-mindmap-sections-row">{filled.map((sec) => renderSection(domain, sec.key, sec.label, sec.items))}</div>
          </>
        )}
      </div>
    );
  };

  const hasWork = workSections.some((s) => s.items.length > 0);
  const hasPersonal = personalSections.some((s) => s.items.length > 0);
  const domainColorsList: string[] = [];
  if (hasWork) domainColorsList.push(MINDMAP_DOMAIN.work);
  if (hasPersonal) domainColorsList.push(MINDMAP_DOMAIN.personal);
  const rootColor = "var(--accent)";

  return (
    <div className="bd-mindmap" style={{ padding: isMobile ? "0.65rem" : "1.25rem 1.5rem 1.75rem" }}>
      {items.length === 0 ? (
        <p style={{ color: "var(--text-tertiary)", fontSize: "0.875rem" }}>{t("items.flowchartEmpty")}</p>
      ) : (
        <div className="bd-mindmap-chart">
          <div className="bd-mindmap-level bd-mindmap-level--root">
            <MindmapPill variant="root" icon={iconRoot} label={t("items.mindmapRoot")} count={items.length} color={rootColor} />
          </div>
          {domainColorsList.length > 0 && <MindmapFanDown n={domainColorsList.length} colors={domainColorsList} />}
          <div className="bd-mindmap-domains-row">
            {hasWork && renderDomainMindmap("work", t("items.flowchartWork"), workSections)}
            {hasPersonal && renderDomainMindmap("personal", t("items.flowchartPersonal"), personalSections)}
          </div>
        </div>
      )}
    </div>
  );
}

const LIST_VIEW_TYPE_ORDER = ["task", "note", "idea", "calendar", "reflection", "emotion"];

function ListView({
  items,
  showEntryTitles = true,
  onProgress,
  onDelete,
  onItemContextMenu,
  onEdit,
}: {
  items: ViewItem[];
  showEntryTitles?: boolean;
  onProgress: (id: string, progress: string) => void;
  onDelete: (id: string, skipConfirm?: boolean) => void;
  onItemContextMenu?: (e: React.MouseEvent, id: string, domain: string, currentType: string) => void;
  onEdit?: (item: ViewItem) => void;
}) {
  const byType = new Map<string, ViewItem[]>();
  for (const it of items) {
    const t = it.itemType || "note";
    if (!byType.has(t)) byType.set(t, []);
    byType.get(t)!.push(it);
  }
  const typesInUse = [...LIST_VIEW_TYPE_ORDER.filter((t) => byType.has(t)), ...Array.from(byType.keys()).filter((t) => !LIST_VIEW_TYPE_ORDER.includes(t))];

  const renderEntry = (it: ViewItem, index: number) => {
    const ep = enterStaggerProps(index);
    const barColor = TYPE_BAR_COLORS[it.itemType] ?? TYPE_BAR_COLORS.default;
    const scheduleLabel = (it.itemType === "calendar" || it.scheduledAt || (it.recurrence && it.recurrence !== "none")) ? formatCalendarScheduleLabel(it) : null;
    return (
      <div
        key={it.id}
        className={ep.className}
        onDoubleClick={() => onEdit?.(it)}
        onContextMenu={onItemContextMenu ? (e) => { e.preventDefault(); onItemContextMenu(e, it.id, it.domain, it.itemType); } : undefined}
        style={{
          ...ep.style,
          display: "flex",
          alignItems: "stretch",
          minHeight: 72,
          minWidth: 0,
          border: "1px solid var(--border-default)",
          borderRadius: "20px",
          background: "var(--bg-elevated)",
          cursor: onEdit ? "pointer" : undefined,
          boxShadow: "var(--shadow-sm)",
          overflow: "hidden",
        }}
      >
        <div style={{ width: 4, flexShrink: 0, background: barColor }} />
        <div style={{ flex: 1, minWidth: 0, padding: "0.75rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.06em", color: "var(--text-tertiary)", display: "flex", alignItems: "center", gap: "0.35rem" }}>
              <EntryTypeIcon type={it.itemType} size={14} />
              {`${entryContextLabel(it) || entryTypeLabel(it.itemType)}: ${entryTypeLabel(it.itemType)}`}
            </span>
            {onItemContextMenu && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); e.preventDefault(); onItemContextMenu(e, it.id, it.domain, it.itemType); }}
                style={{
                  padding: "0.2rem",
                  border: "none",
                  background: "none",
                  color: "var(--text-tertiary)",
                  cursor: "pointer",
                  borderRadius: 4,
                }}
                aria-label="More actions"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="6" r="1.5" />
                  <circle cx="12" cy="12" r="1.5" />
                  <circle cx="12" cy="18" r="1.5" />
                </svg>
              </button>
            )}
          </div>
          {showEntryTitles && (
            <div style={{ fontWeight: 600, fontSize: "0.9375rem", color: "var(--text-primary)", wordBreak: "break-word", overflowWrap: "anywhere" }}>{it.title}</div>
          )}
          <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", wordBreak: "break-word", overflowWrap: "anywhere" }}>
            {it.content?.trim() || "—"}
          </div>
          {scheduleLabel && (
            <div style={{ fontSize: "0.7rem", color: "var(--text-tertiary)", marginTop: "0.15rem" }}>
              {scheduleLabel}
            </div>
          )}
          {it.itemType === "task" && (
            <select
              className="bd-input"
              value={it.progress || "todo"}
              onChange={(e) => onProgress(it.id, e.target.value)}
              onClick={(e) => e.stopPropagation()}
              style={{ width: "auto", minWidth: "6rem", marginTop: "0.25rem", fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
            >
              {PROGRESS_OPTIONS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      className="bd-list-view"
      style={{
        display: "flex",
        flexDirection: "row",
        gap: "1rem",
        overflow: "auto",
        alignContent: "start",
        alignItems: "flex-start",
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        boxSizing: "border-box",
      }}
    >
      {typesInUse.map((type) => {
        const typeItems = byType.get(type) ?? [];
        const typeColor = TYPE_BAR_COLORS[type] ?? TYPE_BAR_COLORS.default;
        return (
          <div
            key={type}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
              minWidth: 280,
              maxWidth: 360,
              flex: "0 0 auto",
            }}
          >
            <div
              style={{
                padding: "0.5rem 0.75rem",
                borderRadius: "var(--card-radius)",
                background: "var(--bg-elevated)",
                border: `1.5px solid ${typeColor}`,
                color: typeColor,
                fontSize: "0.8125rem",
                fontWeight: 600,
                textAlign: "center",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.35rem",
              }}
            >
              <EntryTypeIcon type={type} size={14} />
              {formatTypeLabel(type)} ({typeItems.length})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {typeItems.map((it, idx) => renderEntry(it, idx))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TextView({
  items,
  showEntryTitles = true,
  onUpdate,
  onItemContextMenu,
}: {
  items: ViewItem[];
  showEntryTitles?: boolean;
  onUpdate: (id: string, updates: { title?: string; content?: string }) => void;
  onItemContextMenu?: (e: React.MouseEvent, id: string, domain: string, currentType: string) => void;
}) {
  const [editing, setEditing] = useState<{ id: string; field: "title" | "content"; value: string } | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!editing) return;
    if (editing.field === "title") inputRef.current?.focus();
    else textareaRef.current?.focus();
  }, [editing]);

  useEffect(() => {
    if (!showEntryTitles && editing?.field === "title") setEditing(null);
  }, [showEntryTitles, editing?.field]);

  const handleBlur = (id: string, field: "title" | "content", value: string, current: string) => {
    const trimmed = value.trim();
    if (trimmed !== current) {
      if (field === "title") onUpdate(id, { title: trimmed || current });
      else onUpdate(id, { content: trimmed });
    }
    setEditing(null);
  };

  return (
    <div
      className="bd-text-view"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.65rem",
        overflow: "auto",
        paddingBottom: "0.5rem",
        maxWidth: 720,
        width: "100%",
        minWidth: 0,
        boxSizing: "border-box",
      }}
    >
      {items.map((it, i) => {
        const ep = enterStaggerProps(i);
        const isEditingTitle = editing?.id === it.id && editing?.field === "title";
        const isEditingContent = editing?.id === it.id && editing?.field === "content";
        const barColor = TYPE_BAR_COLORS[it.itemType] ?? TYPE_BAR_COLORS.default;
        const isNew = isNewEntry(it);
        return (
          <div
            key={it.id}
            className={ep.className}
            style={{
              ...ep.style,
              display: "flex",
              flexDirection: "row",
              background: "transparent",
              gap: "0.45rem",
            }}
          >
            <div style={{ width: 4, borderRadius: 999, background: barColor, flexShrink: 0 }} />
            <article
              onContextMenu={onItemContextMenu ? (e) => { e.preventDefault(); onItemContextMenu(e, it.id, it.domain, it.itemType); } : undefined}
              style={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                gap: "0.3rem",
                padding: "0.35rem 0",
                background: "transparent",
                borderRadius: 0,
                boxShadow: "none",
                border: "none",
                position: "relative",
              }}
            >
            {isNew && (
              <span
                style={{
                  position: "absolute",
                  top: 0,
                  right: 0,
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "var(--text-primary)",
                  boxShadow: "0 0 6px rgba(255,255,255,0.25)",
                }}
                aria-hidden
              />
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.1rem" }}>
              <span style={{ fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.06em", color: "var(--text-tertiary)", lineHeight: 1.2 }}>
                {`${entryContextLabel(it) || entryTypeLabel(it.itemType)}: ${entryTypeLabel(it.itemType)}`}
              </span>
              {showEntryTitles &&
                (isEditingTitle ? (
                  <input
                    ref={inputRef}
                    type="text"
                    value={editing?.value ?? it.title}
                    onChange={(e) => setEditing((prev) => (prev ? { ...prev, value: e.target.value } : null))}
                    onBlur={() => editing && handleBlur(it.id, "title", editing.value, it.title)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    }}
                    style={{
                      flex: 1,
                      margin: 0,
                      fontSize: "1.125rem",
                      fontWeight: 600,
                      color: "var(--text-primary)",
                      padding: "0.1rem 0",
                      lineHeight: 1.28,
                      minHeight: "1.45rem",
                      background: "transparent",
                      border: "none",
                      outline: "none",
                    }}
                  />
                ) : (
                  <h2
                    onClick={() => setEditing({ id: it.id, field: "title", value: it.title })}
                    style={{
                      flex: 1,
                      margin: 0,
                      fontSize: "1.125rem",
                      fontWeight: 600,
                      color: "var(--text-primary)",
                      cursor: "text",
                      padding: "0.1rem 0",
                      lineHeight: 1.28,
                      minHeight: "1.45rem",
                    }}
                  >
                    {it.title || "Untitled"}
                  </h2>
                ))}
            </div>
            {isEditingContent ? (
              <textarea
                ref={textareaRef}
                value={editing?.value ?? it.content ?? ""}
                onChange={(e) => setEditing((prev) => prev ? { ...prev, value: e.target.value } : null)}
                onBlur={() => editing && handleBlur(it.id, "content", editing.value, it.content ?? "")}
                rows={4}
                style={{
                  width: "100%",
                  margin: 0,
                  resize: "vertical",
                  fontSize: "0.875rem",
                  lineHeight: 1.4,
                  color: "var(--text-secondary)",
                  padding: "0.12rem 0",
                  minHeight: 72,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                }}
              />
            ) : (
              <p
                onClick={() => setEditing({ id: it.id, field: "content", value: it.content ?? "" })}
                style={{
                  margin: 0,
                  fontSize: "0.875rem",
                  lineHeight: 1.38,
                  color: "var(--text-secondary)",
                  cursor: "text",
                  padding: "0.08rem 0 0",
                  minHeight: "1.25em",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {it.content?.trim() || "Click to add description…"}
              </p>
            )}
          </article>
          </div>
        );
      })}
    </div>
  );
}

const KANBAN_COLUMNS: { key: string; label: string }[] = [
  { key: "todo", label: "To do" },
  { key: "started", label: "Started" },
  { key: "completed", label: "Completed" },
];

function KanbanView({
  items,
  showEntryTitles = true,
  onProgress,
  onItemContextMenu,
  onEdit,
  isMobile = false,
}: {
  items: ViewItem[];
  showEntryTitles?: boolean;
  onProgress: (id: string, progress: string, kanbanColumn?: string) => void;
  onDelete: (id: string, skipConfirm?: boolean) => void;
  onItemContextMenu?: (e: React.MouseEvent, id: string, domain: string, currentType: string) => void;
  onEdit?: (item: ViewItem) => void;
  isMobile?: boolean;
}) {
  const { t } = useI18n();
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const draggedIdRef = useRef<string | null>(null);
  const dragOverColumnRef = useRef<string | null>(null);
  const kanbanContainerRef = useRef<HTMLDivElement | null>(null);
  dragOverColumnRef.current = dragOverColumn;
  const taskItems = items.filter((it) => it.itemType === "task");
  const byColumn = KANBAN_COLUMNS.map((col) => ({
    ...col,
    items: taskItems.filter((it) => (it.progress || it.kanbanColumn || "todo") === col.key),
  }));

  const applyDrop = useCallback(
    (id: string, columnKey: string) => {
      onProgress(id, columnKey, columnKey);
      draggedIdRef.current = null;
      setDraggedId(null);
      setDragOverColumn(null);
    },
    [onProgress]
  );

  useEffect(() => {
    const onWindowDrop = (e: DragEvent) => {
      const id = draggedIdRef.current;
      const column = dragOverColumnRef.current;
      if (!id || !column) return;
      if (kanbanContainerRef.current && kanbanContainerRef.current.contains(e.target as Node)) return;
      e.preventDefault();
      e.stopPropagation();
      applyDrop(id, column);
    };
    const onWindowDragEnd = () => {
      draggedIdRef.current = null;
      setDraggedId(null);
      setDragOverColumn(null);
    };
    window.addEventListener("drop", onWindowDrop, true);
    window.addEventListener("dragend", onWindowDragEnd, true);
    return () => {
      window.removeEventListener("drop", onWindowDrop, true);
      window.removeEventListener("dragend", onWindowDragEnd, true);
    };
  }, [applyDrop]);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
    draggedIdRef.current = id;
    setDraggedId(id);
  };
  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverColumn(null);
  };
  const handleDragOver = (e: React.DragEvent, columnKey: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    setDragOverColumn(columnKey);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    if (!(e.currentTarget as Node).contains((e.relatedTarget as Node))) setDragOverColumn(null);
  };
  const handleDrop = (e: React.DragEvent, columnKey: string) => {
    e.preventDefault();
    e.stopPropagation();
    const id = e.dataTransfer.getData("text/plain") || draggedIdRef.current;
    if (id) {
      applyDrop(id, columnKey);
    } else {
      setDragOverColumn(null);
    }
  };

  return (
    <div
      ref={kanbanContainerRef}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--bd-space-3, 0.75rem)",
        flex: 1,
        minHeight: 200,
        width: "100%",
      }}
    >
      {taskItems.length === 0 && items.length > 0 && (
        <p style={{ fontSize: "0.8125rem", color: "var(--text-tertiary)", margin: 0 }}>
          {t("items.kanbanNote")}
        </p>
      )}
      <div
        style={{
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          alignItems: "stretch",
          gap: isMobile ? "var(--bd-space-3, 0.75rem)" : "var(--bd-space-4, 1rem)",
          overflow: isMobile ? "visible" : "auto",
          flex: 1,
          width: "100%",
          maxWidth: "100%",
          minWidth: 0,
          boxSizing: "border-box",
        }}
      >
      {byColumn.map((col) => (
        <div
          key={col.key}
          onDragOver={(e) => handleDragOver(e, col.key)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, col.key)}
          style={{
            flex: isMobile ? "0 0 auto" : "1 1 0",
            minWidth: isMobile ? 0 : 0,
            width: isMobile ? "100%" : undefined,
            maxWidth: "100%",
            minHeight: 120,
            background: dragOverColumn === col.key ? "var(--bg-hover)" : "var(--bg-secondary)",
            borderRadius: 0,
            padding: "var(--bd-space-4, 1rem)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--bd-space-3, 0.75rem)",
            border: dragOverColumn === col.key ? "2px dashed var(--bd-chrome-selected-border)" : "2px solid transparent",
            transition:
              "background var(--bd-duration-fast) var(--bd-ease-soft), border-color var(--bd-duration-fast) var(--bd-ease-soft)",
          }}
        >
          <h4
            style={{
              fontSize: "0.8125rem",
              fontWeight: 600,
              color: "var(--text-secondary)",
              margin: 0,
              paddingBottom: "var(--bd-space-1, 0.25rem)",
              lineHeight: 1.3,
            }}
          >
            {col.label}
          </h4>
          {col.items.map((it, idx) => {
            const ep = enterStaggerProps(idx);
            return (
            <div
              key={it.id}
              className={ep.className}
              draggable
              onDragStart={(e) => handleDragStart(e, it.id)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => handleDragOver(e, col.key)}
              onDrop={(e) => handleDrop(e, col.key)}
              onDoubleClick={() => onEdit?.(it)}
              onContextMenu={onItemContextMenu ? (e) => { e.preventDefault(); onItemContextMenu(e, it.id, it.domain, it.itemType); } : undefined}
              style={{
                ...ep.style,
                padding: "0.65rem 0.85rem",
                background: "var(--bg-tertiary)",
                border: "1px solid var(--border-default)",
                borderRadius: "12px",
                cursor: "grab",
                opacity: draggedId === it.id ? 0.6 : 1,
              }}
            >
              {showEntryTitles && <div style={{ fontWeight: 600, fontSize: "0.875rem", lineHeight: 1.35 }}>{it.title}</div>}
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "var(--text-secondary)",
                  marginTop: showEntryTitles ? "0.35rem" : 0,
                  lineHeight: 1.45,
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {it.content?.trim() || "—"}
              </div>
              <div
                style={{
                  fontSize: "0.65rem",
                  color: "var(--text-tertiary)",
                  marginTop: "0.4rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.35rem",
                }}
              >
                <EntryTypeIcon type={it.itemType} size={12} />
                {`${entryContextLabel(it) || entryTypeLabel(it.itemType)}: ${entryTypeLabel(it.itemType)}`}
              </div>
            </div>
            );
          })}
        </div>
      ))}
      </div>
    </div>
  );
}

const CARD_WIDTH = 180;
const CARD_HEIGHT = 160;
const PAD = 16;

const POSTIT_COLORS: Record<string, string> = {
  task: "#f59e0b",
  note: "#3b82f6",
  idea: "#8b5cf6",
  emotion: "#ec4899",
  reflection: "#06b6d4",
  reminder: "#10b981",
  default: "#6b7280",
};

function PostitsView({
  items,
  showEntryTitles = true,
  onProgress,
  onDelete,
  onPosition,
  postitPositions,
  setPostitPositions,
  onItemContextMenu,
  onEdit,
  lineToolActive,
  links,
  onAddLink,
  onRemoveLink,
}: {
  items: ViewItem[];
  showEntryTitles?: boolean;
  onProgress: (id: string, progress: string) => void;
  onDelete: (id: string, skipConfirm?: boolean) => void;
  onPosition: (id: string, x: number, y: number) => void;
  postitPositions: Record<string, { x: number; y: number }>;
  setPostitPositions: React.Dispatch<React.SetStateAction<Record<string, { x: number; y: number }>>>;
  onItemContextMenu?: (e: React.MouseEvent, id: string, domain: string, currentType: string) => void;
  onEdit?: (item: ViewItem) => void;
  lineToolActive: boolean;
  links: { fromId: string; toId: string }[];
  onAddLink: (fromId: string, toId: string) => void;
  onRemoveLink: (fromId: string, toId: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [dragState, setDragState] = useState<{ id: string; startX: number; startY: number; itemX: number; itemY: number } | null>(null);
  const [linkFrom, setLinkFrom] = useState<{ id: string; x: number; y: number } | null>(null);
  const [linkPreview, setLinkPreview] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      if (el) {
        const { width, height } = el.getBoundingClientRect();
        setContainerSize({ width, height });
      }
    };
    const ro = new ResizeObserver(update);
    ro.observe(el);
    update();
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    setPostitPositions((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const it of items) {
        const p = next[it.id];
        if (p != null && it.positionX === p.x && it.positionY === p.y) {
          delete next[it.id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [items, setPostitPositions]);

  const getPosition = (it: ViewItem) => {
    const def = { x: 0, y: 0 };
    if (it.positionX != null && it.positionY != null) return { x: it.positionX, y: it.positionY };
    const i = items.indexOf(it);
    const row = Math.floor(i / 4);
    const col = i % 4;
    return { x: col * (CARD_WIDTH + PAD), y: row * (CARD_HEIGHT + PAD) };
  };

  const getCenter = (it: ViewItem) => {
    const { x, y } = getPosition(it);
    const drag = postitPositions[it.id];
    const px = drag ? drag.x : x;
    const py = drag ? drag.y : y;
    return { x: px + CARD_WIDTH / 2, y: py + CARD_HEIGHT / 2 };
  };

  const clientToBoard = (clientX: number, clientY: number) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: clientX - rect.left + containerRef.current.scrollLeft,
      y: clientY - rect.top + containerRef.current.scrollTop,
    };
  };

  const handleMouseDown = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    if (lineToolActive) {
      const pos = items.find((it) => it.id === id);
      if (!pos) return;
      const c = getCenter(pos);
      setLinkFrom({ id, x: c.x, y: c.y });
      setLinkPreview(c);
      return;
    }
    const pos = items.find((it) => it.id === id);
    if (!pos) return;
    const { x, y } = getPosition(pos);
    setDragState({ id, startX: e.clientX, startY: e.clientY, itemX: x, itemY: y });
  };

  useEffect(() => {
    if (!dragState) return;
    const handleMove = (e: MouseEvent) => {
      const dx = e.clientX - dragState.startX;
      const dy = e.clientY - dragState.startY;
      setPostitPositions((prev) => ({
        ...prev,
        [dragState.id]: { x: Math.max(0, dragState.itemX + dx), y: Math.max(0, dragState.itemY + dy) },
      }));
    };
    const handleUp = (e: MouseEvent) => {
      const dx = e.clientX - dragState.startX;
      const dy = e.clientY - dragState.startY;
      const newX = Math.max(0, dragState.itemX + dx);
      const newY = Math.max(0, dragState.itemY + dy);
      setPostitPositions((prev) => ({ ...prev, [dragState.id]: { x: newX, y: newY } }));
      onPosition(dragState.id, newX, newY);
      setDragState(null);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [dragState, onPosition]);

  useEffect(() => {
    if (!linkFrom) return;
    const handleMove = (e: MouseEvent) => setLinkPreview(clientToBoard(e.clientX, e.clientY));
    const handleUp = (e: MouseEvent) => {
      const target = document.elementFromPoint(e.clientX, e.clientY);
      const card = target?.closest("[data-postit-id]");
      const toId = card?.getAttribute("data-postit-id");
      if (toId && toId !== linkFrom.id) onAddLink(linkFrom.id, toId);
      setLinkFrom(null);
      setLinkPreview(null);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [linkFrom, onAddLink]);

  const minBoardWidth = CARD_WIDTH + PAD * 2;
  const minBoardHeightFromCards = CARD_HEIGHT + PAD * 2;
  const boardWidthFromCards = Math.max(
    minBoardWidth,
    ...items.map((it) => {
      const { x } = getPosition(it);
      const d = postitPositions[it.id];
      return (d ? d.x : x) + CARD_WIDTH + PAD;
    })
  );
  const boardHeightFromCards = Math.max(
    minBoardHeightFromCards,
    ...items.map((it) => {
      const { y } = getPosition(it);
      const d = postitPositions[it.id];
      return (d ? d.y : y) + CARD_HEIGHT + PAD;
    })
  );
  const boardWidth = Math.max(boardWidthFromCards, containerSize.width || 400);
  const boardHeight = Math.max(boardHeightFromCards, containerSize.height || 400);

  const idToCenter = (id: string) => {
    const it = items.find((i) => i.id === id);
    if (!it) return null;
    return getCenter(it);
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        minHeight: 0,
        flex: 1,
        overflow: "auto",
        background: "var(--bg-primary)",
        borderRadius: 0,
      }}
      onMouseLeave={() => {
        if (dragState) setDragState(null);
        if (linkFrom) {
          setLinkFrom(null);
          setLinkPreview(null);
        }
      }}
    >
      <div style={{ position: "relative", width: boardWidth, height: boardHeight, minHeight: boardHeight }}>
        <svg
          style={{ position: "absolute", left: 0, top: 0, width: boardWidth, height: boardHeight, pointerEvents: "none", zIndex: 0 }}
          viewBox={`0 0 ${boardWidth} ${boardHeight}`}
          preserveAspectRatio="none"
        >
          <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="var(--text-tertiary)" />
            </marker>
          </defs>
          {links.map(({ fromId, toId }) => {
            const from = idToCenter(fromId);
            const to = idToCenter(toId);
            if (!from || !to) return null;
            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const len = Math.hypot(dx, dy) || 1;
            const shorten = Math.min(20, len / 2);
            const endX = to.x - (dx / len) * shorten;
            const endY = to.y - (dy / len) * shorten;
            const startX = from.x + (dx / len) * (CARD_WIDTH / 2 + 4);
            const startY = from.y + (dy / len) * (CARD_HEIGHT / 2 + 4);
            return (
              <line
                key={`${fromId}-${toId}`}
                x1={startX}
                y1={startY}
                x2={endX}
                y2={endY}
                stroke="var(--text-tertiary)"
                strokeWidth="2"
                markerEnd="url(#arrowhead)"
              />
            );
          })}
          {linkFrom && linkPreview && (
            <line
              x1={linkFrom.x}
              y1={linkFrom.y}
              x2={linkPreview.x}
              y2={linkPreview.y}
              stroke="var(--text-tertiary)"
              strokeWidth="2"
              strokeDasharray="6 4"
              markerEnd="url(#arrowhead)"
            />
          )}
        </svg>
        {items.map((it, i) => {
          const ep = enterStaggerProps(i);
          const base = getPosition(it);
          const drag = postitPositions[it.id];
          const x = drag ? drag.x : base.x;
          const y = drag ? drag.y : base.y;
          const barColor = POSTIT_COLORS[it.itemType] ?? POSTIT_COLORS.default;
          return (
            <div
              key={it.id}
              data-postit-id={it.id}
              className={ep.className}
              onMouseDown={(e) => handleMouseDown(e, it.id)}
              onDoubleClick={() => onEdit?.(it)}
              onContextMenu={onItemContextMenu ? (e) => { e.preventDefault(); onItemContextMenu(e, it.id, it.domain, it.itemType); } : undefined}
              style={{
                ...ep.style,
                position: "absolute",
                left: x,
                top: y,
                width: CARD_WIDTH,
                minHeight: CARD_HEIGHT,
                zIndex: 1,
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-default)",
                borderRadius: 6,
                boxShadow: "0 4px 12px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.06)",
                cursor: lineToolActive ? "crosshair" : dragState?.id === it.id ? "grabbing" : "grab",
                userSelect: "none",
                display: "flex",
                flexDirection: "row",
                overflow: "hidden",
                transition:
                  dragState?.id === it.id
                    ? "box-shadow var(--bd-duration-normal) var(--bd-ease-soft)"
                    : "none",
                ...(dragState?.id === it.id ? { boxShadow: "0 8px 24px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.08)" } : {}),
              }}
            >
              <div style={{ width: 4, flexShrink: 0, background: barColor }} />
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.5rem 0.75rem 0.25rem", gap: "0.5rem" }}>
                  <span style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.06em", color: "var(--text-tertiary)" }}>
                    {`${entryContextLabel(it) || entryTypeLabel(it.itemType)}: ${entryTypeLabel(it.itemType)}`}
                  </span>
                  {onItemContextMenu && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); e.preventDefault(); onItemContextMenu(e, it.id, it.domain, it.itemType); }}
                      style={{ padding: "0.2rem", border: "none", background: "none", color: "var(--text-tertiary)", cursor: "pointer", borderRadius: 4 }}
                      aria-label="More actions"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="6" r="1.5" />
                        <circle cx="12" cy="12" r="1.5" />
                        <circle cx="12" cy="18" r="1.5" />
                      </svg>
                    </button>
                  )}
                </div>
                <div style={{ flex: 1, padding: "0 0.75rem 0.5rem", minHeight: 0 }}>
                  {showEntryTitles && (
                    <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--text-primary)", marginBottom: "0.25rem", lineHeight: 1.3 }}>
                      {it.title}
                    </div>
                  )}
                  <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {it.content?.trim() || "—"}
                  </div>
                </div>
                {it.itemType === "task" && (
                  <div style={{ padding: "0 0.75rem 0.5rem" }}>
                    <select
                      className="bd-input"
                      value={it.progress || "todo"}
                      onChange={(e) => onProgress(it.id, e.target.value)}
                      style={{ width: "100%", fontSize: "0.7rem", padding: "0.25rem 0.5rem" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {PROGRESS_OPTIONS.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
