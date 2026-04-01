/** Lightweight dump habit streaks — localStorage with optional cloud sync via `client-preferences-sync`. */

export const DUMP_STREAK_STORAGE_KEY = "braindump-dump-streak-v1";

const STORAGE_KEY = DUMP_STREAK_STORAGE_KEY;

export const STREAK_RECORDED_EVENT = "braindump-streak-recorded";

export interface DumpStreakState {
  lastActivityDate: string | null;
  currentStreak: number;
  longestStreak: number;
  totalOrganizedDumps: number;
}

const DEFAULT: DumpStreakState = {
  lastActivityDate: null,
  currentStreak: 0,
  longestStreak: 0,
  totalOrganizedDumps: 0,
};

function localDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function previousLocalDayKey(fromKey: string): string {
  const [y, m, d] = fromKey.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - 1);
  return localDateKey(dt);
}

function loadRaw(): DumpStreakState {
  if (typeof window === "undefined") return { ...DEFAULT };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT };
    const p = JSON.parse(raw) as Partial<DumpStreakState>;
    return {
      lastActivityDate: typeof p.lastActivityDate === "string" || p.lastActivityDate === null ? p.lastActivityDate ?? null : null,
      currentStreak: typeof p.currentStreak === "number" && p.currentStreak >= 0 ? p.currentStreak : 0,
      longestStreak: typeof p.longestStreak === "number" && p.longestStreak >= 0 ? p.longestStreak : 0,
      totalOrganizedDumps: typeof p.totalOrganizedDumps === "number" && p.totalOrganizedDumps >= 0 ? p.totalOrganizedDumps : 0,
    };
  } catch {
    return { ...DEFAULT };
  }
}

function save(state: DumpStreakState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    void import("@/lib/client-preferences-sync").then((m) => m.scheduleClientPreferencesUpload());
  } catch {}
}

function emitRecorded(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(STREAK_RECORDED_EVENT));
}

/** Read streak state (no side effects). */
export function getDumpStreakState(): DumpStreakState {
  return loadRaw();
}

/**
 * Call after a successful organize + save from a dump (batch create).
 * Updates consecutive-day streak when the user completes at least one such save per local calendar day.
 */
export function recordOrganizedDump(): DumpStreakState {
  const prev = loadRaw();
  const today = localDateKey();

  if (prev.lastActivityDate === today) {
    const next: DumpStreakState = {
      ...prev,
      totalOrganizedDumps: prev.totalOrganizedDumps + 1,
    };
    save(next);
    emitRecorded();
    return next;
  }

  let newStreak = 1;
  if (prev.lastActivityDate) {
    const yesterday = previousLocalDayKey(today);
    if (prev.lastActivityDate === yesterday) {
      newStreak = prev.currentStreak + 1;
    }
  }

  const longestStreak = Math.max(prev.longestStreak, newStreak);
  const next: DumpStreakState = {
    lastActivityDate: today,
    currentStreak: newStreak,
    longestStreak,
    totalOrganizedDumps: prev.totalOrganizedDumps + 1,
  };
  save(next);
  emitRecorded();
  return next;
}
