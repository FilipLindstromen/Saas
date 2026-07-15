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

/** Interpolate between two CSS background-size values at progress 0–1. */
export function interpolateBackgroundSize(initial, final, progress) {
  const t = Math.min(1, Math.max(0, progress))
  const parse = (value) => {
    const str = String(value).trim()
    if (str.startsWith('auto ')) {
      return { mode: 'auto-height', heightPct: parseFloat(str.slice(5)) || 100 }
    }
    return { mode: 'uniform', pct: parseFloat(str) || 100 }
  }
  const a = parse(initial)
  const b = parse(final)
  if (a.mode === 'auto-height' && b.mode === 'auto-height') {
    const h = a.heightPct + (b.heightPct - a.heightPct) * t
    return `auto ${h}%`
  }
  if (a.mode === 'uniform' && b.mode === 'uniform') {
    const p = a.pct + (b.pct - a.pct) * t
    return `${p}%`
  }
  return t >= 1 ? final : initial
}

/** Ken Burns background-size frozen at a point in the animation (0 = start, 1 = end). */
export function getFrozenBackgroundScaleSize(slide, backgroundScaleAmount = 20, progress = 0) {
  const vars = getBackgroundScaleAnimationVars(slide, backgroundScaleAmount)
  return interpolateBackgroundSize(vars['--initial-scale'], vars['--final-scale'], progress)
}

/** Progress 0–1 for Ken Burns based on time spent on the current slide. */
export function getBackgroundScaleProgress(elapsedMs, durationSeconds = 10) {
  const durationMs = Math.max(1, (durationSeconds || 10) * 1000)
  return Math.min(1, Math.max(0, elapsedMs / durationMs))
}

/** True when this slide should use Ken Burns background scale animation in play mode. */
export function shouldAnimateBackgroundScale(slide, backgroundScaleAnimation = false) {
  return !!(backgroundScaleAnimation && slide && !slide.overrideBackgroundScaleAnimation)
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
