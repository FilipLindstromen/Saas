import { drawAd } from './adCompositor'

const FPS = 30

const MIME_CANDIDATES = [
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
]

function pickMimeType() {
  return MIME_CANDIDATES.find((t) => MediaRecorder.isTypeSupported(t)) || 'video/webm'
}

function waitForMetadata(video) {
  if (video.readyState >= 1 && Number.isFinite(video.duration)) {
    return Promise.resolve()
  }
  return new Promise((resolve, reject) => {
    const onMeta = () => {
      cleanup()
      resolve()
    }
    const onError = () => {
      cleanup()
      reject(new Error('Failed to load video metadata'))
    }
    const cleanup = () => {
      video.removeEventListener('loadedmetadata', onMeta)
      video.removeEventListener('error', onError)
    }
    video.addEventListener('loadedmetadata', onMeta)
    video.addEventListener('error', onError)
  })
}

function getExportDuration(video, mediaMode) {
  if (mediaMode === 'webcam-video') return 8
  const duration = video.duration
  if (!Number.isFinite(duration) || duration <= 0) return 8
  return Math.min(duration, 60)
}

/**
 * Record composed ad frames to a downloadable WebM video.
 */
export async function exportAdAsVideo({
  width,
  height,
  backgroundColor,
  mediaElement,
  mediaScale,
  mediaOffsetX,
  mediaOffsetY,
  text,
  mediaMode,
  filename = 'native-ad.webm',
  onProgress,
}) {
  if (!(mediaElement instanceof HTMLVideoElement)) {
    throw new Error('Video export requires a video background')
  }
  if (!HTMLCanvasElement.prototype.captureStream) {
    throw new Error('Video export is not supported in this browser')
  }

  const video = mediaElement
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D not available')

  const wasLooping = video.loop
  const wasMuted = video.muted
  const savedTime = video.currentTime
  const wasPaused = video.paused

  video.loop = false
  video.muted = true

  await waitForMetadata(video)
  const duration = getExportDuration(video, mediaMode)

  video.currentTime = 0
  await video.play().catch(() => {})

  const canvasStream = canvas.captureStream(FPS)
  const combined = new MediaStream()
  combined.addTrack(canvasStream.getVideoTracks()[0])

  const sourceStream = video.captureStream?.() ?? video.mozCaptureStream?.()
  if (sourceStream) {
    sourceStream.getAudioTracks().forEach((track) => combined.addTrack(track))
  }

  const mimeType = pickMimeType()
  const chunks = []

  const restoreVideo = () => {
    video.loop = wasLooping
    video.muted = wasMuted
    video.currentTime = savedTime
    if (!wasPaused) video.play().catch(() => {})
    canvasStream.getTracks().forEach((t) => t.stop())
    if (sourceStream) sourceStream.getTracks().forEach((t) => t.stop())
  }

  return new Promise((resolve, reject) => {
    let recorder
    try {
      recorder = new MediaRecorder(combined, {
        mimeType,
        videoBitsPerSecond: 5_000_000,
        audioBitsPerSecond: 128_000,
      })
    } catch (err) {
      restoreVideo()
      reject(err instanceof Error ? err : new Error('Failed to start recorder'))
      return
    }

    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data)
    }
    recorder.onerror = () => {
      restoreVideo()
      reject(new Error('Recording failed'))
    }
    recorder.onstop = () => {
      restoreVideo()
      if (!chunks.length) {
        reject(new Error('Export produced no data'))
        return
      }
      const blob = new Blob(chunks, { type: mimeType })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.click()
      URL.revokeObjectURL(url)
      resolve(blob)
    }

    recorder.start(100)

    const startTime = performance.now()
    const draw = () => {
      const elapsed = (performance.now() - startTime) / 1000
      if (elapsed >= duration || (mediaMode !== 'webcam-video' && video.ended)) {
        if (recorder.state === 'recording') recorder.stop()
        return
      }

      drawAd(ctx, {
        width,
        height,
        backgroundColor,
        mediaElement: video,
        mediaScale,
        mediaOffsetX,
        mediaOffsetY,
        text,
      })
      onProgress?.(Math.min(100, Math.round((elapsed / duration) * 100)))
      requestAnimationFrame(draw)
    }

    requestAnimationFrame(draw)
  })
}

export const VIDEO_BACKGROUND_MODES = new Set(['upload-video', 'webcam-video', 'pexels-video'])

export function isVideoBackgroundMode(mediaMode, mediaElement) {
  return VIDEO_BACKGROUND_MODES.has(mediaMode) && mediaElement instanceof HTMLVideoElement
}
