/**
 * Instagram Graph API – video (Reels) publishing.
 * Auth via Facebook JavaScript SDK (popup flow, no backend required).
 * Video upload uses Meta's Resumable Upload API.
 */

declare global {
  interface Window {
    FB?: {
      init: (cfg: object) => void
      login: (cb: (res: { authResponse?: { accessToken: string; userID: string } }) => void, opts: object) => void
      api: (path: string, method: string, params: object, cb: (res: unknown) => void) => void
    }
    fbAsyncInit?: () => void
  }
}

function loadFbSdk(appId: string): Promise<void> {
  if (window.FB) return Promise.resolve()
  return new Promise((resolve) => {
    window.fbAsyncInit = function () {
      window.FB!.init({ appId, xfbml: false, version: 'v19.0' })
      resolve()
    }
    const script = document.createElement('script')
    script.src = 'https://connect.facebook.net/en_US/sdk.js'
    script.async = true
    document.head.appendChild(script)
  })
}

export async function connectInstagram(
  appId: string
): Promise<{ accessToken: string; userId: string; igUserId: string; displayName: string }> {
  if (!appId) throw new Error('Instagram App ID is not set. Open Settings to add it.')
  await loadFbSdk(appId)

  const { accessToken, userId } = await new Promise<{ accessToken: string; userId: string }>((resolve, reject) => {
    window.FB!.login(
      (response) => {
        if (response.authResponse) {
          resolve({ accessToken: response.authResponse.accessToken, userId: response.authResponse.userID })
        } else {
          reject(new Error('Instagram login was cancelled or denied'))
        }
      },
      { scope: 'instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement' }
    )
  })

  // Get Facebook Pages with their tokens
  const pagesRes = await fetch(
    `https://graph.facebook.com/v19.0/me/accounts?access_token=${accessToken}`
  )
  const pagesData = await pagesRes.json()

  for (const page of (pagesData.data as Array<{ id: string; access_token: string }>) || []) {
    const igRes = await fetch(
      `https://graph.facebook.com/v19.0/${page.id}?fields=instagram_business_account&access_token=${page.access_token}`
    )
    const igData = await igRes.json()

    if (igData.instagram_business_account?.id) {
      const igId: string = igData.instagram_business_account.id
      const userRes = await fetch(
        `https://graph.facebook.com/v19.0/${igId}?fields=name,username&access_token=${page.access_token}`
      )
      const userData = await userRes.json()
      return {
        accessToken: page.access_token,
        userId,
        igUserId: igId,
        displayName: userData.name || userData.username || 'Instagram Account',
      }
    }
  }

  throw new Error(
    'No Instagram Business or Creator account found.\n' +
    'Make sure your Instagram is connected to a Facebook Page and is a Business or Creator account.'
  )
}

export async function uploadToInstagram(
  accessToken: string,
  igUserId: string,
  videoFile: File,
  options: {
    caption: string
    publishAt?: string
    onProgress?: (pct: number) => void
  }
): Promise<string> {
  options.onProgress?.(5)

  // Step 1: Create media container with resumable upload
  const body: Record<string, string | number> = {
    media_type: 'REELS',
    upload_type: 'resumable',
    caption: options.caption,
    access_token: accessToken,
  }
  if (options.publishAt) {
    body.scheduled_publish_time = Math.floor(new Date(options.publishAt).getTime() / 1000)
    body.publish_type = 'SCHEDULED'
  }

  const initRes = await fetch(`https://graph.facebook.com/v19.0/${igUserId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!initRes.ok) {
    const err = await initRes.json().catch(() => ({}))
    throw new Error((err as { error?: { message?: string } }).error?.message || 'Failed to create Instagram media container')
  }

  const { id: containerId, uri: uploadUri } = await initRes.json()
  options.onProgress?.(15)

  if (!uploadUri) throw new Error('No upload URI received from Instagram')

  // Step 2: Upload video bytes to Meta's resumable upload endpoint
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', uploadUri)
    xhr.setRequestHeader('Authorization', `OAuth ${accessToken}`)
    xhr.setRequestHeader('offset', '0')
    xhr.setRequestHeader('file_size', String(videoFile.size))

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && options.onProgress) {
        options.onProgress(15 + Math.round((e.loaded / e.total) * 65))
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new Error(`Instagram upload failed: HTTP ${xhr.status}`))
    }
    xhr.onerror = () => reject(new Error('Network error during Instagram upload'))
    xhr.send(videoFile)
  })

  options.onProgress?.(80)

  // Step 3: Poll for processing to finish
  let statusCode = ''
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 3000))
    const statusRes = await fetch(
      `https://graph.facebook.com/v19.0/${containerId}?fields=status_code,status&access_token=${accessToken}`
    )
    const statusData = await statusRes.json()
    statusCode = statusData.status_code
    if (statusCode === 'FINISHED') break
    if (statusCode === 'ERROR') throw new Error('Instagram video processing failed: ' + (statusData.status || 'unknown error'))
  }

  if (statusCode !== 'FINISHED') throw new Error('Instagram video processing timed out')
  options.onProgress?.(90)

  // Step 4: Publish (skip if scheduled)
  if (!options.publishAt) {
    const publishRes = await fetch(`https://graph.facebook.com/v19.0/${igUserId}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creation_id: containerId, access_token: accessToken }),
    })

    if (!publishRes.ok) {
      const err = await publishRes.json().catch(() => ({}))
      throw new Error((err as { error?: { message?: string } }).error?.message || 'Failed to publish to Instagram')
    }

    const { id: mediaId } = await publishRes.json()
    options.onProgress?.(100)
    return mediaId
  }

  options.onProgress?.(100)
  return containerId
}
