const SHARED_KEYS_KEY = "saasApiKeys";

export function loadSharedOpenAiKey(): string {
  if (typeof window === "undefined") return "";
  try {
    const raw = localStorage.getItem(SHARED_KEYS_KEY);
    if (!raw) return "";
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const key = parsed.openai;
    return typeof key === "string" ? key.trim() : "";
  } catch {
    return "";
  }
}
