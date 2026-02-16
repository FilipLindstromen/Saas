import type { AspectRatio, ResolutionOption, QualityPreset, CaptionStyle } from './types'

export const ASPECT_RATIOS: { value: AspectRatio; label: string }[] = [
  { value: '16:9', label: '16:9 (Landscape)' },
  { value: '9:16', label: '9:16 (Portrait)' },
  { value: '1:1', label: '1:1 (Square)' },
]

export function getDimensionsForAspect(
  aspect: AspectRatio,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  const [w, h] = aspect.split(':').map(Number)
  const ratio = w / h
  let width = maxWidth
  let height = maxWidth / ratio
  if (height > maxHeight) {
    height = maxHeight
    width = maxHeight * ratio
  }
  return { width: Math.floor(width), height: Math.floor(height) }
}

const RES_BASE: ResolutionOption[] = [
  { label: '720p', width: 1280, height: 720 },
  { label: '1080p', width: 1920, height: 1080 },
  { label: '1440p', width: 2560, height: 1440 },
  { label: '4K', width: 3840, height: 2160 },
]

export function getResolutionsForAspect(aspect: AspectRatio): ResolutionOption[] {
  if (aspect === '16:9') return RES_BASE
  if (aspect === '9:16') {
    return RES_BASE.map((r) => ({
      label: `${r.height}p`,
      width: r.height,
      height: r.width,
    }))
  }
  // 1:1
  return [
    { label: '720', width: 720, height: 720 },
    { label: '1080', width: 1080, height: 1080 },
    { label: '1440', width: 1440, height: 1440 },
    { label: '2160', width: 2160, height: 2160 },
  ]
}

export const QUALITY_OPTIONS: { value: QualityPreset; label: string; bitrateFactor: number }[] = [
  { value: 'draft', label: 'Draft (small file)', bitrateFactor: 0.4 },
  { value: 'medium', label: 'Medium', bitrateFactor: 0.7 },
  { value: 'high', label: 'High', bitrateFactor: 1 },
  { value: 'max', label: 'Maximum', bitrateFactor: 1.5 },
]

export const CAPTION_STYLES: { value: CaptionStyle; label: string }[] = [
  { value: 'lower-third', label: 'Lower third' },
  { value: 'centered-subtitle', label: 'Centered subtitle' },
  { value: 'karaoke', label: 'Karaoke highlight' },
  { value: 'word-by-word', label: 'Word-by-word' },
  { value: 'minimal', label: 'Minimal' },
  { value: 'bold-block', label: 'Bold block' },
]

export const CAPTION_FONT_SIZES = [
  { value: 18, label: 'Small' },
  { value: 22, label: 'Medium' },
  { value: 26, label: 'Large' },
  { value: 32, label: 'X-Large' },
  { value: 38, label: 'XX-Large' },
] as const
