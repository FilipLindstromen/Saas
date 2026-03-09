"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

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

const TYPE_BAR_COLORS: Record<string, string> = {
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
  return items.filter((it) => it.itemType === itemType);
}

export function ItemsViewArea({ mode, projectId, category, itemType, onItemTypeSelect, viewType: controlledViewType, onViewTypeChange, searchFilter = "", reloadKey = 0 }: ItemsViewAreaProps) {
  const [items, setItems] = useState<ViewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const filteredItems = filterItemsBySearch(filterItemsByType(items, itemType), searchFilter);
  const [counts, setCounts] = useState<{ itemTypeCounts?: Record<string, number> } | null>(null);
  const [internalViewType, setInternalViewType] = useState<ItemsViewType>(loadViewPreference);
  const viewType = controlledViewType ?? internalViewType;
  const setViewType = onViewTypeChange ?? setInternalViewType;
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [postitPositions, setPostitPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [itemContextMenu, setItemContextMenu] = useState<{ id: string; x: number; y: number; domain: string; currentType: string } | null>(null);
  const [projectsList, setProjectsList] = useState<{ id: string; name: string }[]>([]);
  const [moveToProjectForId, setMoveToProjectForId] = useState<string | null>(null);
  const [moveToAreaForId, setMoveToAreaForId] = useState<string | null>(null);
  const [suggestNextOpen, setSuggestNextOpen] = useState(false);
  const [suggestNextLoading, setSuggestNextLoading] = useState(false);
  const [suggestNextList, setSuggestNextList] = useState<Array<{ title: string; reason?: string }>>([]);
  const [editingEntry, setEditingEntry] = useState<{
    id: string;
    title: string;
    content: string;
    progress?: string;
    scheduledAt?: string;
    scheduledTime?: string;
    recurrence?: string;
    sendNotification?: boolean;
  } | null>(null);
  const [reminderEntry, setReminderEntry] = useState<{
    id: string;
    title: string;
    reminderDate: string;
    reminderTime: string;
    reminderMinutesBefore: number;
  } | null>(null);
  const [addEntryOpen, setAddEntryOpen] = useState(false);
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
  }), []);
  const [lineToolActive, setLineToolActive] = useState(false);
  const [postitLinks, setPostitLinks] = useState<{ fromId: string; toId: string }[]>([]);

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
    if (mode === "all") {
      Promise.all([
        fetch("/api/organized-items/counts?domain=work").then((r) => r.json()),
        fetch("/api/organized-items/counts?domain=personal").then((r) => r.json()),
      ])
        .then(([workCounts, personalCounts]) => {
          const merged: Record<string, number> = {};
          for (const [k, v] of Object.entries(workCounts.itemTypeCounts ?? {})) {
            merged[k] = (merged[k] ?? 0) + (v as number);
          }
          for (const [k, v] of Object.entries(personalCounts.itemTypeCounts ?? {})) {
            merged[k] = (merged[k] ?? 0) + (v as number);
          }
          setCounts({ itemTypeCounts: merged });
        })
        .catch(() => setCounts(null));
      return;
    }
    if (mode !== "work" && mode !== "personal") return;
    const params = new URLSearchParams({ domain: mode });
    if (projectId) params.set("projectId", projectId);
    if (category) params.set("category", category);
    fetch(`/api/organized-items/counts?${params}`)
      .then((r) => r.json())
      .then((d) => setCounts({ itemTypeCounts: d.itemTypeCounts ?? {} }))
      .catch(() => setCounts(null));
  }, [mode, projectId, category]);

  const typeColor = (value: string | ""): string | undefined => {
    if (!value) return undefined;
    switch (value) {
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

  const typeOptions = (() => {
    const base = ENTRY_TYPES_BY_DOMAIN[mode] ?? ENTRY_TYPES_BY_DOMAIN.work;
    const excludeType = "reminder";
    if (counts?.itemTypeCounts && Object.keys(counts.itemTypeCounts).length > 0) {
      return [
        { value: "", label: "All types" },
        ...Object.keys(counts.itemTypeCounts)
          .filter((v) => v !== excludeType && (counts!.itemTypeCounts![v] ?? 0) > 0)
          .sort((a, b) => a.localeCompare(b))
          .map((value) => ({ value, label: formatTypeLabel(value) })),
      ];
    }
    return [{ value: "", label: "All types" }, ...base.map((t) => ({ value: t.value, label: t.label }))];
  })();

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
  }, [itemContextMenu]);

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

  const fetchSuggestNext = useCallback(() => {
    setSuggestNextOpen(true);
    setSuggestNextLoading(true);
    setSuggestNextList([]);
    let apiKey = "";
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem("saasApiKeys") : null;
      if (raw) {
        const p = JSON.parse(raw);
        apiKey = (p?.openai ?? "").trim();
      }
    } catch {}
    const payload = items.map((it) => ({
      title: it.title,
      content: it.content ?? undefined,
      itemType: it.itemType,
      progress: it.progress ?? undefined,
      scheduledAt: it.scheduledAt ?? undefined,
      scheduledTime: it.scheduledTime ?? undefined,
      recurrence: it.recurrence ?? undefined,
      project: it.project ?? undefined,
    }));
    fetch("/api/suggest-next-actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: payload, ...(apiKey ? { apiKey } : {}) }),
    })
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data.suggestions) ? data.suggestions : [];
        setSuggestNextList(list.slice(0, 3));
      })
      .catch(() => setSuggestNextList([{ title: "Could not load suggestions. Check API key in Settings." }]))
      .finally(() => setSuggestNextLoading(false));
  }, [items]);

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

  const updateSchedule = useCallback((id: string, schedule: { scheduledAt?: string | null; scheduledTime?: string | null; recurrence?: string | null; sendNotification?: boolean }) => {
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

  if (loading) {
    return (
      <div style={{ padding: "1.5rem" }}>
        <p className="bd-empty">Loading…</p>
      </div>
    );
  }

  const viewButtons: { value: ItemsViewType; label: string; icon: ReactNode }[] = [
    { value: "list", label: "List", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg> },
    { value: "text", label: "Text", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /><line x1="8" y1="7" x2="16" y2="7" /><line x1="8" y1="11" x2="16" y2="11" /><line x1="8" y1="15" x2="12" y2="15" /></svg> },
    { value: "kanban", label: "Kanban", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="5" height="18" rx="1" /><rect x="9.5" y="3" width="5" height="18" rx="1" /><rect x="16" y="3" width="5" height="18" rx="1" /></svg> },
    { value: "postits", label: "Post-its", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M9 9h6" /><path d="M9 13h6" /><path d="M9 17h4" /></svg> },
    { value: "calendar", label: "Calendar", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg> },
    { value: "flowchart", label: "Flow chart", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /><path d="M10 7v3a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1V7" /><path d="M10 14v3a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-3" /></svg> },
  ];

  return (
    <div style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "1rem", minHeight: 0, flex: 1 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
          {onItemTypeSelect && (mode === "work" || mode === "personal" || mode === "all") && (
            <div style={{ display: "flex", gap: "0.25rem", alignItems: "center", flexWrap: "wrap" }}>
              {typeOptions.map((opt) => {
                const isSelected = (itemType ?? "") === opt.value;
                const color = typeColor(opt.value);
                return (
                  <button
                    key={opt.value || "all"}
                    type="button"
                    className="bd-btn"
                    style={{
                      padding: "0.35rem 0.6rem",
                      fontSize: "0.8125rem",
                      background: isSelected ? (color ?? "var(--accent)") : undefined,
                      color: isSelected ? "#fff" : undefined,
                      borderColor: color ?? "transparent",
                    }}
                    onClick={() => onItemTypeSelect(opt.value || null)}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          )}
          <span style={{ fontSize: "0.8125rem", color: "var(--text-tertiary)" }}>
            {filteredItems.length} item{filteredItems.length !== 1 ? "s" : ""}
          </span>
          {(mode === "work" || mode === "personal" || mode === "all") && (
            <button
              type="button"
              className="bd-btn"
              title="Add new entry"
              style={{ padding: "0.35rem 0.6rem", marginLeft: "0.5rem" }}
              onClick={() => {
                const types = ENTRY_TYPES_BY_DOMAIN[mode] ?? ENTRY_TYPES_BY_DOMAIN.work;
                setAddEntryForm({
                  itemType: types[0]?.value ?? "note",
                  title: "",
                  content: "",
                  progress: "todo",
                  projectId: projectId ?? "",
                  scheduledAt: "",
                  scheduledTime: "",
                  recurrence: "none",
                  sendNotification: false,
                });
                setAddEntryOpen(true);
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            </button>
          )}
        </div>
        <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
          {(mode === "work" || mode === "personal" || mode === "all") && (
            <span style={{ position: "relative", display: "inline-flex" }}>
              <button
                type="button"
                className="bd-btn"
                style={{ padding: "0.35rem 0.6rem", fontSize: "0.8125rem" }}
                onClick={fetchSuggestNext}
                disabled={suggestNextLoading || items.length === 0}
                title="Suggest 1–3 next actions from your tasks and calendar"
              >
                {suggestNextLoading ? "…" : "What's next?"}
              </button>
              {suggestNextOpen && (
                <>
                  <div
                    role="presentation"
                    style={{ position: "fixed", inset: 0, zIndex: 999 }}
                    onClick={() => setSuggestNextOpen(false)}
                  />
                  <div
                    style={{
                      position: "absolute",
                      right: 0,
                      top: "100%",
                      marginTop: 4,
                      zIndex: 1000,
                      minWidth: 260,
                      maxWidth: 360,
                      background: "var(--bg-elevated)",
                      border: "1px solid var(--border-default)",
                      borderRadius: "var(--button-radius)",
                      boxShadow: "var(--shadow-md)",
                      padding: "0.75rem",
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-tertiary)", marginBottom: "0.5rem" }}>
                      Suggested next actions
                    </div>
                    {suggestNextLoading ? (
                      <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", margin: 0 }}>Thinking…</p>
                    ) : (
                      <ul style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.875rem", color: "var(--text-primary)" }}>
                        {suggestNextList.map((s, i) => (
                          <li key={i} style={{ marginBottom: "0.35rem" }}>
                            {s.title}
                            {s.reason && <span style={{ display: "block", fontSize: "0.75rem", color: "var(--text-tertiary)", marginTop: "0.15rem" }}>{s.reason}</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              )}
            </span>
          )}
          {viewButtons.map(({ value, label, icon }) => (
            <button
              key={value}
              type="button"
              className="bd-btn"
              title={label}
              style={{
                padding: "0.4rem",
                background: viewType === value ? "var(--accent)" : "var(--bg-elevated)",
                borderColor: viewType === value ? "var(--accent)" : "var(--border-default)",
                color: viewType === value ? "#fff" : "var(--text-primary)",
              }}
              onClick={() => setViewType(value)}
            >
              {icon}
            </button>
          ))}
          {viewType === "postits" && (
            <button
              type="button"
              className="bd-btn"
              title="Connect post-its with arrows"
              style={{
                marginLeft: "0.25rem",
                padding: "0.4rem",
                background: lineToolActive ? "var(--accent)" : undefined,
                color: lineToolActive ? "#fff" : undefined,
                borderColor: "transparent",
              }}
              onClick={() => setLineToolActive((a) => !a)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <p className="bd-empty">No items match the current filters.</p>
      ) : filteredItems.length === 0 ? (
        <p className="bd-empty">No entries match your search.</p>
      ) : viewType === "list" ? (
        <ListView items={filteredItems} onProgress={updateProgress} onDelete={deleteItem} onItemContextMenu={(e, id, domain, currentType) => setItemContextMenu({ id, x: e.clientX, y: e.clientY, domain, currentType })} onEdit={(it) => setEditingEntry(toEditEntry(it))} />
      ) : viewType === "text" ? (
        <TextView items={filteredItems} onUpdate={updateEntryContent} onItemContextMenu={(e, id, domain, currentType) => setItemContextMenu({ id, x: e.clientX, y: e.clientY, domain, currentType })} />
      ) : viewType === "kanban" ? (
        <KanbanView items={filteredItems} onProgress={updateProgress} onDelete={deleteItem} onItemContextMenu={(e, id, domain, currentType) => setItemContextMenu({ id, x: e.clientX, y: e.clientY, domain, currentType })} onEdit={(it) => setEditingEntry(toEditEntry(it))} />
      ) : viewType === "calendar" ? (
        <CalendarView
          items={filteredItems}
          onSchedule={updateSchedule}
          onEdit={(it) => setEditingEntry(toEditEntry(it))}
          onItemContextMenu={(e, id, domain, currentType) => setItemContextMenu({ id, x: e.clientX, y: e.clientY, domain, currentType })}
        />
      ) : viewType === "flowchart" ? (
        <FlowchartView
          items={filteredItems}
          onEdit={(it) => setEditingEntry(toEditEntry(it))}
          onItemContextMenu={(e, id, domain, currentType) => setItemContextMenu({ id, x: e.clientX, y: e.clientY, domain, currentType })}
        />
      ) : (
        <PostitsView
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
        const types = ENTRY_TYPES_BY_DOMAIN[itemContextMenu.domain] ?? ENTRY_TYPES_BY_DOMAIN.work;
        return (
          <div
            style={{
              position: "fixed",
              left: itemContextMenu.x,
              top: itemContextMenu.y,
              zIndex: 1000,
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--button-radius)",
              boxShadow: "var(--shadow-md)",
              padding: "0.25rem 0",
              minWidth: "140px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: "0.25rem 0.5rem", fontSize: "0.7rem", fontWeight: 600, color: "var(--text-tertiary)", borderBottom: "1px solid var(--border-default)" }}>
              Change type
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
                  setItemContextMenu(null);
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
                setItemContextMenu(null);
              }}
            >
              Edit
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
                setItemContextMenu(null);
              }}
            >
              Set reminder
            </button>
            {mode === "work" && (
              <button
                type="button"
                className="bd-btn"
                style={{ width: "100%", justifyContent: "flex-start" }}
                onClick={() => setMoveToProjectForId(itemContextMenu.id)}
              >
                Move to project
              </button>
            )}
            {itemContextMenu.domain === "personal" && (
              <button
                type="button"
                className="bd-btn"
                style={{ width: "100%", justifyContent: "flex-start" }}
                onClick={() => setMoveToAreaForId(itemContextMenu.id)}
              >
                Move to area
              </button>
            )}
            {mode === "work" && moveToProjectForId === itemContextMenu.id && (
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
                  Select project
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
                        No project
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
            {itemContextMenu.domain === "personal" && moveToAreaForId === itemContextMenu.id && (() => {
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
                    Select area
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
            <div style={{ borderTop: "1px solid var(--border-default)", marginTop: "0.25rem", paddingTop: "0.25rem" }}>
              <button
                type="button"
                className="bd-btn"
                style={{ width: "100%", justifyContent: "flex-start", color: "var(--text-danger, #c53030)" }}
                onClick={() => {
                  deleteItem(itemContextMenu.id, true);
                  setItemContextMenu(null);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        );
      })()}

      {editingEntry && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1100,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
          onClick={() => setEditingEntry(null)}
        >
          <div
            className="bd-panel"
            style={{ padding: "1.25rem", maxWidth: 480, width: "100%" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 0.75rem", fontSize: "1rem" }}>Edit entry</h3>
            <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-tertiary)", marginBottom: "0.25rem" }}>Headline</label>
            <input
              className="bd-input"
              value={editingEntry.title}
              onChange={(e) => setEditingEntry((prev) => prev && { ...prev, title: e.target.value })}
              placeholder="Title"
              style={{ width: "100%", marginBottom: "0.75rem" }}
              autoFocus
            />
            <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-tertiary)", marginBottom: "0.25rem" }}>Description</label>
            <textarea
              className="bd-textarea"
              value={editingEntry.content}
              onChange={(e) => setEditingEntry((prev) => prev && { ...prev, content: e.target.value })}
              placeholder="What you said (description)"
              style={{ width: "100%", minHeight: 100, marginBottom: "1rem", borderRadius: 18 }}
            />
            {items.find((i) => i.id === editingEntry.id)?.itemType === "task" && (
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
                        background: (editingEntry.progress || "todo") === p ? "var(--bg-hover)" : undefined,
                        borderColor: (editingEntry.progress || "todo") === p ? "var(--accent)" : undefined,
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
                </div>
              </div>
            )}
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button type="button" className="bd-btn" onClick={() => setEditingEntry(null)}>
                Cancel
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
                    updateSchedule(editingEntry.id, {
                      scheduledAt: editingEntry.scheduledAt || null,
                      scheduledTime: editingEntry.scheduledTime || null,
                      recurrence: (editingEntry.recurrence === "none" ? null : editingEntry.recurrence) || null,
                      sendNotification: editingEntry.sendNotification ?? false,
                    });
                  }
                  setEditingEntry(null);
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {reminderEntry && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1100,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
          onClick={() => setReminderEntry(null)}
        >
          <div
            className="bd-panel"
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
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1100,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
          onClick={() => setAddEntryOpen(false)}
        >
          <div
            className="bd-panel"
            style={{ padding: "1.25rem", maxWidth: 480, width: "100%", maxHeight: "90vh", overflow: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 0.75rem", fontSize: "1rem" }}>Add new Entry</h3>
            <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-tertiary)", marginBottom: "0.25rem" }}>Type</label>
            <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
              {(ENTRY_TYPES_BY_DOMAIN[mode] ?? ENTRY_TYPES_BY_DOMAIN.work).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className="bd-btn"
                  style={{
                    padding: "0.3rem 0.5rem",
                    fontSize: "0.8125rem",
                    background: addEntryForm.itemType === opt.value ? "var(--bg-hover)" : undefined,
                    borderColor: addEntryForm.itemType === opt.value ? "var(--accent)" : undefined,
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
                        borderColor: addEntryForm.progress === p ? "var(--accent)" : undefined,
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
  onSchedule,
  onEdit,
  onItemContextMenu,
}: {
  items: ViewItem[];
  onSchedule: (id: string, schedule: { scheduledAt?: string | null; scheduledTime?: string | null; recurrence?: string | null; sendNotification?: boolean }) => void;
  onEdit: (item: ViewItem) => void;
  onItemContextMenu?: (e: React.MouseEvent, id: string, domain: string, currentType: string) => void;
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem", flex: 1, minHeight: 0 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-primary)", margin: 0, letterSpacing: "-0.02em" }}>
              {headerDateLabel}
            </h2>
            <p style={{ fontSize: "0.875rem", color: "var(--text-tertiary)", margin: "0.25rem 0 0" }}>{monthLabel}</p>
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

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "1px", background: "var(--border-subtle)", borderRadius: "var(--button-radius)", overflow: "hidden", border: "1px solid var(--border-subtle)" }}>
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              style={{
                fontSize: "0.7rem",
                fontWeight: 600,
                color: "var(--text-tertiary)",
                padding: "0.5rem 0.35rem",
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
                  minHeight: 88,
                  padding: "0.4rem",
                  background: isCurrentMonth ? (isHovered ? "var(--bg-hover)" : "var(--bg-primary)") : "var(--bg-secondary)",
                  boxShadow: isTodayCell && isHovered && isCurrentMonth ? "0 0 0 2px var(--accent), var(--shadow-sm)" : isTodayCell ? "0 0 0 2px var(--accent)" : isHovered && isCurrentMonth ? "var(--shadow-sm)" : "none",
                  transition: "background 0.15s, box-shadow 0.15s",
                }}
              >
                <div
                  style={{
                    fontSize: isCurrentMonth ? "0.9375rem" : "0.75rem",
                    fontWeight: isTodayCell ? 700 : 500,
                    color: isCurrentMonth ? "var(--text-primary)" : "var(--text-quaternary)",
                    marginBottom: "0.3rem",
                    lineHeight: 1.2,
                  }}
                >
                  {isCurrentMonth ? day : cellDateNum}
                </div>
                {dayItems.length > 0 && (
                  <div style={{ fontSize: "0.65rem", color: "var(--text-tertiary)", marginBottom: "0.25rem" }}>
                    {dayItems.length} {dayItems.length === 1 ? "item" : "items"}
                  </div>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                  {dayItems.slice(0, 3).map((it) => {
                    const past = it.scheduledAt && new Date(String(it.scheduledAt).slice(0, 10)) < new Date(today.getFullYear(), today.getMonth(), today.getDate());
                    return (
                      <button
                        key={it.id}
                        type="button"
                        onClick={() => onEdit(it)}
                        onContextMenu={onItemContextMenu ? (e) => { e.preventDefault(); onItemContextMenu(e, it.id, it.domain, it.itemType); } : undefined}
                        style={{
                          textAlign: "left",
                          fontSize: "0.7rem",
                          padding: "0.3rem 0.45rem",
                          background: past ? "var(--bg-tertiary)" : "var(--accent)",
                          color: past ? "var(--text-tertiary)" : "var(--text-primary)",
                          border: "none",
                          borderRadius: 6,
                          cursor: "pointer",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          boxShadow: past ? "none" : "0 1px 2px rgba(0,0,0,0.1)",
                        }}
                        title={`${it.title}${it.scheduledTime ? ` ${it.scheduledTime}` : ""}${it.recurrence && it.recurrence !== "none" ? ` (${it.recurrence})` : ""}`}
                      >
                        {it.scheduledTime && <span style={{ marginRight: "0.25rem", opacity: 0.9 }}>{it.scheduledTime}</span>}
                        {it.title}
                      </button>
                    );
                  })}
                  {dayItems.length > 3 && (
                    <span style={{ fontSize: "0.65rem", color: "var(--text-tertiary)" }}>+{dayItems.length - 3} more</span>
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
          paddingTop: "1rem",
          background: "var(--bg-secondary)",
          borderRadius: "var(--button-radius)",
          padding: "1rem",
        }}
      >
        <h4 style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)", margin: "0 0 0.35rem" }}>Unscheduled</h4>
        <p style={{ fontSize: "0.8125rem", color: "var(--text-tertiary)", margin: 0 }}>
          Edit an entry and set a date (and optional time, repeat, notification) in the Calendar section to show it here.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", marginTop: "0.6rem", maxHeight: 140, overflow: "auto" }}>
          {items.filter((it) => !it.scheduledAt && !it.recurrence).slice(0, 8).map((it) => (
            <button
              key={it.id}
              type="button"
              className="bd-btn"
              style={{
                justifyContent: "flex-start",
                fontSize: "0.8125rem",
                padding: "0.5rem 0.75rem",
                borderRadius: 6,
                background: "var(--bg-tertiary)",
                border: "1px solid var(--border-subtle)",
              }}
              onClick={() => onEdit(it)}
              onContextMenu={onItemContextMenu ? (e) => { e.preventDefault(); onItemContextMenu(e, it.id, it.domain, it.itemType); } : undefined}
            >
              {it.title}
            </button>
          ))}
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

const FLOW_LINE = "var(--text-tertiary)";

function FlowchartView({
  items,
  onEdit,
  onItemContextMenu,
}: {
  items: ViewItem[];
  onEdit: (item: ViewItem) => void;
  onItemContextMenu?: (e: React.MouseEvent, id: string, domain: string, currentType: string) => void;
}) {
  const [collapsedDomains, setCollapsedDomains] = useState<Set<string>>(new Set());
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [collapsedTypes, setCollapsedTypes] = useState<Set<string>>(new Set());

  const toggleDomain = (key: string) => setCollapsedDomains((s) => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  const toggleSection = (key: string) => setCollapsedSections((s) => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  const toggleType = (key: string) => setCollapsedTypes((s) => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n; });

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
      label: id === "__none" ? "No project" : (list[0]?.project?.name ?? id),
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
      const t = it.itemType || "note";
      if (!byType.has(t)) byType.set(t, []);
      byType.get(t)!.push(it);
    }
    return Array.from(byType.entries()).map(([type, entries]) => ({ type, entries }));
  };

  const primaryNodeStyle: CSSProperties = {
    padding: "0.5rem 1rem",
    borderRadius: 8,
    background: "var(--accent)",
    color: "#fff",
    fontWeight: 600,
    fontSize: "0.9375rem",
    border: "none",
    cursor: "pointer",
    textAlign: "center",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.5rem",
    minWidth: 120,
    boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
  };
  const secondaryNodeStyle: CSSProperties = {
    padding: "0.4rem 0.75rem",
    borderRadius: 8,
    background: "var(--bg-elevated)",
    color: "var(--accent)",
    fontWeight: 500,
    fontSize: "0.8125rem",
    border: "1.5px solid var(--accent)",
    cursor: "pointer",
    textAlign: "left",
    display: "flex",
    alignItems: "center",
    gap: "0.35rem",
    width: "100%",
    boxSizing: "border-box",
  };
  const entryNodeStyle: CSSProperties = {
    padding: "0.35rem 0.65rem",
    borderRadius: 8,
    background: "var(--bg-elevated)",
    color: "var(--text-primary)",
    fontWeight: 400,
    fontSize: "0.8125rem",
    border: "1px solid var(--border-default)",
    cursor: "pointer",
    textAlign: "left",
    display: "flex",
    flexDirection: "column",
    gap: "0.15rem",
    width: "100%",
    boxSizing: "border-box",
  };

  const FlowArrow = () => (
    <svg width={12} height={10} viewBox="0 0 12 10" style={{ flexShrink: 0 }} aria-hidden>
      <path d="M6 0L12 10H0L6 0z" fill={FLOW_LINE} />
    </svg>
  );

  const FlowConnector = ({ dashed = false }: { dashed?: boolean }) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <svg width={2} height={14} style={{ display: "block" }} aria-hidden>
        <line x1={1} y1={0} x2={1} y2={14} stroke={FLOW_LINE} strokeWidth={2} strokeDasharray={dashed ? "3 3" : "none"} />
      </svg>
      <FlowArrow />
    </div>
  );

  const renderEntry = (it: ViewItem) => {
    const barColor = TYPE_BAR_COLORS[it.itemType] ?? TYPE_BAR_COLORS.default;
    const isNew = isNewEntry(it);
    return (
      <div key={it.id} style={{ display: "flex", flexDirection: "column", alignItems: "stretch" }}>
        <FlowConnector dashed />
        <div
          onClick={() => onEdit(it)}
          onContextMenu={onItemContextMenu ? (e) => { e.preventDefault(); onItemContextMenu(e, it.id, it.domain, it.itemType); } : undefined}
          style={{
            ...entryNodeStyle,
            borderLeft: `3px solid ${barColor}`,
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            position: "relative",
          }}
        >
          {isNew && (
            <span
              style={{
                position: "absolute",
                top: 4,
                right: 6,
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "var(--accent)",
                boxShadow: "0 0 8px rgba(255,255,255,0.4)",
              }}
              aria-hidden
            />
          )}
          <EntryTypeIcon type={it.itemType} size={14} />
          <span style={{ flex: 1, minWidth: 0 }}>{it.title}</span>
          {it.content?.trim() && (
            <span style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
              {it.content.slice(0, 50)}{it.content.length > 50 ? "…" : ""}
            </span>
          )}
        </div>
      </div>
    );
  };

  const renderTypeBlock = (domain: string, sectionKey: string, type: string, entries: ViewItem[]) => {
    const typeKey = `${domain}:${sectionKey}:${type}`;
    const isCollapsed = collapsedTypes.has(typeKey);
    const label = formatTypeLabel(type);
    const typeColor = TYPE_BAR_COLORS[type] ?? TYPE_BAR_COLORS.default;
    return (
      <div key={typeKey} style={{ display: "flex", flexDirection: "column", alignItems: "stretch" }}>
        <FlowConnector dashed />
        <button
          type="button"
          onClick={() => toggleType(typeKey)}
          style={{ ...secondaryNodeStyle, borderColor: typeColor, color: typeColor }}
        >
          <EntryTypeIcon type={type} size={14} />
          <span style={{ width: 4, height: 14, borderRadius: 2, background: typeColor, flexShrink: 0 }} />
          <span style={{ width: 16, fontSize: "0.7rem" }}>{isCollapsed ? "▶" : "▼"}</span>
          {label}
          <span style={{ fontSize: "0.7rem", color: "var(--text-tertiary)", fontWeight: 400 }}>({entries.length})</span>
        </button>
        {!isCollapsed && (
          <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 2, marginLeft: 12 }}>
            {entries.map((it) => renderEntry(it))}
          </div>
        )}
      </div>
    );
  };

  const renderSection = (domain: string, sectionKey: string, label: string, sectionItems: ViewItem[]) => {
    const sectionId = `${domain}:${sectionKey}`;
    const isCollapsed = collapsedSections.has(sectionId);
    const byType = groupByType(sectionItems);
    return (
      <div key={sectionId} style={{ display: "flex", flexDirection: "column", alignItems: "stretch", minWidth: 200, flex: "0 0 auto" }}>
        <FlowConnector dashed />
        <button
          type="button"
          onClick={() => toggleSection(sectionId)}
          style={{ ...secondaryNodeStyle }}
        >
          <span style={{ width: 16, fontSize: "0.7rem" }}>{isCollapsed ? "▶" : "▼"}</span>
          {label}
          <span style={{ fontSize: "0.7rem", color: "var(--text-tertiary)", fontWeight: 400 }}>({sectionItems.length})</span>
        </button>
        {!isCollapsed && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 2, marginLeft: 12 }}>
            {byType.map(({ type, entries }) => renderTypeBlock(domain, sectionKey, type, entries))}
          </div>
        )}
      </div>
    );
  };

  const renderDomainColumn = (domain: "work" | "personal", label: string, sections: { key: string; label: string; items: ViewItem[] }[]) => {
    const isCollapsed = collapsedDomains.has(domain);
    const total = sections.reduce((s, sec) => s + sec.items.length, 0);
    return (
      <div key={domain} style={{ flex: "0 0 auto", minWidth: 200, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <button
          type="button"
          onClick={() => toggleDomain(domain)}
          style={{ ...primaryNodeStyle }}
        >
          <span style={{ width: 18, fontSize: "0.75rem" }}>{isCollapsed ? "▶" : "▼"}</span>
          {label}
          <span style={{ fontSize: "0.8rem", opacity: 0.95 }}>({total})</span>
        </button>
        {!isCollapsed && (
          <>
            <FlowConnector />
            <div style={{ display: "flex", flexDirection: "row", flexWrap: "wrap", gap: "1rem", width: "100%", alignItems: "flex-start", justifyContent: "flex-start" }}>
              {sections.map((sec) => renderSection(domain, sec.key, sec.label, sec.items))}
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        overflow: "auto",
        background: "var(--bg-secondary)",
        borderRadius: "var(--button-radius)",
        padding: "1.5rem",
      }}
    >
      {items.length === 0 ? (
        <p style={{ color: "var(--text-tertiary)", fontSize: "0.875rem" }}>No items yet. Add dumps and organize to see the full chart.</p>
      ) : (
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
          <div style={{ display: "flex", flexDirection: "row", gap: "2rem", width: "fit-content", maxWidth: "100%", justifyContent: "center", alignItems: "flex-start" }}>
            {workSections.some((s) => s.items.length > 0) && renderDomainColumn("work", "Work", workSections)}
            {personalSections.some((s) => s.items.length > 0) && renderDomainColumn("personal", "Personal", personalSections)}
          </div>
        </div>
      )}
    </div>
  );
}

const LIST_VIEW_TYPE_ORDER = ["task", "note", "idea", "calendar", "reflection", "emotion"];

function ListView({
  items,
  onProgress,
  onDelete,
  onItemContextMenu,
  onEdit,
}: {
  items: ViewItem[];
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

  const renderEntry = (it: ViewItem) => {
    const barColor = TYPE_BAR_COLORS[it.itemType] ?? TYPE_BAR_COLORS.default;
    const scheduleLabel = (it.itemType === "calendar" || it.scheduledAt || (it.recurrence && it.recurrence !== "none")) ? formatCalendarScheduleLabel(it) : null;
    return (
      <div
        key={it.id}
        onDoubleClick={() => onEdit?.(it)}
        onContextMenu={onItemContextMenu ? (e) => { e.preventDefault(); onItemContextMenu(e, it.id, it.domain, it.itemType); } : undefined}
        style={{
          display: "flex",
          alignItems: "stretch",
          minHeight: 72,
          minWidth: 0,
          border: "1px solid var(--border-default)",
          borderRadius: "var(--button-radius)",
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
          <div style={{ fontWeight: 600, fontSize: "0.9375rem", color: "var(--text-primary)" }}>{it.title}</div>
          <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
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
      style={{
        display: "flex",
        flexDirection: "row",
        gap: "1rem",
        overflow: "auto",
        alignContent: "start",
        alignItems: "flex-start",
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
                borderRadius: "var(--button-radius)",
                background: typeColor,
                color: "#fff",
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
              {typeItems.map((it) => renderEntry(it))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TextView({
  items,
  onUpdate,
  onItemContextMenu,
}: {
  items: ViewItem[];
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
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem",
        overflow: "auto",
        paddingBottom: "1rem",
        maxWidth: 720,
      }}
    >
      {items.map((it) => {
        const isEditingTitle = editing?.id === it.id && editing?.field === "title";
        const isEditingContent = editing?.id === it.id && editing?.field === "content";
        const barColor = TYPE_BAR_COLORS[it.itemType] ?? TYPE_BAR_COLORS.default;
        const isNew = isNewEntry(it);
        return (
          <div
            key={it.id}
            style={{
              display: "flex",
              flexDirection: "row",
              background: "transparent",
              gap: "0.75rem",
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
                gap: "0.5rem",
                padding: "0.75rem 1rem",
                background: "var(--bg-elevated)",
                borderRadius: 6,
                boxShadow: "var(--shadow-sm)",
                border: "1px solid var(--border-subtle)",
                position: "relative",
              }}
            >
            {isNew && (
              <span
                style={{
                  position: "absolute",
                  top: 6,
                  right: 8,
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "var(--accent)",
                  boxShadow: "0 0 8px rgba(255,255,255,0.4)",
                }}
                aria-hidden
              />
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <span style={{ fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.06em", color: "var(--text-tertiary)" }}>
                {`${entryContextLabel(it) || entryTypeLabel(it.itemType)}: ${entryTypeLabel(it.itemType)}`}
              </span>
              {isEditingTitle ? (
                <input
                  ref={inputRef}
                  type="text"
                  value={editing?.value ?? it.title}
                  onChange={(e) => setEditing((prev) => prev ? { ...prev, value: e.target.value } : null)}
                  onBlur={() => editing && handleBlur(it.id, "title", editing.value, it.title)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  }}
                  style={{
                    flex: 1,
                    margin: 0,
                    fontSize: "1.25rem",
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    padding: "0.35rem 0",
                    lineHeight: 1.35,
                    minHeight: "1.75rem",
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
                    fontSize: "1.25rem",
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    cursor: "text",
                    padding: "0.35rem 0",
                    lineHeight: 1.35,
                    minHeight: "1.75rem",
                  }}
                >
                  {it.title || "Untitled"}
                </h2>
              )}
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
                  fontSize: "0.9375rem",
                  lineHeight: 1.5,
                  color: "var(--text-secondary)",
                  padding: "0.35rem 0",
                  minHeight: 80,
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
                  fontSize: "0.9375rem",
                  lineHeight: 1.5,
                  color: "var(--text-secondary)",
                  cursor: "text",
                  padding: "0.35rem 0",
                  minHeight: "1.5em",
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
  onProgress,
  onItemContextMenu,
  onEdit,
}: {
  items: ViewItem[];
  onProgress: (id: string, progress: string, kanbanColumn?: string) => void;
  onDelete: (id: string, skipConfirm?: boolean) => void;
  onItemContextMenu?: (e: React.MouseEvent, id: string, domain: string, currentType: string) => void;
  onEdit?: (item: ViewItem) => void;
}) {
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
    <div ref={kanbanContainerRef} style={{ display: "flex", flexDirection: "column", gap: "0.5rem", flex: 1, minHeight: 200 }}>
      {taskItems.length === 0 && items.length > 0 && (
        <p style={{ fontSize: "0.8125rem", color: "var(--text-tertiary)", margin: 0 }}>
          Kanban shows only tasks. These entries are notes or ideas — use List or Post-its to view them.
        </p>
      )}
      <div style={{ display: "flex", gap: "1rem", overflow: "auto", flex: 1 }}>
      {byColumn.map((col) => (
        <div
          key={col.key}
          onDragOver={(e) => handleDragOver(e, col.key)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, col.key)}
          style={{
            flex: "1 1 0",
            minWidth: 160,
            minHeight: 120,
            background: dragOverColumn === col.key ? "var(--bg-hover)" : "var(--bg-secondary)",
            borderRadius: "var(--button-radius)",
            padding: "0.75rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
            border: dragOverColumn === col.key ? "2px dashed var(--accent)" : "2px solid transparent",
            transition: "background 0.15s, border-color 0.15s",
          }}
        >
          <h4 style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)", margin: 0 }}>
            {col.label}
          </h4>
          {col.items.map((it) => (
            <div
              key={it.id}
              draggable
              onDragStart={(e) => handleDragStart(e, it.id)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => handleDragOver(e, col.key)}
              onDrop={(e) => handleDrop(e, col.key)}
              onDoubleClick={() => onEdit?.(it)}
              onContextMenu={onItemContextMenu ? (e) => { e.preventDefault(); onItemContextMenu(e, it.id, it.domain, it.itemType); } : undefined}
              style={{
                padding: "0.5rem 0.75rem",
                background: "var(--bg-tertiary)",
                border: "1px solid var(--border-default)",
                borderRadius: "var(--button-radius)",
                cursor: "grab",
                opacity: draggedId === it.id ? 0.6 : 1,
              }}
            >
              <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>{it.title}</div>
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "var(--text-secondary)",
                  marginTop: "0.2rem",
                  lineHeight: 1.3,
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {it.content?.trim() || "—"}
              </div>
              <div style={{ fontSize: "0.65rem", color: "var(--text-tertiary)", marginTop: "0.25rem", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                <EntryTypeIcon type={it.itemType} size={12} />
                {`${entryContextLabel(it) || entryTypeLabel(it.itemType)}: ${entryTypeLabel(it.itemType)}`}
              </div>
            </div>
          ))}
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
        borderRadius: "var(--button-radius)",
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
              stroke="var(--accent)"
              strokeWidth="2"
              strokeDasharray="6 4"
              markerEnd="url(#arrowhead)"
            />
          )}
        </svg>
        {items.map((it) => {
          const base = getPosition(it);
          const drag = postitPositions[it.id];
          const x = drag ? drag.x : base.x;
          const y = drag ? drag.y : base.y;
          const barColor = POSTIT_COLORS[it.itemType] ?? POSTIT_COLORS.default;
          return (
            <div
              key={it.id}
              data-postit-id={it.id}
              onMouseDown={(e) => handleMouseDown(e, it.id)}
              onDoubleClick={() => onEdit?.(it)}
              onContextMenu={onItemContextMenu ? (e) => { e.preventDefault(); onItemContextMenu(e, it.id, it.domain, it.itemType); } : undefined}
              style={{
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
                transition: dragState?.id === it.id ? "box-shadow 0.15s" : "none",
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
                  <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--text-primary)", marginBottom: "0.25rem", lineHeight: 1.3 }}>
                    {it.title}
                  </div>
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
