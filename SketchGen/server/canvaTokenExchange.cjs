/**
 * Server-side Canva OAuth token exchange (requires client secret).
 * Used by Vite dev middleware and the Electron static UI server.
 */

async function exchangeCanvaToken(payload) {
  const clientId = process.env.CANVA_CLIENT_ID
  const clientSecret = process.env.CANVA_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    const err = new Error('Canva is not configured on the server. Add CANVA_CLIENT_ID and CANVA_CLIENT_SECRET to the repo root .env.')
    err.code = 'CANVA_NOT_CONFIGURED'
    throw err
  }

  const body = new URLSearchParams()
  if (payload.grantType === 'authorization_code') {
    body.set('grant_type', 'authorization_code')
    body.set('code', payload.code)
    body.set('redirect_uri', payload.redirectUri)
    body.set('code_verifier', payload.codeVerifier)
  } else if (payload.grantType === 'refresh_token') {
    body.set('grant_type', 'refresh_token')
    body.set('refresh_token', payload.refreshToken)
  } else {
    throw new Error('Unsupported grant type')
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const res = await fetch('https://api.canva.com/rest/v1/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basic}`,
    },
    body,
  })

  const text = await res.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    data = { raw: text }
  }
  if (!res.ok) {
    const msg = data?.error_description || data?.message || text || res.statusText
    const err = new Error(msg)
    err.status = res.status
    throw err
  }
  return data
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk
      if (raw.length > 1_000_000) {
        reject(new Error('Body too large'))
        req.destroy()
      }
    })
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {})
      } catch {
        reject(new Error('Invalid JSON body'))
      }
    })
    req.on('error', reject)
  })
}

async function handleCanvaTokenRequest(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    })
    res.end()
    return
  }
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Method not allowed' }))
    return
  }

  try {
    const payload = await readJsonBody(req)
    const grantType = payload.grantType || payload.grant_type
    const data = await exchangeCanvaToken({
      grantType,
      code: payload.code,
      codeVerifier: payload.codeVerifier || payload.code_verifier,
      redirectUri: payload.redirectUri || payload.redirect_uri,
      refreshToken: payload.refreshToken || payload.refresh_token,
    })
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    })
    res.end(JSON.stringify(data))
  } catch (err) {
    const status = err.code === 'CANVA_NOT_CONFIGURED' ? 503 : err.status || 500
    res.writeHead(status, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    })
    res.end(JSON.stringify({ error: err.message || 'Token exchange failed' }))
  }
}

module.exports = { exchangeCanvaToken, handleCanvaTokenRequest }
