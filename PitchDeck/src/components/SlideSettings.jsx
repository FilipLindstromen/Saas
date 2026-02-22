import './SlideSettings.css'

function SlideSettings({ slide, onUpdate, selectedCount = 1, backgroundColor = '#1a1a1a', contentEdgeOffset = 9, contentBottomOffset = 12, onUpdateSettings }) {
  if (!slide) {
    return (
      <div className="slide-settings-empty">
        <p>Select a slide to edit its background and image settings.</p>
      </div>
    )
  }
  const isMultiSelect = selectedCount > 1

  const layout = slide.layout || 'default'
  const showGradient = layout !== 'centered' && layout !== 'right'
  const showImage = layout !== 'section'

  return (
    <div className="slide-settings-content">
      {isMultiSelect && (
        <p className="slide-settings-multi-hint">Applying to {selectedCount} slides</p>
      )}
      <div className="slide-settings-section">
        <div className="slide-settings-field slide-settings-bg-color">
          <label htmlFor="slide-settings-bg-override">Bg color:</label>
          <label className="slide-settings-toggle" htmlFor="slide-settings-bg-override">
            <input
              id="slide-settings-bg-override"
              type="checkbox"
              checked={!!slide.backgroundColorOverride}
              onChange={(e) => {
                const on = e.target.checked
                onUpdate(on
                  ? { backgroundColorOverride: true, backgroundColorOverrideValue: slide.backgroundColorOverrideValue || backgroundColor }
                  : { backgroundColorOverride: false }
                )
              }}
            />
          </label>
          {slide.backgroundColorOverride && (
            <>
              <input
                type="color"
                className="slide-settings-color-picker"
                value={(slide.backgroundColorOverrideValue || backgroundColor).slice(0, 7)}
                onChange={(e) => onUpdate({ backgroundColorOverrideValue: e.target.value })}
                title="Background color"
              />
              <input
                type="text"
                className="slide-settings-color-hex"
                value={(slide.backgroundColorOverrideValue || backgroundColor).replace(/^#?/, '#')}
                onChange={(e) => {
                  const v = e.target.value
                  if (/^#[0-9A-Fa-f]{0,6}$/.test(v) || /^[0-9A-Fa-f]{0,6}$/.test(v)) {
                    const hex = v.startsWith('#') ? v : `#${v}`
                    if (hex.length === 7) onUpdate({ backgroundColorOverrideValue: hex })
                  }
                }}
                placeholder="#1a1a1a"
                title="Hex color"
              />
            </>
          )}
        </div>
      </div>

      <div className="slide-settings-section">
        <div className="slide-settings-field">
          <label className="slide-settings-toggle">
            <input
              type="checkbox"
              checked={!!slide.revealOneLineAtATime}
              onChange={(e) => onUpdate({ revealOneLineAtATime: e.target.checked })}
            />
            <span>Show one line at a time</span>
          </label>
        </div>
        <p className="slide-settings-hint">When enabled, each click in present mode reveals one more text line (or bullet).</p>
      </div>

      {showGradient && (
        <div className="slide-settings-section">
          <div className="slide-settings-field">
            <label className="slide-settings-toggle">
              <input
                type="checkbox"
                checked={slide.gradientEnabled !== false}
                onChange={(e) => onUpdate({ gradientEnabled: e.target.checked })}
              />
              <span>Use gradient</span>
            </label>
          </div>
          {slide.gradientEnabled !== false && (
            <>
          <div className="slide-settings-field slide-settings-row">
            <button
              type="button"
              className={`slide-settings-btn ${slide.gradientFlipped ? 'active' : ''}`}
              onClick={() => onUpdate({ gradientFlipped: !slide.gradientFlipped })}
              title="Flip Gradient Direction"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12h-8M3 12h8M12 3l-9 9 9 9M12 21l9-9-9-9" />
              </svg>
              <span>Flip Gradient</span>
            </button>
          </div>
          <div className="slide-settings-field">
            <label htmlFor="slide-settings-gradient">Gradient:</label>
            <div className="slide-settings-slider-wrap">
              <input
                id="slide-settings-gradient"
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={slide.gradientStrength !== undefined ? slide.gradientStrength : 0.7}
                onChange={(e) => onUpdate({ gradientStrength: parseFloat(e.target.value) })}
                className="slide-settings-slider"
              />
              <span className="slide-settings-value">{Math.round((slide.gradientStrength !== undefined ? slide.gradientStrength : 0.7) * 100)}%</span>
            </div>
          </div>
            </>
          )}
        </div>
      )}

      {showImage && (
        <div className="slide-settings-section">
          <div className="slide-settings-field">
            <label htmlFor="slide-settings-opacity">Image:</label>
            <div className="slide-settings-slider-wrap">
              <input
                id="slide-settings-opacity"
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={slide.backgroundOpacity !== undefined ? slide.backgroundOpacity : 0.6}
                onChange={(e) => onUpdate({ backgroundOpacity: parseFloat(e.target.value) })}
                className="slide-settings-slider"
              />
              <span className="slide-settings-value">{Math.round((slide.backgroundOpacity !== undefined ? slide.backgroundOpacity : 0.6) * 100)}%</span>
            </div>
          </div>
          {(slide.infographicProjectId || slide.imageUrl || slide.backgroundVideoUrl) && (
            <>
              <div className="slide-settings-field slide-settings-row">
                <button
                  type="button"
                  className="slide-settings-btn"
                  onClick={() => onUpdate({ imageScale: 1.0 })}
                  title="Fill Screen"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                  </svg>
                  <span>Fill Screen</span>
                </button>
                <button
                  type="button"
                  className={`slide-settings-btn ${slide.flipHorizontal ? 'active' : ''}`}
                  onClick={() => onUpdate({ flipHorizontal: !slide.flipHorizontal })}
                  title="Flip Image Horizontally"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12h-8M3 12h8M12 3l-9 9 9 9M12 21l9-9-9-9" />
                  </svg>
                  <span>Flip Image</span>
                </button>
              </div>
              <div className="slide-settings-field">
                <label htmlFor="slide-settings-scale">Scale:</label>
                <div className="slide-settings-slider-wrap">
                  <input
                    id="slide-settings-scale"
                    type="range"
                    min="0.5"
                    max="3"
                    step="0.1"
                    value={slide.imageScale !== undefined ? slide.imageScale : 1.0}
                    onChange={(e) => onUpdate({ imageScale: parseFloat(e.target.value) })}
                    className="slide-settings-slider"
                  />
                  <span className="slide-settings-value">{Math.round((slide.imageScale !== undefined ? slide.imageScale : 1.0) * 100)}%</span>
                </div>
              </div>
              <div className="slide-settings-field">
                <label className="slide-settings-toggle">
                  <input
                    type="checkbox"
                    checked={!!slide.overrideBackgroundScaleAnimation}
                    onChange={(e) => onUpdate({ overrideBackgroundScaleAnimation: e.target.checked })}
                  />
                  <span>Override background scale animation</span>
                </label>
                <p className="slide-settings-hint">When enabled, this slide uses static scale instead of the global scale animation.</p>
              </div>
            </>
          )}
        </div>
      )}

      {onUpdateSettings && (
        <div className="slide-settings-section">
          <div className="slide-settings-field">
            <label htmlFor="slide-settings-edge">Distance from edge (%)</label>
            <input
              id="slide-settings-edge"
              type="number"
              min="2"
              max="25"
              step="0.5"
              value={contentEdgeOffset}
              onChange={(e) => onUpdateSettings({ contentEdgeOffset: parseFloat(e.target.value) ?? 9 })}
              className="slide-settings-input"
              title="Horizontal distance from left/right edge for all slides"
            />
          </div>
          <div className="slide-settings-field">
            <label htmlFor="slide-settings-bottom">Distance from bottom (%)</label>
            <input
              id="slide-settings-bottom"
              type="number"
              min="5"
              max="30"
              step="0.5"
              value={contentBottomOffset}
              onChange={(e) => onUpdateSettings({ contentBottomOffset: parseFloat(e.target.value) ?? 12 })}
              className="slide-settings-input"
              title="How far from the bottom the text sits (all slides)"
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default SlideSettings
