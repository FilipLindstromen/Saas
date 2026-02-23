/**
 * Shared project folder storage for all SaaS apps.
 * Uses the connected project folder from saas-settings (local folder or Google Drive).
 * Folder structure: {appName}/{projectName}/project.json
 *
 * - If Google Drive is connected: use that
 * - If local folder is activated: use that
 * - Don't delete browser projects; start saving to folder going forward
 * - If project in folder is newer than browser data, load from folder instead
 */

import { loadApiKeys } from './apiKeys'

const SAAS_FOLDER_DB = 'SaasProjectFolder'
const SAAS_FOLDER_STORE = 'folder'
const ROOT_FOLDER_NAME = 'SaasProjects'
const PROJECT_FILE = 'project.json'

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(SAAS_FOLDER_DB, 1)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    request.onupgradeneeded = (e) => {
      if (!e.target.result.objectStoreNames.contains(SAAS_FOLDER_STORE)) {
        e.target.result.createObjectStore(SAAS_FOLDER_STORE, { keyPath: 'id' })
      }
    }
  })
}

async function getStoredFolderEntry() {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SAAS_FOLDER_STORE, 'readonly')
    const req = tx.objectStore(SAAS_FOLDER_STORE).get('handle')
    req.onsuccess = () => resolve(req.result ?? null)
    req.onerror = () => reject(req.error)
  })
}

/**
 * Persist the local folder handle (called from docs/index.html when user picks folder).
 * @param {FileSystemDirectoryHandle} handle
 * @param {string} [name]
 */
export async function setConnectedLocalFolder(handle, name) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SAAS_FOLDER_STORE, 'readwrite')
    const entry = { id: 'handle', handle, name: name || handle?.name || '' }
    const req = tx.objectStore(SAAS_FOLDER_STORE).put(entry)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

/**
 * Clear the stored local folder handle.
 */
export async function clearConnectedLocalFolder() {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SAAS_FOLDER_STORE, 'readwrite')
    const req = tx.objectStore(SAAS_FOLDER_STORE).delete('handle')
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

function isLocalFolderSupported() {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window
}

/**
 * Get the connected local folder handle. Tries IndexedDB first, then window.SaasStorage.
 * Verifies permission.
 * @returns {Promise<{ handle: FileSystemDirectoryHandle, name: string } | null>}
 */
export async function getConnectedLocalFolder() {
  if (!isLocalFolderSupported()) return null
  let handle = null
  let name = ''
  const entry = await getStoredFolderEntry()
  if (entry?.handle) {
    handle = entry.handle
    name = entry.name || handle.name || ''
  } else if (typeof window !== 'undefined' && window.SaasStorage?.localFolderHandle) {
    handle = window.SaasStorage.localFolderHandle
    name = window.SaasStorage.localFolderName || handle?.name || ''
  }
  if (!handle) return null
  const permission = await handle.queryPermission?.({ mode: 'readwrite' }).catch(() => 'denied')
  if (permission === 'granted') {
    return { handle, name }
  }
  if (permission === 'prompt') {
    const requested = await handle.requestPermission?.({ mode: 'readwrite' }).catch(() => 'denied')
    if (requested === 'granted') {
      return { handle, name }
    }
  }
  return null
}

/**
 * Get the connected folder source: 'local', 'drive', or null.
 * Prefers local folder if both are configured.
 * @returns {Promise<{ type: 'local'|'drive', handle?: FileSystemDirectoryHandle, token?: string } | null>}
 */
export async function getConnectedFolderSource() {
  const local = await getConnectedLocalFolder()
  if (local) return { type: 'local', handle: local.handle }
  const keys = loadApiKeys()
  const token = (keys?.googleDriveAccessToken || '').trim()
  if (token) return { type: 'drive', token }
  return null
}

/**
 * Check if any project folder is connected (local or Drive).
 */
export async function hasConnectedFolder() {
  const source = await getConnectedFolderSource()
  return source !== null
}

function sanitizeFolderName(name) {
  return (name || 'untitled').trim().replace(/[^a-z0-9_-]/gi, '-').replace(/-+/g, '-').toLowerCase() || 'untitled'
}

/**
 * Get or create the app folder within the connected root.
 * For local: root/PitchDeck/, root/InfoGraphics/, etc.
 * @param {boolean} create - If false, returns null when folder doesn't exist
 */
async function getAppFolder(source, appName, create = true) {
  const appFolderName = sanitizeFolderName(appName)
  if (source.type === 'local' && source.handle) {
    try {
      return await source.handle.getDirectoryHandle(appFolderName, { create })
    } catch (e) {
      if (e.name === 'NotFoundError' && !create) return null
      throw e
    }
  }
  return null
}

/**
 * Get or create the project folder within the app folder.
 * @param {boolean} create - If false, returns null when folder doesn't exist
 */
