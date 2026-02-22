import { useState, useCallback, useEffect } from 'react'
import { searchImages } from '../api/imageSearch'
import './InspectorImageSearch.css'

const SERVICES = [
  { id: 'giphy', label: 'Giphy', types: ['gifs', 'stickers'] },
  { id: 'pixabay', label: 'Pixabay', types: ['photos'] },
  { id: 'pexels', label: 'Pexels', types: ['photos'] },
  { id: 'iconify', label: 'Iconify', types: ['icons'] }
]

export default function InspectorImageSearch({ apiKeys, latestImages, onSelect, presetQuery, presetService, presetType, recentFilter }) {
  const [service, setService] = useState(presetService || 'giphy')
  const [type, setType] = useState(presetType || 'stickers')
  const [query, setQuery] = useState(presetQuery || '')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)

  const search = useCallback(async () => {
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    try {
      const { results: r, error: err } = await searchImages({ service, type, q: query.trim(), apiKeys, offset: 0 })
      setResults(r || [])
      setError(err || null)
    } catch (e) {
      setError(e.message)
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [service, type, query, apiKeys])

  const loadMore = useCallback(async () => {
    if (!query.trim() || loading || loadingMore) return
    setLoadingMore(true)
    try {
      const { results: r, error: err } = await searchImages({ service, type, q: query.trim(), apiKeys, offset: results.length })
      if (err) setError(err)
      else if (r?.length) {
        setResults(prev => {
          const existingUrls = new Set(prev.map(item => item.url))
          const newItems = r.filter(item => !existingUrls.has(item.url))
          return newItems.length ? [...prev, ...newItems] : prev
        })
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoadingMore(false)
    }
  }, [service, type, query, apiKeys, results.length, loading, loadingMore])

  const serviceConfig = SERVICES.find(s => s.id === service)
  const types = serviceConfig?.types || ['gifs', 'stickers']

  const filteredLatest = recentFilter
    ? (latestImages || []).filter(img => img.elementType === recentFilter)
    : (latestImages || [])

  useEffect(() => {
    if (presetQuery && presetQuery.trim() && apiKeys) {
      setLoading(true)
      searchImages({
        service: presetService || 'giphy',
        type: presetType || 'stickers',
        q: presetQuery.trim(),
        apiKeys,
        offset: 0
      })
        .then(({ results: r, error: err }) => {
          setResults(r || [])
          setError(err || null)
        })
        .catch(e => {
          setError(e?.message)
          setResults([])
        })
        .finally(() => setLoading(false))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount when presetQuery is set
  }, [])

  return (
    <div className="inspector-image-search">
      <div className="inspector-image-search-form">
        <div className="inspector-image-search-form-row">
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
        </div>
        <div className="inspector-image-search-form-row">
          <input
            type="text"
            placeholder="Search images..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), search())}
          />
          <button type="button" onClick={search} disabled={loading}>
            {loading ? '…' : 'Search'}
          </button>
        </div>
      </div>
      {error && <p className="inspector-image-search-error">{error}</p>}
      {filteredLatest.length > 0 && (
        <div className="inspector-image-search-section">
          <span className="inspector-image-search-label">Recent</span>
          <div className="inspector-image-search-grid">
            {filteredLatest.slice(0, 48).map((img, i) => (
              <button
                key={i}
                type="button"
                className="inspector-image-search-item"
                onClick={() => onSelect(img.url, img.source, img.searchQuery)}
              >
                <img src={img.url} alt="" />
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="inspector-image-search-section">
        <span className="inspector-image-search-label">Results</span>
        {loading && <span className="inspector-image-search-loading">Searching...</span>}
        <div className="inspector-image-search-grid">
          {results.map((item, i) => (
            <button
              key={i}
              type="button"
              className="inspector-image-search-item"
              onClick={() => onSelect(item.url, service, query.trim() || undefined)}
            >
              <img src={item.url} alt="" />
            </button>
          ))}
        </div>
        {results.length > 0 && (
          <button
            type="button"
            className="inspector-image-search-show-more"
            onClick={loadMore}
            disabled={loading || loadingMore}
          >
            {loadingMore ? 'Loading…' : 'Show more'}
          </button>
        )}
      </div>
    </div>
  )
}
