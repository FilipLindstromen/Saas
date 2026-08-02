import type { CaptionSegment } from '../types'
import styles from './TranscriptPanel.module.css'

interface TranscriptPanelProps {
  segments: CaptionSegment[]
  onSegmentsChange: (segments: CaptionSegment[]) => void
  onTranscribe: () => void
  isTranscribing: boolean
  transcribeError: string | null
}

export function TranscriptPanel({
  segments,
  onSegmentsChange,
  onTranscribe,
  isTranscribing = false,
  transcribeError = null,
}: TranscriptPanelProps) {
  const fullText = segments.length > 0 ? segments.map((s) => s.text).join(' ') : ''

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
          {isTranscribing ? 'Transcribing…' : 'Transcribe with OpenAI'}
        </button>
      </div>
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
