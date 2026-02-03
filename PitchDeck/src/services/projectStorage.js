/**
 * Project storage: local folder (File System Access API) and Google Drive.
 * Local folder: pick once, then read/write directly (handle persisted in IndexedDB).
 */

const PITCH_DECK_MIME = 'application/json'
const DRIVE_APP_FOLDER = 'appDataFolder'
const DRIVE_FILE_MIME = 'application/vnd.google-apps.file'

const PROJECT_FOLDER_DB = 'PitchDeckProjectFolder'
const PROJECT_FOLDER_STORE = 'folder'

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(PROJECT_FOLDER_DB, 1)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    request.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(PROJECT_FOLDER_STORE, { keyPath: 'id' })
    }
  })
}

async function getStoredFolderEntry() {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROJECT_FOLDER_STORE, 'readonly')
    const req = tx.objectStore(PROJECT_FOLDER_STORE).get('handle')
    req.onsuccess = () => resolve(req.result ?? null)
    req.onerror = () => reject(req.error)
  })
}

async function setStoredFolderHandle(handle, label) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROJECT_FOLDER_STORE, 'readwrite')
    const entry = { id: 'handle', handle }
    if (label != null && String(label).trim() !== '') entry.label = String(label).trim()
    const req = tx.objectStore(PROJECT_FOLDER_STORE).put(entry)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

/**
 * Check if File System Access API is available.
 */
export function isLocalFolderSupported() {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window
}

/**
 * Open a project folder (user picks once). Handle is persisted so Save/Open work without picking again.
 * @returns {Promise<{ handle: FileSystemDirectoryHandle, name: string }>}
 */
export async function openProjectFolder() {
  if (!isLocalFolderSupported()) {
    throw new Error('Folder access is not supported in this browser. Try Chrome or Edge.')
  }
  const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' })
  await setStoredFolderHandle(dirHandle)
  return { handle: dirHandle, name: dirHandle.name }
}

/**
 * Get the current project folder handle (from IndexedDB). Verifies permission; returns null if none or permission lost.
 * name is the custom label if set, otherwise the folder's real name.
 * @returns {Promise<{ handle: FileSystemDirectoryHandle, name: string } | null>}
 */
export async function getProjectFolder() {
  if (!isLocalFolderSupported()) return null
  const entry = await getStoredFolderEntry()
  const handle = entry?.handle
  if (!handle) return null
  const permission = await handle.queryPermission?.({ mode: 'readwrite' }).catch(() => 'denied')
  if (permission === 'granted') {
    const name = entry.label != null && String(entry.label).trim() !== '' ? String(entry.label).trim() : handle.name
    return { handle, name }
  }
  if (permission === 'prompt') {
    const requested = await handle.requestPermission?.({ mode: 'readwrite' }).catch(() => 'denied')
    if (requested === 'granted') {
      const name = entry.label != null && String(entry.label).trim() !== '' ? String(entry.label).trim() : handle.name
      return { handle, name }
    }
  }
  return null
}

/**
 * Set a custom display name for the project folder (stored in IndexedDB).
 * @param {string} label
 */
export async function setProjectFolderLabel(label) {
  const entry = await getStoredFolderEntry()
  if (!entry?.handle) throw new Error('No project folder open')
  await setStoredFolderHandle(entry.handle, label)
}

/**
 * Clear the stored project folder (e.g. "Disconnect folder").
 */
export async function clearProjectFolder() {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROJECT_FOLDER_STORE, 'readwrite')
    const req = tx.objectStore(PROJECT_FOLDER_STORE).delete('handle')
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

/**
 * Delete a project file from the current project folder (removes the file on disk).
 * @param {FileSystemFileHandle} fileHandle - handle from listFromProjectFolder()
 * @returns {Promise<void>}
 */
export async function deleteFileFromProjectFolder(fileHandle) {
  if (!fileHandle?.remove) {
    throw new Error('Deleting files from the folder is not supported in this browser.')
  }
  await fileHandle.remove()
}

