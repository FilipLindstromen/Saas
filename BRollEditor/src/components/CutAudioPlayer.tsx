function formatTime(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

type Props = {
  isPlaying: boolean
  outMs: number
  totalOutMs: number
  onToggle: () => void
}

// Play/pause + time readout only — the waveform (see Waveform.tsx) is the actual scrubber now,
// so this no longer owns a progress bar or the audio element itself (both live in CutTab via
// useCutAudioPlayback, shared with the waveform's playhead).
export default function CutAudioPlayer({ isPlaying, outMs, totalOutMs, onToggle }: Props) {
  return (
    <div className="cut-audio-player">
      <button type="button" className="cut-audio-player__toggle" onClick={onToggle} aria-label={isPlaying ? 'Pause' : 'Play'}>
        {isPlaying ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
        )}
      </button>
      <span className="cut-audio-player__time">{formatTime(outMs)} / {formatTime(totalOutMs)}</span>
    </div>
  )
}
