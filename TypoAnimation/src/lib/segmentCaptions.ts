import type { CaptionWord } from '@/types/project';

export interface Segment {
  startMs: number;
  endMs: number;
  words: CaptionWord[];
}

// Splits a flat transcript into "beats" at silence gaps >= gapMs between consecutive
// words — a cheap stand-in for real scene-boundary detection: natural pauses in speech are
// where a script's scene breaks usually fall.
export function segmentByGaps(words: CaptionWord[], gapMs = 500): Segment[] {
  if (!words.length) return [];
  const segments: Segment[] = [];
  let current: CaptionWord[] = [words[0]];
  for (let i = 1; i < words.length; i++) {
    const prev = words[i - 1];
    const cur = words[i];
    if (cur.startMs - prev.endMs >= gapMs) {
      segments.push(toSegment(current));
      current = [cur];
    } else {
      current.push(cur);
    }
  }
  segments.push(toSegment(current));
  return segments;
}

function toSegment(words: CaptionWord[]): Segment {
  return { startMs: words[0].startMs, endMs: words[words.length - 1].endMs, words };
}

export interface SceneBoundary {
  startMs: number;
  endMs: number;
}

// Turns segment START times into contiguous scene boundaries spanning the whole segmented
// range (each boundary runs from one segment's start to the NEXT segment's start, so the
// trailing silence after a beat stays attached to that beat rather than vanishing) — this is
// what keeps a background video's own timeline in exact sync with scene cuts: scenes are
// laid out back-to-back with no gaps, so as long as the video is offset to start at
// segments[0].startMs (see trimStartMs), composition-frame-0-relative scene boundaries and
// absolute video time stay in lockstep for the whole composition.
export function computeSceneBoundaries(segments: Segment[], totalDurationMs: number): SceneBoundary[] {
  return segments.map((seg, i) => ({
    startMs: seg.startMs,
    endMs: i < segments.length - 1 ? segments[i + 1].startMs : Math.max(totalDurationMs, seg.endMs),
  }));
}