/**
 * Rename a project file in the current project folder (read → write new name → delete old if different file).
 * @param {FileSystemFileHandle} fileHandle - handle from listFromProjectFolder()
 * @param {string} newName - display name for the project (will be sanitized to filename)
 * @returns {Promise<{ name: string }>}
 */
export async function renameProjectInFolder(fileHandle, newName) {
  const folder = await getProjectFolder()
  if (!folder) throw new Error('Open a project folder first.')
  const trimmed = (newName && String(newName).trim()) || 'untitled'
  const filename = `${trimmed.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.json`
  const data = await readFromFileHandle(fileHandle)
  data.projectName = trimmed
  const isSameFile = fileHandle.name === filename
  if (isSameFile) {
    const writable = await fileHandle.createWritable()
    await writable.write(JSON.stringify(data, null, 2))
    await writable.close()
    return { name: filename.replace(/\.json$/i, '') }
  }
  const fileHandleNew = await folder.handle.getFileHandle(filename, { create: true })
  const writable = await fileHandleNew.createWritable()
  await writable.write(JSON.stringify(data, null, 2))
  await writable.close()
  if (fileHandle.remove) await fileHandle.remove()
  return { name: filename.replace(/\.json$/i, '') }
}

/**
 * List project files (.json) in the current project folder. No picker—uses stored handle.
 * @returns {Promise<Array<{ name: string, handle: FileSystemFileHandle }>>}
 */
export async function listFromProjectFolder() {
  const folder = await getProjectFolder()
  if (!folder) return []
  const results = []
  for await (const entry of folder.handle.values()) {
    if (entry.kind === 'file' && entry.name.endsWith('.json')) {
      results.push({ name: entry.name.replace(/\.json$/i, ''), handle: entry })
    }
  }
  results.sort((a, b) => a.name.localeCompare(b.name))
  return results
}

const IMAGES_SUBFOLDER = 'images'
const SLIDE_IMAGE_PREFIX = 'slide'

function isEmbeddedOrBlobUrl(url) {
  return typeof url === 'string' && (url.startsWith('data:') || url.startsWith('blob:'))
}

function mimeToExt(mime) {
  if (!mime || !mime.startsWith('image/')) return 'png'
  const part = mime.split('/')[1] || ''
  if (part === 'jpeg' || part === 'jpg') return 'jpg'
  if (part === 'png' || part === 'gif' || part === 'webp' || part === 'avif') return part
  return 'png'
}

/**
 * Fetch blob from data URL or blob URL.
 * @param {string} url
 * @returns {Promise<Blob>}
 */
async function urlToBlob(url) {
  if (url.startsWith('data:')) {
    const res = await fetch(url)
    return res.blob()
  }
  if (url.startsWith('blob:')) {
    const res = await fetch(url)
    return res.blob()
  }
  throw new Error('Not a data or blob URL')
}

/**
 * Save current project to the current project folder, copying custom (data/blob) images into an "images" subfolder and using relative paths in the JSON.
 * @param {() => object} getExportData
 * @param {string} projectName
 * @returns {Promise<{ path: string }>}
 */
export async function saveToProjectFolder(getExportData, projectName) {
  const folder = await getProjectFolder()
  if (!folder) {
    throw new Error('Open a project folder first (Projects → Open project folder).')
  }
  const filename = (projectName && projectName.trim())
    ? `${projectName.trim().replace(/[^a-z0-9]/gi, '-').toLowerCase()}.json`
    : `pitch-deck-${new Date().toISOString().split('T')[0]}.json`
  const raw = getExportData()
  const data = JSON.parse(JSON.stringify(raw))
  const chapters = data.chapters || []
  let imagesDirHandle = null
  for (const chapter of chapters) {
    const slides = chapter.slides || []
    for (const slide of slides) {
      const url = slide.imageUrl
      if (!url || !isEmbeddedOrBlobUrl(url)) continue
      try {
        const blob = await urlToBlob(url)
        const mime = blob.type || 'image/png'
        const ext = mimeToExt(mime)
        const imageFilename = `${SLIDE_IMAGE_PREFIX}-${chapter.id}-${slide.id}.${ext}`
        const relativePath = `${IMAGES_SUBFOLDER}/${imageFilename}`
        if (!imagesDirHandle) {
          imagesDirHandle = await folder.handle.getDirectoryHandle(IMAGES_SUBFOLDER, { create: true })
        }
        const fileHandle = await imagesDirHandle.getFileHandle(imageFilename, { create: true })
        const writable = await fileHandle.createWritable()
        await writable.write(blob)
        await writable.close()
        slide.imageUrl = relativePath
      } catch (e) {
        console.warn('Could not save slide image to project folder:', e)
      }
    }
  }
  const fileHandle = await folder.handle.getFileHandle(filename, { create: true })
  const writable = await fileHandle.createWritable()
  const json = JSON.stringify(data, null, 2)
  await writable.write(json)
  await writable.close()
  return { path: filename }
}

