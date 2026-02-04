import { useEffect, useRef, useState } from 'react'
import './TextFormatToolbar.css'

const TEXT_COLOR_SWATCHES = [
  '#ffffff', '#000000', '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
  '#78716c', '#a8a29e', '#f87171', '#fb923c', '#facc15', '#4ade80', '#22d3ee', '#60a5fa', '#a78bfa', '#f472b6'
]

function TextFormatToolbar({ x, y, boldActive = false, italicActive = false, underlineActive = false, strikethroughActive = false, backgroundActive = false, headingActive = null, serifActive = false, textColorActive = null, onClose, onBold, onItalic, onUnderline, onStrikethrough, onBackground, onH1, onH2, onH3, onFontPairing, onTextColor, onClearFormatting }) {
  const toolbarRef = useRef(null)
  const [colorPickerOpen, setColorPickerOpen] = useState(false)
  const colorInputRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target)) {
        setColorPickerOpen(false)
        onClose()
      }
    }
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  useEffect(() => {
    if (!toolbarRef.current) return
    const rect = toolbarRef.current.getBoundingClientRect()
    if (rect.right > window.innerWidth) {
      toolbarRef.current.style.left = `${window.innerWidth - rect.width - 10}px`
      toolbarRef.current.style.transform = 'none'
    }
    if (rect.left < 0) {
      toolbarRef.current.style.left = '10px'
      toolbarRef.current.style.transform = 'none'
    }
    if (rect.bottom > window.innerHeight) {
      toolbarRef.current.style.top = `${y - rect.height - 8}px`
    }
    if (rect.top < 0) {
      toolbarRef.current.style.top = '10px'
    }
  }, [x, y])

  const TOOLBAR_GAP_ABOVE = 8
  const TOOLBAR_HEIGHT = 48
  const topAbove = y - TOOLBAR_HEIGHT - TOOLBAR_GAP_ABOVE

  return (
    <div
      ref={toolbarRef}
      className="text-format-toolbar"
      style={{ left: `${x}px`, top: `${topAbove}px`, transform: 'translateX(-50%)' }}
      role="toolbar"
      aria-label="Text formatting"
    >
      <button type="button" className={`text-format-toolbar-btn${boldActive ? ' text-format-toolbar-btn-active' : ''}`} onClick={onBold} title="Bold">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
          <path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
        </svg>
      </button>
      <button type="button" className={`text-format-toolbar-btn${italicActive ? ' text-format-toolbar-btn-active' : ''}`} onClick={onItalic} title="Italic">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="19" y1="4" x2="10" y2="4" />
          <line x1="14" y1="20" x2="5" y2="20" />
          <line x1="15" y1="4" x2="9" y2="20" />
        </svg>
      </button>
      <button type="button" className={`text-format-toolbar-btn${underlineActive ? ' text-format-toolbar-btn-active' : ''}`} onClick={onUnderline} title="Underline">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 3v7a6 6 0 0 0 12 0V3" />
          <line x1="4" y1="21" x2="20" y2="21" />
        </svg>
      </button>
      {onStrikethrough && (
        <button type="button" className={`text-format-toolbar-btn${strikethroughActive ? ' text-format-toolbar-btn-active' : ''}`} onClick={onStrikethrough} title="Strikethrough">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="4" y1="12" x2="20" y2="12" />
          </svg>
        </button>
      )}
      <div className="text-format-toolbar-divider" />
      <button type="button" className={`text-format-toolbar-btn${backgroundActive ? ' text-format-toolbar-btn-active' : ''}`} onClick={onBackground} title={backgroundActive ? 'Remove highlight' : 'Highlight / background'}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
      </button>
      <div className="text-format-toolbar-divider" />
      <button type="button" className={`text-format-toolbar-btn text-format-toolbar-btn-text${headingActive === 'h1' ? ' text-format-toolbar-btn-active' : ''}`} onMouseDown={(e) => { e.preventDefault(); onH1(); }} title={headingActive === 'h1' ? 'Remove H1 (default)' : 'Heading 1'}>H1</button>
      <button type="button" className={`text-format-toolbar-btn text-format-toolbar-btn-text${headingActive === 'h2' ? ' text-format-toolbar-btn-active' : ''}`} onMouseDown={(e) => { e.preventDefault(); onH2(); }} title={headingActive === 'h2' ? 'Remove H2 (default)' : 'Heading 2'}>H2</button>
      <button type="button" className={`text-format-toolbar-btn text-format-toolbar-btn-text${headingActive === 'h3' ? ' text-format-toolbar-btn-active' : ''}`} onMouseDown={(e) => { e.preventDefault(); onH3(); }} title={headingActive === 'h3' ? 'Remove H3 (default)' : 'Heading 3'}>H3</button>
      <div className="text-format-toolbar-divider" />
      {onTextColor && (
        <div className="text-format-toolbar-color-wrap">
          <button
            type="button"
            className={`text-format-toolbar-btn text-format-toolbar-btn-color${textColorActive ? ' text-format-toolbar-btn-active' : ''}`}
            onClick={() => setColorPickerOpen((v) => !v)}
            title="Text color"
            aria-expanded={colorPickerOpen}
            aria-haspopup="true"
          >
            <span className="text-format-toolbar-btn-color-icon" style={{ color: textColorActive || 'currentColor' }}>A</span>
          </button>
          {colorPickerOpen && (
            <div className="text-format-toolbar-color-dropdown" onMouseDown={(e) => e.stopPropagation()}>
              <div className="text-format-toolbar-color-swatches">
                {TEXT_COLOR_SWATCHES.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    className="text-format-toolbar-color-swatch"
                    style={{ backgroundColor: hex }}
                    title={hex}
                    onClick={() => { onTextColor(hex); setColorPickerOpen(false); }}
                  />
                ))}
              </div>
              <div className="text-format-toolbar-color-custom">
                <input
                  ref={colorInputRef}
                  type="color"
                  className="text-format-toolbar-color-input"
                  value={textColorActive && /^#[0-9a-fA-F]{6}$/.test(textColorActive) ? textColorActive : '#ffffff'}
                  onChange={(e) => { onTextColor(e.target.value); setColorPickerOpen(false); }}
                />
                <span className="text-format-toolbar-color-custom-label">Custom</span>
              </div>
              <button type="button" className="text-format-toolbar-color-clear" onClick={() => { onTextColor(null); setColorPickerOpen(false); }}>
                Clear color
              </button>
            </div>
          )}
        </div>
      )}
      <div className="text-format-toolbar-divider" />
      <button type="button" className={`text-format-toolbar-btn text-format-toolbar-btn-text${serifActive ? ' text-format-toolbar-btn-active' : ''}`} onMouseDown={(e) => { e.preventDefault(); onFontPairing(); }} title={serifActive ? 'Remove serif' : 'Use serif / font pairing'}>
        Serif
      </button>
      {onClearFormatting && (
        <>
          <div className="text-format-toolbar-divider" />
          <button
            type="button"
            className="text-format-toolbar-btn text-format-toolbar-btn-clear"
            onMouseDown={(e) => { e.preventDefault(); onClearFormatting() }}
            title="Remove all styling and set to layout default"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 20h16" />
              <path d="M6 16l6-12 6 12" />
              <path d="M8 12h8" />
            </svg>
          </button>
        </>
      )}
    </div>
  )
}

export default TextFormatToolbar
