import type { CaptionStyle, CaptionAnimation } from './types'

export const CAPTION_STYLES: { value: CaptionStyle; label: string }[] = [
  { value: 'lower-third', label: 'Lower third' },
  { value: 'centered-subtitle', label: 'Centered subtitle' },
  { value: 'karaoke', label: 'Karaoke highlight' },
  { value: 'word-by-word', label: 'Word by word' },
  { value: 'minimal', label: 'Minimal' },
  { value: 'bold-block', label: 'Bold block' },
  { value: 'yellow-highlight', label: 'Yellow highlight' },
  { value: 'outline', label: 'Outline' },
  { value: 'box-top', label: 'Box top' },
  { value: 'typewriter', label: 'Typewriter' },
]

export const CAPTION_ANIMATIONS: { value: CaptionAnimation; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'fade', label: 'Fade' },
  { value: 'fade-slide-left', label: 'Fade + slide left' },
  { value: 'fade-slide-right', label: 'Fade + slide right' },
  { value: 'fade-slide-up', label: 'Fade + slide up' },
  { value: 'fade-slide-down', label: 'Fade + slide down' },
  { value: 'scale-in', label: 'Scale in' },
  { value: 'scale-out', label: 'Scale out' },
  { value: 'slide-from-bottom', label: 'Slide from bottom' },
  { value: 'bounce', label: 'Bounce' },
]

/** Google Fonts available in the app (loaded in index.html) */
export const GOOGLE_FONTS = [
  'Oswald',
  'Playfair Display',
  'DM Sans',
  'Inter',
  'Roboto',
  'Open Sans',
  'Montserrat',
  'Lato',
  'Poppins',
  'Source Sans 3',
] as const

export type GoogleFontName = (typeof GOOGLE_FONTS)[number]

export const FONT_SIZE_MIN = 1
export const FONT_SIZE_MAX = 6
export const FONT_SIZE_DEFAULT = 2.5
