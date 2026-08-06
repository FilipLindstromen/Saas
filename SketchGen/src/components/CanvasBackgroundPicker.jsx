import { useEffect, useRef, useState } from 'react'
import { BRAND_COLOR_FIELDS } from '../constants/brand'
import './CanvasBackgroundPicker.css'

export default function CanvasBackgroundPicker({ value, brandColors, onChange }) {
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

  const pick = (hex) => {
    onChange?.(hex)
    setOpen(false)
  }

  return (
    <div className="canvas-bg-picker" ref={rootRef}>
      <button
        type="button"
        className="canvas-bg-picker-trigger"
        aria-expanded={open}
        aria-haspopup="listbox"
        title="Canvas background color"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="canvas-bg-picker-swatch" style={{ '--swatch-color': value }} aria-hidden />
        <span className="canvas-bg-picker-label">Background</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="canvas-bg-picker-panel" role="listbox" aria-label="Canvas background">
          <div className="canvas-bg-picker-section-label">Brand colors</div>
          <div className="canvas-bg-picker-brand-grid">
            {BRAND_COLOR_FIELDS.map(({ key, label }) => {
              const hex = brandColors?.[key] ?? '#ffffff'
              const active = value?.toLowerCase() === hex.toLowerCase()
              return (
                <button
                  key={key}
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`canvas-bg-picker-brand-btn${active ? ' active' : ''}`}
                  onClick={() => pick(hex)}
                  title={`${label} (${hex})`}
                >
                  <span className="canvas-bg-picker-swatch" style={{ '--swatch-color': hex }} />
                  <span>{label}</span>
                </button>
              )
            })}
          </div>
          <div className="canvas-bg-picker-section-label">Custom</div>
          <label className="canvas-bg-picker-custom">
            <span className="canvas-bg-picker-swatch" style={{ '--swatch-color': value }} />
            <span>Pick color</span>
            <input
              type="color"
              value={value}
              onChange={(e) => onChange?.(e.target.value)}
              aria-label="Custom canvas background"
            />
          </label>
        </div>
      )}
    </div>
  )
}
