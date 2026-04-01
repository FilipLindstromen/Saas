/**
 * Cross-device sync for data that historically lived only in localStorage.
 * Server holds a versioned JSON blob on User.clientPreferences; we mirror to the same localStorage keys the app already uses.
 */
import { getSession } from "next-auth/react";
import { BRAINDUMP_LOCALE_KEY } from "@/lib/messages";
import { DUMP_STREAK_STORAGE_KEY, type DumpStreakState } from "@/lib/dump-streak";
import {
  HABIT_REMINDERS_STORAGE_KEY,
  normalizeHabitReminderConfig,
  type HabitReminderConfig,
} from "@/lib/habit-reminders";
import { CUSTOM_AREAS_KEY } from "@/lib/personal-areas";
import { BRAINDUMP_NEW_BATCH_IDS_KEY } from "@/lib/newBatch";
import { loadRevenueCatEnabled, REVENUECAT_ENABLED_STORAGE_KEY } from "@/lib/revenuecat-settings";
import { loadSoundEffectsEnabled, SOUND_EFFECTS_KEY } from "@/lib/sound-effects-settings";
import {
  DUMP_FACE_CHANGED,
  loadShowDumpFace,
  SHOW_DUMP_FACE_KEY,
} from "@/lib/dump-face-settings";
import {
  ENTRY_DISPLAY_CHANGED,
  loadShowEntryTitles,
  SHOW_ENTRY_TITLES_KEY,
} from "@/lib/entry-display-settings";
import { applyTextSizeOnLoad, loadTextSize, TEXT_SIZE_KEY } from "@/lib/text-size-settings";

export const BRAINDUMP_CLIENT_PREFS_APPLIED_EVENT = "braindump-client-prefs-applied";

const SIDEBAR_EXPANDED_KEY = "braindump-sidebar-expanded";
const VIEW_STORAGE_KEY = "braindump-items-view";
const THEME_STORAGE_KEY = "saas-apps-theme";
const POSTIT_LINKS_KEY = "braindump_postit_links";
const GOOGLE_CALENDAR_SYNC_KEY = "braindump_google_calendar_sync";
const GOOGLE_CALENDAR_ID_KEY = "braindump_google_calendar_id";
const GOOGLE_CALENDAR_SUMMARY_KEY = "braindump_google_calendar_summary";
const SAAS_API_KEYS = "saasApiKeys";

const CURRENT_V = 1 as const;

export type ClientPreferencesPayloadV1 = {
  v: typeof CURRENT_V;
  habitReminders?: HabitReminderConfig | null;
  sidebarExpanded?: "0" | "1" | null;
  itemsView?: string | null;
  locale?: "en" | "sv" | null;
  theme?: "light" | "dark" | null;
  /** String[] serialized in localStorage as JSON array */
  customAreas?: string[] | null;
  postitLinks?: Record<string, { fromId: string; toId: string }[]> | null;
  textSize?: string | null;
  googleCalendarSync?: boolean | null;
  googleCalendarId?: string | null;
  googleCalendarSummary?: string | null;
  saasApiKeys?: Record<string, unknown> | null;
  revenuecatEnabled?: boolean | null;
  soundEffects?: boolean | null;
  dumpStreak?: DumpStreakState | null;
  showDumpFace?: boolean | null;
  showEntryTitles?: boolean | null;
  newBatchIds?: string[] | null;
};

const VIEW_TYPES = new Set(["kanban", "list", "postits", "calendar", "flowchart", "text"]);

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function readSidebarExpanded(): "0" | "1" | null {
  try {
    const v = localStorage.getItem(SIDEBAR_EXPANDED_KEY);
    if (v === "0" || v === "1") return v;
  } catch {
    /* ignore */
  }
  return null;
}

