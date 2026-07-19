/** Per-slide motion presets and resolved animation settings. */

export const MOTION_PRESET_OPTIONS = [
  {
    id: 'default',
    label: 'Default',
    description: 'Use deck-wide animation settings from the inspector.',
  },
  {
    id: 'hook',
    label: 'Hook',
    description: 'Punchy word stagger, Ken Burns zoom, subtle background blur reveal.',
    settings: {
      textAnimation: 'words-fade-up',
      textAnimationUnit: 'word',
      textAnimationStagger: 0.05,
      textExitAnimation: 'match-in',
      subtitleDelay: 0.35,
      backgroundScaleAnimation: true,
      backgroundKenBurnsDirection: 'zoom-in',
      backgroundBlurOnTextEnter: true,
      graphicAnimationIn: 'fade-scale',
    },
  },
  {
    id: 'explain',
    label: 'Explain',
    description: 'Calm line reveals with upward fades and slow pan.',
    settings: {
      textAnimation: 'fade-in-up',
      textAnimationUnit: 'sentence',
      textAnimationStagger: 0.18,
      textExitAnimation: 'match-in',
      revealOneLineAtATime: true,
      backgroundScaleAnimation: true,
      backgroundKenBurnsDirection: 'pan-right',
      graphicAnimationIn: 'fade',
    },
  },
  {
    id: 'quote',
    label: 'Quote',
    description: 'Soft fade with delayed subtitle and gentle zoom out.',
    settings: {
      textAnimation: 'fade-in',
      textAnimationUnit: 'sentence',
      textAnimationStagger: 0.22,
      textExitAnimation: 'fade-out',
      subtitleDelay: 0.55,
      backgroundScaleAnimation: true,
      backgroundKenBurnsDirection: 'zoom-out',
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
      backgroundScaleAnimation: true,
      backgroundKenBurnsDirection: 'zoom-in',
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
      backgroundScaleAnimation: false,
      graphicAnimationIn: 'slide-y',
    },
  },
]

export function getMotionPreset(id) {
  return MOTION_PRESET_OPTIONS.find((item) => item.id === id) || MOTION_PRESET_OPTIONS[0]
}

export function resolveMotionSettings(globalSettings = {}, slide = null) {
  const preset = getMotionPreset(slide?.motionPreset || 'default')
  const presetSettings = preset.id === 'default' ? {} : (preset.settings || {})

  const pick = (slideKey, presetKey, globalKey, fallback) => {
    if (slide?.[slideKey] !== undefined && slide?.[slideKey] !== null && slide?.[slideKey] !== '') {
      return slide[slideKey]
    }
    if (presetSettings[presetKey] !== undefined) return presetSettings[presetKey]
    if (globalSettings[globalKey] !== undefined) return globalSettings[globalKey]
    return fallback
  }

  return {
    motionPreset: preset.id,
    textAnimation: pick('textAnimationOverride', 'textAnimation', 'textAnimation', 'none'),
    textAnimationUnit: pick(null, 'textAnimationUnit', 'textAnimationUnit', 'word'),
    textAnimationSpeed: pick(null, 'textAnimationSpeed', 'textAnimationSpeed', 1),
    textAnimationStagger: pick('textAnimationStagger', 'textAnimationStagger', 'textAnimationStagger', 0.07),
    textExitAnimation: pick('textExitAnimationOverride', 'textExitAnimation', 'textExitAnimation', 'match-in'),
    subtitleDelay: pick('subtitleDelay', 'subtitleDelay', 'subtitleDelay', 0),
    backgroundScaleAnimation: slide?.overrideBackgroundScaleAnimation
      ? false
      : pick(null, 'backgroundScaleAnimation', 'backgroundScaleAnimation', false),
    backgroundKenBurnsDirection: pick(
      'backgroundKenBurnsDirection',
      'backgroundKenBurnsDirection',
      'backgroundKenBurnsDirection',
      'zoom-in'
    ),
    backgroundBlurOnTextEnter: pick(
      'backgroundBlurOnTextEnter',
      'backgroundBlurOnTextEnter',
      'backgroundBlurOnTextEnter',
      false
    ),
    graphicAnimationIn: pick('graphicAnimationIn', 'graphicAnimationIn', 'graphicAnimationIn', 'fade-scale'),
    revealOneLineAtATime: slide?.revealOneLineAtATime ?? presetSettings.revealOneLineAtATime ?? false,
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

export function applyMotionPresetToSlide(slide, presetId) {
  const preset = getMotionPreset(presetId)
  if (preset.id === 'default') {
    return {
      motionPreset: 'default',
      textAnimationOverride: undefined,
      textExitAnimationOverride: undefined,
      textAnimationStagger: undefined,
      subtitleDelay: undefined,
      backgroundKenBurnsDirection: undefined,
      backgroundBlurOnTextEnter: undefined,
      graphicAnimationIn: undefined,
    }
  }
  const patch = { motionPreset: preset.id }
  if (preset.settings?.revealOneLineAtATime) patch.revealOneLineAtATime = true
  return patch
}
