/**
 * Persists tool/generation settings that aren't tied to any specific drawing —
 * pen tool, color, size, smoothing/wobble, selected style, instructions text,
 * and variation count. These already carry over when switching between
 * drawings/tabs within a session (they're plain App state, not per-drawing
 * content); this just extends that same behavior across a page reload.
 */
const STORAGE_KEY = 'sketchgen-app-settings'

const DEFAULTS = {
  tool: 'pen',
  color: '#1a1a1a',
  size: 6,
  smoothing: 0,
  wobble: 0,
  selectedStyleId: null,
  instructions: '',
  variations: 1,
}

export function loadAppSettings() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY))
    return { ...DEFAULTS, ...(parsed && typeof parsed === 'object' ? parsed : {}) }
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
