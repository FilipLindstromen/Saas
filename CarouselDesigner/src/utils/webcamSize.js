const LEGACY_WEBCAM_SIZE_PERCENT = {
  small: 15,
  medium: 20,
  large: 25,
}

/** Normalize webcam size to 1–100 (% of slide height). Accepts legacy small/medium/large strings. */
export function normalizeWebcamSizePercent(value) {
  if (typeof value === 'string' && LEGACY_WEBCAM_SIZE_PERCENT[value]) {
    return LEGACY_WEBCAM_SIZE_PERCENT[value]
  }
  const n = typeof value === 'number' ? value : parseFloat(value)
  if (!Number.isFinite(n)) return 20
  return Math.min(100, Math.max(1, Math.round(n)))
}

/** Circle/corner webcam positions use the size slider; panels and fullscreen do not. */
export function usesWebcamSizeSlider(layout, cameraOverrideEnabled = false, cameraOverridePosition = 'fullscreen') {
  if (cameraOverrideEnabled) {
    const pos = cameraOverridePosition || 'fullscreen'
    return pos.startsWith('circle-')
  }
  const l = layout || 'default'
  return !['video', 'left-video', 'right-video'].includes(l)
}

/** CSS size for edit/preview circle webcams (% of slide height, square). */
export function getWebcamCircleSizeStyle(webcamSize) {
  const pct = normalizeWebcamSizePercent(webcamSize)
  return {
    height: `${pct}%`,
    width: 'auto',
    minWidth: 0,
    minHeight: 0,
  }
}

/** Pixel dimensions for present-mode circle webcams. */
export function getWebcamCirclePixelSize(canvasHeight, webcamSize) {
  const pct = normalizeWebcamSizePercent(webcamSize) / 100
  const size = canvasHeight * pct
  return { width: size, height: size }
}
