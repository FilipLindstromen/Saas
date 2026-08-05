/**
 * User-defined style presets, persisted in localStorage (small text data, unlike
 * generation history — no need for IndexedDB here).
 */
const STORAGE_KEY = 'sketchgen-custom-styles'

export function loadCustomStyles() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function persist(styles) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(styles))
  } catch {
    // ignore quota errors
  }
}

export function addCustomStyle({ name, prompt }) {
  const styles = loadCustomStyles()
  const entry = {
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: name.trim() || 'Custom style',
    emoji: '⭐',
    prompt: prompt.trim(),
    custom: true,
  }
  const next = [...styles, entry]
  persist(next)
  return next
}

export function updateCustomStyle(id, { name, prompt }) {
  const styles = loadCustomStyles()
  const next = styles.map((s) => (s.id === id ? { ...s, name: name.trim() || s.name, prompt: prompt.trim() } : s))
  persist(next)
  return next
}

export function deleteCustomStyle(id) {
  const styles = loadCustomStyles()
  const next = styles.filter((s) => s.id !== id)
  persist(next)
  return next
}
