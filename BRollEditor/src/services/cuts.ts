import type { Cut, Delay, Line, Word } from '../types'

export type KeptRange = { origStart: number; origEnd: number; outStart: number; outEnd: number }

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/** Sorts and merges overlapping/adjacent cuts into a minimal, non-overlapping set. */
export function normalizeCuts(cuts: Cut[]): Cut[] {
  const sorted = [...cuts].filter((c) => c.endMs > c.startMs).sort((a, b) => a.startMs - b.startMs)
  const merged: Cut[] = []
  for (const c of sorted) {
    const last = merged[merged.length - 1]
    if (last && c.startMs <= last.endMs) {
      last.endMs = Math.max(last.endMs, c.endMs)
    } else {
      merged.push({ ...c })
    }
  }
  return merged
}

export function addCut(cuts: Cut[], startMs: number, endMs: number): Cut[] {
  if (endMs <= startMs) return cuts
  return normalizeCuts([...cuts, { id: newId('cut'), startMs, endMs }])
}

export function removeCut(cuts: Cut[], cutId: string): Cut[] {
  return cuts.filter((c) => c.id !== cutId)
}

export function addDelay(delays: Delay[], afterLineId: string, durationMs: number): Delay[] {
  if (durationMs <= 0) return delays
  const withoutExisting = delays.filter((d) => d.afterLineId !== afterLineId)
  return [...withoutExisting, { id: newId('delay'), afterLineId, durationMs }]
}

export function removeDelay(delays: Delay[], delayId: string): Delay[] {
  return delays.filter((d) => d.id !== delayId)
}

export function updateDelayDuration(delays: Delay[], delayId: string, durationMs: number): Delay[] {
  if (durationMs <= 0) return removeDelay(delays, delayId)
  return delays.map((d) => (d.id === delayId ? { ...d, durationMs } : d))
}

/**
 * Maps the original (pre-cut) timeline to the output (post-cut, post-delay) timeline as a list
 * of ranges. Cuts remove original-time spans (no output produced for them); delay insertions do
 * the opposite — a zero-width slice of ORIGINAL time that still produces `durationMs` of OUTPUT
 * time, i.e. output time that doesn't correspond to any moment in the source recording at all.
 * `origToOutMs`/`outToOrigMs` and the line/word remappers below all work unchanged against a
 * zero-origin-width range (a point in original time simply maps to the start of its inserted
 * span); the only place that needs to know to treat it specially is the audio renderer, which
 * should render silence instead of a zero-length clip for it (see Composition.tsx).
 *
 * With no cuts and no delays, this is one range spanning the whole clip — cut/delay-aware code
 * paths degrade to the old "one continuous timeline" behavior for free.
 */
export function buildKeptRanges(cuts: Cut[], totalMs: number, delayInsertions: { atMs: number; durationMs: number }[] = []): KeptRange[] {
  const merged = normalizeCuts(cuts)
  const sortedDelays = [...delayInsertions].sort((a, b) => a.atMs - b.atMs)
  const ranges: KeptRange[] = []
  let outCursor = 0

  function emitKept(from: number, to: number) {
    let segStart = from
    for (const d of sortedDelays) {
      if (d.atMs <= segStart || d.atMs > to) continue
      if (d.atMs > segStart) {
        const len = d.atMs - segStart
        ranges.push({ origStart: segStart, origEnd: d.atMs, outStart: outCursor, outEnd: outCursor + len })
        outCursor += len
      }
      ranges.push({ origStart: d.atMs, origEnd: d.atMs, outStart: outCursor, outEnd: outCursor + d.durationMs })
      outCursor += d.durationMs
      segStart = d.atMs
    }
    if (to > segStart) {
      const len = to - segStart
      ranges.push({ origStart: segStart, origEnd: to, outStart: outCursor, outEnd: outCursor + len })
      outCursor += len
    }
  }

  let cursor = 0
  for (const cut of merged) {
    const start = Math.max(0, Math.min(cut.startMs, totalMs))
    const end = Math.max(0, Math.min(cut.endMs, totalMs))
    if (start > cursor) emitKept(cursor, start)
    cursor = Math.max(cursor, end)
  }
  if (cursor < totalMs) emitKept(cursor, totalMs)

  return ranges
}

export function outputDurationMs(keptRanges: KeptRange[]): number {
  if (keptRanges.length === 0) return 0
  return keptRanges[keptRanges.length - 1].outEnd
}