/** Snapshot current localStorage-backed preferences for upload. */
export function collectClientPreferencesFromLocal(): ClientPreferencesPayloadV1 {
  if (typeof window === "undefined") {
    return { v: CURRENT_V };
  }
  const out: ClientPreferencesPayloadV1 = { v: CURRENT_V };
  try {
    const habitRaw = localStorage.getItem(HABIT_REMINDERS_STORAGE_KEY);
    if (habitRaw) {
      out.habitReminders = normalizeHabitReminderConfig(JSON.parse(habitRaw) as unknown);
    }
  } catch {
    /* ignore */
  }
  const se = readSidebarExpanded();
  if (se != null) out.sidebarExpanded = se;

  try {
    const iv = localStorage.getItem(VIEW_STORAGE_KEY);
    if (iv && VIEW_TYPES.has(iv)) out.itemsView = iv;
  } catch {
    /* ignore */
  }

  try {
    const loc = localStorage.getItem(BRAINDUMP_LOCALE_KEY);
    if (loc === "en" || loc === "sv") out.locale = loc;
  } catch {
    /* ignore */
  }

  try {
    const th = localStorage.getItem(THEME_STORAGE_KEY);
    if (th === "light" || th === "dark") out.theme = th;
  } catch {
    /* ignore */
  }

  try {
    const raw = localStorage.getItem(CUSTOM_AREAS_KEY);
    if (raw) {
      const p = JSON.parse(raw) as unknown;
      if (Array.isArray(p)) {
        out.customAreas = p.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
      }
    }
  } catch {
    /* ignore */
  }

  try {
    const raw = localStorage.getItem(POSTIT_LINKS_KEY);
    if (raw) {
      const p = JSON.parse(raw) as unknown;
      if (p && typeof p === "object" && !Array.isArray(p)) {
        out.postitLinks = p as Record<string, { fromId: string; toId: string }[]>;
      }
    }
  } catch {
    /* ignore */
  }

  out.textSize = loadTextSize();

  try {
    out.googleCalendarSync = localStorage.getItem(GOOGLE_CALENDAR_SYNC_KEY) === "true";
  } catch {
    out.googleCalendarSync = false;
  }

  try {
    const id = localStorage.getItem(GOOGLE_CALENDAR_ID_KEY);
    if (id) out.googleCalendarId = id;
    const sum = localStorage.getItem(GOOGLE_CALENDAR_SUMMARY_KEY);
    if (sum) out.googleCalendarSummary = sum;
  } catch {
    /* ignore */
  }

  try {
    const raw = localStorage.getItem(SAAS_API_KEYS);
    if (raw) {
      const p = JSON.parse(raw) as unknown;
      if (p && typeof p === "object" && !Array.isArray(p)) out.saasApiKeys = p as Record<string, unknown>;
    }
  } catch {
    /* ignore */
  }

  out.revenuecatEnabled = loadRevenueCatEnabled();
  out.soundEffects = loadSoundEffectsEnabled();

  try {
    const raw = localStorage.getItem(DUMP_STREAK_STORAGE_KEY);
    if (raw) {
      const p = parseJson<Partial<DumpStreakState>>(raw, {});
      out.dumpStreak = {
        lastActivityDate:
          typeof p.lastActivityDate === "string" || p.lastActivityDate === null ? p.lastActivityDate ?? null : null,
        currentStreak: typeof p.currentStreak === "number" && p.currentStreak >= 0 ? p.currentStreak : 0,
        longestStreak: typeof p.longestStreak === "number" && p.longestStreak >= 0 ? p.longestStreak : 0,
        totalOrganizedDumps:
          typeof p.totalOrganizedDumps === "number" && p.totalOrganizedDumps >= 0 ? p.totalOrganizedDumps : 0,
      };
    }
  } catch {
    /* ignore */
  }

  out.showDumpFace = loadShowDumpFace();
  out.showEntryTitles = loadShowEntryTitles();

  try {
    const raw = localStorage.getItem(BRAINDUMP_NEW_BATCH_IDS_KEY);
    if (raw) {
      const arr = JSON.parse(raw) as unknown;
      if (Array.isArray(arr)) {
        out.newBatchIds = arr.filter((x): x is string => typeof x === "string");
      }
    }
  } catch {
    /* ignore */
  }

  return out;
}

