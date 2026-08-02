/**
 * Shared API keys - uses same storage as other Saas apps (saasApiKeys).
 * Typography loads this before app.js; exposes loadApiKeys/saveApiKeys on window.
 */
(function () {
  const STORAGE_KEY = 'saasApiKeys';
  const DEFAULT_KEYS = {
    openai: '',
    giphy: '',
    pixabay: '',
    pexels: '',
    unsplash: '',
    googleClientId: ''
  };

  function loadApiKeys() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return { ...DEFAULT_KEYS, ...parsed };
      }
      return { ...DEFAULT_KEYS };
    } catch (e) {
      return { ...DEFAULT_KEYS };
    }
  }

  function saveApiKeys(keys) {
    try {
      let current = { ...DEFAULT_KEYS };
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        current = { ...current, ...parsed };
      }
      const next = { ...current, ...keys };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    } catch (e) {
      console.error('Failed to save API keys:', e);
    }
  }

  window.loadApiKeys = loadApiKeys;
  window.saveApiKeys = saveApiKeys;
})();
