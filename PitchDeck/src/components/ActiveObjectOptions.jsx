import { useState, useCallback } from 'react'
import { searchImages } from '../api/imageSearch'
import { loadApiKeys } from '@shared/apiKeys'
import './ActiveObjectOptions.css'

function ActiveObjectOptions({ graphic, onUpdate, onDeselect, onDelete }) {
  const apiKeys = loadApiKeys()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState(null)
  const [showSearch, setShowSearch] = useState(false)

  const search = useCallback(async () => {
    if (!searchQuery.trim()) return
    setSearchLoading(true)
    setSearchError(null)
    try {
      const service = graphic?.type === 'icon' ? 'iconify' : 'giphy'
      const type = graphic?.type === 'icon' ? 'icons' : 'stickers'
      const { results, error } = await searchImages({
        service,
        type,
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
  }, [searchQuery, graphic?.type, apiKeys])

  if (!graphic) {
    return (
      <div className="active-object-options">
        <p className="active-object-empty">Select a graphic on the slide to edit it.</p>
      </div>
    )
  }

  const handleReplace = (url) => {
    onUpdate({ url })
    setShowSearch(false)
    setSearchResults([])
    setSearchQuery('')
  }

  return (
    <div className="active-object-options">
      <div className="active-object-header">
        <span className="active-object-label">Active object</span>
        <button type="button" className="active-object-remove" onClick={onDeselect} title="Deselect">
          ×
        </button>
      </div>
      <div className="active-object-section">
        <button
          type="button"
          className="active-object-search-toggle"
          onClick={() => setShowSearch(!showSearch)}
        >
          {showSearch ? 'Hide search' : 'Search to replace'}
        </button>
        {showSearch && (
          <div className="active-object-search">
            <div className="active-object-search-row">
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && search()}
              />
              <button type="button" onClick={search} disabled={searchLoading}>
                {searchLoading ? '…' : 'Search'}
              </button>
            </div>
            {searchError && <p className="active-object-error">{searchError}</p>}
            <div className="active-object-search-grid">
              {searchResults.map((item, i) => (
                <button key={i} type="button" className="active-object-search-item" onClick={() => handleReplace(item.url)}>
                  <img src={item.url} alt="" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="active-object-section">
        <label>Position</label>
        <div className="active-object-row">
          <div className="active-object-field">
            <span>X</span>
            <input
              type="number"
              value={Math.round(graphic.x ?? 0)}
              onChange={(e) => onUpdate({ x: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <div className="active-object-field">
            <span>Y</span>
            <input
              type="number"
              value={Math.round(graphic.y ?? 0)}
              onChange={(e) => onUpdate({ y: parseFloat(e.target.value) || 0 })}
            />
          </div>
        </div>
      </div>
      <div className="active-object-section">
        <label>Size</label>
        <div className="active-object-row">
          <div className="active-object-field">
            <span>W</span>
            <input
              type="number"
              value={Math.round(graphic.width ?? 80)}
              onChange={(e) => onUpdate({ width: Math.max(20, parseFloat(e.target.value) || 80) })}
            />
          </div>
          <div className="active-object-field">
            <span>H</span>
            <input
              type="number"
              value={Math.round(graphic.height ?? 80)}
              onChange={(e) => onUpdate({ height: Math.max(20, parseFloat(e.target.value) || 80) })}
            />
          </div>
        </div>
      </div>
      <div className="active-object-section">
        <label>Rotation</label>
        <div className="active-object-row">
          <input
            type="number"
            className="active-object-rotation"
            value={Math.round(graphic.rotation ?? 0)}
            onChange={(e) => onUpdate({ rotation: parseFloat(e.target.value) || 0 })}
          />
          <span>°</span>
        </div>
      </div>
      <div className="active-object-section">
        <label className="active-object-checkbox">
          <input
            type="checkbox"
            checked={graphic.flipHorizontal === true}
            onChange={(e) => onUpdate({ flipHorizontal: e.target.checked })}
          />
          Flip horizontal
        </label>
      </div>
      {onDelete && (
        <div className="active-object-section">
          <button type="button" className="active-object-delete" onClick={onDelete}>
            Delete graphic
          </button>
        </div>
      )}
    </div>
  )
}

export default ActiveObjectOptions
