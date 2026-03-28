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
  type ReactNode,
  type SetStateAction,
} from "react";
import { createPortal } from "react-dom";
import { useI18n } from "@/lib/i18n";
import { playTaskCompleteCheer } from "@/lib/task-complete-sound";
import { getLastNewBatchIds, subscribeNewBatch } from "@/lib/newBatch";
import {
  BRAINDUMP_SUGGESTED_ITEM_TYPES_EVENT,
  type SuggestedItemTypeDetail,
} from "@/lib/item-types";
import { ENTRY_DISPLAY_CHANGED, entryPrimaryLine, loadShowEntryTitles } from "@/lib/entry-display-settings";
import {
  dateOnlyToStartOfDay,
  isPastScheduledForAiSuggestions,
  localDateTimeToDate,
  normalizeReminderMinutesBefore,
} from "@/lib/calendar-schedule";
import { PERSONAL_AREA_DEFAULTS } from "@/lib/personal-areas";
import {
  deriveEntryTitle,
  parseTextViewBlock,
  resolveTextSplitScope,
  splitTextViewBlocks,
  type TextViewCommitFocus,
} from "@/lib/text-view-entry-split";
import { isContentRedundantWithTitle } from "@/lib/entry-content-redundant";
import { filterItemsByDueDatePreset, type DueDateFilterPreset } from "@/lib/due-date-filter";

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
  priority?: number | null;
  listOrder?: number | null;
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
  dueDateFilter?: DueDateFilterPreset;
  reloadKey?: number;
  /** Mobile: render ScopeBar in one row with type / view / filter (passed from page when scope is shown). */
  scopeSlot?: ReactNode;
  /** Mobile: register content immediately left of the top-bar menu (e.g. AI next-actions). */
  onMobileTopBarBeforeMenuSlot?: (slot: ReactNode | null) => void;
  /** Desktop: register content immediately left of the scope search filter (e.g. AI next-actions). */
  onDesktopScopeBeforeFilterSlot?: (slot: ReactNode | null) => void;
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
  const combined = [...new Set([...PERSONAL_AREA_DEFAULTS, ...fromItems, ...custom])];
  return combined.sort((a, b) => a.localeCompare(b));
}

function loadPersonalAreaIdSetForSplit(): Set<string> {
  const s = new Set<string>([...PERSONAL_AREA_DEFAULTS]);
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(CUSTOM_AREAS_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const c of parsed) {
          if (typeof c === "string" && c.trim()) s.add(c.trim());
        }
      }
    }
  } catch {
    /* ignore */
  }
  return s;
}

