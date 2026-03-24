import { dateOnlyToStartOfDay, localDateTimeToDate } from "@/lib/calendar-schedule";

export interface NormalizedCalendarEvent {
  title: string;
  content: string;
  /** YYYY-MM-DD */
  dateKey: string;
  /** HH:mm 24h or null for all-day */
  timeStr: string | null;
  allDay: boolean;
}

/** Google Calendar API event (subset). */
interface GoogleCalendarEventItem {
  summary?: string;
  description?: string;
  start?: { date?: string; dateTime?: string; timeZone?: string };
  end?: { date?: string; dateTime?: string; timeZone?: string };
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

/** Parse ICS text into normalized events (best-effort; handles common DTSTART/DTEND forms). */
export function parseIcsCalendarEvents(icsRaw: string): NormalizedCalendarEvent[] {
  const text = icsRaw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const blocks = text.split(/BEGIN:VEVENT/gi).slice(1);
  const out: NormalizedCalendarEvent[] = [];

  for (const rawBlock of blocks) {
    const end = rawBlock.search(/END:VEVENT/i);
    const block = (end >= 0 ? rawBlock.slice(0, end) : rawBlock).split("\n");
    const unfold: string[] = [];
    for (const line of block) {
      if (line.startsWith(" ") || line.startsWith("\t")) {
        if (unfold.length) unfold[unfold.length - 1] += line.slice(1);
      } else if (line.trim()) unfold.push(line);
    }
    let summary = "";
    let description = "";
    let dtStartRaw = "";
    for (const line of unfold) {
      const up = line.toUpperCase();
      if (up.startsWith("SUMMARY")) {
        const c = line.lastIndexOf(":");
        const v = c >= 0 ? line.slice(c + 1).trim() : "";
        if (v) summary = v.replace(/\\n/g, "\n").replace(/\\,/g, ",");
      } else if (up.startsWith("DESCRIPTION")) {
        const c = line.lastIndexOf(":");
        const v = c >= 0 ? line.slice(c + 1).trim() : "";
        if (v) description = v.replace(/\\n/g, "\n").replace(/\\,/g, ",");
      } else if (up.startsWith("DTSTART")) {
        dtStartRaw = line;
      }
    }
    if (!dtStartRaw) continue;
    const parsed = parseIcsDtLine(dtStartRaw);
    if (!parsed) continue;
    const title = summary.trim() || "(Untitled event)";
    out.push({
      title,
      content: description.trim(),
      dateKey: parsed.dateKey,
      timeStr: parsed.allDay ? null : parsed.timeStr,
      allDay: parsed.allDay,
    });
  }

  return out;
}

function parseIcsDtLine(line: string): { dateKey: string; timeStr: string | null; allDay: boolean } | null {
  const colon = line.lastIndexOf(":");
  if (colon < 0) return null;
  const params = line.slice(0, colon);
  const valueDate = line.slice(colon + 1).trim();
  const allDay = /VALUE=DATE/i.test(params) || /^\d{8}$/.test(valueDate);
  if (/^\d{8}$/.test(valueDate)) {
    const y = valueDate.slice(0, 4);
    const m = valueDate.slice(4, 6);
    const d = valueDate.slice(6, 8);
    return { dateKey: `${y}-${m}-${d}`, timeStr: null, allDay: true };
  }
  const m = valueDate.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/);
  if (m) {
    const y = m[1]!;
    const mo = m[2]!;
    const d = m[3]!;
    const hh = m[4]!;
    const mm = m[5]!;
    return { dateKey: `${y}-${mo}-${d}`, timeStr: `${hh}:${mm}`, allDay: false };
  }
  const donly = valueDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (donly) {
    return { dateKey: `${donly[1]}-${donly[2]}-${donly[3]}`, timeStr: null, allDay: true };
  }
  return null;
}

export async function fetchGoogleCalendarEvents(
  accessToken: string,
  calendarId: string,
  options?: { timeMin?: Date; timeMax?: Date }
): Promise<NormalizedCalendarEvent[]> {
  const timeMin = options?.timeMin ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const timeMax = options?.timeMax ?? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  const calId = encodeURIComponent(calendarId);
  const params = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
  });
  const url = `https://www.googleapis.com/calendar/v3/calendars/${calId}/events?${params}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!r.ok) {
    const err = await r.text();
    throw new Error(err || `Google Calendar API ${r.status}`);
  }
  const data = (await r.json()) as { items?: GoogleCalendarEventItem[] };
  const items = data.items ?? [];
  const out: NormalizedCalendarEvent[] = [];

  for (const ev of items) {
    const title = (ev.summary ?? "").trim() || "(Untitled event)";
    const content = (ev.description ?? "").trim();
    const start = ev.start;
    if (!start) continue;
    if (start.date) {
      const dk = start.date.slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(dk)) {
        out.push({ title, content, dateKey: dk, timeStr: null, allDay: true });
      }
      continue;
    }
    if (start.dateTime) {
      const d = new Date(start.dateTime);
      if (Number.isNaN(d.getTime())) continue;
      out.push({
        title,
        content,
        dateKey: toDateKey(d),
        timeStr: toTimeStr(d),
        allDay: false,
      });
    }
  }

  return out;
}

export interface ImportCalendarToBrainDumpParams {
  domain: string;
  category: string;
  events: NormalizedCalendarEvent[];
}

/** Create a dump + one organized item per event (calendar type). Returns number created. */
export async function importCalendarEventsToBrainDump(params: ImportCalendarToBrainDumpParams): Promise<number> {
  const { domain, category, events } = params;
  if (events.length === 0) return 0;

  const resDump = await fetch("/api/dumps", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: domain === "work" ? "work" : domain === "personal" ? "personal" : "personal",
      transcriptRaw: "",
      transcriptEdited: "",
      status: "organized",
    }),
  });
  const dumpJson = await resDump.json();
  const dumpId = dumpJson.dump?.id as string | undefined;
  if (!dumpId) throw new Error("Could not create dump for import");

  let created = 0;
  for (const ev of events) {
    const scheduledAt = ev.allDay
      ? dateOnlyToStartOfDay(ev.dateKey)
      : localDateTimeToDate(ev.dateKey, ev.timeStr ?? "09:00");
    if (!scheduledAt) continue;
    const body: Record<string, unknown> = {
      dumpId,
      domain: domain === "work" || domain === "personal" ? domain : "personal",
      category,
      subcategory: "",
      projectId: null,
      itemType: "calendar",
      title: ev.title,
      content: ev.content,
      scheduledAt: scheduledAt.toISOString(),
      scheduledTime: ev.allDay ? null : ev.timeStr,
      recurrence: null,
      sendNotification: false,
    };
    const res = await fetch("/api/organized-items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) created += 1;
  }

  await fetch(`/api/dumps/${dumpId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "saved", organizedAt: new Date().toISOString() }),
  });

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("braindump-reload-items"));
  }

  return created;
}
