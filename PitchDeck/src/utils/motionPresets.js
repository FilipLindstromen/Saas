/** Per-slide motion presets and resolved animation settings. */

export const KEN_BURNS_DURATION_S = 10
export const KEN_BURNS_AMOUNT_PCT = 20

export const SLIDE_MOTION_DEFAULTS = {
  textAnimation: 'none',
  textAnimationUnit: 'word',
  textAnimationSpeed: 1,
  textAnimationStagger: 0.07,
  textExitAnimation: 'match-in',
  subtitleDelay: 0,
  backgroundBlurOnTextEnter: false,
  graphicAnimationIn: 'fade-scale',
}

export const MOTION_PRESET_OPTIONS = [
  {
    id: 'default',
    label: 'Custom',
    description: 'Fine-tune text, background, and graphic animations below.',
  },
  {
    id: 'hook',
    label: 'Hook',
    description: 'Punchy word stagger with subtle background blur reveal.',
    settings: {
      textAnimation: 'words-fade-up',
      textAnimationUnit: 'word',
      textAnimationStagger: 0.05,
      textExitAnimation: 'match-in',
      subtitleDelay: 0.35,
      backgroundBlurOnTextEnter: true,
      graphicAnimationIn: 'fade-scale',
    },
  },
  {
    id: 'explain',
    label: 'Explain',
    description: 'Calm line reveals with upward fades.',
    settings: {
      textAnimation: 'fade-in-up',
      textAnimationUnit: 'sentence',
      textAnimationStagger: 0.18,
      textExitAnimation: 'match-in',
      revealOneLineAtATime: true,
      graphicAnimationIn: 'fade',
    },
  },
  {
    id: 'quote',
    label: 'Quote',
    description: 'Soft fade with delayed subtitle.',
    settings: {
      textAnimation: 'fade-in',
      textAnimationUnit: 'sentence',
      textAnimationStagger: 0.22,
      textExitAnimation: 'fade-out',
      subtitleDelay: 0.55,
    },
  },
  {
    id: 'cta',
    label: 'CTA',
    description: 'Bouncy headline entrance with popping graphics.',
    settings: {
      textAnimation: 'bounce-in',
      textAnimationUnit: 'word',
      textAnimationStagger: 0.08,
      textExitAnimation: 'match-in',
      subtitleDelay: 0.25,
      graphicAnimationIn: 'fade-scale',
    },
  },
  {
    id: 'stat',
    label: 'Stat / proof',
    description: 'Bold zoom-in headline with crisp graphic entrance.',
    settings: {
      textAnimation: 'zoom-in',
      textAnimationUnit: 'sentence',
      textAnimationStagger: 0.15,
      textExitAnimation: 'match-in',
      graphicAnimationIn: 'slide-y',
    },
  },
]

/** @deprecated Deck-wide presets removed; kept for import compatibility. */
export const DECK_MOTION_PRESET_OPTIONS = MOTION_PRESET_OPTIONS.filter((item) => item.id !== 'default')

export function getMotionPreset(id) {
  return MOTION_PRESET_OPTIONS.find((item) => item.id === id) || MOTION_PRESET_OPTIONS[0]
}

export function getDeckMotionPreset(id) {
  return getMotionPreset(id)
}

function readSlideMotionValue(slide, keys) {
  if (!slide) return undefined
  for (const key of keys) {
    const value = slide[key]
    if (value !== undefined && value !== null && value !== '') return value
  }
  return undefined
}

/** Resolve which named preset applies on this slide. */
export function resolveEffectiveMotionPresetId(_globalSettings = {}, slide = null) {
  const slidePreset = slide?.motionPreset
  if (slidePreset && slidePreset !== 'default') return slidePreset
  return 'default'
}

export function resolveMotionSettings(_globalSettings = {}, slide = null) {
  const effectivePresetId = resolveEffectiveMotionPresetId({}, slide)
  const preset = getMotionPreset(effectivePresetId)
  const presetSettings = preset.id === 'default' ? {} : (preset.settings || {})

  const pick = (slideKeys, presetKey, fallback) => {
    const slideValue = readSlideMotionValue(slide, Array.isArray(slideKeys) ? slideKeys : [slideKeys])
    if (slideValue !== undefined) return slideValue
    if (presetSettings[presetKey] !== undefined) return presetSettings[presetKey]
    return fallback
  }

  return {
    motionPreset: effectivePresetId,
    textAnimation: pick(['textAnimation', 'textAnimationOverride'], 'textAnimation', SLIDE_MOTION_DEFAULTS.textAnimation),
    textAnimationUnit: pick('textAnimationUnit', 'textAnimationUnit', SLIDE_MOTION_DEFAULTS.textAnimationUnit),
    textAnimationSpeed: pick('textAnimationSpeed', 'textAnimationSpeed', SLIDE_MOTION_DEFAULTS.textAnimationSpeed),
    textAnimationStagger: pick('textAnimationStagger', 'textAnimationStagger', SLIDE_MOTION_DEFAULTS.textAnimationStagger),
    textExitAnimation: pick(['textExitAnimation', 'textExitAnimationOverride'], 'textExitAnimation', SLIDE_MOTION_DEFAULTS.textExitAnimation),
    subtitleDelay: pick('subtitleDelay', 'subtitleDelay', SLIDE_MOTION_DEFAULTS.subtitleDelay),
    kenBurns: false,
    backgroundKenBurnsDirection: pick('backgroundKenBurnsDirection', 'backgroundKenBurnsDirection', 'zoom-in'),
    backgroundBlurOnTextEnter: pick('backgroundBlurOnTextEnter', 'backgroundBlurOnTextEnter', SLIDE_MOTION_DEFAULTS.backgroundBlurOnTextEnter),
    graphicAnimationIn: pick('graphicAnimationIn', 'graphicAnimationIn', SLIDE_MOTION_DEFAULTS.graphicAnimationIn),
    revealOneLineAtATime: slide?.revealOneLineAtATime === true
      || (slide?.revealOneLineAtATime !== false && presetSettings.revealOneLineAtATime === true),
  }
}

