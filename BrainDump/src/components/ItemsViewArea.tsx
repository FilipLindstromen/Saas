"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type DragEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type SetStateAction,
} from "react";
import { createPortal } from "react-dom";
import {
  AlarmClock,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  CircleCheckBig,
  EllipsisVertical,
  FileText,
  GripVertical,
  Heart,
  Info,
  Lightbulb,
  RefreshCw,
  Search,
  ShoppingCart,
  SquareCheckBig,
  Trash2,
  X,
} from "lucide-react";
import {
  BRAINDUMP_CLIENT_PREFS_APPLIED_EVENT,
  scheduleClientPreferencesUpload,
} from "@/lib/client-preferences-sync";
import { useI18n } from "@/lib/i18n";
import { playTaskCompleteCheer } from "@/lib/task-complete-sound";
import { emitGamificationFromResponseBody } from "@/lib/gamification-client";
import { getLastNewBatchIds, pruneLastNewBatchIds, subscribeNewBatch } from "@/lib/newBatch";
import {
  BRAINDUMP_SUGGESTED_ITEM_TYPES_EVENT,
  type SuggestedItemTypeDetail,
} from "@/lib/item-types";
import { ENTRY_DISPLAY_CHANGED, entryPrimaryLine, loadShowEntryTitles } from "@/lib/entry-display-settings";
import {
  dateOnlyToStartOfDay,
  localDateTimeToDate,
  normalizeReminderMinutesBefore,
} from "@/lib/calendar-schedule";
import {
  CUSTOM_AREAS_KEY,
  formatAreaLabel,
  getPersonalAreasList,
  PERSONAL_AREA_DEFAULTS,
} from "@/lib/personal-areas";
import { isContentRedundantWithTitle } from "@/lib/entry-content-redundant";
import {
  filterItemsByDueDatePreset,
  scheduledAtToDateKey,
  type DueDateFilterPreset,
} from "@/lib/due-date-filter";
import {
  buildTaskRecurrenceString,
  clearTaskRecurrenceCompleted,
  isRecurringTaskActiveToday,
  isRecurringTaskDoneToday,
  markTaskRecurrenceCompleted,
  parseTaskRecurrence,
  type TaskRecurrencePattern,
} from "@/lib/task-recurrence";

/** Staggered fade-in for list cards (set --bd-i 0…24). */
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

const VIEW_STORAGE_KEY = "braindump-items-view";

export type ItemsViewType = "list" | "calendar";

export type ItemContextSubmenu = "workPrivate" | "areaProject" | "type";

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
  priority?: number | null;
  listOrder?: number | null;
}

interface ItemsViewAreaProps {
  mode: string;
  /** Mobile List view's segmented control changes the workspace mode directly. */
  onModeChange?: (mode: "work" | "personal" | "all") => void;
  projectId: string | null;
  category: string | null;
  itemType: string | null;
  onItemTypeSelect?: (type: string | null) => void;
  viewType?: ItemsViewType;
  onViewTypeChange?: (v: ItemsViewType) => void;
  searchFilter?: string;
  onSearchFilterChange?: (value: string) => void;
  dueDateFilter?: DueDateFilterPreset;
  reloadKey?: number;
  /** Mobile: render ScopeBar in one row with type / view / filter (passed from page when scope is shown). */
  scopeSlot?: ReactNode;
  /** After a successful soft-delete (trash); parent may show undo. */
  onItemMovedToTrash?: (id: string, title: string) => void;
  /** List or text view has no items (workspace empty); parent may show dump FAB hint. */
  onDumpEmptyListTextHintChange?: (show: boolean) => void;
  /** When true, never reports the empty hint (e.g. Today view hides the items panel). */
  dumpEmptyHintSuppressed?: boolean;
  /** Inbox tab: show latest dump batch only, hide type filters. */
  inboxViewActive?: boolean;
}

function isTaskRow(it: Pick<ViewItem, "itemType">): boolean {
  return it.itemType === "task" || it.itemType === "task_completed";
}

function isTaskCompleted(it: Pick<ViewItem, "itemType" | "progress" | "kanbanColumn">): boolean {
  return (
    it.itemType === "task_completed" ||
    (it.itemType === "task" && (it.progress === "completed" || it.kanbanColumn === "completed"))
  );
}

/** Calendar view: strikethrough for checked-off tasks and completed calendar events. */
function isCompletedInCalendarView(it: Pick<ViewItem, "itemType" | "progress" | "kanbanColumn">): boolean {
  if (isTaskCompleted(it)) return true;
  if (it.itemType === "calendar" && (it.progress === "completed" || it.kanbanColumn === "completed")) return true;
  return false;
}

/** Type filter chip / count bucket: incomplete tasks → "task", completed → "task_completed". */
function itemTypeFilterKey(it: Pick<ViewItem, "itemType" | "progress" | "kanbanColumn">): string | null {
  if (!it.itemType || it.itemType === "reminder") return null;
  if (it.itemType === "task") {
    return isTaskCompleted(it) ? "task_completed" : "task";
  }
  return it.itemType;
}

const MODE_LABEL_KEY: Record<"all" | "work" | "personal", string> = {
  all: "mode.all",
  work: "mode.work",
  personal: "mode.personal",
};

const ENTRY_TYPES_BY_DOMAIN: Record<string, { value: string; label: string }[]> = {
  work: [
    { value: "task", label: "Task" },
    { value: "task_completed", label: "Task: Completed" },
    { value: "shopping", label: "Shopping" },
    { value: "note", label: "Note" },
    { value: "idea", label: "Idea" },
    { value: "calendar", label: "Calendar" },
  ],
  personal: [
    { value: "task", label: "Task" },
    { value: "task_completed", label: "Task: Completed" },
    { value: "shopping", label: "Shopping" },
    { value: "note", label: "Note" },
    { value: "idea", label: "Idea" },
    { value: "emotion", label: "Emotion" },
    { value: "reflection", label: "Reflection" },
    { value: "calendar", label: "Calendar" },
  ],
  inbox: [
    { value: "task", label: "Task" },
    { value: "task_completed", label: "Task: Completed" },
    { value: "shopping", label: "Shopping" },
    { value: "note", label: "Note" },
    { value: "idea", label: "Idea" },
    { value: "emotion", label: "Emotion" },
    { value: "reflection", label: "Reflection" },
    { value: "calendar", label: "Calendar" },
  ],
  all: [
    { value: "task", label: "Task" },
    { value: "task_completed", label: "Task: Completed" },
    { value: "shopping", label: "Shopping" },
    { value: "note", label: "Note" },
    { value: "idea", label: "Idea" },
    { value: "calendar", label: "Calendar" },
    { value: "emotion", label: "Emotion" },
    { value: "reflection", label: "Reflection" },
  ],
};

/** Base entry types + dynamic types from items / dump suggestions (add entry & context menu). */
export function mergeEntryTypesForDomain(
  domain: string,
  items: { domain: string; itemType?: string }[],
  suggested: SuggestedItemTypeDetail[],
  t?: (key: string) => string
): { value: string; label: string }[] {
  const base = ENTRY_TYPES_BY_DOMAIN[domain] ?? ENTRY_TYPES_BY_DOMAIN.work;
  const seen = new Set(base.map((b) => b.value));
  const out = base.map(({ value }) => ({ value, label: formatTypeLabel(value, t) }));
  const itemMatchesDomain = (it: { domain: string }) =>
    domain === "all" ? it.domain === "work" || it.domain === "personal" : it.domain === domain;
  for (const it of items) {
    if (!itemMatchesDomain(it) || !it.itemType || it.itemType === "reminder" || seen.has(it.itemType)) continue;
    seen.add(it.itemType);
    out.push({ value: it.itemType, label: formatTypeLabel(it.itemType, t) });
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
    out.push({ value: s.type, label: formatTypeLabel(s.type, t) });
  }
  return out;
}

const TYPE_BAR_COLORS: Record<string, string> = {
  new: "#ea580c",
  task: "#f59e0b",
  task_completed: "#22c55e",
  shopping: "#f43f5e",
  note: "#3b82f6",
  idea: "#8b5cf6",
  emotion: "#ec4899",
  reflection: "#06b6d4",
  reminder: "#10b981",
  calendar: "#10b981",
  default: "#6b7280",
};

