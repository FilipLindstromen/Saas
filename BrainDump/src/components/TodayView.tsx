"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useI18n } from "@/lib/i18n";
import { dateKeyOffset, filterItemsByDateKey } from "@/lib/due-date-filter";
import { formatAreaLabel } from "@/lib/personal-areas";
import {
  SwipeDeleteRow,
  EntryTypeIcon,
  useMobileEntryFieldGestures,
  type ViewItem,
} from "@/components/ItemsViewArea";
import {
  isRecurringTaskActiveOnDate,
  isRecurringTaskDoneOnDate,
  markTaskRecurrenceCompleted,
  clearTaskRecurrenceCompleted,
  parseTaskRecurrence,
} from "@/lib/task-recurrence";

const FETCH_TIMEOUT_MS = 15000;
const INITIAL_PAST_DAYS = 7;
const INITIAL_FUTURE_DAYS = 21;
const LOAD_MORE_DAYS = 14;
const SCROLL_LOAD_THRESHOLD = 280;

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
  return dateKeyOffset(0);
}

function dayOffsetFromKeys(dateKey: string, anchorKey: string): number {
  const [ay, am, ad] = anchorKey.split("-").map(Number);
  const [dy, dm, dd] = dateKey.split("-").map(Number);
  const anchor = new Date(ay, am - 1, ad).getTime();
  const target = new Date(dy, dm - 1, dd).getTime();
  return Math.round((target - anchor) / 86400000);
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
  const scheduled = filterItemsByDateKey(allItems, dateKey);
  const scheduledIds = new Set(scheduled.map((it) => it.id));
  const recurring = allItems.filter(
    (it) =>
      !scheduledIds.has(it.id) &&
      isTask(it) &&
      isRecurringTaskActiveOnDate(it.recurrence, dateKey)
  );
  const combined = [...scheduled, ...recurring];
  combined.sort(sortTimelineRows);
  return combined;
}

function formatTimeLabel(time: string | null | undefined): string {
  const raw = (time ?? "").trim();
  if (!raw) return "";
  const m = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return raw;
  const hour = Number(m[1]);
  const minute = m[2];
  const period = hour >= 12 ? "pm" : "am";
  const h12 = hour % 12 || 12;
  return `${h12}:${minute}${period}`;
}

type TodayViewProps = {
  onGoToWorkspace: (
    domain: "work" | "personal",
    opts: { projectId: string | null; category: string | null }
  ) => void;
  isMobile?: boolean;
};

export type TodayViewHandle = {
  scrollToToday: () => void;
};

