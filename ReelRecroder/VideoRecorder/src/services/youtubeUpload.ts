/**
 * Upload video and optional thumbnail to YouTube using OAuth2 (Google Identity Services).
 * Requires Google Cloud Console: create OAuth 2.0 Client ID (Web application),
 * add your site to Authorized JavaScript origins, and paste the Client ID in Settings.
 */

const YOUTUBE_UPLOAD_SCOPE = 'https://www.googleapis.com/auth/youtube.upload'
const YOUTUBE_SCOPE = 'https://www.googleapis.com/auth/youtube'

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string
            scope: string
            callback: (response: { access_token: string }) => void
          }) => { requestAccessToken: (options?: { prompt?: string }) => void }
        }
      }
    }
  }
}

function loadGsi(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Google Sign-In'))
    document.head.appendChild(script)
  })
}

export function getYouTubeAccessToken(clientId: string): Promise<string> {
  return loadGsi().then(() => {
    return new Promise((resolve, reject) => {
      const client = window.google?.accounts?.oauth2?.initTokenClient({
        client_id: clientId,
        scope: `${YOUTUBE_UPLOAD_SCOPE} ${YOUTUBE_SCOPE}`,
        callback: (response) => {
          if (response.access_token) resolve(response.access_token)
          else reject(new Error('No access token'))
        },
      })
      if (!client) {
        reject(new Error('Google Sign-In not available'))
        return
      }
      client.requestAccessToken({ prompt: 'consent' })
    })
  })
}

export interface YouTubeUploadOptions {
  title: string
  description: string
  privacyStatus?: 'public' | 'private' | 'unlisted'
}

export async function uploadVideoToYouTube(
  accessToken: string,
  videoBlob: Blob,
  options: YouTubeUploadOptions
): Promise<string> {
  const { title, description, privacyStatus = 'private' } = options
  const metadata = {
    snippet: {
      title,
      description,
      categoryId: '22', // People & Blogs
    },
    status: {
      privacyStatus,
    },
  }

  const initRes = await fetch(
    'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(metadata),
    }
  )
  if (!initRes.ok) {
    const err = await initRes.json().catch(() => ({}))
    throw new Error(err.error?.message || initRes.statusText || 'Failed to start upload')
  }
  const uploadUrl = initRes.headers.get('location')
  if (!uploadUrl) throw new Error('No upload URL returned')

  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'video/webm',
      'Content-Length': String(videoBlob.size),
    },
    body: videoBlob,
  })
  if (!uploadRes.ok) {
    const err = await uploadRes.json().catch(() => ({}))
    throw new Error(err.error?.message || uploadRes.statusText || 'Upload failed')
  }
  const data = await uploadRes.json()
  const videoId = data.id
  if (!videoId) throw new Error('No video ID in response')
  return videoId
}

export interface YouTubeChannel {
  id: string
  title: string
}

/** Fetch channels for the authenticated user. Use after getYouTubeAccessToken. */
export async function fetchYouTubeChannels(accessToken: string): Promise<YouTubeChannel[]> {
  const res = await fetch(
    'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || res.statusText || 'Failed to fetch channels')
  }
  const data = await res.json()
  const items = data.items ?? []
  return items.map((c: { id: string; snippet?: { title?: string } }) => ({
    id: c.id,
    title: c.snippet?.title ?? 'Channel',
  }))
}

export async function setYouTubeThumbnail(
  accessToken: string,
  videoId: string,
  thumbnailBlob: Blob
): Promise<void> {
  const res = await fetch(
    `https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${encodeURIComponent(videoId)}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': thumbnailBlob.type || 'image/png',
      },
      body: thumbnailBlob,
    }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || res.statusText || 'Thumbnail upload failed')
  }
}
