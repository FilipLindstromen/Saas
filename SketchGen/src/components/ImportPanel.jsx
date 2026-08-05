import { useState } from 'react'
import { searchGiphyGifs } from '@shared/stockMedia/giphy'
import { ICONS, iconToDataUrl } from '../constants/icons'
import './ImportPanel.css'

export default function ImportPanel({ penColor, onStartPlacing, placing, onCancelPlacing }) {
  const [tab, setTab] = useState('icons')
  const [iconQuery, setIconQuery] = useState('')
  const [gifQuery, setGifQuery] = useState('')
  const [gifResults, setGifResults] = useState([])
  const [gifLoading, setGifLoading] = useState(false)
  const [gifError, setGifError] = useState('')
  const [stampSize, setStampSize] = useState(220)

  const filteredIcons = ICONS.filter((icon) =>
    !iconQuery.trim() || icon.name.toLowerCase().includes(iconQuery.trim().toLowerCase())
  )

  const handleGifSearch = async (e) => {
    e.preventDefault()
    setGifError('')
    setGifLoading(true)
    try {
      const { data } = await searchGiphyGifs(null, gifQuery, 24)
      setGifResults(data)
    } catch (err) {
      setGifError(err.message || 'Search failed.')
    } finally {
      setGifLoading(false)
    }
  }

  const handlePickIcon = (icon) => {
    onStartPlacing({
      url: iconToDataUrl(icon, penColor, 128),
      maxDim: stampSize,
      label: icon.name,
    })
  }

  const handlePickGif = (item) => {
    onStartPlacing({
      url: item.url,
      maxDim: stampSize,
      label: item.title || 'GIF',
    })
  }

  return (
    <div className="import-panel-section side-panel">
      <div className="side-panel-header">Import</div>
      <div className="side-panel-body">
      {placing ? (
        <div className="import-placing-banner">
          <span>Click on the canvas to place "{placing.label}", then drag out before releasing to size it (Esc to cancel)</span>
          <button type="button" onClick={onCancelPlacing}>Cancel</button>
        </div>
      ) : (
        <>
          <div className="import-panel-tabs">
            <button type="button" className={tab === 'icons' ? 'active' : ''} onClick={() => setTab('icons')}>Icons</button>
            <button type="button" className={tab === 'gifs' ? 'active' : ''} onClick={() => setTab('gifs')}>GIFs</button>
          </div>

          <div className="import-stamp-size">
            <label htmlFor="stamp-size">Default size (for a plain click)</label>
            <input
              id="stamp-size"
              type="range"
              min="40"
              max="500"
              value={stampSize}
              onChange={(e) => setStampSize(Number(e.target.value))}
            />
            <span>{stampSize}px</span>
          </div>

          {tab === 'icons' && (
            <>
              <input
                type="text"
                className="import-search-input"
                placeholder="Search icons…"
                value={iconQuery}
                onChange={(e) => setIconQuery(e.target.value)}
              />
              <div className="import-grid">
                {filteredIcons.map((icon) => (
                  <button
                    key={icon.id}
                    type="button"
                    className="import-icon-btn"
                    title={icon.name}
                    onClick={() => handlePickIcon(icon)}
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d={icon.path} />
                    </svg>
                  </button>
                ))}
                {filteredIcons.length === 0 && <p className="import-empty">No icons match "{iconQuery}".</p>}
              </div>
            </>
          )}

          {tab === 'gifs' && (
            <>
              <form className="import-search-row" onSubmit={handleGifSearch}>
                <input
                  type="text"
                  className="import-search-input"
                  placeholder="Search Giphy…"
                  value={gifQuery}
                  onChange={(e) => setGifQuery(e.target.value)}
                />
                <button type="submit" disabled={gifLoading}>{gifLoading ? '…' : 'Go'}</button>
              </form>
              {gifError && <p className="import-error">{gifError}</p>}
              <div className="import-grid import-grid-gifs">
                {gifResults.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="import-gif-btn"
                    title={item.title}
                    onClick={() => handlePickGif(item)}
                  >
                    <img src={item.previewUrl} alt={item.title} loading="lazy" />
                  </button>
                ))}
                {gifResults.length === 0 && !gifLoading && !gifError && (
                  <p className="import-empty">Search Giphy for GIFs to drop onto your sketch.</p>
                )}
              </div>
            </>
          )}
        </>
      )}
      </div>
    </div>
  )
}
