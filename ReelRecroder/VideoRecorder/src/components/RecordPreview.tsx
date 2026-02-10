import { useRef, useEffect, useState } from 'react'
import type { CaptionStyle, OverlayItem, OverlayTextAnimation, SafeZoneType } from '../types'
import { drawOverlays, drawCaptionStyle, getCaptionBlockRect } from '../utils/canvasCapture'
import type { CaptionSegment } from '../services/captions'
import styles from './RecordPreview.module.css'

const CAPTION_SAMPLE_SEGMENT: CaptionSegment = { start: 0, end: 1, text: 'Sample caption text' }

/** Action safe (outer) and title safe (inner) as fraction of canvas size, centered */
const SAFE_ZONE_PRESETS: Record<SafeZoneType, { action: number; title: number }> = {
  'youtube-9:16': { action: 0.95, title: 0.9 },
  'youtube-16:9': { action: 0.95, title: 0.9 },
  'youtube-1:1': { action: 0.95, title: 0.9 },
  tiktok: { action: 0.93, title: 0.85 },
  instagram: { action: 0.95, title: 0.88 },
}

function drawSafeZoneOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  type: SafeZoneType
) {
  const { action, title } = SAFE_ZONE_PRESETS[type]
  const drawRect = (size: number, color: string, lineDash: number[] = []) => {
    const sw = w * size
    const sh = h * size
    const x = (w - sw) / 2
    const y = (h - sh) / 2
    ctx.strokeStyle = color
    ctx.lineWidth = Math.max(1, Math.min(w, h) / 400)
    if (lineDash.length) ctx.setLineDash(lineDash)
    ctx.strokeRect(x, y, sw, sh)
    if (lineDash.length) ctx.setLineDash([])
  }
  drawRect(action, 'rgba(0, 255, 100, 0.7)', [4, 4])
  drawRect(title, 'rgba(255, 200, 0, 0.8)', [2, 2])
}

const RESIZE_HANDLE_SIZE = 16
const SELECTION_STROKE = 2
const MIN_FONT_SIZE_PCT = 0.5
const MAX_FONT_SIZE_PCT = 20
const MIN_IMAGE_SCALE = 0.1
const MAX_IMAGE_SCALE = 3

/** Get canvas rect (x, y, w, h) for an overlay for selection/resize hit-test and drawing. */
function getOverlayRect(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  o: OverlayItem,
  defaultFontFamily?: string,
  defaultBold?: boolean
): { x: number; y: number; w: number; h: number } | null {
  if (o.type === 'text' && o.text) {
    const size = o.fontSizePercent != null
      ? (width * o.fontSizePercent) / 100
      : ((o.fontSize ?? 24) * width) / 1280
    const boldPrefix = (defaultBold ?? false) ? 'bold ' : ''
    ctx.font = `${boldPrefix}${size}px "${defaultFontFamily ?? 'Oswald'}", sans-serif`
    const lineHeight = size * 1.2
    const lines = o.text.split('\n')
    let w = 0
    for (const line of lines) {
      w = Math.max(w, ctx.measureText(line).width)
    }
    const h = lines.length * lineHeight
    const x = (o.x ?? 0.1) * width
    const y = (o.y ?? 0.1) * height
    return { x, y, w, h }
  }
  if (o.type === 'image' && (o.imageDataUrl || o.imageUrl || o.naturalWidth)) {
    const scale = o.imageScale ?? 1
    const w = o.naturalWidth != null && o.naturalHeight != null
      ? o.naturalWidth * scale
      : (o.imageWidth ?? 200)
    const h = o.naturalHeight != null && o.naturalWidth != null
      ? o.naturalHeight * scale
      : (o.imageHeight ?? 200)
    const x = (o.x ?? 0.5) * width - w / 2
    const y = (o.y ?? 0.5) * height - h / 2
    return { x, y, w, h }
  }
  if (o.type === 'video' && o.videoUrl) {
    const scale = o.imageScale ?? 1
    const w = (o.naturalWidth ?? 1920) * scale
    const h = (o.naturalHeight ?? 1080) * scale
    const x = (o.x ?? 0.5) * width - w / 2
    const y = (o.y ?? 0.5) * height - h / 2
    return { x, y, w, h }
  }
  return null
}

