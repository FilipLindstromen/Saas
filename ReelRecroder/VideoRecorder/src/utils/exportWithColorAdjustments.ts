import type { OverlayItem, OverlayTextAnimation } from '../types'
import { drawOverlays } from './canvasCapture'

/**
 * Re-encode a video blob with CSS-like color adjustments (brightness, contrast, saturation).
 * Used for export when "Use color adjustments" is on; raw recording is never modified.
 */
function getSupportedMimeType(): string {
  const types = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ]
  for (const t of types) {
    if (MediaRecorder.isTypeSupported(t)) return t
  }
  return 'video/webm'
}

export interface ColorAdjustments {
  brightness: number
  contrast: number
  saturation: number
}

export function exportVideoWithColorAdjustments(
  videoBlob: Blob,
  adjustments: ColorAdjustments,
  width: number,
  height: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.muted = false
    video.playsInline = true
    const url = URL.createObjectURL(videoBlob)
    video.src = url

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      URL.revokeObjectURL(url)
      reject(new Error('Canvas 2D not available'))
      return
    }

    const filter =
      adjustments.brightness !== 100 ||
      adjustments.contrast !== 100 ||
      adjustments.saturation !== 100
        ? `brightness(${adjustments.brightness}%) contrast(${adjustments.contrast}%) saturate(${adjustments.saturation}%)`
        : 'none'

    const chunks: Blob[] = []
    let recorder: MediaRecorder | null = null
    let stream: MediaStream | null = null

    const cleanup = () => {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop())
      }
      URL.revokeObjectURL(url)
      recorder = null
      stream = null
    }

    video.onerror = () => {
      cleanup()
      reject(new Error('Failed to load video'))
    }

    video.onloadeddata = () => {
      const duration = video.duration
      if (!isFinite(duration) || duration <= 0) {
        cleanup()
        reject(new Error('Invalid video duration'))
        return
      }

      const videoStream = video.captureStream()
      const canvasStream = canvas.captureStream(30)
      const videoTrackFromCanvas = canvasStream.getVideoTracks()[0]
      const audioTracks = videoStream.getAudioTracks()
      const combinedStream = new MediaStream()
      combinedStream.addTrack(videoTrackFromCanvas)
      audioTracks.forEach((t) => combinedStream.addTrack(t))
      stream = combinedStream

      const mimeType = getSupportedMimeType()
      try {
        recorder = new MediaRecorder(combinedStream, {
          mimeType,
          videoBitsPerSecond: 5_000_000,
          audioBitsPerSecond: 128_000,
        })
      } catch (e) {
        cleanup()
        reject(e)
        return
      }

      recorder.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data)
      }
      recorder.onstop = () => {
        cleanup()
        if (chunks.length) {
          resolve(new Blob(chunks, { type: mimeType }))
        } else {
          reject(new Error('Export produced no data'))
        }
      }
      recorder.onerror = () => {
        cleanup()
        reject(new Error('Recording failed'))
      }

      recorder.start(100)

      let rafId = 0
      const draw = () => {
        if (video.ended) {
          if (recorder && recorder.state === 'recording') {
            recorder.stop()
          }
          return
        }
        if (video.readyState >= 2) {
          ctx.filter = filter
          ctx.drawImage(video, 0, 0, width, height)
          ctx.filter = 'none'
        }
        rafId = requestAnimationFrame(draw)
      }
      video.play().catch((e) => {
        cancelAnimationFrame(rafId)
        cleanup()
        reject(e)
      })
      rafId = requestAnimationFrame(draw)
    }

    video.load()
  })
}

export interface ExportForDownloadOptions {
  width: number
  height: number
  /** Start time in source video (seconds) */
  trimStart?: number
  /** End time in source video (seconds); export runs until this */
  trimEnd?: number
  overlays?: OverlayItem[]
  overlayTextAnimation?: OverlayTextAnimation
  defaultFontFamily?: string
  defaultSecondaryFont?: string
  defaultBold?: boolean
  colorBrightness?: number
  colorContrast?: number
  colorSaturation?: number
}

/** Preload all image overlays so they are ready for drawing during export. */
function preloadOverlayImages(overlays: OverlayItem[]): Promise<Map<string, HTMLImageElement>> {
  const imageOverlays = overlays.filter((o) => o.type === 'image' && o.imageDataUrl)
  if (imageOverlays.length === 0) return Promise.resolve(new Map())
  const map = new Map<string, HTMLImageElement>()
  const promises = imageOverlays.map(
    (o) =>
      new Promise<void>((resolve, reject) => {
        const img = new Image()
        img.onload = () => {
          map.set(o.id, img)
          resolve()
        }
        img.onerror = () => reject(new Error(`Failed to load overlay image ${o.id}`))
        img.src = o.imageDataUrl!
      })
  )
  return Promise.all(promises).then(() => map)
}

