import type { CaptionSegment } from '../types'
import styles from './TranscriptPanel.module.css'

interface TranscriptPanelProps {
  segments: CaptionSegment[]
  onSegmentsChange: (segments: CaptionSegment[]) => void
  onTranscribe: () => void
  isTranscribing: boolean
  transcribeProgress: number | null
  transcribeProgressLabel: string
  transcribeError: string | null
}

export function TranscriptPanel({
  segments,
  onSegmentsChange,
  onTranscribe,
  isTranscribing = false,
  transcribeProgress = null,
  transcribeProgressLabel = '',
  transcribeError = null,
}: TranscriptPanelProps) {
  const fullText = segments.length > 0 ? segments.map((s) => s.text).join(' ') : ''
  const progressPct =
    transcribeProgress != null ? Math.min(100, Math.max(0, Math.round(transcribeProgress))) : 0

  const handleTextChange = (value: string) => {
    if (segments.length === 0) return
    const first = segments[0]
    const last = segments[segments.length - 1]
    onSegmentsChange([{ start: first.start, end: last.end, text: value.trim() }])
  }

  return (
    <div className={styles.panel}>
      <h2 className={styles.title}>Transcript</h2>
      <div className={styles.transcribeRow}>
        <button
          type="button"
          className={styles.transcribeBtn}
          onClick={onTranscribe}
          disabled={isTranscribing}
          aria-label="Transcribe video"
        >
          {isTranscribing
            ? `Transcribing… ${progressPct}%`
            : 'Transcribe with OpenAI'}
        </button>
      </div>
      {isTranscribing && (
        <div className={styles.progressBlock} role="status" aria-live="polite">
          <div className={styles.progressTrack}>
            <div
              className={styles.progressFill}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className={styles.progressLabel}>
            {transcribeProgressLabel || 'Working…'} · {progressPct}%
          </p>
        </div>
      )}
      {transcribeError && <p className={styles.error}>{transcribeError}</p>}
      <p className={styles.hint}>Edit text to fix spelling.</p>
      <textarea
        className={styles.textarea}
        value={fullText}
        onChange={(e) => handleTextChange(e.target.value)}
        placeholder="Upload a video and click Transcribe…"
        aria-label="Transcript text"
        rows={12}
      />
    </div>
  )
}
