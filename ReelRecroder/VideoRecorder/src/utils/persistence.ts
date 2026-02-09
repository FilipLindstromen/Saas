import type { AspectRatio, CaptionStyle, OverlayItem, OverlayTextAnimation, QualityPreset, VideoSourceKind } from '../types'

const STORAGE_KEY = 'videoRecorderState'

const TEXT_ANIMATIONS: OverlayTextAnimation[] = ['none', 'fade', 'fade-slide-left', 'fade-slide-right', 'fade-slide-up', 'fade-slide-down']

const CAPTION_STYLES: CaptionStyle[] = ['lower-third', 'centered-subtitle', 'karaoke', 'minimal', 'bold-block']

export interface PersistedState {
  videoKind: VideoSourceKind
  videoDeviceId: string
  audioDeviceId: string
  aspectRatio: AspectRatio
  resolutionIndex: number
  quality: QualityPreset
  portraitFillHeight: boolean
  studioQuality: boolean
  overlays: OverlayItem[]
  overlayTextAnimation: OverlayTextAnimation
  captionPreviewStyle: CaptionStyle
  /** Caption font size as % of video width (e.g. 2 = 2%) */
  captionPreviewFontSizePercent: number
  captionPreviewCaptionY: number
  userTimelineDuration: number | null
  /** Timeline panel height in px (resizable by user) */
  timelineHeight: number
  /** Inspector panel width in px (resizable by user) */
  inspectorWidth: number
  defaultFontFamily: string
  defaultSecondaryFont: string
  defaultBold: boolean
  /** When true, overlays are burned into recording and export; when false, preview-only */
  burnOverlaysIntoExport: boolean
  /** When true, video is mirrored horizontally (flip) in preview and recording */
  flipVideo: boolean
  /** When true, show/apply camera color adjustments in preview and export (never in raw recording) */
  colorAdjustmentsEnabled: boolean
  /** 100 = normal. Used for preview display and export when enabled. */
  colorBrightness: number
  colorContrast: number
  colorSaturation: number
}

const defaults: PersistedState = {
  videoKind: 'camera',
  videoDeviceId: '',
  audioDeviceId: '',
  aspectRatio: '16:9',
  resolutionIndex: 0,
  quality: 'high',
  portraitFillHeight: false,
  studioQuality: false,
  overlays: [],
  overlayTextAnimation: 'fade',
  captionPreviewStyle: 'lower-third',
  captionPreviewFontSizePercent: 2,
  captionPreviewCaptionY: 0.85,
  userTimelineDuration: null,
  timelineHeight: 220,
  defaultFontFamily: 'Oswald',
  defaultSecondaryFont: 'Playfair Display',
  defaultBold: false,
  burnOverlaysIntoExport: true,
  flipVideo: false,
}

function normalizeOverlayItem(raw: unknown): OverlayItem | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Record<string, unknown>
  const id = typeof item.id === 'string' ? item.id : ''
  const type = item.type === 'text' || item.type === 'image' ? item.type : null
  const startTime = typeof item.startTime === 'number' ? item.startTime : 0
  const endTime = typeof item.endTime === 'number' ? item.endTime : 0
  if (!id || !type || endTime <= startTime) return null

  const num = (v: unknown): number | undefined =>
    typeof v === 'number' && Number.isFinite(v) ? v : undefined
  const str = (v: unknown): string | undefined =>
    typeof v === 'string' ? v : undefined
  const bool = (v: unknown): boolean | undefined =>
    typeof v === 'boolean' ? v : undefined
  const arr = (v: unknown, fn: (x: unknown) => { start: number; end: number } | null): { start: number; end: number }[] | undefined => {
    if (!Array.isArray(v)) return undefined
    const out = v.map(fn).filter((x): x is { start: number; end: number } => x != null)
    return out.length > 0 ? out : undefined
  }
  const range = (x: unknown) => {
    if (!x || typeof x !== 'object') return null
    const r = x as Record<string, unknown>
    const start = typeof r.start === 'number' ? r.start : 0
    const end = typeof r.end === 'number' ? r.end : 0
    return { start, end }
  }

  const fontSize = num(item.fontSize)
  const fontSizePercent = num(item.fontSizePercent)
  const overlay: OverlayItem = {
    id,
    type,
    startTime,
    endTime,
    text: str(item.text),
    fontSizePercent: fontSizePercent ?? (fontSize != null ? (fontSize / 1280) * 100 : undefined),
    fontSize,
    fontFamily: str(item.fontFamily),
    secondaryFont: str(item.secondaryFont),
    secondaryRanges: arr(item.secondaryRanges, range),
    bold: bool(item.bold),
    color: str(item.color),
    dropShadow: bool(item.dropShadow),
    highlightColor: str(item.highlightColor),
    x: num(item.x),
    y: num(item.y),
    imageDataUrl: str(item.imageDataUrl),
    naturalWidth: num(item.naturalWidth),
    naturalHeight: num(item.naturalHeight),
    imageScale: num(item.imageScale),
    imageWidth: num(item.imageWidth),
    imageHeight: num(item.imageHeight),
    burnIntoExport: bool(item.burnIntoExport) ?? true,
  }
  return overlay
}