function formatAreaLabel(value: string): string {
  return value.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

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
function mergeEntryTypesForDomain(
  domain: string,
  items: ViewItem[],
  suggested: SuggestedItemTypeDetail[],
  t?: (key: string) => string
): { value: string; label: string }[] {
  const base = ENTRY_TYPES_BY_DOMAIN[domain] ?? ENTRY_TYPES_BY_DOMAIN.work;
  const seen = new Set(base.map((b) => b.value));
  const out = base.map(({ value }) => ({ value, label: formatTypeLabel(value, t) }));
  const itemMatchesDomain = (it: ViewItem) =>
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
    case "task_completed":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...iconProps}>
          <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
          <path d="M22 4L12 14.01l-3-3" />
        </svg>
      );
    case "shopping":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...iconProps}>
          <circle cx="9" cy="21" r="1" />
          <circle cx="20" cy="21" r="1" />
          <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" />
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
  const key = String(it.scheduledAt).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const target = new Date(`${key}T12:00:00`);
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
    return items.filter((it) => it.itemType === "task" || it.itemType === "task_completed");
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
  projectId,
  category,
  itemType,
  onItemTypeSelect,
  viewType: controlledViewType,
  onViewTypeChange,
  searchFilter = "",
  dueDateFilter = "all",
  reloadKey = 0,
  scopeSlot,
  onMobileTopBarBeforeMenuSlot,
  onDesktopScopeBeforeFilterSlot,
}: ItemsViewAreaProps) {
  const { t, locale } = useI18n();
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
    () =>
      sortItemsByListOrder(
        filterItemsBySearch(
          filterItemsByDueDatePreset(filterItemsByType(items, itemType), dueDateFilter),
          searchFilter
        )
      ),
    [items, itemType, searchFilter, dueDateFilter, newBatchTick]
  );

  const canReorderEntries = !searchFilter.trim() && dueDateFilter === "all";

  const [suggestedItemTypesFromDump, setSuggestedItemTypesFromDump] = useState<SuggestedItemTypeDetail[]>([]);
  const [internalViewType, setInternalViewType] = useState<ItemsViewType>(loadViewPreference);
  const viewType = controlledViewType ?? internalViewType;
  const setViewType = onViewTypeChange ?? setInternalViewType;
  const [postitPositions, setPostitPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [itemContextMenu, setItemContextMenu] = useState<{ id: string; x: number; y: number; domain: string; currentType: string } | null>(null);
  const [projectsList, setProjectsList] = useState<{ id: string; name: string }[]>([]);
  const [moveToProjectForId, setMoveToProjectForId] = useState<string | null>(null);
  const [moveToAreaForId, setMoveToAreaForId] = useState<string | null>(null);
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
    scheduledAt: it.scheduledAt ? String(it.scheduledAt).slice(0, 10) : "",
    scheduledTime: it.scheduledTime ?? "",
    recurrence: it.recurrence ?? "none",
    sendNotification: it.sendNotification ?? false,
    reminderMinutesBefore: normalizeReminderMinutesBefore(it.reminderMinutesBefore ?? 30),
    priority: it.priority ?? null,
  }), []);
  const [lineToolActive, setLineToolActive] = useState(false);
  const [postitLinks, setPostitLinks] = useState<{ fromId: string; toId: string }[]>([]);
  const [aiSuggestOpen, setAiSuggestOpen] = useState(false);
  const [aiSuggestLoading, setAiSuggestLoading] = useState(false);
  const [aiSuggestError, setAiSuggestError] = useState<string | null>(null);
  const [aiSuggestList, setAiSuggestList] = useState<{ title: string; reason: string }[]>([]);

  const runAiSuggest = useCallback(async () => {
    if (items.length === 0) return;
    const payloadItems = items
      .filter((it) => !isPastScheduledForAiSuggestions(it))
      .slice(0, 45)
      .map((it) => ({
        title: it.title,
        content: it.content,
        itemType: it.itemType,
        progress: it.progress,
        scheduledAt: it.scheduledAt ?? undefined,
        scheduledTime: it.scheduledTime ?? undefined,
        recurrence: it.recurrence ?? undefined,
        project: it.project,
      }));
    setAiSuggestLoading(true);
    setAiSuggestError(null);
    setAiSuggestList([]);
    setAiSuggestOpen(true);
    try {
      const res = await fetch("/api/suggest-next-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locale,
          items: payloadItems,
        }),
      });
      const data = (await res.json()) as { suggestions?: { title: string; reason: string }[]; error?: string };
      if (!res.ok) {
        throw new Error(data.error || t("items.suggestError"));
      }
      setAiSuggestList(Array.isArray(data.suggestions) ? data.suggestions : []);
    } catch (e) {
      setAiSuggestError(e instanceof Error ? e.message : t("items.suggestError"));
    } finally {
      setAiSuggestLoading(false);
    }
  }, [items, locale, t]);

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

  const showMobileAiInTopBar =
    isMobile && (mode === "work" || mode === "personal" || mode === "all");

  useEffect(() => {
    if (!onMobileTopBarBeforeMenuSlot) return;
    if (!showMobileAiInTopBar) {
      onMobileTopBarBeforeMenuSlot(null);
      return;
    }
    onMobileTopBarBeforeMenuSlot(
      <button
        key="bd-topbar-ai-next"
        type="button"
        className="bd-btn bd-topbar-ai-suggest-btn"
        disabled={items.length === 0 || aiSuggestLoading || loading}
        onClick={() => void runAiSuggest()}
        title={t("items.aiNextThree")}
        aria-label={t("items.aiNextThree")}
        style={{ opacity: items.length === 0 ? 0.45 : 1 }}
      >
        {aiSuggestLoading ? (
          <span style={{ fontSize: "0.65rem", color: "var(--text-tertiary)" }}>{t("items.aiNextThreeBusy")}</span>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M12 3v4M12 17v4M5 12h4M15 12h4" />
            <path d="M19 4v3.5M17.25 5.75h3.5" strokeWidth="1.65" />
          </svg>
        )}
      </button>
    );
    return () => onMobileTopBarBeforeMenuSlot(null);
  }, [
    onMobileTopBarBeforeMenuSlot,
    showMobileAiInTopBar,
    items.length,
    aiSuggestLoading,
    loading,
    runAiSuggest,
    t,
  ]);

  useEffect(() => {
    if (!onDesktopScopeBeforeFilterSlot) return;
    const showDesktopAi =
      !isMobile && (mode === "work" || mode === "personal" || mode === "all");
    if (!showDesktopAi) {
      onDesktopScopeBeforeFilterSlot(null);
      return;
    }
    onDesktopScopeBeforeFilterSlot(
      <button
        type="button"
        className="bd-btn bd-toolbar-chip"
        disabled={items.length === 0 || aiSuggestLoading || loading}
        onClick={() => void runAiSuggest()}
        title={t("items.aiNextThree")}
        aria-label={t("items.aiNextThree")}
        style={{
          padding: "0.4rem 0.7rem",
          fontSize: "0.8125rem",
          flexShrink: 0,
          display: "inline-flex",
          alignItems: "center",
          gap: "0.4rem",
        }}
      >
        {aiSuggestLoading ? (
          <span style={{ color: "var(--text-tertiary)", fontSize: "0.75rem" }}>{t("items.aiNextThreeBusy")}</span>
        ) : (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
              <path d="M20 3v4M22 5h-4M4 17v2M5 18H3" />
            </svg>
            <span className="bd-mobile-hide">{t("items.aiNextThree")}</span>
          </>
        )}
      </button>
    );
    return () => onDesktopScopeBeforeFilterSlot(null);
  }, [
    onDesktopScopeBeforeFilterSlot,
    isMobile,
    mode,
    items.length,
    aiSuggestLoading,
    loading,
    runAiSuggest,
    t,
  ]);

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

  useEffect(() => {
    const reloadProjects = () => {
      if (mode !== "work") return;
      fetch("/api/projects?domain=work")
        .then((r) => r.json())
        .then((d) =>
          setProjectsList((d.projects ?? []).map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })))
        )
        .catch(() => setProjectsList([]));
    };
    window.addEventListener("braindump-reload-projects", reloadProjects);
    return () => window.removeEventListener("braindump-reload-projects", reloadProjects);
  }, [mode]);

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
      const key = it.itemType === "task_completed" ? "task" : it.itemType;
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

  const setTaskCompleted = useCallback((id: string, completed: boolean) => {
    const itemType = completed ? "task_completed" : "task";
    const progress = completed ? "completed" : "todo";
    const kanbanColumn = completed ? "completed" : "todo";
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, itemType, progress, kanbanColumn } : it))
    );
    fetch(`/api/organized-items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemType, progress, kanbanColumn }),
    })
      .then((r) => {
        if (r.ok && completed) playTaskCompleteCheer();
      })
      .catch(() => {});
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
      .then((r) => {
        if (r.ok) {
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
        }
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

  const commitTextViewContent = useCallback(
    async (id: string, raw: string): Promise<TextViewCommitFocus | void> => {
      const item = items.find((i) => i.id === id);
      if (!item) return;

      const blocks = splitTextViewBlocks(raw);
      if (blocks.length === 0) {
        const empty = raw.trim() === "" ? "" : raw.trim();
        if (empty === (item.content ?? "").trim()) return;
        fetch(`/api/organized-items/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: empty }),
        })
          .then((r) => {
            if (r.ok) setItems((prev) => prev.map((it) => (it.id === id ? { ...it, content: empty } : it)));
          })
          .catch(() => {});
        return;
      }

      const parts = blocks.map((b) => parseTextViewBlock(b, showEntryTitles));
      const scope = resolveTextSplitScope(mode, projectId, category, {
        personalAreaIds: loadPersonalAreaIdSetForSplit(),
      });

      const patchFirst = async (): Promise<boolean> => {
        const p0 = parts[0];
        const nextTitle = showEntryTitles ? deriveEntryTitle(p0.title, p0.content) : item.title;
        const nextContent = p0.content;
        const body: { title?: string; content: string } = { content: nextContent };
        if (showEntryTitles) body.title = nextTitle;
        if (
          parts.length === 1 &&
          body.content === (item.content ?? "").trim() &&
          (!showEntryTitles || body.title === item.title)
        ) {
          return true;
        }
        const r = await fetch(`/api/organized-items/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!r.ok) return false;
        setItems((prev) =>
          prev.map((it) =>
            it.id === id ? { ...it, ...body } : it
          )
        );
        return true;
      };

      if (parts.length === 1) {
        await patchFirst();
        return;
      }

      const okFirst = await patchFirst();
      if (!okFirst) return;

      const secondPart = parts[1];

      const resDump = await fetch("/api/dumps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: scope.dumpMode,
          transcriptRaw: "",
          transcriptEdited: "",
          status: "organized",
        }),
      });
      const dumpJson = (await resDump.json()) as { dump?: { id: string } };
      const dumpId = dumpJson.dump?.id;
      if (!dumpId) {
        await fetchItems();
        return;
      }

      const batchItems = parts.slice(1).map((p) => ({
        domain: scope.domain,
        category: scope.category,
        subcategory: "",
        ...(scope.projectId ? { projectId: scope.projectId } : {}),
        item_type: item.itemType,
        title: deriveEntryTitle(p.title, p.content),
        content: p.content,
      }));

      const batchRes = await fetch("/api/organized-items/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dumpId, items: batchItems }),
      });
      const batchJson = (await batchRes.json()) as { created?: Array<{ id: string; title: string }> };
      await fetchItems();
      if (!batchRes.ok) return;
      const firstNew = batchJson.created?.[0];
      if (!firstNew) return;
      if (showEntryTitles) {
        return {
          focusEntryId: firstNew.id,
          focusField: "title",
          focusValue: secondPart.title,
        };
      }
      return {
        focusEntryId: firstNew.id,
        focusField: "content",
        focusValue: secondPart.content,
      };
    },
    [items, mode, projectId, category, showEntryTitles, fetchItems]
  );

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
        payload.progress = "todo";
        payload.kanbanColumn = "todo";
      }
      if (form.itemType === "task_completed") {
        payload.progress = "completed";
        payload.kanbanColumn = "completed";
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
        const timeStr = ed.scheduledTime?.trim() || "09:00";
        let reminderAtIso: string | null = null;
        if (ed.sendNotification && dateStr) {
          const dt = localDateTimeToDate(dateStr, timeStr);
          reminderAtIso = dt ? dt.toISOString() : null;
        }
        updateSchedule(ed.id, {
          scheduledAt: ed.scheduledAt || null,
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
        updateSchedule(ed.id, {
          scheduledAt: dt ? dt.toISOString() : null,
          scheduledTime: timeStr || null,
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

  const editSheetScopeLabel = useMemo(() => {
    if (mode === "work") {
      return !projectId ? t("scope.all") : projectsList.find((p) => p.id === projectId)?.name ?? t("scope.all");
    }
    if (mode === "personal" || mode === "all") {
      return category ? formatAreaLabel(category) : t("scope.all");
    }
    return t("scope.all");
  }, [mode, projectId, category, projectsList, t]);

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
      {onItemTypeSelect && (
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

      {items.length > 0 && filteredItems.length === 0 ? (
        <p className="bd-empty">{t("items.emptySearch")}</p>
      ) : (
        <>
          {items.length === 0 ? (
            <p className="bd-empty" style={{ margin: "0 0 0.75rem" }}>
              {t("items.emptyFilters")}
            </p>
          ) : null}
          {viewType === "list" ? (
            <ListView
              showEntryTitles={showEntryTitles}
              items={filteredItems}
              onSetTaskCompleted={setTaskCompleted}
              onDelete={deleteItem}
              onItemContextMenu={(e, id, domain, currentType) => setItemContextMenu({ id, x: e.clientX, y: e.clientY, domain, currentType })}
              onEdit={(it) => setEditingEntry(toEditEntry(it))}
              onUpdate={updateEntryContent}
              reorderEnabled={canReorderEntries}
              onReorder={reorderEntriesPersist}
            />
          ) : viewType === "text" ? (
            <TextView
              showEntryTitles={showEntryTitles}
              items={filteredItems}
              onUpdate={updateEntryContent}
              onCommitTextContent={commitTextViewContent}
              onDelete={deleteItem}
              onItemContextMenu={(e, id, domain, currentType) => setItemContextMenu({ id, x: e.clientX, y: e.clientY, domain, currentType })}
              reorderEnabled={canReorderEntries}
              onReorder={reorderEntriesPersist}
            />
          ) : viewType === "kanban" ? (
            <KanbanView showEntryTitles={showEntryTitles} items={filteredItems} onSetTaskCompleted={setTaskCompleted} onDelete={deleteItem} onItemContextMenu={(e, id, domain, currentType) => setItemContextMenu({ id, x: e.clientX, y: e.clientY, domain, currentType })} onEdit={(it) => setEditingEntry(toEditEntry(it))} isMobile={isMobile} />
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
              onSetTaskCompleted={setTaskCompleted}
              onEdit={(it) => setEditingEntry(toEditEntry(it))}
              onItemContextMenu={(e, id, domain, currentType) => setItemContextMenu({ id, x: e.clientX, y: e.clientY, domain, currentType })}
              isMobile={isMobile}
            />
          ) : (
            <PostitsView
              showEntryTitles={showEntryTitles}
              items={filteredItems}
              onSetTaskCompleted={setTaskCompleted}
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
        </>
      )}

      {itemContextMenu && (() => {
        const types = mergeEntryTypesForDomain(itemContextMenu.domain, items, suggestedItemTypesFromDump, t);
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
              zIndex: "var(--bd-z-dropdown)",
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
                  zIndex: "calc(var(--bd-z-dropdown) + 1)",
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
                    zIndex: "calc(var(--bd-z-dropdown) + 1)",
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
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <button
              type="button"
              className="bd-edit-entry-mobile-scope"
              onClick={() => {
                if (mode === "inbox") return;
                window.dispatchEvent(new Event("braindump-open-scope-picker"));
              }}
              aria-label={t("scope.openProjectMenu")}
              disabled={mode === "inbox"}
            >
              <span className="bd-edit-entry-mobile-scope-label">{editSheetScopeLabel}</span>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            <div className="bd-edit-entry-mobile-top-actions">
              <button
                type="button"
                className="bd-edit-entry-icon-btn"
                aria-pressed={Boolean(editingEntry.priority)}
                aria-label={t("items.editFlag")}
                onClick={() =>
                  setEditingEntry((p) => (p ? { ...p, priority: p.priority ? null : 1 } : null))
                }
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill={editingEntry.priority ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                  <line x1="4" y1="22" x2="4" y2="15" />
                </svg>
              </button>
              <button
                type="button"
                className="bd-edit-entry-icon-btn"
                aria-label={t("items.editMore")}
                onClick={() => setEditEntryMoreOpen(true)}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <circle cx="12" cy="6" r="1.5" />
                  <circle cx="12" cy="12" r="1.5" />
                  <circle cx="12" cy="18" r="1.5" />
                </svg>
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
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              aria-hidden
                              className="bd-edit-entry-schedule-alarm"
                            >
                              <circle cx="12" cy="13" r="7" />
                              <path d="M12 9v4l2 2M5 3 2 3M22 3h-3M2 3h3" />
                            </svg>
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
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M3 6h18" />
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                  <line x1="10" y1="11" x2="10" y2="17" />
                  <line x1="14" y1="11" x2="14" y2="17" />
                </svg>
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
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
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

      {aiSuggestOpen && (
        <div
          className="bd-modal-backdrop"
          onClick={() => !aiSuggestLoading && setAiSuggestOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="bd-ai-suggest-title"
        >
          <div
            className="bd-panel bd-modal-panel"
            style={{ padding: "1.25rem", maxWidth: 440, width: "100%", maxHeight: "min(85dvh, 560px)", overflow: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem", marginBottom: "0.85rem" }}>
              <h2 id="bd-ai-suggest-title" style={{ margin: 0, fontSize: "1.05rem", fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.3 }}>
                {t("items.aiNextThreeTitle")}
              </h2>
              <button
                type="button"
                className="bd-btn"
                disabled={aiSuggestLoading}
                onClick={() => setAiSuggestOpen(false)}
                aria-label={t("items.aiNextThreeClose")}
                style={{ flexShrink: 0, minWidth: 40, minHeight: 40, padding: "0.35rem" }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            {aiSuggestLoading && (
              <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--text-secondary)" }}>{t("items.aiNextThreeBusy")}</p>
            )}
            {aiSuggestError && (
              <p className="bd-banner-error bd-banner-error--solo" style={{ margin: "0 0 0.75rem" }}>
                {aiSuggestError}
              </p>
            )}
            {!aiSuggestLoading && !aiSuggestError && aiSuggestList.length === 0 && (
              <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--text-tertiary)" }}>{t("items.aiNextThreeEmpty")}</p>
            )}
            {!aiSuggestLoading && aiSuggestList.length > 0 && (
              <ol style={{ margin: 0, paddingLeft: "1.1rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
                {aiSuggestList.map((s, i) => (
                  <li key={i} style={{ fontSize: "0.9rem", color: "var(--text-primary)", lineHeight: 1.45 }}>
                    <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>{s.title}</div>
                    {s.reason ? <div style={{ fontWeight: 400, color: "var(--text-secondary)", fontSize: "0.84rem" }}>{s.reason}</div> : null}
                  </li>
                ))}
              </ol>
            )}
            <div style={{ marginTop: "1.1rem", display: "flex", justifyContent: "flex-end" }}>
              <button type="button" className="bd-btn bd-btn-primary" disabled={aiSuggestLoading} onClick={() => setAiSuggestOpen(false)}>
                {t("items.aiNextThreeClose")}
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

/** Week strip starts Sunday (S M T W T F S) to match common mobile calendar patterns. */
function startOfWeekSunday(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = x.getDay();
  x.setDate(x.getDate() - dow);
  return x;
}

function getScheduledItemsForCalendarDay(cellDate: Date, scheduledItems: ViewItem[]): ViewItem[] {
  const y = cellDate.getFullYear();
  const m = cellDate.getMonth();
  const day = cellDate.getDate();
  const dateStr = `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const cellTime = new Date(y, m, day).getTime();
  return scheduledItems.filter((it) => {
    const at = it.scheduledAt ? String(it.scheduledAt).slice(0, 10) : null;
    const startDate = at ? new Date(at + "T00:00:00") : null;
    if (it.recurrence === "daily" && startDate) {
      return cellTime >= startDate.getTime();
    }
    if (it.recurrence === "weekly" && at) {
      const start = new Date(at + "T00:00:00");
      const diffDays = Math.floor((cellTime - start.getTime()) / 86400000);
      return diffDays >= 0 && diffDays % 7 === 0;
    }
    if (it.recurrence === "monthly" && at) {
      const d0 = new Date(at + "T00:00:00");
      return cellTime >= d0.getTime() && day === new Date(at).getDate();
    }
    return at === dateStr;
  });
}

function CalendarView({
  items,
  showEntryTitles = true,
  onSchedule: _onSchedule,
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
  const { t } = useI18n();
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

  const weekStart = useMemo(() => startOfWeekSunday(selectedDate), [selectedDate]);

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
      const wPrev = startOfWeekSunday(prev).getTime();
      const wNext = startOfWeekSunday(target).getTime();
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
          dayItems.map((it) => {
            const past =
              it.scheduledAt &&
              new Date(String(it.scheduledAt).slice(0, 10)) < new Date(todayNorm.getFullYear(), todayNorm.getMonth(), todayNorm.getDate());
            const taskDeadline = isTaskRow(it);
            return (
              <button
                key={it.id}
                type="button"
                onClick={() => onEdit(it)}
                onContextMenu={onItemContextMenu ? (e) => { e.preventDefault(); onItemContextMenu(e, it.id, it.domain, it.itemType); } : undefined}
                style={{
                  textAlign: "left",
                  fontSize: isMobile ? "0.875rem" : "0.9rem",
                  padding: isMobile ? "0.65rem 0.75rem" : "0.7rem 0.85rem",
                  background: past ? "var(--bg-tertiary)" : "var(--bd-chrome-selected-bg)",
                  color: past ? "var(--text-tertiary)" : "var(--bd-chrome-selected-text)",
                  border: past ? "1px solid var(--border-subtle)" : "1px solid var(--border-default)",
                  borderRadius: 12,
                  cursor: "pointer",
                  boxShadow: taskDeadline ? `inset 4px 0 0 ${TYPE_BAR_COLORS.task}` : "none",
                }}
                title={`${it.title}${
                  it.content?.trim() && !isContentRedundantWithTitle(it.title, it.content) ? ` — ${it.content.trim().slice(0, 200)}` : ""
                }${it.scheduledTime ? ` ${it.scheduledTime}` : ""}${it.recurrence && it.recurrence !== "none" ? ` (${it.recurrence})` : ""}${taskDeadline ? ` · ${t("items.taskDeadline")}` : ""}`}
              >
                {it.scheduledTime && <span style={{ marginRight: "0.35rem", opacity: 0.9, fontWeight: 600 }}>{it.scheduledTime}</span>}
                {entryPrimaryLine(it, showEntryTitles)}
              </button>
            );
          })
        )}
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
  onSetTaskCompleted,
  onEdit,
  onItemContextMenu,
  isMobile = false,
}: {
  items: ViewItem[];
  showEntryTitles?: boolean;
  onSetTaskCompleted: (id: string, completed: boolean) => void;
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
      <div
        key={it.id}
        className={ep.className}
        style={{
          ...ep.style,
          display: "flex",
          alignItems: "stretch",
          gap: "0.35rem",
          minWidth: 0,
        }}
      >
        {isTaskRow(it) && (
          <label
            style={{
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              paddingLeft: "0.15rem",
              cursor: "pointer",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={isTaskCompleted(it)}
              onChange={(e) => {
                e.stopPropagation();
                onSetTaskCompleted(it.id, e.target.checked);
              }}
              aria-label={isTaskCompleted(it) ? t("items.taskToggleOpen") : t("items.taskToggleDone")}
              style={{ width: 16, height: 16, accentColor: "var(--accent, #ea580c)", cursor: "pointer" }}
            />
          </label>
        )}
        <button
          type="button"
          className="bd-mindmap-entry"
          style={{
            flex: 1,
            minWidth: 0,
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
            {showEntryTitles && it.content?.trim() && !isContentRedundantWithTitle(it.title, it.content) && (
              <span style={{ display: "block", fontSize: "0.72rem", color: "var(--text-tertiary)", marginTop: "0.15rem" }}>
                {it.content.slice(0, 48)}
                {it.content.length > 48 ? "…" : ""}
              </span>
            )}
          </span>
        </button>
      </div>
    );
  };

  const renderTypeBlock = (domain: string, sectionKey: string, type: string, entries: ViewItem[]) => {
    const typeKey = `${domain}:${sectionKey}:${type}`;
    const isCollapsed = collapsedTypes.has(typeKey);
    const label = formatTypeLabel(type, t);
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
    <div
      className="bd-mindmap"
      style={{
        padding: isMobile ? "0.65rem" : "1.25rem 1.5rem 0",
        paddingBottom: isMobile
          ? "calc(0.65rem + var(--bd-view-bottom-pad))"
          : "calc(1.75rem + var(--bd-view-bottom-pad))",
      }}
    >
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

function mergeDragPlace(e: DragEvent, rowEl: HTMLElement): "before" | "after" {
  const r = rowEl.getBoundingClientRect();
  return e.clientY < r.top + r.height / 2 ? "before" : "after";
}

/** Custom drag snapshot so the row content follows the cursor clearly. */
function attachRowDragImage(e: DragEvent, handleEl: HTMLElement) {
  const row = handleEl.closest("[data-bd-entry-id]") as HTMLElement | null;
  if (!row) return;
  const rect = row.getBoundingClientRect();
  const clone = row.cloneNode(true) as HTMLElement;
  const cs = window.getComputedStyle(row);
  clone.style.cssText = [
    "position:fixed",
    "left:-9999px",
    "top:0",
    `width:${rect.width}px`,
    `box-sizing:${cs.boxSizing || "border-box"}`,
    "opacity:0.96",
    "pointer-events:none",
    "z-index:99999",
    "box-shadow:0 14px 40px rgba(0,0,0,0.2)",
    "border-radius:12px",
    "background:var(--bg-elevated)",
    "color:var(--text-primary)",
  ].join(";");
  document.body.appendChild(clone);
  const ox = Math.min(rect.width - 8, Math.max(8, e.clientX - rect.left));
  const oy = Math.min(rect.height - 4, Math.max(4, e.clientY - rect.top));
  e.dataTransfer.setDragImage(clone, ox, oy);
  window.setTimeout(() => clone.remove(), 0);
}

/** Reveal width behind the row (icon-only delete control). */
const SWIPE_DELETE_WIDTH_PX = 56;
/** Map finger movement to slide: >1 opens fully with less horizontal travel (fewer “multi-swipe” feels). */
const SWIPE_DRAG_GAIN = 1.45;
const SWIPE_LOCK_THRESHOLD_PX = 8;
/** Release: open if past this fraction of width (or fling left). */
const SWIPE_OPEN_COMMIT_RATIO = 0.33;
/** Pointer velocity (px/s): negative x = moving left / opening. */
const SWIPE_FLING_OPEN_VX = -420;
const SWIPE_FLING_CLOSE_VX = 380;

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

function SwipeDeleteRow({
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

  const finishPointer = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    if (d.lock === "h") {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      const final = offsetRef.current;
      drag.current = null;
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
        offsetRef.current = SWIPE_DELETE_WIDTH_PX;
        setOffset(SWIPE_DELETE_WIDTH_PX);
        setSwipeOpenId(entryId);
      } else {
        offsetRef.current = 0;
        setOffset(0);
        setSwipeOpenId((prev) => (prev === entryId ? null : prev));
      }
    } else {
      drag.current = null;
      setTransitioning(true);
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
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M3 6h18" />
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            <line x1="10" y1="11" x2="10" y2="17" />
            <line x1="14" y1="11" x2="14" y2="17" />
          </svg>
        </button>
      </div>
      <div
        className={slideClass}
        style={{
          transform: `translateX(${-offset}px)`,
          transition: transitioning ? "transform 0.28s var(--bd-ease-out)" : "none",
        }}
        onPointerDown={(e) => {
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
            if (Math.abs(dy) > Math.abs(dx)) {
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
        onLostPointerCapture={() => {
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
  onSetTaskCompleted,
  onDelete,
  onItemContextMenu,
  onEdit,
  onUpdate,
  reorderEnabled = false,
  onReorder,
}: {
  items: ViewItem[];
  showEntryTitles?: boolean;
  onSetTaskCompleted: (id: string, completed: boolean) => void;
  onDelete: (id: string, skipConfirm?: boolean) => void;
  onItemContextMenu?: (e: React.MouseEvent, id: string, domain: string, currentType: string) => void;
  onEdit?: (item: ViewItem) => void;
  onUpdate?: (id: string, updates: { title?: string; content?: string }) => void;
  reorderEnabled?: boolean;
  onReorder?: (orderedIds: string[]) => void;
}) {
  const { t } = useI18n();
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
    const taskCompleted = isTaskRow(it) && isTaskCompleted(it);
    let scheduleLabel: string | null = null;
    if (it.itemType === "shopping" && it.scheduledAt) {
      const d = new Date(`${String(it.scheduledAt).slice(0, 10)}T12:00:00`);
      const ds = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
      scheduleLabel = t("items.shoppingDueShort", { date: ds });
    } else if (
      it.itemType === "calendar" ||
      ((!isTaskRow(it) && it.scheduledAt) || (it.recurrence && it.recurrence !== "none"))
    ) {
      scheduleLabel = formatCalendarScheduleLabel(it);
    }
    const hideRedundantBody =
      showEntryTitles && !!(it.content ?? "").trim() && isContentRedundantWithTitle(it.title, it.content);
    const bodySnippet = hideRedundantBody ? "" : (it.content ?? "").trim();
    const showNotesGlyph = !hideRedundantBody && !!(it.content ?? "").trim();
    const isTask = isTaskRow(it);

    const primaryTitleStyle: CSSProperties = {
      fontWeight: 600,
      fontSize: "1rem",
      color: "var(--text-primary)",
      wordBreak: "break-word",
      overflowWrap: "anywhere",
      cursor: onUpdate ? "text" : undefined,
      textDecoration: taskCompleted ? "line-through" : undefined,
      opacity: taskCompleted ? 0.52 : 1,
    };

    const isDraggingRow = reorderPreview?.draggedId === it.id;
    const dropHint =
      reorderPreview &&
      reorderPreview.draggedId !== it.id &&
      reorderPreview.overId === it.id &&
      (reorderPreview.place === "before"
        ? { boxShadow: "inset 0 3px 0 0 var(--accent)" }
        : { boxShadow: "inset 0 -3px 0 0 var(--accent)" });

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
        className={`bd-todo-row ${ep.className}`}
        data-bd-entry-id={it.id}
        onDoubleClick={() => onEdit?.(it)}
        onContextMenu={onItemContextMenu ? (e) => { e.preventDefault(); onItemContextMenu(e, it.id, it.domain, it.itemType); } : undefined}
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
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <circle cx="9" cy="5" r="1" fill="currentColor" stroke="none" />
                <circle cx="15" cy="5" r="1" fill="currentColor" stroke="none" />
                <circle cx="9" cy="12" r="1" fill="currentColor" stroke="none" />
                <circle cx="15" cy="12" r="1" fill="currentColor" stroke="none" />
                <circle cx="9" cy="19" r="1" fill="currentColor" stroke="none" />
                <circle cx="15" cy="19" r="1" fill="currentColor" stroke="none" />
              </svg>
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
                checked={isTaskCompleted(it)}
                onChange={(e) => {
                  e.stopPropagation();
                  onSetTaskCompleted(it.id, e.target.checked);
                }}
                aria-label={isTaskCompleted(it) ? t("items.taskToggleOpen") : t("items.taskToggleDone")}
              />
            </label>
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
                onClick={() => onUpdate && setEditing({ id: it.id, field: "title", value: it.title ?? "" })}
                onDoubleClick={(e) => onUpdate && e.stopPropagation()}
                style={primaryTitleStyle}
              >
                {it.title?.trim() ? it.title : "—"}
              </div>
            )
          ) : (
            onUpdate && editing?.id === it.id && editing.field === "content" ? null : (
              <div
                onClick={() => onUpdate && setEditing({ id: it.id, field: "content", value: it.content ?? "" })}
                onDoubleClick={(e) => onUpdate && e.stopPropagation()}
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
                  onClick={() => onUpdate && setEditing({ id: it.id, field: "content", value: it.content ?? "" })}
                  onDoubleClick={(e) => onUpdate && e.stopPropagation()}
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
                onClick={() => onUpdate && setEditing({ id: it.id, field: "content", value: it.content ?? "" })}
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
        </div>
        {showNotesGlyph ? (
          <div className="bd-todo-row-trail" title={t("items.description")}>
            <span className="bd-todo-notes-glyph" aria-hidden>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
            </span>
          </div>
        ) : null}
      </div>
      </SwipeDeleteRow>
    );
  };

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
      <div className="bd-todo-list-card">{listItemsOrdered.map((it, idx) => renderEntry(it, idx))}</div>
    </div>
  );
}

function TextView({
  items,
  showEntryTitles = true,
  onUpdate,
  onCommitTextContent,
  onDelete,
  onItemContextMenu,
  reorderEnabled = false,
  onReorder,
}: {
  items: ViewItem[];
  showEntryTitles?: boolean;
  onUpdate: (id: string, updates: { title?: string; content?: string }) => void;
  /** Text view: blur commits full textarea; double line breaks split into new entries (also on input). */
  onCommitTextContent?: (id: string, raw: string) => void | Promise<TextViewCommitFocus | void>;
  onDelete: (id: string, skipConfirm?: boolean) => void;
  onItemContextMenu?: (e: React.MouseEvent, id: string, domain: string, currentType: string) => void;
  reorderEnabled?: boolean;
  onReorder?: (orderedIds: string[]) => void;
}) {
  const { t } = useI18n();
  const [editing, setEditing] = useState<{ id: string; field: "title" | "content"; value: string } | null>(null);
  const [reorderPreview, setReorderPreview] = useState<ReorderDragPreview | null>(null);
  const [swipeOpenId, setSwipeOpenId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const textSplitCommitLockRef = useRef(false);

  const textItemsOrdered = useMemo(
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

  const handleBlur = (id: string, field: "title" | "content", value: string, current: string) => {
    const trimmed = value.trim();
    if (trimmed !== current) {
      if (field === "title") onUpdate(id, { title: trimmed || current });
      else onUpdate(id, { content: trimmed });
    }
    setEditing(null);
  };

  const scheduleSplitFocus = useCallback((focus: TextViewCommitFocus) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setEditing({
          id: focus.focusEntryId,
          field: focus.focusField,
          value: focus.focusValue,
        });
        window.setTimeout(() => {
          if (focus.focusField === "title") {
            inputRef.current?.focus();
          } else {
            textareaRef.current?.focus();
          }
        }, 0);
      });
    });
  }, []);

  const handleContentBlur = (id: string, value: string, current: string) => {
    if (onCommitTextContent) {
      if (textSplitCommitLockRef.current) return;
      void Promise.resolve(onCommitTextContent(id, value)).then((focus) => {
        if (focus?.focusEntryId) {
          scheduleSplitFocus(focus);
        } else {
          setEditing(null);
        }
      });
      return;
    }
    handleBlur(id, "content", value, current);
  };

  /** When titles are on, description editor includes headline (first line) + body for split/commit. */
  const mergeTitleAndContent = (it: ViewItem) => {
    const title = (it.title ?? "").trim();
    const body = (it.content ?? "").trim();
    if (!title) return body;
    if (!body) return title;
    return `${title}\n${body}`;
  };

  const commitTextReorderDrop = (e: DragEvent, targetId: string) => {
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
      {textItemsOrdered.map((it, i) => {
        const ep = enterStaggerProps(i);
        const isEditingTitle = editing?.id === it.id && editing?.field === "title";
        const isEditingContent = editing?.id === it.id && editing?.field === "content";
        const barColor = TYPE_BAR_COLORS[it.itemType] ?? TYPE_BAR_COLORS.default;
        const isNew = isNewEntry(it);
        const isDraggingRow = reorderPreview?.draggedId === it.id;
        const dropHint =
          reorderPreview &&
          reorderPreview.draggedId !== it.id &&
          reorderPreview.overId === it.id &&
          (reorderPreview.place === "before"
            ? { boxShadow: "inset 0 3px 0 0 var(--accent)" }
            : { boxShadow: "inset 0 -3px 0 0 var(--accent)" });
        return (
          <SwipeDeleteRow
            key={it.id}
            entryId={it.id}
            swipeOpenId={swipeOpenId}
            setSwipeOpenId={setSwipeOpenId}
            onDelete={() => onDelete(it.id, true)}
            disabled={isEditingTitle || isEditingContent}
            slideSurface="canvas"
          >
          <div
            className={ep.className}
            data-bd-entry-id={it.id}
            style={{
              ...ep.style,
              display: "flex",
              flexDirection: "row",
              background: "transparent",
              gap: "0.45rem",
              alignItems: "stretch",
              opacity: isDraggingRow ? 0.38 : 1,
              ...dropHint,
            }}
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
            onDrop={reorderEnabled && onReorder ? (e) => commitTextReorderDrop(e, it.id) : undefined}
          >
            {reorderEnabled && onReorder ? (
              <span
                className="bd-entry-drag-handle bd-entry-drag-handle--text"
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
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                  <circle cx="9" cy="5" r="1" fill="currentColor" stroke="none" />
                  <circle cx="15" cy="5" r="1" fill="currentColor" stroke="none" />
                  <circle cx="9" cy="12" r="1" fill="currentColor" stroke="none" />
                  <circle cx="15" cy="12" r="1" fill="currentColor" stroke="none" />
                  <circle cx="9" cy="19" r="1" fill="currentColor" stroke="none" />
                  <circle cx="15" cy="19" r="1" fill="currentColor" stroke="none" />
                </svg>
              </span>
            ) : null}
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
                {entryTypeMetaLine(it, t)}
              </span>
              {showEntryTitles &&
                (isEditingTitle ? (
                  <input
                    ref={inputRef}
                    type="text"
                    data-bd-no-swipe
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
                data-bd-no-swipe
                value={
                  editing?.id === it.id
                    ? (editing.value ?? "")
                    : showEntryTitles
                      ? mergeTitleAndContent(it)
                      : (it.content ?? "")
                }
                onChange={(e) => {
                  const next = e.target.value;
                  setEditing((prev) => (prev ? { ...prev, value: next } : null));
                  if (!onCommitTextContent) return;
                  if (splitTextViewBlocks(next).length < 2) return;
                  textSplitCommitLockRef.current = true;
                  void Promise.resolve(onCommitTextContent(it.id, next))
                    .then((focus) => {
                      if (focus?.focusEntryId) {
                        scheduleSplitFocus(focus);
                      } else {
                        setEditing({ id: it.id, field: "content", value: next });
                      }
                    })
                    .finally(() => {
                      textSplitCommitLockRef.current = false;
                    });
                }}
                onBlur={(e) =>
                  handleContentBlur(
                    it.id,
                    e.currentTarget.value,
                    showEntryTitles ? mergeTitleAndContent(it) : it.content ?? ""
                  )
                }
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
                onClick={() =>
                  setEditing({
                    id: it.id,
                    field: "content",
                    value: showEntryTitles ? mergeTitleAndContent(it) : it.content ?? "",
                  })
                }
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
                {(() => {
                  const body = (it.content ?? "").trim();
                  if (!body) return t("items.clickToAddDescription");
                  if (
                    showEntryTitles &&
                    isContentRedundantWithTitle(it.title, it.content) &&
                    body
                  ) {
                    return t("items.textViewTapMoreDetails");
                  }
                  return body;
                })()}
              </p>
            )}
          </article>
          </div>
          </SwipeDeleteRow>
        );
      })}
      <p
        style={{
          fontSize: "0.72rem",
          color: "var(--text-tertiary)",
          margin: "0.35rem 0 0",
          paddingLeft: "0.55rem",
          lineHeight: 1.4,
          maxWidth: 720,
        }}
      >
        {t("items.textViewSplitHint")}
      </p>
    </div>
  );
}

function KanbanView({
  items,
  showEntryTitles = true,
  onSetTaskCompleted,
  onItemContextMenu,
  onEdit,
  isMobile = false,
}: {
  items: ViewItem[];
  showEntryTitles?: boolean;
  onSetTaskCompleted: (id: string, completed: boolean) => void;
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
  const taskItems = items.filter(isTaskRow);
  const byColumn = [
    {
      key: "todo",
      label: t("items.kanbanTodo"),
      items: taskItems.filter((it) => !isTaskCompleted(it)),
    },
    {
      key: "completed",
      label: t("items.kanbanCompleted"),
      items: taskItems.filter(isTaskCompleted),
    },
  ];

  const applyDrop = useCallback(
    (id: string, columnKey: string) => {
      const completed = columnKey === "completed";
      onSetTaskCompleted(id, completed);
      draggedIdRef.current = null;
      setDraggedId(null);
      setDragOverColumn(null);
    },
    [onSetTaskCompleted]
  );

  useEffect(() => {
    const onWindowDrop = (e: globalThis.DragEvent) => {
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
          ...(isMobile ? {} : { paddingBottom: "var(--bd-view-bottom-pad)" }),
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
            const hideRedundantBody =
              showEntryTitles && !!(it.content ?? "").trim() && isContentRedundantWithTitle(it.title, it.content);
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
              {!hideRedundantBody && (
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
              )}
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
                {entryTypeMetaLine(it, t)}
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
  task_completed: "#22c55e",
  shopping: "#f43f5e",
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
  onSetTaskCompleted,
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
  onSetTaskCompleted: (id: string, completed: boolean) => void;
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
  const { t } = useI18n();
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
        paddingBottom: "var(--bd-view-bottom-pad)",
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
          const hideRedundantBody =
            showEntryTitles && !!(it.content ?? "").trim() && isContentRedundantWithTitle(it.title, it.content);
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
                  <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", minWidth: 0, flex: 1 }}>
                    {isTaskRow(it) && (
                      <input
                        type="checkbox"
                        checked={isTaskCompleted(it)}
                        onChange={(e) => {
                          e.stopPropagation();
                          onSetTaskCompleted(it.id, e.target.checked);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={isTaskCompleted(it) ? t("items.taskToggleOpen") : t("items.taskToggleDone")}
                        style={{ width: 16, height: 16, flexShrink: 0, accentColor: "var(--accent, #ea580c)", cursor: "pointer" }}
                      />
                    )}
                    <span style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.06em", color: "var(--text-tertiary)", minWidth: 0 }}>
                      {entryTypeMetaLine(it, t)}
                    </span>
                  </div>
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
                  {!hideRedundantBody && (
                  <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {it.content?.trim() || "—"}
                  </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
