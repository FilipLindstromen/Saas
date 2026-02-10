import type { OverlayItem, OverlayTextAnimation } from '../types'
import { drawOverlays } from './canvasCapture'

/**
 * Re-encode a video blob with CSS-like color adjustments (brightness, contrast, saturation).
 * Used for export when "Use color adjustments" is on; raw recording is never modified.
 */
export type ExportFormat = 'webm' | 'mp4'

function getSupportedMimeType(preferFormat: ExportFormat): { mimeType: string; extension: ExportFormat } {
  if (preferFormat === 'mp4') {
    const mp4Types = [
      'video/mp4;codecs=avc1.64003E,mp4a.40.2',
      'video/mp4;codecs=avc1,aac',
      'video/mp4',
    ]
    for (const t of mp4Types) {
      if (MediaRecorder.isTypeSupported(t)) return { mimeType: t, extension: 'mp4' }
    }
  }
  const webmTypes = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ]
  for (const t of webmTypes) {
    if (MediaRecorder.isTypeSupported(t)) return { mimeType: t, extension: 'webm' }
  }
  return { mimeType: 'video/webm', extension: 'webm' }
}

/**
 * Resolve video duration (seconds) from a blob by loading it. Use when the video element
 * in the export pipeline might not report duration (e.g. some WebM in blob URLs).
 */
export function getVideoDurationFromBlob(blob: Blob): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.muted = true
    video.preload = 'metadata'
    const url = URL.createObjectURL(blob)
    video.src = url
    let settled = false
    const cleanup = () => {
      video.removeEventListener('loadedmetadata', onReady)
      video.removeEventListener('loadeddata', onReady)
      video.removeEventListener('durationchange', onDuration)
      video.removeEventListener('error', onError)
      URL.revokeObjectURL(url)
    }
    const onError = () => {
      if (!settled) {
        settled = true
        cleanup()
        reject(new Error('Could not load video to read duration'))
      }
    }
    const onDuration = () => {
      if (Number.isFinite(video.duration) && video.duration > 0 && !settled) {
        settled = true
        cleanup()
        resolve(video.duration)
      }
    }
    const onReady = () => {
      if (Number.isFinite(video.duration) && video.duration > 0 && !settled) {
        settled = true
        cleanup()
        resolve(video.duration)
        return
      }
      video.addEventListener('durationchange', onDuration)
    }
    video.addEventListener('loadedmetadata', onReady, { once: true })
    video.addEventListener('loadeddata', onReady, { once: true })
    video.addEventListener('error', onError, { once: true })
    video.load()
    setTimeout(() => {
      if (settled) return
      if (Number.isFinite(video.duration) && video.duration > 0) {
        settled = true
        cleanup()
        resolve(video.duration)
      } else {
        settled = true
        cleanup()
        reject(new Error('Could not read video duration'))
      }
    }, 5000)
  })
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

    const tryStart = (): boolean => {
      const duration = video.duration
      if (!Number.isFinite(duration) || duration <= 0) return false

      const videoStream = (video as any).captureStream()
      const canvasStream = canvas.captureStream(30)
      const videoTrackFromCanvas = canvasStream.getVideoTracks()[0]
      const audioTracks = videoStream.getAudioTracks()
      const combinedStream = new MediaStream()
      combinedStream.addTrack(videoTrackFromCanvas)
      audioTracks.forEach((t: MediaStreamTrack) => combinedStream.addTrack(t))
      stream = combinedStream

      const { mimeType } = getSupportedMimeType('webm')
      try {
        recorder = new MediaRecorder(combinedStream, {
          mimeType,
          videoBitsPerSecond: 5_000_000,
          audioBitsPerSecond: 128_000,
        })
      } catch (e) {
        cleanup()
        reject(e)
        return false
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
      return true
    }
    const onReady = () => {
      if (tryStart()) return
      const onDurationChange = () => {
        video.removeEventListener('durationchange', onDurationChange)
        if (!tryStart()) {
          cleanup()
          reject(new Error('Invalid video duration'))
        }
      }
      video.addEventListener('durationchange', onDurationChange)
      setTimeout(() => {
        if (recorder) return
        video.removeEventListener('durationchange', onDurationChange)
        cleanup()
        reject(new Error('Invalid video duration'))
      }, 3000)
    }
    video.addEventListener('loadedmetadata', onReady, { once: true })
    video.load()
  })
}

