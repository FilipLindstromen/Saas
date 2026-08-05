import { useRef } from 'react'
import './Toolbar.css'

const PRESET_COLORS = ['#1a1a1a', '#e03131', '#f08c00', '#2f9e44', '#1971c2', '#9c36b5', '#ffffff']

const TOOLS = [
  {
    id: 'pen',
    label: 'Pen',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 19l7-7 3 3-7 7-3-3z" />
        <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
        <path d="M2 2l7.586 7.586" />
        <circle cx="11" cy="11" r="2" />
      </svg>
    ),
  },
  {
    id: 'eraser',
    label: 'Eraser',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 20H7L3.5 16.5a1.5 1.5 0 0 1 0-2.121l9.879-9.879a1.5 1.5 0 0 1 2.121 0l5.5 5.5a1.5 1.5 0 0 1 0 2.121L13 20" />
        <path d="M7 20l-3.5-3.5" />
      </svg>
    ),
  },
  {
    id: 'fill',
    label: 'Fill',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 2l9 9-9 9-9-9 2-2" />
        <path d="M2 11l8-8" />
        <path d="M19 14c0 2-1.5 3.5-1.5 3.5S16 16 16 14a1.5 1.5 0 0 1 3 0z" />
      </svg>
    ),
  },
  {
    id: 'blur',
    label: 'Blur',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="8" strokeDasharray="2 3" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
  {
    id: 'line',
    label: 'Line (hold Shift to snap 45°)',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 20L20 4" />
      </svg>
    ),
  },
  {
    id: 'rect',
    label: 'Rectangle (hold Shift for square)',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="6" width="16" height="12" rx="1" />
      </svg>
    ),
  },
  {
    id: 'circle',
    label: 'Circle (hold Shift for perfect circle)',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="8" />
      </svg>
    ),
  },
]

export default function Toolbar({
  tool,
  onToolChange,
  color,
  onColorChange,
  size,
  onSizeChange,
  onUndo,
  onRedo,
  onClear,
  canUndo,
  canRedo,
  zoom,
  onZoomChange,
  onImportFile,
}) {
  const fileInputRef = useRef(null)
  const showColor = tool === 'pen' || tool === 'fill' || tool === 'line' || tool === 'rect' || tool === 'circle'

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file) onImportFile(file)
    e.target.value = ''
  }

  return (
    <div className="sketch-toolbar">
      <div className="sketch-toolbar-group">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`sketch-tool-btn ${tool === t.id ? 'active' : ''}`}
            onClick={() => onToolChange(t.id)}
            title={t.label}
            aria-pressed={tool === t.id}
          >
            {t.icon}
          </button>
        ))}
      </div>

      {showColor && (
        <div className="sketch-toolbar-group">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={`sketch-color-swatch ${color === c ? 'active' : ''}`}
              style={{ '--swatch-color': c }}
              onClick={() => onColorChange(c)}
              title={c}
              aria-label={`Color ${c}`}
            />
          ))}
          <input
            type="color"
            className="sketch-color-picker"
            value={color}
            onChange={(e) => onColorChange(e.target.value)}
            title="Custom color"
          />
        </div>
      )}

      <div className="sketch-toolbar-group sketch-size-group">
        <label htmlFor="sketch-size">Size</label>
        <input
          id="sketch-size"
          type="range"
          min="1"
          max="60"
          value={size}
          onChange={(e) => onSizeChange(Number(e.target.value))}
        />
        <span className="sketch-size-value">{size}</span>
      </div>

      <div className="sketch-toolbar-group sketch-zoom-group">
        <button type="button" className="sketch-tool-btn" onClick={() => onZoomChange(Math.max(0.5, Math.round((zoom - 0.25) * 100) / 100))} title="Zoom out">
          −
        </button>
        <button type="button" className="sketch-zoom-value" onClick={() => onZoomChange(1)} title="Reset zoom">
          {Math.round(zoom * 100)}%
        </button>
        <button type="button" className="sketch-tool-btn" onClick={() => onZoomChange(Math.min(3, Math.round((zoom + 0.25) * 100) / 100))} title="Zoom in">
          +
        </button>
      </div>

      <div className="sketch-toolbar-spacer" />

      <div className="sketch-toolbar-group">
        <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleFileChange} />
        <button type="button" className="sketch-tool-btn" onClick={() => fileInputRef.current?.click()} title="Import image as base layer">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="M21 15l-5-5L5 21" />
          </svg>
        </button>
        <button type="button" className="sketch-tool-btn" onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 14L4 9l5-5" />
            <path d="M4 9h11a5 5 0 0 1 0 10h-1" />
          </svg>
        </button>
        <button type="button" className="sketch-tool-btn" onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 14l5-5-5-5" />
            <path d="M20 9H9a5 5 0 0 0 0 10h1" />
          </svg>
        </button>
        <button type="button" className="sketch-tool-btn sketch-clear-btn" onClick={onClear} title="Clear canvas">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18" />
            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          </svg>
        </button>
      </div>
    </div>
  )
}