/** Original-time ms -> output-time ms, or null if that instant falls inside a cut. */
export function origToOutMs(ms: number, keptRanges: KeptRange[]): number | null {
  for (const r of keptRanges) {
    if (ms >= r.origStart && ms <= r.origEnd) return r.outStart + (ms - r.origStart)
  }
  return null
}

/** Output-time ms -> original-time ms (inverse of origToOutMs), for e.g. seeking the waveform. */
export function outToOrigMs(ms: number, keptRanges: KeptRange[]): number {
  for (const r of keptRanges) {
    if (ms >= r.outStart && ms <= r.outEnd) return r.origStart + (ms - r.outStart)
  }
  const last = keptRanges[keptRanges.length - 1]
  return last ? last.origEnd : ms
}

/**
 * Clips each item (given in original time) against the kept ranges, producing output-time
 * fragments. An item entirely inside a cut disappears; one straddling a cut boundary is split
 * into two fragments carrying the same other fields. Used for both lines (b-roll timing) and
 * words (word-by-word caption timing) — downstream code that merges consecutive
 * identical-looking fragments back together (buildSegments) makes a split-then-rejoined item
 * behave the same as if it had never been split.
 */
function remapRangesThroughCuts<T extends { startMs: number; endMs: number }>(items: T[], keptRanges: KeptRange[]): T[] {
  const result: T[] = []
  for (const item of items) {
    for (const r of keptRanges) {
      const start = Math.max(item.startMs, r.origStart)
      const end = Math.min(item.endMs, r.origEnd)
      if (end <= start) continue
      const outStart = r.outStart + (start - r.origStart)
      const outEnd = r.outStart + (end - r.origStart)
      result.push({ ...item, startMs: outStart, endMs: outEnd })
    }
  }
  return result
}

export function remapLinesThroughCuts(lines: Line[], keptRanges: KeptRange[]): Line[] {
  // Give each fragment its own unique id (a line split across a cut boundary produces two
  // fragments that would otherwise share the same id) using the fragment's own new startMs,
  // which is unique per fragment since different kept ranges produce different output times.
  return remapRangesThroughCuts(lines, keptRanges).map((line) => ({ ...line, id: `${line.id}@${line.startMs}` }))
}

export function remapWordsThroughCuts(words: Word[], keptRanges: KeptRange[]): Word[] {
  return remapRangesThroughCuts(words, keptRanges)
}

/**
 * Finds gaps between consecutive words longer than `minGapMs` and turns them into cuts, keeping
 * `keepPaddingMs` of silence on each side so the cut doesn't clip the start/end of a word. This
 * is the "remove silence" button's whole implementation — deliberately simple (a single fixed
 * threshold) per the "keep it simple" brief rather than exposing tunable detection settings.
 */
export function detectSilences(words: Word[], totalMs: number, minGapMs = 700, keepPaddingMs = 150): Cut[] {
  const cuts: Cut[] = []
  let prevEnd = 0
  for (const w of words) {
    const gap = w.startMs - prevEnd
    if (gap > minGapMs) {
      cuts.push({ id: newId('silence'), startMs: prevEnd + keepPaddingMs, endMs: w.startMs - keepPaddingMs })
    }
    prevEnd = Math.max(prevEnd, w.endMs)
  }
  const tailGap = totalMs - prevEnd
  if (tailGap > minGapMs) {
    cuts.push({ id: newId('silence'), startMs: prevEnd + keepPaddingMs, endMs: totalMs })
  }
  return cuts.filter((c) => c.endMs > c.startMs)
}

const FILLER_WORDS = new Set(['um', 'umm', 'uhm', 'uh', 'uhh', 'erm', 'hmm', 'huh'])

function normalizeWord(text: string): string {
  return text.toLowerCase().replace(/[^a-z']/g, '')
}

/**
 * Flags standalone filler interjections ("um", "uh", …) and immediate word repeats ("the the",
 * a common self-correction artifact of talking out loud) as cuttable — same idea as
 * detectSilences (a single fixed rule, not a tunable detector), just for verbal clutter instead
 * of dead air.
 */
export function detectFillerWords(words: Word[]): Cut[] {
  const cuts: Cut[] = []
  let prevNorm = ''
  for (const w of words) {
    const norm = normalizeWord(w.text)
    if (!norm) continue
    if (FILLER_WORDS.has(norm) || norm === prevNorm) {
      cuts.push({ id: newId('filler'), startMs: w.startMs, endMs: w.endMs })
    }
    prevNorm = norm
  }
  return cuts
}