export interface ExportForDownloadOptions {
  width: number
  height: number
  /** Known duration of the source video (seconds). Used when the video element does not report duration yet (e.g. some WebM). */
  sourceDuration?: number
  /** Start time in source video (seconds) */
  trimStart?: number
  /** End time in source video (seconds); export runs until this */
  trimEnd?: number
  /** Preferred container format; MP4 is used only if the browser supports it */
  exportFormat?: ExportFormat
  overlays?: OverlayItem[]
  overlayTextAnimation?: OverlayTextAnimation
  defaultFontFamily?: string
  defaultSecondaryFont?: string
  defaultBold?: boolean
  colorBrightness?: number
  colorContrast?: number
  colorSaturation?: number
  /** Optional background music; mixed with video audio during export */
  musicBlob?: Blob | null
  /** Music volume 0–100 when musicBlob is set */
  musicVolume?: number
  /** Video volume 0–100 */
  videoVolume?: number
}

/** Preload all image overlays (data URL or URL) so they are ready for drawing during export. */
/** Uses DOM img elements so animated GIFs work (HTMLImageElement doesn't animate). */
function preloadOverlayImages(overlays: OverlayItem[]): Promise<Map<string, HTMLImageElement>> {
  const imageOverlays = overlays.filter((o) => o.type === 'image' && (o.imageDataUrl || o.imageUrl))
  if (imageOverlays.length === 0) return Promise.resolve(new Map())
  const map = new Map<string, HTMLImageElement>()
  const promises = imageOverlays.map(
    (o) =>
      new Promise<void>((resolve, reject) => {
        const img = document.createElement('img')
        img.crossOrigin = 'anonymous'
        img.style.position = 'absolute'
        img.style.left = '-9999px'
        img.style.pointerEvents = 'none'
        img.onload = () => {
          map.set(o.id, img)
          resolve()
        }
        img.onerror = () => reject(new Error(`Failed to load overlay image ${o.id}`))
        img.src = o.imageDataUrl ?? o.imageUrl!
        document.body.appendChild(img)
      })
  )
  return Promise.all(promises).then(() => map)
}

/** Preload all video overlays so they are ready for drawing during export. */
function preloadOverlayVideos(overlays: OverlayItem[]): Promise<Map<string, HTMLVideoElement>> {
  const videoOverlays = overlays.filter((o) => o.type === 'video' && o.videoUrl)
  if (videoOverlays.length === 0) return Promise.resolve(new Map())
  const map = new Map<string, HTMLVideoElement>()
  const promises = videoOverlays.map(
    (o) =>
      new Promise<void>((resolve, reject) => {
        const el = document.createElement('video')
        el.muted = true
        el.playsInline = true
        el.preload = 'auto'
        el.crossOrigin = 'anonymous'
        el.onloadedmetadata = () => {
          map.set(o.id, el)
          resolve()
        }
        el.onerror = () => reject(new Error(`Failed to load overlay video ${o.id}`))
        el.src = o.videoUrl!
        el.load()
      })
  )
  return Promise.all(promises).then(() => map)
}

function preloadMusic(blob?: Blob | null): Promise<AudioBuffer | null> {
  if (!blob) return Promise.resolve(null)
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = async () => {
      if (reader.result instanceof ArrayBuffer) {
        try {
          const ctx = new AudioContext()
          const buffer = await ctx.decodeAudioData(reader.result)
          resolve(buffer)
          ctx.close()
        } catch (e) {
          reject(e)
        }
      } else {
        reject(new Error('Failed to read music blob'))
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(blob)
  })
}

/**
 * Export video with overlays (text + images) burnt in and optional color adjustments.
 * Respects trim; overlays are drawn at timeline time (source time - trimStart).
 * Use this for download so the file contains all timeline elements.
 */