function validateState(raw: unknown): PersistedState | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const aspectRatios: AspectRatio[] = ['16:9', '9:16', '1:1']
  const qualities: QualityPreset[] = ['draft', 'medium', 'high', 'max']
  const videoKinds: VideoSourceKind[] = ['camera', 'screen']
  return {
    videoKind: videoKinds.includes(o.videoKind as VideoSourceKind) ? (o.videoKind as VideoSourceKind) : defaults.videoKind,
    videoDeviceId: typeof o.videoDeviceId === 'string' ? o.videoDeviceId : defaults.videoDeviceId,
    audioDeviceId: typeof o.audioDeviceId === 'string' ? o.audioDeviceId : defaults.audioDeviceId,
    aspectRatio: aspectRatios.includes(o.aspectRatio as AspectRatio) ? (o.aspectRatio as AspectRatio) : defaults.aspectRatio,
    resolutionIndex: typeof o.resolutionIndex === 'number' && Number.isInteger(o.resolutionIndex) && o.resolutionIndex >= 0 ? o.resolutionIndex : defaults.resolutionIndex,
    quality: qualities.includes(o.quality as QualityPreset) ? (o.quality as QualityPreset) : defaults.quality,
    portraitFillHeight: typeof o.portraitFillHeight === 'boolean' ? o.portraitFillHeight : defaults.portraitFillHeight,
    studioQuality: typeof o.studioQuality === 'boolean' ? o.studioQuality : defaults.studioQuality,
    overlays: Array.isArray(o.overlays)
      ? o.overlays.map(normalizeOverlayItem).filter((x): x is OverlayItem => x != null)
      : defaults.overlays,
    overlayTextAnimation: TEXT_ANIMATIONS.includes(o.overlayTextAnimation as OverlayTextAnimation)
      ? (o.overlayTextAnimation as OverlayTextAnimation)
      : defaults.overlayTextAnimation,
    captionPreviewStyle: CAPTION_STYLES.includes(o.captionPreviewStyle as CaptionStyle)
      ? (o.captionPreviewStyle as CaptionStyle)
      : defaults.captionPreviewStyle,
    captionPreviewFontSizePercent:
      typeof o.captionPreviewFontSizePercent === 'number' && Number.isFinite(o.captionPreviewFontSizePercent) && o.captionPreviewFontSizePercent >= 0.5 && o.captionPreviewFontSizePercent <= 10
        ? o.captionPreviewFontSizePercent
        : typeof o.captionPreviewFontSize === 'number' && Number.isFinite(o.captionPreviewFontSize)
          ? Math.max(0.5, Math.min(50, (o.captionPreviewFontSize / 1280) * 100))
          : defaults.captionPreviewFontSizePercent,
    captionPreviewCaptionY:
      typeof o.captionPreviewCaptionY === 'number' && Number.isFinite(o.captionPreviewCaptionY)
        ? Math.max(0, Math.min(1, o.captionPreviewCaptionY))
        : defaults.captionPreviewCaptionY,
    userTimelineDuration:
      o.userTimelineDuration != null && typeof o.userTimelineDuration === 'number' && Number.isFinite(o.userTimelineDuration) && o.userTimelineDuration >= 1 && o.userTimelineDuration <= 600
        ? o.userTimelineDuration
        : defaults.userTimelineDuration,
    timelineHeight:
      typeof o.timelineHeight === 'number' && Number.isFinite(o.timelineHeight) && o.timelineHeight >= 120 && o.timelineHeight <= 600
        ? o.timelineHeight
        : defaults.timelineHeight,
    inspectorWidth:
      typeof o.inspectorWidth === 'number' && Number.isFinite(o.inspectorWidth) && o.inspectorWidth >= 200 && o.inspectorWidth <= 560
        ? o.inspectorWidth
        : defaults.inspectorWidth,
    defaultFontFamily: typeof o.defaultFontFamily === 'string' && o.defaultFontFamily.trim() ? o.defaultFontFamily : defaults.defaultFontFamily,
    defaultSecondaryFont: typeof o.defaultSecondaryFont === 'string' && o.defaultSecondaryFont.trim() ? o.defaultSecondaryFont : defaults.defaultSecondaryFont,
    defaultBold: typeof o.defaultBold === 'boolean' ? o.defaultBold : defaults.defaultBold,
    burnOverlaysIntoExport: typeof o.burnOverlaysIntoExport === 'boolean' ? o.burnOverlaysIntoExport : defaults.burnOverlaysIntoExport,
    flipVideo: typeof o.flipVideo === 'boolean' ? o.flipVideo : defaults.flipVideo,
    colorAdjustmentsEnabled: typeof o.colorAdjustmentsEnabled === 'boolean' ? o.colorAdjustmentsEnabled : defaults.colorAdjustmentsEnabled,
    colorBrightness: typeof o.colorBrightness === 'number' && Number.isFinite(o.colorBrightness) ? Math.max(0, Math.min(200, o.colorBrightness)) : defaults.colorBrightness,
    colorContrast: typeof o.colorContrast === 'number' && Number.isFinite(o.colorContrast) ? Math.max(0, Math.min(200, o.colorContrast)) : defaults.colorContrast,
    colorSaturation: typeof o.colorSaturation === 'number' && Number.isFinite(o.colorSaturation) ? Math.max(0, Math.min(200, o.colorSaturation)) : defaults.colorSaturation,
  }
}

export function loadVideoRecorderState(): PersistedState | null {
  if (typeof window === 'undefined' || !window.localStorage) return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return validateState(JSON.parse(raw))
  } catch {
    return null
  }
}

export function saveVideoRecorderState(state: PersistedState): void {
  if (typeof window === 'undefined' || !window.localStorage) return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (e) {
    console.warn('Could not save video recorder state:', e)
  }
}