export const TodayView = forwardRef<TodayViewHandle, TodayViewProps>(function TodayView(
  { onGoToWorkspace, isMobile = false },
  ref
) {
  const { t, locale } = useI18n();
  const [allItems, setAllItems] = useState<TodayItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pastDays, setPastDays] = useState(INITIAL_PAST_DAYS);
  const [futureDays, setFutureDays] = useState(INITIAL_FUTURE_DAYS);
  const [swipeOpenId, setSwipeOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const todaySectionRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const initialScrollDone = useRef(false);
  const loadingPastRef = useRef(false);
  const loadingFutureRef = useRef(false);
  const pendingScrollAdjustRef = useRef(0);
  const visibleDayRef = useRef(todayDateKey());
  const [tickDayKey, setTickDayKey] = useState<string | null>(null);
  const tickTimerRef = useRef<number | null>(null);

  const bindMobileField = useMobileEntryFieldGestures(isMobile, undefined);
  const todayKey = useMemo(() => todayDateKey(), []);

  const scrollToToday = useCallback(() => {
    const section = todaySectionRef.current;
    const scroll = scrollRef.current;
    if (!section || !scroll) return;
    section.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  useImperativeHandle(ref, () => ({ scrollToToday }), [scrollToToday]);

  const dayKeys = useMemo(() => {
    const keys: string[] = [];
    for (let offset = -pastDays; offset <= futureDays; offset += 1) {
      keys.push(dateKeyOffset(offset));
    }
    return keys;
  }, [pastDays, futureDays]);

  const formatDayLabel = useCallback(
    (dateKey: string) => {
      const offset = dayOffsetFromKeys(dateKey, todayKey);
      const formatted = new Date(`${dateKey}T12:00:00`).toLocaleDateString(
        locale === "sv" ? "sv-SE" : undefined,
        { weekday: "long", month: "long", day: "numeric" }
      );
      if (offset === 0) return `${t("today.title")} · ${formatted}`;
      if (offset === -1) return `${t("today.yesterday")} · ${formatted}`;
      if (offset === 1) return `${t("today.tomorrow")} · ${formatted}`;
      return formatted;
    },
    [locale, t, todayKey]
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
        setAllItems([]);
        return;
      }
      const dw = (await rw.json()) as { items?: TodayItemRow[] };
      const dp = (await rp.json()) as { items?: TodayItemRow[] };
      setAllItems([...(dw.items ?? []), ...(dp.items ?? [])]);
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        setAllItems([]);
      } else {
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
    if (loading || initialScrollDone.current || !todaySectionRef.current || !scrollRef.current) return;
    todaySectionRef.current.scrollIntoView({ block: "start" });
    initialScrollDone.current = true;
  }, [loading, dayKeys.length]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    const delta = pendingScrollAdjustRef.current;
    if (!el || !delta) return;
    el.scrollTop += el.scrollHeight - delta;
    pendingScrollAdjustRef.current = 0;
    loadingPastRef.current = false;
  }, [pastDays]);

  useEffect(() => {
    if (!isMobile || loading) return;
    const root = scrollRef.current;
    if (!root) return;

    const sections = Array.from(root.querySelectorAll<HTMLElement>(".bd-timeline-day[data-date]"));
    if (sections.length === 0) return;

    const pickVisibleDay = () => {
      const rootRect = root.getBoundingClientRect();
      const focusY = rootRect.top + rootRect.height * 0.28;
      let bestKey: string | null = null;
      let bestDistance = Number.POSITIVE_INFINITY;

      for (const section of sections) {
        const key = section.dataset.date;
        if (!key) continue;
        const rect = section.getBoundingClientRect();
        if (rect.bottom < rootRect.top || rect.top > rootRect.bottom) continue;
        const sectionMid = rect.top + rect.height * 0.35;
        const distance = Math.abs(sectionMid - focusY);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestKey = key;
        }
      }

      if (!bestKey || bestKey === visibleDayRef.current) return;
      visibleDayRef.current = bestKey;
      setTickDayKey(bestKey);
      if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        navigator.vibrate(10);
      }
      if (tickTimerRef.current != null) window.clearTimeout(tickTimerRef.current);
      tickTimerRef.current = window.setTimeout(() => {
        setTickDayKey(null);
        tickTimerRef.current = null;
      }, 420);
    };

    pickVisibleDay();
    root.addEventListener("scroll", pickVisibleDay, { passive: true });
    return () => {
      root.removeEventListener("scroll", pickVisibleDay);
      if (tickTimerRef.current != null) {
        window.clearTimeout(tickTimerRef.current);
        tickTimerRef.current = null;
      }
    };
  }, [isMobile, loading, dayKeys.length]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    if (el.scrollTop < SCROLL_LOAD_THRESHOLD && !loadingPastRef.current) {
      loadingPastRef.current = true;
      pendingScrollAdjustRef.current = el.scrollHeight;
      setPastDays((prev) => prev + LOAD_MORE_DAYS);
    }

    if (
      el.scrollHeight - el.scrollTop - el.clientHeight < SCROLL_LOAD_THRESHOLD &&
      !loadingFutureRef.current
    ) {
      loadingFutureRef.current = true;
      setFutureDays((prev) => prev + LOAD_MORE_DAYS);
      window.requestAnimationFrame(() => {
        loadingFutureRef.current = false;
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
        if (dateKey === todayKey) {
          newRecurrence = completed
            ? markTaskRecurrenceCompleted(currentItem.recurrence)
            : clearTaskRecurrenceCompleted(currentItem.recurrence);
        }
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
  }, [todayKey]);

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

  const isDoneOnDate = useCallback(
    (it: TodayItemRow, dateKey: string) => {
      const taskRec = parseTaskRecurrence(it.recurrence);
      if (isTask(it) && taskRec.isRecurring) {
        return isRecurringTaskDoneOnDate(it.recurrence, dateKey);
      }
      if (dateKey !== todayKey) return false;
      return isTaskCompleted(it);
    },
    [todayKey]
  );

  return (
    <div
      ref={scrollRef}
      className="bd-timeline-view"
      onScroll={handleScroll}
      role="region"
      aria-label={t("today.navAria")}
    >
      {loading ? (
        <p className="bd-timeline-status">{t("today.loading")}</p>
      ) : error ? (
        <p className="bd-timeline-status bd-timeline-status--error" role="alert">
          {error}
        </p>
      ) : (
        dayKeys.map((dateKey) => {
          const dayItems = itemsForDate(allItems, dateKey);
          const isToday = dateKey === todayKey;

          return (
            <section
              key={dateKey}
              ref={isToday ? todaySectionRef : undefined}
              className={`bd-timeline-day${isToday ? " bd-timeline-day--today" : ""}${tickDayKey === dateKey ? " bd-timeline-day--tick" : ""}`}
              data-date={dateKey}
            >
              <div className="bd-timeline-row bd-timeline-row--label">
                <div className="bd-timeline-spine" aria-hidden>
                  <span className={`bd-timeline-node${isToday ? " bd-timeline-node--today" : " bd-timeline-node--day"}`} />
                </div>
                <h2 className="bd-timeline-day-label">{formatDayLabel(dateKey)}</h2>
              </div>

              {dayItems.length === 0 ? (
                <div className="bd-timeline-row">
                  <div className="bd-timeline-spine" aria-hidden />
                  <p className="bd-timeline-day-empty">{t("today.dayEmpty")}</p>
                </div>
              ) : (
                dayItems.map((it) => {
                  const taskRec = parseTaskRecurrence(it.recurrence);
                  const done = isDoneOnDate(it, dateKey);
                  const isTaskItem = isTask(it);
                  const isEditing = editing?.id === it.id;
                  const timeLabel = formatTimeLabel(it.scheduledTime);
                  const contentPreview = (it.content ?? "").trim();

                  return (
                    <SwipeDeleteRow
                      key={`${dateKey}-${it.id}`}
                      entryId={it.id}
                      swipeOpenId={swipeOpenId}
                      setSwipeOpenId={setSwipeOpenId}
                      onDelete={() => handleDelete(it.id)}
                      disabled={isEditing}
                      slideSurface="canvas"
                    >
                      <div
                        className="bd-timeline-row bd-timeline-row--event"
                        data-bd-mobile-entry={isMobile ? "1" : undefined}
                        onDoubleClick={() => goToWorkspace(it)}
                        style={{ cursor: "pointer" }}
                      >
                        <div className="bd-timeline-spine" aria-hidden>
                          <span className="bd-timeline-node" />
                        </div>
                        <div className="bd-timeline-event-content">
                          {timeLabel ? (
                            <div className="bd-timeline-event-time">{timeLabel}</div>
                          ) : null}
                          <div className="bd-timeline-event-head">
                            {isTaskItem ? (
                              <label
                                className="bd-todo-checkbox-wrap bd-timeline-event-check"
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
                              <span className="bd-timeline-event-type">
                                <EntryTypeIcon type={it.itemType || "note"} size={18} />
                              </span>
                            )}

                            {isEditing ? (
                              <input
                                ref={inputRef}
                                type="text"
                                data-bd-no-swipe
                                className="bd-timeline-event-edit"
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
                              <div
                                className={`bd-timeline-event-title${done ? " bd-timeline-event-title--done" : ""}`}
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
                              >
                                {it.title?.trim() || "—"}
                              </div>
                            )}
                          </div>

                          {contentPreview ? (
                            <p className="bd-timeline-event-desc">{contentPreview}</p>
                          ) : null}

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

                          <div className="bd-timeline-event-meta">
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
                })
              )}
            </section>
          );
        })
      )}
    </div>
  );
});