function drawSelectionAndHandle(
  ctx: CanvasRenderingContext2D,
  rect: { x: number; y: number; w: number; h: number }
) {
  ctx.strokeStyle = '#5b8def'
  ctx.lineWidth = SELECTION_STROKE
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h)
  const handleX = rect.x + rect.w - RESIZE_HANDLE_SIZE
  const handleY = rect.y + rect.h - RESIZE_HANDLE_SIZE
  ctx.fillStyle = '#5b8def'
  ctx.fillRect(handleX, handleY, RESIZE_HANDLE_SIZE, RESIZE_HANDLE_SIZE)
}

interface RecordPreviewProps {
  videoStream: MediaStream | null
  width: number
  height: number
  overlays: OverlayItem[]
  currentTime: number
  displayTime: number
  isRecording: boolean
  recordedBlob: Blob | null
  onCaptureStream: (stream: MediaStream | null) => void
  onDurationChange: (d: number) => void
  onTimeUpdate?: (time: number) => void
  seekTime?: number | null
  /** When set (edit + trim), report timeline time and pause at trim end */
  videoTrimStart?: number
  videoTrimEnd?: number
  videoRef?: React.RefObject<HTMLVideoElement | null>
  onOverlayMove?: (overlayId: string, x: number, y: number) => void
  /** When true and canvas is portrait (9:16) or square (1:1), scale video to fill height and crop sides */
  portraitFillHeight?: boolean
  overlayTextAnimation?: OverlayTextAnimation
  /** Global font settings for text overlays */
  defaultFontFamily?: string
  defaultSecondaryFont?: string
  defaultBold?: boolean
  /** When false, overlays are not drawn when recording (preview-only) */
  burnOverlaysIntoExport?: boolean
  /** When true, mirror the video horizontally in preview and recording */
  flipVideo?: boolean
  /** When set (e.g. after recording), draw caption sample on preview so user can see how burn-in will look */
  captionPreview?: { style: CaptionStyle; fontSizePercent: number; captionY: number }
  /** When set (edit mode + transcription), show these segments at the right times instead of sample text */
  captionSegments?: CaptionSegment[] | null
  /** When set, dragging the caption on the canvas updates caption Y position (0–1) */
  onCaptionYChange?: (y: number) => void
  /** When true and not recording, show preview with these color adjustments (never baked into recording) */
  colorAdjustmentsEnabled?: boolean
  isRecording?: boolean
  colorBrightness?: number
  colorContrast?: number
  colorSaturation?: number
  /** When true (edit + recorded blob), play the recorded video; when false, pause */
  isPreviewPlaying?: boolean
  /** Called when the recorded video playback reaches the end */
  onPlaybackEnd?: () => void
  /** Safe zone overlay (preview only, never in recording or export) */
  safeZone?: { type: SafeZoneType; visible: boolean }
}

