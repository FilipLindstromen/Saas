import { useEffect, useRef, useState } from 'react'
import { CAROUSEL_FORMAT } from '../utils/slideFormats'
import './ShareExportMenu.css'

function ShareExportMenu({
  onExportProject,
  onExportPng,
  onExportInstagram,
  onExportMeta,
  onCopyText,
  onSaveToFolder,
  onImport,
  isExporting = false,
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    const onEsc = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  const run = (fn) => {
    setOpen(false)
    fn?.()
  }

  return (
    <div className="share-export-menu" ref={ref}>
      <button
        type="button"
        className="header-btn-labeled share-export-trigger"
        onClick={() => setOpen((v) => !v)}
        disabled={isExporting}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
          <polyline points="16 6 12 2 8 6" />
          <line x1="12" y1="2" x2="12" y2="15" />
        </svg>
        <span>Export</span>
      </button>
      {open && (
        <div className="share-export-dropdown" role="menu">
          <button type="button" role="menuitem" className="share-export-primary" onClick={() => run(onExportMeta)} disabled={isExporting}>
            Export carousel to Meta
          </button>
          <button type="button" role="menuitem" onClick={() => run(onExportInstagram)} disabled={isExporting}>
            Download carousel (ZIP)
          </button>
          <div className="share-export-divider" role="separator" />
          <button type="button" role="menuitem" onClick={() => run(onImport)}>Import project…</button>
          <button type="button" role="menuitem" onClick={() => run(onExportProject)}>Export project (.json)</button>
          <button type="button" role="menuitem" onClick={() => run(onExportPng)} disabled={isExporting}>
            Export slides as PNG (ZIP)
          </button>
          <button type="button" role="menuitem" onClick={() => run(onCopyText)}>Copy slides as text</button>
          <button type="button" role="menuitem" onClick={() => run(onSaveToFolder)}>Save to folder</button>
        </div>
      )}
    </div>
  )
}

export default ShareExportMenu
