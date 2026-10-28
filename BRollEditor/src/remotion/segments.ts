import type { BRoll, Line, Project, Word } from '../types'
import { buildKeptRanges, outputDurationMs, remapLinesThroughCuts, remapWordsThroughCuts, type KeptRange } from '../services/cuts'

export type Segment = {
  fromMs: number
  toMs: number
  broll: BRoll | null
}

/**
 * Merges consecutive lines sharing the same resolved b-roll into one visual segment, and
 * makes a line with no b-roll of its own inherit whatever the previous segment was showing
 * ("hold previous clip" — the product decision for gap lines). Leading lines before the first
 * selection get `broll: null`, rendered as a neutral placeholder.
 *
 * Lines are also allowed to have an actual TIME GAP between them now — a delay object inserts
 * extra output time between two lines that no line covers — and that gap gets bridged the same
 * way: the previous segment's clip holds through it, so "add a delay" reads as "keep playing
 * the current clip a bit longer" rather than a black hole in the video.
 */
export function buildSegments(lines: Line[]): Segment[] {
  const segments: Segment[] = []
  let lastBroll: BRoll | null = null

  for (const line of lines) {
    if (line.endMs <= line.startMs) continue
    const resolved: BRoll | null = line.broll ?? lastBroll
    if (resolved) lastBroll = resolved

    const prev = segments[segments.length - 1]
    if (prev && line.startMs > prev.toMs) prev.toMs = line.startMs

    const bridged = segments[segments.length - 1]
    const sameClip = bridged && bridged.broll?.url === resolved?.url && bridged.broll?.type === resolved?.type
    if (bridged && sameClip) {
      bridged.toMs = line.endMs
    } else {
      segments.push({ fromMs: line.startMs, toMs: line.endMs, broll: resolved })
    }
  }

  return segments
}

// Non-finite (Infinity/NaN) values must never reach here — e.g. a Chromium bug can report a
// freshly-recorded webm's duration as Infinity (see RecordTab's readAudioDuration), and that
// would otherwise flow straight into Remotion's <Player durationInFrames>, which throws and
// takes the whole preview down with it. Treat anything non-finite as "unknown" (0) instead.
function finiteOr0(n: number): number {
  return Number.isFinite(n) ? n : 0
}

/** Total original-time length to run the cut math against — the audio's own duration, or the
 * last line's end if that's somehow longer (e.g. duration hasn't loaded yet). */
function originalTotalMs(project: Project): number {
  const lastLineEnd = project.lines.reduce((max, l) => Math.max(max, finiteOr0(l.endMs)), 0)
  return Math.max(lastLineEnd, finiteOr0(project.audioDurationMs), 1000)
}

/** The original→output time mapping for this project's cuts and delays. With neither, this is
 * a single range covering the whole clip, so cut/delay-aware code paths are a no-op by default. */
export function getKeptRanges(project: Project): KeptRange[] {
  // Each delay is anchored to a line by id (set once, in the Edit tab) — resolve that to the
  // actual original-time point (the line's own endMs) the timeline needs to insert time at.
  // A delay whose line no longer exists (e.g. lines were re-split by an edit) is silently
  // dropped rather than crashing — the same graceful-degradation behavior line-id lookups
  // elsewhere in this app already have.
  const delayInsertions = project.delays
    .map((d) => {
      const line = project.lines.find((l) => l.id === d.afterLineId)
      return line ? { atMs: line.endMs, durationMs: d.durationMs } : null
    })
    .filter((d): d is { atMs: number; durationMs: number } => d !== null)
  return buildKeptRanges(project.cuts, originalTotalMs(project), delayInsertions)
}

/** project.lines re-expressed in OUTPUT (post-cut) time — what the composition/preview/export
 * should actually use to place b-roll and captions, since cut-out time no longer exists. */
export function getOutputLines(project: Project): Line[] {
  return remapLinesThroughCuts(project.lines, getKeptRanges(project))
}

/** project.words re-expressed in OUTPUT (post-cut) time — for word-by-word caption sync. */
export function getOutputWords(project: Project): Word[] {
  return remapWordsThroughCuts(project.words, getKeptRanges(project))
}

export function computeTotalDurationMs(project: Project): number {
  return Math.max(outputDurationMs(getKeptRanges(project)), 1000)
}

export function computeTotalDurationInFrames(project: Project, fps: number): number {
  return Math.max(1, Math.round((computeTotalDurationMs(project) / 1000) * fps))
}
