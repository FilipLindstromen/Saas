"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { filterItemsByDueDatePreset, scheduledAtToDateKey } from "@/lib/due-date-filter";
import { formatAreaLabel } from "@/lib/personal-areas";

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

function isTaskCompleted(it: Pick<TodayItemRow, "itemType" | "progress" | "kanbanColumn">): boolean {
  if (it.itemType === "task_completed") return true;
  if (it.itemType === "task" && (it.progress === "completed" || it.kanbanColumn === "completed")) return true;
  return false;
}

function matchesToday(it: TodayItemRow, todayStr: string): boolean {
  const sched = scheduledAtToDateKey(it.scheduledAt);
  if (sched === todayStr) return true;
  const r = it.reminderAt ? String(it.reminderAt).slice(0, 10) : "";
  return r === todayStr;
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
};

export function TodayView({ onGoToWorkspace }: TodayViewProps) {
  const { t, locale } = useI18n();
  const [items, setItems] = useState<TodayItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      const bySchedule = filterItemsByDueDatePreset(merged, "today");
      const byScheduleIds = new Set(bySchedule.map((it) => it.id));
      const extraReminder = merged.filter((it) => matchesToday(it, todayStr) && !byScheduleIds.has(it.id));
      const combined = [...bySchedule, ...extraReminder] as TodayItemRow[];
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
  }, [t, todayStr]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onReload = () => void load();
    window.addEventListener("braindump-reload-items", onReload);
    return () => window.removeEventListener("braindump-reload-items", onReload);
  }, [load]);

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
        <ul className="bd-today-list">
          {items.map((it) => {
            const done = isTaskCompleted(it);
            const domainOk = it.domain === "work" || it.domain === "personal";
            const timeLabel = (it.scheduledTime ?? "").trim() || "—";
            return (
              <li key={it.id}>
                <button
                  type="button"
                  className={`bd-today-row${done ? " bd-today-row--done" : ""}`}
                  disabled={!domainOk}
                  onClick={() => {
                    if (!domainOk) return;
                    onGoToWorkspace(it.domain as "work" | "personal", {
                      projectId: it.project?.id ?? null,
                      category: it.category ?? null,
                    });
                  }}
                >
                  <span className="bd-today-row-time" aria-hidden>
                    {timeLabel}
                  </span>
                  <span className="bd-today-row-body">
                    <span className="bd-today-row-title">{it.title?.trim() || "—"}</span>
                    <span className="bd-today-row-meta">
                      <span className="bd-today-row-domain">{domainLabel(it.domain)}</span>
                      {it.project?.name ? (
                        <span className="bd-today-row-dot" aria-hidden>
                          ·
                        </span>
                      ) : null}
                      {it.project?.name ? <span>{it.project.name}</span> : null}
                      {it.category ? (
                        <span className="bd-today-row-dot" aria-hidden>
                          ·
                        </span>
                      ) : null}
                      {it.category ? <span>{formatAreaLabel(it.category)}</span> : null}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