/**
 * Resolve relative image paths (images/...) in project data to object URLs by reading files from the project folder.
 * @param {object} data - Parsed project JSON (will be deep-cloned and modified)
 * @param {FileSystemDirectoryHandle} folderHandle - Project folder handle
 * @returns {Promise<object>} Data with imageUrl replaced by object URLs where applicable
 */
export async function resolveProjectImageUrls(data, folderHandle) {
  if (!data || !folderHandle) return data
  const out = JSON.parse(JSON.stringify(data))
  const chapters = out.chapters || []
  let imagesDirHandle = null
  for (const chapter of chapters) {
    const slides = chapter.slides || []
    for (const slide of slides) {
      const url = slide.imageUrl
      if (!url || typeof url !== 'string' || (!url.startsWith(IMAGES_SUBFOLDER + '/') && !url.startsWith('./' + IMAGES_SUBFOLDER))) continue
      const path = url.replace(/^\.\/+/, '')
      const filename = path.startsWith(IMAGES_SUBFOLDER + '/') ? path.slice((IMAGES_SUBFOLDER + '/').length) : path.replace(/^images\//, '')
      const parts = [IMAGES_SUBFOLDER, filename]
      try {
        let dir = folderHandle
        for (let i = 0; i < parts.length - 1; i++) {
          dir = await dir.getDirectoryHandle(parts[i], { create: false })
        }
        const fileHandle = await dir.getFileHandle(parts[parts.length - 1], { create: false })
        const file = await fileHandle.getFile()
        slide.imageUrl = URL.createObjectURL(file)
      } catch (e) {
        console.warn('Could not resolve project image:', path, e)
      }
    }
  }
  return out
}

/** @deprecated Use openProjectFolder + saveToProjectFolder for direct save. */
export async function saveToLocalFolder(getExportData, projectName) {
  if (!isLocalFolderSupported()) {
    throw new Error('Saving to a folder is not supported in this browser. Try Chrome or Edge.')
  }
  const dirHandle = await window.showDirectoryPicker()
  const filename = (projectName && projectName.trim())
    ? `${projectName.trim().replace(/[^a-z0-9]/gi, '-').toLowerCase()}.json`
    : `pitch-deck-${new Date().toISOString().split('T')[0]}.json`
  const fileHandle = await dirHandle.getFileHandle(filename, { create: true })
  const writable = await fileHandle.createWritable()
  const data = getExportData()
  const json = JSON.stringify(data, null, 2)
  await writable.write(json)
  await writable.close()
  await setStoredFolderHandle(dirHandle)
  return { path: filename, dirHandle }
}

/** @deprecated Use openProjectFolder + listFromProjectFolder. */
export async function listFromLocalFolder() {
  const folder = await getProjectFolder()
  if (folder) return listFromProjectFolder()
  if (!isLocalFolderSupported()) {
    throw new Error('Folder access is not supported in this browser.')
  }
  const dirHandle = await window.showDirectoryPicker()
  const results = []
  for await (const entry of dirHandle.values()) {
    if (entry.kind === 'file' && entry.name.endsWith('.json')) {
      results.push({ name: entry.name.replace(/\.json$/i, ''), handle: entry })
    }
  }
  results.sort((a, b) => a.name.localeCompare(b.name))
  return results
}

/**
 * Read project JSON from a file handle.
 * @param {FileSystemFileHandle} handle
 * @returns {Promise<object>}
 */
export async function readFromFileHandle(handle) {
  const file = await handle.getFile()
  const text = await file.text()
  return JSON.parse(text)
}

/**
 * Load Google Identity Services script and get token for Drive.
 * @param {string} clientId - Google OAuth2 client ID
 * @returns {Promise<string>} Access token
 */
function loadGoogleScript() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Google Sign-In'))
    document.head.appendChild(script)
  })
}

