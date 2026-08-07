export const CANVA_SCOPES = 'asset:write profile:read'

export function getCanvaClientId() {
  return import.meta.env.VITE_CANVA_CLIENT_ID || ''
}

/** Optional absolute base for token proxy (defaults to same origin). */
export function getCanvaApiBase() {
  const base = import.meta.env.VITE_CANVA_API_BASE
  if (base) return String(base).replace(/\/$/, '')
  return ''
}

export function getCanvaRedirectUri() {
  if (import.meta.env.VITE_CANVA_REDIRECT_URI) {
    return String(import.meta.env.VITE_CANVA_REDIRECT_URI).replace(/\/$/, '')
  }
  const { origin, pathname } = window.location
  const path = pathname.replace(/\/index\.html$/i, '').replace(/\/$/, '')
  return path ? `${origin}${path}` : origin
}

export function isCanvaClientConfigured() {
  return Boolean(getCanvaClientId())
}

export function canvaProjectsUrl() {
  return 'https://www.canva.com/projects'
}
