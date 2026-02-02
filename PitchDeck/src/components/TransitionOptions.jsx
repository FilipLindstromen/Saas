import { useState, useEffect, useRef } from 'react'
import './TransitionOptions.css'

function TransitionOptions({ settings, onUpdateSettings, onClose, buttonRef }) {
  const panelRef = useRef(null)
  const [localSettings, setLocalSettings] = useState({
    transitionStyle: settings?.transitionStyle || 'default',
    textAnimation: settings?.textAnimation || 'none',
    textAnimationUnit: settings?.textAnimationUnit || 'word',
    backgroundScaleAnimation: settings?.backgroundScaleAnimation || false,
    backgroundScaleTime: settings?.backgroundScaleTime || 10,
    backgroundScaleAmount: settings?.backgroundScaleAmount ?? 20
  })

  useEffect(() => {
    const updatePosition = () => {
      if (buttonRef?.current && panelRef?.current) {
        const buttonRect = buttonRef.current.getBoundingClientRect()
        panelRef.current.style.top = `${buttonRect.bottom + 8}px`
        panelRef.current.style.right = `${window.innerWidth - buttonRect.right}px`
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
    const next = { ...localSettings, [key]: value }
    setLocalSettings(next)
    if (onUpdateSettings) {
      onUpdateSettings({ ...settings, ...next })
    }
  }

  return (
    <div className="transition-options-overlay" onClick={onClose}>
      <div ref={panelRef} className="transition-options-modal" onClick={(e) => e.stopPropagation()}>
        <div className="transition-options-header">
          <h2>Transition & Animation Options</h2>
        </div>
        <div className="transition-options-content">
          <div className="transition-options-section">
            <h3>Slide Transitions</h3>
            <div className="transition-options-field">
              <label htmlFor="transition-style-select">Transition Style</label>
              <select
                id="transition-style-select"
                value={localSettings.transitionStyle}
                onChange={(e) => handleChange('transitionStyle', e.target.value)}
                className="transition-options-select"
              >
                <option value="default">Default</option>
                <option value="slide">Slide</option>
                <option value="zoom">Zoom</option>
                <option value="dissolve">Dissolve</option>
                <option value="blur">Blur</option>
                <option value="sequence">Object Sequence</option>
              </select>
            </div>
          </div>

          <div className="transition-options-section">
            <h3>Text in &amp; out animations</h3>
            <div className="transition-options-field">
              <label htmlFor="text-animation-select">Text animation</label>
              <select
                id="text-animation-select"
                value={localSettings.textAnimation}
                onChange={(e) => handleChange('textAnimation', e.target.value)}
                className="transition-options-select"
              >
                <option value="none">None</option>
                <option value="fade-in">Fade in</option>
                <option value="fade-in-up">Fade in + slide up</option>
                <option value="fade-in-down">Fade in + slide down</option>
                <option value="slide-in-left">Slide in from right (-x)</option>
                <option value="slide-in-right">Slide in from left (+x)</option>
                <option value="typewriter">Typewriter</option>
                <option value="zoom-in">Zoom in</option>
                <option value="bounce-in">Bounce in</option>
                <option value="words-fade-up">Words: fade + slide up (sequence)</option>
                <option value="blur-in">Blur in</option>
              </select>
            </div>
            <div className="transition-options-field">
              <label className="transition-options-checkbox">
                <input
                  type="checkbox"
                  checked={localSettings.textAnimationUnit === 'word'}
                  onChange={(e) => handleChange('textAnimationUnit', e.target.checked ? 'word' : 'sentence')}
                />
                <span>Animate per word (uncheck for whole sentences)</span>
              </label>
            </div>
          </div>

          <div className="transition-options-section">
            <h3>Background Animations</h3>
            <div className="transition-options-field">
              <label className="transition-options-checkbox">
                <input
                  type="checkbox"
                  checked={localSettings.backgroundScaleAnimation}
                  onChange={(e) => handleChange('backgroundScaleAnimation', e.target.checked)}
                />
                <span>Enable Background Scale Animation</span>
              </label>
            </div>
            {localSettings.backgroundScaleAnimation && (
              <>
                <div className="transition-options-field">
                  <label htmlFor="background-scale-time-slider">
                    Scale Animation Duration: {localSettings.backgroundScaleTime}s
                  </label>
                  <input
                    id="background-scale-time-slider"
                    type="range"
                    min="1"
                    max="30"
                    step="1"
                    value={localSettings.backgroundScaleTime}
                    onChange={(e) => handleChange('backgroundScaleTime', parseFloat(e.target.value))}
                    className="transition-options-slider"
                  />
                </div>
                <div className="transition-options-field">
                  <label htmlFor="background-scale-amount-slider">
                    Scale up by: {localSettings.backgroundScaleAmount}%
                  </label>
                  <input
                    id="background-scale-amount-slider"
                    type="range"
                    min="5"
                    max="100"
                    step="5"
                    value={localSettings.backgroundScaleAmount}
                    onChange={(e) => handleChange('backgroundScaleAmount', parseFloat(e.target.value) || 20)}
                    className="transition-options-slider"
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default TransitionOptions