/**
 * Get OAuth2 token for Google Drive (Drive scope).
 * @param {string} clientId - Google OAuth2 client ID (web app)
 * @returns {Promise<string>} Access token
 */
export async function connectGoogleDrive(clientId) {
  if (!clientId || !clientId.trim()) {
    throw new Error('Google Client ID is required. Add it in Settings (API Keys).')
  }
  await loadGoogleScript()
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId.trim(),
      scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.appdata',
      callback: (response) => {
        if (response.error) {
          reject(new Error(response.error || 'Google sign-in failed'))
          return
        }
        resolve(response.access_token)
      }
    })
    client.requestAccessToken({ prompt: 'consent' })
  })
}

const DRIVE_API = 'https://www.googleapis.com/drive/v3'

/**
 * List project files in Google Drive app data folder.
 * @param {string} accessToken
 * @returns {Promise<Array<{ id: string, name: string, modifiedTime: string }>>}
 */
export async function listDriveProjects(accessToken) {
  const q = `mimeType='${PITCH_DECK_MIME}' and '${DRIVE_APP_FOLDER}' in parents and trashed=false`
  const url = `${DRIVE_API}/files?q=${encodeURIComponent(q)}&spaces=${DRIVE_APP_FOLDER}&orderBy=modifiedTime%20desc&fields=files(id,name,modifiedTime)`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(err || 'Failed to list Drive files')
  }
  const data = await res.json()
  return (data.files || []).map((f) => ({
    id: f.id,
    name: (f.name || '').replace(/\.json$/i, ''),
    modifiedTime: f.modifiedTime || ''
  }))
}

/**
 * Save project to Google Drive (create or update).
 * @param {string} accessToken
 * @param {object} exportData - Full project JSON
 * @param {string} projectName - Display name
 * @param {string|null} existingFileId - If updating, the file id
 * @returns {Promise<{ id: string, name: string }>}
 */
export async function saveToDrive(accessToken, exportData, projectName, existingFileId = null) {
  const filename = (projectName && projectName.trim())
    ? `${projectName.trim().replace(/[^a-z0-9]/gi, '-').toLowerCase()}.json`
    : `pitch-deck-${new Date().toISOString().split('T')[0]}.json`
  const json = JSON.stringify(exportData, null, 2)
  const blob = new Blob([json], { type: PITCH_DECK_MIME })

  if (existingFileId) {
    const url = `${DRIVE_API}/files/${existingFileId}?uploadType=media`
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': PITCH_DECK_MIME
      },
      body: json
    })
    if (!res.ok) throw new Error('Failed to update file in Drive')
    return { id: existingFileId, name: filename }
  }

  const metadata = {
    name: filename,
    mimeType: PITCH_DECK_MIME,
    parents: [DRIVE_APP_FOLDER]
  }
  const form = new FormData()
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
  form.append('file', blob, filename)

  const res = await fetch(`${DRIVE_API}/files?uploadType=multipart&fields=id,name`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(err || 'Failed to create file in Drive')
  }
  const data = await res.json()
  return { id: data.id, name: data.name || filename }
}

/**
 * Read project file from Google Drive.
 * @param {string} accessToken
 * @param {string} fileId
 * @returns {Promise<object>}
 */
export async function readFromDrive(accessToken, fileId) {
  const url = `${DRIVE_API}/files/${fileId}?alt=media`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  })
  if (!res.ok) throw new Error('Failed to read file from Drive')
  const json = await res.text()
  return JSON.parse(json)
}
