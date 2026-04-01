/** Text scale preference (Settings + cross-device sync). */

export const TEXT_SIZE_KEY = "braindump_text_size";

/** Base body is 16px × scale (see globals.css html font-size). */
export const TEXT_SIZE_OPTIONS = [
  { value: "small", label: "Small", scale: 0.7 },
  /** Matches the previous “small” preset (formerly 0.8). */
  { value: "medium", label: "Medium", scale: 0.8 },
  { value: "large", label: "Large", scale: 1.125 },
  { value: "xlarge", label: "Extra large", scale: 1.25 },
] as const;

export function loadTextSize(): string {
  if (typeof window === "undefined") return "medium";
  try {
    const v = localStorage.getItem(TEXT_SIZE_KEY);
    if (v && TEXT_SIZE_OPTIONS.some((o) => o.value === v)) return v;
  } catch {
    /* ignore */
  }
  return "medium";
}

export function saveTextSize(value: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(TEXT_SIZE_KEY, value);
    const opt = TEXT_SIZE_OPTIONS.find((o) => o.value === value);
    document.documentElement.style.setProperty("--text-scale", String(opt?.scale ?? 1));
    void import("@/lib/client-preferences-sync").then((m) => m.scheduleClientPreferencesUpload());
  } catch (e) {
    console.warn("Failed to save text size", e);
  }
}

export function applyTextSizeOnLoad(): void {
  if (typeof window === "undefined") return;
  const value = loadTextSize();
  const opt = TEXT_SIZE_OPTIONS.find((o) => o.value === value);
  document.documentElement.style.setProperty("--text-scale", String(opt?.scale ?? 1));
}
