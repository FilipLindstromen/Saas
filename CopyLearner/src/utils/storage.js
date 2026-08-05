/**
 * Sync layer for CopyLearner.
 *
 * If Firebase config env vars are present, everything is stored in Firestore
 * under `workspaces/{code}/...` so the same "sync code" entered on two
 * devices sees the same data in real time. Without Firebase config, falls
 * back to plain localStorage (single device only) so the app still works
 * out of the box.
 */

const WORKSPACE_CODE_KEY = 'copylearner_workspace_code'
const LOCAL_STATE_KEY = 'copylearner_state_local'
const LOCAL_SOURCES_KEY = 'copylearner_sources_local'
const LOCAL_POSTS_KEY = 'copylearner_posts_local'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
}

export function isCloudEnabled() {
  return !!(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId)
}

/* ---------------------------------------------------------
   Workspace / sync code
--------------------------------------------------------- */
export function generateWorkspaceCode() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789'
  let code = ''
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

export function getWorkspaceCode() {
  let code = localStorage.getItem(WORKSPACE_CODE_KEY)
  if (!code) {
    code = generateWorkspaceCode()
    localStorage.setItem(WORKSPACE_CODE_KEY, code)
  }
  return code
}

export function setWorkspaceCode(code) {
  const clean = (code || '').trim().toLowerCase()
  if (!clean) return
  localStorage.setItem(WORKSPACE_CODE_KEY, clean)
}

/* ---------------------------------------------------------
   Local pub-sub — Firestore's onSnapshot fires again on every write;
   plain localStorage doesn't, so mimic that for the no-Firebase fallback
   (otherwise subscribers only ever see the value at mount time).
--------------------------------------------------------- */
const localListeners = { state: new Set(), sources: new Set(), posts: new Set() }
function notifyLocal(kind, data) {
  localListeners[kind].forEach((cb) => cb(data))
}

/* ---------------------------------------------------------
   Cloud (Firestore) backend
--------------------------------------------------------- */
let cloudReady = null
async function getCloud() {
  if (!isCloudEnabled()) return null
  if (!cloudReady) {
    cloudReady = (async () => {
      const { initializeApp, getApps } = await import('firebase/app')
      const {
        getFirestore, doc, setDoc, getDoc, onSnapshot, collection,
        addDoc, updateDoc, deleteDoc, query, orderBy, serverTimestamp, writeBatch,
      } = await import('firebase/firestore')
      const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)
      const db = getFirestore(app)
      return {
        db, doc, setDoc, getDoc, onSnapshot, collection,
        addDoc, updateDoc, deleteDoc, query, orderBy, serverTimestamp, writeBatch,
      }
    })()
  }
  return cloudReady
}

/* ---------------------------------------------------------
   State (selected categories, favorites, progress)
--------------------------------------------------------- */
const DEFAULT_STATE = { selectedCats: null, favorites: [], progress: {} }

function readLocalState() {
  try {
    const raw = localStorage.getItem(LOCAL_STATE_KEY)
    return raw ? { ...DEFAULT_STATE, ...JSON.parse(raw) } : { ...DEFAULT_STATE }
  } catch {
    return { ...DEFAULT_STATE }
  }
}
function writeLocalState(state) {
  localStorage.setItem(LOCAL_STATE_KEY, JSON.stringify(state))
  notifyLocal('state', state)
}

export function subscribeState(onChange) {
  let cancelled = false
  ;(async () => {
    const cloud = await getCloud()
    if (cancelled) return
    if (!cloud) {
      localListeners.state.add(onChange)
      onChange(readLocalState())
      return
    }
    const code = getWorkspaceCode()
    const ref = cloud.doc(cloud.db, 'workspaces', code, 'meta', 'state')
    const unsub = cloud.onSnapshot(ref, (snap) => {
      if (snap.exists()) onChange({ ...DEFAULT_STATE, ...snap.data() })
      else onChange({ ...DEFAULT_STATE })
    }, () => onChange(readLocalState()))
    cancelled = unsub
  })()
  return () => {
    if (typeof cancelled === 'function') cancelled()
    localListeners.state.delete(onChange)
    cancelled = true
  }
}

export async function saveState(partial) {
  const cloud = await getCloud()
  if (!cloud) {
    const next = { ...readLocalState(), ...partial }
    writeLocalState(next)
    return
  }
  const code = getWorkspaceCode()
  const ref = cloud.doc(cloud.db, 'workspaces', code, 'meta', 'state')
  await cloud.setDoc(ref, partial, { merge: true })
}

