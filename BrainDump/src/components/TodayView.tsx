"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { filterItemsByDueDatePreset } from "@/lib/due-date-filter";
import { formatAreaLabel } from "@/lib/personal-areas";
import {
  SwipeDeleteRow,
  EntryTypeIcon,
  useMobileEntryFieldGestures,
  type ViewItem,
} from "@/components/ItemsViewArea";
import {
  buildTaskRecurrenceString,
  clearTaskRecurrenceCompleted,
  isRecurringTaskActiveToday,
  isRecurringTaskDoneToday,
  markTaskRecurrenceCompleted,
  parseTaskRecurrence,
} from "@/lib/task-recurrence";

const FETCH_TIMEOUT_MS = 15000;

export type TodayItemRow = {
  id: string;
  domain: string;
  category: string;
  itemType: string;
  title: string;
  content?: string;
  scheduledAt?: string | null;
  scheduledTime?: string | null;
  reminderAt?: string | null;
  recurrence?: string | null;
  progress?: string;
  kanbanColumn?: string | null;
  project?: { id: string; name: string } | null;
};

function todayDateKey(): string {
  const n = new Date();
  const y = n.getFullYear();
  const m = String(n.getMonth() + 1).padStart(2, "0");
  const d = String(n.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isTask(it: Pick<TodayItemRow, "itemType">): boolean {
  return it.itemType === "task" || it.itemType === "task_completed";
}

function isTaskCompleted(it: Pick<TodayItemRow, "itemType" | "progress" | "kanbanColumn">): boolean {
  if (it.itemType === "task_completed") return true;
  if (it.itemType === "task" && (it.progress === "completed" || it.kanbanColumn === "completed")) return true;
  return false;
}

function sortTodayRows(a: TodayItemRow, b: TodayItemRow): number {
  const ta = (a.scheduledTime ?? "").trim() || "99:99";
  const tb = (b.scheduledTime ?? "").trim() || "99:99";
  const c = ta.localeCompare(tb);
  if (c !== 0) return c;
  return (a.title ?? "").localeCompare(b.title ?? "");
}

type TodayViewProps = {
  onGoToWorkspace: (
    domain: "work" | "personal",
    opts: { projectId: string | null; category: string | null }
  ) => void;
  isMobile?: boolean;
};

export function TodayView({ onGoToWorkspace, isMobile = false }: TodayViewProps) {
  const { t, locale } = useI18n();
  const [items, setItems] = useState<TodayItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [swipeOpenId, setSwipeOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const bindMobileField = useMobileEntryFieldGestures(isMobile, undefined);

  const todayStr = useMemo(() => todayDateKey(), []);
  const dateHeadline = useMemo(
    () =>
      new Date(`${todayStr}T12:00:00`).toLocaleDateString(locale === "sv" ? "sv-SE" : undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      }),
    [todayStr, locale]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const controller = new AbortController();
    const to = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const [rw, rp] = await Promise.all([
        fetch("/api/organized-items?domain=work", { signal: controller.signal }),
        fetch("/api/organized-items?domain=personal", { signal: controller.signal }),
      ]);
      if (!rw.ok || !rp.ok) {
        setError(t("today.loadError"));
        setItems([]);
        return;
      }
      const dw = (await rw.json()) as { items?: TodayItemRow[] };
      const dp = (await rp.json()) as { items?: TodayItemRow[] };
      const merged = [...(dw.items ?? []), ...(dp.items ?? [])];
      const bySchedule = filterItemsByDueDatePreset(merged, "today") as TodayItemRow[];
      const scheduledIds = new Set(bySchedule.map((it) => it.id));
      // Also include recurring tasks that are active today (even without scheduledAt)
      const recurringToday = merged.filter(
        (it) =>
          !scheduledIds.has(it.id) &&
          isTask(it) &&
          isRecurringTaskActiveToday(it.recurrence)
      );
      const combined = [...bySchedule, ...recurringToday];
      combined.sort(sortTodayRows);
      setItems(combined);
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        setItems([]);
      } else {
        setError(t("today.loadError"));
        setItems([]);
      }
    } finally {
      window.clearTimeout(to);
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onReload = () => void load();
    window.addEventListener("braindump-reload-items", onReload);
    return () => window.removeEventListener("braindump-reload-items", onReload);
  }, [load]);

  useEffect(() => {
    if (!editing) return;
    inputRef.current?.focus();
  }, [editing]);

  const handleTaskComplete = useCallback((id: string, completed: boolean) => {
    setItems((prev) => {
      const currentItem = prev.find((it) => it.id === id);
      const taskRec = parseTaskRecurrence(currentItem?.recurrence);
      const isRecurring = taskRec.isRecurring;

      const itemType = completed ? "task_completed" : "task";
      const progress = completed ? "completed" : "todo";
      const kanbanColumn = completed ? "completed" : "todo";

      let newRecurrence: string | undefined;
      if (isRecurring && taskRec.pattern && currentItem?.recurrence) {
        newRecurrence = completed
          ? markTaskRecurrenceCompleted(currentItem.recurrence)
          : clearTaskRecurrenceCompleted(currentItem.recurrence);
      }

      const patch: Record<string, unknown> = { itemType, progress, kanbanColumn };
      if (newRecurrence !== undefined) patch.recurrence = newRecurrence;

      fetch(`/api/organized-items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }).catch(() => {});

      return prev.map((it) =>
        it.id === id
          ? { ...it, itemType, progress, kanbanColumn, ...(newRecurrence !== undefined && { recurrence: newRecurrence }) }
          : it
      );
    });
  }, []);

  const handleDelete = useCallback((id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
    fetch(`/api/organized-items/${id}`, { method: "DELETE" }).catch(() => {
      void load();
    });
  }, [load]);

  const commitEdit = useCallback((id: string, value: string) => {
    const trimmed = value.trim();
    const it = items.find((i) => i.id === id);
    setEditing(null);
    if (!it || trimmed === (it.title ?? "").trim()) return;
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, title: trimmed } : i)));
    fetch(`/api/organized-items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: trimmed }),
    }).catch(() => {});
  }, [items]);

  const goToWorkspace = useCallback((it: TodayItemRow) => {
    const domainOk = it.domain === "work" || it.domain === "personal";
    if (!domainOk) return;
    onGoToWorkspace(it.domain as "work" | "personal", {
      projectId: it.project?.id ?? null,
      category: it.category ?? null,
    });
  }, [onGoToWorkspace]);

  const domainLabel = (domain: string) => {
    if (domain === "work") return t("mode.work");
    if (domain === "personal") return t("mode.personal");
    return domain;
  };

  return (
    <div className="bd-today-view bd-panel">
      <header className="bd-today-head">
        <h1 className="bd-today-title">{t("today.title")}</h1>
        <p className="bd-today-sub">{dateHeadline}</p>
        <p className="bd-today-hint">{t("today.hint")}</p>
      </header>

      {loading ? (
        <p className="bd-today-loading">{t("today.loading")}</p>
      ) : error ? (
        <p className="bd-today-error" role="alert">
          {error}
        </p>
      ) : items.length === 0 ? (
        <p className="bd-today-empty">{t("today.empty")}</p>
      ) : (
        <div className="bd-todo-list-card">
          {items.map((it) => {
            const taskRec = parseTaskRecurrence(it.recurrence);
            const done = isTask(it) && taskRec.isRecurring
              ? isRecurringTaskDoneToday(it.recurrence)
              : isTaskCompleted(it);
            const isTaskItem = isTask(it);
            const isEditing = editing?.id === it.id;

            return (
              <SwipeDeleteRow
                key={it.id}
                entryId={it.id}
                swipeOpenId={swipeOpenId}
                setSwipeOpenId={setSwipeOpenId}
                onDelete={() => handleDelete(it.id)}
                disabled={isEditing}
                slideSurface="elevated"
              >
                <div
                  className={`bd-todo-row bd-todo-row--single-line`}
                  data-bd-mobile-entry={isMobile ? "1" : undefined}
                  onDoubleClick={() => goToWorkspace(it)}
                  onContextMenu={
                    !isMobile
                      ? (e) => {
                          e.preventDefault();
                          if (!isEditing) setEditing({ id: it.id, value: it.title ?? "" });
                        }
                      : undefined
                  }
                  style={{ cursor: "pointer" }}
                >
                  <div className="bd-todo-row-lead">
                    {isTaskItem ? (
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
                          checked={done}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleTaskComplete(it.id, e.target.checked);
                          }}
                          aria-label={done ? t("items.taskToggleOpen") : t("items.taskToggleDone")}
                        />
                      </label>
                    ) : (
                      <span className="bd-todo-row-type-lead">
                        <EntryTypeIcon type={it.itemType || "note"} size={20} />
                      </span>
                    )}
                  </div>

                  <div className="bd-todo-row-body">
                    {isEditing ? (
                      <input
                        ref={inputRef}
                        type="text"
                        data-bd-no-swipe
                        value={editing!.value}
                        onChange={(e) =>
                          setEditing((prev) => (prev ? { ...prev, value: e.target.value } : null))
                        }
                        onBlur={() => commitEdit(it.id, editing!.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") setEditing(null);
                          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                        }}
                        onDoubleClick={(e) => e.stopPropagation()}
                        aria-label={t("menu.edit")}
                        style={{
                          fontWeight: 600,
                          fontSize: "1rem",
                          color: "var(--text-primary)",
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
                          !isMobile
                            ? () => setEditing({ id: it.id, value: it.title ?? "" })
                            : undefined
                        }
                        {...(isMobile
                          ? bindMobileField(
                              it as unknown as ViewItem,
                              () => setEditing({ id: it.id, value: it.title ?? "" }),
                              () => goToWorkspace(it)
                            )
                          : {})}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          goToWorkspace(it);
                        }}
                        style={{
                          fontWeight: 600,
                          fontSize: "1rem",
                          color: "var(--text-primary)",
                          wordBreak: "break-word",
                          overflowWrap: "anywhere",
                          textDecoration: done ? "line-through" : undefined,
                          opacity: done ? 0.52 : 1,
                        }}
                      >
                        {it.scheduledTime ? (
                          <span
                            style={{
                              marginRight: "0.4rem",
                              fontSize: "0.8rem",
                              fontWeight: 500,
                              opacity: 0.72,
                            }}
                          >
                            {it.scheduledTime}
                          </span>
                        ) : null}
                        {it.title?.trim() || "—"}
                      </div>
                    )}

                    {isTaskItem && taskRec.isRecurring && (
                      <div className="bd-task-recur-badge">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                          <path d="M21 3v5h-5" />
                          <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                          <path d="M8 16H3v5" />
                        </svg>
                        {taskRec.pattern === "daily"
                          ? t("items.taskRepeatEveryDay")
                          : taskRec.days.length > 0
                            ? taskRec.days.map((d) => t(`habitReminder.dayShort.${["", "mon","tue","wed","thu","fri","sat","sun"][d]}`)).join(" · ")
                            : t("items.taskRepeatBadge")}
                      </div>
                    )}
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--text-tertiary)",
                        display: "flex",
                        gap: "0.3rem",
                        flexWrap: "wrap",
                        marginTop: "0.1rem",
                      }}
                    >
                      <span>{domainLabel(it.domain)}</span>
                      {it.project?.name ? (
                        <>
                          <span aria-hidden>·</span>
                          <span>{it.project.name}</span>
                        </>
                      ) : null}
                      {it.category ? (
                        <>
                          <span aria-hidden>·</span>
                          <span>{formatAreaLabel(it.category)}</span>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
              </SwipeDeleteRow>
            );
          })}
        </div>
      )}
    </div>
  );
}