export function exportVideoForDownload(
  videoBlob: Blob,
  options: ExportForDownloadOptions,
  onProgress?: (progress: number) => void
): Promise<{ blob: Blob; extension: ExportFormat }> {
  const {
    width,
    height,
    sourceDuration: optSourceDuration,
    trimStart: optTrimStart,
    trimEnd: optTrimEnd,
    exportFormat: preferFormat = 'webm',
    overlays = [],
    overlayTextAnimation = 'none',
    defaultFontFamily = 'Oswald',
    defaultSecondaryFont = 'Playfair Display',
    defaultBold = false,
    colorBrightness = 100,
    colorContrast = 100,
    colorSaturation = 100,
    musicBlob,
    musicVolume = 50,
    videoVolume = 100,
  } = options

  const overlaysToBurn = overlays.filter((o) => o.burnIntoExport !== false)
  const hasOverlays = overlaysToBurn.length > 0
  const hasColor =
    colorBrightness !== 100 || colorContrast !== 100 || colorSaturation !== 100
  const filter =
    hasColor
      ? `brightness(${colorBrightness}%) contrast(${colorContrast}%) saturate(${colorSaturation}%)`
      : 'none'

  return Promise.all([
    preloadOverlayImages(overlaysToBurn),
    preloadOverlayVideos(overlaysToBurn),
    preloadMusic(musicBlob),
  ]).then(([preloadedImages, preloadedVideos, musicBuffer]) => {
    return new Promise<{ blob: Blob; extension: ExportFormat }>((resolve, reject) => {
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
        // Clean up DOM img elements created for GIF animation
        preloadedImages.forEach((img: HTMLImageElement) => {
          if (img.parentNode) img.parentNode.removeChild(img)
        })
        recorder = null
        stream = null
      }

      video.onerror = () => {
        cleanup()
        reject(new Error('Failed to load video'))
      }

      const tryStartExport = () => {
        const fromVideo = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : null
        const duration = fromVideo ?? (optSourceDuration != null && Number.isFinite(optSourceDuration) && optSourceDuration > 0 ? optSourceDuration : null)
        if (duration == null || duration <= 0) return false
        const trimStart = optTrimStart ?? 0
        const trimEnd = optTrimEnd ?? duration
        video.currentTime = trimStart

        const canvasStream = canvas.captureStream(30)
        const combinedStream = new MediaStream()
        combinedStream.addTrack(canvasStream.getVideoTracks()[0])

        if (musicBuffer || videoVolume !== 100) {
          const audioCtx = new AudioContext()
          const videoSource = audioCtx.createMediaElementSource(video)
          const dest = audioCtx.createMediaStreamDestination()

          const videoGain = audioCtx.createGain()
          videoGain.gain.value = Math.max(0, Math.min(1, videoVolume / 100))
          videoSource.connect(videoGain)
          videoGain.connect(dest)

          if (musicBuffer) {
            const musicSource = audioCtx.createBufferSource()
            musicSource.buffer = musicBuffer
            musicSource.loop = true
            const musicGain = audioCtx.createGain()
            musicGain.gain.value = Math.max(0, Math.min(1, (musicVolume ?? 50) / 100))
            musicSource.connect(musicGain)
            musicGain.connect(dest)
            musicSource.start(0)
          }

          dest.stream.getAudioTracks().forEach((t) => combinedStream.addTrack(t))
        } else {
          (video as any).captureStream().getAudioTracks().forEach((t: MediaStreamTrack) => combinedStream.addTrack(t))
        }
        stream = combinedStream

        const { mimeType, extension } = getSupportedMimeType(preferFormat)
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
            resolve({ blob: new Blob(chunks, { type: mimeType }), extension })
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
            const duration = trimEnd - trimStart
            if (duration > 0 && onProgress) {
              const progress = Math.min(100, Math.max(0, (timelineTime / duration) * 100))
              onProgress(progress)
            }
            if (hasOverlays) {
              overlaysToBurn.filter((o) => o.type === 'video' && o.videoUrl).forEach((o) => {
                const v = preloadedVideos.get(o.id)
                if (v && timelineTime >= o.startTime && timelineTime <= o.endTime) {
                  const local = Math.max(0, Math.min(o.endTime - o.startTime, timelineTime - o.startTime))
                  if (Math.abs(v.currentTime - local) > 0.05) v.currentTime = local
                }
              })
              drawOverlays(ctx, width, height, overlaysToBurn, timelineTime, {
                textAnimation: overlayTextAnimation,
                defaultFontFamily,
                defaultSecondaryFont,
                defaultBold,
                preloadedImages,
                preloadedVideos,
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
        return true
      }

      let durationTimeoutId: ReturnType<typeof setTimeout> | null = null
      const clearDurationTimeout = () => {
        if (durationTimeoutId != null) {
          clearTimeout(durationTimeoutId)
          durationTimeoutId = null
        }
      }
      const onDurationChange = () => {
        video.removeEventListener('durationchange', onDurationChange)
        if (tryStartExport()) {
          clearDurationTimeout()
          return
        }
        cleanup()
        reject(new Error('Invalid video duration'))
      }
      const onReady = () => {
        if (tryStartExport()) return
        video.addEventListener('durationchange', onDurationChange)
        durationTimeoutId = setTimeout(() => {
          durationTimeoutId = null
          if (recorder) return
          video.removeEventListener('durationchange', onDurationChange)
          cleanup()
          reject(new Error('Invalid video duration. The video may not have loaded in time; try again or use a shorter clip.'))
        }, 8000)
      }
      const onReadyOnce = () => {
        if (tryStartExport()) return
        onReady()
      }
      video.addEventListener('loadedmetadata', onReadyOnce, { once: true })
      video.addEventListener('loadeddata', onReadyOnce, { once: true })
      video.load()
    })
  })
}
