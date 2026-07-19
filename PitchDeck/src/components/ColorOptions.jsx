import { useEffect, useRef } from 'react'
import './StyleDropdown.css'

function ColorOptions({
  settings,
  onUpdateSettings,
  onClose,
  buttonRef,
  embedded,
  slide,
  onUpdateSlide,
  selectedCount = 0,
  backgroundColor = '#1a1a1a',
}) {
  const dropdownRef = useRef(null)

  useEffect(() => {
    if (embedded) return
    const updatePosition = () => {
      if (buttonRef?.current && dropdownRef?.current) {
        const buttonRect = buttonRef.current.getBoundingClientRect()
        dropdownRef.current.style.top = `${buttonRect.bottom + 8}px`
        dropdownRef.current.style.right = `${window.innerWidth - buttonRect.right}px`
      }
    }
    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [buttonRef, embedded])

  useEffect(() => {
    if (embedded) return
    const handleEscape = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose, embedded])

  const handleChange = (key, value) => {
    onUpdateSettings({ [key]: value })
  }

  const deckBackgroundColor = settings.backgroundColor || backgroundColor || '#1a1a1a'
  const deckTextColor = settings.textColor || '#ffffff'
  const slideBackgroundColor = slide?.backgroundColorOverrideValue || deckBackgroundColor
  const slideTextColor = slide?.textColorOverrideValue || deckTextColor

  const content = (
    <div className="style-dropdown-content">
      <div className="style-dropdown-title">Colors</div>
          <div className="style-dropdown-field">
            <label>Background Color</label>
            <div className="style-dropdown-color-group">
              <input
                type="color"
                value={deckBackgroundColor}
                onChange={(e) => handleChange('backgroundColor', e.target.value)}
                className="style-dropdown-color-picker"
              />
              <input
                type="text"
                value={deckBackgroundColor}
                onChange={(e) => handleChange('backgroundColor', e.target.value)}
                className="style-dropdown-input"
                placeholder="#1a1a1a"
              />
            </div>
          </div>
          <div className="style-dropdown-field">
            <label>Text Color</label>
            <div className="style-dropdown-color-group">
              <input
                type="color"
                value={settings.textColor || '#ffffff'}
                onChange={(e) => handleChange('textColor', e.target.value)}
                className="style-dropdown-color-picker"
              />
              <input
                type="text"
                value={settings.textColor || '#ffffff'}
                onChange={(e) => handleChange('textColor', e.target.value)}
                className="style-dropdown-input"
                placeholder="#ffffff"
              />
            </div>
          </div>
          <div className="style-dropdown-field">
            <label>Highlight / text background color</label>
            <div className="style-dropdown-color-group">
              <input
                type="color"
                value={settings.inlineBgColor || '#facc15'}
                onChange={(e) => handleChange('inlineBgColor', e.target.value)}
                className="style-dropdown-color-picker"
              />
              <input
                type="text"
                value={settings.inlineBgColor || '#facc15'}
                onChange={(e) => handleChange('inlineBgColor', e.target.value)}
                className="style-dropdown-input"
                placeholder="#facc15"
              />
            </div>
          </div>

          <div className="style-dropdown-section-title">Slide colors</div>
          {!slide || !onUpdateSlide ? (
            <p className="style-dropdown-hint">Select a slide to override its background and text colors.</p>
          ) : (
            <>
              {selectedCount > 1 && (
                <p className="style-dropdown-hint">Applying to {selectedCount} slides</p>
              )}
              <div className="style-dropdown-field">
                <label className="style-dropdown-checkbox">
                  <input
                    id="slide-bg-color-override"
                    type="checkbox"
                    checked={!!slide.backgroundColorOverride}
                    onChange={(e) => {
                      const on = e.target.checked
                      onUpdateSlide(on
                        ? { backgroundColorOverride: true, backgroundColorOverrideValue: slide.backgroundColorOverrideValue || deckBackgroundColor }
                        : { backgroundColorOverride: false }
                      )
                    }}
                  />
                  <span>Override background color for this slide</span>
                </label>
              </div>
              {slide.backgroundColorOverride && (
                <div className="style-dropdown-field">
                  <label htmlFor="slide-bg-color-value">Bg color</label>
                  <div className="style-dropdown-color-group">
                    <input
                      id="slide-bg-color-value"
                      type="color"
                      value={slideBackgroundColor.slice(0, 7)}
                      onChange={(e) => onUpdateSlide({ backgroundColorOverrideValue: e.target.value })}
                      className="style-dropdown-color-picker"
                    />
                    <input
                      type="text"
                      value={slideBackgroundColor.replace(/^#?/, '#')}
                      onChange={(e) => {
                        const v = e.target.value
                        if (/^#[0-9A-Fa-f]{0,6}$/.test(v) || /^[0-9A-Fa-f]{0,6}$/.test(v)) {
                          const hex = v.startsWith('#') ? v : `#${v}`
                          if (hex.length === 7) onUpdateSlide({ backgroundColorOverrideValue: hex })
                        }
                      }}
                      className="style-dropdown-input"
                      placeholder="#1a1a1a"
                    />
                  </div>
                </div>
              )}
              <div className="style-dropdown-field">
                <label className="style-dropdown-checkbox">
                  <input
                    id="slide-text-color-override"
                    type="checkbox"
                    checked={!!slide.textColorOverride}
                    onChange={(e) => {
                      const on = e.target.checked
                      onUpdateSlide(on
                        ? { textColorOverride: true, textColorOverrideValue: slide.textColorOverrideValue || deckTextColor }
                        : { textColorOverride: false }
                      )
                    }}
                  />
                  <span>Override text color for this slide</span>
                </label>
              </div>
              {slide.textColorOverride && (
                <div className="style-dropdown-field">
                  <label htmlFor="slide-text-color-value">Text color</label>
                  <div className="style-dropdown-color-group">
                    <input
                      id="slide-text-color-value"
                      type="color"
                      value={slideTextColor.slice(0, 7)}
                      onChange={(e) => onUpdateSlide({ textColorOverrideValue: e.target.value })}
                      className="style-dropdown-color-picker"
                    />
                    <input
                      type="text"
                      value={slideTextColor.replace(/^#?/, '#')}
                      onChange={(e) => {
                        const v = e.target.value
                        if (/^#[0-9A-Fa-f]{0,6}$/.test(v) || /^[0-9A-Fa-f]{0,6}$/.test(v)) {
                          const hex = v.startsWith('#') ? v : `#${v}`
                          if (hex.length === 7) onUpdateSlide({ textColorOverrideValue: hex })
                        }
                      }}
                      className="style-dropdown-input"
                      placeholder="#ffffff"
                    />
                  </div>
                </div>
              )}
            </>
          )}
    </div>
  )

  if (embedded) return content
  return (
    <>
      <div className="style-dropdown-backdrop" onClick={onClose} />
      <div className="style-dropdown-panel" ref={dropdownRef} onClick={(e) => e.stopPropagation()}>
        {content}
      </div>
    </>
  )
}

export default ColorOptions
