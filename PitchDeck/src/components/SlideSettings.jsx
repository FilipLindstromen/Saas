import './SlideSettings.css'
import { MOTION_PRESET_OPTIONS, applyMotionPresetToSlide } from '../utils/motionPresets'

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
  const hasBackgroundMedia = !!(slide.infographicProjectId || slide.imageUrl || slide.backgroundVideoUrl)

  if (section === 'background' && !showGradient && !showImage) {
    return (
      <div className="slide-settings-content">
        <div className="slide-settings-empty">
          <p>Background settings are not available for this slide layout.</p>
        </div>
      </div>
    )
  }

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

  const showBackgroundSection = show('background') || show('gradient') || show('media')
  const showMediaControls = (show('background') || show('media')) && showImage
  const showGradientControls = (show('background') || show('gradient')) && showGradient

  return (
    <div className="slide-settings-content">
      {isMultiSelect && (
        <p className="slide-settings-multi-hint">Applying to {selectedCount} slides</p>
      )}

      {show('motion') && (
      <div className="slide-settings-section">
        <h3 className="slide-settings-section-title">Motion preset</h3>
        <div className="slide-settings-field">
          <label htmlFor="slide-motion-preset">Motion preset</label>
          <select
            id="slide-motion-preset"
            className="slide-settings-select"
            value={slide.motionPreset || 'default'}
            onChange={(e) => onUpdate(applyMotionPresetToSlide(slide, e.target.value))}
          >
            {MOTION_PRESET_OPTIONS.map((preset) => (
              <option key={preset.id} value={preset.id}>{preset.label}</option>
            ))}
          </select>
          <p className="slide-settings-hint">
            {MOTION_PRESET_OPTIONS.find((item) => item.id === (slide.motionPreset || 'default'))?.description}
          </p>
        </div>
        {(slide.motionPreset && slide.motionPreset !== 'default') && (
          <div className="slide-settings-field">
            <button
              type="button"
              className="slide-settings-btn"
              onClick={() => onUpdate(applyMotionPresetToSlide(slide, 'default'))}
            >
              Reset to custom
            </button>
          </div>
        )}
      </div>
      )}

      {showBackgroundSection && (showMediaControls || showGradientControls) && (
        <div className="slide-settings-section">
          {showMediaControls && (
            <>
              <div className="slide-settings-field">
                <label htmlFor="slide-settings-opacity">Background:</label>
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
              {hasBackgroundMedia && (
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
                </>
              )}
            </>
          )}

          {showMediaControls && showGradientControls && (
            <div className="slide-settings-divider" aria-hidden="true" />
          )}

          {showGradientControls && (
            <>
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
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default SlideSettings