/** Apply server preferences onto localStorage and DOM (theme, text scale, lang). */
export function applyClientPreferencesToLocal(payload: unknown): void {
  if (typeof window === "undefined" || !payload || typeof payload !== "object" || Array.isArray(payload)) return;
  const p = payload as Partial<ClientPreferencesPayloadV1>;
  if (p.v !== CURRENT_V && p.v !== undefined) {
    /* future versions: extend merge; for now apply what we understand */
  }

  try {
    if (p.habitReminders != null) {
      const cfg = normalizeHabitReminderConfig(p.habitReminders);
      localStorage.setItem(HABIT_REMINDERS_STORAGE_KEY, JSON.stringify(cfg));
    }
  } catch {
    /* ignore */
  }

  try {
    if (p.sidebarExpanded === "0" || p.sidebarExpanded === "1") {
      localStorage.setItem(SIDEBAR_EXPANDED_KEY, p.sidebarExpanded);
    }
  } catch {
    /* ignore */
  }

  try {
    if (p.itemsView && VIEW_TYPES.has(p.itemsView)) {
      localStorage.setItem(VIEW_STORAGE_KEY, p.itemsView);
    }
  } catch {
    /* ignore */
  }

  try {
    if (p.locale === "en" || p.locale === "sv") {
      localStorage.setItem(BRAINDUMP_LOCALE_KEY, p.locale);
      document.documentElement.lang = p.locale === "sv" ? "sv" : "en";
    }
  } catch {
    /* ignore */
  }

  try {
    if (p.theme === "light" || p.theme === "dark") {
      localStorage.setItem(THEME_STORAGE_KEY, p.theme);
      document.documentElement.setAttribute("data-theme", p.theme);
      window.dispatchEvent(new CustomEvent("saas-theme-change", { detail: p.theme }));
    }
  } catch {
    /* ignore */
  }

  try {
    if (p.customAreas != null && Array.isArray(p.customAreas)) {
      localStorage.setItem(CUSTOM_AREAS_KEY, JSON.stringify(p.customAreas));
    }
  } catch {
    /* ignore */
  }

  try {
    if (p.postitLinks != null && typeof p.postitLinks === "object" && !Array.isArray(p.postitLinks)) {
      localStorage.setItem(POSTIT_LINKS_KEY, JSON.stringify(p.postitLinks));
    }
  } catch {
    /* ignore */
  }

  try {
    if (typeof p.textSize === "string" && p.textSize.length > 0) {
      localStorage.setItem(TEXT_SIZE_KEY, p.textSize);
    }
  } catch {
    /* ignore */
  }

  applyTextSizeOnLoad();

  try {
    if (typeof p.googleCalendarSync === "boolean") {
      localStorage.setItem(GOOGLE_CALENDAR_SYNC_KEY, p.googleCalendarSync ? "true" : "false");
    }
  } catch {
    /* ignore */
  }

  try {
    if (p.googleCalendarId != null) {
      if (p.googleCalendarId === "") localStorage.removeItem(GOOGLE_CALENDAR_ID_KEY);
      else localStorage.setItem(GOOGLE_CALENDAR_ID_KEY, p.googleCalendarId);
    }
    if (p.googleCalendarSummary != null) {
      localStorage.setItem(GOOGLE_CALENDAR_SUMMARY_KEY, p.googleCalendarSummary);
    }
  } catch {
    /* ignore */
  }

  try {
    if (p.saasApiKeys != null && typeof p.saasApiKeys === "object" && !Array.isArray(p.saasApiKeys)) {
      localStorage.setItem(SAAS_API_KEYS, JSON.stringify(p.saasApiKeys));
    }
  } catch {
    /* ignore */
  }

  try {
    if (typeof p.revenuecatEnabled === "boolean") {
      localStorage.setItem(REVENUECAT_ENABLED_STORAGE_KEY, p.revenuecatEnabled ? "true" : "false");
    }
  } catch {
    /* ignore */
  }

  try {
    if (typeof p.soundEffects === "boolean") {
      localStorage.setItem(SOUND_EFFECTS_KEY, p.soundEffects ? "true" : "false");
    }
  } catch {
    /* ignore */
  }

  try {
    if (p.dumpStreak != null && typeof p.dumpStreak === "object") {
      const d = p.dumpStreak;
      const state: DumpStreakState = {
        lastActivityDate:
          typeof d.lastActivityDate === "string" || d.lastActivityDate === null ? d.lastActivityDate ?? null : null,
        currentStreak: typeof d.currentStreak === "number" && d.currentStreak >= 0 ? d.currentStreak : 0,
        longestStreak: typeof d.longestStreak === "number" && d.longestStreak >= 0 ? d.longestStreak : 0,
        totalOrganizedDumps:
          typeof d.totalOrganizedDumps === "number" && d.totalOrganizedDumps >= 0 ? d.totalOrganizedDumps : 0,
      };
      localStorage.setItem(DUMP_STREAK_STORAGE_KEY, JSON.stringify(state));
    }
  } catch {
    /* ignore */
  }

  try {
    if (typeof p.showDumpFace === "boolean") {
      localStorage.setItem(SHOW_DUMP_FACE_KEY, p.showDumpFace ? "true" : "false");
      window.dispatchEvent(new Event(DUMP_FACE_CHANGED));
    }
  } catch {
    /* ignore */
  }

  try {
    if (typeof p.showEntryTitles === "boolean") {
      localStorage.setItem(SHOW_ENTRY_TITLES_KEY, p.showEntryTitles ? "true" : "false");
      window.dispatchEvent(new Event(ENTRY_DISPLAY_CHANGED));
    }
  } catch {
    /* ignore */
  }

  try {
    if (p.newBatchIds != null && Array.isArray(p.newBatchIds)) {
      localStorage.setItem(BRAINDUMP_NEW_BATCH_IDS_KEY, JSON.stringify(p.newBatchIds));
    }
  } catch {
    /* ignore */
  }
}

