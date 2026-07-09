/** Default background scale when the user has not customized it. */
export const DEFAULT_IMAGE_SCALE = 1.0

/** True when the user has manually set scale (slider, Fill Screen, or non-default saved value). */
export function isImageScaleCustomized(slide) {
  if (!slide) return false
  if (slide.imageScaleCustomized === true) return true
  const scale = slide.imageScale !== undefined ? slide.imageScale : DEFAULT_IMAGE_SCALE
  return Math.abs(scale - DEFAULT_IMAGE_SCALE) > 0.001
}

/** CSS background-size for slide image backgrounds. Auto mode fits height in every format. */
export function getImageBackgroundSize(slide) {
  if (isImageScaleCustomized(slide)) {
    const scale = slide.imageScale !== undefined ? slide.imageScale : DEFAULT_IMAGE_SCALE
    return `${scale * 100}%`
  }
  return 'auto 100%'
}

/** CSS custom properties for Ken Burns-style background scale animation. */
export function getBackgroundScaleAnimationVars(slide, backgroundScaleAmount = 20) {
  if (!isImageScaleCustomized(slide)) {
    const grow = Math.max(0, backgroundScaleAmount || 20)
    return {
      '--initial-scale': 'auto 100%',
      '--final-scale': `auto ${100 + grow}%`,
    }
  }
  const scale = slide.imageScale !== undefined ? slide.imageScale : DEFAULT_IMAGE_SCALE
  const pct = scale * 100
  return {
    '--initial-scale': `${pct}%`,
    '--final-scale': `${pct + (backgroundScaleAmount || 20)}%`,
  }
}

/** Inline styles for background video elements. */
export function getVideoBackgroundStyle(slide, position, flipHorizontal = false) {
  const { x, y } = position
  if (isImageScaleCustomized(slide)) {
    const scale = slide.imageScale !== undefined ? slide.imageScale : DEFAULT_IMAGE_SCALE
    return {
      objectFit: 'cover',
      objectPosition: `${x}% ${y}%`,
      transform: `${flipHorizontal ? 'scaleX(-1) ' : ''}scale(${scale})`,
      transformOrigin: `${x}% ${y}%`,
      width: '100%',
      height: '100%',
    }
  }
  return {
    objectFit: 'cover',
    objectPosition: `${x}% ${y}%`,
    height: '100%',
    width: 'auto',
    minWidth: '100%',
    maxWidth: 'none',
    display: 'block',
    margin: '0 auto',
    transform: flipHorizontal ? 'scaleX(-1)' : 'none',
  }
}

/** Infographic canvas scale: fit height when auto, contain when customized. */
export function getInfographicContainScale(containerW, containerH, canvasW, canvasH, slide) {
  if (!containerW || !containerH || !canvasW || !canvasH) return 1
  const imageScale = slide?.imageScale !== undefined ? slide.imageScale : DEFAULT_IMAGE_SCALE
  if (isImageScaleCustomized(slide)) {
    return Math.min(containerW / canvasW, containerH / canvasH) * imageScale
  }
  return (containerH / canvasH) * imageScale
}
