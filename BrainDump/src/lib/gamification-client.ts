import type { GamificationClientPayload } from "@/lib/gamification";

export const BRAINDUMP_GAMIFICATION_EVENT = "bd-gamification";

declare global {
  interface WindowEventMap {
    [BRAINDUMP_GAMIFICATION_EVENT]: CustomEvent<GamificationClientPayload>;
  }
}

/** Fire toast / sidebar refresh when an API returns `gamification` in JSON. */
export function emitGamificationFromResponseBody(data: unknown): void {
  if (typeof window === "undefined") return;
  const g = (data as { gamification?: GamificationClientPayload | null }).gamification;
  if (g) {
    window.dispatchEvent(new CustomEvent(BRAINDUMP_GAMIFICATION_EVENT, { detail: g }));
  }
}
