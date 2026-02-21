import { useState, useCallback } from 'react'
import { searchImages } from '../api/imageSearch'
import './ImageSearch.css'

const SERVICES = [
  { id: 'giphy', label: 'Giphy', types: ['gifs', 'stickers'] },
  { id: 'iconify', label: 'Iconify', types: ['icons'] }
]

export default function ImageSearch({ latestImages, onSelect, onClose, apiKeys }) {
  const [service, setService] = useState('giphy')
  const [type, setType] = useState('stickers')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const search = useCallback(async () => {
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    try {
      const { results: r, error: err } = await searchImages({ service, type, q: query.trim(), apiKeys })
      setResults(r || [])
      setError(err || null)
    } catch (e) {
      setError(e.message)
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [service, type, query, apiKeys])

  const handleSelect = useCallback((url, source, searchQuery) => {
    onSelect(url, source, searchQuery)
  }, [onSelect])

  const serviceConfig = SERVICES.find(s => s.id === service)
  const types = serviceConfig?.types || ['gifs', 'stickers']

  return (
    <div className="image-search">
      <div className="image-search-header">
        <h3>Search Images</h3>
        <button className="image-search-close" onClick={onClose}>×</button>
      </div>
      <div className="image-search-form">
        <select value={service} onChange={(e) => setService(e.target.value)}>
          {SERVICES.map(s => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
        {types.length > 1 && (
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {types.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        )}
        <input
          type="text"
          placeholder="Search..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
        />
        <button onClick={search} disabled={loading}>Search</button>
      </div>
      {latestImages.length > 0 && (
        <div className="image-search-section">
          <h4>Latest selected</h4>
          <div className="image-search-grid">
            {latestImages.map((img, i) => (
              <button
                key={i}
                className="image-search-item"
                onClick={() => handleSelect(img.url, img.source, img.searchQuery)}
              >
                <img src={img.url} alt="" />
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="image-search-section">
        <h4>Results</h4>
        {error && <p className="image-search-error">{error}</p>}
        {loading && <p className="image-search-loading">Searching...</p>}
        <div className="image-search-grid">
          {results.map((item, i) => (
            <button
              key={i}
              className="image-search-item"
              onClick={() => handleSelect(item.url, service, query.trim() || undefined)}
            >
              <img src={item.url} alt="" />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
