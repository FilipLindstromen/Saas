import type { Scene } from '@/types/project';

function splitWords(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

export interface AlignedWordTimings {
  kickerStarts: number[] | null;
  lineStarts: (number[] | null)[];
}

// Maps a scene's flat wordTimings (from a transcribed voiceover, ordered kicker-then-lines)
// back onto per-line word start times (in seconds, scene-local) so Line can drive each
// word's entrance off the actual spoken timing instead of the fixed 55ms stagger. Returns
// null if the transcript's word count doesn't match the script's — a mismatch means the
// VO diverged from the script (ad-libs, edits) enough that index-alignment isn't safe, and
// callers should fall back to the fixed-stagger default instead of showing wrong timing.
export function alignWordTimingsToScene(scene: Scene): AlignedWordTimings | null {
  if (!scene.wordTimings || scene.wordTimings.length === 0) return null;

  const kickerWords = scene.kicker ? splitWords(scene.kicker) : [];
  const lineWordCounts = scene.lines.map((l) => splitWords(l.text).length);
  const totalWords = kickerWords.length + lineWordCounts.reduce((a, b) => a + b, 0);
  if (totalWords !== scene.wordTimings.length) return null;

  const starts = scene.wordTimings.map((w) => w.startMs / 1000);
  let idx = kickerWords.length;
  const kickerStarts = kickerWords.length ? starts.slice(0, kickerWords.length) : null;
  const lineStarts = lineWordCounts.map((count) => {
    const slice = starts.slice(idx, idx + count);
    idx += count;
    return slice;
  });
  return { kickerStarts, lineStarts };
}
