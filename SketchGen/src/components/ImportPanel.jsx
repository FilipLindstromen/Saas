import { useState } from 'react'
import { searchGiphyGifs } from '@shared/stockMedia/giphy'
import { searchIconifyIcons } from '@shared/stockMedia/iconify'
import { ICONS, iconToDataUrl } from '../constants/icons'
import { EMOJIS, emojiToDataUrl } from '../constants/emojis'
import './ImportPanel.css'

export default function ImportPanel({ penColor, onStartPlacing, placing, onCancelPlacing }) {
  const [tab, setTab] = useState('icons')
  const [searchQuery, setSearchQuery] = useState('')
  const [gifResults, setGifResults] = useState([])
  const [gifLoading, setGifLoading] = useState(false)
  const [gifError, setGifError] = useState('')
  const [svgResults, setSvgResults] = useState([])
  const [svgLoading, setSvgLoading] = useState(false)
  const [svgError, setSvgError] = useState('')
  const [stampSize, setStampSize] = useState(220)

  const filteredIcons = ICONS.filter((icon) =>
    !searchQuery.trim() || icon.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
  )

  const filteredEmojis = EMOJIS.filter((e) => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return true
    return e.name.toLowerCase().includes(q) || e.keywords.toLowerCase().includes(q)
  })

  const handleGifSearch = async (e) => {
    e.preventDefault()
    setGifError('')
    setGifLoading(true)
    try {
      const { data } = await searchGiphyGifs(null, searchQuery, 24)
      setGifResults(data)
    } catch (err) {
      setGifError(err.message || 'Search failed.')
    } finally {
      setGifLoading(false)
    }
  }

  const handleSvgSearch = async (e) => {
    e.preventDefault()
    setSvgError('')
    setSvgLoading(true)
    try {
      const { data } = await searchIconifyIcons(searchQuery, 32)
      setSvgResults(data)
    } catch (err) {
      setSvgError(err.message || 'Search failed.')
    } finally {
      setSvgLoading(false)
    }
  }

  const handlePickIcon = (icon) => {
    onStartPlacing({
      url: iconToDataUrl(icon, penColor, 128),
      maxDim: stampSize,
      label: icon.name,
    })
  }

  const handlePickEmoji = (item) => {
    onStartPlacing({
      url: emojiToDataUrl(item.emoji, 128),
      maxDim: stampSize,
      label: item.name,
    })
  }

  const handlePickGif = (item) => {
    onStartPlacing({
      url: item.url,
      maxDim: stampSize,
      label: item.title || 'GIF',
    })
  }

  const handlePickSvg = (item) => {
    onStartPlacing({
      url: item.url,
      maxDim: stampSize,
      label: item.label || item.id,
    })
  }

  const needsSubmit = tab === 'gifs' || tab === 'svg'
  const submitHandler = tab === 'gifs' ? handleGifSearch : handleSvgSearch
  const submitLoading = tab === 'gifs' ? gifLoading : svgLoading
  const submitError = tab === 'gifs' ? gifError : svgError

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
            <button type="button" className={tab === 'emojis' ? 'active' : ''} onClick={() => setTab('emojis')}>Emojis</button>
            <button type="button" className={tab === 'svg' ? 'active' : ''} onClick={() => setTab('svg')}>SVG</button>
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

          {needsSubmit ? (
            <form className="import-search-row" onSubmit={submitHandler}>
              <input
                type="text"
                className="import-search-input"
                placeholder={tab === 'gifs' ? 'Search Giphy…' : 'Search free SVG icons (Iconify)…'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button type="submit" disabled={submitLoading}>{submitLoading ? '…' : 'Go'}</button>
            </form>
          ) : (
            <input
              type="text"
              className="import-search-input"
              placeholder={tab === 'icons' ? 'Search icons…' : 'Search emojis… (e.g. brain)'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          )}

          {submitError && needsSubmit && <p className="import-error">{submitError}</p>}

          {tab === 'icons' && (
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
              {filteredIcons.length === 0 && <p className="import-empty">No icons match "{searchQuery}".</p>}
            </div>
          )}

          {tab === 'emojis' && (
            <div className="import-grid import-grid-emojis">
              {filteredEmojis.map((item) => (
                <button
                  key={item.emoji}
                  type="button"
                  className="import-emoji-btn"
                  title={item.name}
                  onClick={() => handlePickEmoji(item)}
                >
                  {item.emoji}
                </button>
              ))}
              {filteredEmojis.length === 0 && <p className="import-empty">No emojis match "{searchQuery}".</p>}
            </div>
          )}

          {tab === 'svg' && (
            <div className="import-grid import-grid-svg">
              {svgResults.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="import-svg-btn"
                  title={item.id}
                  onClick={() => handlePickSvg(item)}
                >
                  <img src={item.previewUrl} alt="" loading="lazy" />
                </button>
              ))}
              {svgResults.length === 0 && !svgLoading && !svgError && (
                <p className="import-empty">Search Iconify for free SVG icons (Material, Lucide, and more).</p>
              )}
            </div>
          )}

          {tab === 'gifs' && (
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
          )}
        </>
      )}
      </div>
    </div>
  )
}
