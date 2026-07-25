/** Filter items by calendar day on `scheduledAt` (tasks, calendar entries, etc.). */

export type DueDateFilterPreset = "all" | "today" | "tomorrow" | "this_week" | "no_date";

function toYyyyMmDd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isRealCalendarYyyyMmDd(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * YYYY-MM-DD for the user's **local** calendar day of this schedule.
 * Do not use the first 10 chars of an ISO string — that is the UTC date (e.g. Europe: Apr 1 local → …T22Z → "2025-03-31").
 */
export function scheduledAtToDateKey(scheduledAt: string | null | undefined): string | null {
  if (scheduledAt == null || scheduledAt === "") return null;
  const s = String(scheduledAt).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return isRealCalendarYyyyMmDd(s) ? s : null;
  const t = Date.parse(s);
  if (Number.isNaN(t)) return null;
  return toYyyyMmDd(new Date(t));
}

export function filterItemsByDateKey<T extends { scheduledAt?: string | null }>(
  items: T[],
  dateKey: string
): T[] {
  return items.filter((it) => scheduledAtToDateKey(it.scheduledAt) === dateKey);
}

export function dateKeyOffset(fromToday: number): string {
  const d = startOfLocalDay(new Date());
  d.setDate(d.getDate() + fromToday);
  return toYyyyMmDd(d);
}

export function filterItemsByDueDatePreset<T extends { scheduledAt?: string | null }>(
  items: T[],
  preset: DueDateFilterPreset
): T[] {
  if (preset === "all") return items;

  const now = new Date();
  const todayStart = startOfLocalDay(now);
  const todayStr = toYyyyMmDd(todayStart);

  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const tomorrowStr = toYyyyMmDd(tomorrowStart);

  const weekStart = new Date(todayStart);
  const dow = todayStart.getDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  weekStart.setDate(weekStart.getDate() + mondayOffset);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  return items.filter((it) => {
    const key = scheduledAtToDateKey(it.scheduledAt);
    if (preset === "no_date") return !key;
    if (!key) return false;
    if (preset === "today") return key === todayStr;
    if (preset === "tomorrow") return key === tomorrowStr;
    if (preset === "this_week") {
      const d = new Date(`${key}T12:00:00`);
      return d >= weekStart && d <= weekEnd;
    }
    return true;
  });
}