/**
 * Export video with overlays (text + images) burnt in and optional color adjustments.
 * Respects trim; overlays are drawn at timeline time (source time - trimStart).
 * Use this for download so the file contains all timeline elements.
 */
export function exportVideoForDownload(
  videoBlob: Blob,
  options: ExportForDownloadOptions
): Promise<Blob> {
  const {
    width,
    height,
    trimStart: optTrimStart,
    trimEnd: optTrimEnd,
    overlays = [],
    overlayTextAnimation = 'none',
    defaultFontFamily = 'Oswald',
    defaultSecondaryFont = 'Playfair Display',
    defaultBold = false,
    colorBrightness = 100,
    colorContrast = 100,
    colorSaturation = 100,
  } = options

  const overlaysToBurn = overlays.filter((o) => o.burnIntoExport !== false)
  const hasOverlays = overlaysToBurn.length > 0
  const hasColor =
    colorBrightness !== 100 || colorContrast !== 100 || colorSaturation !== 100
  const filter =
    hasColor
      ? `brightness(${colorBrightness}%) contrast(${colorContrast}%) saturate(${colorSaturation}%)`
      : 'none'

  return preloadOverlayImages(overlaysToBurn).then((preloadedImages) => {
    return new Promise<Blob>((resolve, reject) => {
      const video = document.createElement('video')
      video.muted = false
      video.playsInline = true
      const url = URL.createObjectURL(videoBlob)
      video.src = url

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        URL.revokeObjectURL(url)
        reject(new Error('Canvas 2D not available'))
        return
      }

      const chunks: Blob[] = []
      let recorder: MediaRecorder | null = null
      let stream: MediaStream | null = null

      const cleanup = () => {
        if (stream) stream.getTracks().forEach((t) => t.stop())
        URL.revokeObjectURL(url)
        recorder = null
        stream = null
      }

      video.onerror = () => {
        cleanup()
        reject(new Error('Failed to load video'))
      }

      video.onloadeddata = () => {
        const duration = video.duration
        if (!isFinite(duration) || duration <= 0) {
          cleanup()
          reject(new Error('Invalid video duration'))
          return
        }
        const trimStart = optTrimStart ?? 0
        const trimEnd = optTrimEnd ?? duration
        video.currentTime = trimStart

        const videoStream = video.captureStream()
        const canvasStream = canvas.captureStream(30)
        const combinedStream = new MediaStream()
        combinedStream.addTrack(canvasStream.getVideoTracks()[0])
        videoStream.getAudioTracks().forEach((t) => combinedStream.addTrack(t))
        stream = combinedStream

        const mimeType = getSupportedMimeType()
        try {
          recorder = new MediaRecorder(combinedStream, {
            mimeType,
            videoBitsPerSecond: 5_000_000,
            audioBitsPerSecond: 128_000,
          })
        } catch (e) {
          cleanup()
          reject(e)
          return
        }

        recorder.ondataavailable = (e) => {
          if (e.data.size) chunks.push(e.data)
        }
        recorder.onstop = () => {
          cleanup()
          if (chunks.length) {
            resolve(new Blob(chunks, { type: mimeType }))
          } else {
            reject(new Error('Export produced no data'))
          }
        }
        recorder.onerror = () => {
          cleanup()
          reject(new Error('Recording failed'))
        }
        recorder.start(100)

        let rafId = 0
        const draw = () => {
          const srcTime = video.currentTime
          if (srcTime >= trimEnd || video.ended) {
            if (recorder && recorder.state === 'recording') recorder.stop()
            return
          }
          if (video.readyState >= 2) {
            if (hasColor) {
              ctx.filter = filter
              ctx.drawImage(video, 0, 0, width, height)
              ctx.filter = 'none'
            } else {
              ctx.drawImage(video, 0, 0, width, height)
            }
            const timelineTime = srcTime - trimStart
            if (hasOverlays) {
              drawOverlays(ctx, width, height, overlaysToBurn, timelineTime, {
                textAnimation: overlayTextAnimation,
                defaultFontFamily,
                defaultSecondaryFont,
                defaultBold,
                preloadedImages,
              })
            }
          }
          rafId = requestAnimationFrame(draw)
        }
        video.play().catch((e) => {
          cancelAnimationFrame(rafId)
          cleanup()
          reject(e)
        })
        rafId = requestAnimationFrame(draw)
      }

      video.load()
    })
  })
}