async function getProjectFolderHandle(appFolderHandle, projectName, create = true) {
  const projectFolderName = sanitizeFolderName(projectName)
  try {
    return await appFolderHandle.getDirectoryHandle(projectFolderName, { create })
  } catch (e) {
    if (e.name === 'NotFoundError' && !create) return null
    throw e
  }
}

/**
 * Save project data to the connected folder.
 * Structure: {appName}/{projectName}/project.json
 * @param {string} appName - e.g. 'PitchDeck', 'InfoGraphics', 'ColorWriter'
 * @param {string} projectName - display name (will be sanitized for folder name)
 * @param {object|(() => object)} dataOrGetter - project data or function that returns it
 * @returns {Promise<{ path: string } | null>} Path if saved, null if no connected folder
 */
export async function saveProjectToConnectedFolder(appName, projectName, dataOrGetter) {
  const source = await getConnectedFolderSource()
  if (!source) return null
  if (source.type === 'local' && source.handle) {
    const appFolder = await getAppFolder(source, appName)
    const projectFolder = await getProjectFolderHandle(appFolder, projectName)
    const data = typeof dataOrGetter === 'function' ? dataOrGetter() : dataOrGetter
    const json = JSON.stringify(data, null, 2)
    const fileHandle = await projectFolder.getFileHandle(PROJECT_FILE, { create: true })
    const writable = await fileHandle.createWritable()
    await writable.write(json)
    await writable.close()
    return { path: `${appName}/${sanitizeFolderName(projectName)}/${PROJECT_FILE}` }
  }
  if (source.type === 'drive' && source.token) {
    return saveProjectToDrive(source.token, appName, projectName, typeof dataOrGetter === 'function' ? dataOrGetter() : dataOrGetter)
  }
  return null
}

/**
 * Load project data from the connected folder.
 * @returns {Promise<{ data: object, modifiedTime: number } | null>}
 */
export async function loadProjectFromConnectedFolder(appName, projectName) {
  const source = await getConnectedFolderSource()
  if (!source) return null
  if (source.type === 'local' && source.handle) {
    try {
      const appFolder = await getAppFolder(source, appName, false)
      if (!appFolder) return null
      const projectFolder = await getProjectFolderHandle(appFolder, projectName, false)
      if (!projectFolder) return null
      const fileHandle = await projectFolder.getFileHandle(PROJECT_FILE, { create: false })
      const file = await fileHandle.getFile()
      const text = await file.text()
      const data = JSON.parse(text)
      const modifiedTime = file.lastModified ? file.lastModified : 0
      return { data, modifiedTime }
    } catch (e) {
      if (e.name === 'NotFoundError') return null
      throw e
    }
  }
  if (source.type === 'drive' && source.token) {
    return loadProjectFromDrive(source.token, appName, projectName)
  }
  return null
}

/**
 * List projects in the connected folder for an app.
 * @returns {Promise<Array<{ name: string, modifiedTime: number }>>}
 */
export async function listProjectsInConnectedFolder(appName) {
  const source = await getConnectedFolderSource()
  if (!source) return []
  if (source.type === 'local' && source.handle) {
    try {
      const appFolder = await getAppFolder(source, appName, false)
      if (!appFolder) return []
      const results = []
      for await (const entry of appFolder.values()) {
        if (entry.kind === 'directory') {
          try {
            const projectFolder = await appFolder.getDirectoryHandle(entry.name, { create: false })
            const fileHandle = await projectFolder.getFileHandle(PROJECT_FILE, { create: false })
            const file = await fileHandle.getFile()
            results.push({
              name: entry.name,
              modifiedTime: file.lastModified || 0
            })
          } catch (_) {}
        }
      }
      results.sort((a, b) => b.modifiedTime - a.modifiedTime)
      return results
    } catch (e) {
      return []
    }
  }
  if (source.type === 'drive' && source.token) {
    return listProjectsFromDrive(source.token, appName)
  }
  return []
}

/**
 * Get project modified time for conflict resolution.
 * @returns {Promise<number|null>} Unix ms or null
 */
export async function getProjectModifiedTime(appName, projectName) {
  const result = await loadProjectFromConnectedFolder(appName, projectName)
  return result ? result.modifiedTime : null
}

// --- Google Drive helpers ---
const DRIVE_API = 'https://www.googleapis.com/drive/v3'
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files'
const FOLDER_MIME = 'application/vnd.google-apps.folder'
const JSON_MIME = 'application/json'

