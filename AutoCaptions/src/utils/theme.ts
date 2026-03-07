// @ts-ignore - shared
import { getTheme, setTheme, initThemeSync, applyTheme } from '@shared/theme'

export type Theme = 'light' | 'dark'

export function getStoredTheme(): Theme {
  return getTheme() as Theme
}

export function setStoredTheme(theme: Theme) {
  setTheme(theme)
}

export { initThemeSync, applyTheme }
