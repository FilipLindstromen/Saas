import { useState, useEffect, useRef } from 'react'
import { DECK_MOTION_PRESET_OPTIONS, getDeckMotionPreset } from '../utils/motionPresets'
import './TransitionOptions.css'

function TransitionOptions({ settings, onUpdateSettings, onClose, buttonRef, embedded, section }) {
  const show = (name) => !section || section === name
  const panelRef = useRef(null)
  const [localSettings, setLocalSettings] = useState({
    motionPreset: settings?.motionPreset || 'custom',
    transitionStyle: settings?.transitionStyle || 'default',
    transitionSpeed: settings?.transitionSpeed ?? 1,
    canvasPushDirection: settings?.canvasPushDirection || 'left',
    textAnimation: settings?.textAnimation || 'none',
    textAnimationUnit: settings?.textAnimationUnit || 'word',
    textAnimationSpeed: settings?.textAnimationSpeed ?? 1,
    textAnimationStagger: settings?.textAnimationStagger ?? 0.07,
    textExitAnimation: settings?.textExitAnimation || 'match-in',
    subtitleDelay: settings?.subtitleDelay ?? 0,
    backgroundKenBurnsDirection: settings?.backgroundKenBurnsDirection || 'zoom-in',
    backgroundBlurOnTextEnter: settings?.backgroundBlurOnTextEnter === true,
    graphicAnimationIn: settings?.graphicAnimationIn || 'fade-scale',
    kenBurns: settings?.kenBurns ?? settings?.backgroundScaleAnimation ?? false,
  })

  useEffect(() => {
    if (embedded) return
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
  }, [buttonRef, embedded])

  useEffect(() => {
    if (embedded) return
    const handleEscape = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose, embedded])

  const handleChange = (key, value) => {
    const next = { ...localSettings, [key]: value }
    setLocalSettings(next)
    if (onUpdateSettings) {
      onUpdateSettings({ ...settings, ...next })
    }
  }

  const isCustomMotion = (localSettings.motionPreset || 'custom') === 'custom'
  const deckPresetMeta = getDeckMotionPreset(localSettings.motionPreset || 'custom')

  const content = (
    <div className="transition-options-content">
          <div className="transition-options-section">
            <h3>Deck motion preset</h3>
            <div className="transition-options-field">
              <label htmlFor="deck-motion-preset">Preset for all slides</label>
              <select
                id="deck-motion-preset"
                value={localSettings.motionPreset || 'custom'}
                onChange={(e) => handleChange('motionPreset', e.target.value)}
                className="transition-options-select"
              >
                {DECK_MOTION_PRESET_OPTIONS.map((preset) => (
                  <option key={preset.id} value={preset.id}>{preset.label}</option>
                ))}
              </select>
              <p className="transition-options-hint">{deckPresetMeta.description}</p>
            </div>
          </div>

          {show('transitions') && (
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
                <option value="crossfade">Crossfade</option>
                <option value="blur">Blur</option>
                <option value="sequence">Object Sequence</option>
                <option value="canvas-push">Canvas push</option>
              </select>
            </div>
            {localSettings.transitionStyle === 'canvas-push' && (
              <div className="transition-options-field">
                <label htmlFor="canvas-push-direction">Push direction</label>
                <select
                  id="canvas-push-direction"
                  value={localSettings.canvasPushDirection}
                  onChange={(e) => handleChange('canvasPushDirection', e.target.value)}
                  className="transition-options-select"
                >
                  <option value="left">Left (exit left, enter from right)</option>
                  <option value="right">Right (exit right, enter from left)</option>
                  <option value="up">Up (exit up, enter from bottom)</option>
                  <option value="down">Down (exit down, enter from top)</option>
                </select>
              </div>
            )}
            <div className="transition-options-field">
              <label htmlFor="transition-speed-slider">
                Transition speed: {localSettings.transitionSpeed === 1 ? 'Normal' : `${Math.round(localSettings.transitionSpeed * 100)}%`}
              </label>
              <input
                id="transition-speed-slider"
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={localSettings.transitionSpeed}
                onChange={(e) => handleChange('transitionSpeed', parseFloat(e.target.value))}
                className="transition-options-slider"
              />
            </div>
          </div>
          )}

          {isCustomMotion && show('textAnimation') && (
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
              <label className={`transition-options-checkbox ${localSettings.textAnimation === 'none' ? 'transition-options-checkbox-disabled' : ''}`}>
                <input
                  type="checkbox"
                  checked={localSettings.textAnimationUnit === 'word'}
                  onChange={(e) => handleChange('textAnimationUnit', e.target.checked ? 'word' : 'sentence')}
                  disabled={localSettings.textAnimation === 'none'}
                />
                <span>Animate per word (uncheck for whole sentences)</span>
              </label>
              {localSettings.textAnimation === 'none' && (
                <span className="transition-options-hint">Select a text animation above first</span>
              )}
            </div>
            {localSettings.textAnimation !== 'none' && (
              <>
              <div className="transition-options-field">
                <label htmlFor="text-animation-stagger-slider">
                  Word stagger: {localSettings.textAnimationStagger.toFixed(2)}s
                </label>
                <input
                  id="text-animation-stagger-slider"
                  type="range"
                  min="0.03"
                  max="0.2"
                  step="0.01"
                  value={localSettings.textAnimationStagger}
                  onChange={(e) => handleChange('textAnimationStagger', parseFloat(e.target.value))}
                  className="transition-options-slider"
                />
              </div>
              <div className="transition-options-field">
                <label htmlFor="text-exit-animation-select">Text exit animation</label>
                <select
                  id="text-exit-animation-select"
                  value={localSettings.textExitAnimation}
                  onChange={(e) => handleChange('textExitAnimation', e.target.value)}
                  className="transition-options-select"
                >
                  <option value="match-in">Match entrance (recommended)</option>
                  <option value="fade-out">Fade out</option>
                  <option value="fade-out-up">Fade out + slide up</option>
                  <option value="fade-out-down">Fade out + slide down</option>
                  <option value="none">None</option>
                </select>
              </div>
              <div className="transition-options-field">
                <label htmlFor="subtitle-delay-slider">
                  Subtitle delay: {localSettings.subtitleDelay.toFixed(2)}s
                </label>
                <input
                  id="subtitle-delay-slider"
                  type="range"
                  min="0"
                  max="1.5"
                  step="0.05"
                  value={localSettings.subtitleDelay}
                  onChange={(e) => handleChange('subtitleDelay', parseFloat(e.target.value))}
                  className="transition-options-slider"
                />
              </div>
              <div className="transition-options-field">
                <label htmlFor="text-animation-speed-slider">
                  Animation speed: {localSettings.textAnimationSpeed === 1 ? 'Normal' : localSettings.textAnimationSpeed < 1 ? 'Slower' : 'Faster'}
                </label>
                <input
                  id="text-animation-speed-slider"
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.1"
                  value={localSettings.textAnimationSpeed}
                  onChange={(e) => handleChange('textAnimationSpeed', parseFloat(e.target.value))}
                  className="transition-options-slider"
                />
              </div>
              </>
            )}
          </div>
          )}

          {isCustomMotion && show('backgroundAnimation') && (
          <div className="transition-options-section">
            <h3>Background animations</h3>
            <div className="transition-options-field">
              <label className="transition-options-checkbox">
                <input
                  type="checkbox"
                  checked={localSettings.kenBurns}
                  onChange={(e) => handleChange('kenBurns', e.target.checked)}
                />
                <span>Enable Ken Burns on backgrounds</span>
              </label>
            </div>
            {localSettings.kenBurns && (
              <div className="transition-options-field">
                <label htmlFor="background-ken-burns-direction">Ken Burns direction</label>
                <select
                  id="background-ken-burns-direction"
                  value={localSettings.backgroundKenBurnsDirection}
                  onChange={(e) => handleChange('backgroundKenBurnsDirection', e.target.value)}
                  className="transition-options-select"
                >
                  <option value="zoom-in">Zoom in</option>
                  <option value="zoom-out">Zoom out</option>
                  <option value="pan-left">Pan left</option>
                  <option value="pan-right">Pan right</option>
                  <option value="pan-up">Pan up</option>
                  <option value="pan-down">Pan down</option>
                </select>
              </div>
            )}
            <div className="transition-options-field">
              <label className="transition-options-checkbox">
                <input
                  type="checkbox"
                  checked={localSettings.backgroundBlurOnTextEnter}
                  onChange={(e) => handleChange('backgroundBlurOnTextEnter', e.target.checked)}
                />
                <span>Blur background while text enters</span>
              </label>
            </div>
            <div className="transition-options-field">
              <label htmlFor="graphic-animation-in">Graphic overlay entrance</label>
              <select
                id="graphic-animation-in"
                value={localSettings.graphicAnimationIn}
                onChange={(e) => handleChange('graphicAnimationIn', e.target.value)}
                className="transition-options-select"
              >
                <option value="fade-scale">Fade + scale</option>
                <option value="fade">Fade</option>
                <option value="slide-y">Slide up</option>
              </select>
            </div>
          </div>
          )}
    </div>
  )

  if (embedded) return content
  return (
    <div className="transition-options-overlay" onClick={onClose}>
      <div ref={panelRef} className="transition-options-modal" onClick={(e) => e.stopPropagation()}>
        <div className="transition-options-header">
          <h2>Transition & Animation Options</h2>
        </div>
        {content}
      </div>
    </div>
  )
}

export default TransitionOptions
