import { useState, useEffect, useRef, useMemo } from 'react'
import { resolveMotionSettings, getCanvasPushDirectionLabel } from '../utils/motionPresets'
import './TransitionOptions.css'

function TransitionOptions({ settings, onUpdateSettings, slide, onUpdateSlide, selectedCount = 1, onClose, buttonRef, embedded, section }) {
  const show = (name) => !section || section === name
  const panelRef = useRef(null)
  const [localSettings, setLocalSettings] = useState({
    transitionStyle: settings?.transitionStyle || 'default',
    transitionSpeed: settings?.transitionSpeed ?? 1,
    canvasPushDirection: settings?.canvasPushDirection || 'left',
  })

  const slideMotion = useMemo(
    () => (slide ? resolveMotionSettings({}, slide) : null),
    [slide]
  )

  useEffect(() => {
    setLocalSettings({
      transitionStyle: settings?.transitionStyle || 'default',
      transitionSpeed: settings?.transitionSpeed ?? 1,
      canvasPushDirection: settings?.canvasPushDirection || 'left',
    })
  }, [settings?.transitionStyle, settings?.transitionSpeed, settings?.canvasPushDirection])

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

  const handleDeckChange = (key, value) => {
    const next = { ...localSettings, [key]: value }
    setLocalSettings(next)
    if (onUpdateSettings) {
      onUpdateSettings({ ...settings, ...next })
    }
  }

  const handleSlideMotionChange = (key, value) => {
    if (!onUpdateSlide) return
    onUpdateSlide({ [key]: value, motionPreset: 'default' })
  }

  const canEditSlideMotion = !!(slide && onUpdateSlide)

  const content = (
    <div className="transition-options-content">
          {show('transitions') && (
          <div className="transition-options-section">
            <h3>Slide Transitions</h3>
            <p className="transition-options-hint">Transition style and speed apply to the whole deck.</p>
            <div className="transition-options-field">
              <label htmlFor="transition-style-select">Transition Style</label>
              <select
                id="transition-style-select"
                value={localSettings.transitionStyle}
                onChange={(e) => handleDeckChange('transitionStyle', e.target.value)}
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
                <label htmlFor="canvas-push-direction">
                  {canEditSlideMotion ? 'Push direction (selected slide)' : 'Default push direction'}
                </label>
                <select
                  id="canvas-push-direction"
                  value={canEditSlideMotion ? (slide.canvasPushDirection || 'default') : localSettings.canvasPushDirection}
                  onChange={(e) => {
                    if (canEditSlideMotion) {
                      onUpdateSlide({ canvasPushDirection: e.target.value })
                    } else {
                      handleDeckChange('canvasPushDirection', e.target.value)
                    }
                  }}
                  className="transition-options-select"
                >
                  {canEditSlideMotion && (
                    <option value="default">
                      Use deck default ({getCanvasPushDirectionLabel(localSettings.canvasPushDirection).split(' (')[0]})
                    </option>
                  )}
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
                onChange={(e) => handleDeckChange('transitionSpeed', parseFloat(e.target.value))}
                className="transition-options-slider"
              />
            </div>
          </div>
          )}

          {!canEditSlideMotion && show('textAnimation') && (
            <div className="transition-options-section">
              <p className="transition-options-hint">Select a slide to edit its animation settings.</p>
            </div>
          )}

          {canEditSlideMotion && selectedCount > 1 && (
            <p className="transition-options-hint">Applying animation settings to {selectedCount} slides.</p>
          )}

          {canEditSlideMotion && slideMotion && show('textAnimation') && (
          <div className="transition-options-section">
            <h3>Text in &amp; out animations</h3>
            <div className="transition-options-field">
              <label htmlFor="text-animation-select">Text animation</label>
              <select
                id="text-animation-select"
                value={slideMotion.textAnimation}
                onChange={(e) => handleSlideMotionChange('textAnimation', e.target.value)}
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
              <label className={`transition-options-checkbox ${slideMotion.textAnimation === 'none' ? 'transition-options-checkbox-disabled' : ''}`}>
                <input
                  type="checkbox"
                  checked={slideMotion.textAnimationUnit === 'word'}
                  onChange={(e) => handleSlideMotionChange('textAnimationUnit', e.target.checked ? 'word' : 'sentence')}
                  disabled={slideMotion.textAnimation === 'none'}
                />
                <span>Animate per word (uncheck for whole sentences)</span>
              </label>
              {slideMotion.textAnimation === 'none' && (
                <span className="transition-options-hint">Select a text animation above first</span>
              )}
            </div>
            {slideMotion.textAnimation !== 'none' && (
              <>
              <div className="transition-options-field">
                <label htmlFor="text-animation-stagger-slider">
                  Word stagger: {slideMotion.textAnimationStagger.toFixed(2)}s
                </label>
                <input
                  id="text-animation-stagger-slider"
                  type="range"
                  min="0.03"
                  max="0.2"
                  step="0.01"
                  value={slideMotion.textAnimationStagger}
                  onChange={(e) => handleSlideMotionChange('textAnimationStagger', parseFloat(e.target.value))}
                  className="transition-options-slider"
                />
              </div>
              <div className="transition-options-field">
                <label htmlFor="text-exit-animation-select">Text exit animation</label>
                <select
                  id="text-exit-animation-select"
                  value={slideMotion.textExitAnimation}
                  onChange={(e) => handleSlideMotionChange('textExitAnimation', e.target.value)}
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
                  Subtitle delay: {slideMotion.subtitleDelay.toFixed(2)}s
                </label>
                <input
                  id="subtitle-delay-slider"
                  type="range"
                  min="0"
                  max="1.5"
                  step="0.05"
                  value={slideMotion.subtitleDelay}
                  onChange={(e) => handleSlideMotionChange('subtitleDelay', parseFloat(e.target.value))}
                  className="transition-options-slider"
                />
              </div>
              <div className="transition-options-field">
                <label htmlFor="text-animation-speed-slider">
                  Animation speed: {slideMotion.textAnimationSpeed === 1 ? 'Normal' : slideMotion.textAnimationSpeed < 1 ? 'Slower' : 'Faster'}
                </label>
                <input
                  id="text-animation-speed-slider"
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.1"
                  value={slideMotion.textAnimationSpeed}
                  onChange={(e) => handleSlideMotionChange('textAnimationSpeed', parseFloat(e.target.value))}
                  className="transition-options-slider"
                />
              </div>
              </>
            )}
          </div>
          )}

          {canEditSlideMotion && slideMotion && show('backgroundAnimation') && (
          <div className="transition-options-section">
            <h3>Background animations</h3>
            <div className="transition-options-field">
              <label className="transition-options-checkbox">
                <input
                  type="checkbox"
                  checked={slideMotion.backgroundBlurOnTextEnter}
                  onChange={(e) => handleSlideMotionChange('backgroundBlurOnTextEnter', e.target.checked)}
                />
                <span>Blur background while text enters</span>
              </label>
            </div>
            <div className="transition-options-field">
              <label htmlFor="graphic-animation-in">Graphic overlay entrance</label>
              <select
                id="graphic-animation-in"
                value={slideMotion.graphicAnimationIn}
                onChange={(e) => handleSlideMotionChange('graphicAnimationIn', e.target.value)}
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
