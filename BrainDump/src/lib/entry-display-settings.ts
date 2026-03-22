/** Persisted in localStorage; default true so existing behavior is unchanged. */
export const SHOW_ENTRY_TITLES_KEY = "braindump_show_entry_titles";

export const ENTRY_DISPLAY_CHANGED = "braindump-entry-display-changed";

export function loadShowEntryTitles(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(SHOW_ENTRY_TITLES_KEY) !== "false";
  } catch {
    return true;
  }
}

export function saveShowEntryTitles(show: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SHOW_ENTRY_TITLES_KEY, show ? "true" : "false");
    window.dispatchEvent(new Event(ENTRY_DISPLAY_CHANGED));
  } catch {
    /* ignore */
  }
}

/** When titles are hidden, use first line of content (fallback to title). */
export function entryPrimaryLine(it: { title: string; content?: string | null }, showTitles: boolean): string {
  if (showTitles) return (it.title ?? "").trim() || "";
  const c = (it.content ?? "").trim();
  if (c) {
    const line = c.split("\n")[0];
    return line.length > 140 ? `${line.slice(0, 140)}…` : line;
  }
  return (it.title ?? "").trim() || "—";
}
