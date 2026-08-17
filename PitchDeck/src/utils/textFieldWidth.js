/** Default max-width (% of slide) — same for every layout, used when slide has no textMaxWidth override. */
const DEFAULT_TEXT_MAX_WIDTH = 66.67

export const TEXT_MAX_WIDTH_DEFAULTS = {
  default: DEFAULT_TEXT_MAX_WIDTH,
  right: DEFAULT_TEXT_MAX_WIDTH,
  'left-video': DEFAULT_TEXT_MAX_WIDTH,
  'right-video': DEFAULT_TEXT_MAX_WIDTH,
  centered: DEFAULT_TEXT_MAX_WIDTH,
  bulletpoints: DEFAULT_TEXT_MAX_WIDTH,
  video: DEFAULT_TEXT_MAX_WIDTH,
  section: DEFAULT_TEXT_MAX_WIDTH,
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
