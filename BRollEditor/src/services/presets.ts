import type { CaptionSettings, Preset } from '../types'

const KEY = 'brollEditor.presets'

// Presets live outside any one project (plain localStorage, not project state) because their
// whole point is staying consistent ACROSS videos/projects, not being tied to one.
export function loadPresets(): Preset[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function persist(presets: Preset[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(presets))
  } catch {
    // ignore quota errors
  }
}

export function savePreset(name: string, captions: CaptionSettings, brandColor: string): Preset[] {
  const preset: Preset = {
    id: `preset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    captions,
    brandColor,
  }
  const next = [...loadPresets(), preset]
  persist(next)
  return next
}

export function deletePreset(id: string): Preset[] {
  const next = loadPresets().filter((p) => p.id !== id)
  persist(next)
  return next
}
