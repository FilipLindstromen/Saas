import { useEffect, useRef } from 'react'
import './StyleDropdown.css'

function ColorOptions({ settings, onUpdateSettings, onClose, buttonRef }) {
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
          <div className="style-dropdown-title">Colors</div>
          <div className="style-dropdown-field">
            <label>Background Color</label>
            <div className="style-dropdown-color-group">
              <input
                type="color"
                value={settings.backgroundColor || '#1a1a1a'}
                onChange={(e) => handleChange('backgroundColor', e.target.value)}
                className="style-dropdown-color-picker"
              />
              <input
                type="text"
                value={settings.backgroundColor || '#1a1a1a'}
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
        </div>
      </div>
    </>
  )
}

export default ColorOptions
