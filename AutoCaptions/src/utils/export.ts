import type { CaptionSegment, CaptionStyle, CaptionAnimation } from '../types'
import { drawCaption } from './captionRenderer'

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

export interface ExportOptions {
  width: number
  height: number
  format: ExportFormat
  segments: CaptionSegment[]
  captionStyle: CaptionStyle
  captionAnimation: CaptionAnimation
  animateByWord?: boolean
  fontFamily: string
  fontSizePercent: number
  captionY: number
  onProgress?: (percent: number) => void
}

export function exportVideoWithCaptions(
  videoBlob: Blob,
  options: ExportOptions
): Promise<{ blob: Blob; extension: ExportFormat }> {
  const {
    width,
    height,
    format,
    segments,
    captionStyle,
    captionAnimation,
    animateByWord = false,
    fontFamily,
    fontSizePercent,
    captionY,
    onProgress,
  } = options

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

    const tryStart = () => {
      const duration = video.duration
      if (!Number.isFinite(duration) || duration <= 0) return false

      video.currentTime = 0
      const videoStream = (video as HTMLVideoElement & { captureStream?: () => MediaStream }).captureStream?.() ??
        (video as HTMLVideoElement & { mozCaptureStream?: () => MediaStream }).mozCaptureStream?.()
      if (!videoStream) {
        cleanup()
        reject(new Error('Browser does not support video.captureStream()'))
        return false
      }
      const canvasStream = canvas.captureStream(30)
      const combined = new MediaStream()
      combined.addTrack(canvasStream.getVideoTracks()[0])
      videoStream.getAudioTracks().forEach((t) => combined.addTrack(t))
      stream = combined

      const { mimeType, extension } = getSupportedMimeType(format)
      try {
        recorder = new MediaRecorder(combined, {
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
        const t = video.currentTime
        if (t >= duration || video.ended) {
          if (recorder && recorder.state === 'recording') recorder.stop()
          return
        }
        if (video.readyState >= 2) {
          ctx.drawImage(video, 0, 0, width, height)
          if (segments.length > 0) {
            drawCaption(ctx, width, height, segments, t, captionStyle, {
              fontFamily,
              fontSizePercent,
              captionY,
              animation: captionAnimation,
              animateByWord,
            })
          }
          if (onProgress && duration > 0) {
            onProgress(Math.min(100, (t / duration) * 100))
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

    const onDurationChange = () => {
      video.removeEventListener('durationchange', onDurationChange)
      if (!tryStart()) {
        cleanup()
        reject(new Error('Invalid video duration'))
      }
    }
    const onReady = () => {
      if (tryStart()) return
      video.addEventListener('durationchange', onDurationChange)
      setTimeout(() => {
        if (recorder) return
        video.removeEventListener('durationchange', onDurationChange)
        cleanup()
        reject(new Error('Video failed to load in time'))
      }, 8000)
    }

    video.addEventListener('loadedmetadata', onReady, { once: true })
    video.addEventListener('loadeddata', onReady, { once: true })
    video.load()
  })
}

export function getVideoDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.muted = true
    video.preload = 'metadata'
    const url = URL.createObjectURL(blob)
    video.src = url
    video.onloadedmetadata = () => {
      const w = video.videoWidth || 1280
      const h = video.videoHeight || 720
      URL.revokeObjectURL(url)
      resolve({ width: w, height: h })
    }
    video.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not load video'))
    }
    video.load()
  })
}

export function getVideoDuration(blob: Blob): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.muted = true
    video.preload = 'metadata'
    const url = URL.createObjectURL(blob)
    video.src = url
    const cleanup = () => URL.revokeObjectURL(url)
    video.onloadedmetadata = () => {
      const d = video.duration
      cleanup()
      if (Number.isFinite(d) && d > 0) resolve(d)
      else reject(new Error('Invalid duration'))
    }
    video.onerror = () => {
      cleanup()
      reject(new Error('Could not load video'))
    }
    video.load()
  })
}
