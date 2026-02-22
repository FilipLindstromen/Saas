/**
 * Centralized API key storage for all Saas apps.
 * Keys are stored in a single localStorage entry so you only need to enter them once.
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
 * Load all API keys. Migrates from legacy storage on first load.
 * @returns {{ openai, giphy, pixabay, pexels, unsplash, googleClientId }}
 */
export function loadApiKeys() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return { ...DEFAULT_KEYS, ...parsed }
    }
    const migrated = migrateFromLegacy()
    saveApiKeys(migrated)
    return migrated
  } catch (e) {
    return { ...DEFAULT_KEYS }
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
