import './SlideSettings.css'

function SlideSettings({ slide, onUpdate, selectedCount = 1, backgroundColor = '#1a1a1a', section }) {
  const show = (name) => !section || section === name

  if (!slide) {
    return (
      <div className="slide-settings-content">
        <div className="slide-settings-empty">
          <p>Select a slide to edit its background, gradient, and image settings.</p>
        </div>
      </div>
    )
  }

  const isMultiSelect = selectedCount > 1
  const layout = slide.layout || 'default'
  const showGradient = layout !== 'centered' && layout !== 'right'
  const showImage = layout !== 'section'

  if (section === 'gradient' && !showGradient) {
    return (
      <div className="slide-settings-content">
        <div className="slide-settings-empty">
          <p>Gradient settings are not available for this slide layout.</p>
        </div>
      </div>
    )
  }

  if (section === 'media' && !showImage) {
    return (
      <div className="slide-settings-content">
        <div className="slide-settings-empty">
          <p>Media settings are not available for section slides.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="slide-settings-content">
      {isMultiSelect && (
        <p className="slide-settings-multi-hint">Applying to {selectedCount} slides</p>
      )}
      {show('general') && (
      <>
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
      </>
      )}

      {show('gradient') && showGradient && (
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

      {show('media') && showImage && (
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
                  onClick={() => onUpdate({ imageScale: 1.0, imageScaleCustomized: true })}
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
                    onChange={(e) => onUpdate({ imageScale: parseFloat(e.target.value), imageScaleCustomized: true })}
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
    </div>
  )
}

export default SlideSettings
