import { useEffect, useRef } from 'react'
import './StyleDropdown.css'

function TextEffectsOptions({ settings, onUpdateSettings, onClose, buttonRef }) {
  const dropdownRef = useRef(null)

  useEffect(() => {
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
  }, [buttonRef])

  useEffect(() => {
    const handleEscape = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose])

  const handleChange = (key, value) => {
    onUpdateSettings({ [key]: value })
  }

  return (
    <>
      <div className="style-dropdown-backdrop" onClick={onClose} />
      <div className="style-dropdown-panel" ref={dropdownRef} onClick={(e) => e.stopPropagation()}>
        <div className="style-dropdown-content">
          <div className="style-dropdown-title">Text Effects</div>
          <div className="style-dropdown-field">
            <label className="style-dropdown-checkbox">
              <input
                type="checkbox"
                checked={settings.textDropShadow || false}
                onChange={(e) => handleChange('textDropShadow', e.target.checked)}
              />
              <span>Enable Drop Shadow</span>
            </label>
            {settings.textDropShadow && (
              <div className="style-dropdown-sub-fields">
                <div className="style-dropdown-sub-field">
                  <label>Blur (px)</label>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    value={settings.shadowBlur || 4}
                    onChange={(e) => handleChange('shadowBlur', parseInt(e.target.value) || 0)}
                    className="style-dropdown-input"
                  />
                </div>
                <div className="style-dropdown-sub-field">
                  <label>Offset X</label>
                  <input
                    type="number"
                    min="-20"
                    max="20"
                    value={settings.shadowOffsetX || 2}
                    onChange={(e) => handleChange('shadowOffsetX', parseInt(e.target.value) || 0)}
                    className="style-dropdown-input"
                  />
                </div>
                <div className="style-dropdown-sub-field">
                  <label>Offset Y</label>
                  <input
                    type="number"
                    min="-20"
                    max="20"
                    value={settings.shadowOffsetY || 2}
                    onChange={(e) => handleChange('shadowOffsetY', parseInt(e.target.value) || 0)}
                    className="style-dropdown-input"
                  />
                </div>
                <div className="style-dropdown-sub-field">
                  <label>Color</label>
                  <div className="style-dropdown-color-group">
                    <input
                      type="color"
                      value={settings.shadowColor || '#000000'}
                      onChange={(e) => handleChange('shadowColor', e.target.value)}
                      className="style-dropdown-color-picker"
                    />
                    <input
                      type="text"
                      value={settings.shadowColor || '#000000'}
                      onChange={(e) => handleChange('shadowColor', e.target.value)}
                      className="style-dropdown-input"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="style-dropdown-field">
            <label className="style-dropdown-checkbox">
              <input
                type="checkbox"
                checked={settings.textInlineBackground || false}
                onChange={(e) => handleChange('textInlineBackground', e.target.checked)}
              />
              <span>Enable Text Highlight</span>
            </label>
            {settings.textInlineBackground && (
              <div className="style-dropdown-sub-fields">
                <div className="style-dropdown-sub-field">
                  <label>Color</label>
                  <div className="style-dropdown-color-group">
                    <input
                      type="color"
                      value={settings.inlineBgColor || '#000000'}
                      onChange={(e) => handleChange('inlineBgColor', e.target.value)}
                      className="style-dropdown-color-picker"
                    />
                    <input
                      type="text"
                      value={settings.inlineBgColor || '#000000'}
                      onChange={(e) => handleChange('inlineBgColor', e.target.value)}
                      className="style-dropdown-input"
                    />
                  </div>
                </div>
                <div className="style-dropdown-sub-field">
                  <label>Opacity</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={settings.inlineBgOpacity !== undefined ? settings.inlineBgOpacity : 0.7}
                    onChange={(e) => handleChange('inlineBgOpacity', parseFloat(e.target.value))}
                    className="style-dropdown-input"
                  />
                  <span className="style-dropdown-range-value">
                    {Math.round((settings.inlineBgOpacity !== undefined ? settings.inlineBgOpacity : 0.7) * 100)}%
                  </span>
                </div>
                <div className="style-dropdown-sub-field">
                  <label>Padding (px)</label>
                  <input
                    type="number"
                    min="0"
                    max="30"
                    value={settings.inlineBgPadding || 8}
                    onChange={(e) => handleChange('inlineBgPadding', parseInt(e.target.value) || 0)}
                    className="style-dropdown-input"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

export default TextEffectsOptions
