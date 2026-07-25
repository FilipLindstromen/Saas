"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { scheduledAtToDateKey } from "@/lib/due-date-filter";
import { formatAreaLabel } from "@/lib/personal-areas";
import {
  SwipeDeleteRow,
  EntryTypeIcon,
  useMobileEntryFieldGestures,
  type ViewItem,
} from "@/components/ItemsViewArea";
import {
  clearTaskRecurrenceCompleted,
  isRecurringTaskActiveOnDate,
  isRecurringTaskDoneOnDate,
  markTaskRecurrenceCompleted,
  parseTaskRecurrence,
} from "@/lib/task-recurrence";

const FETCH_TIMEOUT_MS = 15000;
const INITIAL_DAY_RADIUS = 21;
const DAY_CHUNK = 14;
const SCROLL_EDGE_THRESHOLD = 280;

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
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

function addDaysToKey(dateKey: string, delta: number): string {
  const d = new Date(`${dateKey}T12:00:00`);
  d.setDate(d.getDate() + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function buildDateKeys(startKey: string, endKey: string): string[] {
  const keys: string[] = [];
  let current = startKey;
  while (current <= endKey) {
    keys.push(current);
    current = addDaysToKey(current, 1);
  }
  return keys;
}

function isTask(it: Pick<TodayItemRow, "itemType">): boolean {
  return it.itemType === "task" || it.itemType === "task_completed";
}

function isTaskCompleted(it: Pick<TodayItemRow, "itemType" | "progress" | "kanbanColumn">): boolean {
  if (it.itemType === "task_completed") return true;
  if (it.itemType === "task" && (it.progress === "completed" || it.kanbanColumn === "completed")) return true;
  return false;
}

function sortTimelineRows(a: TodayItemRow, b: TodayItemRow): number {
  const ta = (a.scheduledTime ?? "").trim() || "99:99";
  const tb = (b.scheduledTime ?? "").trim() || "99:99";
  const c = ta.localeCompare(tb);
  if (c !== 0) return c;
  return (a.title ?? "").localeCompare(b.title ?? "");
}

function itemsForDate(allItems: TodayItemRow[], dateKey: string): TodayItemRow[] {
  const bySchedule = allItems.filter((it) => scheduledAtToDateKey(it.scheduledAt) === dateKey);
  const scheduledIds = new Set(bySchedule.map((it) => it.id));
  const recurring = allItems.filter(
    (it) =>
      !scheduledIds.has(it.id) &&
      isTask(it) &&
      isRecurringTaskActiveOnDate(it.recurrence, dateKey)
  );
  return [...bySchedule, ...recurring].sort(sortTimelineRows);
}

function formatTimelineTime(raw: string | null | undefined, locale: string): string {
  const t = (raw ?? "").trim();
  if (!t) return "";
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) return t;
  const d = new Date();
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return d.toLocaleTimeString(locale === "sv" ? "sv-SE" : undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
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
  const [allItems, setAllItems] = useState<TodayItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [swipeOpenId, setSwipeOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const todayAnchorRef = useRef<HTMLDivElement | null>(null);
  const prependAdjustRef = useRef<{ scrollHeight: number; scrollTop: number } | null>(null);
  const didScrollToTodayRef = useRef(false);
  const expandingRef = useRef(false);

  const todayStr = useMemo(() => todayDateKey(), []);
  const [rangeStart, setRangeStart] = useState(() => addDaysToKey(todayStr, -INITIAL_DAY_RADIUS));
  const [rangeEnd, setRangeEnd] = useState(() => addDaysToKey(todayStr, INITIAL_DAY_RADIUS));

  const dateKeys = useMemo(() => buildDateKeys(rangeStart, rangeEnd), [rangeStart, rangeEnd]);

  const bindMobileField = useMobileEntryFieldGestures(isMobile, undefined);

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
        setAllItems([]);
        return;
      }
      const dw = (await rw.json()) as { items?: TodayItemRow[] };
      const dp = (await rp.json()) as { items?: TodayItemRow[] };
      setAllItems([...(dw.items ?? []), ...(dp.items ?? [])]);
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setError(t("today.loadError"));
        setAllItems([]);
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

  useLayoutEffect(() => {
    if (loading || didScrollToTodayRef.current) return;
    const anchor = todayAnchorRef.current;
    const scroller = scrollRef.current;
    if (!anchor || !scroller) return;
    didScrollToTodayRef.current = true;
    anchor.scrollIntoView({ block: "start" });
  }, [loading, dateKeys]);

  useLayoutEffect(() => {
    const adjust = prependAdjustRef.current;
    const scroller = scrollRef.current;
    if (!adjust || !scroller) return;
    const delta = scroller.scrollHeight - adjust.scrollHeight;
    scroller.scrollTop = adjust.scrollTop + delta;
    prependAdjustRef.current = null;
  }, [rangeStart]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || expandingRef.current || !didScrollToTodayRef.current) return;
    if (el.scrollTop < SCROLL_EDGE_THRESHOLD) {
      expandingRef.current = true;
      prependAdjustRef.current = { scrollHeight: el.scrollHeight, scrollTop: el.scrollTop };
      setRangeStart((s) => addDaysToKey(s, -DAY_CHUNK));
      window.requestAnimationFrame(() => {
        expandingRef.current = false;
      });
    } else if (el.scrollHeight - el.scrollTop - el.clientHeight < SCROLL_EDGE_THRESHOLD) {
      expandingRef.current = true;
      setRangeEnd((e) => addDaysToKey(e, DAY_CHUNK));
      window.requestAnimationFrame(() => {
        expandingRef.current = false;
      });
    }
  }, []);

  const handleTaskComplete = useCallback((id: string, completed: boolean, dateKey: string) => {
    setAllItems((prev) => {
      const currentItem = prev.find((it) => it.id === id);
      const taskRec = parseTaskRecurrence(currentItem?.recurrence);
      const isRecurring = taskRec.isRecurring;

      const itemType = completed ? "task_completed" : "task";
      const progress = completed ? "completed" : "todo";
      const kanbanColumn = completed ? "completed" : "todo";

      let newRecurrence: string | undefined;
      if (isRecurring && taskRec.pattern && currentItem?.recurrence) {
        newRecurrence = completed
          ? markTaskRecurrenceCompleted(currentItem.recurrence, dateKey)
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
    setAllItems((prev) => prev.filter((it) => it.id !== id));
    fetch(`/api/organized-items/${id}`, { method: "DELETE" }).catch(() => {
      void load();
    });
  }, [load]);

  const commitEdit = useCallback((id: string, value: string) => {
    const trimmed = value.trim();
    const it = allItems.find((i) => i.id === id);
    setEditing(null);
    if (!it || trimmed === (it.title ?? "").trim()) return;
    setAllItems((prev) => prev.map((i) => (i.id === id ? { ...i, title: trimmed } : i)));
    fetch(`/api/organized-items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: trimmed }),
    }).catch(() => {});
  }, [allItems]);

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

  const formatDayHeadline = (dateKey: string) => {
    const d = new Date(`${dateKey}T12:00:00`);
    const isToday = dateKey === todayStr;
    const formatted = d.toLocaleDateString(locale === "sv" ? "sv-SE" : undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
    return isToday ? `${t("today.title")} · ${formatted}` : formatted;
  };

  return (
    <div className="bd-timeline-view">
      {loading ? (
        <p className="bd-timeline-status">{t("today.loading")}</p>
      ) : error ? (
        <p className="bd-timeline-status bd-timeline-status--error" role="alert">
          {error}
        </p>
      ) : (
        <div ref={scrollRef} className="bd-timeline-scroll" onScroll={handleScroll}>
          {dateKeys.map((dateKey) => {
            const dayItems = itemsForDate(allItems, dateKey);
            const isToday = dateKey === todayStr;

            return (
              <section
                key={dateKey}
                id={`timeline-day-${dateKey}`}
                ref={isToday ? todayAnchorRef : undefined}
                className="bd-timeline-day"
                aria-label={formatDayHeadline(dateKey)}
              >
                <h2 className="bd-timeline-day-head">{formatDayHeadline(dateKey)}</h2>

                {dayItems.length === 0 ? (
                  <p className="bd-timeline-day-empty">{t("today.dayEmpty")}</p>
                ) : (
                  <div className="bd-timeline-events">
                    {dayItems.map((it, idx) => {
                      const taskRec = parseTaskRecurrence(it.recurrence);
                      const done =
                        isTask(it) && taskRec.isRecurring
                          ? isRecurringTaskDoneOnDate(it.recurrence, dateKey)
                          : isTaskCompleted(it);
                      const isTaskItem = isTask(it);
                      const isEditing = editing?.id === it.id;
                      const isLast = idx === dayItems.length - 1;
                      const timeLabel = formatTimelineTime(it.scheduledTime, locale);

                      return (
                        <SwipeDeleteRow
                          key={`${dateKey}-${it.id}`}
                          entryId={it.id}
                          swipeOpenId={swipeOpenId}
                          setSwipeOpenId={setSwipeOpenId}
                          onDelete={() => handleDelete(it.id)}
                          disabled={isEditing}
                          slideSurface="elevated"
                        >
                          <div
                            className={`bd-timeline-event${done ? " bd-timeline-event--done" : ""}`}
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
                          >
                            <div className="bd-timeline-time" aria-hidden={!timeLabel}>
                              {timeLabel || "\u00a0"}
                            </div>
                            <div className="bd-timeline-rail" aria-hidden>
                              <span className="bd-timeline-dot" />
                              {!isLast ? <span className="bd-timeline-line" /> : null}
                            </div>
                            <div className="bd-timeline-body">
                              <div className="bd-timeline-title-row">
                                {isTaskItem ? (
                                  <label
                                    className="bd-timeline-check"
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
                                        handleTaskComplete(it.id, e.target.checked, dateKey);
                                      }}
                                      aria-label={done ? t("items.taskToggleOpen") : t("items.taskToggleDone")}
                                    />
                                  </label>
                                ) : (
                                  <span className="bd-timeline-type-icon">
                                    <EntryTypeIcon type={it.itemType || "note"} size={18} />
                                  </span>
                                )}

                                {isEditing ? (
                                  <input
                                    ref={inputRef}
                                    type="text"
                                    data-bd-no-swipe
                                    className="bd-timeline-edit-input"
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
                                  />
                                ) : (
                                  <button
                                    type="button"
                                    className="bd-timeline-title"
                                    onClick={() =>
                                      isMobile
                                        ? goToWorkspace(it)
                                        : setEditing({ id: it.id, value: it.title ?? "" })
                                    }
                                    {...(isMobile
                                      ? bindMobileField(
                                          it as unknown as ViewItem,
                                          () => setEditing({ id: it.id, value: it.title ?? "" }),
                                          () => goToWorkspace(it)
                                        )
                                      : {})}
                                  >
                                    {it.title?.trim() || "—"}
                                  </button>
                                )}
                              </div>

                              {it.content?.trim() ? (
                                <p className="bd-timeline-desc">{it.content.trim()}</p>
                              ) : null}

                              <div className="bd-timeline-meta">
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
                                {isTaskItem && taskRec.isRecurring ? (
                                  <>
                                    <span aria-hidden>·</span>
                                    <span>{t("items.taskRepeatBadge")}</span>
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
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
