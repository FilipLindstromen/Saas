/**
 * Clear all PitchDeck project data from this browser (localStorage + PitchDeck IndexedDB).
 * Used by the crash recovery UI and optional URL-based emergency reset (see index.html).
 */

const PITCH_DECK_INDEXED_DB = 'PitchDeckProjectFolder'

/** Keys without pitchDeck prefix that this app owns (safe to clear for PitchDeck-only recovery). */
const EXTRA_KEYS = ['analysisFolded']

/**
 * Remove every localStorage key used for PitchDeck projects and workspaces.
 */
export function clearPitchDeckLocalStorage() {
  const keysToRemove = new Set(EXTRA_KEYS)
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i)
    if (key && key.startsWith('pitchDeck')) keysToRemove.add(key)
  }
  for (const key of keysToRemove) {
    try {
      localStorage.removeItem(key)
    } catch (e) {
      console.warn('PitchDeck: could not remove localStorage key', key, e)
    }
  }
}

/**
 * Delete PitchDeck's IndexedDB (saved local project folder handle from older flows).
 * @returns {Promise<void>}
 */
export function clearPitchDeckIndexedDB() {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.deleteDatabase(PITCH_DECK_INDEXED_DB)
      req.onsuccess = () => resolve()
      req.onerror = () => resolve()
      req.onblocked = () => resolve()
    } catch {
      resolve()
    }
  })
}

/**
 * Full browser-side project reset (localStorage + IndexedDB).
 * @returns {Promise<void>}
 */
export async function clearAllPitchDeckProjectData() {
  clearPitchDeckLocalStorage()
  await clearPitchDeckIndexedDB()
}
