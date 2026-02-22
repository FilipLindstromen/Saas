/**
 * Shared theme (dark/light) for all Saas apps.
 * Uses localStorage key saas-apps-theme. Global across all apps and tabs.
 */
const STORAGE_KEY = 'saas-apps-theme';

const LEGACY_KEYS = [
  'cw_theme',
  'appTheme',
  'typographyTheme',
  'theme',
  'reelRecorderTheme',
  'copywriter_theme',
];

function migrateLegacyTheme() {
  try {
    if (localStorage.getItem(STORAGE_KEY)) return;
    for (const key of LEGACY_KEYS) {
      const val = localStorage.getItem(key);
      if (val === 'light' || val === 'dark') {
        localStorage.setItem(STORAGE_KEY, val);
        return;
      }
    }
  } catch {}
}

export function getTheme() {
  try {
    migrateLegacyTheme();
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
    const prefersDark = typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)')?.matches;
    return prefersDark ? 'dark' : 'light';
  } catch {
    return 'dark';
  }
}

export function setTheme(theme) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('saas-theme-change', { detail: theme }));
    }
  } catch {}
}

/**
 * Call on app mount to sync theme when changed in another tab.
 */
export function initThemeSync() {
  if (typeof window === 'undefined') return;
  const handler = (e) => {
    if (e.key === STORAGE_KEY && (e.newValue === 'light' || e.newValue === 'dark')) {
      document.documentElement.setAttribute('data-theme', e.newValue);
      window.dispatchEvent(new CustomEvent('saas-theme-change', { detail: e.newValue }));
    }
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}

export function applyTheme(theme = getTheme()) {
  setTheme(theme);
}

/**
 * React hook for theme state and toggle.
 * Use: const { theme, setTheme, toggleTheme } = useTheme();
 * @returns {{ theme: string, setTheme: function, toggleTheme: function }}
 */
export function useTheme() {
  if (typeof window === 'undefined') {
    return { theme: 'dark', setTheme: () => {}, toggleTheme: () => {} };
  }
  // Simple non-React version - apps can use getTheme/setTheme directly for vanilla JS
  const theme = getTheme();
  return {
    theme,
    setTheme: (t) => {
      setTheme(t);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('saas-theme-change', { detail: t }));
      }
    },
    toggleTheme: () => {
      const next = theme === 'dark' ? 'light' : 'dark';
      setTheme(next);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('saas-theme-change', { detail: next }));
      }
      return next;
    },
  };
}
