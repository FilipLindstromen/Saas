/**
 * TikTok Content Posting API v2 – OAuth 2.0 with PKCE.
 * The OAuth flow uses a browser redirect; the token exchange uses PKCE
 * so no client secret is required client-side.
 *
 * Note: TikTok's token endpoint (open.tiktokapis.com/v2/oauth/token/) may
 * block cross-origin requests in some browser configurations. If this occurs,
 * a lightweight server-side proxy is required for that single endpoint.
 */

const TIKTOK_OAUTH_STATE = 'tiktok_oauth_v2'
const VERIFIER_KEY = 'uploader_tiktok_cv'

// --- PKCE helpers ---

async function generateCodeVerifier(): Promise<string> {
  const arr = new Uint8Array(40)
  crypto.getRandomValues(arr)
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
    .slice(0, 64)
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

// --- OAuth ---

export async function initiateTikTokOAuth(clientKey: string): Promise<void> {
  if (!clientKey) throw new Error('TikTok Client Key is not set. Open Settings to add it.')

  const verifier = await generateCodeVerifier()
  const challenge = await generateCodeChallenge(verifier)
  sessionStorage.setItem(VERIFIER_KEY, verifier)

  const redirectUri = window.location.origin + window.location.pathname

  const params = new URLSearchParams({
    client_key: clientKey,
    scope: 'user.info.basic,video.upload,video.publish',
    response_type: 'code',
    redirect_uri: redirectUri,
    state: TIKTOK_OAUTH_STATE,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  })

  window.location.href = `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`
}

export async function completeTikTokOAuth(
  code: string,
  clientKey: string
): Promise<{ accessToken: string; displayName: string; userId: string }> {
  const verifier = sessionStorage.getItem(VERIFIER_KEY)
  if (!verifier) throw new Error('OAuth session expired. Please try connecting again.')
  sessionStorage.removeItem(VERIFIER_KEY)

  const redirectUri = window.location.origin + window.location.pathname

  const tokenRes = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: clientKey,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code_verifier: verifier,
    }).toString(),
  })

  if (!tokenRes.ok) {
    const text = await tokenRes.text()
    throw new Error(`TikTok token exchange failed: ${text}`)
  }

  const tokenData = await tokenRes.json()
  const accessToken: string = tokenData.access_token

  // Fetch basic user info
  const userRes = await fetch(
    'https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  const userData = await userRes.json()
  const user = userData.data?.user

  return {
    accessToken,
    displayName: user?.display_name || 'TikTok User',
    userId: user?.open_id || '',
  }
}

// --- Upload ---

export async function uploadToTikTok(
  accessToken: string,
  videoFile: File,
  options: {
    caption: string
    publishAt?: string
    onProgress?: (pct: number) => void
  }
): Promise<string> {
  options.onProgress?.(5)

  // Step 1: Init upload
  const initBody = {
    post_info: {
      title: options.caption.slice(0, 150) || 'New video',
      description: options.caption,
      privacy_level: 'PUBLIC_TO_EVERYONE',
      ...(options.publishAt
        ? { scheduled_publish_time: Math.floor(new Date(options.publishAt).getTime() / 1000) }
        : {}),
    },
    source_info: {
      source: 'FILE_UPLOAD',
      video_size: videoFile.size,
      chunk_size: videoFile.size,
      total_chunk_count: 1,
    },
  }

  const initRes = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify(initBody),
  })

  if (!initRes.ok) {
    const err = await initRes.json().catch(() => ({}))
    throw new Error(
      (err as { error?: { message?: string } }).error?.message ||
      `TikTok init failed: HTTP ${initRes.status}`
    )
  }

  const initData = await initRes.json()
  const publishId: string = initData.data?.publish_id
  const uploadUrl: string = initData.data?.upload_url

  if (!uploadUrl) throw new Error('No upload URL received from TikTok')
  options.onProgress?.(15)

  // Step 2: Upload video chunk
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', uploadUrl)
    xhr.setRequestHeader('Content-Range', `bytes 0-${videoFile.size - 1}/${videoFile.size}`)
    xhr.setRequestHeader('Content-Type', videoFile.type || 'video/mp4')

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && options.onProgress) {
        options.onProgress(15 + Math.round((e.loaded / e.total) * 70))
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new Error(`TikTok upload failed: HTTP ${xhr.status}`))
    }
    xhr.onerror = () => reject(new Error('Network error during TikTok upload'))
    xhr.send(videoFile)
  })

  options.onProgress?.(85)

  // Step 3: Poll for publish status
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 3000))

    const statusRes = await fetch('https://open.tiktokapis.com/v2/post/publish/status/fetch/', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify({ publish_id: publishId }),
    })
    const statusData = await statusRes.json()
    const status: string = statusData.data?.status

    if (status === 'PUBLISH_COMPLETE') break
    if (status === 'FAILED') throw new Error('TikTok video publishing failed')
  }

  options.onProgress?.(100)
  return publishId
}

export { TIKTOK_OAUTH_STATE }