async function getDriveFolder(token, parentId, name, createIfMissing = true) {
  const sanitized = sanitizeFolderName(name)
  const q = `mimeType='${FOLDER_MIME}' and '${parentId}' in parents and name='${encodeURIComponent(sanitized)}' and trashed=false`
  const listRes = await fetch(`${DRIVE_API}/files?q=${encodeURIComponent(q)}&spaces=appDataFolder&fields=files(id,name)`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!listRes.ok) throw new Error('Failed to list Drive folders')
  const listData = await listRes.json()
  if (listData.files?.length > 0) {
    return listData.files[0].id
  }
  if (!createIfMissing) return null
  const createRes = await fetch(`${DRIVE_API}/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: sanitized,
      mimeType: FOLDER_MIME,
      parents: [parentId]
    })
  })
  if (!createRes.ok) throw new Error('Failed to create Drive folder')
  const createData = await createRes.json()
  return createData.id
}

async function getOrCreateDriveFolder(token, parentId, name) {
  return getDriveFolder(token, parentId, name, true)
}

async function getAppDataFolderId(token) {
  const res = await fetch(`${DRIVE_API}/files/appDataFolder?fields=id`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!res.ok) throw new Error('Failed to get app data folder')
  const data = await res.json()
  return data.id
}

async function saveProjectToDrive(token, appName, projectName, data) {
  const appDataId = await getAppDataFolderId(token)
  const saasId = await getOrCreateDriveFolder(token, appDataId, ROOT_FOLDER_NAME)
  const appId = await getOrCreateDriveFolder(token, saasId, sanitizeFolderName(appName))
  const projectId = await getOrCreateDriveFolder(token, appId, sanitizeFolderName(projectName))
  const filename = PROJECT_FILE
  const json = JSON.stringify(data, null, 2)
  const q = `'${projectId}' in parents and name='${filename}' and trashed=false`
  const listRes = await fetch(`${DRIVE_API}/files?q=${encodeURIComponent(q)}&spaces=appDataFolder&fields=files(id)`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  const listData = await listRes.json()
  const existingId = listData.files?.[0]?.id
  if (existingId) {
    const patchRes = await fetch(`${DRIVE_UPLOAD}/${existingId}?uploadType=media`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': JSON_MIME
      },
      body: json
    })
    if (!patchRes.ok) throw new Error('Failed to update Drive file')
    return { path: `${appName}/${sanitizeFolderName(projectName)}/${PROJECT_FILE}` }
  }
  const metadata = {
    name: filename,
    mimeType: JSON_MIME,
    parents: [projectId]
  }
  const form = new FormData()
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
  form.append('file', new Blob([json], { type: JSON_MIME }), filename)
  const createRes = await fetch(`${DRIVE_UPLOAD}?uploadType=multipart&fields=id`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form
  })
  if (!createRes.ok) throw new Error('Failed to create Drive file')
  return { path: `${appName}/${sanitizeFolderName(projectName)}/${PROJECT_FILE}` }
}

async function loadProjectFromDrive(token, appName, projectName) {
  const appDataId = await getAppDataFolderId(token)
  const saasId = await getDriveFolder(token, appDataId, ROOT_FOLDER_NAME, true)
  if (!saasId) return null
  const appId = await getDriveFolder(token, saasId, appName, false)
  if (!appId) return null
  const projectId = await getDriveFolder(token, appId, projectName, false)
  if (!projectId) return null
  const q = `'${projectId}' in parents and name='${PROJECT_FILE}' and trashed=false`
  const listRes = await fetch(`${DRIVE_API}/files?q=${encodeURIComponent(q)}&spaces=appDataFolder&fields=files(id,modifiedTime)`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!listRes.ok) throw new Error('Failed to list Drive files')
  const listData = await listRes.json()
  const file = listData.files?.[0]
  if (!file) return null
  const fileRes = await fetch(`${DRIVE_API}/files/${file.id}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!fileRes.ok) throw new Error('Failed to read Drive file')
  const text = await fileRes.text()
  const data = JSON.parse(text)
  const modifiedTime = file.modifiedTime ? new Date(file.modifiedTime).getTime() : 0
  return { data, modifiedTime }
}

async function listProjectsFromDrive(token, appName) {
  try {
    const appDataId = await getAppDataFolderId(token)
    const saasId = await getOrCreateDriveFolder(token, appDataId, ROOT_FOLDER_NAME)
    const appId = await getDriveFolder(token, saasId, appName, false)
    if (!appId) return []
    const q = `mimeType='${FOLDER_MIME}' and '${appId}' in parents and trashed=false`
    const listRes = await fetch(`${DRIVE_API}/files?q=${encodeURIComponent(q)}&spaces=appDataFolder&fields=files(id,name)`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!listRes.ok) return []
    const listData = await listRes.json()
    const folders = listData.files || []
    const results = []
    for (const f of folders) {
      const fileQ = `'${f.id}' in parents and name='${PROJECT_FILE}' and trashed=false`
      const fileRes = await fetch(`${DRIVE_API}/files?q=${encodeURIComponent(fileQ)}&spaces=appDataFolder&fields=files(modifiedTime)`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      let modifiedTime = 0
      if (fileRes.ok) {
        const fileData = await fileRes.json()
        const pf = fileData.files?.[0]
        if (pf?.modifiedTime) modifiedTime = new Date(pf.modifiedTime).getTime()
      }
      results.push({ name: f.name, modifiedTime })
    }
    results.sort((a, b) => b.modifiedTime - a.modifiedTime)
    return results
  } catch (e) {
    return []
  }
}
