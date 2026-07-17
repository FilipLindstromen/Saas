import { useState } from 'react'
import { CAROUSEL_STYLE_PRESETS } from '../carousel/constants'
import './CarouselToolsOptions.css'

export default function CarouselToolsOptions({
  onApplyStylePreset,
  onApplyStyleToAllSlides,
  onFillImages,
  onFitAllCopy,
  busy = false,
  visualTheme,
  onVisualThemeChange,
}) {
  const [selectedPreset, setSelectedPreset] = useState(CAROUSEL_STYLE_PRESETS[0]?.id)

  return (
    <div className="carousel-tools-options">
      <section className="carousel-tools-section">
        <h4>Visual presets</h4>
        <p className="carousel-tools-hint">Apply a cohesive look across all slides.</p>
        <select
          className="carousel-tools-select"
          value={selectedPreset}
          onChange={(e) => setSelectedPreset(e.target.value)}
        >
          {CAROUSEL_STYLE_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <div className="carousel-tools-btns">
          <button
            type="button"
            className="carousel-tools-btn"
            disabled={busy}
            onClick={() => {
              const preset = CAROUSEL_STYLE_PRESETS.find((p) => p.id === selectedPreset)
              if (preset) onApplyStylePreset?.(preset)
            }}
          >
            Apply preset to carousel
          </button>
          <button type="button" className="carousel-tools-btn carousel-tools-btn-ghost" disabled={busy} onClick={onApplyStyleToAllSlides}>
            Copy current slide style to all
          </button>
        </div>
      </section>

      <section className="carousel-tools-section">
        <h4>Asset pipeline</h4>
        <p className="carousel-tools-hint">Auto-fill empty slides with on-brand Unsplash images.</p>
        <label className="carousel-tools-label" htmlFor="visual-theme">Visual theme</label>
        <input
          id="visual-theme"
          type="text"
          className="carousel-tools-input"
          value={visualTheme || ''}
          onChange={(e) => onVisualThemeChange?.(e.target.value)}
          placeholder="e.g. muted editorial, warm lifestyle"
        />
        <button type="button" className="carousel-tools-btn" disabled={busy} onClick={onFillImages}>
          {busy ? 'Working…' : 'Fill empty slides with images'}
        </button>
      </section>

      <section className="carousel-tools-section">
        <h4>Fit to carousel</h4>
        <p className="carousel-tools-hint">AI-shorten copy that exceeds mobile readability limits.</p>
        <button type="button" className="carousel-tools-btn" disabled={busy} onClick={onFitAllCopy}>
          {busy ? 'Shortening…' : 'Fit all slides to limits'}
        </button>
      </section>
    </div>
  )
}
