/** Sub-slide regions on a slide (camera zoom targets in present mode). */

export const SUB_SLIDE_MIN_SIZE = 8
export const SUB_SLIDE_CAMERA_MS = 700

export function getSubSlides(slide) {
  if (!slide || !Array.isArray(slide.subSlides)) return []
  return slide.subSlides.filter(
    (item) => item && typeof item.width === 'number' && typeof item.height === 'number'
      && item.width >= SUB_SLIDE_MIN_SIZE && item.height >= SUB_SLIDE_MIN_SIZE
  )
}

export function createSubSlide(index = 0) {
  const offset = (index % 3) * 6
  return {
    id: `ss${Date.now()}-${index}`,
    x: 50 + offset,
    y: 45 + offset,
    width: 38,
    height: 28,
  }
}

export function getSubSlideCameraStyle(rect, durationMs = SUB_SLIDE_CAMERA_MS) {
  if (!rect) {
    return {
      transform: 'none',
      transformOrigin: '50% 50%',
      transition: `transform ${durationMs}ms cubic-bezier(0.4, 0, 0.2, 1), transform-origin ${durationMs}ms cubic-bezier(0.4, 0, 0.2, 1)`,
    }
  }

  const x = rect.x ?? 50
  const y = rect.y ?? 50
  const width = Math.max(SUB_SLIDE_MIN_SIZE, rect.width ?? 40)
  const height = Math.max(SUB_SLIDE_MIN_SIZE, rect.height ?? 30)
  const scale = Math.min(100 / width, 100 / height)

  return {
    transform: `scale(${scale})`,
    transformOrigin: `${x}% ${y}%`,
    transition: `transform ${durationMs}ms cubic-bezier(0.4, 0, 0.2, 1), transform-origin ${durationMs}ms cubic-bezier(0.4, 0, 0.2, 1)`,
  }
}

export function getActiveSubSlideRect(slide, subSlideIndex) {
  const subSlides = getSubSlides(slide)
  if (subSlideIndex < 0 || subSlideIndex >= subSlides.length) return null
  return subSlides[subSlideIndex]
}
