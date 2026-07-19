/** Deck-wide and per-slide motion presets with resolved animation settings. */

export const KEN_BURNS_DURATION_S = 10
export const KEN_BURNS_AMOUNT_PCT = 20

export const MOTION_PRESET_OPTIONS = [
  {
    id: 'default',
    label: 'Use deck preset',
    description: 'Inherit the deck motion preset from Motion settings.',
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
      kenBurns: true,
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
      kenBurns: true,
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
      kenBurns: true,
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
      kenBurns: true,
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
      kenBurns: false,
      graphicAnimationIn: 'slide-y',
    },
  },
]

export const DECK_MOTION_PRESET_OPTIONS = [
  {
    id: 'custom',
    label: 'Custom',
    description: 'Fine-tune text, background, and graphic animations below.',
  },
  ...MOTION_PRESET_OPTIONS.filter((item) => item.id !== 'default'),
]

export function getMotionPreset(id) {
  return MOTION_PRESET_OPTIONS.find((item) => item.id === id) || MOTION_PRESET_OPTIONS[0]
}

export function getDeckMotionPreset(id) {
  return DECK_MOTION_PRESET_OPTIONS.find((item) => item.id === id) || DECK_MOTION_PRESET_OPTIONS[0]
}

/** Resolve which named preset applies (deck-wide or per-slide override). */
export function resolveEffectiveMotionPresetId(globalSettings = {}, slide = null) {
  const slidePreset = slide?.motionPreset
  if (slidePreset && slidePreset !== 'default') return slidePreset

  const deckPreset = globalSettings.motionPreset || 'custom'
  if (deckPreset && deckPreset !== 'custom') return deckPreset

  return 'default'
}

export function resolveMotionSettings(globalSettings = {}, slide = null) {
  const effectivePresetId = resolveEffectiveMotionPresetId(globalSettings, slide)
  const preset = getMotionPreset(effectivePresetId)
  const presetSettings = preset.id === 'default' ? {} : (preset.settings || {})

  const pick = (slideKey, presetKey, globalKey, fallback) => {
    if (slide?.[slideKey] !== undefined && slide?.[slideKey] !== null && slide?.[slideKey] !== '') {
      return slide[slideKey]
    }
    if (presetSettings[presetKey] !== undefined) return presetSettings[presetKey]
    if (globalSettings[globalKey] !== undefined) return globalSettings[globalKey]
    return fallback
  }

  const kenBurnsFromGlobal = globalSettings.kenBurns ?? globalSettings.backgroundScaleAnimation ?? false

  return {
    motionPreset: effectivePresetId,
    textAnimation: pick('textAnimationOverride', 'textAnimation', 'textAnimation', 'none'),
    textAnimationUnit: pick(null, 'textAnimationUnit', 'textAnimationUnit', 'word'),
    textAnimationSpeed: pick(null, 'textAnimationSpeed', 'textAnimationSpeed', 1),
    textAnimationStagger: pick('textAnimationStagger', 'textAnimationStagger', 'textAnimationStagger', 0.07),
    textExitAnimation: pick('textExitAnimationOverride', 'textExitAnimation', 'textExitAnimation', 'match-in'),
    subtitleDelay: pick('subtitleDelay', 'subtitleDelay', 'subtitleDelay', 0),
    kenBurns: pick(null, 'kenBurns', 'kenBurns', kenBurnsFromGlobal),
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
  if (presetId === 'default') {
    return {
      motionPreset: 'default',
      revealOneLineAtATime: false,
    }
  }
  const preset = getMotionPreset(presetId)
  const patch = { motionPreset: preset.id }
  if (preset.settings?.revealOneLineAtATime) patch.revealOneLineAtATime = true
  return patch
}
