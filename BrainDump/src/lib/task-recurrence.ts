/**
 * Task recurrence helpers.
 *
 * Storage format (in the `recurrence` field):
 *   "task:daily"           – repeats every day
 *   "task:days:1,3,5"     – repeats on ISO weekdays (1=Mon … 7=Sun)
 *
 * When the user completes a recurring task, today's date is appended:
 *   "task:daily|2026-04-01"
 *   "task:days:1,3,5|2026-04-01"
 *
 * Calendar items continue to use "daily" | "weekly" | "monthly" (no "task:" prefix).
 */

export type TaskRecurrencePattern = "daily" | "days";

export interface ParsedTaskRecurrence {
  isRecurring: boolean;
  pattern: TaskRecurrencePattern | null;
  /** ISO weekdays included in the pattern (1=Mon … 7=Sun). Empty for "daily". */
  days: number[];
  /** YYYY-MM-DD when the task was last completed, or null. */
  completedDate: string | null;
}

/** Returns today as YYYY-MM-DD in local time. */
export function todayISODateKey(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

export function parseTaskRecurrence(recurrence: string | null | undefined): ParsedTaskRecurrence {
  if (!recurrence || !recurrence.startsWith("task:")) {
    return { isRecurring: false, pattern: null, days: [], completedDate: null };
  }

  const pipeIdx = recurrence.indexOf("|");
  const patternPart = pipeIdx >= 0 ? recurrence.slice(0, pipeIdx) : recurrence;
  const completedDate = pipeIdx >= 0 ? recurrence.slice(pipeIdx + 1) : null;

  const segments = patternPart.split(":").slice(1); // strip "task" prefix

  if (segments[0] === "daily") {
    return { isRecurring: true, pattern: "daily", days: [], completedDate };
  }
  if (segments[0] === "days" && segments[1]) {
    const days = segments[1]
      .split(",")
      .map(Number)
      .filter((n) => n >= 1 && n <= 7);
    return { isRecurring: true, pattern: "days", days, completedDate };
  }
  return { isRecurring: false, pattern: null, days: [], completedDate: null };
}

/** True if the task was already marked done today. */
export function isRecurringTaskDoneToday(recurrence: string | null | undefined): boolean {
  return isRecurringTaskDoneOnDate(recurrence, todayISODateKey());
}

function isoWeekdayFromDateKey(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  return dow === 0 ? 7 : dow;
}

/** True if the task should appear on a given local calendar day (based on its pattern). */
export function isRecurringTaskActiveOnDate(
  recurrence: string | null | undefined,
  dateKey: string
): boolean {
  const { isRecurring, pattern, days } = parseTaskRecurrence(recurrence);
  if (!isRecurring) return false;
  if (pattern === "daily") return true;
  if (pattern === "days" && days.length > 0) {
    return days.includes(isoWeekdayFromDateKey(dateKey));
  }
  return false;
}

/** True if the task should appear and be reset today (based on its pattern). */
export function isRecurringTaskActiveToday(recurrence: string | null | undefined): boolean {
  return isRecurringTaskActiveOnDate(recurrence, todayISODateKey());
}

/** True if the task was marked done on a specific local calendar day. */
export function isRecurringTaskDoneOnDate(
  recurrence: string | null | undefined,
  dateKey: string
): boolean {
  const { isRecurring, completedDate } = parseTaskRecurrence(recurrence);
  if (!isRecurring || !completedDate) return false;
  return completedDate === dateKey;
}

/** Build the recurrence string (without completion date). */
export function buildTaskRecurrenceString(pattern: TaskRecurrencePattern, days: number[]): string {
  if (pattern === "daily") return "task:daily";
  const sorted = [...days].sort((a, b) => a - b);
  return `task:days:${sorted.join(",")}`;
}

/** Append today's date to mark completion (keeps existing pattern). */
export function markTaskRecurrenceCompleted(recurrence: string): string {
  const parsed = parseTaskRecurrence(recurrence);
  if (!parsed.isRecurring || !parsed.pattern) return recurrence;
  const base = buildTaskRecurrenceString(parsed.pattern, parsed.days);
  return `${base}|${todayISODateKey()}`;
}

/** Remove completion date (keeps pattern only). */
export function clearTaskRecurrenceCompleted(recurrence: string): string {
  const parsed = parseTaskRecurrence(recurrence);
  if (!parsed.isRecurring || !parsed.pattern) return recurrence;
  return buildTaskRecurrenceString(parsed.pattern, parsed.days);
}
