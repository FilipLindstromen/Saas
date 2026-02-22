/**
 * Shared API keys for Saas Apps dashboard.
 * Uses same localStorage key (saasApiKeys) as all Saas apps.
 * Keys are stored locally only - never sent to our servers.
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

  window.SaasApiKeys = {
    load: function () {
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
    },

    save: function (keys) {
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
  };
})();