/** Icon for each entry type (work & personal). Use on every entry and in type filters. */
export function EntryTypeIcon({ type, size = 16 }: { type: string; size?: number }) {
  const t = type || "note";
  const iconProps = { width: size, height: size, strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (t) {
    case "task":
      return <SquareCheckBig {...iconProps} />;
    case "task_completed":
      return <CircleCheckBig {...iconProps} />;
    case "shopping":
      return <ShoppingCart {...iconProps} />;
    case "idea":
      return <Lightbulb {...iconProps} />;
    case "emotion":
      return <Heart {...iconProps} />;
    case "reflection":
      return <Info {...iconProps} />;
    case "calendar":
      return <Calendar {...iconProps} />;
    case "note":
    default:
      return <FileText {...iconProps} />;
  }
}

export function loadViewPreference(): ItemsViewType {
  if (typeof window === "undefined") return "list";
  try {
    const v = localStorage.getItem(VIEW_STORAGE_KEY);
    if (v === "text" || v === "kanban" || v === "postits" || v === "flowchart") return "list";
    if (v === "list" || v === "calendar") return v as ItemsViewType;
  } catch {}
  return "list";
}

function formatTypeLabel(value: string, t?: (key: string) => string): string {
  if (value === "task_completed") return t ? t("items.typeTaskCompleted") : "Task: Completed";
  if (value === "shopping") return "Shopping";
  const label = value.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
  return value === "calendar" ? "Calendar" : value === "task" ? "Tasks" : label.endsWith("s") ? label : label + "s";
}

function entryTypeLabel(itemType: string, t?: (key: string) => string): string {
  if (itemType === "task_completed") return t ? t("items.typeTaskCompleted") : "Task: Completed";
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

/** Compact due for the type meta line: "Today", "Tomorrow", or locale short date (e.g. 11/4). */
function taskDueCompactForTypeLine(
  it: ViewItem,
  t: (key: string, vars?: Record<string, string | number>) => string
): string | null {
  if (!isTaskRow(it) || !it.scheduledAt) return null;
  const key = scheduledAtToDateKey(it.scheduledAt);
  if (!key) return null;
  const [yy, mm, dd] = key.split("-").map(Number);
  const target = new Date(yy, mm - 1, dd, 12, 0, 0);
  if (!Number.isFinite(target.getTime())) return null;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayStart = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  const diffDays = Math.round((dayStart - todayStart) / 86400000);
  if (diffDays === 0) return t("scope.dateFilterToday");
  if (diffDays === 1) return t("scope.dateFilterTomorrow");
  return target.toLocaleDateString(undefined, { month: "numeric", day: "numeric" });
}

/** First context line, e.g. `Project: Task` or `Project: Task: Today` when the task has a deadline. */
function entryTypeMetaLine(
  it: ViewItem,
  t: (key: string, vars?: Record<string, string | number>) => string
): string {
  const left = entryContextLabel(it) || entryTypeLabel(it.itemType, t);
  const typePart = entryTypeLabel(it.itemType, t);
  const due = taskDueCompactForTypeLine(it, t);
  if (due) return `${left}: ${typePart}: ${due}`;
  return `${left}: ${typePart}`;
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
  const anchorKey = it.scheduledAt ? scheduledAtToDateKey(it.scheduledAt) : null;
  const formatAnchorFull = (key: string | null) => {
    if (!key) return "";
    const [y, m, d] = key.split("-").map(Number);
    if (![y, m, d].every((n) => Number.isFinite(n))) return "";
    const loc = new Date(y, m - 1, d, 12, 0, 0);
    if (!Number.isFinite(loc.getTime())) return "";
    return loc.toLocaleDateString("default", { day: "numeric", month: "short", year: "numeric" });
  };
  const anchorLabel = formatAnchorFull(anchorKey);
  if (it.recurrence === "weekly") {
    return anchorLabel ? `Weekly · ${anchorLabel}${time}` : `Weekly${time}`;
  }
  if (it.recurrence === "monthly") {
    const short = (() => {
      if (!anchorKey) return "";
      const [y, m, d] = anchorKey.split("-").map(Number);
      if (![y, m, d].every((n) => Number.isFinite(n))) return "";
      const loc = new Date(y, m - 1, d, 12, 0, 0);
      if (!Number.isFinite(loc.getTime())) return "";
      return loc.toLocaleDateString("default", { day: "numeric", month: "short" });
    })();
    return short ? `Monthly · ${short}${time}` : `Monthly${time}`;
  }
  if (it.scheduledAt) {
    const trimmedTime = time.trim();
    if (!anchorLabel && trimmedTime) return trimmedTime.startsWith("·") ? trimmedTime.replace(/^·\s*/, "") : trimmedTime;
    return `${anchorLabel}${time}`.trim();
  }
  return null;
}

/** Mobile edit sheet: "Today, 26 Mar, 14:00" style line (accent). */
function formatMobileEditScheduleLine(
  scheduledAt: string,
  scheduledTime: string | undefined,
  locale: string,
  t: (key: string) => string
): string | null {
  const dateStr = scheduledAt?.trim();
  if (!dateStr) return null;
  const key = dateStr.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const target = new Date(`${key}T12:00:00`);
  if (!Number.isFinite(target.getTime())) return null;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayStart = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  const diffDays = Math.round((dayStart - todayStart) / 86400000);
  const dateShort = target.toLocaleDateString(locale || undefined, { day: "numeric", month: "short" });
  const timePart = (scheduledTime ?? "").trim();
  if (diffDays === 0) {
    return timePart ? `${t("scope.dateFilterToday")}, ${dateShort}, ${timePart}` : `${t("scope.dateFilterToday")}, ${dateShort}`;
  }
  if (diffDays === 1) {
    return timePart ? `${t("scope.dateFilterTomorrow")}, ${dateShort}, ${timePart}` : `${t("scope.dateFilterTomorrow")}, ${dateShort}`;
  }
  return timePart ? `${dateShort}, ${timePart}` : dateShort;
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
  if (itemType === "task") {
    return items.filter((it) => it.itemType === "task" && !isTaskCompleted(it));
  }
  if (itemType === "task_completed") {
    return items.filter(isTaskCompleted);
  }
  return items.filter((it) => it.itemType === itemType);
}

function sortItemsByListOrder(list: ViewItem[]): ViewItem[] {
  return [...list].sort((a, b) => {
    const ao = a.listOrder ?? 0;
    const bo = b.listOrder ?? 0;
    if (ao !== bo) return ao - bo;
    return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
  });
}

export function ItemsViewArea({
  mode,
  onModeChange,
  projectId,
  category,
  itemType,
  onItemTypeSelect,
  viewType: controlledViewType,
  onViewTypeChange,
  searchFilter = "",
  onSearchFilterChange,
  dueDateFilter = "all",
  reloadKey = 0,
  scopeSlot,
  onItemMovedToTrash,
  onDumpEmptyListTextHintChange,
  dumpEmptyHintSuppressed = false,
  inboxViewActive = false,
}: ItemsViewAreaProps) {
  const { t, locale } = useI18n();
  const [items, setItems] = useState<ViewItem[]>([]);
  const itemsRef = useRef<ViewItem[]>([]);
  itemsRef.current = items;
  const [loading, setLoading] = useState(true);
  const [newBatchTick, setNewBatchTick] = useState(0);
  useEffect(() => subscribeNewBatch(() => setNewBatchTick((n) => n + 1)), []);

  useEffect(() => {
    if (items.length === 0) return;
    pruneLastNewBatchIds(new Set(items.map((it) => it.id)));
  }, [items]);
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
  const filteredItems = useMemo(() => {
    if (inboxViewActive) {
      const ids = getLastNewBatchIds();
      if (ids.size === 0) return [];
      return sortItemsByListOrder(items.filter((it) => ids.has(it.id)));
    }
    return sortItemsByListOrder(
      filterItemsBySearch(
        filterItemsByDueDatePreset(filterItemsByType(items, itemType), dueDateFilter),
        searchFilter
      )
    );
  }, [items, itemType, searchFilter, dueDateFilter, newBatchTick, inboxViewActive]);

  const canReorderEntries = !searchFilter.trim() && dueDateFilter === "all";

  const [suggestedItemTypesFromDump, setSuggestedItemTypesFromDump] = useState<SuggestedItemTypeDetail[]>([]);
  const [internalViewType, setInternalViewType] = useState<ItemsViewType>(loadViewPreference);
  const viewType = controlledViewType ?? internalViewType;
  const setViewType = onViewTypeChange ?? setInternalViewType;

  useEffect(() => {
    const cb = onDumpEmptyListTextHintChange;
    if (!cb) return;
    if (loading) {
      cb(false);
      return;
    }
    const listView = viewType === "list";
    cb(listView && items.length === 0 && !dumpEmptyHintSuppressed);
    return () => {
      cb(false);
    };
  }, [loading, viewType, items.length, dumpEmptyHintSuppressed, onDumpEmptyListTextHintChange]);
  const [itemContextMenu, setItemContextMenu] = useState<{ id: string; x: number; y: number; domain: string; currentType: string } | null>(null);
  const [itemContextSubmenu, setItemContextSubmenu] = useState<ItemContextSubmenu | null>(null);
  const [projectsList, setProjectsList] = useState<{ id: string; name: string }[]>([]);
  const [editingEntry, setEditingEntry] = useState<{
    id: string;
    title: string;
    content: string;
    scheduledAt?: string;
    scheduledTime?: string;
    recurrence?: string;
    sendNotification?: boolean;
    /** Minutes before event for advance notification (0, 10, 30, 60) */
    reminderMinutesBefore?: number;
    priority?: number | null;
  } | null>(null);
  const [editEntryMoreOpen, setEditEntryMoreOpen] = useState(false);
  const [editEntryScheduleOpen, setEditEntryScheduleOpen] = useState(false);
  const editEntryContentRef = useRef<HTMLTextAreaElement | null>(null);
  const editingEntryRef = useRef(editingEntry);
  editingEntryRef.current = editingEntry;
  const [reminderEntry, setReminderEntry] = useState<{
    id: string;
    title: string;
    reminderDate: string;
    reminderTime: string;
    reminderMinutesBefore: number;
  } | null>(null);
  const [addEntryOpen, setAddEntryOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [editEntryPortalEl, setEditEntryPortalEl] = useState<HTMLElement | null>(null);
  const [typePickerOpen, setTypePickerOpen] = useState(false);
  const [addEntryForm, setAddEntryForm] = useState({
    itemType: "note",
    title: "",
    content: "",
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
    scheduledAt: scheduledAtToDateKey(it.scheduledAt) ?? "",
    scheduledTime: it.scheduledTime ?? "",
    recurrence: it.recurrence ?? "none",
    sendNotification: it.sendNotification ?? false,
    reminderMinutesBefore: normalizeReminderMinutesBefore(it.reminderMinutesBefore ?? 30),
    priority: it.priority ?? null,
  }), []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => setIsMobile(window.matchMedia("(max-width: 768px)").matches);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    setEditEntryPortalEl(typeof document !== "undefined" ? document.body : null);
  }, []);

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

  const fetchItems = useCallback((): Promise<void> => {
    if (mode === "all") {
      setLoading(true);
      return Promise.all([
        fetchWithTimeout("/api/organized-items?domain=work").then((d) => d.items || []),
        fetchWithTimeout("/api/organized-items?domain=personal").then((d) => d.items || []),
      ])
        .then(([workItems, personalItems]) => {
          let merged: ViewItem[] = [...workItems, ...personalItems];
          if (category) {
            merged = merged.filter((it) => it.category === category);
          }
          setItems(sortItemsByListOrder(merged as ViewItem[]));
        })
        .catch(() => setItems([]))
        .finally(() => setLoading(false));
    }
    const params = new URLSearchParams();
    params.set("domain", mode);
    if (projectId) params.set("projectId", projectId);
    if (category) params.set("category", category);
    setLoading(true);
    return fetchWithTimeout(`/api/organized-items?${params}`)
      .then((d) => setItems(d.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [mode, projectId, category, fetchWithTimeout, reloadKey]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const prevViewTypeRef = useRef<ItemsViewType | undefined>(undefined);
  useEffect(() => {
    const prev = prevViewTypeRef.current;
    prevViewTypeRef.current = viewType;
    if (viewType === "calendar" && prev !== undefined && prev !== "calendar") {
      void fetchItems();
    }
  }, [viewType, fetchItems]);

  const reorderEntriesPersist = useCallback(
    (visibleOrderedIds: string[]) => {
      if (!visibleOrderedIds.length) return;
      const byId = new Map(items.map((i) => [i.id, i]));
      if (visibleOrderedIds.some((id) => !byId.has(id))) return;
      const visibleSet = new Set(visibleOrderedIds);
      const tail = sortItemsByListOrder(items.filter((i) => !visibleSet.has(i.id)));
      const head = visibleOrderedIds.map((id) => byId.get(id)!);
      const merged = [...head, ...tail];
      const gap = 1000;
      const withOrder = merged.map((it, i) => ({ ...it, listOrder: i * gap }));
      setItems(withOrder);
      void fetch("/api/organized-items/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: withOrder.map((i) => i.id) }),
      }).then((r) => {
        if (!r.ok) fetchItems();
      });
    },
    [items, fetchItems]
  );

  useEffect(() => {
    const onReload = () => fetchItems();
    window.addEventListener("braindump-reload-items", onReload);
    return () => window.removeEventListener("braindump-reload-items", onReload);
  }, [fetchItems]);

  const loadWorkProjects = useCallback(() => {
    fetch("/api/projects?domain=work")
      .then((r) => r.json())
      .then((d) =>
        setProjectsList((d.projects ?? []).map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })))
      )
      .catch(() => setProjectsList([]));
  }, []);

  useEffect(() => {
    loadWorkProjects();
  }, [loadWorkProjects]);

  useEffect(() => {
    window.addEventListener("braindump-reload-projects", loadWorkProjects);
    return () => window.removeEventListener("braindump-reload-projects", loadWorkProjects);
  }, [loadWorkProjects]);

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
      const key = itemTypeFilterKey(it);
      if (key === null) continue;
      m.set(key, (m.get(key) ?? 0) + 1);
    }
    return m;
  }, [items]);

  const addEntryTypeOptions = useMemo(
    () => mergeEntryTypesForDomain(mode, items, suggestedItemTypesFromDump, t),
    [mode, items, suggestedItemTypesFromDump, t]
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
      case "task_completed":
        return "#22c55e";
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
      opts.push({ value, label: formatTypeLabel(value, t) });
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
      scheduleClientPreferencesUpload();
    } catch {}
  }, [viewType]);

  useEffect(() => {
    if (!itemContextMenu) return;
    setItemContextSubmenu(null);
  }, [itemContextMenu?.id]);

  useEffect(() => {
    if (!itemContextMenu) return;
    if (isMobile) return;
    const close = () => {
      setItemContextMenu(null);
      setItemContextSubmenu(null);
    };
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [itemContextMenu, isMobile]);

  const setTaskCompleted = useCallback((id: string, completed: boolean) => {
    const currentItem = itemsRef.current.find((i) => i.id === id);
    const isShopping = currentItem?.itemType === "shopping";
    const taskRec = parseTaskRecurrence(currentItem?.recurrence);
    const isRecurring = taskRec.isRecurring;

    const itemType = isShopping ? "shopping" : completed ? "task_completed" : "task";
    const progress = completed ? "completed" : "todo";
    const kanbanColumn = completed ? "completed" : "todo";

    // For recurring tasks, track the completion date in the recurrence field
    let newRecurrence: string | undefined;
    if (isRecurring && taskRec.pattern && currentItem?.recurrence) {
      newRecurrence = completed
        ? markTaskRecurrenceCompleted(currentItem.recurrence)
        : clearTaskRecurrenceCompleted(currentItem.recurrence);
    }

    setItems((prev) =>
      prev.map((it) =>
        it.id === id
          ? { ...it, itemType, progress, kanbanColumn, ...(newRecurrence !== undefined && { recurrence: newRecurrence }) }
          : it
      )
    );

    // For shopping items, don't change itemType in the patch
    const patch: Record<string, unknown> = isShopping
      ? { progress, kanbanColumn }
      : { itemType, progress, kanbanColumn };
    if (newRecurrence !== undefined) patch.recurrence = newRecurrence;

    fetch(`/api/organized-items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    })
      .then(async (r) => {
        if (!r.ok) return;
        try {
          emitGamificationFromResponseBody(await r.json());
        } catch {
          /* ignore */
        }
        if (completed) playTaskCompleteCheer();
      })
      .catch(() => {});
  }, []);

  const deleteItem = useCallback(
    (id: string, skipConfirm?: boolean) => {
      const it = items.find((i) => i.id === id);
      const title = (it?.title ?? "").trim() || "—";
      if (!skipConfirm && !confirm(t("items.moveToTrashConfirm"))) return;

      // Swipe-to-delete / instant trash: remove from UI immediately; sync server in background.
      if (skipConfirm) {
        setItems((prev) => prev.filter((x) => x.id !== id));
        onItemMovedToTrash?.(id, title);
        fetch(`/api/organized-items/${id}`, { method: "DELETE" })
          .then((r) => {
            if (!r.ok) void fetchItems();
          })
          .catch(() => {
            void fetchItems();
          });
        return;
      }

      fetch(`/api/organized-items/${id}`, { method: "DELETE" })
        .then((r) => {
          if (r.ok) {
            setItems((prev) => prev.filter((x) => x.id !== id));
            onItemMovedToTrash?.(id, title);
          }
        })
        .catch(() => {});
    },
    [items, onItemMovedToTrash, t, fetchItems]
  );

  const updateItemType = useCallback((id: string, newType: string) => {
    const patch: Record<string, unknown> = { itemType: newType };
    if (newType === "task_completed") {
      patch.progress = "completed";
      patch.kanbanColumn = "completed";
    } else if (newType === "task") {
      patch.progress = "todo";
      patch.kanbanColumn = "todo";
    }
    fetch(`/api/organized-items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    })
      .then(async (r) => {
        if (!r.ok) return;
        try {
          emitGamificationFromResponseBody(await r.json());
        } catch {
          /* ignore */
        }
        setItems((prev) =>
          prev.map((it) => {
            if (it.id !== id) return it;
            const next = { ...it, itemType: newType };
            if (newType === "task_completed") return { ...next, progress: "completed", kanbanColumn: "completed" };
            if (newType === "task") return { ...next, progress: "todo", kanbanColumn: "todo" };
            return next;
          })
        );
        if (newType === "task_completed") playTaskCompleteCheer();
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

  const updateItemDomain = useCallback(
    (id: string, newDomain: "work" | "personal") => {
      const it = items.find((i) => i.id === id);
      if (!it || (it.domain !== "work" && it.domain !== "personal")) return;
      if (it.domain === newDomain) return;
      const body =
        newDomain === "work"
          ? { domain: "work", category: "tasks", subcategory: "", projectId: null as string | null }
          : {
              domain: "personal",
              category: PERSONAL_AREA_DEFAULTS[0] ?? "thoughts",
              subcategory: "",
              projectId: null as string | null,
            };
      fetch(`/api/organized-items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
        .then((r) => {
          if (r.ok) void fetchItems();
        })
        .catch(() => {});
    },
    [items, fetchItems]
  );

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
      const dumpPayload = await resDump.json();
      if (!resDump.ok) return;
      emitGamificationFromResponseBody(dumpPayload);
      const dump = (dumpPayload as { dump?: { id: string } }).dump;
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
        payload.progress = "todo";
        payload.kanbanColumn = "todo";
      }
      if (form.itemType === "task_completed") {
        payload.progress = "completed";
        payload.kanbanColumn = "completed";
      }
      if (form.itemType === "calendar") {
        const raw = form.scheduledAt?.trim() ?? "";
        const dateKey = raw.length >= 10 ? raw.slice(0, 10) : raw;
        const timeRaw = form.scheduledTime?.trim() || "";
        let scheduledIso: string | null = null;
        if (dateKey && /^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
          if (timeRaw && /^\d{1,2}:\d{2}$/.test(timeRaw)) {
            const at = localDateTimeToDate(dateKey, timeRaw);
            scheduledIso = at ? at.toISOString() : null;
          } else {
            const d = dateOnlyToStartOfDay(dateKey);
            scheduledIso = d ? d.toISOString() : null;
          }
        }
        payload.scheduledAt = scheduledIso;
        payload.scheduledTime = form.scheduledTime || null;
        payload.recurrence = form.recurrence === "none" ? null : form.recurrence;
        payload.sendNotification = form.sendNotification;
        const rMin = normalizeReminderMinutesBefore(form.reminderMinutesBefore ?? 0);
        if (form.sendNotification && dateKey && /^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
          const at = localDateTimeToDate(dateKey, timeRaw || "09:00");
          if (at) {
            payload.reminderAt = at.toISOString();
            payload.reminderMinutesBefore = rMin;
          }
        }
      }
      if (form.itemType === "shopping" && form.scheduledAt?.trim()) {
        const d = dateOnlyToStartOfDay(form.scheduledAt.trim());
        if (d) payload.scheduledAt = d.toISOString();
        payload.scheduledTime = form.scheduledTime?.trim() || null;
        payload.sendNotification = form.sendNotification;
        const rMin = normalizeReminderMinutesBefore(form.reminderMinutesBefore ?? 0);
        if (form.sendNotification) {
          const at = localDateTimeToDate(form.scheduledAt.trim(), form.scheduledTime || undefined);
          if (at) {
            payload.reminderAt = at.toISOString();
            payload.reminderMinutesBefore = rMin;
          }
        }
      }
      if (
        (form.itemType === "task" || form.itemType === "task_completed") &&
        form.scheduledAt?.trim()
      ) {
        const d = dateOnlyToStartOfDay(form.scheduledAt.trim());
        if (d) payload.scheduledAt = d.toISOString();
        payload.scheduledTime = form.scheduledTime?.trim() || null;
        payload.sendNotification = form.sendNotification;
        const rMin = normalizeReminderMinutesBefore(form.reminderMinutesBefore ?? 0);
        if (form.sendNotification) {
          const at = localDateTimeToDate(form.scheduledAt.trim(), form.scheduledTime || undefined);
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
      const itemPayload = await resItem.json();
      if (resItem.ok) {
        emitGamificationFromResponseBody(itemPayload);
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

  /** Notify-before options for calendar and deadline (matches server: 0, 10, 30, 60). */
  const NOTIFY_BEFORE_EVENT_OPTIONS = [10, 30, 60, 0] as const;
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

  type EditingEntryState = NonNullable<typeof editingEntry>;

  const flushEditingEntry = useCallback(
    (ed: EditingEntryState) => {
      fetch(`/api/organized-items/${ed.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: ed.title,
          content: ed.content,
          priority: ed.priority ?? null,
        }),
      })
        .then((r) => {
          if (r.ok)
            setItems((prev) =>
              prev.map((it) =>
                it.id === ed.id ? { ...it, title: ed.title, content: ed.content, priority: ed.priority ?? null } : it
              )
            );
        })
        .catch(() => {});

      const currentItem = items.find((i) => i.id === ed.id);
      if (currentItem?.itemType === "calendar") {
        const rMin = normalizeReminderMinutesBefore(ed.reminderMinutesBefore ?? 0);
        const dateStr = ed.scheduledAt?.trim();
        const timeStr = ed.scheduledTime?.trim() || "";
        const dateKey = dateStr ? (dateStr.length >= 10 ? dateStr.slice(0, 10) : dateStr) : "";
        let scheduledAtIso: string | null = null;
        if (dateKey && /^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
          if (timeStr && /^\d{1,2}:\d{2}$/.test(timeStr)) {
            const at = localDateTimeToDate(dateKey, timeStr);
            scheduledAtIso = at ? at.toISOString() : null;
          } else {
            const d = dateOnlyToStartOfDay(dateKey);
            scheduledAtIso = d ? d.toISOString() : null;
          }
        }
        let reminderAtIso: string | null = null;
        if (ed.sendNotification && dateKey) {
          const dt = localDateTimeToDate(dateKey, timeStr || "09:00");
          reminderAtIso = dt ? dt.toISOString() : null;
        }
        updateSchedule(ed.id, {
          scheduledAt: scheduledAtIso,
          scheduledTime: ed.scheduledTime || null,
          recurrence: (ed.recurrence === "none" ? null : ed.recurrence) || null,
          sendNotification: ed.sendNotification ?? false,
          reminderAt: ed.sendNotification && reminderAtIso ? reminderAtIso : null,
          reminderMinutesBefore: ed.sendNotification && reminderAtIso ? rMin : null,
        });
      }
      if (currentItem && (currentItem.itemType === "shopping" || isTaskRow(currentItem))) {
        const due = ed.scheduledAt?.trim();
        const dt = due ? dateOnlyToStartOfDay(due) : null;
        const timeStr = ed.scheduledTime?.trim() || "";
        const rMin = normalizeReminderMinutesBefore(ed.reminderMinutesBefore ?? 0);
        let reminderAtIso: string | null = null;
        if (due && ed.sendNotification) {
          const eventDt = localDateTimeToDate(due, timeStr || undefined);
          reminderAtIso = eventDt ? eventDt.toISOString() : null;
        }

        // For tasks: save the clean recurrence string (strip any completion date suffix)
        let taskRecurrenceValue: string | null | undefined;
        if (isTaskRow(currentItem)) {
          const parsed = parseTaskRecurrence(ed.recurrence);
          if (parsed.isRecurring && parsed.pattern) {
            taskRecurrenceValue = buildTaskRecurrenceString(parsed.pattern, parsed.days);
          } else {
            taskRecurrenceValue = null;
          }
        }

        updateSchedule(ed.id, {
          scheduledAt: dt ? dt.toISOString() : null,
          scheduledTime: timeStr || null,
          ...(taskRecurrenceValue !== undefined && { recurrence: taskRecurrenceValue }),
          sendNotification: due ? (ed.sendNotification ?? false) : false,
          reminderAt: due && ed.sendNotification && reminderAtIso ? reminderAtIso : null,
          reminderMinutesBefore: due && ed.sendNotification && reminderAtIso ? rMin : null,
        });
      }
    },
    [items, updateSchedule]
  );

  useEffect(() => {
    if (!editingEntry) {
      setEditEntryMoreOpen(false);
      setEditEntryScheduleOpen(false);
    }
  }, [editingEntry]);

  useEffect(() => {
    if (!editingEntry || !isMobile) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [editingEntry, isMobile]);

  useEffect(() => {
    if (!editingEntry) return;
    const onChromePointerDown = (e: PointerEvent) => {
      const node = e.target;
      if (!(node instanceof Node)) return;
      const top = document.querySelector(".bd-topbar");
      const bottom = document.querySelector(".bd-bottom-bar");
      if (!(top?.contains(node) || bottom?.contains(node))) return;
      const ed = editingEntryRef.current;
      if (!ed) return;
      flushEditingEntry(ed);
      setEditingEntry(null);
    };
    document.addEventListener("pointerdown", onChromePointerDown, true);
    return () => document.removeEventListener("pointerdown", onChromePointerDown, true);
  }, [editingEntry, flushEditingEntry]);

  if (loading) {
    return (
      <div style={{ padding: "1.5rem" }}>
        <p className="bd-empty">{t("items.loading")}</p>
      </div>
    );
  }

  const mobileModesToolbar = mode === "work" || mode === "personal" || mode === "all";
  const showUnifiedMobileChrome = Boolean(isMobile && mobileModesToolbar && scopeSlot);

  const mobileToolbarCompactInner = (
    <>
      {onItemTypeSelect && !inboxViewActive && viewType !== "calendar" && (
        <button
          type="button"
          className={isMobile ? "bd-btn bd-mobile-type-chip-pill" : "bd-btn"}
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
            ...(isMobile
              ? {}
              : {
                  background: "var(--bd-chrome-selected-bg)",
                  borderColor: "var(--bd-chrome-selected-border)",
                  color: "var(--bd-chrome-selected-text)",
                  boxShadow: "none",
                }),
          }}
        >
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "left" }}>{selectedTypeLabel}</span>
          <ChevronDown size={18} style={{ flexShrink: 0, opacity: 0.95 }} aria-hidden />
        </button>
      )}
    </>
  );

  return (
    <div className="bd-items-view-root">
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
              {onItemTypeSelect && !inboxViewActive && viewType !== "calendar" && (mode === "work" || mode === "personal" || mode === "all") && (
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
          </>
        )}
      </div>
      )}
        {isMobile && typePickerOpen && onItemTypeSelect && !inboxViewActive && mobileModesToolbar && (
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
                  <X size={18} aria-hidden />
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
                        <Check size={18} strokeWidth={2.5} aria-hidden />
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

      {items.length > 0 && filteredItems.length === 0 ? (
        <p className="bd-empty">{t("items.emptySearch")}</p>
      ) : (
        <>
          {items.length === 0 ? (
            <p className="bd-empty" style={{ margin: "0 0 0.75rem" }}>
              {t("items.emptyFilters")}
            </p>
          ) : null}
          {viewType === "calendar" ? (
            <CalendarView
              showEntryTitles={showEntryTitles}
              items={filteredItems}
              onSchedule={updateSchedule}
              onEdit={(it) => setEditingEntry(toEditEntry(it))}
              onItemContextMenu={(e, id, domain, currentType) => setItemContextMenu({ id, x: e.clientX, y: e.clientY, domain, currentType })}
              onSetTaskCompleted={setTaskCompleted}
              onDelete={deleteItem}
              isMobile={isMobile}
            />
          ) : (
            <ListView
              showEntryTitles={showEntryTitles}
              items={filteredItems}
              isMobile={isMobile}
              onSetTaskCompleted={setTaskCompleted}
              onDelete={deleteItem}
              onItemContextMenu={(e, id, domain, currentType) => setItemContextMenu({ id, x: e.clientX, y: e.clientY, domain, currentType })}
              onEdit={(it) => setEditingEntry(toEditEntry(it))}
              onUpdate={updateEntryContent}
              reorderEnabled={canReorderEntries}
              onReorder={reorderEntriesPersist}
              mode={mode}
              onModeChange={onModeChange}
              searchFilter={searchFilter}
              onSearchFilterChange={onSearchFilterChange}
              showToolbar={isMobile && !inboxViewActive}
            />
          )}
        </>
      )}

      {itemContextMenu && (() => {
        const selectedItem = items.find((i) => i.id === itemContextMenu.id);
        const domainKey = selectedItem?.domain ?? itemContextMenu.domain;
        const types = mergeEntryTypesForDomain(domainKey, items, suggestedItemTypesFromDump, t);
        const personalAreas = getPersonalAreasList(items);
        const closeMenu = () => {
          setItemContextMenu(null);
          setItemContextSubmenu(null);
        };
        const placementIsWork = domainKey === "work";
        const placementIsPersonal = domainKey === "personal";
        const showDomainAndPlacement = placementIsWork || placementIsPersonal;

        const submenuHeader = (label: string) => <div className="bd-entry-context-menu__header">{label}</div>;

        const workPrivateOptions = () => (
          <>
            <button
              type="button"
              className={`bd-entry-context-menu__btn${domainKey === "work" ? " bd-entry-context-menu__btn--strong" : ""}`}
              onClick={() => {
                updateItemDomain(itemContextMenu.id, "work");
                closeMenu();
              }}
            >
              {t("mode.work")}
              {domainKey === "work" ? " ✓" : ""}
            </button>
            <button
              type="button"
              className={`bd-entry-context-menu__btn${domainKey === "personal" ? " bd-entry-context-menu__btn--strong" : ""}`}
              onClick={() => {
                updateItemDomain(itemContextMenu.id, "personal");
                closeMenu();
              }}
            >
              {t("mode.personal")}
              {domainKey === "personal" ? " ✓" : ""}
            </button>
          </>
        );

        const projectPickList = () => {
          const currentProjectId = selectedItem?.project?.id ?? null;
          return (
            <>
              <button
                type="button"
                className={`bd-entry-context-menu__btn${currentProjectId === null ? " bd-entry-context-menu__btn--strong" : ""}`}
                onClick={() => {
                  updateProject(itemContextMenu.id, null);
                  closeMenu();
                }}
              >
                {t("menu.noProject")}
                {currentProjectId === null ? " ✓" : ""}
              </button>
              {projectsList.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`bd-entry-context-menu__btn${currentProjectId === p.id ? " bd-entry-context-menu__btn--strong" : ""}`}
                  onClick={() => {
                    updateProject(itemContextMenu.id, p.id);
                    closeMenu();
                  }}
                >
                  {p.name}
                  {currentProjectId === p.id ? " ✓" : ""}
                </button>
              ))}
            </>
          );
        };

        const areaPickList = () => {
          const currentCategory = selectedItem?.category ?? "";
          return (
            <>
              {personalAreas.map((areaKey) => (
                <button
                  key={areaKey}
                  type="button"
                  className={`bd-entry-context-menu__btn${currentCategory === areaKey ? " bd-entry-context-menu__btn--strong" : ""}`}
                  onClick={() => {
                    updateCategory(itemContextMenu.id, areaKey);
                    closeMenu();
                  }}
                >
                  {formatAreaLabel(areaKey)}
                  {currentCategory === areaKey ? " ✓" : ""}
                </button>
              ))}
            </>
          );
        };

        const typeOptionList = () => (
          <>
            {types.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                className={`bd-entry-context-menu__btn${itemContextMenu.currentType === value ? " bd-entry-context-menu__btn--strong" : ""}`}
                onClick={() => {
                  updateItemType(itemContextMenu.id, value);
                  closeMenu();
                }}
              >
                {label}
                {itemContextMenu.currentType === value ? " ✓" : ""}
              </button>
            ))}
          </>
        );

        const mobileSubTitle =
          itemContextSubmenu === "workPrivate"
            ? t("menu.changeWorkPrivate")
            : itemContextSubmenu === "areaProject"
              ? placementIsWork
                ? t("menu.selectProject")
                : t("menu.selectArea")
              : itemContextSubmenu === "type"
                ? t("menu.changeType")
                : "";

        return (
          <div
            className={isMobile ? "bd-items-sheet-backdrop bd-items-context-menu-backdrop" : undefined}
            onClick={isMobile ? closeMenu : undefined}
          >
            <div
              className={`bd-entry-context-menu${isMobile ? " bd-entry-context-menu--mobile-sheet" : ""}`}
              style={{
                position: isMobile ? "relative" : "fixed",
                left: isMobile ? undefined : itemContextMenu.x,
                top: isMobile ? undefined : itemContextMenu.y,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {isMobile && itemContextSubmenu ? (
                <>
                  <button
                    type="button"
                    className="bd-entry-context-menu__btn bd-entry-context-menu__btn--strong"
                    onClick={() => setItemContextSubmenu(null)}
                  >
                    {t("menu.back")}
                  </button>
                  <div className="bd-entry-context-menu__header bd-entry-context-menu__header--compact">{mobileSubTitle}</div>
                  {itemContextSubmenu === "workPrivate" ? workPrivateOptions() : null}
                  {itemContextSubmenu === "areaProject"
                    ? placementIsWork
                      ? projectPickList()
                      : placementIsPersonal
                        ? areaPickList()
                        : null
                    : null}
                  {itemContextSubmenu === "type" ? typeOptionList() : null}
                </>
              ) : (
                <>
                  <div className="bd-entry-context-menu__header">{t("menu.actions")}</div>
                  <button
                    type="button"
                    className="bd-entry-context-menu__btn"
                    onClick={() => {
                      const it = items.find((i) => i.id === itemContextMenu.id);
                      if (it) setEditingEntry(toEditEntry(it));
                      closeMenu();
                    }}
                  >
                    {t("menu.edit")}
                  </button>
                  {showDomainAndPlacement ? (
                    <button
                      type="button"
                      className="bd-entry-context-menu__btn"
                      onClick={() => setItemContextSubmenu("workPrivate")}
                    >
                      {t("menu.changeWorkPrivate")}
                    </button>
                  ) : null}
                  {showDomainAndPlacement ? (
                    <button
                      type="button"
                      className="bd-entry-context-menu__btn"
                      onClick={() => setItemContextSubmenu("areaProject")}
                    >
                      {t("menu.changeAreaProject")}
                    </button>
                  ) : null}
                  <button type="button" className="bd-entry-context-menu__btn" onClick={() => setItemContextSubmenu("type")}>
                    {t("menu.changeType")}
                  </button>
                  <div className="bd-entry-context-menu__divider" role="separator" aria-hidden />
                  <button
                    type="button"
                    className="bd-entry-context-menu__btn bd-entry-context-menu__btn--danger"
                    onClick={() => {
                      deleteItem(itemContextMenu.id, true);
                      closeMenu();
                    }}
                  >
                    {t("menu.delete")}
                  </button>
                  {isMobile ? (
                    <>
                      <div className="bd-entry-context-menu__divider" role="separator" aria-hidden />
                      <button type="button" className="bd-entry-context-menu__btn" onClick={closeMenu}>
                        {t("menu.cancel")}
                      </button>
                    </>
                  ) : null}
                </>
              )}
            </div>
            {!isMobile && itemContextSubmenu ? (
              <div
                className="bd-entry-context-menu bd-entry-context-menu--flyout"
                style={{ left: itemContextMenu.x + 168, top: itemContextMenu.y }}
                onClick={(e) => e.stopPropagation()}
              >
                {itemContextSubmenu === "workPrivate" ? (
                  <>
                    {submenuHeader(t("menu.changeWorkPrivate"))}
                    {workPrivateOptions()}
                  </>
                ) : null}
                {itemContextSubmenu === "areaProject" ? (
                  <>
                    {submenuHeader(placementIsWork ? t("menu.selectProject") : t("menu.selectArea"))}
                    {placementIsWork ? projectPickList() : placementIsPersonal ? areaPickList() : null}
                  </>
                ) : null}
                {itemContextSubmenu === "type" ? (
                  <>
                    {submenuHeader(t("menu.changeType"))}
                    {typeOptionList()}
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })()}

      {editingEntry && editEntryPortalEl
        ? createPortal(
            isMobile ? (
            <div className="bd-edit-entry-mobile">
          <header className="bd-edit-entry-mobile-top">
            <button
              type="button"
              className="bd-edit-entry-icon-btn"
              onClick={() => {
                flushEditingEntry(editingEntry);
                setEditingEntry(null);
              }}
              aria-label={t("items.editCloseSave")}
            >
              <ChevronLeft size={22} aria-hidden />
            </button>
            <div className="bd-edit-entry-mobile-top-actions">
              <button
                type="button"
                className="bd-edit-entry-icon-btn"
                aria-label={t("items.editMore")}
                onClick={() => setEditEntryMoreOpen(true)}
              >
                <EllipsisVertical size={20} fill="currentColor" stroke="none" aria-hidden />
              </button>
              <button
                type="button"
                className="bd-btn bd-btn-primary bd-edit-entry-save-header-btn"
                aria-label={t("items.ariaSaveEntry")}
                title={t("items.ariaSaveEntry")}
                onClick={() => {
                  flushEditingEntry(editingEntry);
                  setEditingEntry(null);
                }}
              >
                {t("scope.save")}
              </button>
            </div>
          </header>
          <div className="bd-edit-entry-mobile-scroll">
            {(() => {
              const ei = items.find((i) => i.id === editingEntry.id);
              const scheduleLine =
                ei?.itemType === "calendar"
                  ? formatCalendarScheduleLabel({
                      scheduledAt: editingEntry.scheduledAt,
                      scheduledTime: editingEntry.scheduledTime,
                      recurrence: editingEntry.recurrence,
                    })
                  : formatMobileEditScheduleLine(
                      editingEntry.scheduledAt ?? "",
                      editingEntry.scheduledTime,
                      locale,
                      t
                    );
              const showScheduleRow =
                ei &&
                (ei.itemType === "calendar" || ei.itemType === "shopping" || isTaskRow(ei));
              const taskDone = ei ? isTaskCompleted(ei) : false;
              return (
                <>
                  {showScheduleRow ? (
                    <div className="bd-edit-entry-mobile-schedule-row">
                      {ei && isTaskRow(ei) ? (
                        <label className="bd-todo-checkbox-wrap">
                          <input
                            type="checkbox"
                            className="bd-todo-checkbox"
                            checked={taskDone}
                            onChange={(e) => {
                              setTaskCompleted(editingEntry.id, e.target.checked);
                            }}
                            aria-label={taskDone ? t("items.taskToggleOpen") : t("items.taskToggleDone")}
                          />
                        </label>
                      ) : (
                        <span className="bd-edit-entry-schedule-spacer" aria-hidden />
                      )}
                      <button
                        type="button"
                        className="bd-edit-entry-schedule-accent"
                        onClick={() => {
                          if (!editingEntry.scheduledAt?.trim()) {
                            const n = new Date();
                            const y = n.getFullYear();
                            const mo = String(n.getMonth() + 1).padStart(2, "0");
                            const da = String(n.getDate()).padStart(2, "0");
                            setEditingEntry((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    scheduledAt: `${y}-${mo}-${da}`,
                                    scheduledTime: prev.scheduledTime?.trim() || "14:00",
                                  }
                                : null
                            );
                          }
                          setEditEntryScheduleOpen((o) => !o);
                        }}
                      >
                        <span className="bd-edit-entry-schedule-accent-inner">
                          {scheduleLine || t("items.editTapToSchedule")}
                          {scheduleLine ? (
                            <AlarmClock
                              size={16}
                              aria-hidden
                              className="bd-edit-entry-schedule-alarm"
                            />
                          ) : null}
                        </span>
                      </button>
                    </div>
                  ) : null}
                  {editEntryScheduleOpen && ei && (ei.itemType === "shopping" || isTaskRow(ei)) ? (
                    <div className="bd-edit-entry-mobile-schedule-fields">
                      <input
                        type="date"
                        className="bd-input"
                        value={editingEntry.scheduledAt ?? ""}
                        onChange={(e) => setEditingEntry((prev) => prev && { ...prev, scheduledAt: e.target.value })}
                      />
                      <input
                        type="time"
                        className="bd-input"
                        value={editingEntry.scheduledTime ?? ""}
                        onChange={(e) => setEditingEntry((prev) => prev && { ...prev, scheduledTime: e.target.value })}
                      />
                      <button
                        type="button"
                        className="bd-btn"
                        onClick={() =>
                          setEditingEntry((prev) =>
                            prev && { ...prev, scheduledAt: "", scheduledTime: "", sendNotification: false }
                          )
                        }
                      >
                        {t("items.clearDueDate")}
                      </button>
                      {editingEntry.scheduledAt?.trim() ? (
                        <>
                          <label className="bd-edit-entry-inline-check">
                            <input
                              type="checkbox"
                              checked={editingEntry.sendNotification ?? false}
                              onChange={(e) =>
                                setEditingEntry((prev) => prev && { ...prev, sendNotification: e.target.checked })
                              }
                            />
                            {t("items.editSendNotification")}
                          </label>
                          {editingEntry.sendNotification ? (
                            <label className="bd-edit-entry-field-label">
                              {t("items.editNotifyBefore")}
                              <select
                                className="bd-input"
                                value={editingEntry.reminderMinutesBefore ?? 30}
                                onChange={(e) =>
                                  setEditingEntry((prev) =>
                                    prev ? { ...prev, reminderMinutesBefore: Number(e.target.value) } : null
                                  )
                                }
                              >
                                {NOTIFY_BEFORE_EVENT_OPTIONS.map((m) => (
                                  <option key={m} value={m}>
                                    {m === 0
                                      ? t("items.notifyAtDeadlineOrEvent")
                                      : m === 60
                                        ? t("items.notifyOneHourBefore")
                                        : t("items.minutesBefore", { n: m })}
                                  </option>
                                ))}
                              </select>
                            </label>
                          ) : null}
                        </>
                      ) : null}
                      {isTaskRow(ei) && (() => {
                        const taskRec = parseTaskRecurrence(editingEntry.recurrence);
                        const isRecurring = taskRec.isRecurring;
                        const isDays = taskRec.pattern === "days";
                        return (
                          <div className="bd-task-recur-edit">
                            <label className="bd-edit-entry-inline-check">
                              <input
                                type="checkbox"
                                checked={isRecurring}
                                onChange={(e) => {
                                  setEditingEntry((prev) => prev && {
                                    ...prev,
                                    recurrence: e.target.checked ? "task:daily" : "none",
                                  });
                                }}
                              />
                              {t("items.taskRepeat")}
                            </label>
                            {isRecurring && (
                              <>
                                <div className="bd-task-recur-pattern-row">
                                  <label className="bd-edit-entry-inline-check">
                                    <input
                                      type="radio"
                                      name="bd-task-recur-m"
                                      checked={taskRec.pattern === "daily"}
                                      onChange={() => setEditingEntry((prev) => prev && { ...prev, recurrence: "task:daily" })}
                                    />
                                    {t("items.taskRepeatEveryDay")}
                                  </label>
                                  <label className="bd-edit-entry-inline-check">
                                    <input
                                      type="radio"
                                      name="bd-task-recur-m"
                                      checked={isDays}
                                      onChange={() => {
                                        const days = taskRec.days.length > 0 ? taskRec.days : [1, 2, 3, 4, 5];
                                        setEditingEntry((prev) => prev && { ...prev, recurrence: buildTaskRecurrenceString("days", days) });
                                      }}
                                    />
                                    {t("items.taskRepeatSpecificDays")}
                                  </label>
                                </div>
                                {isDays && (
                                  <div className="bd-task-recur-days">
                                    {([1,2,3,4,5,6,7] as const).map((iso) => {
                                      const key = ["","mon","tue","wed","thu","fri","sat","sun"][iso] as string;
                                      const active = taskRec.days.includes(iso);
                                      return (
                                        <button
                                          key={iso}
                                          type="button"
                                          className={`bd-task-recur-day-btn${active ? " bd-task-recur-day-btn--on" : ""}`}
                                          onClick={() => {
                                            const newDays = active
                                              ? taskRec.days.filter((d) => d !== iso)
                                              : [...taskRec.days, iso];
                                            const safe = newDays.length > 0 ? newDays : [iso];
                                            setEditingEntry((prev) => prev && {
                                              ...prev,
                                              recurrence: buildTaskRecurrenceString("days", safe),
                                            });
                                          }}
                                        >
                                          {t(`habitReminder.dayShort.${key}`)}
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  ) : null}
                  {editEntryScheduleOpen && ei?.itemType === "calendar" ? (
                    <div className="bd-edit-entry-mobile-schedule-fields bd-edit-entry-mobile-calendar-fields">
                      <label className="bd-edit-entry-field-label">
                        {t("items.editCalendarDate")}
                        <input
                          type="date"
                          className="bd-input"
                          value={editingEntry.scheduledAt ?? ""}
                          onChange={(e) => setEditingEntry((prev) => prev && { ...prev, scheduledAt: e.target.value })}
                        />
                      </label>
                      <label className="bd-edit-entry-field-label">
                        {t("items.editCalendarTime")}
                        <input
                          type="time"
                          className="bd-input"
                          value={editingEntry.scheduledTime ?? ""}
                          onChange={(e) => setEditingEntry((prev) => prev && { ...prev, scheduledTime: e.target.value })}
                        />
                      </label>
                      <label className="bd-edit-entry-field-label">
                        {t("items.editCalendarRepeats")}
                        <select
                          className="bd-input"
                          value={editingEntry.recurrence ?? "none"}
                          onChange={(e) => setEditingEntry((prev) => prev && { ...prev, recurrence: e.target.value })}
                        >
                          <option value="none">{t("items.recurrenceNone")}</option>
                          <option value="daily">{t("items.recurrenceDaily")}</option>
                          <option value="weekly">{t("items.recurrenceWeekly")}</option>
                          <option value="monthly">{t("items.recurrenceMonthly")}</option>
                        </select>
                      </label>
                      <label className="bd-edit-entry-inline-check">
                        <input
                          type="checkbox"
                          checked={editingEntry.sendNotification ?? false}
                          onChange={(e) => setEditingEntry((prev) => prev && { ...prev, sendNotification: e.target.checked })}
                        />
                        {t("items.editSendNotification")}
                      </label>
                      {editingEntry.sendNotification ? (
                        <label className="bd-edit-entry-field-label">
                          {t("items.editNotifyBefore")}
                          <select
                            className="bd-input"
                            value={editingEntry.reminderMinutesBefore ?? 30}
                            onChange={(e) =>
                              setEditingEntry((prev) =>
                                prev ? { ...prev, reminderMinutesBefore: Number(e.target.value) } : null
                              )
                            }
                          >
                            {NOTIFY_BEFORE_EVENT_OPTIONS.map((m) => (
                              <option key={m} value={m}>
                                {m === 0
                                  ? t("items.notifyAtDeadlineOrEvent")
                                  : m === 60
                                    ? t("items.notifyOneHourBefore")
                                    : t("items.minutesBefore", { n: m })}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}
                    </div>
                  ) : null}
                  <input
                    className="bd-edit-entry-mobile-title"
                    value={editingEntry.title}
                    onChange={(e) => setEditingEntry((prev) => prev && { ...prev, title: e.target.value })}
                    placeholder={t("items.titlePlaceholder")}
                    enterKeyHint="next"
                    autoFocus
                  />
                  <textarea
                    ref={editEntryContentRef}
                    className="bd-edit-entry-mobile-desc"
                    value={editingEntry.content}
                    onChange={(e) => setEditingEntry((prev) => prev && { ...prev, content: e.target.value })}
                    placeholder={t("items.description")}
                    rows={6}
                  />
                </>
              );
            })()}
          </div>
          {editEntryMoreOpen ? (
            <div
              className="bd-edit-entry-more-backdrop"
              onClick={() => setEditEntryMoreOpen(false)}
              role="presentation"
            >
              <div className="bd-panel bd-edit-entry-more-sheet" onClick={(e) => e.stopPropagation()}>
                <h3 className="bd-edit-entry-more-title">{t("items.editMore")}</h3>
                <button
                  type="button"
                  className="bd-btn bd-btn-danger"
                  style={{ width: "100%", justifyContent: "center" }}
                  onClick={() => {
                    if (!confirm(t("items.confirmDeleteEntry"))) return;
                    deleteItem(editingEntry.id, true);
                    setEditingEntry(null);
                    setEditEntryMoreOpen(false);
                  }}
                >
                  {t("menu.delete")}
                </button>
                <button type="button" className="bd-btn" style={{ width: "100%", marginTop: "0.5rem" }} onClick={() => setEditEntryMoreOpen(false)}>
                  {t("scope.cancel")}
                </button>
              </div>
            </div>
          ) : null}
        </div>
        ) : (
        <div
          className="bd-modal-backdrop bd-edit-entry-backdrop"
          onClick={() => setEditingEntry(null)}
        >
          <div
            className="bd-panel bd-modal-panel bd-edit-entry-panel bd-edit-entry-panel--tall"
            style={{
              padding: "1.25rem",
              maxWidth: 560,
              width: "100%",
              boxSizing: "border-box",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bd-edit-entry-panel-title-row">
              <h3>{t("items.editEntry")}</h3>
              <button
                type="button"
                className="bd-btn bd-btn-primary bd-edit-entry-save-header-btn"
                aria-label={t("items.ariaSaveEntry")}
                title={t("items.ariaSaveEntry")}
                onClick={() => {
                  flushEditingEntry(editingEntry);
                  setEditingEntry(null);
                }}
              >
                {t("scope.save")}
              </button>
            </div>
            <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-tertiary)", marginBottom: "0.25rem" }}>{t("items.headline")}</label>
            <input
              className="bd-input"
              value={editingEntry.title}
              onChange={(e) => setEditingEntry((prev) => prev && { ...prev, title: e.target.value })}
              placeholder={t("items.titlePlaceholder")}
              style={{ width: "100%", marginBottom: "0.75rem", boxSizing: "border-box" }}
              autoFocus
            />
            <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-tertiary)", marginBottom: "0.25rem" }}>{t("items.description")}</label>
            <textarea
              className="bd-textarea"
              value={editingEntry.content}
              onChange={(e) => setEditingEntry((prev) => prev && { ...prev, content: e.target.value })}
              placeholder={t("items.descPlaceholder")}
              style={{
                width: "100%",
                minHeight: isMobile ? 120 : 100,
                marginBottom: "1rem",
                borderRadius: 18,
                boxSizing: "border-box",
              }}
            />
            {(() => {
              const ei = items.find((i) => i.id === editingEntry.id);
              if (!ei || (ei.itemType !== "shopping" && !isTaskRow(ei))) return null;
              return (
                <div style={{ borderTop: "1px solid var(--border-default)", paddingTop: "0.75rem", marginBottom: "1rem" }}>
                  <h4 style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", margin: "0 0 0.5rem" }}>
                    {isTaskRow(ei) ? t("items.taskDeadline") : t("items.taskDueDate")}
                  </h4>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "0.5rem",
                      flexDirection: isMobile ? "column" : "row",
                      alignItems: isMobile ? "stretch" : "center",
                    }}
                  >
                    <input
                      type="date"
                      className="bd-input"
                      value={editingEntry.scheduledAt ?? ""}
                      onChange={(e) => setEditingEntry((prev) => prev && { ...prev, scheduledAt: e.target.value })}
                      style={{
                        padding: "0.35rem 0.5rem",
                        fontSize: isMobile ? "max(1rem, 16px)" : "0.8125rem",
                        width: isMobile ? "100%" : "auto",
                        minWidth: 0,
                        boxSizing: "border-box",
                      }}
                    />
                    <input
                      type="time"
                      className="bd-input"
                      value={editingEntry.scheduledTime ?? ""}
                      onChange={(e) => setEditingEntry((prev) => prev && { ...prev, scheduledTime: e.target.value })}
                      style={{
                        padding: "0.35rem 0.5rem",
                        fontSize: isMobile ? "max(1rem, 16px)" : "0.8125rem",
                        width: isMobile ? "100%" : "auto",
                        minWidth: 0,
                        boxSizing: "border-box",
                      }}
                    />
                    <button
                      type="button"
                      className="bd-btn"
                      style={{ fontSize: "0.75rem" }}
                      onClick={() =>
                        setEditingEntry((prev) =>
                          prev && { ...prev, scheduledAt: "", scheduledTime: "", sendNotification: false }
                        )
                      }
                    >
                      {t("items.clearDueDate")}
                    </button>
                  </div>
                  {editingEntry.scheduledAt?.trim() ? (
                    <div style={{ marginTop: "0.65rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.35rem",
                          fontSize: "0.75rem",
                          color: "var(--text-tertiary)",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={editingEntry.sendNotification ?? false}
                          onChange={(e) =>
                            setEditingEntry((prev) => prev && { ...prev, sendNotification: e.target.checked })
                          }
                        />
                        {t("items.editSendNotification")}
                      </label>
                      {editingEntry.sendNotification ? (
                        <label
                          style={{
                            fontSize: "0.75rem",
                            color: "var(--text-tertiary)",
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.25rem",
                            maxWidth: "16rem",
                          }}
                        >
                          {t("items.editNotifyBefore")}
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
                            {NOTIFY_BEFORE_EVENT_OPTIONS.map((m) => (
                              <option key={m} value={m}>
                                {m === 0
                                  ? t("items.notifyAtDeadlineOrEvent")
                                  : m === 60
                                    ? t("items.notifyOneHourBefore")
                                    : t("items.minutesBefore", { n: m })}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}
                    </div>
                  ) : null}
                  {isTaskRow(ei) && (() => {
                    const taskRec = parseTaskRecurrence(editingEntry.recurrence);
                    const isRecurring = taskRec.isRecurring;
                    const isDays = taskRec.pattern === "days";
                    return (
                      <div className="bd-task-recur-edit" style={{ marginTop: "0.75rem" }}>
                        <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.75rem", color: "var(--text-tertiary)", cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={isRecurring}
                            onChange={(e) => {
                              setEditingEntry((prev) => prev && {
                                ...prev,
                                recurrence: e.target.checked ? "task:daily" : "none",
                              });
                            }}
                          />
                          {t("items.taskRepeat")}
                        </label>
                        {isRecurring && (
                          <>
                            <div className="bd-task-recur-pattern-row" style={{ marginTop: "0.35rem" }}>
                              <label style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.75rem", color: "var(--text-tertiary)", cursor: "pointer" }}>
                                <input
                                  type="radio"
                                  name="bd-task-recur-d"
                                  checked={taskRec.pattern === "daily"}
                                  onChange={() => setEditingEntry((prev) => prev && { ...prev, recurrence: "task:daily" })}
                                />
                                {t("items.taskRepeatEveryDay")}
                              </label>
                              <label style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.75rem", color: "var(--text-tertiary)", cursor: "pointer" }}>
                                <input
                                  type="radio"
                                  name="bd-task-recur-d"
                                  checked={isDays}
                                  onChange={() => {
                                    const days = taskRec.days.length > 0 ? taskRec.days : [1, 2, 3, 4, 5];
                                    setEditingEntry((prev) => prev && { ...prev, recurrence: buildTaskRecurrenceString("days" as TaskRecurrencePattern, days) });
                                  }}
                                />
                                {t("items.taskRepeatSpecificDays")}
                              </label>
                            </div>
                            {isDays && (
                              <div className="bd-task-recur-days" style={{ marginTop: "0.35rem" }}>
                                {([1,2,3,4,5,6,7] as const).map((iso) => {
                                  const key = ["","mon","tue","wed","thu","fri","sat","sun"][iso] as string;
                                  const active = taskRec.days.includes(iso);
                                  return (
                                    <button
                                      key={iso}
                                      type="button"
                                      className={`bd-task-recur-day-btn${active ? " bd-task-recur-day-btn--on" : ""}`}
                                      onClick={() => {
                                        const newDays = active
                                          ? taskRec.days.filter((d) => d !== iso)
                                          : [...taskRec.days, iso];
                                        const safe = newDays.length > 0 ? newDays : [iso];
                                        setEditingEntry((prev) => prev && {
                                          ...prev,
                                          recurrence: buildTaskRecurrenceString("days" as TaskRecurrencePattern, safe),
                                        });
                                      }}
                                    >
                                      {t(`habitReminder.dayShort.${key}`)}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })()}
                </div>
              );
            })()}
            {items.find((i) => i.id === editingEntry.id)?.itemType === "calendar" && (
              <div style={{ borderTop: "1px solid var(--border-default)", paddingTop: "0.75rem", marginBottom: "1rem" }}>
                <h4 style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", margin: "0 0 0.5rem" }}>
                  {t("items.viewCalendar")}
                </h4>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: isMobile ? "0.65rem" : "0.5rem 1rem",
                    alignItems: isMobile ? "stretch" : "center",
                    flexDirection: isMobile ? "column" : "row",
                  }}
                >
                  <label
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--text-tertiary)",
                      display: "flex",
                      flexDirection: isMobile ? "column" : "row",
                      alignItems: isMobile ? "stretch" : "center",
                      gap: isMobile ? "0.35rem" : 0,
                      width: isMobile ? "100%" : "auto",
                    }}
                  >
                    {t("items.editCalendarDate")}
                    <input
                      type="date"
                      className="bd-input"
                      value={editingEntry.scheduledAt ?? ""}
                      onChange={(e) => setEditingEntry((prev) => prev && { ...prev, scheduledAt: e.target.value })}
                      style={{
                        marginLeft: isMobile ? 0 : "0.35rem",
                        padding: "0.25rem 0.5rem",
                        width: isMobile ? "100%" : "auto",
                        minWidth: 0,
                        boxSizing: "border-box",
                      }}
                    />
                  </label>
                  <label
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--text-tertiary)",
                      display: "flex",
                      flexDirection: isMobile ? "column" : "row",
                      alignItems: isMobile ? "stretch" : "center",
                      gap: isMobile ? "0.35rem" : 0,
                      width: isMobile ? "100%" : "auto",
                    }}
                  >
                    {t("items.editCalendarTime")}
                    <input
                      type="time"
                      className="bd-input"
                      value={editingEntry.scheduledTime ?? ""}
                      onChange={(e) => setEditingEntry((prev) => prev && { ...prev, scheduledTime: e.target.value })}
                      style={{
                        marginLeft: isMobile ? 0 : "0.35rem",
                        padding: "0.25rem 0.5rem",
                        width: isMobile ? "100%" : "auto",
                        minWidth: 0,
                        boxSizing: "border-box",
                      }}
                    />
                  </label>
                  <label
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--text-tertiary)",
                      display: "flex",
                      flexDirection: isMobile ? "column" : "row",
                      alignItems: isMobile ? "stretch" : "center",
                      gap: isMobile ? "0.35rem" : 0,
                      width: isMobile ? "100%" : "auto",
                    }}
                  >
                    {t("items.editCalendarRepeats")}
                    <select
                      className="bd-input"
                      value={editingEntry.recurrence ?? "none"}
                      onChange={(e) => setEditingEntry((prev) => prev && { ...prev, recurrence: e.target.value })}
                      style={{
                        marginLeft: isMobile ? 0 : "0.35rem",
                        padding: "0.25rem 0.5rem",
                        width: isMobile ? "100%" : "auto",
                        minWidth: 0,
                        boxSizing: "border-box",
                      }}
                    >
                      <option value="none">{t("items.recurrenceNone")}</option>
                      <option value="daily">{t("items.recurrenceDaily")}</option>
                      <option value="weekly">{t("items.recurrenceWeekly")}</option>
                      <option value="monthly">{t("items.recurrenceMonthly")}</option>
                    </select>
                  </label>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.35rem",
                      fontSize: "0.75rem",
                      color: "var(--text-tertiary)",
                      width: isMobile ? "100%" : "auto",
                      minHeight: isMobile ? 44 : undefined,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={editingEntry.sendNotification ?? false}
                      onChange={(e) => setEditingEntry((prev) => prev && { ...prev, sendNotification: e.target.checked })}
                      style={{ width: isMobile ? 22 : undefined, height: isMobile ? 22 : undefined }}
                    />
                    {t("items.editSendNotification")}
                  </label>
                  {editingEntry.sendNotification && (
                    <label
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--text-tertiary)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.25rem",
                        minWidth: isMobile ? 0 : "12rem",
                        width: isMobile ? "100%" : "auto",
                      }}
                    >
                      {t("items.editNotifyBefore")}
                      <select
                        className="bd-input"
                        value={editingEntry.reminderMinutesBefore ?? 30}
                        onChange={(e) =>
                          setEditingEntry((prev) =>
                            prev ? { ...prev, reminderMinutesBefore: Number(e.target.value) } : null
                          )
                        }
                        style={{ padding: "0.25rem 0.5rem", width: isMobile ? "100%" : "auto", boxSizing: "border-box" }}
                      >
                        {NOTIFY_BEFORE_EVENT_OPTIONS.map((m) => (
                          <option key={m} value={m}>
                            {m === 0
                              ? t("items.notifyAtDeadlineOrEvent")
                              : m === 60
                                ? t("items.notifyOneHourBefore")
                                : t("items.minutesBefore", { n: m })}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
              </div>
            )}
            <div
              style={{
                display: "flex",
                flexDirection: isMobile ? "column" : "row",
                alignItems: isMobile ? "stretch" : "center",
                justifyContent: "space-between",
                gap: isMobile ? "0.75rem" : "0.5rem",
                flexWrap: isMobile ? "nowrap" : "wrap",
                paddingTop: isMobile ? "0.25rem" : undefined,
              }}
            >
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
                style={{
                  minWidth: 44,
                  minHeight: 44,
                  padding: "0.55rem",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  alignSelf: isMobile ? "flex-start" : undefined,
                }}
              >
                <Trash2 size={20} aria-hidden />
              </button>
              <div
                style={{
                  display: "flex",
                  gap: "0.5rem",
                  marginLeft: isMobile ? 0 : "auto",
                  justifyContent: isMobile ? "flex-end" : undefined,
                  width: isMobile ? "100%" : undefined,
                }}
              >
                <button
                  type="button"
                  className="bd-btn"
                  onClick={() => setEditingEntry(null)}
                  aria-label={t("items.ariaCancelEdit")}
                  title={t("items.ariaCancelEdit")}
                  style={{ minWidth: 44, minHeight: 44, padding: "0.55rem", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                >
                  <X size={20} aria-hidden />
                </button>
                <button
                  type="button"
                  className="bd-btn bd-btn-primary"
                  onClick={() => {
                    flushEditingEntry(editingEntry);
                    setEditingEntry(null);
                  }}
                  aria-label={t("items.ariaSaveEntry")}
                  title={t("items.ariaSaveEntry")}
                  style={{ minHeight: 44, padding: "0.55rem 1rem", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 600 }}
                >
                  {t("scope.save")}
                </button>
              </div>
            </div>
          </div>
        </div>
        )
      , editEntryPortalEl
      )
        : null}

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
            {(addEntryForm.itemType === "shopping" ||
              addEntryForm.itemType === "task" ||
              addEntryForm.itemType === "task_completed") && (
              <div style={{ borderTop: "1px solid var(--border-default)", paddingTop: "0.75rem", marginBottom: "1rem" }}>
                <h4 style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", margin: "0 0 0.5rem" }}>
                  {addEntryForm.itemType === "shopping" ? t("items.taskDueDate") : t("items.taskDeadline")}
                </h4>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
                  <input
                    type="date"
                    className="bd-input"
                    value={addEntryForm.scheduledAt}
                    onChange={(e) => setAddEntryForm((f) => ({ ...f, scheduledAt: e.target.value }))}
                    style={{ padding: "0.35rem 0.5rem", maxWidth: "12rem" }}
                  />
                  <input
                    type="time"
                    className="bd-input"
                    value={addEntryForm.scheduledTime}
                    onChange={(e) => setAddEntryForm((f) => ({ ...f, scheduledTime: e.target.value }))}
                    style={{ padding: "0.35rem 0.5rem" }}
                  />
                </div>
                {addEntryForm.scheduledAt?.trim() ? (
                  <div style={{ marginTop: "0.65rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
                      <input
                        type="checkbox"
                        checked={addEntryForm.sendNotification}
                        onChange={(e) => setAddEntryForm((f) => ({ ...f, sendNotification: e.target.checked }))}
                      />
                      {t("items.editSendNotification")}
                    </label>
                    {addEntryForm.sendNotification ? (
                      <label style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", display: "flex", flexDirection: "column", gap: "0.25rem", maxWidth: "16rem" }}>
                        {t("items.editNotifyBefore")}
                        <select
                          className="bd-input"
                          value={addEntryForm.reminderMinutesBefore}
                          onChange={(e) =>
                            setAddEntryForm((f) => ({ ...f, reminderMinutesBefore: Number(e.target.value) }))
                          }
                          style={{ padding: "0.25rem 0.5rem" }}
                        >
                          {NOTIFY_BEFORE_EVENT_OPTIONS.map((m) => (
                            <option key={m} value={m}>
                              {m === 0
                                ? t("items.notifyAtDeadlineOrEvent")
                                : m === 60
                                  ? t("items.notifyOneHourBefore")
                                  : t("items.minutesBefore", { n: m })}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )}
            {addEntryForm.itemType === "calendar" && (
              <div style={{ borderTop: "1px solid var(--border-default)", paddingTop: "0.75rem", marginBottom: "1rem" }}>
                <h4 style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", margin: "0 0 0.5rem" }}>
                  {t("items.viewCalendar")}
                </h4>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem 1rem", alignItems: "center" }}>
                  <label style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
                    {t("items.editCalendarDate")}
                    <input
                      type="date"
                      className="bd-input"
                      value={addEntryForm.scheduledAt}
                      onChange={(e) => setAddEntryForm((f) => ({ ...f, scheduledAt: e.target.value }))}
                      style={{ marginLeft: "0.35rem", padding: "0.25rem 0.5rem" }}
                    />
                  </label>
                  <label style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
                    {t("items.editCalendarTime")}
                    <input
                      type="time"
                      className="bd-input"
                      value={addEntryForm.scheduledTime}
                      onChange={(e) => setAddEntryForm((f) => ({ ...f, scheduledTime: e.target.value }))}
                      style={{ marginLeft: "0.35rem", padding: "0.25rem 0.5rem" }}
                    />
                  </label>
                  <label style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
                    {t("items.editCalendarRepeats")}
                    <select
                      className="bd-input"
                      value={addEntryForm.recurrence}
                      onChange={(e) => setAddEntryForm((f) => ({ ...f, recurrence: e.target.value }))}
                      style={{ marginLeft: "0.35rem", padding: "0.25rem 0.5rem" }}
                    >
                      <option value="none">{t("items.recurrenceNone")}</option>
                      <option value="daily">{t("items.recurrenceDaily")}</option>
                      <option value="weekly">{t("items.recurrenceWeekly")}</option>
                      <option value="monthly">{t("items.recurrenceMonthly")}</option>
                    </select>
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
                    <input
                      type="checkbox"
                      checked={addEntryForm.sendNotification}
                      onChange={(e) => setAddEntryForm((f) => ({ ...f, sendNotification: e.target.checked }))}
                    />
                    {t("items.editSendNotification")}
                  </label>
                  {addEntryForm.sendNotification && (
                    <label style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", display: "flex", flexDirection: "column", gap: "0.25rem", minWidth: "12rem" }}>
                      {t("items.editNotifyBefore")}
                      <select
                        className="bd-input"
                        value={addEntryForm.reminderMinutesBefore}
                        onChange={(e) =>
                          setAddEntryForm((f) => ({ ...f, reminderMinutesBefore: Number(e.target.value) }))
                        }
                        style={{ padding: "0.25rem 0.5rem" }}
                      >
                        {NOTIFY_BEFORE_EVENT_OPTIONS.map((m) => (
                          <option key={m} value={m}>
                            {m === 0
                              ? t("items.notifyAtDeadlineOrEvent")
                              : m === 60
                                ? t("items.notifyOneHourBefore")
                                : t("items.minutesBefore", { n: m })}
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

function calendarDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Week strip starts Monday (ISO 8601 / European convention). `getDay()`: 0 = Sun … 6 = Sat. */
function startOfWeekMonday(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = x.getDay();
  const daysSinceMonday = (dow + 6) % 7;
  x.setDate(x.getDate() - daysSinceMonday);
  return x;
}

function localMidnightFromDateKey(key: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const [yy, mm, dd] = key.split("-").map(Number);
  return new Date(yy, mm - 1, dd);
}

function getScheduledItemsForCalendarDay(cellDate: Date, scheduledItems: ViewItem[]): ViewItem[] {
  const y = cellDate.getFullYear();
  const m = cellDate.getMonth();
  const day = cellDate.getDate();
  const dateStr = `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const cellTime = new Date(y, m, day).getTime();
  return scheduledItems.filter((it) => {
    const atKey = scheduledAtToDateKey(it.scheduledAt);
    if (!atKey) return false;
    const startDate = localMidnightFromDateKey(atKey);
    if (!startDate) return false;
    if (it.recurrence === "daily") {
      return cellTime >= startDate.getTime();
    }
    if (it.recurrence === "weekly") {
      const diffDays = Math.floor((cellTime - startDate.getTime()) / 86400000);
      return diffDays >= 0 && diffDays % 7 === 0;
    }
    if (it.recurrence === "monthly") {
      return cellTime >= startDate.getTime() && day === startDate.getDate();
    }
    return atKey === dateStr;
  });
}

function CalendarView({
  items,
  showEntryTitles = true,
  onSchedule: _onSchedule,
  onEdit,
  onItemContextMenu,
  onSetTaskCompleted,
  onDelete,
  isMobile = false,
}: {
  items: ViewItem[];
  showEntryTitles?: boolean;
  onSchedule: (id: string, schedule: { scheduledAt?: string | null; scheduledTime?: string | null; recurrence?: string | null; sendNotification?: boolean }) => void;
  onEdit: (item: ViewItem) => void;
  onItemContextMenu?: (e: React.MouseEvent, id: string, domain: string, currentType: string) => void;
  onSetTaskCompleted?: (id: string, completed: boolean) => void;
  onDelete?: (id: string, skipConfirm?: boolean) => void;
  isMobile?: boolean;
}) {
  const { t } = useI18n();
  const bindMobileField = useMobileEntryFieldGestures(isMobile, onItemContextMenu);
  const [swipeOpenId, setSwipeOpenId] = useState<string | null>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  /** Increment + direction drives slide-in animation when changing weeks. */
  const [weekStripSlideKey, setWeekStripSlideKey] = useState(0);
  const [weekStripSlideDir, setWeekStripSlideDir] = useState<"prev" | "next" | null>(null);

  const [selectedDate, setSelectedDate] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  });

  const todayNorm = (() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  })();

  const scheduledItems = useMemo(
    () => items.filter((it) => it.scheduledAt || (it.recurrence && it.recurrence !== "none")),
    [items]
  );

  const weekStart = useMemo(() => startOfWeekMonday(selectedDate), [selectedDate]);

  const weekDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        return d;
      }),
    [weekStart]
  );

  const dayItems = useMemo(
    () => getScheduledItemsForCalendarDay(selectedDate, scheduledItems),
    [selectedDate, scheduledItems]
  );

  const shiftWeek = useCallback((dir: number, options?: { animate?: boolean }) => {
    const animate = options?.animate !== false;
    if (animate) {
      setWeekStripSlideDir(dir > 0 ? "next" : "prev");
      setWeekStripSlideKey((k) => k + 1);
    }
    setSelectedDate((d) => {
      const n = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      n.setDate(n.getDate() + dir * 7);
      return n;
    });
  }, []);

  const goToday = useCallback(() => {
    const n = new Date();
    const target = new Date(n.getFullYear(), n.getMonth(), n.getDate());
    setSelectedDate((prev) => {
      const wPrev = startOfWeekMonday(prev).getTime();
      const wNext = startOfWeekMonday(target).getTime();
      if (wPrev !== wNext) {
        setWeekStripSlideDir(wNext > wPrev ? "next" : "prev");
        setWeekStripSlideKey((k) => k + 1);
      }
      return target;
    });
  }, []);

  const SWIPE_MIN_PX = 48;
  const onWeekTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);
  const onWeekTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (touchStartX.current == null || touchStartY.current == null) return;
      const dx = e.changedTouches[0].clientX - touchStartX.current;
      const dy = e.changedTouches[0].clientY - touchStartY.current;
      touchStartX.current = null;
      touchStartY.current = null;
      if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy)) return;
      if (dx > 0) shiftWeek(-1);
      else shiftWeek(1);
    },
    [shiftWeek]
  );

  const headerMonthLine = selectedDate.toLocaleDateString(undefined, { month: "long" });
  const headerMainLine = isSameCalendarDay(selectedDate, todayNorm)
    ? t("scope.dateFilterToday")
    : selectedDate.toLocaleDateString(undefined, { weekday: "long" });

  const gap = isMobile ? "0.5rem" : "0.85rem";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap, flex: 1, minHeight: 0 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "0.65rem" }}>
        <div>
          <p
            style={{
              fontSize: isMobile ? "0.75rem" : "0.8125rem",
              fontWeight: 500,
              color: "var(--text-tertiary)",
              margin: 0,
              letterSpacing: "0.02em",
            }}
          >
            {headerMonthLine}
          </p>
          <h2
            style={{
              fontSize: isMobile ? "1.25rem" : "1.35rem",
              fontWeight: 700,
              color: "var(--text-primary)",
              margin: "0.12rem 0 0",
              letterSpacing: "-0.02em",
            }}
          >
            {headerMainLine}
          </h2>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
          <button type="button" className="bd-btn" onClick={goToday} style={{ padding: "0.4rem 0.65rem", fontSize: "0.8125rem" }}>
            {t("scope.dateFilterToday")}
          </button>
          <button type="button" className="bd-btn" onClick={() => shiftWeek(-1)} style={{ padding: "0.4rem 0.5rem" }} aria-label={t("items.calendarWeekPrev")}>
            ‹
          </button>
          <button type="button" className="bd-btn" onClick={() => shiftWeek(1)} style={{ padding: "0.4rem 0.5rem" }} aria-label={t("items.calendarWeekNext")}>
            ›
          </button>
        </div>
      </div>

      <div
        className="bd-calendar-week-strip-viewport"
        role="group"
        aria-label={t("items.viewCalendar")}
        onTouchStart={onWeekTouchStart}
        onTouchEnd={onWeekTouchEnd}
        style={{
          touchAction: "pan-y",
          userSelect: "none",
          WebkitUserSelect: "none",
          padding: isMobile ? "0.15rem 0" : "0.25rem 0",
        }}
      >
        <div
          key={weekStripSlideKey}
          className={
            weekStripSlideKey > 0 && weekStripSlideDir
              ? weekStripSlideDir === "next"
                ? "bd-calendar-week-strip-inner bd-calendar-week-strip-inner--in-next"
                : "bd-calendar-week-strip-inner bd-calendar-week-strip-inner--in-prev"
              : "bd-calendar-week-strip-inner"
          }
          style={{
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "stretch",
          }}
        >
          {weekDays.map((d) => {
            const sel = isSameCalendarDay(d, selectedDate);
            const letter = d.toLocaleDateString(undefined, { weekday: "narrow" });
            return (
              <button
                key={calendarDateKey(d)}
                type="button"
                onClick={() => setSelectedDate(new Date(d.getFullYear(), d.getMonth(), d.getDate()))}
                style={{
                  flex: 1,
                  minWidth: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "0.2rem",
                  padding: "0.35rem 0.1rem",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  borderRadius: 8,
                }}
              >
                <span style={{ fontSize: isMobile ? "0.68rem" : "0.72rem", fontWeight: 500, color: "var(--text-tertiary)", lineHeight: 1 }}>
                  {letter}
                </span>
                <span
                  style={{
                    width: isMobile ? 38 : 40,
                    height: isMobile ? 38 : 40,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: isMobile ? "0.9rem" : "0.95rem",
                    lineHeight: 1,
                    ...(sel
                      ? {
                          background: "var(--accent)",
                          color: "var(--bd-btn-primary-fg)",
                          boxShadow: "0 2px 10px color-mix(in srgb, var(--accent) 35%, transparent)",
                        }
                      : { color: "var(--text-primary)", background: "transparent" }),
                  }}
                >
                  {d.getDate()}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {isMobile ? (
        <p style={{ fontSize: "0.68rem", color: "var(--text-quaternary)", margin: "-0.05rem 0 0", textAlign: "center", lineHeight: 1.35 }}>
          {t("items.calendarSwipeHint")}
        </p>
      ) : null}

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: "auto",
          WebkitOverflowScrolling: "touch",
          display: "flex",
          flexDirection: "column",
          gap: isMobile ? "0.45rem" : "0.55rem",
          paddingTop: "0.35rem",
          paddingBottom: "var(--bd-view-bottom-pad)",
        }}
      >
        {dayItems.length === 0 ? (
          <div style={{ textAlign: "center", padding: "2.25rem 1rem 1.5rem" }}>
            <p style={{ margin: 0, fontSize: isMobile ? "1rem" : "1.05rem", fontWeight: 600, color: "var(--text-primary)" }}>{t("items.calendarFreeDayTitle")}</p>
            <p style={{ margin: "0.45rem 0 0", fontSize: "0.875rem", color: "var(--text-tertiary)" }}>{t("items.calendarFreeDayHint")}</p>
          </div>
        ) : (
          <div className="bd-todo-list-card">
            {dayItems.map((it) => {
              const schedKey = scheduledAtToDateKey(it.scheduledAt);
              const todayKey = `${todayNorm.getFullYear()}-${String(todayNorm.getMonth() + 1).padStart(2, "0")}-${String(todayNorm.getDate()).padStart(2, "0")}`;
              const past = schedKey != null && schedKey < todayKey;
              const calTaskRec = parseTaskRecurrence(it.recurrence);
              const completed = isTaskRow(it) && calTaskRec.isRecurring
                ? isRecurringTaskDoneToday(it.recurrence)
                : isCompletedInCalendarView(it);
              const isTask = isTaskRow(it);
              const shoppingDone =
                it.itemType === "shopping" &&
                (it.progress === "completed" || it.kanbanColumn === "completed");
              const typeColor = TYPE_BAR_COLORS[it.itemType] ?? TYPE_BAR_COLORS.default;
              return (
                <SwipeDeleteRow
                  key={it.id}
                  entryId={it.id}
                  swipeOpenId={swipeOpenId}
                  setSwipeOpenId={setSwipeOpenId}
                  onDelete={() => onDelete?.(it.id, true)}
                  disabled={!onDelete}
                  slideSurface="elevated"
                >
                  <div
                    className="bd-todo-row bd-todo-row--single-line"
                    data-bd-mobile-entry={isMobile && onItemContextMenu ? "1" : undefined}
                    onClick={!isMobile || !onItemContextMenu ? () => onEdit(it) : undefined}
                    {...(isMobile && onItemContextMenu ? bindMobileField(it, () => onEdit(it)) : {})}
                    onDoubleClick={() => onEdit(it)}
                    onContextMenu={
                      onItemContextMenu && !isMobile
                        ? (e) => { e.preventDefault(); onItemContextMenu(e, it.id, it.domain, it.itemType); }
                        : undefined
                    }
                    style={{ cursor: "pointer", opacity: past ? 0.65 : 1 }}
                  >
                    <div className="bd-todo-row-lead">
                      {isTask ? (
                        <label
                          className="bd-todo-checkbox-wrap"
                          data-bd-no-swipe
                          onClick={(e) => e.stopPropagation()}
                          onPointerDown={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            className="bd-todo-checkbox"
                            data-bd-no-swipe
                            checked={completed}
                            onChange={(e) => { e.stopPropagation(); onSetTaskCompleted?.(it.id, e.target.checked); }}
                            aria-label={completed ? t("items.taskToggleOpen") : t("items.taskToggleDone")}
                          />
                        </label>
                      ) : it.itemType === "shopping" ? (
                        <button
                          type="button"
                          className="bd-todo-row-type-lead bd-shopping-toggle"
                          data-bd-no-swipe
                          onClick={(e) => { e.stopPropagation(); onSetTaskCompleted?.(it.id, !shoppingDone); }}
                          onPointerDown={(e) => e.stopPropagation()}
                          aria-pressed={shoppingDone}
                          aria-label={shoppingDone ? t("items.taskToggleOpen") : t("items.taskToggleDone")}
                          title={shoppingDone ? t("items.taskToggleOpen") : t("items.taskToggleDone")}
                          style={{ color: past ? "var(--text-quaternary)" : typeColor }}
                        >
                          <EntryTypeIcon type="shopping" size={20} />
                        </button>
                      ) : (
                        <span
                          className="bd-todo-row-type-lead"
                          style={{ color: past ? "var(--text-quaternary)" : typeColor }}
                          title={entryTypeLabel(it.itemType || "note", t)}
                          aria-hidden
                        >
                          <EntryTypeIcon type={it.itemType || "note"} size={20} />
                        </span>
                      )}
                    </div>
                    <div className="bd-todo-row-body">
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: "0.9rem",
                          color: past ? "var(--text-tertiary)" : "var(--text-primary)",
                          textDecoration: (completed || shoppingDone) ? "line-through" : undefined,
                          opacity: (completed || shoppingDone) ? 0.52 : 1,
                          wordBreak: "break-word",
                          overflowWrap: "anywhere",
                        }}
                      >
                        {it.scheduledTime && (
                          <span style={{ marginRight: "0.4rem", opacity: 0.72, fontWeight: 500, fontSize: "0.8rem" }}>{it.scheduledTime}</span>
                        )}
                        {entryPrimaryLine(it, showEntryTitles)}
                      </div>
                    </div>
                  </div>
                </SwipeDeleteRow>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

type ReorderDragPreview = { draggedId: string; overId: string; place: "before" | "after" };

function applyReorderPreview(items: ViewItem[], preview: ReorderDragPreview | null): ViewItem[] {
  if (!preview) return items;
  const { draggedId, overId, place } = preview;
  if (draggedId === overId) return items;
  const ids = items.map((i) => i.id);
  const from = ids.indexOf(draggedId);
  const overIdx = ids.indexOf(overId);
  if (from < 0 || overIdx < 0) return items;
  const next = [...ids];
  next.splice(from, 1);
  let insertAt = next.indexOf(overId);
  if (place === "after") insertAt += 1;
  next.splice(insertAt, 0, draggedId);
  return next.map((id) => items.find((i) => i.id === id)).filter(Boolean) as ViewItem[];
}

function mergeDragPlace(e: DragEvent, rowEl: HTMLElement | null | undefined): "before" | "after" {
  if (!rowEl || typeof rowEl.getBoundingClientRect !== "function") return "before";
  const r = rowEl.getBoundingClientRect();
  if (!Number.isFinite(r.height) || r.height <= 0) return "before";
  return e.clientY < r.top + r.height / 2 ? "before" : "after";
}

/** Custom drag snapshot: must keep the node in the DOM until drag ends (immediate removal → blank/black ghost). */
function attachRowDragImage(e: DragEvent, handleEl: HTMLElement) {
  const dt = e.dataTransfer;
  if (!dt) return;

  const row = handleEl.closest("[data-bd-entry-id]") as HTMLElement | null;
  if (!row) return;

  const rect = row.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return;

  const clone = row.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(".bd-entry-drag-handle").forEach((el) => el.remove());

  const cs = window.getComputedStyle(row);
  const bg = cs.backgroundColor && cs.backgroundColor !== "rgba(0, 0, 0, 0)" ? cs.backgroundColor : "";
  const surface = bg || "var(--bg-elevated)";

  clone.style.cssText = [
    "position:fixed",
    "left:-9999px",
    "top:0",
    `width:${rect.width}px`,
    `max-width:${rect.width}px`,
    `box-sizing:${cs.boxSizing || "border-box"}`,
    "margin:0",
    "opacity:0.98",
    "pointer-events:none",
    "z-index:2147483647",
    "box-shadow:0 12px 36px rgba(0,0,0,0.22)",
    "border-radius:12px",
    `background:${surface}`,
    `color:${cs.color}`,
    "overflow:hidden",
  ].join(";");

  document.body.appendChild(clone);

  const ox = Math.min(Math.max(6, e.clientX - rect.left), Math.max(6, rect.width - 6));
  const oy = Math.min(Math.max(6, e.clientY - rect.top), Math.max(6, rect.height - 6));

  try {
    dt.setDragImage(clone, ox, oy);
  } catch {
    clone.remove();
    return;
  }

  const cleanup = () => {
    document.removeEventListener("dragend", cleanup, true);
    clone.remove();
  };
  document.addEventListener("dragend", cleanup, true);
  window.setTimeout(() => {
    if (clone.parentNode) cleanup();
  }, 60_000);
}

const MOBILE_LONG_PRESS_MS = 520;
const MOBILE_TAP_MAX_MS = 420;
const MOBILE_MOVE_CANCEL_PX = 14;
/** Max gap between two taps for double-tap; delayed single-tap waits this long so double can cancel it */
const MOBILE_DOUBLE_TAP_WINDOW_MS = 300;

function syntheticContextMenuEvent(clientX: number, clientY: number): ReactMouseEvent {
  return {
    clientX,
    clientY,
    preventDefault: () => {},
    stopPropagation: () => {},
  } as ReactMouseEvent;
}

type MobileFieldSlot = {
  pointerId: number;
  x0: number;
  y0: number;
  t0: number;
  /** Browser timer id (`window.setTimeout`); avoid `NodeJS.Timeout` from merged typings. */
  timer: number | null;
  longFired: boolean;
};

type PendingDeferredSingleTap = { itemId: string; timer: number };

/** Touch: long-press opens context menu; short tap = inline edit or delayed when double-tap also requested; double-tap opens full editor. */
export function useMobileEntryFieldGestures(
  isMobile: boolean,
  onItemContextMenu?: (e: ReactMouseEvent, id: string, domain: string, currentType: string) => void
) {
  const slotRef = useRef<MobileFieldSlot | null>(null);
  const pendingDeferredSingleRef = useRef<PendingDeferredSingleTap | null>(null);
  const doubleTapFirstRef = useRef<{ itemId: string; t: number } | null>(null);

  const clearDeferredSingle = useCallback(() => {
    const p = pendingDeferredSingleRef.current;
    if (p) window.clearTimeout(p.timer);
    pendingDeferredSingleRef.current = null;
  }, []);

  const clearSlot = useCallback(() => {
    const s = slotRef.current;
    if (s?.timer) window.clearTimeout(s.timer);
    slotRef.current = null;
  }, []);

  const bindField = useCallback(
    (it: ViewItem, onShortTap?: () => void, onDoubleTap?: () => void) => {
      if (!isMobile) return {};
      const allowMenu = Boolean(onItemContextMenu);
      const hasShort = Boolean(onShortTap);
      const hasDouble = Boolean(onDoubleTap);
      if (!allowMenu && !hasShort && !hasDouble) return {};

      return {
        onPointerDown: (e: ReactPointerEvent) => {
          if (e.pointerType !== "touch") return;
          e.stopPropagation();
          clearSlot();
          clearDeferredSingle();
          if (doubleTapFirstRef.current && doubleTapFirstRef.current.itemId !== it.id) {
            doubleTapFirstRef.current = null;
          }
          const { pointerId, clientX, clientY } = e;
          const t0 = Date.now();
          const timer: number | null = allowMenu
            ? (window.setTimeout(() => {
                const cur = slotRef.current;
                if (!cur || cur.pointerId !== pointerId || !onItemContextMenu) return;
                cur.longFired = true;
                cur.timer = null;
                try {
                  window.getSelection()?.removeAllRanges();
                } catch {
                  /* ignore */
                }
                onItemContextMenu(syntheticContextMenuEvent(clientX, clientY), it.id, it.domain, it.itemType);
              }, MOBILE_LONG_PRESS_MS) as unknown as number)
            : null;
          slotRef.current = {
            pointerId,
            x0: clientX,
            y0: clientY,
            t0,
            timer,
            longFired: false,
          };
        },
        onPointerMove: (e: ReactPointerEvent) => {
          const s = slotRef.current;
          if (!s || s.pointerId !== e.pointerId) return;
          const dx = e.clientX - s.x0;
          const dy = e.clientY - s.y0;
          if (dx * dx + dy * dy > MOBILE_MOVE_CANCEL_PX * MOBILE_MOVE_CANCEL_PX) clearSlot();
        },
        onPointerUp: (e: ReactPointerEvent) => {
          const s = slotRef.current;
          if (!s || s.pointerId !== e.pointerId) return;
          if (s.timer) window.clearTimeout(s.timer);
          const longFired = s.longFired;
          const elapsed = Date.now() - s.t0;
          const dx = e.clientX - s.x0;
          const dy = e.clientY - s.y0;
          const movedFar = dx * dx + dy * dy > MOBILE_MOVE_CANCEL_PX * MOBILE_MOVE_CANCEL_PX;
          clearSlot();
          if (longFired || movedFar) return;
          if (elapsed > MOBILE_TAP_MAX_MS) return;

          if (hasShort && hasDouble) {
            const pending = pendingDeferredSingleRef.current;
            if (pending && pending.itemId === it.id) {
              clearDeferredSingle();
              onDoubleTap!();
              return;
            }
            clearDeferredSingle();
            pendingDeferredSingleRef.current = {
              itemId: it.id,
              timer: window.setTimeout(() => {
                pendingDeferredSingleRef.current = null;
                onShortTap!();
              }, MOBILE_DOUBLE_TAP_WINDOW_MS) as unknown as number,
            };
            return;
          }

          if (hasDouble && !hasShort) {
            const first = doubleTapFirstRef.current;
            const now = Date.now();
            if (first && first.itemId === it.id && now - first.t < MOBILE_DOUBLE_TAP_WINDOW_MS) {
              doubleTapFirstRef.current = null;
              onDoubleTap!();
            } else {
              doubleTapFirstRef.current = { itemId: it.id, t: now };
            }
            return;
          }

          if (hasShort) onShortTap!();
        },
        onPointerCancel: (e: ReactPointerEvent) => {
          if (slotRef.current?.pointerId === e.pointerId) clearSlot();
        },
      };
    },
    [isMobile, onItemContextMenu, clearSlot, clearDeferredSingle]
  );

  useEffect(() => {
    const onEnd = (ev: Event) => {
      const pid = (ev as CustomEvent<{ pointerId: number }>).detail?.pointerId;
      if (pid === undefined) return;
      if (slotRef.current?.pointerId === pid) clearSlot();
    };
    window.addEventListener("bd-mobile-field-gesture-end", onEnd);
    return () => window.removeEventListener("bd-mobile-field-gesture-end", onEnd);
  }, [clearSlot]);

  return bindField;
}

/** Reveal width behind the row (icon-only delete control). */
const SWIPE_DELETE_WIDTH_PX = 56;
/** Map finger movement to slide: >1 opens fully with less horizontal travel. */
const SWIPE_DRAG_GAIN = 2.05;
const SWIPE_LOCK_THRESHOLD_PX = 4;
/** Release: open if past this fraction of width (or fling left). */
const SWIPE_OPEN_COMMIT_RATIO = 0.2;
/** Pointer velocity (px/s): negative x = moving left / opening. */
const SWIPE_FLING_OPEN_VX = -280;
const SWIPE_FLING_CLOSE_VX = 420;

type SwipeDeleteRowProps = {
  entryId: string;
  swipeOpenId: string | null;
  setSwipeOpenId: Dispatch<SetStateAction<string | null>>;
  onDelete: () => void;
  disabled?: boolean;
  /** Sliding panel background so content covers the delete strip when closed */
  slideSurface: "elevated" | "canvas";
  children: ReactNode;
};

export function SwipeDeleteRow({
  entryId,
  swipeOpenId,
  setSwipeOpenId,
  onDelete,
  disabled,
  slideSurface,
  children,
}: SwipeDeleteRowProps) {
  const { t } = useI18n();
  const [offset, setOffset] = useState(0);
  const [transitioning, setTransitioning] = useState(true);
  const offsetRef = useRef(0);
  offsetRef.current = offset;
  const drag = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startOffset: number;
    lock: "none" | "h" | "v";
  } | null>(null);
  const swipeVelSamplesRef = useRef<{ x: number; t: number }[]>([]);

  useEffect(() => {
    if (swipeOpenId !== entryId) {
      setOffset((o) => (o > 0 ? 0 : o));
    }
  }, [swipeOpenId, entryId]);

  const slideClass =
    slideSurface === "elevated"
      ? "bd-swipe-delete-slide bd-swipe-delete-slide--elevated"
      : "bd-swipe-delete-slide bd-swipe-delete-slide--canvas";

  /** Commit open/closed snap after a horizontal swipe ends (pointer up, cancel, or implicit capture loss). */
  const commitHorizontalSwipeEnd = (pointerId: number, slideEl: HTMLElement) => {
    const d = drag.current;
    if (!d || d.pointerId !== pointerId || d.lock !== "h") return;
    /** Clear before `releasePointerCapture` so a synchronous `lostpointercapture` does not re-enter this commit. */
    drag.current = null;
    try {
      slideEl.releasePointerCapture(pointerId);
    } catch {
      /* already released — common on mobile when the browser steals the gesture */
    }
    const final = offsetRef.current;
    setTransitioning(true);
    const samples = swipeVelSamplesRef.current;
    let vx = 0;
    if (samples.length >= 2) {
      const last = samples[samples.length - 1];
      const first = samples[0];
      const dt = (last.t - first.t) / 1000;
      if (dt > 0.012) vx = (last.x - first.x) / dt;
    }
    swipeVelSamplesRef.current = [];
    const commitLine = SWIPE_DELETE_WIDTH_PX * SWIPE_OPEN_COMMIT_RATIO;
    let snapOpen: boolean;
    if (vx < SWIPE_FLING_OPEN_VX) snapOpen = true;
    else if (vx > SWIPE_FLING_CLOSE_VX) snapOpen = false;
    else snapOpen = final >= commitLine;
    if (snapOpen) {
      const full = SWIPE_DELETE_WIDTH_PX;
      offsetRef.current = full;
      setSwipeOpenId(entryId);
      setOffset(full);
    } else {
      offsetRef.current = 0;
      setOffset(0);
      setSwipeOpenId((prev) => (prev === entryId ? null : prev));
    }
    window.dispatchEvent(
      new CustomEvent("bd-mobile-field-gesture-end", { detail: { pointerId } })
    );
  };

  const finishPointer = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    if (d.lock === "h") {
      commitHorizontalSwipeEnd(e.pointerId, e.currentTarget as HTMLElement);
    } else {
      drag.current = null;
      setTransitioning(true);
      window.dispatchEvent(
        new CustomEvent("bd-mobile-field-gesture-end", { detail: { pointerId: e.pointerId } })
      );
    }
  };

  return (
    <div
      className="bd-swipe-delete-wrap"
      style={{ ["--bd-swipe-delete-w" as string]: `${SWIPE_DELETE_WIDTH_PX}px` }}
    >
      <div className="bd-swipe-delete-actions" aria-hidden={offset === 0}>
        <button
          type="button"
          className="bd-swipe-delete-btn"
          data-bd-no-swipe
          aria-label={t("items.ariaDeleteEntry")}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
            setSwipeOpenId((prev) => (prev === entryId ? null : prev));
            offsetRef.current = 0;
            setOffset(0);
          }}
        >
          <Trash2 size={22} aria-hidden />
        </button>
      </div>
      <div
        className={slideClass}
        style={{
          transform: `translate3d(${-offset}px, 0, 0)`,
          transition: transitioning ? "transform 0.14s var(--bd-ease-out)" : "none",
        }}
        onPointerDownCapture={(e) => {
          if (disabled) return;
          if (e.pointerType === "mouse" && e.button !== 0) return;
          const el = e.target as HTMLElement;
          if (el.closest("[data-bd-no-swipe]")) return;
          swipeVelSamplesRef.current = [{ x: e.clientX, t: performance.now() }];
          setTransitioning(false);
          drag.current = {
            pointerId: e.pointerId,
            startX: e.clientX,
            startY: e.clientY,
            startOffset: offsetRef.current,
            lock: "none",
          };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d || d.pointerId !== e.pointerId) return;
          const dx = e.clientX - d.startX;
          const dy = e.clientY - d.startY;
          if (d.lock === "none") {
            if (Math.abs(dx) < SWIPE_LOCK_THRESHOLD_PX && Math.abs(dy) < SWIPE_LOCK_THRESHOLD_PX) return;
            // Bias horizontal: only treat as vertical scroll when clearly more vertical than horizontal.
            /* Prefer horizontal swipe: require a clearly vertical intent before handing off to scroll */
            if (Math.abs(dy) > Math.abs(dx) * 1.45) {
              d.lock = "v";
              drag.current = null;
              swipeVelSamplesRef.current = [];
              setTransitioning(true);
              return;
            }
            d.lock = "h";
            try {
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            } catch {
              /* ignore */
            }
          }
          if (d.lock !== "h") return;
          e.preventDefault();
          const now = performance.now();
          const arr = swipeVelSamplesRef.current;
          arr.push({ x: e.clientX, t: now });
          while (arr.length > 1 && now - arr[0].t > 140) arr.shift();
          const next = Math.min(
            SWIPE_DELETE_WIDTH_PX,
            Math.max(0, d.startOffset - dx * SWIPE_DRAG_GAIN)
          );
          offsetRef.current = next;
          setOffset(next);
        }}
        onPointerUp={finishPointer}
        onPointerCancel={finishPointer}
        onLostPointerCapture={(e) => {
          const d = drag.current;
          if (d && d.pointerId === e.pointerId && d.lock === "h") {
            commitHorizontalSwipeEnd(e.pointerId, e.currentTarget as HTMLElement);
            return;
          }
          drag.current = null;
          setTransitioning(true);
        }}
      >
        {children}
      </div>
    </div>
  );
}

function ListView({
  items,
  showEntryTitles = true,
  isMobile = false,
  onSetTaskCompleted,
  onDelete,
  onItemContextMenu,
  onEdit,
  onUpdate,
  reorderEnabled = false,
  onReorder,
  mode,
  onModeChange,
  searchFilter = "",
  onSearchFilterChange,
  showToolbar = false,
}: {
  items: ViewItem[];
  showEntryTitles?: boolean;
  isMobile?: boolean;
  onSetTaskCompleted: (id: string, completed: boolean) => void;
  onDelete: (id: string, skipConfirm?: boolean) => void;
  onItemContextMenu?: (e: React.MouseEvent, id: string, domain: string, currentType: string) => void;
  onEdit?: (item: ViewItem) => void;
  onUpdate?: (id: string, updates: { title?: string; content?: string }) => void;
  reorderEnabled?: boolean;
  onReorder?: (orderedIds: string[]) => void;
  mode?: string;
  onModeChange?: (mode: "work" | "personal" | "all") => void;
  searchFilter?: string;
  onSearchFilterChange?: (value: string) => void;
  /** Show the mobile-only search field + All/Work/Personal segmented control above the list. */
  showToolbar?: boolean;
}) {
  const { t } = useI18n();
  const bindMobileField = useMobileEntryFieldGestures(isMobile, onItemContextMenu);
  const [editing, setEditing] = useState<{ id: string; field: "title" | "content"; value: string } | null>(null);
  const [reorderPreview, setReorderPreview] = useState<ReorderDragPreview | null>(null);
  const [swipeOpenId, setSwipeOpenId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const listItemsOrdered = useMemo(
    () => (reorderEnabled && reorderPreview ? applyReorderPreview(items, reorderPreview) : items),
    [items, reorderEnabled, reorderPreview]
  );

  useEffect(() => {
    if (!editing) return;
    if (editing.field === "title") inputRef.current?.focus();
    else textareaRef.current?.focus();
  }, [editing]);

  useEffect(() => {
    if (!showEntryTitles && editing?.field === "title") setEditing(null);
  }, [showEntryTitles, editing?.field]);

  const handleFieldBlur = (id: string, field: "title" | "content", value: string, it: ViewItem) => {
    if (!onUpdate) {
      setEditing(null);
      return;
    }
    const trimmed = value.trim();
    const currentTitle = it.title ?? "";
    const currentContent = (it.content ?? "").trim();
    if (field === "title") {
      if (trimmed !== currentTitle) onUpdate(id, { title: trimmed || currentTitle });
    } else if (trimmed !== currentContent) {
      onUpdate(id, { content: trimmed });
    }
    setEditing(null);
  };

  const commitReorderDrop = (e: DragEvent, targetId: string) => {
    e.preventDefault();
    if (!onReorder) return;
    const fromId = e.dataTransfer.getData("text/plain");
    if (!fromId) return;
    const el = e.currentTarget as HTMLElement;
    const place = mergeDragPlace(e, el);
    const ordered = applyReorderPreview(items, { draggedId: fromId, overId: targetId, place });
    onReorder(ordered.map((i) => i.id));
    setReorderPreview(null);
  };

  const renderEntry = (it: ViewItem, index: number) => {
    const ep = enterStaggerProps(index);
    const taskRec = parseTaskRecurrence(it.recurrence);
    // For recurring tasks, only show as completed if done specifically today
    const taskCompleted = isTaskRow(it) && (
      taskRec.isRecurring ? isRecurringTaskDoneToday(it.recurrence) : isTaskCompleted(it)
    );
    const shoppingDone =
      it.itemType === "shopping" &&
      (it.progress === "completed" || it.kanbanColumn === "completed");
    const struckThrough = taskCompleted || shoppingDone;
    let scheduleLabel: string | null = null;
    if (it.itemType === "shopping" && it.scheduledAt) {
      const sk = scheduledAtToDateKey(it.scheduledAt);
      const d = sk ? localMidnightFromDateKey(sk) : null;
      if (!d) scheduleLabel = null;
      else {
        const ds = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
        scheduleLabel = t("items.shoppingDueShort", { date: ds });
      }
    } else if (
      it.itemType === "calendar" ||
      ((!isTaskRow(it) && it.scheduledAt) || (it.recurrence && it.recurrence !== "none"))
    ) {
      scheduleLabel = formatCalendarScheduleLabel(it);
    }
    const hideRedundantBody =
      showEntryTitles && !!(it.content ?? "").trim() && isContentRedundantWithTitle(it.title, it.content);
    const bodySnippet = hideRedundantBody ? "" : (it.content ?? "").trim();
    const isTask = isTaskRow(it);

    const primaryTitleStyle: CSSProperties = {
      fontWeight: 600,
      fontSize: "1rem",
      color: "var(--text-primary)",
      wordBreak: "break-word",
      overflowWrap: "anywhere",
      cursor: onUpdate ? "text" : undefined,
      textDecoration: struckThrough ? "line-through" : undefined,
      opacity: struckThrough ? 0.52 : 1,
    };

    const isDraggingRow = reorderPreview?.draggedId === it.id;
    const dropHint =
      reorderPreview &&
      reorderPreview.draggedId !== it.id &&
      reorderPreview.overId === it.id &&
      (reorderPreview.place === "before"
        ? { boxShadow: "inset 0 3px 0 0 var(--accent)" }
        : { boxShadow: "inset 0 -3px 0 0 var(--accent)" });

    const showsBodySnippetBelow =
      showEntryTitles &&
      !!bodySnippet &&
      !(onUpdate && editing?.id === it.id && editing.field === "content");
    const hasSecondaryLineNoTitles =
      !showEntryTitles &&
      !(onUpdate && editing?.id === it.id && editing.field === "content") &&
      (it.content ?? "").trim().split("\n").length > 1;
    const isEditingContentField = !!(onUpdate && editing?.id === it.id && editing.field === "content");
    const singleLineRow =
      !scheduleLabel &&
      !isEditingContentField &&
      !showsBodySnippetBelow &&
      !hasSecondaryLineNoTitles;

    return (
      <SwipeDeleteRow
        key={it.id}
        entryId={it.id}
        swipeOpenId={swipeOpenId}
        setSwipeOpenId={setSwipeOpenId}
        onDelete={() => onDelete(it.id, true)}
        disabled={!!(editing && editing.id === it.id)}
        slideSurface="elevated"
      >
      <div
        className={`bd-todo-row${singleLineRow ? " bd-todo-row--single-line" : ""} ${ep.className}`}
        data-bd-entry-id={it.id}
        data-bd-mobile-entry={isMobile && onItemContextMenu ? "1" : undefined}
        onDoubleClick={() => onEdit?.(it)}
        onContextMenu={
          onItemContextMenu && !isMobile ? (e) => { e.preventDefault(); onItemContextMenu(e, it.id, it.domain, it.itemType); } : undefined
        }
        onDragOver={
          reorderEnabled && onReorder
            ? (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setReorderPreview((prev) => {
                  if (!prev) return prev;
                  if (prev.draggedId === it.id) return prev;
                  const place = mergeDragPlace(e, e.currentTarget as HTMLElement);
                  if (prev.overId === it.id && prev.place === place) return prev;
                  return { ...prev, overId: it.id, place };
                });
              }
            : undefined
        }
        onDrop={reorderEnabled && onReorder ? (e) => commitReorderDrop(e, it.id) : undefined}
        style={{
          ...ep.style,
          cursor: onEdit && (!editing || editing.id !== it.id) ? "pointer" : undefined,
          opacity: isDraggingRow ? 0.38 : 1,
          ...dropHint,
        }}
      >
        <div className="bd-todo-row-lead">
          {reorderEnabled && onReorder ? (
            <span
              className="bd-entry-drag-handle"
              data-bd-no-swipe
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("text/plain", it.id);
                e.dataTransfer.effectAllowed = "move";
                setReorderPreview({ draggedId: it.id, overId: it.id, place: "before" });
                attachRowDragImage(e, e.currentTarget as HTMLElement);
              }}
              onDragEnd={() => setReorderPreview(null)}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              title={t("items.dragToReorder")}
              aria-label={t("items.dragToReorder")}
            >
              <GripVertical size={14} aria-hidden />
            </span>
          ) : null}
          {isTask ? (
            <label
              className="bd-todo-checkbox-wrap"
              data-bd-no-swipe
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <input
                type="checkbox"
                className="bd-todo-checkbox"
                data-bd-no-swipe
                checked={taskCompleted}
                onChange={(e) => {
                  e.stopPropagation();
                  onSetTaskCompleted(it.id, e.target.checked);
                }}
                aria-label={taskCompleted ? t("items.taskToggleOpen") : t("items.taskToggleDone")}
              />
            </label>
          ) : it.itemType === "shopping" ? (
            <button
              type="button"
              className="bd-todo-row-type-lead bd-shopping-toggle"
              data-bd-no-swipe
              onClick={(e) => { e.stopPropagation(); onSetTaskCompleted(it.id, !shoppingDone); }}
              onPointerDown={(e) => e.stopPropagation()}
              aria-pressed={shoppingDone}
              aria-label={shoppingDone ? t("items.taskToggleOpen") : t("items.taskToggleDone")}
              title={shoppingDone ? t("items.taskToggleOpen") : t("items.taskToggleDone")}
            >
              <EntryTypeIcon type="shopping" size={20} />
            </button>
          ) : (
            <span className="bd-todo-row-type-lead" title={formatTypeLabel(it.itemType || "note", t)}>
              <EntryTypeIcon type={it.itemType} size={20} />
            </span>
          )}
        </div>
        <div className="bd-todo-row-body">
          {showEntryTitles ? (
            onUpdate && editing?.id === it.id && editing.field === "title" ? (
              <input
                ref={inputRef}
                type="text"
                data-bd-no-swipe
                value={editing.value}
                onChange={(e) => setEditing((prev) => (prev ? { ...prev, value: e.target.value } : null))}
                onBlur={() => handleFieldBlur(it.id, "title", editing.value, it)}
                onDoubleClick={(e) => e.stopPropagation()}
                {...(isMobile && onItemContextMenu ? bindMobileField(it) : {})}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.preventDefault();
                    setEditing(null);
                  }
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                }}
                aria-label={t("menu.edit")}
                style={{
                  ...primaryTitleStyle,
                  width: "100%",
                  margin: 0,
                  padding: "0.15rem 0.35rem",
                  border: "none",
                  borderRadius: 6,
                  background: "var(--bg-secondary)",
                  outline: "1px solid var(--bd-chrome-selected-border)",
                }}
              />
            ) : (
              <div
                onClick={
                  !isMobile && onUpdate ? () => setEditing({ id: it.id, field: "title", value: it.title ?? "" }) : undefined
                }
                {...(isMobile && onUpdate
                  ? bindMobileField(it, () => setEditing({ id: it.id, field: "title", value: it.title ?? "" }), () => onEdit?.(it))
                  : {})}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  onEdit?.(it);
                }}
                style={primaryTitleStyle}
              >
                {it.title?.trim() ? it.title : "—"}
              </div>
            )
          ) : (
            onUpdate && editing?.id === it.id && editing.field === "content" ? null : (
              <div
                onClick={
                  !isMobile && onUpdate
                    ? () => setEditing({ id: it.id, field: "content", value: it.content ?? "" })
                    : undefined
                }
                {...(isMobile && onUpdate
                  ? bindMobileField(it, () => setEditing({ id: it.id, field: "content", value: it.content ?? "" }), () =>
                      onEdit?.(it)
                    )
                  : {})}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  onEdit?.(it);
                }}
                style={primaryTitleStyle}
              >
                {entryPrimaryLine(it, false)}
              </div>
            )
          )}
          {(!hideRedundantBody || (onUpdate && editing?.id === it.id && editing.field === "content")) &&
            (onUpdate && editing?.id === it.id && editing.field === "content" ? (
              <textarea
                ref={textareaRef}
                data-bd-no-swipe
                value={editing.value}
                onChange={(e) => setEditing((prev) => (prev ? { ...prev, value: e.target.value } : null))}
                onBlur={() => handleFieldBlur(it.id, "content", editing.value, it)}
                onDoubleClick={(e) => e.stopPropagation()}
                {...(isMobile && onItemContextMenu ? bindMobileField(it) : {})}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.preventDefault();
                    setEditing(null);
                  }
                }}
                aria-label={t("menu.edit")}
                rows={4}
                style={{
                  fontSize: "0.875rem",
                  color: "var(--text-secondary)",
                  lineHeight: 1.45,
                  width: "100%",
                  margin: 0,
                  padding: "0.35rem 0.4rem",
                  resize: "vertical",
                  minHeight: 72,
                  border: "none",
                  borderRadius: 6,
                  background: "var(--bg-secondary)",
                  outline: "1px solid var(--bd-chrome-selected-border)",
                  fontFamily: "inherit",
                  wordBreak: "break-word",
                  overflowWrap: "anywhere",
                }}
              />
            ) : (
              showEntryTitles &&
              bodySnippet && (
                <div
                  onClick={
                    !isMobile && onUpdate
                      ? () => setEditing({ id: it.id, field: "content", value: it.content ?? "" })
                      : undefined
                  }
                  {...(isMobile && onUpdate
                    ? bindMobileField(it, () => setEditing({ id: it.id, field: "content", value: it.content ?? "" }), () =>
                        onEdit?.(it)
                      )
                    : {})}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    onEdit?.(it);
                  }}
                  style={{
                    fontSize: "0.8125rem",
                    color: "var(--text-secondary)",
                    lineHeight: 1.4,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                    wordBreak: "break-word",
                    overflowWrap: "anywhere",
                    cursor: onUpdate ? "text" : undefined,
                  }}
                >
                  {bodySnippet}
                </div>
              )
            ))}
          {!showEntryTitles &&
            !(onUpdate && editing?.id === it.id && editing.field === "content") &&
            (it.content ?? "").trim().split("\n").length > 1 && (
              <div
                onClick={
                  !isMobile && onUpdate
                    ? () => setEditing({ id: it.id, field: "content", value: it.content ?? "" })
                    : undefined
                }
                {...(isMobile && onUpdate
                  ? bindMobileField(it, () => setEditing({ id: it.id, field: "content", value: it.content ?? "" }), () =>
                      onEdit?.(it)
                    )
                  : {})}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  onEdit?.(it);
                }}
                style={{
                  fontSize: "0.8125rem",
                  color: "var(--text-secondary)",
                  lineHeight: 1.4,
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                  cursor: onUpdate ? "text" : undefined,
                }}
              >
                {(it.content ?? "").trim().split("\n").slice(1).join("\n").trim()}
              </div>
            )}
          {scheduleLabel && (
            <div style={{ fontSize: "0.72rem", color: "var(--text-tertiary)" }}>{scheduleLabel}</div>
          )}
          {isTask && taskRec.isRecurring && (
            <div className="bd-task-recur-badge">
              <RefreshCw size={11} strokeWidth={2.5} aria-hidden />
              {taskRec.pattern === "daily"
                ? t("items.taskRepeatEveryDay")
                : taskRec.days.length > 0
                  ? taskRec.days.map((d) => t(`habitReminder.dayShort.${["", "mon","tue","wed","thu","fri","sat","sun"][d]}`)).join(" · ")
                  : t("items.taskRepeatBadge")}
            </div>
          )}
        </div>
      </div>
      </SwipeDeleteRow>
    );
  };

  const TYPE_GROUP_ORDER = [
    "calendar", "task", "shopping", "reflection", "emotion", "idea", "note", "task_completed",
  ];

  const grouped = useMemo(() => {
    const map = new Map<string, ViewItem[]>();
    for (const it of listItemsOrdered) {
      const key = it.itemType || "note";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(it);
    }
    return [...map.entries()].sort(([a], [b]) => {
      const ai = TYPE_GROUP_ORDER.indexOf(a);
      const bi = TYPE_GROUP_ORDER.indexOf(b);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listItemsOrdered]);

  const showGroupHeaders = grouped.length > 1;

  return (
    <div
      className="bd-list-view bd-list-view--stacked"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        overflow: "auto",
        alignItems: "stretch",
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        boxSizing: "border-box",
      }}
    >
      {showToolbar && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <div className="bd-list-search-field">
            <Search size={17} strokeWidth={1.8} aria-hidden />
            <input
              type="search"
              value={searchFilter}
              onChange={(e) => onSearchFilterChange?.(e.target.value)}
              placeholder={t("scope.searchPlaceholder")}
              aria-label={t("scope.searchPlaceholder")}
            />
          </div>
          {onModeChange && (
            <div className="bd-list-segmented" role="group" aria-label={t("topBar.workspaceSwipe")}>
              {(["all", "work", "personal"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`bd-list-segmented-item${mode === m ? " bd-list-segmented-item--active" : ""}`}
                  onClick={() => onModeChange(m)}
                  aria-pressed={mode === m}
                >
                  {t(MODE_LABEL_KEY[m])}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {(() => {
        let globalIdx = 0;
        return grouped.map(([type, groupItems]) => {
          const groupStart = globalIdx;
          globalIdx += groupItems.length;
          return (
            <div key={type} className="bd-todo-list-card">
              {showGroupHeaders && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.4rem",
                    padding: "0.65rem 0.75rem 0.3rem",
                    color: "var(--text-tertiary)",
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    letterSpacing: "0.07em",
                    textTransform: "uppercase",
                    userSelect: "none",
                  }}
                >
                  <EntryTypeIcon type={type} size={13} />
                  {formatTypeLabel(type, t)}
                </div>
              )}
              {groupItems.map((it, localIdx) => renderEntry(it, groupStart + localIdx))}
            </div>
          );
        });
      })()}
    </div>
  );
}
