/**
 * Default personal workspace areas (OrganizedItem.category, snake_case).
 * Merged with DB categories + user-added areas for UI chips and organize prompts.
 */
export const PERSONAL_AREA_DEFAULTS: readonly string[] = [
  "feeling",
  "wellbeing",
  "relationships",
  "health_fitness",
  "thoughts",
  "hobbies",
  "goals",
  "learning",
  "finance",
  "home",
  "travel",
  "shopping",
];

/** localStorage key for user-created personal areas (synced with ScopeBar). */
export const CUSTOM_AREAS_KEY = "braindump_custom_areas";

export function formatAreaLabel(value: string): string {
  return value.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

/** Defaults + categories in use + custom areas — includes areas with no items. */
export function getPersonalAreasList(items: { domain: string; category?: string | null }[]): string[] {
  const fromItems = [
    ...new Set(items.filter((it) => it.domain === "personal").map((it) => it.category).filter(Boolean)),
  ] as string[];
  let custom: string[] = [];
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(CUSTOM_AREAS_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      custom = Array.isArray(parsed) ? parsed.filter((c: unknown) => typeof c === "string" && c.trim()) : [];
    }
  } catch {
    /* ignore */
  }
  const combined = [...new Set([...PERSONAL_AREA_DEFAULTS, ...fromItems, ...custom])];
  return combined.sort((a, b) => a.localeCompare(b));
}
