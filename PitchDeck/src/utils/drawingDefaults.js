export const DEFAULT_DRAWING_PEN_COLORS = ['#ffffff', '#ef4444', '#3b82f6', '#22c55e', '#facc15']

export const DRAWING_BRUSH_MIN = 2
export const DRAWING_BRUSH_MAX = 48
export const DEFAULT_DRAWING_BRUSH_SIZE = 8
export const DEFAULT_DRAWING_SMOOTHING = 0
export const DEFAULT_DRAWING_WOBBLE = 0
export const DRAWING_HISTORY_MAX = 32

export function normalizeDrawingPenColors(colors) {
  if (!Array.isArray(colors) || colors.length === 0) return [...DEFAULT_DRAWING_PEN_COLORS]
  const out = colors
    .map((c) => String(c || '').trim())
    .filter((c) => /^#[0-9A-Fa-f]{6}$/.test(c))
    .slice(0, 8)
  return out.length ? out : [...DEFAULT_DRAWING_PEN_COLORS]
}
