/**
 * Build calendar DB fields from date (YYYY-MM-DD), time (HH:mm), and notification prefs.
 */

const VALID_REMINDER_BEFORE = new Set([0, 10, 30, 60]);

/** Clamp to supported "notify N minutes before event" values (0, 10, 30, 60). */
export function normalizeReminderMinutesBefore(raw: unknown): number {
  const n = typeof raw === "number" ? raw : parseInt(String(raw ?? ""), 10);
  if (Number.isFinite(n) && VALID_REMINDER_BEFORE.has(n)) return n;
  if (!Number.isFinite(n) || n <= 0) return 0;
  if (n >= 45) return 60;
  if (n >= 20) return 30;
  if (n >= 5) return 10;
  return 0;
}

/** Parse YYYY-MM-DD and HH:mm (24h) into a Date in local time. */
export function localDateTimeToDate(dateYYYYMMDD: string, timeHHmm: string | undefined | null): Date | null {
  const d = String(dateYYYYMMDD ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  const t = String(timeHHmm ?? "").trim();
  const time =
    t && /^\d{1,2}:\d{2}$/.test(t)
      ? t.length === 5
        ? t
        : `${t.split(":")[0]!.padStart(2, "0")}:${t.split(":")[1]!.padStart(2, "0")}`
      : "09:00";
  const dt = new Date(`${d}T${time}:00`);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/** Date-only for scheduledAt column (midnight local on that calendar day). */
export function dateOnlyToStartOfDay(dateYYYYMMDD: string): Date | null {
  const d = String(dateYYYYMMDD ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  const dt = new Date(`${d}T00:00:00`);
  return Number.isNaN(dt.getTime()) ? null : dt;
}
