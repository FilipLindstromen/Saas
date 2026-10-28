import { useCallback, useEffect, useRef, useState } from 'react'
import SourceToggles from './SourceToggles'
import { searchAllSources } from '../services/stockSearch'
import { DEFAULT_BROLL_TRANSITION } from '../types'
import type { BRollTransition, Line, SearchSourceToggles, StockResult } from '../types'
import './BRollSearchPanel.css'

type Props = {
  width: number
  onResize: (w: number) => void
  activeLine: Line | null
  toggles: SearchSourceToggles
  onTogglesChange: (t: SearchSourceToggles) => void
  onSelect: (result: StockResult, transition: BRollTransition) => void
  onTransitionChange: (transition: BRollTransition) => void
  apiKeys: { pexels: string; pixabay: string; unsplash: string }
  brandColor: string | null
}

const TRANSITION_OPTIONS: { value: BRollTransition; label: string }[] = [
  { value: 'cut', label: 'Cut' },
  { value: 'crossfade', label: 'Crossfade' },
  { value: 'whip-pan', label: 'Whip pan' },
]

/** Grabs a mid-clip frame as a thumbnail for an uploaded video — stock APIs supply their own
 * poster image, but a local file has none, so one has to be captured client-side. */
function captureVideoThumbnail(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.src = url
    video.onloadedmetadata = () => {
      video.currentTime = Math.min(0.5, (video.duration || 1) / 2)
    }
    video.onseeked = () => {
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth || 320
      canvas.height = video.videoHeight || 180
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas unsupported'))
        return
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', 0.7))
    }
    video.onerror = () => reject(new Error('Could not read video'))
  })
}

const PRESET_COLORS = [
  '#000000', '#ffffff', '#6b7280', '#1e3a5f', '#0f766e',
  '#7f1d1d', '#b45309', '#4c1d95', '#166534', '#9d174d',
]

