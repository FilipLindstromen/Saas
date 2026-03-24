import { loadSoundEffectsEnabled } from "@/lib/sound-effects-settings";

/**
 * Crowd cheer for completing a task (Pixabay, royalty-free):
 * https://pixabay.com/sound-effects/people-crowd-cheers-314919/
 *
 * Replace `public/sounds/people-crowd-cheers-314919.mp3` with the MP3 from that page
 * for the original clip. The repo may ship a short placeholder tone until you add it.
 */
const TASK_COMPLETE_SRC = "/sounds/people-crowd-cheers-314919.mp3";

let audio: HTMLAudioElement | null = null;

export function playTaskCompleteCheer(): void {
  if (typeof window === "undefined" || !loadSoundEffectsEnabled()) return;
  try {
    if (!audio) {
      audio = new Audio(TASK_COMPLETE_SRC);
      audio.preload = "auto";
    }
    audio.currentTime = 0;
    void audio.play().catch(() => {
      /* autoplay policy or missing file */
    });
  } catch {
    /* ignore */
  }
}
