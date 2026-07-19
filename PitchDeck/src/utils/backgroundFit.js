import { KEN_BURNS_AMOUNT_PCT, KEN_BURNS_DURATION_S } from './motionPresets'

/** Default background scale when the user has not customized it. */
export const DEFAULT_IMAGE_SCALE = 1.0

export { KEN_BURNS_AMOUNT_PCT, KEN_BURNS_DURATION_S }

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
export function getFrozenBackgroundScaleSize(slide, backgroundScaleAmount = KEN_BURNS_AMOUNT_PCT, progress = 0) {
  const vars = getBackgroundScaleAnimationVars(slide, backgroundScaleAmount)
  return interpolateBackgroundSize(vars['--initial-scale'], vars['--final-scale'], progress)
}

/** Progress 0–1 for Ken Burns based on time spent on the current slide. */
export function getBackgroundScaleProgress(elapsedMs, durationSeconds = KEN_BURNS_DURATION_S) {
  const durationMs = Math.max(1, (durationSeconds || KEN_BURNS_DURATION_S) * 1000)
  return Math.min(1, Math.max(0, elapsedMs / durationMs))
}

/** True when this slide should use Ken Burns background animation in play mode. */
export function shouldAnimateBackgroundScale(slide, kenBurns = false) {
  return !!(kenBurns && slide)
}

/** CSS custom properties for Ken Burns-style background animation. */
export function getBackgroundScaleAnimationVars(slide, backgroundScaleAmount = KEN_BURNS_AMOUNT_PCT, direction = 'zoom-in') {
  const x = slide?.imagePositionX !== undefined ? slide.imagePositionX : 50
  const y = slide?.imagePositionY !== undefined ? slide.imagePositionY : 50
  const grow = Math.max(0, backgroundScaleAmount || 20)

  const positionPair = (dx = 0, dy = 0) => ({
    '--initial-position': `${Math.max(0, Math.min(100, x + dx))}% ${Math.max(0, Math.min(100, y + dy))}%`,
    '--final-position': `${Math.max(0, Math.min(100, x - dx))}% ${Math.max(0, Math.min(100, y - dy))}%`,
  })

  if (!isImageScaleCustomized(slide)) {
    const initial = 'auto 100%'
    const final = `auto ${100 + grow}%`
    switch (direction) {
      case 'zoom-out':
        return {
          '--initial-scale': final,
          '--final-scale': initial,
          '--initial-position': `${x}% ${y}%`,
          '--final-position': `${x}% ${y}%`,
        }
      case 'pan-left':
        return { '--initial-scale': initial, '--final-scale': final, ...positionPair(8, 0) }
      case 'pan-right':
        return { '--initial-scale': initial, '--final-scale': final, ...positionPair(-8, 0) }
      case 'pan-up':
        return { '--initial-scale': initial, '--final-scale': final, ...positionPair(0, 6) }
      case 'pan-down':
        return { '--initial-scale': initial, '--final-scale': final, ...positionPair(0, -6) }
      case 'zoom-in':
      default:
        return {
          '--initial-scale': initial,
          '--final-scale': final,
          '--initial-position': `${x}% ${y}%`,
          '--final-position': `${x}% ${y}%`,
        }
    }
  }

  const scale = slide.imageScale !== undefined ? slide.imageScale : DEFAULT_IMAGE_SCALE
  const pct = scale * 100
  const initialUniform = `${pct}%`
  const finalUniform = `${pct + grow}%`

  switch (direction) {
    case 'zoom-out':
      return {
        '--initial-scale': finalUniform,
        '--final-scale': initialUniform,
        '--initial-position': `${x}% ${y}%`,
        '--final-position': `${x}% ${y}%`,
      }
    case 'pan-left':
      return { '--initial-scale': initialUniform, '--final-scale': finalUniform, ...positionPair(8, 0) }
    case 'pan-right':
      return { '--initial-scale': initialUniform, '--final-scale': finalUniform, ...positionPair(-8, 0) }
    case 'pan-up':
      return { '--initial-scale': initialUniform, '--final-scale': finalUniform, ...positionPair(0, 6) }
    case 'pan-down':
      return { '--initial-scale': initialUniform, '--final-scale': finalUniform, ...positionPair(0, -6) }
    default:
      return {
        '--initial-scale': initialUniform,
        '--final-scale': finalUniform,
        '--initial-position': `${x}% ${y}%`,
        '--final-position': `${x}% ${y}%`,
      }
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