export default function BRollSearchPanel({ width, onResize, activeLine, toggles, onTogglesChange, onSelect, onTransitionChange, apiKeys, brandColor }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<StockResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [customColor, setCustomColor] = useState('#3b82f6')
  const [transition, setTransition] = useState<BRollTransition>(DEFAULT_BROLL_TRANSITION)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Reflects whatever the active line's own clip is already using (so re-opening the panel on a
  // line that's already set to crossfade doesn't silently reset to Cut), and resets to the
  // default once a line has no clip yet — a fresh pick starts from Cut, not whatever the last
  // line happened to use.
  useEffect(() => {
    setTransition(activeLine?.broll?.transition ?? DEFAULT_BROLL_TRANSITION)
  }, [activeLine?.id, activeLine?.broll?.transition])

  const handleTransitionClick = useCallback((value: BRollTransition) => {
    setTransition(value)
    if (activeLine?.broll) onTransitionChange(value)
  }, [activeLine?.broll, onTransitionChange])

  const selectColor = useCallback((hex: string) => {
    onSelect({ id: `color-${hex}`, type: 'color', source: 'color', url: hex, thumbnailUrl: hex }, transition)
  }, [onSelect, transition])

  const handleUpload = useCallback(async (file: File) => {
    setUploadError('')
    const type: 'video' | 'image' | null = file.type.startsWith('video/') ? 'video' : file.type.startsWith('image/') ? 'image' : null
    if (!type) {
      setUploadError('Choose a video or image file.')
      return
    }
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/upload-broll', { method: 'POST', body: form })
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
      const { url } = (await res.json()) as { url: string }
      const thumbnailUrl = type === 'video' ? await captureVideoThumbnail(url).catch(() => url) : url
      onSelect({ id: `upload-${Date.now()}`, type, source: 'upload', url, thumbnailUrl }, transition)
    } catch (err: any) {
      setUploadError(err?.message || 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }, [onSelect, transition])

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) return
    setLoading(true)
    setError('')

    const noSource = !toggles.pexels && !toggles.pixabay && !toggles.unsplash
    const noType = !toggles.video && !toggles.image
    if (noSource || noType) {
      setError('Enable at least one source and one media type above.')
      setResults([])
      setLoading(false)
      return
    }

    const merged = await searchAllSources(q, toggles, apiKeys)
    setResults(merged)
    if (merged.length === 0) setError('No results (check your API keys in Settings, or try another search).')
    setLoading(false)
  }, [toggles, apiKeys])

  // Re-run the last query automatically when the source/type filters change.
  useEffect(() => {
    if (query.trim()) runSearch(query)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toggles.pexels, toggles.pixabay, toggles.unsplash, toggles.video, toggles.image])

  return (
    <aside className="broll-search-panel" style={{ width }}>
      <div
        className="broll-search-panel__resize"
        onPointerDown={(e) => {
          e.preventDefault()
          const startX = e.clientX
          const startW = width
          const move = (ev: PointerEvent) => {
            const dx = startX - ev.clientX
            onResize(Math.max(260, Math.min(520, startW + dx)))
          }
          const up = () => {
            document.removeEventListener('pointermove', move)
            document.removeEventListener('pointerup', up)
          }
          document.addEventListener('pointermove', move)
          document.addEventListener('pointerup', up)
        }}
      />

      <div className="broll-search-panel__header">
        <h3>{activeLine ? 'Search b-roll' : 'B-roll search'}</h3>
        {activeLine && <p className="broll-search-panel__active-line">{activeLine.text}</p>}
      </div>

      <div className="broll-search-panel__transitions" title="How this clip hands off from the one before it">
        {TRANSITION_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`broll-search-panel__transition-btn ${transition === opt.value ? 'active' : ''}`}
            onClick={() => handleTransitionClick(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <SourceToggles toggles={toggles} onChange={onTogglesChange} />

      <div className="broll-search-panel__searchbar">
        <input
          type="text"
          placeholder="Search a word or phrase…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && runSearch(query)}
        />
        <button type="button" onClick={() => runSearch(query)} disabled={loading}>Search</button>
      </div>

      <div className="broll-search-panel__upload">
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*,image/*"
          className="broll-search-panel__upload-input"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleUpload(file)
            e.target.value = ''
          }}
        />
        <button
          type="button"
          className="broll-search-panel__upload-btn"
          disabled={!activeLine || uploading}
          title={activeLine ? 'Upload your own video or image for this line' : 'Select a line first'}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? 'Uploading…' : '⬆ Upload your own video/image'}
        </button>
        {uploadError && <p className="broll-search-panel__error">{uploadError}</p>}
      </div>

      <div className="broll-search-panel__colors">
        <p className="broll-search-panel__colors-label">Or use a background color</p>
        <div className="broll-search-panel__swatches">
          {brandColor && (
            <button
              type="button"
              className="broll-search-panel__swatch broll-search-panel__swatch--brand"
              style={{ backgroundColor: brandColor }}
              disabled={!activeLine}
              title={activeLine ? 'Use your brand color' : 'Select a line first'}
              onClick={() => selectColor(brandColor)}
            />
          )}
          {PRESET_COLORS.map((hex) => (
            <button
              key={hex}
              type="button"
              className="broll-search-panel__swatch"
              style={{ backgroundColor: hex }}
              disabled={!activeLine}
              title={activeLine ? `Use ${hex} as background` : 'Select a line first'}
              onClick={() => selectColor(hex)}
            />
          ))}
          <label className="broll-search-panel__swatch broll-search-panel__swatch--custom" style={{ backgroundColor: customColor }} title="Pick a custom color">
            <input
              type="color"
              value={customColor}
              disabled={!activeLine}
              onChange={(e) => setCustomColor(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="broll-search-panel__use-color-btn"
            disabled={!activeLine}
            onClick={() => selectColor(customColor)}
          >
            Use
          </button>
        </div>
      </div>

      {!activeLine && <p className="broll-search-panel__hint">Click "Add b-roll" on a line to assign your pick there.</p>}
      {error && <p className="broll-search-panel__error">{error}</p>}
      {loading && <p className="broll-search-panel__loading">Searching…</p>}

      <div className="broll-search-panel__grid">
        {results.map((r) => (
          <button
            key={r.id}
            type="button"
            className="broll-search-panel__item"
            disabled={!activeLine}
            title={activeLine ? 'Use this clip' : 'Select a line first'}
            onClick={() => onSelect(r, transition)}
          >
            <img src={r.thumbnailUrl} alt="" loading="lazy" />
            {r.type === 'video' && <span className="broll-search-panel__badge">▶</span>}
          </button>
        ))}
      </div>
    </aside>
  )
}
