const THEME_KEY = 'reelRecorderTheme'

export type Theme = 'dark' | 'light'

export function getStoredTheme(): Theme {
  if (typeof window === 'undefined' || !window.localStorage) return 'dark'
  try {
    const stored = window.localStorage.getItem(THEME_KEY) as Theme | null
    return stored === 'light' || stored === 'dark' ? stored : 'dark'
  } catch {
    return 'dark'
  }
}

export function setStoredTheme(theme: Theme): void {
  if (typeof window === 'undefined' || !window.localStorage) return
  try {
    window.localStorage.setItem(THEME_KEY, theme)
  } catch (e) {
    console.warn('Could not save theme:', e)
  }
}

export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-theme', theme)
}
