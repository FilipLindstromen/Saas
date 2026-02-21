/**
 * In/out animation options for infographic elements.
 * Used in InfoGraphics inspector and PitchDeck InfographicBackground.
 */
export const ANIMATION_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'fade', label: 'Fade' },
  { value: 'fade-scale', label: 'Fade + scale' },
  { value: 'fade-move-x', label: 'Fade + move X (left)' },
  { value: 'fade-move-x-reverse', label: 'Fade + move X (right)' },
  { value: 'fade-move-y', label: 'Fade + move Y (top)' },
  { value: 'fade-move-y-reverse', label: 'Fade + move Y (bottom)' },
  { value: 'scale', label: 'Scale' },
  { value: 'slide-x', label: 'Slide X (left)' },
  { value: 'slide-x-reverse', label: 'Slide X (right)' },
  { value: 'slide-y', label: 'Slide Y (top)' },
  { value: 'slide-y-reverse', label: 'Slide Y (bottom)' }
]

export const ANIMATION_DURATION = 0.5 // seconds
