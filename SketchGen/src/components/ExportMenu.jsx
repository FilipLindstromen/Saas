import { useEffect, useRef, useState } from 'react'
import { EXPORT_ACTION } from '../utils/imageExport'
import './ExportMenu.css'

const ITEMS = [
  { action: EXPORT_ACTION.PNG, label: 'Export as PNG' },
  { action: EXPORT_ACTION.PNG_TRANSPARENT, label: 'Export as transparent PNG' },
  { action: EXPORT_ACTION.COPY, label: 'Copy to clipboard' },
  { action: EXPORT_ACTION.COPY_TRANSPARENT, label: 'Copy transparent to clipboard' },
]

export default function ExportMenu({ onExport, variant = 'button', disabled = false, className = '' }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const pick = (action) => {
    setOpen(false)
    onExport?.(action)
  }

  const isIcon = variant === 'icon'

  return (
    <div className={`export-menu-root ${className}`.trim()} ref={rootRef}>
      <button
        type="button"
        className={isIcon ? 'export-menu-trigger sketchgen-icon-btn' : 'export-menu-trigger export-menu-trigger-primary'}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        title="Export generated image"
      >
        {isIcon ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v12" />
            <path d="M7 10l5 5 5-5" />
            <path d="M4 21h16" />
          </svg>
        ) : (
          <>
            Export
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M6 9l6 6 6-6" />
            </svg>
          </>
        )}
      </button>
      {open && (
        <div className="export-menu-panel" role="menu">
          {ITEMS.map(({ action, label }) => (
            <button key={action} type="button" role="menuitem" onClick={() => pick(action)}>
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
