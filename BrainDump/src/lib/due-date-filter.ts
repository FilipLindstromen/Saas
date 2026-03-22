/** Filter items by calendar day on `scheduledAt` (tasks, calendar entries, etc.). */

export type DueDateFilterPreset = "all" | "today" | "tomorrow" | "this_week" | "no_date";

function toYyyyMmDd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** YYYY-MM-DD from API scheduledAt (ISO or date string). */
export function scheduledAtToDateKey(scheduledAt: string | null | undefined): string | null {
  if (scheduledAt == null || scheduledAt === "") return null;
  const s = String(scheduledAt);
  const slice = s.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(slice)) return slice;
  const t = Date.parse(s);
  if (Number.isNaN(t)) return null;
  return toYyyyMmDd(new Date(t));
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
