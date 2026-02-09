import type { CaptionSegment } from '../services/captions'
import styles from './TranscriptionPanel.module.css'

function formatTime(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  const ms = Math.floor((s % 1) * 100)
  return `${m}:${sec.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`
}

interface TranscriptionPanelProps {
  segments: CaptionSegment[]
  onSegmentsChange: (segments: CaptionSegment[]) => void
  currentTime?: number
  onSeek?: (time: number) => void
  onTranscribe?: () => void
  isTranscribing?: boolean
  transcribeError?: string | null
}

export function TranscriptionPanel({
  segments,
  onSegmentsChange,
  currentTime = 0,
  onSeek,
  onTranscribe,
  isTranscribing = false,
  transcribeError = null,
}: TranscriptionPanelProps) {
  const fullText = segments.length > 0 ? segments.map((s) => s.text).join(' ') : ''

  const handleTextChange = (value: string) => {
    if (segments.length === 0) return
    const first = segments[0]
    const last = segments[segments.length - 1]
    onSegmentsChange([
      { start: first.start, end: last.end, text: value.trim() },
    ])
  }

  return (
    <div className={styles.panel}>
      <h2 className={styles.title}>Transcription</h2>
      {onTranscribe && (
        <div className={styles.transcribeRow}>
          <button
            type="button"
            className={styles.transcribeBtn}
            onClick={onTranscribe}
            disabled={isTranscribing}
            aria-label="Transcribe audio"
          >
            {isTranscribing ? 'Transcribing…' : 'Transcribe'}
          </button>
        </div>
      )}
      {transcribeError && <p className={styles.error}>{transcribeError}</p>}
      <p className={styles.hint}>Edit text before burning into video. Click a time to seek.</p>
      <textarea
        className={styles.textarea}
        value={fullText}
        onChange={(e) => handleTextChange(e.target.value)}
        placeholder="Transcribe to get captions…"
        aria-label="Full transcription text"
        rows={8}
      />
      {segments.length > 0 && onSeek && (
        <div className={styles.timeRow} role="list">
          {segments.map((seg, i) => {
            const isActive = currentTime >= seg.start && currentTime < seg.end
            return (
              <button
                key={i}
                type="button"
                className={`${styles.timeBtn} ${isActive ? styles.timeBtnActive : ''}`}
                onClick={() => onSeek(seg.start)}
                title={`Go to ${formatTime(seg.start)}`}
                aria-label={`Seek to ${formatTime(seg.start)}`}
                role="listitem"
              >
                {formatTime(seg.start)}–{formatTime(seg.end)}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
