import { useCallback, useRef, useState } from 'react'
import type { MusicTrack } from '../types'
import './MusicPanel.css'

type Props = {
  isOpen: boolean
  onClose: () => void
  music: MusicTrack
  onChange: (next: MusicTrack) => void
}

// No licensed stock-music library is wired up here (that needs its own API/key, same as
// Pexels/Pixabay/Unsplash) — this covers the buildable, honest subset: bring your own track,
// mixed under the narration with auto-ducking so it doesn't fight the voice.
export default function MusicPanel({ isOpen, onClose, music, onChange }: Props) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const set = (patch: Partial<MusicTrack>) => onChange({ ...music, ...patch })

  const handleUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith('audio/')) {
      setError('Choose an audio file.')
      return
    }
    setError('')
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/upload-broll', { method: 'POST', body: form })
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
      const { url } = (await res.json()) as { url: string }
      set({ url })
    } catch (err: any) {
      setError(err?.message || 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }, [music])

  if (!isOpen) return null

  return (
    <div className="music-panel-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="music-panel" role="dialog" aria-modal="true" aria-labelledby="music-panel-title">
        <div className="music-panel__header">
          <h2 id="music-panel-title">Background music</h2>
          <button type="button" className="music-panel__close" onClick={onClose} aria-label="Close">×</button>
        </div>

        {music.url ? (
          <div className="music-panel__track">
            <audio controls src={music.url} className="music-panel__player" />
            <button type="button" className="music-panel__remove" onClick={() => set({ url: null })}>Remove track</button>
          </div>
        ) : (
          <div className="music-panel__upload">
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              className="music-panel__upload-input"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleUpload(file)
                e.target.value = ''
              }}
            />
            <button type="button" className="music-panel__upload-btn" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
              {uploading ? 'Uploading…' : '⬆ Upload a music track'}
            </button>
            <p className="music-panel__hint">It'll loop under the narration for the whole video.</p>
          </div>
        )}
        {error && <p className="music-panel__error">{error}</p>}

        <div className={`music-panel__body ${music.url ? '' : 'music-panel__body--disabled'}`}>
          <div className="music-panel__field">
            <span className="music-panel__label">Music volume ({Math.round(music.volume * 100)}%)</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(music.volume * 100)}
              onChange={(e) => set({ volume: Number(e.target.value) / 100 })}
            />
          </div>

          <label className="music-panel__checkbox-field">
            <input type="checkbox" checked={music.ducking} onChange={(e) => set({ ducking: e.target.checked })} />
            Automatically lower the music under narration
          </label>
        </div>

        <button type="button" className="music-panel__done" onClick={onClose}>Done</button>
      </div>
    </div>
  )
}
