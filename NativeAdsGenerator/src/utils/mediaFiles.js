const VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'webm', 'm4v', 'avi', 'mkv', 'ogv', 'mpeg', 'mpg'])

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'avif'])

export function isVideoFile(file) {
  if (!file) return false
  if (file.type?.startsWith('video/')) return true
  const ext = file.name?.split('.').pop()?.toLowerCase()
  return ext ? VIDEO_EXTENSIONS.has(ext) : false
}

export function isImageFile(file) {
  if (!file) return false
  if (file.type?.startsWith('image/')) return true
  const ext = file.name?.split('.').pop()?.toLowerCase()
  return ext ? IMAGE_EXTENSIONS.has(ext) : false
}

export const VIDEO_FILE_ACCEPT = 'video/*,.mp4,.mov,.webm,.m4v,.avi,.mkv'

export function loadVideoElement(url, { revokeOnError = true } = {}) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.loop = true
    video.preload = 'auto'

    let settled = false
    const finish = (fn) => {
      if (settled) return
      settled = true
      cleanup()
      fn()
    }

    const onReady = () => {
      video.play().catch(() => {})
      finish(() => resolve(video))
    }

    const onError = () => {
      finish(() => {
        if (revokeOnError) URL.revokeObjectURL(url)
        reject(new Error('Failed to load video. Try MP4 or WebM format.'))
      })
    }

    const cleanup = () => {
      video.removeEventListener('loadeddata', onReady)
      video.removeEventListener('canplay', onReady)
      video.removeEventListener('error', onError)
    }

    video.addEventListener('loadeddata', onReady)
    video.addEventListener('canplay', onReady)
    video.addEventListener('error', onError)
    video.src = url
    video.load()
  })
}

export function loadVideoFromFile(file) {
  const url = URL.createObjectURL(file)
  return loadVideoElement(url).then((video) => ({ video, url }))
}
