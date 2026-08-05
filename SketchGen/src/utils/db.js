/**
 * Minimal IndexedDB wrapper for SketchGen.
 * Two stores: `kv` (canvas autosave snapshot) and `generations` (generation history/gallery).
 * Chosen over localStorage because generation thumbnails are full PNG data URLs and
 * can add up to several MB, well past a safe localStorage budget.
 */
const DB_NAME = 'sketchgen-db'
const DB_VERSION = 1
const STORE_KV = 'kv'
const STORE_GENERATIONS = 'generations'

export const MAX_GENERATION_HISTORY = 40

let dbPromise = null

function openDB() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_KV)) {
        db.createObjectStore(STORE_KV, { keyPath: 'key' })
      }
      if (!db.objectStoreNames.contains(STORE_GENERATIONS)) {
        const store = db.createObjectStore(STORE_GENERATIONS, { keyPath: 'id' })
        store.createIndex('createdAt', 'createdAt')
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

export async function kvGet(key) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_KV, 'readonly')
    const req = tx.objectStore(STORE_KV).get(key)
    req.onsuccess = () => resolve(req.result?.value ?? null)
    req.onerror = () => reject(req.error)
  })
}

export async function kvSet(key, value) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_KV, 'readwrite')
    tx.objectStore(STORE_KV).put({ key, value })
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function addGeneration(entry) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_GENERATIONS, 'readwrite')
    tx.objectStore(STORE_GENERATIONS).put(entry)
    tx.oncomplete = () => resolve(entry)
    tx.onerror = () => reject(tx.error)
  })
}

export async function getAllGenerations() {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_GENERATIONS, 'readonly')
    const req = tx.objectStore(STORE_GENERATIONS).getAll()
    req.onsuccess = () => resolve((req.result || []).sort((a, b) => b.createdAt - a.createdAt))
    req.onerror = () => reject(req.error)
  })
}

export async function deleteGeneration(id) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_GENERATIONS, 'readwrite')
    tx.objectStore(STORE_GENERATIONS).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/** Keep only the newest `maxCount` generations, dropping the oldest. */
export async function pruneGenerations(maxCount = MAX_GENERATION_HISTORY) {
  const all = await getAllGenerations()
  const excess = all.slice(maxCount)
  if (!excess.length) return
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_GENERATIONS, 'readwrite')
    const store = tx.objectStore(STORE_GENERATIONS)
    excess.forEach((entry) => store.delete(entry.id))
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
