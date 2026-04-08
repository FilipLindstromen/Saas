/**
 * YouTube Data API v3 – OAuth via Google Identity Services.
 * Works entirely from the browser (no backend required).
 */

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (cfg: object) => { requestAccessToken: (opts?: object) => void }
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

export async function connectYouTube(clientId: string): Promise<{ accessToken: string; displayName: string }> {
  if (!clientId) throw new Error('YouTube Client ID is not set. Open Settings to add it.')
  await loadGsi()

  const scope = [
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube.readonly',
  ].join(' ')

  return new Promise((resolve, reject) => {
    const client = window.google!.accounts!.oauth2!.initTokenClient({
      client_id: clientId,
      scope,
      callback: async (response: { access_token?: string; error?: string }) => {
        if (!response.access_token) {
          reject(new Error(response.error || 'No access token received'))
          return
        }
        try {
          const res = await fetch(
            'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
            { headers: { Authorization: `Bearer ${response.access_token}` } }
          )
          const data = await res.json()
          const channel = data.items?.[0]
          resolve({
            accessToken: response.access_token,
            displayName: channel?.snippet?.title || 'YouTube Channel',
          })
        } catch {
          resolve({ accessToken: response.access_token!, displayName: 'YouTube Channel' })
        }
      },
    })
    client.requestAccessToken({ prompt: 'consent' })
  })
}

export async function uploadToYouTube(
  accessToken: string,
  videoFile: File,
  options: {
    title: string
    description: string
    privacyStatus: string
    publishAt?: string
    onProgress?: (pct: number) => void
  }
): Promise<string> {
  const metadata = {
    snippet: {
      title: options.title || videoFile.name.replace(/\.[^.]+$/, ''),
      description: options.description,
      categoryId: '22',
    },
    status: {
      privacyStatus: options.privacyStatus,
      ...(options.publishAt ? { publishAt: options.publishAt } : {}),
    },
  }

  const initRes = await fetch(
    'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Upload-Content-Type': videoFile.type || 'video/mp4',
        'X-Upload-Content-Length': String(videoFile.size),
      },
      body: JSON.stringify(metadata),
    }
  )

  if (!initRes.ok) {
    const err = await initRes.json().catch(() => ({}))
    throw new Error((err as { error?: { message?: string } }).error?.message || initRes.statusText || 'Failed to start YouTube upload')
  }

  const uploadUrl = initRes.headers.get('location')
  if (!uploadUrl) throw new Error('No upload URL returned from YouTube')

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', uploadUrl)
    xhr.setRequestHeader('Content-Type', videoFile.type || 'video/mp4')

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && options.onProgress) {
        options.onProgress(Math.round((e.loaded / e.total) * 100))
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText)
          if (data.id) resolve(data.id)
          else reject(new Error('No video ID in YouTube response'))
        } catch {
          reject(new Error('Invalid response from YouTube'))
        }
      } else {
        reject(new Error(`YouTube upload failed: ${xhr.status} ${xhr.statusText}`))
      }
    }

    xhr.onerror = () => reject(new Error('Network error during YouTube upload'))
    xhr.send(videoFile)
  })
}
