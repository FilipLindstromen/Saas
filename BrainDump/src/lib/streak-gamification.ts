import type { DumpStreakState } from "./dump-streak";

/** Organized dumps needed for each level step (level = floor(total / STEP) + 1). */
export const STREAK_LEVEL_STEP = 6;

export function streakLevelFromTotal(totalOrganizedDumps: number): number {
  return Math.floor(Math.max(0, totalOrganizedDumps) / STREAK_LEVEL_STEP) + 1;
}

export function streakLevelProgress(totalOrganizedDumps: number): {
  level: number;
  inLevel: number;
  need: number;
} {
  const n = Math.max(0, totalOrganizedDumps);
  const level = streakLevelFromTotal(n);
  const inLevel = n % STREAK_LEVEL_STEP;
  return { level, inLevel, need: STREAK_LEVEL_STEP };
}

export type StreakBadgeId =
  | "spark"
  | "flow"
  | "pulse"
  | "week"
  | "builder"
  | "depth"
  | "fortnight"
  | "milestone"
  | "month"
  | "cornerstone";

export interface StreakBadgeRule {
  id: StreakBadgeId;
  test: (s: DumpStreakState) => boolean;
}

/** Ten badges; unlock order Mix of totals and best streak. */
export const STREAK_BADGE_RULES: StreakBadgeRule[] = [
  { id: "spark", test: (s) => s.totalOrganizedDumps >= 1 },
  { id: "flow", test: (s) => s.totalOrganizedDumps >= 5 },
  { id: "pulse", test: (s) => s.longestStreak >= 3 },
  { id: "week", test: (s) => s.longestStreak >= 7 },
  { id: "builder", test: (s) => s.totalOrganizedDumps >= 15 },
  { id: "depth", test: (s) => s.totalOrganizedDumps >= 30 },
  { id: "fortnight", test: (s) => s.longestStreak >= 14 },
  { id: "milestone", test: (s) => s.totalOrganizedDumps >= 50 },
  { id: "month", test: (s) => s.longestStreak >= 30 },
  { id: "cornerstone", test: (s) => s.totalOrganizedDumps >= 100 },
];

export function streakBadgeStatuses(state: DumpStreakState): { id: StreakBadgeId; unlocked: boolean }[] {
  return STREAK_BADGE_RULES.map((r) => ({ id: r.id, unlocked: r.test(state) }));
}
