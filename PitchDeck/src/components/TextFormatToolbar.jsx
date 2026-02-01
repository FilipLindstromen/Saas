import { useEffect, useRef } from 'react'
import './TextFormatToolbar.css'

function TextFormatToolbar({ x, y, serifActive = false, onClose, onBold, onItalic, onUnderline, onBackground, onH1, onH2, onH3, onFontPairing }) {
  const toolbarRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target)) {
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

  return (
    <div
      ref={toolbarRef}
      className="text-format-toolbar"
      style={{ left: `${x}px`, top: `${y - 44}px`, transform: 'translateX(-50%)' }}
      role="toolbar"
      aria-label="Text formatting"
    >
      <button type="button" className="text-format-toolbar-btn" onClick={onBold} title="Bold">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
          <path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
        </svg>
      </button>
      <button type="button" className="text-format-toolbar-btn" onClick={onItalic} title="Italic">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="19" y1="4" x2="10" y2="4" />
          <line x1="14" y1="20" x2="5" y2="20" />
          <line x1="15" y1="4" x2="9" y2="20" />
        </svg>
      </button>
      <button type="button" className="text-format-toolbar-btn" onClick={onUnderline} title="Underline">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 3v7a6 6 0 0 0 12 0V3" />
          <line x1="4" y1="21" x2="20" y2="21" />
        </svg>
      </button>
      <div className="text-format-toolbar-divider" />
      <button type="button" className="text-format-toolbar-btn" onClick={onBackground} title="Highlight / background">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
      </button>
      <div className="text-format-toolbar-divider" />
      <button type="button" className="text-format-toolbar-btn text-format-toolbar-btn-text" onClick={onH1} title="Heading 1">H1</button>
      <button type="button" className="text-format-toolbar-btn text-format-toolbar-btn-text" onClick={onH2} title="Heading 2">H2</button>
      <button type="button" className="text-format-toolbar-btn text-format-toolbar-btn-text" onClick={onH3} title="Heading 3">H3</button>
      <div className="text-format-toolbar-divider" />
      <button type="button" className={`text-format-toolbar-btn text-format-toolbar-btn-text${serifActive ? ' text-format-toolbar-btn-active' : ''}`} onClick={onFontPairing} title={serifActive ? 'Remove serif' : 'Use serif / font pairing'}>
        Serif
      </button>
    </div>
  )
}

export default TextFormatToolbar