const TEXT_EXIT_MATCH_MAP = {
  'fade-in': 'fade-out',
  'fade-in-up': 'fade-out-down',
  'fade-in-down': 'fade-out-up',
  'slide-in-left': 'slide-out-right',
  'slide-in-right': 'slide-out-left',
  'zoom-in': 'zoom-out',
  'bounce-in': 'fade-out',
  'words-fade-up': 'words-fade-down',
  'blur-in': 'blur-out',
  typewriter: 'fade-out',
}

export function getTextExitClass(textExitAnimation, textAnimation) {
  if (textExitAnimation === 'none') return 'text-exit-none'
  if (textExitAnimation === 'match-in') {
    const matched = TEXT_EXIT_MATCH_MAP[textAnimation] || 'fade-out'
    return `text-exit-${matched}`
  }
  return `text-exit-${textExitAnimation}`
}

export const VALID_TRANSITION_STYLES = new Set(['default', 'slide', 'zoom', 'dissolve', 'crossfade', 'blur', 'sequence', 'canvas-push'])

const TRANSITION_STYLE_LABELS = {
  default: 'Default',
  slide: 'Slide',
  zoom: 'Zoom',
  dissolve: 'Dissolve',
  crossfade: 'Crossfade',
  blur: 'Blur',
  sequence: 'Object Sequence',
  'canvas-push': 'Canvas push',
}

export function getTransitionStyleLabel(style = 'default') {
  return TRANSITION_STYLE_LABELS[style] || TRANSITION_STYLE_LABELS.default
}

/** Per-slide transition style override; falls back to deck default. */
export function resolveTransitionStyle(deckStyle = 'default', slide = null) {
  const slideStyle = slide?.transitionStyle
  if (typeof slideStyle === 'string' && slideStyle !== '' && VALID_TRANSITION_STYLES.has(slideStyle)) {
    return slideStyle
  }
  return VALID_TRANSITION_STYLES.has(deckStyle) ? deckStyle : 'default'
}

const VALID_CANVAS_PUSH_DIRECTIONS = new Set(['left', 'right', 'up', 'down'])

export function getCanvasPushDirectionLabel(direction = 'left') {
  const labels = {
    left: 'Left (exit left, enter from right)',
    right: 'Right (exit right, enter from left)',
    up: 'Up (exit up, enter from bottom)',
    down: 'Down (exit down, enter from top)',
  }
  return labels[direction] || labels.left
}

/** Per-slide push direction override; falls back to deck default. */
export function resolveCanvasPushDirection(deckDirection = 'left', slide = null) {
  const slideDirection = slide?.canvasPushDirection
  if (slideDirection && slideDirection !== 'default' && VALID_CANVAS_PUSH_DIRECTIONS.has(slideDirection)) {
    return slideDirection
  }
  return VALID_CANVAS_PUSH_DIRECTIONS.has(deckDirection) ? deckDirection : 'left'
}

export function applyMotionPresetToSlide(_slide, presetId) {
  if (presetId === 'default') {
    return {
      motionPreset: 'default',
      ...SLIDE_MOTION_DEFAULTS,
      revealOneLineAtATime: false,
    }
  }
  const preset = getMotionPreset(presetId)
  const presetSettings = preset.settings || {}
  return {
    motionPreset: preset.id,
    textAnimation: presetSettings.textAnimation ?? SLIDE_MOTION_DEFAULTS.textAnimation,
    textAnimationUnit: presetSettings.textAnimationUnit ?? SLIDE_MOTION_DEFAULTS.textAnimationUnit,
    textAnimationSpeed: presetSettings.textAnimationSpeed ?? SLIDE_MOTION_DEFAULTS.textAnimationSpeed,
    textAnimationStagger: presetSettings.textAnimationStagger ?? SLIDE_MOTION_DEFAULTS.textAnimationStagger,
    textExitAnimation: presetSettings.textExitAnimation ?? SLIDE_MOTION_DEFAULTS.textExitAnimation,
    subtitleDelay: presetSettings.subtitleDelay ?? SLIDE_MOTION_DEFAULTS.subtitleDelay,
    backgroundBlurOnTextEnter: presetSettings.backgroundBlurOnTextEnter ?? SLIDE_MOTION_DEFAULTS.backgroundBlurOnTextEnter,
    graphicAnimationIn: presetSettings.graphicAnimationIn ?? SLIDE_MOTION_DEFAULTS.graphicAnimationIn,
    revealOneLineAtATime: presetSettings.revealOneLineAtATime === true,
  }
}
