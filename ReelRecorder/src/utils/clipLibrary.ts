import type { LibraryClip } from '../types'

const STORAGE_KEY = 'videorecorder-clip-library'

export function getClipLibrary(): LibraryClip[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (item): item is LibraryClip =>
        item &&
        typeof item === 'object' &&
        typeof (item as LibraryClip).libraryId === 'string' &&
        typeof (item as LibraryClip).name === 'string' &&
        typeof (item as LibraryClip).payload === 'object' &&
        ['text', 'image', 'video', 'infographic'].includes((item as LibraryClip).payload?.type)
    )
  } catch {
    return []
  }
}

export function saveClipToLibrary(clip: LibraryClip): void {
  const list = getClipLibrary()
  const existing = list.findIndex((c) => c.libraryId === clip.libraryId)
  const next = existing >= 0 ? list.map((c, i) => (i === existing ? clip : c)) : [...list, clip]
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
}

export function removeClipFromLibrary(libraryId: string): void {
  const list = getClipLibrary().filter((c) => c.libraryId !== libraryId)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}

export function generateLibraryId(): string {
  return Math.random().toString(36).slice(2, 12)
}
