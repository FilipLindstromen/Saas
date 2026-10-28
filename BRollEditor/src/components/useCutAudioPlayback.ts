import { useCallback, useEffect, useRef, useState } from 'react'
import { origToOutMs, outputDurationMs, type KeptRange } from '../services/cuts'

/**
 * Plays the ORIGINAL audio file but skips over cut ranges as it goes — this is what "hear how
 * it sounds after cutting" means without actually re-encoding the file: jump forward past a cut
 * the moment playback reaches it. Tracks position in both ORIGINAL time (`origMs` — what the
 * waveform's x-axis and playhead are drawn against, since the waveform visualizes the source
 * file) and OUTPUT time (`outMs`/`totalOutMs` — what the time readout next to the play button
 * shows, since that's the edited/final duration).
 */
export function useCutAudioPlayback(keptRanges: KeptRange[]) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [origMs, setOrigMs] = useState(0)
  const totalOutMs = outputDurationMs(keptRanges)
  const outMs = origToOutMs(origMs, keptRanges) ?? 0

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onTimeUpdate = () => {
      const curMs = audio.currentTime * 1000
      const idx = keptRanges.findIndex((r) => curMs < r.origEnd)
      const range = idx === -1 ? null : keptRanges[idx]
      if (!range || curMs < range.origStart) {
        // Drifted into (or started inside) a cut — jump to the next kept range's start.
        const next = keptRanges.find((r) => r.origStart >= curMs)
        if (next) {
          audio.currentTime = next.origStart / 1000
        } else {
          audio.pause()
          setIsPlaying(false)
        }
        return
      }
      setOrigMs(curMs)
    }

    const onEnded = () => setIsPlaying(false)

    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('ended', onEnded)
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('ended', onEnded)
    }
  }, [keptRanges])

  const toggle = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) {
      audio.pause()
      setIsPlaying(false)
      return
    }
    // Restart from the top if we're at (or past) the end.
    if (outMs >= totalOutMs - 50 || keptRanges.length === 0) {
      audio.currentTime = (keptRanges[0]?.origStart ?? 0) / 1000
      setOrigMs(keptRanges[0]?.origStart ?? 0)
    }
    audio.play()
    setIsPlaying(true)
  }, [isPlaying, outMs, totalOutMs, keptRanges])

  /** Seeks to a point in ORIGINAL time — what the waveform's playhead drag/click needs. */
  const seekOrig = useCallback((ms: number) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = Math.max(0, ms) / 1000
    setOrigMs(ms)
  }, [])

  return { audioRef, isPlaying, origMs, outMs, totalOutMs, toggle, seekOrig }
}