function isServerPrefsEmpty(prefs: Record<string, unknown>): boolean {
  return Object.keys(prefs).every((k) => k === "v");
}

async function putClientPreferences(preferences: ClientPreferencesPayloadV1): Promise<void> {
  await fetch("/api/user/preferences", {
    method: "PUT",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ preferences }),
  });
}

/** Pull server state, or seed server from this device when the cloud copy is still empty. */
export async function fetchAndApplyClientPreferences(): Promise<void> {
  try {
    const r = await fetch("/api/user/preferences", { credentials: "same-origin" });
    if (!r.ok) return;
    const data = (await r.json()) as { preferences?: unknown };
    if (data.preferences == null || typeof data.preferences !== "object" || Array.isArray(data.preferences)) {
      return;
    }
    const prefs = data.preferences as Record<string, unknown>;
    if (Object.keys(prefs).length === 0 || isServerPrefsEmpty(prefs)) {
      await putClientPreferences(collectClientPreferencesFromLocal());
      return;
    }
    applyClientPreferencesToLocal(prefs);
  } catch {
    /* ignore */
  }
}

let uploadTimer: ReturnType<typeof setTimeout> | null = null;

/** Debounced upload of full local preference snapshot (authenticated sessions only). */
export function scheduleClientPreferencesUpload(): void {
  if (typeof window === "undefined") return;
  if (uploadTimer != null) clearTimeout(uploadTimer);
  uploadTimer = setTimeout(() => {
    uploadTimer = null;
    void (async () => {
      try {
        const session = await getSession();
        const userId = (session?.user as { id?: string } | undefined)?.id;
        if (!userId) return;
        await putClientPreferences(collectClientPreferencesFromLocal());
      } catch {
        /* ignore */
      }
    })();
  }, 900);
}
