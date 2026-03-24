/** Browser-only: play UI sounds (e.g. task completed). Default off. */
export const SOUND_EFFECTS_KEY = "braindump_sound_effects";

export function loadSoundEffectsEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(SOUND_EFFECTS_KEY) === "true";
  } catch {
    return false;
  }
}

export function saveSoundEffectsEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SOUND_EFFECTS_KEY, enabled ? "true" : "false");
  } catch {
    /* ignore */
  }
}
