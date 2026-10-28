export type Word = { text: string; startMs: number; endMs: number }

export type BRollSource = 'pexels' | 'pixabay' | 'unsplash' | 'upload' | 'color'

export type BRoll = {
  type: 'video' | 'image' | 'color'
  // For type 'color', this holds the hex color itself (e.g. "#1a2b3c") rather than a media URL —
  // thumbnailUrl mirrors it so a swatch can be drawn the same way a video/image thumbnail is.
  url: string
  thumbnailUrl: string
  source: BRollSource
  kenBurns: boolean
  /** How THIS clip hands off from whatever played before it — a property of the clip, not the
   * whole project, so different scenes can use different transitions. */
  transition: BRollTransition
}

export type Line = {
  id: string
  text: string
  startMs: number
  endMs: number
  broll: BRoll | null
}

/** A range of the ORIGINAL audio (pre-cut time) that's removed from the final timeline. */
export type Cut = { id: string; startMs: number; endMs: number }

/**
 * A held pause inserted after a specific line — the mirror image of a Cut: instead of removing
 * time, it inserts `durationMs` of extra time into the timeline at that point. Both the audio
 * (silence) and the b-roll (the previous clip held on screen) shift everything after it later
 * by the same amount, keeping narration and b-roll in sync once playback resumes.
 */
export type Delay = { id: string; afterLineId: string; durationMs: number }

export type AspectRatio = '16:9' | '1:1' | '9:16'
export type Quality = 'draft' | 'standard' | 'high'

export type CaptionStyle = 'subtitle' | 'lower-third' | 'bold-center' | 'top-banner'
export type CaptionAnimation = 'none' | 'fade' | 'pop' | 'slide-up'
export type CaptionFont =
  | 'system' | 'arial' | 'georgia' | 'courier' | 'impact' | 'verdana'
  | 'montserrat' | 'poppins' | 'oswald' | 'playfair' | 'bebasneue' | 'anton' | 'roboto' | 'lato' | 'inter' | 'dmsans'

export type CaptionSettings = {
  enabled: boolean
  style: CaptionStyle
  font: CaptionFont
  sizePct: number
  animation: CaptionAnimation
  /** How long the enter/exit animation takes, in ms. */
  animationSpeedMs: number
  /** Show one word at a time, timed to when it's actually spoken, instead of the whole line at once. */
  wordByWord: boolean
}

// Labels only — kept separate from the actual font CSS/loading (see remotion/googleFonts.ts)
// so components that just need the dropdown list (e.g. CaptionsPanel) don't have to pull in
// the google-fonts package, which is only needed inside the actual render/preview composition.
export const CAPTION_FONT_LABELS: Record<CaptionFont, string> = {
  system: 'System',
  arial: 'Arial',
  georgia: 'Georgia',
  courier: 'Courier New',
  impact: 'Impact',
  verdana: 'Verdana',
  montserrat: 'Montserrat',
  poppins: 'Poppins',
  oswald: 'Oswald',
  playfair: 'Playfair Display',
  bebasneue: 'Bebas Neue',
  anton: 'Anton',
  roboto: 'Roboto',
  lato: 'Lato',
  inter: 'Inter',
  dmsans: 'DM Sans',
}

// The 6 web-safe fonts above need no loading — this is the CSS-only registry CaptionLayer
// falls back to for those; Google Fonts resolve through remotion/googleFonts.ts instead.
export const SYSTEM_CAPTION_FONT_CSS: Partial<Record<CaptionFont, string>> = {
  system: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  arial: 'Arial, Helvetica, sans-serif',
  georgia: 'Georgia, "Times New Roman", serif',
  courier: '"Courier New", Courier, monospace',
  impact: 'Impact, "Arial Black", sans-serif',
  verdana: 'Verdana, Geneva, sans-serif',
}

export function createDefaultCaptionSettings(): CaptionSettings {
  return { enabled: false, style: 'subtitle', font: 'system', sizePct: 6, animation: 'fade', animationSpeedMs: 300, wordByWord: false }
}

/** How a b-roll clip hands off from whatever played before it — 'cut' (the default) is an
 * instant hard cut; the others blend the outgoing and incoming clip over a short fixed window. */
export type BRollTransition = 'cut' | 'crossfade' | 'whip-pan'
export const DEFAULT_BROLL_TRANSITION: BRollTransition = 'cut'

export type MusicTrack = {
  url: string | null
  /** 0–1 final mix level when narration ISN'T playing (or always, if ducking is off). */
  volume: number
  /** Automatically duck the music under narration and bring it back up in the gaps. */
  ducking: boolean
}

export function createDefaultMusic(): MusicTrack {
  return { url: null, volume: 0.25, ducking: true }
}

/** A saved caption style + brand color combo, so a creator's videos can share a consistent look
 * without re-configuring captions and re-picking a color background on every project. */
export type Preset = { id: string; name: string; captions: CaptionSettings; brandColor: string }

export type Project = {
  audioUrl: string | null
  audioDurationMs: number
  words: Word[]
  lines: Line[]
  cuts: Cut[]
  delays: Delay[]
  aspectRatio: AspectRatio
  quality: Quality
  scriptNotes: string
  captions: CaptionSettings
  studioSound: boolean
  music: MusicTrack
  /** Last-used/preferred brand color, surfaced as a quick pick in the b-roll color swatches. */
  brandColor: string | null
}

export function createEmptyProject(): Project {
  return {
    audioUrl: null,
    audioDurationMs: 0,
    words: [],
    lines: [],
    cuts: [],
    delays: [],
    aspectRatio: '16:9',
    quality: 'high',
    scriptNotes: '',
    captions: createDefaultCaptionSettings(),
    studioSound: false,
    music: createDefaultMusic(),
    brandColor: null,
  }
}

export const ASPECT_RATIO_SIZES: Record<AspectRatio, { width: number; height: number }> = {
  '16:9': { width: 1920, height: 1080 },
  '1:1': { width: 1080, height: 1080 },
  '9:16': { width: 1080, height: 1920 },
}

export const FPS = 30
export const COMPOSITION_ID = 'BRoll'

export type SearchSourceToggles = {
  pexels: boolean
  pixabay: boolean
  unsplash: boolean
  video: boolean
  image: boolean
}

export type StockResult = {
  id: string
  type: 'video' | 'image' | 'color'
  source: BRollSource
  url: string
  thumbnailUrl: string
}

export type RenderJob = {
  status: 'queued' | 'rendering' | 'done' | 'error'
  progress: number
  url?: string
  error?: string
}
