import { openDB, type DBSchema } from 'idb'

interface RecordingDB extends DBSchema {
    recordings: {
        key: string
        value: {
            id: string
            blob: Blob
            timestamp: number
            duration?: number
        }
    }
}

const DB_NAME = 'video-recorder-db'
const STORE_NAME = 'recordings'
const LATEST_RECORDING_ID = 'latest-recording'

async function getDB() {
    return openDB<RecordingDB>(DB_NAME, 1, {
        upgrade(db) {
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' })
            }
        },
    })
}

export async function saveRecording(blob: Blob, duration?: number) {
    try {
        const db = await getDB()
        await db.put(STORE_NAME, {
            id: LATEST_RECORDING_ID,
            blob,
            timestamp: Date.now(),
            duration,
        })
        console.log('Recording saved to IndexedDB')
    } catch (err) {
        console.error('Failed to save recording to IndexedDB:', err)
    }
}

export async function loadRecording(): Promise<{ blob: Blob; duration?: number } | null> {
    try {
        const db = await getDB()
        const item = await db.get(STORE_NAME, LATEST_RECORDING_ID)
        if (!item) return null
        return { blob: item.blob, duration: item.duration }
    } catch (err) {
        console.error('Failed to load recording from IndexedDB:', err)
        return null
    }
}

export async function clearRecording() {
    try {
        const db = await getDB()
        await db.delete(STORE_NAME, LATEST_RECORDING_ID)
        console.log('Recording cleared from IndexedDB')
    } catch (err) {
        console.error('Failed to clear recording from IndexedDB:', err)
    }
}
