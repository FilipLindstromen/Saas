/**
 * Minimal IndexedDB wrapper for SketchGen.
 * Stores: `kv` (per-drawing canvas autosave snapshot, keyed by `canvas:<projectId>:<tabId>`),
 * `generations` (generation history/gallery, tagged with a `drawingKey` so each drawing
 * has its own history), and `styleReferences` (uploaded style-reference images — kept
 * global/shared across all projects and drawings, since they're a reusable style library
 * rather than drawing content). Chosen over localStorage because these can hold full PNG
 * data URLs, well past a safe localStorage budget.
 */
const DB_NAME = 'sketchgen-db'
const DB_VERSION = 3
const STORE_KV = 'kv'
const STORE_GENERATIONS = 'generations'
const STORE_STYLE_REFS = 'styleReferences'

export const MAX_GENERATION_HISTORY = 40

let dbPromise = null

function openDB() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      const tx = req.transaction
      if (!db.objectStoreNames.contains(STORE_KV)) {
        db.createObjectStore(STORE_KV, { keyPath: 'key' })
      }
      let generationsStore
      if (!db.objectStoreNames.contains(STORE_GENERATIONS)) {
        generationsStore = db.createObjectStore(STORE_GENERATIONS, { keyPath: 'id' })
        generationsStore.createIndex('createdAt', 'createdAt')
      } else {
        generationsStore = tx.objectStore(STORE_GENERATIONS)
      }
      if (!generationsStore.indexNames.contains('drawingKey')) {
        generationsStore.createIndex('drawingKey', 'drawingKey')
      }
      if (!db.objectStoreNames.contains(STORE_STYLE_REFS)) {
        const store = db.createObjectStore(STORE_STYLE_REFS, { keyPath: 'id' })
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

export async function kvDelete(key) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_KV, 'readwrite')
    tx.objectStore(STORE_KV).delete(key)
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

/** Pass `drawingKey` to scope to one drawing (projectId:tabId); omit for everything. */
export async function getAllGenerations(drawingKey) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_GENERATIONS, 'readonly')
    const req = tx.objectStore(STORE_GENERATIONS).getAll()
    req.onsuccess = () => {
      const all = req.result || []
      const filtered = drawingKey ? all.filter((e) => e.drawingKey === drawingKey) : all
      resolve(filtered.sort((a, b) => b.createdAt - a.createdAt))
    }
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

/** Delete every generation belonging to a drawing (used when a tab/project is removed). */
export async function deleteGenerationsForDrawing(drawingKey) {
  const all = await getAllGenerations(drawingKey)
  if (!all.length) return
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_GENERATIONS, 'readwrite')
    const store = tx.objectStore(STORE_GENERATIONS)
    all.forEach((entry) => store.delete(entry.id))
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/** Keep only the newest `maxCount` generations within one drawing, dropping the oldest. */
export async function pruneGenerations(drawingKey, maxCount = MAX_GENERATION_HISTORY) {
  const all = await getAllGenerations(drawingKey)
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

export async function addStyleReference(entry) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_STYLE_REFS, 'readwrite')
    tx.objectStore(STORE_STYLE_REFS).put(entry)
    tx.oncomplete = () => resolve(entry)
    tx.onerror = () => reject(tx.error)
  })
}

export async function getAllStyleReferences() {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_STYLE_REFS, 'readonly')
    const req = tx.objectStore(STORE_STYLE_REFS).getAll()
    req.onsuccess = () => resolve((req.result || []).sort((a, b) => a.createdAt - b.createdAt))
    req.onerror = () => reject(req.error)
  })
}

export async function deleteStyleReference(id) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_STYLE_REFS, 'readwrite')
    tx.objectStore(STORE_STYLE_REFS).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
