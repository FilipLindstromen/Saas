/** Listening face on the dump overlay; default on. */
export const SHOW_DUMP_FACE_KEY = "braindump_show_dump_face";

export const DUMP_FACE_CHANGED = "braindump-dump-face-changed";

export function loadShowDumpFace(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(SHOW_DUMP_FACE_KEY) !== "false";
  } catch {
    return true;
  }
}

export function saveShowDumpFace(show: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SHOW_DUMP_FACE_KEY, show ? "true" : "false");
    window.dispatchEvent(new Event(DUMP_FACE_CHANGED));
    void import("@/lib/client-preferences-sync").then((m) => m.scheduleClientPreferencesUpload());
  } catch {
    /* ignore */
  }
}
