/** Default max-width (% of slide) per layout — used when slide has no textMaxWidth override. */
export const TEXT_MAX_WIDTH_DEFAULTS = {
  default: 66.67,
  right: 66.67,
  'left-video': 45,
  'right-video': 45,
  centered: 85,
  bulletpoints: 66.67,
  video: 66.67,
  section: 100,
}

export function getDefaultTextMaxWidth(layout) {
  const key = layout === 'title' ? 'centered' : (layout || 'default')
  return TEXT_MAX_WIDTH_DEFAULTS[key] ?? 66.67
}

/** Per-slide text max-width (% of slide). Falls back to layout default. */
export function getSlideTextMaxWidth(slide) {
  if (slide?.textMaxWidth != null && Number.isFinite(Number(slide.textMaxWidth))) {
    return Number(slide.textMaxWidth)
  }
  return getDefaultTextMaxWidth(slide?.layout)
}

export function clampTextMaxWidth(value) {
  return Math.min(95, Math.max(20, Math.round(value * 10) / 10))
}
