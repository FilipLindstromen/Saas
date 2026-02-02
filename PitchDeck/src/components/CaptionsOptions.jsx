import { useState, useEffect, useRef } from 'react'
import './CaptionsOptions.css'

const CAPTION_STYLE_OPTIONS = [
  { id: 'bottom-black', label: 'Black (behind text)', bg: 'rgba(0,0,0,0.85)', fg: '#ffffff', outline: false },
  { id: 'bottom-white', label: 'White (behind text)', bg: 'rgba(255,255,255,0.9)', fg: '#111111', outline: false },
  { id: 'top-black', label: 'Black bar', bg: 'rgba(0,0,0,0.85)', fg: '#ffffff', outline: false },
  { id: 'top-white', label: 'White bar', bg: 'rgba(255,255,255,0.9)', fg: '#111111', outline: false },
  { id: 'white-outline', label: 'White text with outline', bg: 'transparent', fg: '#ffffff', outline: true },
  { id: 'large-white', label: 'Large white (behind text)', bg: 'rgba(0,0,0,0.75)', fg: '#ffffff', outline: false }
]

const CAPTION_FONTS = [
  { id: 'Poppins', label: 'Poppins' },
  { id: 'Inter', label: 'Inter' },
  { id: 'Open Sans', label: 'Open Sans' },
  { id: 'Roboto', label: 'Roboto' },
  { id: 'Arial', label: 'Arial' }
]

const CAPTION_FONT_SIZES = [
  { id: 'small', label: 'Small' },
  { id: 'medium', label: 'Medium' },
  { id: 'large', label: 'Large' }
]

function CaptionStylePreview({ style, font, fontSize, dropShadow, selected, onSelect }) {
  const sizeClass = fontSize === 'small' ? 'caption-preview-small' : fontSize === 'large' ? 'caption-preview-large' : ''
  const textShadow = style.outline
    ? '0 0 2px #000, 0 0 2px #000, 0 1px 2px #000'
    : dropShadow
      ? '1px 1px 4px rgba(0,0,0,0.8)'
      : 'none'
  return (
    <button
      type="button"
      className={`captions-style-preview-card ${selected ? 'selected' : ''} ${sizeClass}`}
      onClick={() => onSelect(style.id)}
    >
      <div className="captions-style-preview-bar-wrap">
        <span
          className="captions-style-preview-bar"
          style={{
            background: style.bg,
            color: style.fg,
            fontFamily: `${font}, sans-serif`,
            textShadow
          }}
        >
          Sample caption
        </span>
      </div>
      <span className="captions-style-preview-label">{style.label}</span>
    </button>
  )
}

function CaptionsOptions({ recordSettings, onClose, onUpdateSettings, buttonRef }) {
  const dropdownRef = useRef(null)
  const [localSettings, setLocalSettings] = useState({
    captionsEnabled: recordSettings?.captionsEnabled === true,
    captionStyle: recordSettings?.captionStyle || 'bottom-black',
    captionFont: recordSettings?.captionFont || 'Poppins',
    captionFontSize: recordSettings?.captionFontSize || 'medium',
    captionDropShadow: recordSettings?.captionDropShadow === true
  })

  useEffect(() => {
    setLocalSettings({
      captionsEnabled: recordSettings?.captionsEnabled === true,
      captionStyle: recordSettings?.captionStyle || 'bottom-black',
      captionFont: recordSettings?.captionFont || 'Poppins',
      captionFontSize: recordSettings?.captionFontSize || 'medium',
      captionDropShadow: recordSettings?.captionDropShadow === true
    })
  }, [recordSettings?.captionsEnabled, recordSettings?.captionStyle, recordSettings?.captionFont, recordSettings?.captionFontSize, recordSettings?.captionDropShadow])

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
    const newSettings = { ...localSettings, [key]: value }
    setLocalSettings(newSettings)
    if (onUpdateSettings) {
      onUpdateSettings({
        ...recordSettings,
        captionsEnabled: newSettings.captionsEnabled,
        captionStyle: newSettings.captionStyle,
        captionFont: newSettings.captionFont,
        captionFontSize: newSettings.captionFontSize,
        captionDropShadow: newSettings.captionDropShadow
      })
    }
  }

  return (
    <>
      <div className="captions-options-backdrop" onClick={onClose} />
      <div className="captions-options-dropdown" ref={dropdownRef} onClick={(e) => e.stopPropagation()}>
        <div className="captions-options-content">
          <h3 className="captions-options-title">Video captions</h3>
          <p className="captions-options-desc">When enabled, the recorded video is sent to OpenAI for transcription, then captions are burned into the video before export. Requires OpenAI API key in Settings.</p>
          <div className="captions-options-field">
            <label className="captions-options-checkbox">
              <input
                type="checkbox"
                checked={localSettings.captionsEnabled}
                onChange={(e) => handleChange('captionsEnabled', e.target.checked)}
              />
              <span>Enable captions on recorded video</span>
            </label>
          </div>
          {localSettings.captionsEnabled && (
            <>
              <div className="captions-options-field">
                <label className="captions-options-label">Caption style</label>
                <div className="captions-style-preview-grid">
                  {CAPTION_STYLE_OPTIONS.map((s) => (
                    <CaptionStylePreview
                      key={s.id}
                      style={s}
                      font={localSettings.captionFont || 'Poppins'}
                      fontSize={localSettings.captionFontSize || 'medium'}
                      dropShadow={localSettings.captionDropShadow}
                      selected={localSettings.captionStyle === s.id}
                      onSelect={(id) => handleChange('captionStyle', id)}
                    />
                  ))}
                </div>
              </div>
              <div className="captions-options-field">
                <label className="captions-options-checkbox">
                  <input
                    type="checkbox"
                    checked={localSettings.captionDropShadow === true}
                    onChange={(e) => handleChange('captionDropShadow', e.target.checked)}
                  />
                  <span>Drop shadow on text</span>
                </label>
              </div>
              <div className="captions-options-field">
                <label htmlFor="caption-font-select">Font</label>
                <select
                  id="caption-font-select"
                  value={localSettings.captionFont || 'Poppins'}
                  onChange={(e) => handleChange('captionFont', e.target.value)}
                  className="captions-options-select"
                >
                  {CAPTION_FONTS.map((f) => (
                    <option key={f.id} value={f.id}>{f.label}</option>
                  ))}
                </select>
              </div>
              <div className="captions-options-field">
                <label htmlFor="caption-font-size-select">Font size</label>
                <select
                  id="caption-font-size-select"
                  value={localSettings.captionFontSize || 'medium'}
                  onChange={(e) => handleChange('captionFontSize', e.target.value)}
                  className="captions-options-select"
                >
                  {CAPTION_FONT_SIZES.map((s) => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}

export default CaptionsOptions