export function RecordPreview({
  videoStream,
  width,
  height,
  overlays,
  currentTime,
  displayTime,
  isRecording,
  recordedBlob,
  onCaptureStream,
  onDurationChange,
  onTimeUpdate,
  seekTime,
  videoTrimStart,
  videoTrimEnd,
  videoRef: externalVideoRef,
  onOverlayMove,
  selectedOverlayId = null,
  onOverlayEdit,
  portraitFillHeight = false,
  overlayTextAnimation = 'none',
  defaultFontFamily = 'Oswald',
  defaultSecondaryFont = 'Playfair Display',
  defaultBold = false,
  burnOverlaysIntoExport = true,
  flipVideo = false,
  captionPreview,
  captionSegments,
  onCaptionYChange,
  colorAdjustmentsEnabled = false,
  colorBrightness = 100,
  colorContrast = 100,
  colorSaturation = 100,
  isPreviewPlaying = false,
  onPlaybackEnd,
  safeZone,
}: RecordPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const internalVideoRef = useRef<HTMLVideoElement>(null)
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null)
  const startTimeRef = useRef(0)
  const rafRef = useRef<number>(0)
  const overlayVideoRef = useRef<Map<string, HTMLVideoElement>>(new Map())
  const overlayImageRef = useRef<Map<string, HTMLImageElement>>(new Map())
  const [dragState, setDragState] = useState<{
    overlayId: string
    offsetX: number
    offsetY: number
  } | null>(null)
  const [resizeState, setResizeState] = useState<{
    overlayId: string
    startX: number
    startY: number
    startValue: number
    kind: 'fontSize' | 'scale'
  } | null>(null)
  const [captionDrag, setCaptionDrag] = useState(false)
  const [cursor, setCursor] = useState<'default' | 'grab' | 'grabbing' | 'nwse-resize'>('default')

  // Playback mode: show recorded video
  useEffect(() => {
    if (!recordedBlob) {
      setPlaybackUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
      return
    }
    const url = URL.createObjectURL(recordedBlob)
    setPlaybackUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [recordedBlob])

  // Load video only when playback URL changes (do not reload when callbacks/trim change or playback would reset)
  useEffect(() => {
    const video = internalVideoRef.current
    if (!playbackUrl || !video) return
    video.srcObject = null
    video.src = playbackUrl
    video.load()
    const reportDuration = () => {
      const d = video.duration
      if (Number.isFinite(d) && d >= 0) onDurationChange(d)
    }
    video.addEventListener('loadedmetadata', reportDuration)
    video.addEventListener('durationchange', reportDuration)
    return () => {
      video.removeEventListener('loadedmetadata', reportDuration)
      video.removeEventListener('durationchange', reportDuration)
    }
  }, [playbackUrl, onDurationChange])

  // Time update and pause-at-trim-end: separate effect so we don't reload video when callbacks/trim change
  useEffect(() => {
    const video = internalVideoRef.current
    if (!playbackUrl || !video) return
    const onTimeUpdateEvt = () => {
      const sourceTime = video.currentTime
      if (videoTrimStart != null && videoTrimEnd != null) {
        const trimDuration = videoTrimEnd - videoTrimStart
        const timelineTime = Math.min(
          Math.max(0, sourceTime - videoTrimStart),
          trimDuration
        )
        onTimeUpdate?.(timelineTime)
        if (trimDuration > 0.5 && sourceTime >= videoTrimEnd - 0.05) {
          video.pause()
          onPlaybackEnd?.()
        }
      } else {
        onTimeUpdate?.(sourceTime)
      }
    }
    video.addEventListener('timeupdate', onTimeUpdateEvt)
    return () => video.removeEventListener('timeupdate', onTimeUpdateEvt)
  }, [playbackUrl, onTimeUpdate, videoTrimStart, videoTrimEnd, onPlaybackEnd])
  useEffect(() => {
    const video = internalVideoRef.current
    if (!video || seekTime == null || !playbackUrl) return
    const duration = video.duration
    const clamped = Number.isFinite(duration) && duration > 0
      ? Math.max(0, Math.min(duration, seekTime))
      : seekTime
    video.currentTime = clamped
  }, [seekTime, playbackUrl])

  // When parent requests play/pause (edit mode with recorded video), sync video element
  useEffect(() => {
    const video = internalVideoRef.current
    if (!playbackUrl || !video) return
    if (isPreviewPlaying) {
      video.play().catch(() => {})
    } else {
      video.pause()
    }
  }, [isPreviewPlaying, playbackUrl])

  // Notify parent when recorded video playback ends (ignore spurious ended events)
  useEffect(() => {
    const video = internalVideoRef.current
    if (!video || !playbackUrl) return
    const onEnded = () => {
      const dur = video.duration
      const t = video.currentTime
      if (Number.isFinite(dur) && dur > 0 && t >= dur - 0.25) {
        onPlaybackEnd?.()
      }
    }
    video.addEventListener('ended', onEnded)
    return () => video.removeEventListener('ended', onEnded)
  }, [playbackUrl, onPlaybackEnd])

  // Attach live stream to video element when not in playback mode
  useEffect(() => {
    const video = internalVideoRef.current
    if (!video) return
    const isPlayback = playbackUrl && recordedBlob
    if (isPlayback) return
    if (videoStream) {
      const vTrack = videoStream.getVideoTracks()[0]
      if (vTrack) {
        video.srcObject = new MediaStream([vTrack])
        video.play().catch(() => {})
      }
    } else {
      video.srcObject = null
    }
  }, [videoStream, playbackUrl, recordedBlob])

  // Keep video elements for video overlays (create/remove when overlays change)
  useEffect(() => {
    const map = overlayVideoRef.current
    const videoOverlayIds = new Set(overlays.filter((o) => o.type === 'video' && o.videoUrl).map((o) => o.id))
    for (const id of map.keys()) {
      if (!videoOverlayIds.has(id)) {
        map.delete(id)
      }
    }
    for (const o of overlays) {
      if (o.type === 'video' && o.videoUrl && !map.has(o.id)) {
        const el = document.createElement('video')
        el.muted = true
        el.playsInline = true
        el.preload = 'metadata'
        el.crossOrigin = 'anonymous'
        el.src = o.videoUrl
        el.load()
        map.set(o.id, el)
      }
    }
  }, [overlays])

  // Keep image elements for image overlays (data URL or URL; needed for animated GIFs)
  useEffect(() => {
    const map = overlayImageRef.current
    const imageOverlayIds = new Set(
      overlays.filter((o) => o.type === 'image' && (o.imageDataUrl || o.imageUrl)).map((o) => o.id)
    )
    for (const id of map.keys()) {
      if (!imageOverlayIds.has(id)) map.delete(id)
    }
    for (const o of overlays) {
      if (o.type !== 'image' || (!o.imageDataUrl && !o.imageUrl)) continue
      if (map.has(o.id)) continue
      const el = new Image()
      el.crossOrigin = 'anonymous'
      el.src = o.imageDataUrl ?? o.imageUrl!
      map.set(o.id, el)
    }
  }, [overlays])

  // Draw loop: either live video or playback video + overlays onto canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || width <= 0 || height <= 0) return

    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const video = internalVideoRef.current
    const isPlayback = playbackUrl && !isRecording && recordedBlob

    const drawVideoFit = (v: HTMLVideoElement) => {
      const vw = v.videoWidth
      const vh = v.videoHeight
      if (vw <= 0 || vh <= 0) return
      const isPortrait = height > width
      const isSquare = width === height
      const fillHeight = portraitFillHeight && (isPortrait || isSquare)
      const scale = fillHeight
        ? height / vh
        : Math.min(width / vw, height / vh)
      const sw = vw * scale
      const sh = vh * scale
      const sx = (width - sw) / 2
      const sy = fillHeight ? 0 : (height - sh) / 2
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, width, height)
      if (flipVideo) {
        ctx.save()
        ctx.translate(width, 0)
        ctx.scale(-1, 1)
        ctx.drawImage(v, 0, 0, vw, vh, sx, sy, sw, sh)
        ctx.restore()
      } else {
        ctx.drawImage(v, 0, 0, vw, vh, sx, sy, sw, sh)
      }
    }

    const overlaysToDraw =
      isRecording && !burnOverlaysIntoExport ? [] : overlays
    const draw = () => {
      if (isPlayback && video && video.readyState >= 2) {
        const sourceTime = video.currentTime
        const isInsideVideoClip =
          videoTrimStart == null || videoTrimEnd == null
            ? true
            : sourceTime >= videoTrimStart && sourceTime < videoTrimEnd - 0.02
        if (isInsideVideoClip) {
          drawVideoFit(video)
        } else {
          ctx.fillStyle = '#000'
          ctx.fillRect(0, 0, width, height)
        }
        const timelineTime =
          videoTrimStart != null && videoTrimEnd != null
            ? Math.min(Math.max(0, sourceTime - videoTrimStart), videoTrimEnd - videoTrimStart)
            : sourceTime
        const videoMap = overlayVideoRef.current
        overlaysToDraw.filter((o) => o.type === 'video' && o.videoUrl).forEach((o) => {
          const v = videoMap.get(o.id)
          if (v && timelineTime >= o.startTime && timelineTime <= o.endTime) {
            const local = Math.max(0, Math.min(o.endTime - o.startTime, timelineTime - o.startTime))
            if (Math.abs(v.currentTime - local) > 0.1) v.currentTime = local
          }
        })
        drawOverlays(ctx, width, height, overlaysToDraw, timelineTime, {
          textAnimation: overlayTextAnimation,
          defaultFontFamily: defaultFontFamily ?? 'Oswald',
          defaultSecondaryFont: defaultSecondaryFont ?? 'Playfair Display',
          defaultBold: defaultBold ?? false,
          preloadedImages: overlayImageRef.current,
          preloadedVideos: videoMap,
        })
        if (!isRecording && selectedOverlayId) {
          const sel = overlaysToDraw.find((o) => o.id === selectedOverlayId)
          if (sel && timelineTime >= sel.startTime && timelineTime <= sel.endTime) {
            const rect = getOverlayRect(ctx, width, height, sel, defaultFontFamily ?? 'Oswald', defaultBold ?? false)
            if (rect) drawSelectionAndHandle(ctx, rect)
          }
        }
        if (captionPreview) {
          const segments =
            captionSegments && captionSegments.length > 0 ? captionSegments : [CAPTION_SAMPLE_SEGMENT]
          drawCaptionStyle(
            ctx,
            width,
            height,
            segments,
            timelineTime,
            captionPreview.style,
            { fontSizePercent: captionPreview.fontSizePercent, captionY: captionPreview.captionY }
          )
        }
      } else if (videoStream && video && !isPlayback) {
        if (video.readyState >= 2) {
          drawVideoFit(video)
          const t = isRecording ? performance.now() / 1000 - startTimeRef.current : displayTime
          const videoMap = overlayVideoRef.current
          overlaysToDraw.filter((o) => o.type === 'video' && o.videoUrl).forEach((o) => {
            const v = videoMap.get(o.id)
            if (v && t >= o.startTime && t <= o.endTime) {
              const local = Math.max(0, Math.min(o.endTime - o.startTime, t - o.startTime))
              if (Math.abs(v.currentTime - local) > 0.1) v.currentTime = local
            }
          })
          drawOverlays(ctx, width, height, overlaysToDraw, t, {
            textAnimation: overlayTextAnimation,
            defaultFontFamily: defaultFontFamily ?? 'Oswald',
            defaultSecondaryFont: defaultSecondaryFont ?? 'Playfair Display',
            defaultBold: defaultBold ?? false,
            preloadedImages: overlayImageRef.current,
            preloadedVideos: videoMap,
          })
        }
      } else {
        ctx.fillStyle = '#1a1a1e'
        ctx.fillRect(0, 0, width, height)
        ctx.fillStyle = '#666'
        ctx.font = '18px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('Select video source and start', width / 2, height / 2)
      }
      if (!isRecording && safeZone?.visible) {
        drawSafeZoneOverlay(ctx, width, height, safeZone.type)
      }
      rafRef.current = requestAnimationFrame(draw)
    }

    if (isRecording) startTimeRef.current = performance.now() / 1000
    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, [videoStream, playbackUrl, isRecording, recordedBlob, width, height, overlays, displayTime, portraitFillHeight, overlayTextAnimation, defaultFontFamily, defaultSecondaryFont, defaultBold, burnOverlaysIntoExport, flipVideo, captionPreview, captionSegments, colorAdjustmentsEnabled, colorBrightness, colorContrast, colorSaturation, videoTrimStart, videoTrimEnd, safeZone, selectedOverlayId])

  // Expose canvas stream for recording (only when we're in live mode with video)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !videoStream || !isRecording) {
      onCaptureStream(null)
      return
    }
    const stream = canvas.captureStream(30)
    onCaptureStream(stream)
    return () => onCaptureStream(null)
  }, [videoStream, isRecording, onCaptureStream])

  const getCanvasCoords = (e: React.PointerEvent | PointerEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const scaleX = width / rect.width
    const scaleY = height / rect.height
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  type HitResult =
    | { type: 'overlay'; id: string; offsetX: number; offsetY: number }
    | { type: 'resize'; id: string }
    | { type: 'caption' }
    | null

  const hitTest = (canvasX: number, canvasY: number): HitResult => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return null
    const active = overlays.filter((o) => displayTime >= o.startTime && displayTime <= o.endTime)
    if (selectedOverlayId && onOverlayEdit) {
      const sel = active.find((o) => o.id === selectedOverlayId)
      if (sel) {
        const rect = getOverlayRect(ctx, width, height, sel, defaultFontFamily ?? 'Oswald', defaultBold ?? false)
        if (rect) {
          const handleX = rect.x + rect.w - RESIZE_HANDLE_SIZE
          const handleY = rect.y + rect.h - RESIZE_HANDLE_SIZE
          if (canvasX >= handleX && canvasX <= rect.x + rect.w && canvasY >= handleY && canvasY <= rect.y + rect.h) {
            return { type: 'resize', id: sel.id }
          }
        }
      }
    }
    for (const o of active) {
      if (o.type === 'text' && o.text) {
        const size = o.fontSizePercent != null
          ? (width * o.fontSizePercent) / 100
          : ((o.fontSize ?? 24) * width) / 1280
        const lineHeight = size * 1.2
        const boldPrefix = (defaultBold ?? false) ? 'bold ' : ''
        ctx.font = `${boldPrefix}${size}px "${defaultFontFamily ?? 'Oswald'}", sans-serif`
        const x = (o.x ?? 0.1) * width
        const y = (o.y ?? 0.1) * height
        const lines = o.text.split('\n')
        let w = 0
        for (const line of lines) {
          w = Math.max(w, ctx.measureText(line).width)
        }
        const h = lines.length * lineHeight
        if (canvasX >= x && canvasX <= x + w && canvasY >= y && canvasY <= y + h) {
          return { type: 'overlay', id: o.id, offsetX: canvasX - x, offsetY: canvasY - y }
        }
      }
      if (o.type === 'image') {
        const scale = o.imageScale ?? 1
        const w = o.naturalWidth != null && o.naturalHeight != null
          ? o.naturalWidth * scale
          : (o.imageWidth ?? 200)
        const h = o.naturalHeight != null && o.naturalWidth != null
          ? o.naturalHeight * scale
          : (o.imageHeight ?? 200)
        const x = (o.x ?? 0.5) * width - w / 2
        const y = (o.y ?? 0.5) * height - h / 2
        if (canvasX >= x && canvasX <= x + w && canvasY >= y && canvasY <= y + h) {
          return { type: 'overlay', id: o.id, offsetX: canvasX - (x + w / 2), offsetY: canvasY - (y + h / 2) }
        }
      }
      if (o.type === 'video' && o.videoUrl) {
        const scale = o.imageScale ?? 1
        const w = (o.naturalWidth ?? 1920) * scale
        const h = (o.naturalHeight ?? 1080) * scale
        const x = (o.x ?? 0.5) * width - w / 2
        const y = (o.y ?? 0.5) * height - h / 2
        if (canvasX >= x && canvasX <= x + w && canvasY >= y && canvasY <= y + h) {
          return { type: 'overlay', id: o.id, offsetX: canvasX - (x + w / 2), offsetY: canvasY - (y + h / 2) }
        }
      }
    }
    if (captionPreview && onCaptionYChange) {
      const activeSegment = captionSegments?.find((s) => displayTime >= s.start && displayTime < s.end)
      const captionSampleText = activeSegment?.text ?? CAPTION_SAMPLE_SEGMENT.text
      const { top, height: boxH } = getCaptionBlockRect(
        ctx,
        width,
        height,
        captionPreview.style,
        captionPreview.fontSizePercent,
        captionPreview.captionY,
        captionSampleText,
        true
      )
      if (canvasY >= top && canvasY <= top + boxH) {
        return { type: 'caption' }
      }
    }
    return null
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    const { x, y } = getCanvasCoords(e)
    const hit = hitTest(x, y)
    if (hit?.type === 'caption') {
      e.preventDefault()
      setCaptionDrag(true)
      setCursor('grabbing')
      ;(e.target as HTMLCanvasElement).setPointerCapture?.(e.pointerId)
      return
    }
    if (hit?.type === 'resize' && onOverlayEdit && !isRecording) {
      e.preventDefault()
      const o = overlays.find((ov) => ov.id === hit.id)
      if (!o) return
      const startValue =
        o.type === 'text'
          ? (o.fontSizePercent ?? ((o.fontSize ?? 24) / 1280) * 100)
          : (o.imageScale ?? 1)
      setResizeState({
        overlayId: hit.id,
        startX: x,
        startY: y,
        startValue,
        kind: o.type === 'text' ? 'fontSize' : 'scale',
      })
      setCursor('nwse-resize')
      ;(e.target as HTMLCanvasElement).setPointerCapture?.(e.pointerId)
      return
    }
    if (hit?.type === 'overlay' && onOverlayMove && !isRecording) {
      e.preventDefault()
      setDragState({ overlayId: hit.id, offsetX: hit.offsetX, offsetY: hit.offsetY })
      setCursor('grabbing')
      ;(e.target as HTMLCanvasElement).setPointerCapture?.(e.pointerId)
    }
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    const { x, y } = getCanvasCoords(e)
    if (captionDrag && onCaptionYChange) {
      const newY = Math.max(0, Math.min(1, y / height))
      onCaptionYChange(newY)
      return
    }
    if (resizeState && onOverlayEdit) {
      const deltaX = x - resizeState.startX
      const deltaY = y - resizeState.startY
      const sensitivity = 0.012
      const delta = (deltaX + deltaY) * sensitivity
      let newValue = resizeState.startValue + delta
      if (resizeState.kind === 'fontSize') {
        newValue = Math.max(MIN_FONT_SIZE_PCT, Math.min(MAX_FONT_SIZE_PCT, newValue))
        onOverlayEdit(resizeState.overlayId, { fontSizePercent: newValue })
      } else {
        newValue = Math.max(MIN_IMAGE_SCALE, Math.min(MAX_IMAGE_SCALE, newValue))
        onOverlayEdit(resizeState.overlayId, { imageScale: newValue })
      }
      return
    }
    if (dragState && onOverlayMove) {
      const nx = (x - dragState.offsetX) / width
      const ny = (y - dragState.offsetY) / height
      const clamp = (v: number) => Math.max(0, Math.min(1, v))
      onOverlayMove(dragState.overlayId, clamp(nx), clamp(ny))
      return
    }
    const hit = hitTest(x, y)
    if (hit?.type === 'caption' && onCaptionYChange) setCursor('grab')
    else if (hit?.type === 'resize' && !isRecording && onOverlayEdit) setCursor('nwse-resize')
    else if (hit?.type === 'overlay' && !isRecording && onOverlayMove) setCursor('grab')
    else setCursor('default')
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (captionDrag || dragState || resizeState) {
      ;(e.target as HTMLCanvasElement).releasePointerCapture?.(e.pointerId)
      setCaptionDrag(false)
      setDragState(null)
      setResizeState(null)
      setCursor('default')
    }
  }

  const handlePointerLeave = () => {
    if (captionDrag || dragState || resizeState) {
      setCaptionDrag(false)
      setDragState(null)
      setResizeState(null)
    }
    setCursor('default')
  }

  const showColorFilter = (colorAdjustmentsEnabled ?? false) && !isRecording
  const filterStyle =
    showColorFilter && ((colorBrightness ?? 100) !== 100 || (colorContrast ?? 100) !== 100 || (colorSaturation ?? 100) !== 100)
      ? {
          filter: `brightness(${colorBrightness ?? 100}%) contrast(${colorContrast ?? 100}%) saturate(${colorSaturation ?? 100}%)`,
        }
      : undefined

  return (
    <div className={styles.wrap} style={{ aspectRatio: `${width}/${height}` }}>
      <div className={styles.canvasWrap} style={filterStyle}>
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          width={width}
          height={height}
          style={{ cursor }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerLeave}
          onPointerCancel={handlePointerUp}
        />
      </div>
      <video
        ref={(el) => {
          (internalVideoRef as React.MutableRefObject<HTMLVideoElement | null>).current = el
          if (externalVideoRef) (externalVideoRef as React.MutableRefObject<HTMLVideoElement | null>).current = el
        }}
        className={styles.hiddenVideo}
        muted
        playsInline
        style={{ display: 'none' }}
      />
      {isRecording && (
        <div className={styles.recBadge}>
          <span className={styles.recDot} /> REC
        </div>
      )}
    </div>
  )
}
