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
  colorBrightness?: number
  colorContrast?: number
  colorSaturation?: number
  /** When true (edit + recorded blob), play the recorded video; when false, pause */
  isPreviewPlaying?: boolean
  /** Called when the recorded video playback reaches the end */
  onPlaybackEnd?: () => void
  /** Safe zone overlay (preview only, never in recording or export) */
  safeZone?: { type: SafeZoneType; visible: boolean }
  videoVolume?: number
  selectedOverlayId?: string | null
  onOverlayEdit?: (id: string, patch: Partial<OverlayItem>) => void
  playbackUrl?: string | null
  /** In edit mode: show recording (playback) or live webcam. When 'webcam', preview uses videoStream. */
  editPreviewSource?: 'recording' | 'webcam'
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
  videoVolume = 100,
  playbackUrl,
  editPreviewSource = 'recording',
}: RecordPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const internalVideoRef = useRef<HTMLVideoElement>(null)
  const startTimeRef = useRef(0)

  useEffect(() => {
    if (internalVideoRef.current) {
      internalVideoRef.current.volume = videoVolume / 100
    }
  }, [videoVolume])
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

  // Effective "show recording": only when editPreviewSource is 'recording' (or no webcam when 'webcam')
  // When isRecording, always show webcam (we're recording it); don't show playback.
  const showRecordingInEdit =
    !isRecording &&
    (editPreviewSource === 'recording' || (editPreviewSource === 'webcam' && !videoStream))
  // Effective "show live stream": webcam when recording, edit mode webcam, or pre-record (no blob yet)
  const showLiveStream =
    (editPreviewSource === 'webcam' && !!videoStream) ||
    (isRecording && !!videoStream) ||
    (!recordedBlob && !!videoStream)

  // Playback mode: show recorded video (only in Edit mode when showing recording)
  useEffect(() => {
    const video = internalVideoRef.current
    if (!video) return

    if (!showRecordingInEdit || !playbackUrl) {
      if (editPreviewSource === 'recording') {
        video.src = ''
        video.srcObject = null
      }
      return
    }

    video.srcObject = null
    video.src = playbackUrl
    video.load()

    const onLoaded = () => {
      onDurationChange(video.duration)
    }
    video.addEventListener('loadedmetadata', onLoaded)
    video.addEventListener('ended', onPlaybackEnd || (() => { }))

    return () => {
      video.removeEventListener('loadedmetadata', onLoaded)
      video.removeEventListener('ended', onPlaybackEnd || (() => { }))
    }
  }, [playbackUrl, onPlaybackEnd, onDurationChange, showRecordingInEdit, editPreviewSource])

  // Live mode: show camera stream (Record mode or Edit mode with webcam selected)
  useEffect(() => {
    const video = internalVideoRef.current
    if (!video || !showLiveStream) return

    if (videoStream) {
      if (video.srcObject !== videoStream) {
        video.srcObject = videoStream
        video.src = ''
        video.load()
      }
      video.play().catch(() => { })
    }

    return () => {
      // Don't clear srcObject immediately if it might be the same stream,
      // but if we switch modes, we definitely want to clear it.
    }
  }, [videoStream, showLiveStream])

  // Play/Pause control (only for playback in Edit mode when showing recording)
  useEffect(() => {
    const video = internalVideoRef.current
    if (!video || !showRecordingInEdit || !playbackUrl) return

    if (isPreviewPlaying) {
      video.play().catch(() => { })
    } else {
      video.pause()
    }
  }, [isPreviewPlaying, playbackUrl, showRecordingInEdit])


  // Volume control
  useEffect(() => {
    if (internalVideoRef.current) {
      internalVideoRef.current.volume = Math.max(0, Math.min(1, videoVolume / 100))
    }
  }, [videoVolume])

  // Seek control (only when showing recording in edit mode)
  useEffect(() => {
    const video = internalVideoRef.current
    if (!video || seekTime == null || !playbackUrl || !showRecordingInEdit) return
    // Only seek if difference is significant to avoid stutter during playback updates
    if (Math.abs(video.currentTime - seekTime) > 0.1) {
      video.currentTime = seekTime
    }
  }, [seekTime, playbackUrl, showRecordingInEdit])

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

  // Keep image elements for image overlays
  useEffect(() => {
    const map = overlayImageRef.current
    const imageOverlayIds = new Set(
      overlays.filter((o) => o.type === 'image' && (o.imageDataUrl || o.imageUrl)).map((o) => o.id)
    )
    for (const id of map.keys()) {
      if (!imageOverlayIds.has(id)) {
        map.delete(id)
      }
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

  // Canvas Drawing Loop
  useEffect(() => {
    const canvas = canvasRef.current
    // Use internal video for both playback and preview drawing
    const video = internalVideoRef.current
    if (!canvas || !video) return

    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return

    let rafId: number

    const draw = () => {
      if (video.readyState >= 2) {
        // Draw video frame
        ctx.save()
        // Flip video for live preview/recording (webcam or when recording)
        if (flipVideo && (editPreviewSource === 'webcam' || isRecording)) {
          ctx.translate(width, 0)
          ctx.scale(-1, 1)
        }

        // Handle Portrait Fill Height - center-crop (mask) the video to fill the canvas
        if (portraitFillHeight) {
          const vw = video.videoWidth
          const vh = video.videoHeight
          if (vw > 0 && vh > 0) {
            const videoRatio = vw / vh
            const canvasRatio = width / height

            let sx = 0
            let sy = 0
            let sw = vw
            let sh = vh

            if (canvasRatio < videoRatio) {
              // Canvas is narrower -> crop sides of video (center crop)
              sw = vh * canvasRatio
              sx = (vw - sw) / 2
            } else {
              // Canvas is wider -> crop top/bottom of video (center crop)
              sh = vw / canvasRatio
              sy = (vh - sh) / 2
            }

            ctx.drawImage(video, sx, sy, sw, sh, 0, 0, width, height)
          } else {
            ctx.drawImage(video, 0, 0, width, height)
          }
        } else {
          ctx.drawImage(video, 0, 0, width, height)
        }

        ctx.restore()

        // Apply Color Adjustments (Preview Only)
        if (colorAdjustmentsEnabled && !isRecording) {
          const filter = `brightness(${colorBrightness}%) contrast(${colorContrast}%) saturate(${colorSaturation}%)`
          ctx.filter = filter
          ctx.drawImage(canvas, 0, 0)
          ctx.filter = 'none'
        }

        // Draw Safe Zones
        if (safeZone?.visible && safeZone.type) {
          drawSafeZoneOverlay(ctx, width, height, safeZone.type)
        }

        // Draw overlays, texts, and captions – always on top of video (displayTime is timeline position)
        const timeForOverlays = displayTime
        drawOverlays(ctx, width, height, overlays, timeForOverlays, {
          textAnimation: overlayTextAnimation,
          defaultFontFamily,
          defaultSecondaryFont,
          defaultBold,
          preloadedImages: overlayImageRef.current,
          preloadedVideos: overlayVideoRef.current,
        })
        if (captionPreview && captionSegments && captionSegments.length > 0) {
          const captionTime = showRecordingInEdit && videoTrimStart != null
            ? timeForOverlays + videoTrimStart
            : timeForOverlays
          drawCaptionStyle(ctx, width, height, captionSegments, captionTime, captionPreview.style, {
            fontSizePercent: captionPreview.fontSizePercent,
            captionY: captionPreview.captionY,
            textAnimation: overlayTextAnimation,
          })
        }
        // Draw selection border and resize handle when not recording
        if (!isRecording && selectedOverlayId && onOverlayEdit) {
          const active = overlays.filter((o) => timeForOverlays >= o.startTime && timeForOverlays <= o.endTime)
          const sel = active.find((o) => o.id === selectedOverlayId)
          if (sel) {
            const rect = getOverlayRect(ctx, width, height, sel, defaultFontFamily ?? 'Oswald', defaultBold ?? false)
            if (rect) drawSelectionAndHandle(ctx, rect)
          }
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
  }, [videoStream, playbackUrl, isRecording, recordedBlob, width, height, overlays, displayTime, portraitFillHeight, overlayTextAnimation, defaultFontFamily, defaultSecondaryFont, defaultBold, burnOverlaysIntoExport, flipVideo, captionPreview, captionSegments, colorAdjustmentsEnabled, colorBrightness, colorContrast, colorSaturation, videoTrimStart, videoTrimEnd, safeZone, selectedOverlayId, showRecordingInEdit])

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
        ; (e.target as HTMLCanvasElement).setPointerCapture?.(e.pointerId)
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
        ; (e.target as HTMLCanvasElement).setPointerCapture?.(e.pointerId)
      return
    }
    if (hit?.type === 'overlay' && onOverlayMove && !isRecording) {
      e.preventDefault()
      setDragState({ overlayId: hit.id, offsetX: hit.offsetX, offsetY: hit.offsetY })
      setCursor('grabbing')
        ; (e.target as HTMLCanvasElement).setPointerCapture?.(e.pointerId)
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
      const sensitivity = 0.005 // Adjusted sensitivity
      // For font size, maybe just deltaY? For scale, diagonal?
      // Let's use max delta for consistency
      const delta = (Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY) * sensitivity

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
      ; (e.target as HTMLCanvasElement).releasePointerCapture?.(e.pointerId)
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

  // DOM Overlay Handling
  const handleOverlayPointerDown = (e: React.PointerEvent, id: string) => {
    e.stopPropagation()
    // Select overlay if not already selected
    if (id !== selectedOverlayId && onOverlayEdit) {
      // We trigger a "move" start effectively by calling onOverlayMove with current pos?
      // Actually the parent handles selection via onOverlayMove usually.
    }
    // Pass event to parent logic if needed, but for DOM overlays we might want local drag?
    // The existing app has drag logic in parent (RecordPreview -> Timeline -> ...)
    // But RecordPreview props include `onOverlayMove`.
    // If we want to use the parent's drag logic, we need to mimic what the canvas interaction did.
    // The parent likely expects `onOverlayMove(id, x, y)`.
    if (onOverlayMove) {
      // We can initiate drag here.
      // But we need to track local drag state to send updates.
      setDragState({
        overlayId: id,
        offsetX: 0,
        offsetY: 0
      })
        // We'll calculate offsets in pointerDown to be precise?
        // Actually let's just let the parent handle it if we can? 
        // But we are in a DOM element. The canvas pointer down logic isn't firing.
        // So we MUST handle it here.
        // So we MUST handle it here.
        ; (e.target as Element).setPointerCapture(e.pointerId)
    }
  }

  const handleResizePointerDown = (e: React.PointerEvent, id: string) => {
    e.preventDefault()
    e.stopPropagation()
    const overlay = overlays.find((o) => o.id === id)
    if (!overlay) return

    setResizeState({
      overlayId: id,
      startX: e.clientX,
      startY: e.clientY,
      startValue: overlay.type === 'image' || overlay.type === 'video' ? (overlay.imageScale ?? 1) : (overlay.fontSizePercent ?? 5),
      kind: overlay.type === 'text' ? 'fontSize' : 'scale'
    })

    const target = e.target as Element
    target.setPointerCapture(e.pointerId)
  }

  const handlePointerUpDom = (e: React.PointerEvent) => {
    if (resizeState) {
      setResizeState(null)
      const target = e.target as Element
      if (target.releasePointerCapture) target.releasePointerCapture(e.pointerId)
    }
    if (dragState) {
      setDragState(null)
      const target = e.target as Element
      if (target.releasePointerCapture) target.releasePointerCapture(e.pointerId)
    }
  }

  const handlePointerMoveDom = (e: React.PointerEvent) => {
    if (resizeState && onOverlayEdit) {
      const deltaX = e.clientX - resizeState.startX
      // Scale sensitivity
      const scaleFactor = 1 + (deltaX / 200)

      if (resizeState.kind === 'fontSize') {
        const newVal = Math.max(0.5, Math.min(20, resizeState.startValue * scaleFactor))
        onOverlayEdit(resizeState.overlayId, { fontSizePercent: newVal })
      } else {
        const newVal = Math.max(0.1, Math.min(5, resizeState.startValue * scaleFactor))
        onOverlayEdit(resizeState.overlayId, { imageScale: newVal })
      }
    }

    if (dragState && onOverlayMove) {
      // We need to calculate new X/Y based on delta.
      // But we need the container size.
      // `e.movementX` might be useful? Or tracking start.
      // This simple implementation might be jumpy without proper offset tracking.
      // Let's rely on simple relative movement.
      const wrap = e.currentTarget.closest(`.${styles.wrap}`)
      if (wrap) {
        const rect = wrap.getBoundingClientRect()
        if (rect.width > 0 && rect.height > 0) {
          const dx = e.movementX / rect.width
          const dy = e.movementY / rect.height
          const overlay = overlays.find(o => o.id === dragState.overlayId)
          if (overlay) {
            const nx = Math.max(0, Math.min(1, (overlay.x ?? 0.5) + dx))
            const ny = Math.max(0, Math.min(1, (overlay.y ?? 0.5) + dy))
            onOverlayMove(dragState.overlayId, nx, ny)
          }
        }
      }
    }
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
      {/* Hidden container for playback video */}
      <video
        ref={(el) => {
          (internalVideoRef as React.MutableRefObject<HTMLVideoElement | null>).current = el
          if (externalVideoRef) (externalVideoRef as React.MutableRefObject<HTMLVideoElement | null>).current = el
        }}
        className={styles.hiddenVideo}
        muted={isRecording}
        playsInline
        onTimeUpdate={(e) => onTimeUpdate?.(e.currentTarget.currentTime)}
        style={{ display: 'none' }}
      />

      {/* Canvas Wrap */}
      <div className={styles.canvasWrap}
        style={{ touchAction: 'none', ...filterStyle }}
      >
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className={styles.canvas}
          style={{ cursor }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerLeave}
          onPointerCancel={handlePointerUp}
        />

        {/* Overlays are drawn on canvas (always on top of video) – no DOM overlay layer needed */}
      </div>

      {isRecording && (
        <div className={styles.recBadge}>
          <div className={styles.recDot} />
          <span>REC</span>
        </div>
      )}

      {captionPreview && !isRecording && (
        // Caption preview logic could be added here if needed, 
        // currently drawn on canvas via drawOverlays/drawCaptionStyle
        null
      )}
    </div>
  )
}
