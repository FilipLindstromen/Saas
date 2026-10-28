import { useCallback, useRef, useState } from 'react'
import AudioRecorder from '../components/AudioRecorder'
import { transcribe } from '../services/transcribe'
import { seedTranscriptText, alignTextToWords } from '../services/wordAlign'
// @ts-ignore - shared module is JS
import { transcribeAudio } from '@shared/openai'
import type { Project } from '../types'
import './RecordTab.css'

type Props = {
  project: Project
  onProjectChange: (updater: (p: Project) => Project) => void
  openaiKey: string
  onDone: () => void
}

async function readAudioDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    const audio = document.createElement('audio')
    audio.preload = 'metadata'
    audio.onloadedmetadata = () => {
      if (Number.isFinite(audio.duration)) {
        resolve(Math.round(audio.duration * 1000))
        return
      }
      // Chromium bug: a freshly-recorded webm blob (from MediaRecorder) often reports duration
      // as Infinity until you seek past its end, which forces the browser to actually scan the
      // file and compute the real duration. Left unguarded, this Infinity ends up as the
      // project's audioDurationMs and crashes Remotion's <Player durationInFrames> downstream.
      audio.currentTime = Number.MAX_SAFE_INTEGER
      audio.ontimeupdate = () => {
        audio.ontimeupdate = null
        resolve(Number.isFinite(audio.duration) ? Math.round(audio.duration * 1000) : 0)
      }
    }
    audio.onerror = () => resolve(0)
    audio.src = url
  })
}

export default function RecordTab({ project, onProjectChange, openaiKey, onDone }: Props) {
  const [status, setStatus] = useState<'idle' | 'uploading' | 'transcribing' | 'done'>('idle')
  const [error, setError] = useState('')
  const [rambling, setRambling] = useState(false)
  const [rambleError, setRambleError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // "Ramble" is a separate, one-way dictation shortcut for the Script textarea only — it never
  // touches project.audioUrl/words/lines (the actual narration-sync pipeline), so talking out a
  // script idea here can't accidentally overwrite whatever's already been recorded/transcribed
  // as the real narration below.
  const handleRamble = useCallback(async (blob: Blob) => {
    setRambleError('')
    if (!openaiKey) {
      setRambleError('Add your OpenAI API key in Settings before transcribing.')
      return
    }
    setRambling(true)
    try {
      const text = await transcribeAudio(blob, openaiKey)
      if (text) {
        onProjectChange((p) => ({ ...p, scriptNotes: p.scriptNotes ? `${p.scriptNotes}\n\n${text}` : text }))
      }
    } catch (err: any) {
      setRambleError(err?.message || 'Transcription failed.')
    } finally {
      setRambling(false)
    }
  }, [openaiKey, onProjectChange])

  const processBlob = useCallback(async (blob: Blob, fileName: string) => {
    setError('')
    if (!openaiKey) {
      setError('Add your OpenAI API key in Settings before transcribing.')
      return
    }
    try {
      setStatus('uploading')
      const form = new FormData()
      form.append('audio', blob, fileName)
      const res = await fetch('/api/upload', { method: 'POST', body: form })
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
      const { url } = (await res.json()) as { url: string }
      const durationMs = await readAudioDuration(url)

      setStatus('transcribing')
      const { words, text: fullText } = await transcribe(blob, openaiKey)
      const text = seedTranscriptText(words, fullText)
      const lines = alignTextToWords(text, words)

      onProjectChange((p) => ({ ...p, audioUrl: url, audioDurationMs: durationMs, words, lines }))
      setStatus('done')
      onDone()
    } catch (err: any) {
      setError(err?.message || 'Something went wrong.')
      setStatus('idle')
    }
  }, [openaiKey, onProjectChange, onDone])

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('audio/') && !file.type.startsWith('video/')) {
      setError('Please choose an audio (or video) file.')
      return
    }
    processBlob(file, file.name)
  }, [processBlob])

  const busy = status === 'uploading' || status === 'transcribing'

  // Plain Enter reads as a paragraph break (blank line between thoughts, easier to read while
  // recording); Shift+Enter is a single line break within the same paragraph. Inserted via
  // execCommand rather than splicing state directly, so the native undo/redo stack (ctrl+z) and
  // cursor position keep working — falls back to manual splicing on the rare browser without it.
  const handleScriptKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const insert = e.shiftKey ? '\n' : '\n\n'
    const ta = e.currentTarget
    const inserted = document.execCommand && document.execCommand('insertText', false, insert)
    if (!inserted) {
      const { selectionStart, selectionEnd, value } = ta
      const next = value.slice(0, selectionStart) + insert + value.slice(selectionEnd)
      const pos = selectionStart + insert.length
      onProjectChange((p) => ({ ...p, scriptNotes: next }))
      requestAnimationFrame(() => ta.setSelectionRange(pos, pos))
    }
  }, [onProjectChange])

  return (
    <div className="record-tab">
      <div className="record-tab__script-panel">
        <label className="record-tab__notes-label" htmlFor="script-notes">
          Script
        </label>
        <textarea
          id="script-notes"
          className="record-tab__notes-input"
          placeholder="Jot down or paste what you're going to say — read from this while you record. It's just notes; it doesn't feed the transcript."
          value={project.scriptNotes ?? ''}
          onChange={(e) => onProjectChange((p) => ({ ...p, scriptNotes: e.target.value }))}
          onKeyDown={handleScriptKeyDown}
        />
        <div className="record-tab__ramble">
          <AudioRecorder
            disabled={rambling}
            onError={setRambleError}
            onRecorded={handleRamble}
            label="Ramble"
            compact
          />
          {rambling && <p className="record-tab__ramble-status">Transcribing into script…</p>}
          {rambleError && <p className="record-tab__ramble-error">{rambleError}</p>}
        </div>
      </div>

      <div className="record-tab__actions-panel">
        <div className="record-tab__card">
          <h2>Record narration</h2>
          <p className="record-tab__hint">Record straight into the browser, then it'll be transcribed automatically.</p>
          <AudioRecorder
            disabled={busy}
            onError={setError}
            onRecorded={(blob) => processBlob(blob, 'recording.webm')}
          />
        </div>

        <div className="record-tab__divider"><span>or</span></div>

        <div className="record-tab__card">
          <h2>Import an audio clip</h2>
          <p className="record-tab__hint">Upload an existing recording (mp3, wav, m4a, webm…).</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,video/*"
            className="record-tab__file-input"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFile(file)
              e.target.value = ''
            }}
          />
          <button type="button" className="record-tab__upload-btn" onClick={() => fileInputRef.current?.click()} disabled={busy}>
            Choose file…
          </button>
        </div>

        {busy && (
          <div className="record-tab__status">
            {status === 'uploading' ? 'Uploading…' : 'Transcribing…'}
          </div>
        )}
        {error && <div className="record-tab__error">{error}</div>}

        {project.audioUrl && !busy && (
          <div className="record-tab__existing">
            <p>A narration clip is already loaded ({project.words.length} words transcribed). Recording or importing a new clip replaces it.</p>
          </div>
        )}
      </div>
    </div>
  )
}
