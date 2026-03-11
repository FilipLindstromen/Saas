/**
 * Centralized API key storage for all Saas apps.
 * On localhost, API keys are read from the root .env first; then localStorage.
 * In production, use your host's env (e.g. Vercel) or localStorage.
 *
 * Security: Keys are stored locally in your browser only. They are never sent to our servers.
 * They are only used when you make requests to the respective APIs (OpenAI, Unsplash, etc.).
 */

const STORAGE_KEY = 'saasApiKeys'

const DEFAULT_KEYS = {
  openai: '',
  giphy: '',
  pixabay: '',
  pexels: '',
  unsplash: '',
  googleClientId: '',
  elevenlabs: ''
}

/** Read API keys from environment (root .env on localhost). Only returns keys that are set. */
function getEnvKeys() {
  const out = {}
  try {
    // Vite: import.meta.env.VITE_*
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      const e = import.meta.env
      if (e.VITE_OPENAI_API_KEY) out.openai = String(e.VITE_OPENAI_API_KEY).trim()
      if (e.VITE_GIPHY_API_KEY) out.giphy = String(e.VITE_GIPHY_API_KEY).trim()
      if (e.VITE_PIXABAY_API_KEY) out.pixabay = String(e.VITE_PIXABAY_API_KEY).trim()
      if (e.VITE_PEXELS_API_KEY) out.pexels = String(e.VITE_PEXELS_API_KEY).trim()
      if (e.VITE_UNSPLASH_ACCESS_KEY) out.unsplash = String(e.VITE_UNSPLASH_ACCESS_KEY).trim()
      if (e.VITE_ELEVENLABS_API_KEY) out.elevenlabs = String(e.VITE_ELEVENLABS_API_KEY).trim()
      if (e.VITE_GOOGLE_CLIENT_ID) out.googleClientId = String(e.VITE_GOOGLE_CLIENT_ID).trim()
    }
    // Next.js client: process.env.NEXT_PUBLIC_*
    if (typeof process !== 'undefined' && process.env) {
      const e = process.env
      if (e.NEXT_PUBLIC_OPENAI_API_KEY) out.openai = out.openai || String(e.NEXT_PUBLIC_OPENAI_API_KEY).trim()
      if (e.NEXT_PUBLIC_GIPHY_API_KEY) out.giphy = out.giphy || String(e.NEXT_PUBLIC_GIPHY_API_KEY).trim()
      if (e.NEXT_PUBLIC_PIXABAY_API_KEY) out.pixabay = out.pixabay || String(e.NEXT_PUBLIC_PIXABAY_API_KEY).trim()
      if (e.NEXT_PUBLIC_PEXELS_API_KEY) out.pexels = out.pexels || String(e.NEXT_PUBLIC_PEXELS_API_KEY).trim()
      if (e.NEXT_PUBLIC_UNSPLASH_ACCESS_KEY) out.unsplash = out.unsplash || String(e.NEXT_PUBLIC_UNSPLASH_ACCESS_KEY).trim()
      if (e.NEXT_PUBLIC_ELEVENLABS_API_KEY) out.elevenlabs = out.elevenlabs || String(e.NEXT_PUBLIC_ELEVENLABS_API_KEY).trim()
      if (e.NEXT_PUBLIC_GOOGLE_CLIENT_ID) out.googleClientId = out.googleClientId || String(e.NEXT_PUBLIC_GOOGLE_CLIENT_ID).trim()
    }
  } catch (err) {
    // ignore
  }
  return out
}

