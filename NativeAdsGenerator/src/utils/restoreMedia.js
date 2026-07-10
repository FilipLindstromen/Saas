import { fetchVideoAsBlobUrl } from '@shared/stockMedia/pexelsVideo'
import { isRestorableMediaMode, loadBlob } from './projectStorage'

function loadImageFromObjectUrl(url, { keepUrl = false } = {}) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      if (!keepUrl) URL.revokeObjectURL(url)
      resolve({ element: img, url: keepUrl ? url : null })
    }
    img.onerror = () => {
      if (!keepUrl) URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    }
    img.src = url
  })
}

function loadVideoFromObjectUrl(url) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.loop = true
    video.onloadeddata = () => {
      video.play().catch(() => {})
      resolve({ element: video, url })
    }
    video.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load video'))
    }
    video.src = url
  })
}

async function loadVideoFromExternalUrl(url) {
  const isExternal = url.startsWith('http://') || url.startsWith('https://')
  const blobUrl = isExternal ? await fetchVideoAsBlobUrl(url) : url
  const { element, url: objectUrl } = await loadVideoFromObjectUrl(blobUrl)
  return { element, url: objectUrl }
}

export async function restoreMediaFromPersisted(persisted) {
  if (!persisted?.mode || !isRestorableMediaMode(persisted.mode)) {
    return null
  }

  const { mode } = persisted

  if (mode === 'pexels-video' && persisted.externalUrl) {
    const { element, url } = await loadVideoFromExternalUrl(persisted.externalUrl)
    return { element, url, mode, playing: true }
  }

  if (!persisted.blobKey) return null
  const blob = await loadBlob(persisted.blobKey)
  if (!blob) return null

  const objectUrl = URL.createObjectURL(blob)

  if (mode === 'upload-video') {
    const { element, url } = await loadVideoFromObjectUrl(objectUrl)
    return { element, url, mode, playing: true }
  }

  const { element, url } = await loadImageFromObjectUrl(objectUrl, { keepUrl: true })
  return { element, url: url || objectUrl, mode, playing: false }
}

export async function restoreMusicFromPersisted(persisted) {
  if (!persisted?.blobKey) return null
  const blob = await loadBlob(persisted.blobKey)
  if (!blob) return null
  const url = URL.createObjectURL(blob)
  return { name: persisted.name || 'Background music', url }
}
