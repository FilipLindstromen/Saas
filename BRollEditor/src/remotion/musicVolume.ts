import type { Line } from '../types'

const DUCK_RAMP_MS = 200

export type ActiveRange = { startMs: number; endMs: number }

/** Merges line time ranges (narration-active windows) with a little padding so ducking doesn't
 * flicker up and down between two lines separated by only a brief gap. */
export function mergeActiveRanges(lines: Line[], padMs = 80): ActiveRange[] {
  const sorted = [...lines].filter((l) => l.endMs > l.startMs).sort((a, b) => a.startMs - b.startMs)
  const merged: ActiveRange[] = []
  for (const l of sorted) {
    const s = Math.max(0, l.startMs - padMs)
    const e = l.endMs + padMs
    const last = merged[merged.length - 1]
    if (last && s <= last.endMs) last.endMs = Math.max(last.endMs, e)
    else merged.push({ startMs: s, endMs: e })
  }
  return merged
}

/** The background-music volume at a given output-time instant: ducked while narration is
 * playing, ramped back up to full over the gaps — so "add music" doesn't mean the music just
 * buries the voice, and the duck/un-duck isn't an audible jump-cut in level. */
export function musicVolumeAtMs(ms: number, activeRanges: ActiveRange[], fullVolume: number, duckedVolume: number): number {
  for (const r of activeRanges) {
    if (ms < r.startMs - DUCK_RAMP_MS || ms > r.endMs + DUCK_RAMP_MS) continue
    if (ms >= r.startMs && ms <= r.endMs) return duckedVolume
    if (ms < r.startMs) {
      const t = Math.max(0, Math.min(1, (ms - (r.startMs - DUCK_RAMP_MS)) / DUCK_RAMP_MS))
      return fullVolume + (duckedVolume - fullVolume) * t
    }
    const t = Math.max(0, Math.min(1, (ms - r.endMs) / DUCK_RAMP_MS))
    return duckedVolume + (fullVolume - duckedVolume) * t
  }
  return fullVolume
}