/** Migrate keys from legacy app-specific storage into the shared store. */
function migrateFromLegacy() {
  const merged = { ...DEFAULT_KEYS }
  try {
    // PitchDeck (individual keys)
    const openaiKey = localStorage.getItem('openaiKey')
    const unsplashKey = localStorage.getItem('unsplashKey')
    const pexelsKey = localStorage.getItem('pexelsKey')
    const pixabayKey = localStorage.getItem('pixabayKey')
    const googleClientId = localStorage.getItem('googleClientId')
    if (openaiKey) merged.openai = openaiKey
    if (unsplashKey) merged.unsplash = unsplashKey
    if (pexelsKey) merged.pexels = pexelsKey
    if (pixabayKey) merged.pixabay = pixabayKey
    if (googleClientId) merged.googleClientId = googleClientId

    // InfoGraphics
    const infographicsRaw = localStorage.getItem('infographicsApiKeys')
    if (infographicsRaw) {
      const parsed = JSON.parse(infographicsRaw)
      if (parsed.openai) merged.openai = merged.openai || parsed.openai
      if (parsed.giphy) merged.giphy = merged.giphy || parsed.giphy
      if (parsed.pixabay) merged.pixabay = merged.pixabay || parsed.pixabay
      if (parsed.pexels) merged.pexels = merged.pexels || parsed.pexels
    }

    // ColorWriter (legacy openai_api_key)
    const cwOpenai = localStorage.getItem('openai_api_key')
    if (cwOpenai) merged.openai = merged.openai || cwOpenai

    // StoryWriter
    const swRaw = localStorage.getItem('storywriter_settings')
    if (swRaw) {
      const parsed = JSON.parse(swRaw)
      if (parsed.openaiApiKey) merged.openai = merged.openai || parsed.openaiApiKey
      if (parsed.unsplashAccessKey) merged.unsplash = merged.unsplash || parsed.unsplashAccessKey
    }

    // PowerWriter
    const pwOpenai = localStorage.getItem('powerwriter.openaiKey')
    if (pwOpenai) merged.openai = merged.openai || pwOpenai

    // VideoQuiz
    const vqOpenai = localStorage.getItem('openaiApiKey')
    if (vqOpenai) merged.openai = merged.openai || vqOpenai

    // CopyWriter
    const cwApiKey = localStorage.getItem('copywriter_api_key')
    if (cwApiKey) merged.openai = merged.openai || cwApiKey

    // ContentGenerator
    const cgOpenai = localStorage.getItem('contentgenerator_openai_key')
    if (cgOpenai) merged.openai = merged.openai || cgOpenai

    // VSLWriter
    const vslOpenai = localStorage.getItem('vsl_openai_key') || localStorage.getItem('openai_api_key')
    if (vslOpenai) merged.openai = merged.openai || vslOpenai

    // VIdeoRecorder
    const vrOpenai = localStorage.getItem('openai_api_key')
    if (vrOpenai) merged.openai = merged.openai || vrOpenai

    // ReelRecorder (videoRecorder_* keys)
    const rrOpenai = localStorage.getItem('videoRecorder_openaiApiKey')
    const rrGoogle = localStorage.getItem('videoRecorder_googleClientId')
    const rrUnsplash = localStorage.getItem('videoRecorder_unsplashAccessKey')
    const rrPexels = localStorage.getItem('videoRecorder_pexelsApiKey')
    const rrPixabay = localStorage.getItem('videoRecorder_pixabayApiKey')
    const rrGiphy = localStorage.getItem('videoRecorder_giphyApiKey')
    if (rrOpenai) merged.openai = merged.openai || rrOpenai
    if (rrGoogle) merged.googleClientId = merged.googleClientId || rrGoogle
    if (rrUnsplash) merged.unsplash = merged.unsplash || rrUnsplash
    if (rrPexels) merged.pexels = merged.pexels || rrPexels
    if (rrPixabay) merged.pixabay = merged.pixabay || rrPixabay
    if (rrGiphy) merged.giphy = merged.giphy || rrGiphy

    // SoundEffectsGenerator
    const seRaw = localStorage.getItem('soundeffects_settings')
    if (seRaw) {
      try {
        const parsed = JSON.parse(seRaw)
        if (parsed.openaiApiKey) merged.openai = merged.openai || parsed.openaiApiKey
        if (parsed.elevenlabsApiKey) merged.elevenlabs = merged.elevenlabs || parsed.elevenlabsApiKey
      } catch {}
    }

    return merged
  } catch (e) {
    return merged
  }
}

/**
 * Load all API keys. Env (root .env on localhost) overrides localStorage.
 * Migrates from legacy storage on first load when nothing in storage.
 * @returns {{ openai, giphy, pixabay, pexels, unsplash, googleClientId, elevenlabs }}
 */
export function loadApiKeys() {
  try {
    const envKeys = getEnvKeys()
    let fromStorage = { ...DEFAULT_KEYS }
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      fromStorage = { ...DEFAULT_KEYS, ...JSON.parse(raw) }
    } else {
      const migrated = migrateFromLegacy()
      saveApiKeys(migrated)
      fromStorage = { ...DEFAULT_KEYS, ...migrated }
    }
    return { ...fromStorage, ...envKeys }
  } catch (e) {
    return { ...DEFAULT_KEYS, ...getEnvKeys() }
  }
}

/**
 * Save API keys. Overwrites only the keys you provide.
 * @param {Partial<typeof DEFAULT_KEYS>} keys
 */
export function saveApiKeys(keys) {
  try {
    let current = { ...DEFAULT_KEYS }
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      current = { ...current, ...parsed }
    }
    const next = { ...current, ...keys }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    return next
  } catch (e) {
    console.error('Failed to save API keys:', e)
  }
}

/**
 * Get a single key by name.
 * @param {keyof typeof DEFAULT_KEYS} keyName
 * @returns {string}
 */
export function getApiKey(keyName) {
  const keys = loadApiKeys()
  return keys[keyName] || ''
}
