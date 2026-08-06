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
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
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
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
        title="Download / export"
      >
        {isIcon ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
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
        <>
          <button
            type="button"
            className="export-menu-backdrop"
            aria-label="Close export menu"
            onClick={() => setOpen(false)}
          />
          <div className="export-menu-overlay" role="dialog" aria-labelledby="export-menu-title">
            <div className="export-menu-overlay-header">
              <h2 id="export-menu-title">Export</h2>
              <button type="button" className="export-menu-overlay-close" onClick={() => setOpen(false)} aria-label="Close">
                ×
              </button>
            </div>
            <p className="export-menu-overlay-hint">
              Transparent options remove the background (canvas color on sketches, detected backdrop on generated images).
            </p>
            <div className="export-menu-overlay-actions" role="menu">
              {ITEMS.map(({ action, label }) => (
                <button key={action} type="button" role="menuitem" onClick={() => pick(action)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
