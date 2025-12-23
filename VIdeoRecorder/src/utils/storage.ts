import { Scene, RecordingTake } from '../App'

const DB_NAME = 'VideoRecorderDB'
const DB_VERSION = 1
const STORE_SCENES = 'scenes'
const STORE_RECORDINGS = 'recordings'

let db: IDBDatabase | null = null

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db)
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      db = request.result
      resolve(db)
    }

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result

      if (!database.objectStoreNames.contains(STORE_SCENES)) {
        database.createObjectStore(STORE_SCENES, { keyPath: 'id' })
      }

      if (!database.objectStoreNames.contains(STORE_RECORDINGS)) {
        const recordingsStore = database.createObjectStore(STORE_RECORDINGS, {
          keyPath: 'id',
        })
        recordingsStore.createIndex('sceneId', 'sceneId', { unique: false })
      }
    }
  })
}

export const saveScene = async (scene: Scene): Promise<void> => {
  const database = await initDB()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_SCENES], 'readwrite')
    const store = transaction.objectStore(STORE_SCENES)
    const request = store.put(scene)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export const saveRecording = async (
  sceneId: string,
  take: RecordingTake
): Promise<void> => {
  const database = await initDB()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_RECORDINGS], 'readwrite')
    const store = transaction.objectStore(STORE_RECORDINGS)
    const recordingData = {
      id: take.id,
      sceneId,
      blob: take.blob,
      duration: take.duration,
      timestamp: take.timestamp,
      selected: take.selected,
    }
    const request = store.put(recordingData)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export const deleteRecording = async (takeId: string): Promise<void> => {
  const database = await initDB()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_RECORDINGS], 'readwrite')
    const store = transaction.objectStore(STORE_RECORDINGS)
    const request = store.delete(takeId)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export const loadRecordingsForScene = async (
  sceneId: string
): Promise<RecordingTake[]> => {
  const database = await initDB()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_RECORDINGS], 'readonly')
    const store = transaction.objectStore(STORE_RECORDINGS)
    const index = store.index('sceneId')
    const request = index.getAll(sceneId)

    request.onsuccess = () => {
      const recordings = request.result.map((data: any) => ({
        id: data.id,
        blob: data.blob,
        duration: data.duration,
        timestamp: data.timestamp,
        selected: data.selected,
      }))
      resolve(recordings)
    }
    request.onerror = () => reject(request.error)
  })
}

