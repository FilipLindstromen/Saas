import { getConnectedFolderSource } from '@shared/projectFolderStorage'

const APP_NAME = 'PitchDeck'
const DRAWINGS_DIR = 'drawings'
const IDB_NAME = 'PitchDeckDrawings'
const IDB_STORE = 'blobs'

/** Stable browser scope (survives reload; independent of project rename). */
export function getDrawingStorageScope() {
  if (typeof window === 'undefined') return 'default'
  return localStorage.getItem('pitchDeckCurrentWorkspace') || 'default'
}

/** Folder / Electron project folder name segment. */
export function normalizeDrawingProjectName(projectName) {
  return (projectName || '').trim() || 'Untitled Project'
}

function sanitizeFolderName(name) {
  return (name || 'untitled').trim().replace(/[^a-z0-9_-]/gi, '-').replace(/-+/g, '-').toLowerCase() || 'untitled'
}

function sanitizeSlideId(slideId) {
  return String(slideId || 'slide').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120) || 'slide'
}

export function drawingRelativePath(slideId) {
  return `${DRAWINGS_DIR}/${sanitizeSlideId(slideId)}.png`
}

function cacheKey(projectName, slideId) {
  const scope = getDrawingStorageScope()
  const sid = sanitizeSlideId(slideId)
  return `${scope}::${sid}`
}

function legacyCacheKeys(projectName, slideId) {
  const sid = sanitizeSlideId(slideId)
  const proj = normalizeDrawingProjectName(projectName)
  const keys = [
    `${sanitizeFolderName(proj)}::${sid}`,
    `${sanitizeFolderName('')}::${sid}`,
    `untitled::${sid}`,
  ]
  return [...new Set(keys)]
}

function isElectronDrawing() {
  return typeof window !== 'undefined' && window.electronAPI?.isElectron && window.electronAPI.drawingSave
}

async function saveDrawingElectron(projectName, slideId, blob) {
  const ab = await blob.arrayBuffer()
  await window.electronAPI.drawingSave(
    (projectName || '').trim() || 'Untitled Project',
    slideId,
    ab
  )
}

async function loadDrawingElectron(projectName, slideId) {
  const data = await window.electronAPI.drawingLoad(
    (projectName || '').trim() || 'Untitled Project',
    slideId
  )
  if (!data) return null
  const u8 = data instanceof Uint8Array ? data : new Uint8Array(data)
  return new Blob([u8], { type: 'image/png' })
}

async function clearDrawingElectron(projectName, slideId) {
  await window.electronAPI.drawingDelete(
    (projectName || '').trim() || 'Untitled Project',
    slideId
  )
}

function openDrawingDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1)
    req.onerror = () => reject(req.error)
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE)
      }
    }
  })
}

async function saveDrawingToIndexedDB(key, blob) {
  const db = await openDrawingDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite')
    tx.objectStore(IDB_STORE).put(blob, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function loadDrawingFromIndexedDB(key) {
  const db = await openDrawingDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly')
    const req = tx.objectStore(IDB_STORE).get(key)
    req.onsuccess = () => resolve(req.result ?? null)
    req.onerror = () => reject(req.error)
  })
}

async function getProjectFolderHandle(projectName, create) {
  const source = await getConnectedFolderSource()
  if (source.type !== 'local' || !source.handle) return null
  const appFolderName = sanitizeFolderName(APP_NAME)
  const projectFolderName = sanitizeFolderName(projectName)
  try {
    const appFolder = await source.handle.getDirectoryHandle(appFolderName, { create })
    return await appFolder.getDirectoryHandle(projectFolderName, { create })
  } catch {
    return null
  }
}

export async function saveDrawingPng(projectName, slideId, blob) {
  const key = cacheKey(projectName, slideId)
  await saveDrawingToIndexedDB(key, blob)
  const proj = normalizeDrawingProjectName(projectName)

  if (isElectronDrawing()) {
    try {
      await saveDrawingElectron(proj, slideId, blob)
      return { path: drawingRelativePath(slideId), storedInFolder: true }
    } catch (e) {
      console.warn('[drawing] Electron save failed:', e)
    }
  }

  const projectFolder = await getProjectFolderHandle(projectName, true)
  if (!projectFolder) {
    return { path: drawingRelativePath(slideId), storedInFolder: false }
  }
  const drawingsDir = await projectFolder.getDirectoryHandle(DRAWINGS_DIR, { create: true })
  const fileName = `${sanitizeSlideId(slideId)}.png`
  const fileHandle = await drawingsDir.getFileHandle(fileName, { create: true })
  const writable = await fileHandle.createWritable()
  await writable.write(blob)
  await writable.close()
  return { path: drawingRelativePath(slideId), storedInFolder: true }
}

export async function loadDrawingBlob(projectName, slideId) {
  const key = cacheKey(projectName, slideId)
  let fromIdb = await loadDrawingFromIndexedDB(key)
  if (fromIdb) return fromIdb

  for (const legacyKey of legacyCacheKeys(projectName, slideId)) {
    if (legacyKey === key) continue
    fromIdb = await loadDrawingFromIndexedDB(legacyKey)
    if (fromIdb) {
      await saveDrawingToIndexedDB(key, fromIdb)
      return fromIdb
    }
  }

  const proj = normalizeDrawingProjectName(projectName)
  if (isElectronDrawing()) {
    try {
      const fromDisk = await loadDrawingElectron(proj, slideId)
      if (fromDisk) {
        await saveDrawingToIndexedDB(key, fromDisk)
        return fromDisk
      }
    } catch (e) {
      console.warn('[drawing] Electron load failed:', e)
    }
  }

  const projectFolder = await getProjectFolderHandle(projectName, false)
  if (!projectFolder) return null
  try {
    const drawingsDir = await projectFolder.getDirectoryHandle(DRAWINGS_DIR, { create: false })
    const fileName = `${sanitizeSlideId(slideId)}.png`
    const fileHandle = await drawingsDir.getFileHandle(fileName, { create: false })
    const file = await fileHandle.getFile()
    const blob = file.slice(0, file.size, 'image/png')
    await saveDrawingToIndexedDB(key, blob)
    return blob
  } catch {
    return null
  }
}

export async function clearDrawingBlob(projectName, slideId) {
  const key = cacheKey(projectName, slideId)
  const db = await openDrawingDB()
  await new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite')
    tx.objectStore(IDB_STORE).delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })

  const proj = (projectName || '').trim() || 'Untitled Project'
  if (isElectronDrawing()) {
    try {
      await clearDrawingElectron(proj, slideId)
    } catch (e) {
      console.warn('[drawing] Electron delete failed:', e)
    }
  }

  const projectFolder = await getProjectFolderHandle(projectName, false)
  if (!projectFolder) return
  try {
    const drawingsDir = await projectFolder.getDirectoryHandle(DRAWINGS_DIR, { create: false })
    const fileName = `${sanitizeSlideId(slideId)}.png`
    await drawingsDir.removeEntry(fileName)
  } catch {
    /* file may not exist */
  }
}
