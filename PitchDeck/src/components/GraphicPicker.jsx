import { useState, useCallback } from 'react'
import { searchImages } from '../api/imageSearch'
import { loadApiKeys } from '@shared/apiKeys'
import './GraphicPicker.css'

const GIPHY_TYPES = [
  { id: 'stickers', label: 'Stickers' },
  { id: 'gifs', label: 'GIFs' }
]

function GraphicPicker({ isOpen, onClose, onSelect, presetService = 'giphy', presetType = 'stickers' }) {
  const apiKeys = loadApiKeys()
  const [service] = useState(presetService)
  const [type, setType] = useState(presetType)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const search = useCallback(async () => {
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    try {
      const { results: r, error: err } = await searchImages({
        service,
        type: service === 'giphy' ? type : 'icons',
        q: query.trim(),
        apiKeys,
        offset: 0
      })
      setResults(r || [])
      setError(err || null)
    } catch (e) {
      setError(e?.message || 'Search failed')
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [service, type, query, apiKeys])

  const handleSelect = (item) => {
    onSelect(item.url, service)
    onClose()
  }

  if (!isOpen) return null

  const needsGiphyKey = service === 'giphy' && !(apiKeys?.giphy || '').trim()

  return (
    <div className="graphic-picker-overlay" onClick={onClose}>
      <div className="graphic-picker-modal" onClick={(e) => e.stopPropagation()}>
        <div className="graphic-picker-header">
          <h3>{presetService === 'giphy' ? 'Add Giphy' : 'Add Icon'}</h3>
          <button type="button" className="graphic-picker-close" onClick={onClose}>×</button>
        </div>
        <div className="graphic-picker-body">
          {needsGiphyKey && (
            <p className="graphic-picker-error">
              Giphy API key required. Add it in Settings (gear icon) on the SaaS Apps screen.
            </p>
          )}
          {service === 'giphy' && !needsGiphyKey && (
            <div className="graphic-picker-type-row">
              {GIPHY_TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`graphic-picker-type-btn ${type === t.id ? 'active' : ''}`}
                  onClick={() => setType(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
          <div className="graphic-picker-search-row">
            <input
              type="text"
              placeholder="Search..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && search()}
              disabled={needsGiphyKey}
            />
            <button type="button" onClick={search} disabled={loading || needsGiphyKey}>
              {loading ? '…' : 'Search'}
            </button>
          </div>
          {error && <p className="graphic-picker-error">{error}</p>}
          <div className="graphic-picker-grid">
            {results.map((item, i) => (
              <button
                key={i}
                type="button"
                className="graphic-picker-item"
                onClick={() => handleSelect(item)}
              >
                <img src={item.url} alt="" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default GraphicPicker
