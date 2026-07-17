/**
 * Clear Carousel Designer project data from this browser (localStorage + IndexedDB).
 */
import { PROJECT_FOLDER_DB, STORAGE_PREFIX } from './config/appConfig'

/** Keys without carouselDesigner prefix that this app owns for layout prefs. */
const EXTRA_LOCAL_KEYS = ['sidebarWidth']

export function clearCarouselDesignerLocalStorage() {
  const keysToRemove = new Set(EXTRA_LOCAL_KEYS)
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i)
    if (key && key.startsWith(STORAGE_PREFIX)) keysToRemove.add(key)
  }
  keysToRemove.forEach((key) => {
    try {
      localStorage.removeItem(key)
    } catch (e) {
      console.warn('Carousel Designer: could not remove localStorage key', key, e)
    }
  })
}

export function clearCarouselDesignerIndexedDB() {
  return new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(PROJECT_FOLDER_DB)
    req.onsuccess = () => resolve()
    req.onerror = () => resolve()
    req.onblocked = () => resolve()
  })
}

export async function clearAllCarouselDesignerProjectData() {
  clearCarouselDesignerLocalStorage()
  await clearCarouselDesignerIndexedDB()
}
