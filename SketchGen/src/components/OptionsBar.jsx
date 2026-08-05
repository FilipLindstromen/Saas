import { useRef } from 'react'
import { SKETCH_FORMATS } from '../utils/canvasFormat'
import './OptionsBar.css'

const PRESET_COLORS = ['#1a1a1a', '#e03131', '#f08c00', '#2f9e44', '#1971c2', '#9c36b5', '#ffffff']

/**
 * Horizontal contextual options bar, Photoshop-style: sits under the top bar and
 * shows controls relevant to whichever tool is currently selected, plus persistent
 * canvas controls (zoom, import, undo/redo/clear) that apply regardless of tool.
 */
export default function OptionsBar({
  tool,
  color,
  onColorChange,
  size,
  onSizeChange,
  smoothing,
  onSmoothingChange,
  wobble,
  onWobbleChange,
  onUndo,
  onRedo,
  onClear,
  canUndo,
  canRedo,
  zoom,
  onZoomChange,
  onImportFile,
  canvasFormat,
  onCanvasFormatChange,
}) {
  const fileInputRef = useRef(null)
  const showColor = tool === 'pen' || tool === 'fill' || tool === 'line' || tool === 'rect' || tool === 'circle'
  const showInkDynamics = tool === 'pen' || tool === 'eraser'
  const showSize = tool !== 'stamp' && tool !== 'move'

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file) onImportFile(file)
    e.target.value = ''
  }

  return (
    <div className="options-bar">
      {showColor && (
        <div className="options-bar-group">
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

      {showSize && (
        <div className="options-bar-group options-bar-slider-group">
          <label htmlFor="sketch-size">Size</label>
          <input
            id="sketch-size"
            type="range"
            min="1"
            max="60"
            value={size}
            onChange={(e) => onSizeChange(Number(e.target.value))}
          />
          <span className="options-bar-value">{size}</span>
        </div>
      )}

      {showInkDynamics && (
        <div className="options-bar-group options-bar-slider-group">
          <label htmlFor="sketch-smoothing">Smoothing</label>
          <input
            id="sketch-smoothing"
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={smoothing}
            onChange={(e) => onSmoothingChange(Number(e.target.value))}
            title="Smooths out hand shake — higher values lag more before catching up to the pointer"
          />
          <span className="options-bar-value">{Math.round(smoothing * 100)}%</span>
        </div>
      )}

      {showInkDynamics && (
        <div className="options-bar-group options-bar-slider-group">
          <label htmlFor="sketch-wobble">Wobble</label>
          <input
            id="sketch-wobble"
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={wobble}
            onChange={(e) => onWobbleChange(Number(e.target.value))}
            title="Adds a hand-tremor scribble wobble to the line"
          />
          <span className="options-bar-value">{Math.round(wobble * 100)}%</span>
        </div>
      )}

      <div className="options-bar-spacer" />

      <div className="options-bar-group options-bar-format-group" role="group" aria-label="Canvas aspect ratio">
        {SKETCH_FORMATS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`options-bar-format-btn ${canvasFormat === f.id ? 'active' : ''}`}
            onClick={() => onCanvasFormatChange?.(f.id)}
            title={`Sketch format ${f.label}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="options-bar-group options-bar-zoom-group">
        <button type="button" className="options-bar-btn" onClick={() => onZoomChange(Math.max(0.5, Math.round((zoom - 0.25) * 100) / 100))} title="Zoom out">
          −
        </button>
        <button type="button" className="options-bar-zoom-value" onClick={() => onZoomChange(1)} title="Reset zoom">
          {Math.round(zoom * 100)}%
        </button>
        <button type="button" className="options-bar-btn" onClick={() => onZoomChange(Math.min(3, Math.round((zoom + 0.25) * 100) / 100))} title="Zoom in">
          +
        </button>
      </div>

      <div className="options-bar-group">
        <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleFileChange} />
        <button type="button" className="options-bar-btn" onClick={() => fileInputRef.current?.click()} title="Import image as base layer">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="M21 15l-5-5L5 21" />
          </svg>
        </button>
        <button type="button" className="options-bar-btn" onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 14L4 9l5-5" />
            <path d="M4 9h11a5 5 0 0 1 0 10h-1" />
          </svg>
        </button>
        <button type="button" className="options-bar-btn" onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 14l5-5-5-5" />
            <path d="M20 9H9a5 5 0 0 0 0 10h1" />
          </svg>
        </button>
        <button type="button" className="options-bar-btn options-bar-clear-btn" onClick={onClear} title="Clear active layer">
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
