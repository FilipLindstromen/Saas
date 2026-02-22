/**
 * Shared API keys - uses same storage as PitchDeck, InfoGraphics, etc.
 * Keys are stored once and shared across all Saas apps.
 */
(function (global) {
  const STORAGE_KEY = 'saasApiKeys';
  const DEFAULT_KEYS = { openai: '', giphy: '', pixabay: '', pexels: '', unsplash: '', googleClientId: '' };

  function loadApiKeys() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return Object.assign({}, DEFAULT_KEYS, parsed);
      }
      return Object.assign({}, DEFAULT_KEYS);
    } catch (e) {
      return Object.assign({}, DEFAULT_KEYS);
    }
  }

  function saveApiKeys(keys) {
    try {
      var current = loadApiKeys();
      var next = Object.assign({}, current, keys);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    } catch (e) {
      console.error('Failed to save API keys:', e);
    }
  }

  global.ConversationApiKeys = { loadApiKeys, saveApiKeys };
})(typeof window !== 'undefined' ? window : this);
