export type AspectRatio = '16:9' | '9:16' | '1:1'

export type VideoSourceKind = 'camera' | 'screen'

export interface ResolutionOption {
  label: string
  width: number
  height: number
}

export type QualityPreset = 'draft' | 'medium' | 'high' | 'max'

export interface OverlayItem {
  id: string
  type: 'text' | 'image' | 'video' | 'infographic'
  startTime: number
  endTime: number
  // text
  text?: string
  /** Font size as % of video width (e.g. 2.5 = 2.5%). Scales across aspect ratios. */
  fontSizePercent?: number
  /** @deprecated use fontSizePercent; kept for migration */
  fontSize?: number
  fontFamily?: string
  secondaryFont?: string
  /** Character ranges [start, end) that use secondary font */
  secondaryRanges?: { start: number; end: number }[]
  /** Apply bold to the whole overlay text */
  bold?: boolean
  color?: string
  /** Drop shadow behind text */
  dropShadow?: boolean
  /** Background highlight color (e.g. rgba(255,255,0,0.3)); empty = none */
  highlightColor?: string
  x?: number
  y?: number
  // image (aspect ratio preserved via naturalWidth/naturalHeight + imageScale)
  imageDataUrl?: string
  /** URL for image or animated GIF (e.g. from GIPHY); used when imageDataUrl not set */
  imageUrl?: string
  /** Intrinsic dimensions, set when image is chosen */
  naturalWidth?: number
  naturalHeight?: number
  /** Scale factor (e.g. 1 = 100%), used with natural dimensions */
  imageScale?: number
  /** @deprecated use naturalWidth/naturalHeight + imageScale */
  imageWidth?: number
  /** @deprecated use naturalWidth/naturalHeight + imageScale */
  imageHeight?: number
  // video (stock video from Pexels/Pixabay; layout uses naturalWidth/naturalHeight + imageScale, x, y)
  videoUrl?: string
  // infographic (from InfoGraphics generator; animations play when overlay is active)
  infographicProjectId?: string
  infographicProjectName?: string
  /** When true (default), overlay is drawn during recording and included in the exported file. When false, preview-only. */
  burnIntoExport?: boolean
}

/** Saved overlay template for the clip library (no id, startTime, endTime). */
export type LibraryClipPayload = Omit<OverlayItem, 'id' | 'startTime' | 'endTime'>

export interface LibraryClip {
  libraryId: string
  name: string
  payload: LibraryClipPayload
}

/** Safe zone preset for overlay guide (preview only, not exported) */
export type SafeZoneType =
  | 'youtube-9:16'
  | 'youtube-16:9'
  | 'youtube-1:1'
  | 'tiktok'
  | 'instagram'

/** Global in/out animation for all text overlays */
export type OverlayTextAnimation =
  | 'none'
  | 'fade'
  | 'fade-slide-left'
  | 'fade-slide-right'
  | 'fade-slide-up'
  | 'fade-slide-down'

export type CaptionStyle =
  | 'lower-third'
  | 'centered-subtitle'
  | 'karaoke'
  | 'minimal'
  | 'bold-block'
  | 'word-by-word'
  | 'yellow-highlight'