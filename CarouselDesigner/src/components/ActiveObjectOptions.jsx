import { useState, useCallback, useEffect } from 'react'
import { searchImages } from '../api/imageSearch'
import { loadApiKeys } from '@shared/apiKeys'
import './ActiveObjectOptions.css'

const SOURCES = [
  { id: 'giphy', label: 'Giphy' },
  { id: 'icon', label: 'Iconify' }
]

const GIPHY_TYPES = [
  { id: 'stickers', label: 'stickers' },
  { id: 'gifs', label: 'gifs' }
]

function ActiveObjectOptions({ graphic, overlays = [], onUpdate, onDeselect, onDelete }) {
  const apiKeys = loadApiKeys()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState(null)
  const [service, setService] = useState(graphic?.type === 'icon' ? 'icon' : 'giphy')
  const [giphyType, setGiphyType] = useState('stickers')

  useEffect(() => {
    if (graphic) {
      setService(graphic.type === 'icon' ? 'icon' : 'giphy')
    }
  }, [graphic?.id, graphic?.type])

  const search = useCallback(async () => {
    if (!searchQuery.trim()) return
    setSearchLoading(true)
    setSearchError(null)
    try {
      const s = service === 'icon' ? 'iconify' : 'giphy'
      const t = service === 'giphy' ? giphyType : 'icons'
      const { results, error } = await searchImages({
        service: s,
        type: t,
        q: searchQuery.trim(),
        apiKeys,
        offset: 0
      })
      setSearchResults(results || [])
      setSearchError(error || null)
    } catch (e) {
      setSearchError(e?.message || 'Search failed')
      setSearchResults([])
    } finally {
      setSearchLoading(false)
    }
  }, [searchQuery, service, giphyType, apiKeys])

  const recentGraphics = overlays.filter((g) => g.id !== graphic?.id)

  if (!graphic) {
    return (
      <div className="active-object-options">
        <p className="active-object-empty">Select a graphic on the slide to edit it.</p>
      </div>
    )
  }

  const handleReplace = (url, type) => {
    onUpdate({ url, type: type ?? graphic.type })
    setSearchResults([])
    setSearchQuery('')
  }

  const tintColor = graphic.tintColor ?? null
  const tintOpacity = graphic.tintOpacity ?? 100

  return (
    <div className="active-object-options active-object-image-panel">
      <div className="active-object-header">
        <span className="active-object-label">Image</span>
        {onDelete && (
          <button type="button" className="active-object-delete-icon" onClick={onDelete} title="Delete">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
          </button>
        )}
      </div>

      <div className="active-object-section">
        <label className="active-object-section-label">RECOLOR</label>
        <div className="active-object-recolor">
          <input
            type="color"
            value={tintColor || '#ffffff'}
            onChange={(e) => onUpdate({ tintColor: e.target.value })}
            className="active-object-recolor-swatch"
          />
          <input
            type="text"
            value={tintColor || ''}
            onChange={(e) => onUpdate({ tintColor: e.target.value || null })}
            placeholder="None"
            className="active-object-recolor-input"
          />
        </div>
        {tintColor && (
          <div className="active-object-recolor-opacity">
            <input
              type="range"
              min={0}
              max={100}
              value={tintOpacity}
              onChange={(e) => onUpdate({ tintOpacity: parseInt(e.target.value, 10) })}
            />
            <span>{tintOpacity}%</span>
          </div>
        )}
      </div>

      <div className="active-object-section">
        <label className="active-object-section-label">IMAGE</label>
        <div className="active-object-image-preview-wrap">
          <div className="active-object-image-preview">
            <img src={graphic.url} alt="" />
          </div>
          <div className="active-object-image-controls">
            <select
              value={service}
              onChange={(e) => setService(e.target.value)}
              className="active-object-select"
            >
              {SOURCES.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
            {service === 'giphy' && (
              <select
                value={giphyType}
                onChange={(e) => setGiphyType(e.target.value)}
                className="active-object-select"
              >
                {GIPHY_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            )}
          </div>
        </div>
        <div className="active-object-search-row">
          <input
            type="text"
            placeholder="Search images..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && search()}
            className="active-object-search-input"
          />
          <button type="button" className="active-object-search-btn" onClick={search} disabled={searchLoading}>
            {searchLoading ? '…' : 'Search'}
          </button>
        </div>
      </div>

      {recentGraphics.length > 0 && (
        <div className="active-object-section">
          <label className="active-object-section-label">RECENT</label>
          <div className="active-object-recent-grid">
            {recentGraphics.slice(0, 6).map((g) => (
              <button
                key={g.id}
                type="button"
                className="active-object-recent-item"
                onClick={() => handleReplace(g.url, g.type)}
              >
                <img src={g.url} alt="" />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="active-object-section">
        <label className="active-object-section-label">RESULTS</label>
        {searchError && <p className="active-object-error">{searchError}</p>}
        <div className="active-object-results-grid">
          {searchResults.map((item, i) => (
            <button
              key={i}
              type="button"
              className="active-object-result-item"
              onClick={() => handleReplace(item.url, service === 'icon' ? 'icon' : 'giphy')}
            >
              <img src={item.url} alt="" />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default ActiveObjectOptions
