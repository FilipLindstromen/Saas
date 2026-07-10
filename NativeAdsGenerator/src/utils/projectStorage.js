const PROJECT_KEY = 'nativeAdsGeneratorProject'
const IDB_NAME = 'nativeAdsGenerator'
const IDB_STORE = 'blobs'
const PROJECT_VERSION = 1

const RESTORABLE_MEDIA_MODES = new Set([
  'upload-image',
  'upload-video',
  'webcam-photo',
  'unsplash',
  'pexels-video',
])

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1)
    req.onerror = () => reject(req.error || new Error('Failed to open storage'))
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
  })
}

export async function saveBlob(key, blob) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite')
    tx.oncomplete = () => {
      db.close()
      resolve()
    }
    tx.onerror = () => {
      db.close()
      reject(tx.error || new Error('Failed to save media'))
    }
    tx.objectStore(IDB_STORE).put(blob, key)
  })
}

export async function loadBlob(key) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly')
    const req = tx.objectStore(IDB_STORE).get(key)
    req.onsuccess = () => {
      db.close()
      resolve(req.result ?? null)
    }
    req.onerror = () => {
      db.close()
      reject(req.error || new Error('Failed to load media'))
    }
  })
}

export async function deleteBlob(key) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite')
    tx.oncomplete = () => {
      db.close()
      resolve()
    }
    tx.onerror = () => {
      db.close()
      reject(tx.error || new Error('Failed to delete media'))
    }
    tx.objectStore(IDB_STORE).delete(key)
  })
}

export function loadProject() {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(PROJECT_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!data || typeof data !== 'object') return null
    return data
  } catch {
    return null
  }
}

export function saveProject(project) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(PROJECT_KEY, JSON.stringify({
      version: PROJECT_VERSION,
      ...project,
    }))
  } catch (err) {
    console.warn('Native Ads Generator: could not save project', err)
  }
}

export function isRestorableMediaMode(mode) {
  return RESTORABLE_MEDIA_MODES.has(mode)
}

export async function blobFromDataUrl(dataUrl) {
  const res = await fetch(dataUrl)
  return res.blob()
}

export async function persistMediaSource(mode, source) {
  if (!isRestorableMediaMode(mode)) return null

  if (mode === 'pexels-video' && source.externalUrl) {
    return { mode, externalUrl: source.externalUrl }
  }

  let blob = source.blob ?? null
  if (!blob && source.dataUrl) {
    blob = await blobFromDataUrl(source.dataUrl)
  }
  if (!blob) return null

  await saveBlob('media', blob)
  return {
    mode,
    blobKey: 'media',
    fileName: source.fileName || null,
    externalUrl: source.externalUrl || null,
  }
}

export async function persistMusicSource(file) {
  if (!file) return null
  await saveBlob('music', file)
  return { blobKey: 'music', name: file.name }
}

export async function clearPersistedMedia() {
  try {
    await deleteBlob('media')
  } catch {
    /* ignore */
  }
}

export async function clearPersistedMusic() {
  try {
    await deleteBlob('music')
  } catch {
    /* ignore */
  }
}
