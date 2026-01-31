import { useState } from 'react'
import './TransitionOptions.css'

function TransitionOptions({ settings, onUpdateSettings, onClose }) {
  const [localSettings, setLocalSettings] = useState({
    transitionStyle: settings?.transitionStyle || 'default',
    textAnimation: settings?.textAnimation || 'none',
    backgroundScaleAnimation: settings?.backgroundScaleAnimation || false,
    backgroundScaleTime: settings?.backgroundScaleTime || 10
  })

  const handleChange = (key, value) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }))
  }

  const handleApply = () => {
    if (onUpdateSettings) {
      onUpdateSettings({ ...settings, ...localSettings })
    }
    onClose()
  }

  return (
    <div className="transition-options-overlay" onClick={onClose}>
      <div className="transition-options-modal" onClick={(e) => e.stopPropagation()}>
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
            <h3>Text Animations</h3>
            <div className="transition-options-field">
              <label htmlFor="text-animation-select">Text Animation</label>
              <select
                id="text-animation-select"
                value={localSettings.textAnimation}
                onChange={(e) => handleChange('textAnimation', e.target.value)}
                className="transition-options-select"
              >
                <option value="none">None</option>
                <option value="fade-in">Fade In</option>
                <option value="slide-up">Slide Up</option>
                <option value="slide-down">Slide Down</option>
                <option value="slide-left">Slide Left</option>
                <option value="slide-right">Slide Right</option>
                <option value="zoom-in">Zoom In</option>
                <option value="typewriter">Typewriter</option>
                <option value="bounce">Bounce</option>
              </select>
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
            )}
          </div>
        </div>
        <div className="transition-options-footer">
          <button className="btn-apply" onClick={handleApply}>Apply</button>
        </div>
      </div>
    </div>
  )
}

export default TransitionOptions
