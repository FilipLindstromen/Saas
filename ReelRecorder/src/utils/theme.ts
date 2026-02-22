export type Theme = 'dark' | 'light'

// Re-export from shared theme for global sync across all Saas apps
export {
  getTheme as getStoredTheme,
  setTheme as setStoredTheme,
  applyTheme,
  initThemeSync,
} from '@shared/theme'
