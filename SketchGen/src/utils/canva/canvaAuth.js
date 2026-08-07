import {
  CANVA_SCOPES,
  getCanvaApiBase,
  getCanvaClientId,
  getCanvaRedirectUri,
} from './canvaConfig'

const STORAGE_KEY = 'sketchgen-canva-tokens'
const PKCE_KEY = 'sketchgen-canva-pkce'

function loadStoredTokens() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveStoredTokens(tokens) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens))
}

export function clearCanvaConnection() {
  localStorage.removeItem(STORAGE_KEY)
  sessionStorage.removeItem(PKCE_KEY)
}

export function isCanvaConnected() {
  const t = loadStoredTokens()
  return Boolean(t?.access_token)
}

export function getCanvaConnectionSummary() {
  const t = loadStoredTokens()
  if (!t?.access_token) return null
  return {
    connectedAt: t.connected_at,
    expiresAt: t.expires_at,
  }
}

function randomUrlSafe(bytes = 32) {
  const arr = new Uint8Array(bytes)
  crypto.getRandomValues(arr)
  return btoa(String.fromCharCode(...arr)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function sha256Base64Url(value) {
  const data = new TextEncoder().encode(value)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

async function tokenRequest(body) {
  const url = `${getCanvaApiBase()}/api/canva/token`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error || data.error_description || 'Could not connect to Canva.')
  }
  return data
}

function normalizeTokenResponse(data) {
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token || loadStoredTokens()?.refresh_token,
    expires_at: Date.now() + (Number(data.expires_in) || 3600) * 1000,
    connected_at: Date.now(),
  }
}

export async function startCanvaOAuthRedirect() {
  const clientId = getCanvaClientId()
  if (!clientId) {
    throw new Error('Canva client ID is not configured (VITE_CANVA_CLIENT_ID).')
  }
  const verifier = randomUrlSafe(48)
  const challenge = await sha256Base64Url(verifier)
  const state = randomUrlSafe(16)
  sessionStorage.setItem(PKCE_KEY, JSON.stringify({ verifier, state }))
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getCanvaRedirectUri(),
    response_type: 'code',
    scope: CANVA_SCOPES,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  })
  window.location.assign(`https://www.canva.com/api/oauth/authorize?${params.toString()}`)
}

export async function completeCanvaOAuthFromRedirect() {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  const state = params.get('state')
  const error = params.get('error')
  if (error) {
    throw new Error(params.get('error_description') || error)
  }
  if (!code) return false

  const raw = sessionStorage.getItem(PKCE_KEY)
  sessionStorage.removeItem(PKCE_KEY)
  if (!raw) throw new Error('Canva sign-in expired. Try connecting again.')
  const { verifier, state: expected } = JSON.parse(raw)
  if (state !== expected) throw new Error('Canva sign-in state mismatch. Try again.')

  const data = await tokenRequest({
    grantType: 'authorization_code',
    code,
    codeVerifier: verifier,
    redirectUri: getCanvaRedirectUri(),
  })
  saveStoredTokens(normalizeTokenResponse(data))

  const clean = `${window.location.origin}${window.location.pathname}${window.location.hash || ''}`
  window.history.replaceState({}, '', clean)
  return true
}

export async function getCanvaAccessToken() {
  let tokens = loadStoredTokens()
  if (!tokens?.access_token) return null
  if (tokens.expires_at && Date.now() < tokens.expires_at - 60_000) {
    return tokens.access_token
  }
  if (!tokens.refresh_token) {
    clearCanvaConnection()
    return null
  }
  const data = await tokenRequest({
    grantType: 'refresh_token',
    refreshToken: tokens.refresh_token,
  })
  tokens = normalizeTokenResponse({ ...data, refresh_token: data.refresh_token || tokens.refresh_token })
  saveStoredTokens(tokens)
  return tokens.access_token
}
