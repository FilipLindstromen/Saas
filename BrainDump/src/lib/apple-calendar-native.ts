import { Capacitor } from "@capacitor/core";
import { CapacitorCalendar, type CalendarEvent } from "@ebarooni/capacitor-calendar";
import type { NormalizedCalendarEvent } from "@/lib/calendar-import-braindump";

export class AppleCalendarPermissionError extends Error {
  constructor() {
    super("AppleCalendarPermissionError");
    this.name = "AppleCalendarPermissionError";
  }
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function toTimeStr(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function mapCalendarEvent(ev: CalendarEvent): NormalizedCalendarEvent | null {
  const title = (ev.title ?? "").trim() || "(Untitled event)";
  const parts: string[] = [];
  if (ev.description?.trim()) parts.push(ev.description.trim());
  if (ev.location?.trim()) parts.push(ev.location.trim());
  const content = parts.join("\n\n");
  const start = new Date(ev.startDate);
  if (Number.isNaN(start.getTime())) return null;
  if (ev.isAllDay) {
    return { title, content, dateKey: toDateKey(start), timeStr: null, allDay: true };
  }
  return {
    title,
    content,
    dateKey: toDateKey(start),
    timeStr: toTimeStr(start),
    allDay: false,
  };
}

/** True when running in the Capacitor iOS shell (EventKit available). */
export function isIosNativeCalendarImportAvailable(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
}

/**
 * Reads calendar events from the device (past ~90 days, next ~365 days), maps them to the same
 * shape as Google / .ics import.
 */
export async function fetchAppleCalendarEventsForImport(): Promise<NormalizedCalendarEvent[]> {
  if (!isIosNativeCalendarImportAvailable()) {
    throw new Error("apple_calendar_native_ios_only");
  }

  const { result } = await CapacitorCalendar.requestFullCalendarAccess();
  if (result !== "granted") {
    throw new AppleCalendarPermissionError();
  }

  const now = Date.now();
  const from = now - 90 * 24 * 60 * 60 * 1000;
  const to = now + 365 * 24 * 60 * 60 * 1000;
  const { result: events } = await CapacitorCalendar.listEventsInRange({ from, to });

  const out: NormalizedCalendarEvent[] = [];
  for (const ev of events) {
    const n = mapCalendarEvent(ev);
    if (n) out.push(n);
  }
  return out;
}