/* ---------------------------------------------------------
   Sources (uploaded content)
--------------------------------------------------------- */
function readLocalSources() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_SOURCES_KEY) || '[]')
  } catch {
    return []
  }
}
function writeLocalSources(list) {
  localStorage.setItem(LOCAL_SOURCES_KEY, JSON.stringify(list))
  notifyLocal('sources', list)
}

export function subscribeSources(onChange) {
  let cancelled = false
  ;(async () => {
    const cloud = await getCloud()
    if (cancelled) return
    if (!cloud) {
      localListeners.sources.add(onChange)
      onChange(readLocalSources())
      return
    }
    const code = getWorkspaceCode()
    const q = cloud.query(cloud.collection(cloud.db, 'workspaces', code, 'sources'), cloud.orderBy('createdAt', 'desc'))
    const unsub = cloud.onSnapshot(q, (snap) => {
      onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    }, () => onChange(readLocalSources()))
    cancelled = unsub
  })()
  return () => {
    if (typeof cancelled === 'function') cancelled()
    localListeners.sources.delete(onChange)
    cancelled = true
  }
}

export async function createSource({ title, type, text }) {
  const cloud = await getCloud()
  const base = { title, type, text, status: 'processing', createdAt: Date.now() }
  if (!cloud) {
    const id = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const list = readLocalSources()
    list.unshift({ id, ...base })
    writeLocalSources(list)
    return id
  }
  const code = getWorkspaceCode()
  const ref = await cloud.addDoc(cloud.collection(cloud.db, 'workspaces', code, 'sources'), {
    ...base,
    createdAt: cloud.serverTimestamp(),
  })
  return ref.id
}

export async function updateSource(id, patch) {
  const cloud = await getCloud()
  if (!cloud) {
    const list = readLocalSources().map((s) => (s.id === id ? { ...s, ...patch } : s))
    writeLocalSources(list)
    return
  }
  const code = getWorkspaceCode()
  const ref = cloud.doc(cloud.db, 'workspaces', code, 'sources', id)
  await cloud.updateDoc(ref, patch)
}

export async function deleteSource(id) {
  const cloud = await getCloud()
  if (!cloud) {
    writeLocalSources(readLocalSources().filter((s) => s.id !== id))
    const posts = readLocalPosts().filter((p) => p.sourceId !== id)
    writeLocalPosts(posts)
    return
  }
  const code = getWorkspaceCode()
  await cloud.deleteDoc(cloud.doc(cloud.db, 'workspaces', code, 'sources', id))
  const q = cloud.query(cloud.collection(cloud.db, 'workspaces', code, 'posts'))
  const { getDocs } = await import('firebase/firestore')
  const snap = await getDocs(q)
  const batch = cloud.writeBatch(cloud.db)
  snap.docs.forEach((d) => {
    if (d.data().sourceId === id) batch.delete(d.ref)
  })
  await batch.commit()
}

/* ---------------------------------------------------------
   Generated posts (from user content)
--------------------------------------------------------- */
function readLocalPosts() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_POSTS_KEY) || '[]')
  } catch {
    return []
  }
}
function writeLocalPosts(list) {
  localStorage.setItem(LOCAL_POSTS_KEY, JSON.stringify(list))
  notifyLocal('posts', list)
}

export function subscribePosts(onChange) {
  let cancelled = false
  ;(async () => {
    const cloud = await getCloud()
    if (cancelled) return
    if (!cloud) {
      localListeners.posts.add(onChange)
      onChange(readLocalPosts())
      return
    }
    const code = getWorkspaceCode()
    const q = cloud.query(cloud.collection(cloud.db, 'workspaces', code, 'posts'), cloud.orderBy('createdAt', 'desc'))
    const unsub = cloud.onSnapshot(q, (snap) => {
      onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    }, () => onChange(readLocalPosts()))
    cancelled = unsub
  })()
  return () => {
    if (typeof cancelled === 'function') cancelled()
    localListeners.posts.delete(onChange)
    cancelled = true
  }
}

export async function addPosts(sourceId, posts) {
  const cloud = await getCloud()
  if (!cloud) {
    const list = readLocalPosts()
    posts.forEach((p, i) => {
      list.unshift({
        id: `mine-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
        category: 'mine',
        sourceId,
        createdAt: Date.now(),
        ...p,
      })
    })
    writeLocalPosts(list)
    return
  }
  const code = getWorkspaceCode()
  const batch = cloud.writeBatch(cloud.db)
  posts.forEach((p) => {
    const ref = cloud.doc(cloud.collection(cloud.db, 'workspaces', code, 'posts'))
    batch.set(ref, { category: 'mine', sourceId, createdAt: cloud.serverTimestamp(), ...p })
  })
  await batch.commit()
}
