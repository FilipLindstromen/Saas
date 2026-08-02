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

function normSpaces(s: string): string {
  return s
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?…])/g, '$1')
    .trim();
}

/** True when a whisper token is punctuation that should follow the previous word with no space. */
function isPunctuationToken(text: string): boolean {
  const t = text.trim();
  return t.length > 0 && /^[,.;:!?…]+$/.test(t);
}

/** Join whisper word tokens for display — no space before comma, period, etc. */
export function joinCaptionTokens(tokens: string[]): string {
  let out = '';
  for (const piece of tokens) {
    const t = piece.trim();
    if (!t) continue;
    if (!out) {
      out = t;
      continue;
    }
    if (isPunctuationToken(t)) out += t;
    else out += ` ${t}`;
  }
  return normSpaces(out);
}

export function joinCaptionWords(words: CaptionWord[]): string {
  return joinCaptionTokens(words.map((w) => w.text));
}

/** Merge standalone punctuation tokens into the previous word (timing spans both). */
export function normalizeCaptionWords(words: CaptionWord[]): CaptionWord[] {
  const out: CaptionWord[] = [];
  for (const w of words) {
    const t = w.text.trim();
    if (!t) continue;
    if (out.length && isPunctuationToken(t)) {
      const prev = out[out.length - 1];
      out[out.length - 1] = { ...prev, text: prev.text + t, endMs: Math.max(prev.endMs, w.endMs) };
    } else {
      out.push({ ...w, text: t });
    }
  }
  return out;
}

function endsSentence(word: string): boolean {
  const t = word.trim();
  return /[.!?…]["')\]»]*$/.test(t);
}

// Splits at sentence endings and at silence gaps — default for voiceover → scenes.
export function segmentBySentences(words: CaptionWord[], gapMs = 500): Segment[] {
  if (!words.length) return [];
  const segments: Segment[] = [];
  let current: CaptionWord[] = [words[0]];
  for (let i = 1; i < words.length; i++) {
    const prev = words[i - 1];
    const cur = words[i];
    const gapBreak = cur.startMs - prev.endMs >= gapMs;
    const sentenceBreak = endsSentence(prev.text);
    if (gapBreak || sentenceBreak) {
      segments.push(toSegment(current));
      current = [cur];
    } else {
      current.push(cur);
    }
  }
  segments.push(toSegment(current));
  return segments;
}

export function segmentText(seg: Segment): string {
  return joinCaptionWords(seg.words);
}

export function segmentsToBeatLayout(segments: Segment[]): string {
  return segments.map(segmentText).join('\n\n');
}

export function segmentsFromBeatLayout(layout: string, words: CaptionWord[]): Segment[] {
  const blocks = layout.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  if (!blocks.length || !words.length) return segmentBySentences(words);

  const segments: Segment[] = [];
  let wi = 0;

  for (const block of blocks) {
    const target = normSpaces(block);
    const chunk: CaptionWord[] = [];
    while (wi < words.length) {
      chunk.push(words[wi++]);
      const built = normSpaces(joinCaptionTokens(chunk.map((w) => w.text)));
      if (built === target) break;
      if (built.length >= target.length && target.length > 0) break;
    }
    if (chunk.length) segments.push(toSegment(chunk));
  }

  if (wi < words.length) {
    const tail = words.slice(wi);
    if (segments.length) {
      segments[segments.length - 1] = toSegment([...segments[segments.length - 1].words, ...tail]);
    } else {
      segments.push(toSegment(tail));
    }
  }

  return segments.length ? segments : segmentBySentences(words);
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
