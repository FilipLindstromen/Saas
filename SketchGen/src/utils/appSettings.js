/**
 * Persists tool/generation settings that aren't tied to any specific drawing —
 * pen tool, color, pen/eraser sizes, smoothing/wobble, selected style, instructions text,
 * and variation count. These already carry over when switching between
 * drawings/tabs within a session (they're plain App state, not per-drawing
 * content); this just extends that same behavior across a page reload.
 */
const STORAGE_KEY = 'sketchgen-app-settings'

const DEFAULTS = {
  tool: 'pen',
  color: '#1a1a1a',
  penSize: 6,
  eraserSize: 12,
  smoothing: 0,
  wobble: 0,
  selectedStyleId: null,
  instructions: '',
  variations: 1,
  styleSectionCollapsed: false,
  improveGeneration: false,
}

export function loadAppSettings() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY))
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULTS }
    const merged = { ...DEFAULTS, ...parsed }
    // Migrate legacy single `size` field to separate pen/eraser sizes.
    if (parsed.size != null && parsed.penSize == null && parsed.eraserSize == null) {
      merged.penSize = parsed.size
      merged.eraserSize = parsed.size
    }
    delete merged.size
    return merged
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveAppSettings(values) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(values))
  } catch {
    // ignore quota errors — this is small text/number data, failing soft is fine
  }
}
