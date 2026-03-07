import type { CaptionSegment } from '../types'

const DB_NAME = 'autoCaptions'
const STORE_NAME = 'state'
const KEY = 'current'

export interface PersistedState {
  videoBlob: Blob
  segments: CaptionSegment[]
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onerror = () => reject(req.error)
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME, { keyPath: 'id' })
    }
  })
}

export async function loadAutoCaptionsState(): Promise<PersistedState | null> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const req = store.get(KEY)
      req.onerror = () => reject(req.error)
      req.onsuccess = () => {
        const row = req.result
        db.close()
        if (row && row.videoBlob instanceof Blob && Array.isArray(row.segments)) {
          resolve({ videoBlob: row.videoBlob, segments: row.segments })
        } else {
          resolve(null)
        }
      }
    })
  } catch {
    return null
  }
}

export async function saveAutoCaptionsState(state: PersistedState): Promise<void> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      store.put({ id: KEY, videoBlob: state.videoBlob, segments: state.segments })
      tx.oncomplete = () => {
        db.close()
        resolve()
      }
      tx.onerror = () => reject(tx.error)
    })
  } catch (e) {
    console.warn('AutoCaptions: failed to persist state', e)
  }
}

export async function clearAutoCaptionsState(): Promise<void> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).delete(KEY)
      tx.oncomplete = () => {
        db.close()
        resolve()
      }
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    // ignore
  }
}
