/** Local “use BrainDump” reminder slots — browser notifications when the app tab is open. */

export const HABIT_REMINDERS_STORAGE_KEY = "braindump-habit-reminders-v1";

/** Index aligns with `Date.getDay()`: 0 = Sunday … 6 = Saturday. */
export type HabitReminderConfig = {
  enabled: boolean;
  /** Local times in 24h `HH:mm`. */
  times: string[];
  /** Length 7; `days[d]` is active when `d === new Date().getDay()`. */
  days: boolean[];
};

const DEFAULT_TIME = "09:00";

export function defaultHabitReminderConfig(): HabitReminderConfig {
  return {
    enabled: false,
    times: [DEFAULT_TIME],
    days: [true, true, true, true, true, true, true],
  };
}

function normalizeTimeString(raw: string): string | null {
  const s = raw.trim();
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return null;
  let h = Number(m[1]);
  let min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

export function normalizeHabitReminderConfig(input: unknown): HabitReminderConfig {
  const base = defaultHabitReminderConfig();
  if (!input || typeof input !== "object") return base;
  const o = input as Record<string, unknown>;
  const enabled = typeof o.enabled === "boolean" ? o.enabled : base.enabled;

  let times: string[] = base.times;
  if (Array.isArray(o.times)) {
    const next: string[] = [];
    const seen = new Set<string>();
    for (const x of o.times) {
      if (typeof x !== "string") continue;
      const n = normalizeTimeString(x);
      if (n && !seen.has(n)) {
        seen.add(n);
        next.push(n);
      }
    }
    if (next.length) times = next.sort();
  }

  let days = [...base.days];
  const rawDays = o.days;
  if (Array.isArray(rawDays)) {
    const arr = rawDays as unknown[];
    days = base.days.map((b, i) => (i < arr.length && typeof arr[i] === "boolean" ? (arr[i] as boolean) : b));
  }

  return { enabled, times, days };
}

export function loadHabitReminderConfig(): HabitReminderConfig {
  if (typeof window === "undefined") return defaultHabitReminderConfig();
  try {
    const raw = localStorage.getItem(HABIT_REMINDERS_STORAGE_KEY);
    if (!raw) return defaultHabitReminderConfig();
    return normalizeHabitReminderConfig(JSON.parse(raw) as unknown);
  } catch {
    return defaultHabitReminderConfig();
  }
}

export function saveHabitReminderConfig(cfg: HabitReminderConfig): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(HABIT_REMINDERS_STORAGE_KEY, JSON.stringify(cfg));
    void import("@/lib/client-preferences-sync").then((m) => m.scheduleClientPreferencesUpload());
  } catch {
    /* ignore */
  }
}

/** Monday-first display order → `Date.getDay()` index. */
export const WEEKDAY_ORDER_MON_FIRST: readonly number[] = [1, 2, 3, 4, 5, 6, 0];

export function fireSessionKey(now: Date, getDayIndex: number, timeHHmm: string, slotIndex: number): string {
  const d = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  return `bd-habit-fired|${d}|${getDayIndex}|${timeHHmm}|${slotIndex}`;
}

/**
 * Fire browser notifications for matching slots (tab open). Dedupes per calendar minute per slot via sessionStorage.
 */
export function tickHabitReminders(opts: { title: string; body: string }): void {
  if (typeof window === "undefined") return;
  const cfg = loadHabitReminderConfig();
  if (!cfg.enabled) return;
  if (!("Notification" in window) || Notification.permission !== "granted") return;

  const now = new Date();
  const dow = now.getDay();
  if (!cfg.days[dow]) return;

  const hm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  for (let i = 0; i < cfg.times.length; i++) {
    const t = cfg.times[i]!;
    if (t !== hm) continue;
    const key = fireSessionKey(now, dow, t, i);
    try {
      if (sessionStorage.getItem(key)) continue;
      sessionStorage.setItem(key, "1");
    } catch {
      continue;
    }
    try {
      new Notification(opts.title, { body: opts.body, tag: "braindump-habit", requireInteraction: false });
    } catch {
      /* ignore */
    }
  }
}
