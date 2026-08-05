import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import Slide from './Slide'
import SlideBackground from './SlideBackground'
import PersistentVideoLayer from './PersistentVideoLayer'
import { getWebcamCameraId, isWebcamActiveForSlide, isAnyWebcamActive } from '../utils/webcamSettings'
import { getWebcamCirclePixelSize, normalizeWebcamSizePercent } from '../utils/webcamSize'
import { startWebcamStream } from '../utils/webcamStream'
import { getExportCanvasSize } from '../utils/slideFormats'
import { getBackgroundScaleProgress } from '../utils/backgroundFit'
import { getBulletPointsFromSlide } from '../utils/slidePlainText'
import { resolveMotionSettings, resolveCanvasPushDirection, resolveTransitionStyle, getTextExitClass, KEN_BURNS_DURATION_S } from '../utils/motionPresets'
import { getSubSlides, getActiveSubSlideRect, getSubSlideCameraStyle } from '../utils/subSlides'
import { markVideoUrlReady } from '../utils/videoReadyCache'
import DrawingLayer, { DrawingToolbar } from './DrawingLayer'
import {
  DEFAULT_DRAWING_BRUSH_SIZE,
  normalizeDrawingPenColors,
} from '../utils/drawingDefaults'
import { drawingRelativePath } from '../utils/drawingStorage'
import './PlayMode.css'

const VIDEO_TRANSITION_MS = 500
const WEBCAM_TRANSITION_MS = 500
const WEBCAM_EASING = 'cubic-bezier(0.4, 0, 0.2, 1)'
const TEXT_EXIT_MIN_MS = 90
const TEXT_EXIT_MAX_MS = 160
const VALID_TRANSITION_STYLES = new Set(['default', 'slide', 'zoom', 'dissolve', 'crossfade', 'blur', 'sequence', 'canvas-push'])

function getTextExitDuration(transitionDurationMs) {
  const scaled = Math.round(transitionDurationMs * 0.28)
  return Math.min(TEXT_EXIT_MAX_MS, Math.max(TEXT_EXIT_MIN_MS, scaled))
}

function getSlideBackgroundColor(slide, fallback = '#1a1a1a') {
  if (!slide) return fallback
  if (slide.backgroundColorOverride && slide.backgroundColorOverrideValue) {
    return slide.backgroundColorOverrideValue
  }
  return fallback
}

function getWebcamLayoutKey(slide, recordSettings) {
  if (!slide) return ''
  const overrideEnabled = slide.cameraOverrideEnabled === true || recordSettings?.cameraOverrideEnabled === true
  if (overrideEnabled) {
    return `override:${slide.cameraOverridePosition || recordSettings?.cameraOverridePosition || 'fullscreen'}`
  }
  return slide.layout || 'default'
}

function hasWebcamLayoutChange(fromSlide, toSlide, recordSettings) {
  if (!fromSlide || !toSlide) return false
  if (!isWebcamActiveForSlide(fromSlide, recordSettings) || !isWebcamActiveForSlide(toSlide, recordSettings)) {
    return false
  }
  return getWebcamLayoutKey(fromSlide, recordSettings) !== getWebcamLayoutKey(toSlide, recordSettings)
}

function normalizeTransitionStyle(style) {
  return VALID_TRANSITION_STYLES.has(style) ? style : 'default'
}

function getCanvasPushTransform(direction = 'left', navDirection = 1) {
  const forward = navDirection === 1
  const useOutInOrder = (direction === 'left' || direction === 'up') === forward
  const horizontal = direction === 'left' || direction === 'right'

  if (horizontal) {
    if (useOutInOrder) {
      return { panelOrder: 'out-in', fromX: '0%', toX: '-50%', fromY: '0%', toY: '0%', vertical: false }
    }
    return { panelOrder: 'in-out', fromX: '-50%', toX: '0%', fromY: '0%', toY: '0%', vertical: false }
  }
  if (useOutInOrder) {
    return { panelOrder: 'out-in', fromX: '0%', toX: '0%', fromY: '0%', toY: '-50%', vertical: true }
  }
  return { panelOrder: 'in-out', fromX: '0%', toX: '0%', fromY: '-50%', toY: '0%', vertical: true }
}

// Slide has image, video, or infographic background (not section layout)
function slideHasBackgroundMedia(slide) {
  if (!slide) return false
  if ((slide.layout || 'default') === 'section') return false
  return !!(slide.infographicProjectId || slide.imageUrl || slide.backgroundVideoUrl)
}

// Two slides share the same background if they use the same image, video, or infographic
function sameBackground(a, b) {
  if (!a || !b) return false
  const layoutA = (a.layout || 'default') === 'section'
  const layoutB = (b.layout || 'default') === 'section'
  if (layoutA || layoutB) return false
  const hasInfographicA = !!a.infographicProjectId
  const hasInfographicB = !!b.infographicProjectId
  if (hasInfographicA && hasInfographicB) {
    return a.infographicProjectId === b.infographicProjectId && (a.infographicTabId || '') === (b.infographicTabId || '')
  }
  const hasBgA = !!(a.imageUrl || a.backgroundVideoUrl)
  const hasBgB = !!(b.imageUrl || b.backgroundVideoUrl)
  if (!hasBgA || !hasBgB) return false
  return (a.imageUrl || '') === (b.imageUrl || '') && (a.backgroundVideoUrl || '') === (b.backgroundVideoUrl || '')
}

// Same background media AND same position/scale - no transition needed
function sameBackgroundExact(a, b) {
  if (!sameBackground(a, b)) return false
  const eq = (x, y) => Math.abs((x ?? 50) - (y ?? 50)) < 0.5
  const eqScale = (x, y) => Math.abs((x ?? 1) - (y ?? 1)) < 0.01
  return eq(a.imagePositionX, b.imagePositionX) && eq(a.imagePositionY, b.imagePositionY) && eqScale(a.imageScale, b.imageScale)
}

function getBackgroundMediaKey(slide) {
  if (!slide) return 'none'
  if (slide.infographicProjectId) {
    return `infographic-${slide.infographicProjectId}-${slide.infographicTabId || ''}`
  }
  return slide.backgroundVideoUrl || slide.imageUrl || `slide-${slide.id}`
}

// Both slides use video layout with background video - keep video layer persistent to avoid fade/flicker
function bothVideoLayoutWithMedia(a, b) {
  if (!a || !b) return false
  const layoutA = (a.layout || 'default')
  const layoutB = (b.layout || 'default')
  const isVideoLayout = (l) => ['video', 'left-video', 'right-video'].includes(l)
  if (!isVideoLayout(layoutA) || !isVideoLayout(layoutB)) return false
  return !!(a.backgroundVideoUrl || a.imageUrl) && !!(b.backgroundVideoUrl || b.imageUrl)
}

// Slide has video layout with media (video or image as background)
function hasVideoLayoutWithMedia(slide) {
  if (!slide) return false
  const layout = slide.layout || 'default'
  return ['video', 'left-video', 'right-video'].includes(layout) && !!(slide.backgroundVideoUrl || slide.imageUrl)
}

// Two slides have gradient in the same position (gradientFlipped). Gradient shows for default, bulletpoints, video layouts.
function sameGradientPosition(a, b) {
  if (!a || !b) return false
  const layoutA = a.layout || 'default'
  const layoutB = b.layout || 'default'
  const hasGradientA = !!(a.infographicProjectId || a.imageUrl || a.backgroundVideoUrl) && a.gradientEnabled !== false && layoutA !== 'section' && ['default', 'bulletpoints', 'video'].includes(layoutA)
  const hasGradientB = !!(b.infographicProjectId || b.imageUrl || b.backgroundVideoUrl) && b.gradientEnabled !== false && layoutB !== 'section' && ['default', 'bulletpoints', 'video'].includes(layoutB)
  if (!hasGradientA || !hasGradientB) return false
  return (a.gradientFlipped === true) === (b.gradientFlipped === true)
}

// Hex to RGB for gradient
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : { r: 26, g: 26, b: 26 }
}

// Persistent gradient overlay - used when consecutive slides have gradient in same position.
// Fades opacity between slides: gradient disabled → 0, enabled → gradientStrength (no pop in/out).
function GradientOverlay({ slide, backgroundColor = '#1a1a1a' }) {
  if (!slide || (slide.layout || 'default') === 'section') return null
  const hasMedia = !!(slide.infographicProjectId || slide.imageUrl || slide.backgroundVideoUrl)
  const layout = slide.layout || 'default'
  if (!hasMedia || !['default', 'bulletpoints', 'video', 'left-video', 'right-video'].includes(layout)) return null

  const gradientStrength = slide.gradientStrength !== undefined ? slide.gradientStrength : 0.7
  const effectiveOpacity = slide.gradientEnabled === false ? 0 : gradientStrength
  const gradientFlipped = slide.gradientFlipped === true
  const slideBgColor = (slide.backgroundColorOverride && slide.backgroundColorOverrideValue) ? slide.backgroundColorOverrideValue : backgroundColor
  const rgb = hexToRgb(slideBgColor === 'transparent' ? backgroundColor : slideBgColor)
  const maxOpacity = 1
  const midOpacity = 0.57

  // For left-video: text on left, video on right. Gradient must darken left (text side), leave right (video) transparent.
  // For right-video: text on right, video on left. Gradient must darken right (text side), leave left (video) transparent.
  // For video: use gradientFlipped as is.
  const darkOnLeft = layout === 'left-video' ? true : layout === 'right-video' ? false : gradientFlipped
  const gradientCss = darkOnLeft
    ? `linear-gradient(to right, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${maxOpacity}) 0%, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${midOpacity}) 30%, transparent 100%)`
    : `linear-gradient(to left, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${maxOpacity}) 0%, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${midOpacity}) 30%, transparent 100%)`

  return (
    <div
      className="play-gradient-layer"
      style={{
        opacity: effectiveOpacity,
        transition: 'opacity 0.5s ease-in-out'
      }}
    >
      <div
        className="slide-gradient-overlay"
        style={{
          background: gradientCss,
          pointerEvents: 'none'
        }}
      />
    </div>
  )
}

// Build CSS filter string for video adjustments (shadows/midtones/highlights + color hue per zone)
function getVideoFilterString(recordSettings) {
  const b = typeof recordSettings?.videoBrightness === 'number' ? recordSettings.videoBrightness : 1
  const c = typeof recordSettings?.videoContrast === 'number' ? recordSettings.videoContrast : 1
  const s = typeof recordSettings?.videoSaturation === 'number' ? recordSettings.videoSaturation : 1
  const sh = typeof recordSettings?.videoShadows === 'number' ? recordSettings.videoShadows : 1
  const m = typeof recordSettings?.videoMidtones === 'number' ? recordSettings.videoMidtones : 1
  const h = typeof recordSettings?.videoHighlights === 'number' ? recordSettings.videoHighlights : 1
  const shadowFactor = 1 + (sh - 1) * 0.4
  const midtoneFactor = 1 + (m - 1) * 0.3
  const highlightFactor = 1 + (h - 1) * 0.4
  const brightness = b * shadowFactor * highlightFactor
  const contrast = c * midtoneFactor
  const hueShadow = typeof recordSettings?.videoShadowHue === 'number' ? recordSettings.videoShadowHue : 0
  const hueMid = typeof recordSettings?.videoMidHue === 'number' ? recordSettings.videoMidHue : 0
  const hueHighlight = typeof recordSettings?.videoHighlightHue === 'number' ? recordSettings.videoHighlightHue : 0
  const hueDeg = (hueShadow + hueMid + hueHighlight) / 3
  const huePart = hueDeg !== 0 ? ` hue-rotate(${hueDeg}deg)` : ''
  return `brightness(${brightness}) contrast(${contrast}) saturate(${s})${huePart}`
}

function getWebcamOverlayPosition({
  layout,
  dimensions,
  webcamSize,
  cameraOverrideEnabled = false,
  cameraOverridePosition = 'fullscreen',
}) {
  const circleSize = getWebcamCirclePixelSize(dimensions.height, webcamSize)
  const webcamWidth = circleSize.width
  const webcamHeight = circleSize.height
  const bottomOffset = dimensions.height * 0.04
  const sideOffset = dimensions.width * 0.04

  if (cameraOverrideEnabled) {
    switch (cameraOverridePosition) {
      case 'fullscreen':
        return { top: 0, left: 0, width: dimensions.width, height: dimensions.height, borderRadius: '0' }
      case 'left-third': {
        const w = dimensions.width / 3
        return { top: 0, left: 0, width: w, height: dimensions.height, borderRadius: '0' }
      }
      case 'right-third': {
        const w = dimensions.width / 3
        return { top: 0, left: dimensions.width - w, width: w, height: dimensions.height, borderRadius: '0' }
      }
      case 'circle-top-left':
        return { top: bottomOffset, left: sideOffset, width: webcamWidth, height: webcamHeight, borderRadius: '50%' }
      case 'circle-top-right':
        return { top: bottomOffset, left: dimensions.width - sideOffset - webcamWidth, width: webcamWidth, height: webcamHeight, borderRadius: '50%' }
      case 'circle-bottom-left':
        return { top: dimensions.height - bottomOffset - webcamHeight, left: sideOffset, width: webcamWidth, height: webcamHeight, borderRadius: '50%' }
      case 'circle-bottom-right':
      default:
        return {
          top: dimensions.height - bottomOffset - webcamHeight,
          left: dimensions.width - sideOffset - webcamWidth,
          width: webcamWidth,
          height: webcamHeight,
          borderRadius: '50%',
        }
    }
  }

  const effectiveLayout = layout || 'default'
  if (effectiveLayout === 'video') {
    return { top: 0, left: 0, width: dimensions.width, height: dimensions.height, borderRadius: '0' }
  }
  if (effectiveLayout === 'left-video') {
    const w = dimensions.width / 3
    return { top: 0, left: dimensions.width - w, width: w, height: dimensions.height, borderRadius: '0' }
  }
  if (effectiveLayout === 'right-video') {
    const w = dimensions.width / 3
    return { top: 0, left: 0, width: w, height: dimensions.height, borderRadius: '0' }
  }
  if (effectiveLayout === 'right') {
    return {
      top: dimensions.height - bottomOffset - webcamHeight,
      left: sideOffset,
      width: webcamWidth,
      height: webcamHeight,
      borderRadius: '50%',
    }
  }
  return {
    top: dimensions.height - bottomOffset - webcamHeight,
    left: dimensions.width - sideOffset - webcamWidth,
    width: webcamWidth,
    height: webcamHeight,
    borderRadius: '50%',
  }
}

// Webcam overlay component - separate from slide transitions
// isVisible: show the video. shouldPreload: start stream hidden (next slide needs webcam). shouldKeepAlive: keep stream running when no slide needs it yet (avoids activation delay).
// isSlidingOff: animate webcam out to the right. isSlidingIn: animate webcam in from the right.
// When canvasSize is provided, positions relative to canvas (inside play-mode layer stack); otherwise uses viewport (legacy).
function WebcamOverlay({ cameraId, layout, webcamSize = 20, isVisible = true, shouldPreload = false, shouldKeepAlive = false, isSlidingOff = false, isSlidingIn = false, cameraOverrideEnabled = false, cameraOverridePosition = 'fullscreen', recordSettings, canvasSize }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const containerRef = useRef(null)
  const prevLayoutRef = useRef(layout)
  const prevOverrideRef = useRef({ cameraOverrideEnabled, cameraOverridePosition })
  const useCanvasCoords = !!canvasSize
  const [viewportDimensions, setViewportDimensions] = useState({ width: window.innerWidth, height: window.innerHeight })
  const dimensions = useCanvasCoords ? { width: canvasSize.w, height: canvasSize.h } : viewportDimensions
  const [isTransitioningOut, setIsTransitioningOut] = useState(false)
  const prevVisibleRef = useRef(isVisible)
  const layoutWhenVisibleRef = useRef(layout)

  if (isVisible) layoutWhenVisibleRef.current = layout

  // When isVisible goes from true to false (and not using isSlidingOff), start transition-out before stopping stream
  useEffect(() => {
    if (!isSlidingOff && prevVisibleRef.current && !isVisible) {
      setIsTransitioningOut(true)
    }
    prevVisibleRef.current = isVisible
  }, [isVisible, isSlidingOff])

  useEffect(() => {
    if (!isTransitioningOut) return
    const t = setTimeout(() => setIsTransitioningOut(false), 500)
    return () => clearTimeout(t)
  }, [isTransitioningOut])

  // Start stream when visible, preloading, transitioning out, sliding off/in, or keeping alive (avoids delay when later slides need webcam)
  const shouldHaveStream = cameraId && (isVisible || shouldPreload || isTransitioningOut || shouldKeepAlive || isSlidingOff || isSlidingIn) && !(cameraOverrideEnabled && cameraOverridePosition === 'disabled')

  // Update viewport dimensions on resize (only when not using canvas coords)
  useEffect(() => {
    if (useCanvasCoords) return
    const handleResize = () => {
      setViewportDimensions({ width: window.innerWidth, height: window.innerHeight })
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [useCanvasCoords])

  // Get webcam position: when camera override is enabled use cameraOverridePosition; otherwise use layout
  // Use stored layout when transitioning out so overlay doesn't jump
  const effectiveLayout = (isTransitioningOut || isSlidingOff) ? layoutWhenVisibleRef.current : layout
  const position = getWebcamOverlayPosition({
    layout: effectiveLayout,
    dimensions,
    webcamSize,
    cameraOverrideEnabled,
    cameraOverridePosition,
  })

  useEffect(() => {
    if (!shouldHaveStream) return

    const startStream = async () => {
      try {
        const stream = await startWebcamStream(cameraId)
        if (videoRef.current && stream) {
          videoRef.current.srcObject = stream
          streamRef.current = stream
        }
      } catch (error) {
        console.error('Error accessing camera:', error)
      }
    }

    startStream()

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
        streamRef.current = null
      }
    }
  }, [cameraId, shouldHaveStream])

  // Update transition when layout or camera override changes
  useEffect(() => {
    const overrideChanged = prevOverrideRef.current.cameraOverrideEnabled !== cameraOverrideEnabled ||
      prevOverrideRef.current.cameraOverridePosition !== cameraOverridePosition
    if ((prevLayoutRef.current !== effectiveLayout || overrideChanged) && containerRef.current) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (containerRef.current) containerRef.current.offsetHeight
        })
      })
      prevLayoutRef.current = effectiveLayout
      prevOverrideRef.current = { cameraOverrideEnabled, cameraOverridePosition }
    }
  }, [effectiveLayout, dimensions, cameraOverrideEnabled, cameraOverridePosition])

  if ((!isVisible && !shouldPreload && !isTransitioningOut && !shouldKeepAlive && !isSlidingOff && !isSlidingIn) || !cameraId) return null
  if (cameraOverrideEnabled && cameraOverridePosition === 'disabled') return null

  const isHidden = (shouldPreload && !isVisible) || (isTransitioningOut && !isSlidingOff)
  const webcamOffRight = shouldKeepAlive && !isVisible && !isSlidingOff && !isSlidingIn
  const slideStyle = useCanvasCoords ? {
    position: 'absolute',
    inset: 0,
    transform: isSlidingOff || webcamOffRight ? 'translateX(100%)' : 'translateX(0)',
    transition: isSlidingIn ? 'none' : `transform ${WEBCAM_TRANSITION_MS}ms ${WEBCAM_EASING}`,
    animation: isSlidingIn ? `play-webcam-slide-in ${WEBCAM_TRANSITION_MS}ms ${WEBCAM_EASING} forwards` : 'none',
  } : undefined

  const style = {
    position: useCanvasCoords ? 'absolute' : 'fixed',
    top: `${position.top}px`,
    left: `${position.left}px`,
    width: `${position.width}px`,
    height: `${position.height}px`,
    borderRadius: position.borderRadius,
    overflow: 'hidden',
    zIndex: useCanvasCoords ? 1 : 1000,
    pointerEvents: 'none',
    opacity: isHidden ? 0 : 1,
    background: position.borderRadius === '50%' ? 'var(--bg-secondary, #2a2a2a)' : '#000',
    boxShadow: position.borderRadius === '50%' ? '0 4px 20px rgba(0, 0, 0, 0.5)' : 'none',
  }

  return (
    <div className="play-webcam-overlay-wrapper" style={slideStyle}>
      <div
        ref={containerRef}
        className="play-webcam-overlay"
        style={style}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            position: 'absolute',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: 'inherit',
            filter: getVideoFilterString(recordSettings),
            transform: (() => {
              const h = recordSettings?.webcamFlipHorizontal
              const v = recordSettings?.webcamFlipVertical
              if (!h && !v) return 'none'
              return [h && 'scaleX(-1)', v && 'scaleY(-1)'].filter(Boolean).join(' ')
            })()
          }}
        />
      </div>
    </div>
  )
}

// Transcribe video/audio blob with OpenAI Whisper (verbose_json for segment timestamps)
async function transcribeWithWhisper(blob, openaiKey) {
  const file = new File([blob], 'recording.webm', { type: blob.type || 'video/webm' })
  const formData = new FormData()
  formData.append('file', file)
  formData.append('model', 'whisper-1')
  formData.append('response_format', 'verbose_json')
  formData.append('timestamp_granularities[]', 'segment')

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${openaiKey}` },
    body: formData
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.error?.message || response.statusText)
  }
  const data = await response.json()
  return (data.segments || []).map(s => ({ start: s.start, end: s.end, text: (s.text || '').trim() })).filter(s => s.text)
}

const CAPTION_SIZE_MULT = { small: 0.85, medium: 1, large: 1.2 }

// How many slides ahead to preload (video buffers so they play immediately when entering)
const PRELOAD_AHEAD = 2

// Burn captions into video: play video, draw frames + caption text to canvas, record canvas + original audio
function burnCaptionsIntoVideo(blob, segments, captionStyle, captionFont = 'Poppins', captionFontSize = 'medium', captionDropShadow = false) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const video = document.createElement('video')
    video.src = url
    video.muted = false
    video.playsInline = true
    video.crossOrigin = 'anonymous'

    const style = {
      'bottom-black': { position: 'bottom', bg: 'rgba(0,0,0,0.85)', fg: '#ffffff', fontSize: 0.04, padding: 0.02 },
      'bottom-white': { position: 'bottom', bg: 'rgba(255,255,255,0.9)', fg: '#111111', fontSize: 0.04, padding: 0.02 },
      'top-black': { position: 'top', bg: 'rgba(0,0,0,0.85)', fg: '#ffffff', fontSize: 0.04, padding: 0.02 },
      'top-white': { position: 'top', bg: 'rgba(255,255,255,0.9)', fg: '#111111', fontSize: 0.04, padding: 0.02 },
      'white-outline': { position: 'bottom', bg: 'transparent', fg: '#ffffff', outline: true, fontSize: 0.045, padding: 0.01 },
      'large-white': { position: 'bottom', bg: 'rgba(0,0,0,0.75)', fg: '#ffffff', fontSize: 0.055, padding: 0.025 }
    }
    const opts = style[captionStyle] || style['bottom-black']
    const sizeMult = CAPTION_SIZE_MULT[captionFontSize] ?? 1
    const fontFamily = captionFont || 'Poppins'

    function tryStartPipeline() {
      let w = video.videoWidth
      let h = video.videoHeight
      if (!w || !h) return false
      startPipeline(w, h)
      return true
    }

    function startPipeline(w, h) {
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) { URL.revokeObjectURL(url); reject(new Error('Canvas not supported')); return }

      let audioContext = null
      let dest = null
      let combinedStream = null
      let recorder = null
      const outputChunks = []

      try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)()
        dest = audioContext.createMediaStreamDestination()
        const source = audioContext.createMediaElementSource(video)
        source.connect(dest)
        const videoStream = canvas.captureStream(30)
        combinedStream = new MediaStream([...videoStream.getVideoTracks(), ...dest.stream.getAudioTracks()])
        const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? 'video/webm;codecs=vp9,opus' : 'video/webm'
        recorder = new MediaRecorder(combinedStream, { mimeType: mime, videoBitsPerSecond: 2500000 })
        recorder.ondataavailable = (e) => { if (e.data.size > 0) outputChunks.push(e.data) }
        recorder.onstop = () => {
          URL.revokeObjectURL(url)
          const outBlob = new Blob(outputChunks, { type: mime })
          resolve(outBlob)
        }
        recorder.start(100)
      } catch (e) {
        URL.revokeObjectURL(url)
        reject(e)
        return
      }

      function getSegmentAt(time) {
        for (let i = 0; i < segments.length; i++) {
          if (time >= segments[i].start && time <= segments[i].end) return segments[i].text
        }
        return null
      }

      function drawFrame() {
        if (video.ended || video.readyState < 2) {
          if (video.ended) {
            try { recorder.stop() } catch (_) {}
          }
          return
        }
        ctx.drawImage(video, 0, 0, w, h)
        const t = video.currentTime
        const text = getSegmentAt(t)
        if (text) {
          const fontSize = Math.round(w * opts.fontSize * sizeMult)
          ctx.font = `600 ${fontSize}px "${fontFamily}", sans-serif`
          const lines = text.replace(/\n/g, ' ').match(/.{1,42}/g) || [text]
          const lineHeight = fontSize * 1.2
          const pad = Math.round(w * opts.padding)
          let maxLineW = 0
          lines.forEach((line) => {
            const m = ctx.measureText(line)
            if (m.width > maxLineW) maxLineW = m.width
          })
          const boxW = Math.round(maxLineW) + pad * 2
          const boxH = lines.length * lineHeight + pad * 2
          const edgeMargin = 0.05
          const y0 = opts.position === 'top'
            ? Math.round(h * edgeMargin)
            : h - boxH - Math.round(h * edgeMargin)
          const x0 = (w - boxW) / 2
          if (opts.bg !== 'transparent') {
            ctx.fillStyle = opts.bg
            if (ctx.roundRect) {
              ctx.beginPath()
              ctx.roundRect(x0, y0, boxW, boxH, 8)
              ctx.fill()
            } else {
              ctx.fillRect(x0, y0, boxW, boxH)
            }
          }
          ctx.fillStyle = opts.fg
          if (opts.outline) {
            ctx.strokeStyle = '#000'
            ctx.lineWidth = Math.max(2, fontSize / 20)
          }
          if (captionDropShadow) {
            ctx.shadowColor = 'rgba(0,0,0,0.8)'
            ctx.shadowBlur = 4
            ctx.shadowOffsetX = 1
            ctx.shadowOffsetY = 1
          }
          lines.forEach((line, i) => {
            const y = y0 + pad + (i + 1) * lineHeight
            const metrics = ctx.measureText(line)
            const x = (w - metrics.width) / 2
            if (opts.outline) ctx.strokeText(line, x, y)
            ctx.fillText(line, x, y)
          })
          if (captionDropShadow) {
            ctx.shadowColor = 'transparent'
            ctx.shadowBlur = 0
            ctx.shadowOffsetX = 0
            ctx.shadowOffsetY = 0
          }
        }
      }

      if (video.requestVideoFrameCallback) {
        const tick = () => {
          drawFrame()
          if (!video.ended) video.requestVideoFrameCallback(tick)
        }
        video.requestVideoFrameCallback(tick)
      } else {
        const tick = () => {
          drawFrame()
          if (!video.ended) requestAnimationFrame(tick)
        }
        video.ontimeupdate = () => tick()
      }

      video.onended = () => {
        setTimeout(() => { try { if (recorder && recorder.state !== 'inactive') recorder.stop() } catch (_) {} }, 200)
      }

      video.play().catch(e => {
        URL.revokeObjectURL(url)
        try { recorder.stop() } catch (_) {}
        reject(e)
      })
    }

    let pipelineStarted = false
    video.onloadedmetadata = () => {
      if (tryStartPipeline()) { pipelineStarted = true; return }
      const retryOnce = () => {
        if (pipelineStarted) return
        if (tryStartPipeline()) {
          pipelineStarted = true
          video.removeEventListener('loadeddata', retryOnce)
          video.removeEventListener('canplay', retryOnce)
          return
        }
        video.removeEventListener('loadeddata', retryOnce)
        video.removeEventListener('canplay', retryOnce)
        URL.revokeObjectURL(url)
        reject(new Error('Invalid video dimensions'))
      }
      video.addEventListener('loadeddata', retryOnce, { once: true })
      video.addEventListener('canplay', retryOnce, { once: true })
      setTimeout(() => {
        if (pipelineStarted) return
        if (video.videoWidth && video.videoHeight && tryStartPipeline()) {
          pipelineStarted = true
          video.removeEventListener('loadeddata', retryOnce)
          video.removeEventListener('canplay', retryOnce)
          return
        }
        video.removeEventListener('loadeddata', retryOnce)
        video.removeEventListener('canplay', retryOnce)
        URL.revokeObjectURL(url)
        reject(new Error('Invalid video dimensions'))
      }, 3000)
    }

    video.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Video failed to load'))
    }
  })
}

function PlayMode({ slides, onExit, backgroundColor = '#1a1a1a', textColor = '#ffffff', fontFamily = 'Inter', defaultTextSize = 4, h1Size = 10, h2Size = 3.5, h3Size = 2.5, h1FontFamily = '', h2FontFamily = '', h3FontFamily = '', defaultFontWeight = 700, h1Weight = 700, h2Weight = 700, h3Weight = 700, h1LineHeight = 1.2, h2LineHeight = 1.2, h3LineHeight = 1.2, showMenu = false, textDropShadow, shadowBlur, shadowOffsetX, shadowOffsetY, shadowColor, textOutline, outlineWidth, outlineColor, textInlineBackground, inlineBgColor, inlineBgOpacity, inlineBgPadding, initialSlideId, transitionStyle = 'default', transitionSpeed = 1, canvasPushDirection = 'left', motionPreset = 'custom', textAnimation = 'none', textAnimationUnit = 'word', textAnimationSpeed = 1, textAnimationStagger = 0.07, textExitAnimation = 'match-in', subtitleDelay = 0, backgroundKenBurnsDirection = 'zoom-in', backgroundBlurOnTextEnter = false, graphicAnimationIn = 'fade-scale', kenBurns = false, lineHeight = 1, bulletLineHeight = 1, bulletTextSize = 3, bulletGap = 0, bulletStyle = 'dot', contentBottomOffset = 12, contentEdgeOffset = 9, contentVerticalAlign = 'bottom', showBullets = true, recordSettings = { webcamEnabled: false, selectedCameraId: '', microphoneEnabled: false, selectedMicrophoneId: '', captionsEnabled: false, captionStyle: 'bottom-black' }, isRecording = false, initialScreenStreamRef, textStyleMode = 'standard', fontPairingSerifFont = 'Playfair Display', openaiKey = '', slideFormat = '16:9', onRecordingDone, projectName = '', drawingPenColors, onDrawingPersist }) {
  // Filter out section slides for presentation
  const presentationSlides = slides.filter(slide => (slide.layout || 'default') !== 'section')
  
  // Find the initial index based on initialSlideId in the filtered slides, or default to 0
  const getInitialIndex = () => {
    if (initialSlideId && presentationSlides.length > 0) {
      const index = presentationSlides.findIndex(slide => slide.id === initialSlideId)
      return index >= 0 ? index : 0
    }
    return 0
  }
  
  const [currentIndex, setCurrentIndex] = useState(getInitialIndex)
  const [subSlideIndex, setSubSlideIndex] = useState(-1)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [transitionPhase, setTransitionPhase] = useState('idle') // 'idle', 'fade-out', 'fade-in'
  const [visibleBulletIndex, setVisibleBulletIndex] = useState(0)
  const [preloadReady, setPreloadReady] = useState(false) // Defer preload until after first paint to avoid overlapping text on play start
  const penColors = normalizeDrawingPenColors(drawingPenColors)
  const [drawingEnabled, setDrawingEnabled] = useState(false)
  const [drawTool, setDrawTool] = useState('pen')
  const [drawColor, setDrawColor] = useState(penColors[0])
  const [drawBrushSize, setDrawBrushSize] = useState(DEFAULT_DRAWING_BRUSH_SIZE)
  const drawingLayerRef = useRef(null)
  // Video persistence: when transitioning from video slide to non-video, slide video off to right
  const [isSlidingOff, setIsSlidingOff] = useState(false)
  const [isSlidingIn, setIsSlidingIn] = useState(false)
  const videoSlideForTransitionRef = useRef(null) // Slide we're leaving when isSlidingOff
  // Webcam: slide out to right when leaving webcam slide, slide in from right when returning
  const [isWebcamSlidingOff, setIsWebcamSlidingOff] = useState(false)
  const [isWebcamSlidingIn, setIsWebcamSlidingIn] = useState(false)
  // Two-phase transition: text/background out first, then switch slide, then in
  const [pendingIndex, setPendingIndex] = useState(null)
  const pendingDirectionRef = useRef(1) // 1 = next, -1 = prev
  const suppressTextEntranceAfterCanvasPushRef = useRef(false)
  const transitionTimeoutsRef = useRef([])
  const slideEnteredAtRef = useRef(Date.now())
  const [frozenBgScale, setFrozenBgScale] = useState({ outgoing: 0, incoming: 0 })
  // Outgoing slide kept mounted during transitions so incoming media/text are not remounted at the end
  const [outgoingTransitionSlide, setOutgoingTransitionSlide] = useState(null)
  const [bgIncomingHold, setBgIncomingHold] = useState(false)
  const bgIncomingHoldRafRef = useRef(null)

  const finishBackgroundTransition = useCallback(() => {
    setBgIncomingHold(true)
    setOutgoingTransitionSlide(null)
    setPendingIndex(null)
    setTransitionPhase('idle')
    setFrozenBgScale({ outgoing: 0, incoming: 0 })
    setIsWebcamSlidingOff(false)
    setIsWebcamSlidingIn(false)
    setIsTransitioning(false)
    if (bgIncomingHoldRafRef.current) cancelAnimationFrame(bgIncomingHoldRafRef.current)
    bgIncomingHoldRafRef.current = requestAnimationFrame(() => {
      bgIncomingHoldRafRef.current = requestAnimationFrame(() => {
        setBgIncomingHold(false)
        bgIncomingHoldRafRef.current = null
      })
    })
  }, [])

  const clearTransitionTimeouts = useCallback(() => {
    transitionTimeoutsRef.current.forEach((id) => clearTimeout(id))
    transitionTimeoutsRef.current = []
  }, [])

  const scheduleTransition = useCallback((fn, delay) => {
    const id = setTimeout(fn, delay)
    transitionTimeoutsRef.current.push(id)
  }, [])

  useEffect(() => () => clearTransitionTimeouts(), [clearTransitionTimeouts])

  useEffect(() => {
    if (suppressTextEntranceAfterCanvasPushRef.current) {
      suppressTextEntranceAfterCanvasPushRef.current = false
    }
  }, [currentIndex, transitionPhase])

  useEffect(() => {
    setSubSlideIndex(-1)
  }, [currentIndex])
  
  // Recording state
  const [recordingState, setRecordingState] = useState('idle') // 'idle', 'recording', 'stopping'
  const [captionsProcessing, setCaptionsProcessing] = useState('idle') // 'idle', 'transcribing', 'burning', 'encoding'
  const mediaRecorderRef = useRef(null)
  const recordedChunksRef = useRef([])
  const screenStreamRef = useRef(null)
  const audioStreamRef = useRef(null)
  const combinedStreamRef = useRef(null)
  const isStartingRecordingRef = useRef(false) // Prevent multiple simultaneous recording starts

  // Get bullet points for current slide
  const getBulletPoints = (slide) => getBulletPointsFromSlide(slide)

  // Canvas size by aspect ratio (see slideFormats.js)
  const canvasSize = getExportCanvasSize(slideFormat)

  const currentSlide = presentationSlides[currentIndex]

  useEffect(() => {
    slideEnteredAtRef.current = Date.now()
    if (currentSlide?.backgroundVideoUrl) markVideoUrlReady(currentSlide.backgroundVideoUrl)
  }, [currentIndex, currentSlide?.backgroundVideoUrl])

  const subSlides = useMemo(() => getSubSlides(currentSlide), [currentSlide])
  const activeSubSlideRect = useMemo(
    () => getActiveSubSlideRect(currentSlide, subSlideIndex),
    [currentSlide, subSlideIndex]
  )
  const nextSlideData = presentationSlides[currentIndex + 1]
  const prevSlideData = presentationSlides[currentIndex - 1]
  const currentSlideHasVideo = hasVideoLayoutWithMedia(currentSlide)
  const nextSlideHasVideo = hasVideoLayoutWithMedia(nextSlideData)
  const prevSlideHasVideo = hasVideoLayoutWithMedia(prevSlideData)
  // When consecutive slides share same bg (image/video), use persistent background - no transition, just keep it
  const targetSlide = pendingIndex != null ? presentationSlides[pendingIndex] : null
  const sameBgNoTransition = targetSlide && sameBackground(currentSlide, targetSlide)
  const backgroundTransitionActive = transitionPhase === 'background-transition' && pendingIndex != null && !sameBgNoTransition
  // Always keep background in a dedicated layer (avoids flash when crossfade ends)
  const usePersistentBackground = slideHasBackgroundMedia(currentSlide)
    || (backgroundTransitionActive && slideHasBackgroundMedia(targetSlide))
  // Use persistent video layer only for slide-off/in when current slide has no background media
  const usePersistentVideo = !slideHasBackgroundMedia(currentSlide) && (currentSlideHasVideo || isSlidingOff || isSlidingIn)
  const usePersistentGradient = usePersistentBackground || usePersistentVideo
  // Which slide's video to show in PersistentVideoLayer
  const videoSlideForLayer = isSlidingOff ? videoSlideForTransitionRef.current : (currentSlideHasVideo ? currentSlide : null)
  const videoLayoutForLayer = (videoSlideForLayer?.layout || 'video') === 'title' ? 'centered' : (videoSlideForLayer?.layout || 'video')
  const bulletPoints = getBulletPoints(currentSlide)
  const isBulletSlide = (currentSlide?.layout || 'default') === 'bulletpoints'

  const globalMotionSettings = useMemo(() => ({}), [])

  const motion = useMemo(
    () => resolveMotionSettings(globalMotionSettings, currentSlide),
    [globalMotionSettings, currentSlide]
  )
  const incomingMotion = useMemo(
    () => (targetSlide ? resolveMotionSettings(globalMotionSettings, targetSlide) : motion),
    [globalMotionSettings, targetSlide, motion]
  )
  const outgoingMotion = useMemo(
    () => (outgoingTransitionSlide
      ? resolveMotionSettings(globalMotionSettings, outgoingTransitionSlide)
      : resolveMotionSettings(globalMotionSettings, currentSlide)),
    [globalMotionSettings, outgoingTransitionSlide, currentSlide]
  )
  const textExitClass = getTextExitClass(motion.textExitAnimation, motion.textAnimation)
  const outgoingTextExitClass = outgoingTransitionSlide
    ? getTextExitClass(outgoingMotion.textExitAnimation, outgoingMotion.textAnimation)
    : textExitClass

  // Defer preload slides until after first paint so only the selected slide shows when play starts
  useEffect(() => {
    const rafId = requestAnimationFrame(() => {
      requestAnimationFrame(() => setPreloadReady(true))
    })
    return () => cancelAnimationFrame(rafId)
  }, [])

  // Reset bullet reveal when changing slides (first bullet visible on bullet slides)
  useEffect(() => {
    setVisibleBulletIndex(isBulletSlide ? 0 : -1)
  }, [currentIndex, isBulletSlide])

  // Get transition duration based on style
  const getTransitionDuration = (style) => {
    const base = (() => {
      switch (style) {
        case 'dissolve': return 500
        case 'crossfade': return 500
        case 'sequence': return 600
        case 'canvas-push': return 550
        case 'blur': return 400
        case 'zoom': return 300
        case 'slide': return 300
        default: return 300
      }
    })()
    return Math.round(base * (transitionSpeed ?? 1))
  }

  const nextSlide = useCallback(() => {
    if (currentIndex >= presentationSlides.length - 1) return
    if (isTransitioning) return

    clearTransitionTimeouts()

    const nextIndex = currentIndex + 1
    const currentSlideData = presentationSlides[currentIndex]
    const nextSlideDataForNav = presentationSlides[nextIndex]
    const currentHasVideo = hasVideoLayoutWithMedia(currentSlideData)
    const nextHasVideo = hasVideoLayoutWithMedia(nextSlideDataForNav)
    const currentHasWebcam = isWebcamActiveForSlide(currentSlideData, recordSettings)
    const nextHasWebcam = nextSlideDataForNav && isWebcamActiveForSlide(nextSlideDataForNav, recordSettings)

    setTransitionPhase('idle')

    const navTransitionStyle = resolveTransitionStyle(transitionStyle, nextSlideDataForNav)

    if (navTransitionStyle === 'canvas-push') {
      const sameBgExact = sameBackgroundExact(currentSlideData, nextSlideDataForNav)
      if (sameBgExact) {
        setOutgoingTransitionSlide(currentSlideData)
        setIsTransitioning(true)
        setPendingIndex(nextIndex)
        setCurrentIndex(nextIndex)
        setTransitionPhase('fade-out')
        const transitionDuration = getTransitionDuration('canvas-push')
        scheduleTransition(() => {
          setOutgoingTransitionSlide(null)
          setPendingIndex(null)
          setTransitionPhase('idle')
          setIsTransitioning(false)
        }, transitionDuration)
        return
      }
      setIsTransitioning(true)
      setPendingIndex(nextIndex)
      pendingDirectionRef.current = 1
      setTransitionPhase('canvas-push')
      const transitionDuration = getTransitionDuration('canvas-push')
      scheduleTransition(() => {
        suppressTextEntranceAfterCanvasPushRef.current = true
        setCurrentIndex(nextIndex)
        setPendingIndex(null)
        setTransitionPhase('idle')
        setIsTransitioning(false)
      }, transitionDuration)
      return
    }

    const sameBgForNav = sameBackground(currentSlideData, nextSlideDataForNav)
    // When crossfade selected, use crossfade for all transitions (including video) - bg fades out as new fades in
    const useCrossfadeForVideo = navTransitionStyle === 'crossfade'
    // When same bg, skip video slide-off/slide-in - keep background, only transition content
    if (currentHasVideo && !nextHasVideo && !sameBgForNav && !useCrossfadeForVideo) {
      // Video → no video: slide video off to right, webcam off if needed
      setIsTransitioning(true)
      videoSlideForTransitionRef.current = currentSlideData
      if (currentHasWebcam && !nextHasWebcam) setIsWebcamSlidingOff(true)
      setCurrentIndex(nextIndex)
      setIsSlidingOff(true)
      scheduleTransition(() => {
        setIsSlidingOff(false)
        setIsWebcamSlidingOff(false)
        videoSlideForTransitionRef.current = null
        setIsTransitioning(false)
      }, Math.max(VIDEO_TRANSITION_MS, (currentHasWebcam && !nextHasWebcam) ? WEBCAM_TRANSITION_MS : 0))
    } else if (!currentHasVideo && nextHasVideo && !sameBgForNav && !useCrossfadeForVideo) {
      // No video → video: slide video in from right, webcam in if needed
      setIsTransitioning(true)
      setIsSlidingIn(true)
      if (!currentHasWebcam && nextHasWebcam) setIsWebcamSlidingIn(true)
      setCurrentIndex(nextIndex)
      scheduleTransition(() => {
        setIsSlidingIn(false)
        setIsWebcamSlidingIn(false)
        setIsTransitioning(false)
      }, Math.max(VIDEO_TRANSITION_MS, !currentHasWebcam && nextHasWebcam ? WEBCAM_TRANSITION_MS : 0))
    } else {
      const sameBgExact = sameBackgroundExact(currentSlideData, nextSlideDataForNav)
      const sameBg = sameBackground(currentSlideData, nextSlideDataForNav)
      const hasWebcamChange = currentHasWebcam !== nextHasWebcam
      const webcamLayoutChanged = hasWebcamLayoutChange(currentSlideData, nextSlideDataForNav, recordSettings)
      const webcamTransitionMs = (hasWebcamChange || webcamLayoutChanged) ? WEBCAM_TRANSITION_MS : 0
      const transitionDuration = getTransitionDuration(navTransitionStyle)

      if (sameBgExact) {
        setOutgoingTransitionSlide(currentSlideData)
        setIsTransitioning(true)
        setPendingIndex(nextIndex)
        setCurrentIndex(nextIndex)
        setTransitionPhase('fade-out')
        scheduleTransition(() => {
          setOutgoingTransitionSlide(null)
          setPendingIndex(null)
          setTransitionPhase('idle')
          setIsTransitioning(false)
        }, transitionDuration)
        return
      }

      if (currentHasWebcam && !nextHasWebcam) {
        setIsWebcamSlidingOff(true)
      }
      if (!currentHasWebcam && nextHasWebcam) {
        setIsWebcamSlidingIn(true)
      }

      setIsTransitioning(true)
      setPendingIndex(nextIndex)
      pendingDirectionRef.current = 1

      if (!sameBg) {
        // Incoming bg/content start immediately; outgoing layers fade out on top (no remount at end)
        const outgoingScale = getBackgroundScaleProgress(Date.now() - slideEnteredAtRef.current, KEN_BURNS_DURATION_S)
        setFrozenBgScale({ outgoing: outgoingScale, incoming: 0 })
        setOutgoingTransitionSlide(currentSlideData)
        setCurrentIndex(nextIndex)
        setTransitionPhase('background-transition')
        const phaseDuration = Math.max(transitionDuration, webcamTransitionMs)
        scheduleTransition(() => {
          finishBackgroundTransition()
        }, phaseDuration)
      } else if (sameBg) {
        // Same bg, different position/scale: incoming content starts immediately, outgoing text fades out on top
        setOutgoingTransitionSlide(currentSlideData)
        setCurrentIndex(nextIndex)
        setTransitionPhase('fade-out')
        const phase1Duration = Math.max(transitionDuration, webcamTransitionMs)
        scheduleTransition(() => {
          setOutgoingTransitionSlide(null)
          setPendingIndex(null)
          setTransitionPhase('idle')
          setIsWebcamSlidingOff(false)
          setIsWebcamSlidingIn(false)
          setIsTransitioning(false)
        }, phase1Duration)
      }
    }
  }, [presentationSlides, currentIndex, isTransitioning, transitionStyle, transitionSpeed, recordSettings, clearTransitionTimeouts, scheduleTransition, finishBackgroundTransition])

  const prevSlide = useCallback(() => {
    if (currentIndex <= 0) return
    if (isTransitioning) return

    clearTransitionTimeouts()

    const prevIndex = currentIndex - 1
    const currentSlideData = presentationSlides[currentIndex]
    const prevSlideDataForNav = presentationSlides[prevIndex]
    const currentHasVideo = hasVideoLayoutWithMedia(currentSlideData)
    const prevHasVideo = hasVideoLayoutWithMedia(prevSlideDataForNav)
    const currentHasWebcam = isWebcamActiveForSlide(currentSlideData, recordSettings)
    const prevHasWebcam = prevSlideDataForNav && isWebcamActiveForSlide(prevSlideDataForNav, recordSettings)

    setTransitionPhase('idle')

    const navTransitionStyle = resolveTransitionStyle(transitionStyle, prevSlideDataForNav)

    if (navTransitionStyle === 'canvas-push') {
      const sameBgExact = sameBackgroundExact(currentSlideData, prevSlideDataForNav)
      if (sameBgExact) {
        setOutgoingTransitionSlide(currentSlideData)
        setIsTransitioning(true)
        setPendingIndex(prevIndex)
        setCurrentIndex(prevIndex)
        setTransitionPhase('fade-out')
        const transitionDuration = getTransitionDuration('canvas-push')
        scheduleTransition(() => {
          setOutgoingTransitionSlide(null)
          setPendingIndex(null)
          setTransitionPhase('idle')
          setIsTransitioning(false)
        }, transitionDuration)
        return
      }
      setIsTransitioning(true)
      setPendingIndex(prevIndex)
      pendingDirectionRef.current = -1
      setTransitionPhase('canvas-push')
      const transitionDuration = getTransitionDuration('canvas-push')
      scheduleTransition(() => {
        suppressTextEntranceAfterCanvasPushRef.current = true
        setCurrentIndex(prevIndex)
        setPendingIndex(null)
        setTransitionPhase('idle')
        setIsTransitioning(false)
      }, transitionDuration)
      return
    }

    const sameBgForNavPrev = sameBackground(currentSlideData, prevSlideDataForNav)
    const useCrossfadeForVideoPrev = navTransitionStyle === 'crossfade'
    // When same bg, skip video slide-off/slide-in - keep background, only transition content
    if (currentHasVideo && !prevHasVideo && !sameBgForNavPrev && !useCrossfadeForVideoPrev) {
      // Video → no video (going back): slide video off to right, webcam off if needed
      setIsTransitioning(true)
      videoSlideForTransitionRef.current = currentSlideData
      if (currentHasWebcam && !prevHasWebcam) setIsWebcamSlidingOff(true)
      setCurrentIndex(prevIndex)
      setIsSlidingOff(true)
      scheduleTransition(() => {
        setIsSlidingOff(false)
        setIsWebcamSlidingOff(false)
        videoSlideForTransitionRef.current = null
        setIsTransitioning(false)
      }, Math.max(VIDEO_TRANSITION_MS, (currentHasWebcam && !prevHasWebcam) ? WEBCAM_TRANSITION_MS : 0))
    } else if (!currentHasVideo && prevHasVideo && !sameBgForNavPrev && !useCrossfadeForVideoPrev) {
      // No video → video (going back): slide video in from right, webcam in if needed
      setIsTransitioning(true)
      setIsSlidingIn(true)
      if (!currentHasWebcam && prevHasWebcam) setIsWebcamSlidingIn(true)
      setCurrentIndex(prevIndex)
      scheduleTransition(() => {
        setIsSlidingIn(false)
        setIsWebcamSlidingIn(false)
        setIsTransitioning(false)
      }, Math.max(VIDEO_TRANSITION_MS, (!currentHasWebcam && prevHasWebcam) ? WEBCAM_TRANSITION_MS : 0))
    } else {
      const sameBgExact = sameBackgroundExact(currentSlideData, prevSlideDataForNav)
      const sameBg = sameBackground(currentSlideData, prevSlideDataForNav)
      const hasWebcamChange = currentHasWebcam !== prevHasWebcam
      const webcamLayoutChanged = hasWebcamLayoutChange(prevSlideDataForNav, currentSlideData, recordSettings)
      const webcamTransitionMs = (hasWebcamChange || webcamLayoutChanged) ? WEBCAM_TRANSITION_MS : 0
      const transitionDuration = getTransitionDuration(navTransitionStyle)

      if (sameBgExact) {
        setOutgoingTransitionSlide(currentSlideData)
        setIsTransitioning(true)
        setPendingIndex(prevIndex)
        setCurrentIndex(prevIndex)
        setTransitionPhase('fade-out')
        scheduleTransition(() => {
          setOutgoingTransitionSlide(null)
          setPendingIndex(null)
          setTransitionPhase('idle')
          setIsTransitioning(false)
        }, transitionDuration)
        return
      }

      if (currentHasWebcam && !prevHasWebcam) setIsWebcamSlidingOff(true)
      if (!currentHasWebcam && prevHasWebcam) setIsWebcamSlidingIn(true)

      setIsTransitioning(true)
      setPendingIndex(prevIndex)
      pendingDirectionRef.current = -1

      if (!sameBg) {
        const outgoingScale = getBackgroundScaleProgress(Date.now() - slideEnteredAtRef.current, KEN_BURNS_DURATION_S)
        setFrozenBgScale({ outgoing: outgoingScale, incoming: 0 })
        setOutgoingTransitionSlide(currentSlideData)
        setCurrentIndex(prevIndex)
        setTransitionPhase('background-transition')
        const phaseDuration = Math.max(transitionDuration, webcamTransitionMs)
        scheduleTransition(() => {
          finishBackgroundTransition()
        }, phaseDuration)
      } else if (sameBg) {
        setOutgoingTransitionSlide(currentSlideData)
        setCurrentIndex(prevIndex)
        setTransitionPhase('fade-out')
        const phase1Duration = Math.max(transitionDuration, webcamTransitionMs)
        scheduleTransition(() => {
          setOutgoingTransitionSlide(null)
          setPendingIndex(null)
          setTransitionPhase('idle')
          setIsWebcamSlidingOff(false)
          setIsWebcamSlidingIn(false)
          setIsTransitioning(false)
        }, phase1Duration)
      }
    }
  }, [presentationSlides, currentIndex, isTransitioning, transitionStyle, transitionSpeed, recordSettings, clearTransitionTimeouts, scheduleTransition, finishBackgroundTransition])

  const advancePresentation = useCallback(() => {
    if (isTransitioning) return

    if (isBulletSlide && visibleBulletIndex < bulletPoints.length - 1) {
      setVisibleBulletIndex((prev) => prev + 1)
      return
    }

    if (subSlides.length > 0 && subSlideIndex < subSlides.length - 1) {
      setSubSlideIndex((prev) => prev + 1)
      return
    }

    nextSlide()
  }, [
    isTransitioning,
    isBulletSlide,
    visibleBulletIndex,
    bulletPoints.length,
    subSlides.length,
    subSlideIndex,
    nextSlide,
  ])

  const retreatPresentation = useCallback(() => {
    if (isTransitioning) return

    if (isBulletSlide && visibleBulletIndex >= 0) {
      setVisibleBulletIndex((prev) => prev - 1)
      return
    }

    if (subSlideIndex > 0) {
      setSubSlideIndex((prev) => prev - 1)
      return
    }
    if (subSlideIndex === 0) {
      setSubSlideIndex(-1)
      return
    }

    prevSlide()
  }, [
    isTransitioning,
    isBulletSlide,
    visibleBulletIndex,
    subSlideIndex,
    prevSlide,
  ])

  // Cleanup only on unmount. Do NOT stop the screen stream if it came from App (initialScreenStreamRef) so it survives React double-mount and recording can start.
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
      }
      if (screenStreamRef.current) {
        const isAppOwned = initialScreenStreamRef?.current && screenStreamRef.current === initialScreenStreamRef.current
        if (!isAppOwned) {
          screenStreamRef.current.getTracks().forEach(track => track.stop())
        }
        screenStreamRef.current = null
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop())
        audioStreamRef.current = null
      }
      if (combinedStreamRef.current) {
        combinedStreamRef.current.getTracks().forEach(track => track.stop())
        combinedStreamRef.current = null
      }
      isStartingRecordingRef.current = false
    }
  }, [])

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      setRecordingState('stopping')
      mediaRecorderRef.current.stop()
    }
    isStartingRecordingRef.current = false
  }

  const startRecording = async () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') return
    try {
      recordedChunksRef.current = []

      // Use stream from Record button only if it still has a live track (survives remount); otherwise get a new one
      let displayStream
      const appStream = initialScreenStreamRef?.current
      const appVideoTracks = appStream?.getVideoTracks() ?? []
      if (appStream && appVideoTracks.length > 0 && appVideoTracks[0].readyState === 'live') {
        displayStream = appStream
      } else {
        const resolution = recordSettings?.recordingResolution || '1080p'
        const videoConstraint = resolution === 'original'
          ? true
          : resolution === '1080p'
            ? { width: { ideal: 1920 }, height: { ideal: 1080 } }
            : resolution === '720p'
              ? { width: { ideal: 1280 }, height: { ideal: 720 } }
              : { width: { ideal: 854 }, height: { ideal: 480 } }
        displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: videoConstraint,
          audio: false
        })
      }
      screenStreamRef.current = displayStream

      // Get microphone if enabled
      let audioStream = null
      if (recordSettings.microphoneEnabled && recordSettings.selectedMicrophoneId) {
        try {
          audioStream = await navigator.mediaDevices.getUserMedia({
            audio: { deviceId: { exact: recordSettings.selectedMicrophoneId } }
          })
          audioStreamRef.current = audioStream
        } catch (error) {
          console.warn('Could not access microphone:', error)
        }
      }

      // Combine video from display + optional mic audio
      const streamToRecord = new MediaStream()
      displayStream.getVideoTracks().forEach((t) => streamToRecord.addTrack(t))
      if (audioStream) {
        audioStream.getAudioTracks().forEach((t) => streamToRecord.addTrack(t))
      }
      combinedStreamRef.current = streamToRecord

      // Use recording output settings (format + quality)
      const format = recordSettings?.recordingFileFormat || 'webm-vp9'
      const formatCandidates =
        format === 'webm-vp9'
          ? ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
          : format === 'webm-vp8'
            ? ['video/webm;codecs=vp8,opus', 'video/webm']
            : ['video/webm']
      const mimeType = formatCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || 'video/webm'
      const quality = recordSettings?.recordingQuality || 'high'
      const videoBitsPerSecond = quality === 'low' ? 1000000 : quality === 'medium' ? 2500000 : 5000000
      const mediaRecorder = new MediaRecorder(streamToRecord, {
        mimeType,
        videoBitsPerSecond,
        audioBitsPerSecond: audioStream ? 128000 : undefined
      })
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const type = mediaRecorder.mimeType || 'video/webm'
        const blob = new Blob(recordedChunksRef.current, { type })
        const dateStr = new Date().toISOString().split('T')[0]
        const webmFilename = `presentation-recording-${dateStr}.webm`
        const mp4Filename = `presentation-recording-${dateStr}.mp4`

        if (blob.size < 1000) {
          setRecordingState('idle')
          alert('Recording produced no data. Make sure you chose a screen/window to share and try again.')
          return
        }

        // Cleanup streams immediately so UI can show processing overlay if needed
        if (screenStreamRef.current) {
          screenStreamRef.current.getTracks().forEach(track => track.stop())
          screenStreamRef.current = null
        }
        if (audioStreamRef.current) {
          audioStreamRef.current.getTracks().forEach(track => track.stop())
          audioStreamRef.current = null
        }
        if (combinedStreamRef.current) {
          combinedStreamRef.current.getTracks().forEach(track => track.stop())
          combinedStreamRef.current = null
        }
        setRecordingState('idle')

        const doDownload = (resultBlob, filename) => {
          if (onRecordingDone && resultBlob) onRecordingDone(resultBlob)
          const url = URL.createObjectURL(resultBlob)
          const link = document.createElement('a')
          link.href = url
          link.download = filename
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          URL.revokeObjectURL(url)
        }

        const runEncodingAndDownload = (resultBlob, fallbackFilename) => {
          setCaptionsProcessing('encoding')
          import('../utils/ffmpegExport')
            .then(({ convertToMp4 }) => convertToMp4(resultBlob))
            .then((mp4Blob) => {
              doDownload(mp4Blob, mp4Filename)
              setCaptionsProcessing('idle')
            })
            .catch((err) => {
              console.error('FFmpeg encoding error:', err)
              doDownload(resultBlob, fallbackFilename)
              setCaptionsProcessing('idle')
            })
        }

        const captionsEnabled = recordSettings.captionsEnabled === true
        const hasOpenAI = openaiKey && openaiKey.trim().length > 0

        if (captionsEnabled && hasOpenAI) {
          setCaptionsProcessing('transcribing')
          transcribeWithWhisper(blob, openaiKey.trim())
            .then((segments) => {
              setCaptionsProcessing('burning')
              return burnCaptionsIntoVideo(blob, segments, recordSettings.captionStyle || 'bottom-black', recordSettings.captionFont || 'Poppins', recordSettings.captionFontSize || 'medium', recordSettings.captionDropShadow === true)
            })
            .then((resultBlob) => runEncodingAndDownload(resultBlob, webmFilename))
            .catch((err) => {
              console.error('Captions pipeline error:', err)
              alert(`Captions failed: ${err.message}. Encoding recording without captions.`)
              runEncodingAndDownload(blob, webmFilename)
            })
        } else {
          runEncodingAndDownload(blob, webmFilename)
        }
      }

      const videoTracks = displayStream.getVideoTracks()
      if (videoTracks.length > 0) {
        videoTracks[0].onended = () => {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            stopRecording()
          }
          isStartingRecordingRef.current = false
        }
      }

      await new Promise(resolve => setTimeout(resolve, 200))
      mediaRecorder.start(1000) // Collect data every second
      setRecordingState('recording')
      isStartingRecordingRef.current = false
    } catch (error) {
      console.error('Error starting recording:', error)
      setRecordingState('idle')
      isStartingRecordingRef.current = false
      alert('Failed to start recording. Please check your permissions.')
    }
  }

  // Auto-start recording when entering record mode (must run after startRecording/stopRecording exist — avoids TDZ / "Cannot access before initialization" in production bundles)
  useEffect(() => {
    if (isRecording && recordingState === 'idle' && !isStartingRecordingRef.current) {
      isStartingRecordingRef.current = true
      startRecording()
    } else if (!isRecording && recordingState === 'recording') {
      stopRecording()
      isStartingRecordingRef.current = false
    }
  }, [isRecording, recordingState])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        // End recording first so MediaRecorder stops properly and onstop runs (blob + download), then exit
        if (recordingState === 'recording' || recordingState === 'stopping') {
          stopRecording()
        }
        if (document.fullscreenElement) {
          document.exitFullscreen()
        } else {
          onExit()
        }
        return
      } else if ((e.key === 'ArrowRight' || e.key === ' ') && !isTransitioning && !drawingEnabled) {
        e.preventDefault()
        advancePresentation()
      } else if (e.key === 'ArrowLeft' && !isTransitioning && !drawingEnabled) {
        e.preventDefault()
        retreatPresentation()
      } else if (e.key === 'ArrowDown' && !isTransitioning && !drawingEnabled) {
        e.preventDefault()
        advancePresentation()
      } else if (e.key === 'ArrowUp' && !isTransitioning && !drawingEnabled) {
        e.preventDefault()
        retreatPresentation()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isTransitioning, onExit, advancePresentation, retreatPresentation, recordingState, stopRecording, drawingEnabled])

  const handleClick = (e) => {
    if (isTransitioning || drawingEnabled) return
    
    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const width = rect.width
    
    if (clickX > width / 2) {
      advancePresentation()
    } else {
      retreatPresentation()
    }
  }

  const [isFullscreen, setIsFullscreen] = useState(false)

  // Present-only: auto-enter fullscreen on mount (user gesture from Present button). Record mode does not enter fullscreen.
  useEffect(() => {
    if (!isRecording && !document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
    }
  }, [isRecording])

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!document.fullscreenElement
      setIsFullscreen(isCurrentlyFullscreen)
      
      // If fullscreen is exited, return to edit mode
      if (!isCurrentlyFullscreen) {
        onExit()
      }
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [onExit])

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {
        // Ignore: browser may block (e.g. not in user gesture). Do not log – browser already shows a message.
      })
    } else {
      document.exitFullscreen()
    }
  }

  if (presentationSlides.length === 0) {
    return (
      <div className="play-mode">
        <div className="play-empty">No slides to play</div>
        <button className="btn-exit" onClick={onExit}>Exit</button>
      </div>
    )
  }

  const currentSlideLayout = currentSlide?.layout || 'default'
  const nextSlideLayout = presentationSlides[currentIndex + 1]?.layout || currentSlideLayout

  const currentSlideHasWebcam = isWebcamActiveForSlide(currentSlide, recordSettings)
  const nextSlideHasWebcam = nextSlideData && isWebcamActiveForSlide(nextSlideData, recordSettings)
  const anySlideHasWebcam = isAnyWebcamActive(presentationSlides, recordSettings)
  const webcamCameraId = getWebcamCameraId(currentSlide, recordSettings) || getWebcamCameraId(nextSlideData, recordSettings) || recordSettings?.selectedCameraId || ''
  const webcamShouldPreload = nextSlideHasWebcam && !currentSlideHasWebcam
  // Keep webcam stream running when on non-webcam slides (for smooth slide-in when returning to webcam slide)
  const webcamShouldKeepAlive = anySlideHasWebcam && !currentSlideHasWebcam

  // Common Slide props (shared by visible and preload slides)
  const commonSlideProps = {
    backgroundColor,
    textColor,
    fontFamily,
    defaultTextSize,
    h1Size,
    h2Size,
    h3Size,
    h1FontFamily,
    h2FontFamily,
    h3FontFamily,
    isPlayMode: true,
    textDropShadow,
    shadowBlur,
    shadowOffsetX,
    shadowOffsetY,
    shadowColor,
    textOutline,
    outlineWidth,
    outlineColor,
    webcamEnabled: false,
    selectedCameraId: recordSettings?.selectedCameraId ?? '',
    webcamSize: normalizeWebcamSizePercent(recordSettings.webcamSize),
    webcamFlipHorizontal: recordSettings?.webcamFlipHorizontal === true,
    webcamFlipVertical: recordSettings?.webcamFlipVertical === true,
    videoBrightness: typeof recordSettings?.videoBrightness === 'number' ? recordSettings.videoBrightness : 1,
    videoContrast: typeof recordSettings?.videoContrast === 'number' ? recordSettings.videoContrast : 1,
    videoSaturation: typeof recordSettings?.videoSaturation === 'number' ? recordSettings.videoSaturation : 1,
    videoShadows: typeof recordSettings?.videoShadows === 'number' ? recordSettings.videoShadows : 1,
    videoMidtones: typeof recordSettings?.videoMidtones === 'number' ? recordSettings.videoMidtones : 1,
    videoHighlights: typeof recordSettings?.videoHighlights === 'number' ? recordSettings.videoHighlights : 1,
    videoShadowHue: typeof recordSettings?.videoShadowHue === 'number' ? recordSettings.videoShadowHue : 0,
    videoMidHue: typeof recordSettings?.videoMidHue === 'number' ? recordSettings.videoMidHue : 0,
    videoHighlightHue: typeof recordSettings?.videoHighlightHue === 'number' ? recordSettings.videoHighlightHue : 0,
    textInlineBackground,
    inlineBgColor,
    inlineBgOpacity,
    inlineBgPadding,
    lineHeight,
    bulletLineHeight,
    bulletTextSize,
    bulletGap,
    bulletStyle,
    contentBottomOffset,
    contentEdgeOffset,
    contentVerticalAlign,
    showBullets,
    defaultFontWeight,
    h1Weight,
    h2Weight,
    h3Weight,
    h1LineHeight,
    h2LineHeight,
    h3LineHeight,
    textStyleMode: textStyleMode || 'standard',
    fontPairingSerifFont: fontPairingSerifFont || 'Playfair Display',
    slideFormat
  }

  const webcamTargetSlide = webcamShouldPreload ? nextSlideData : currentSlide
  const webcamTargetLayout = webcamShouldPreload ? nextSlideLayout : currentSlideLayout

  // Scale canvas to fit viewport while preserving exact pixel dimensions
  const [viewportSize, setViewportSize] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }))
  useEffect(() => {
    const onResize = () => setViewportSize({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  const scale = Math.min(viewportSize.w / canvasSize.w, viewportSize.h / canvasSize.h)

  // Use target slide for background during same-bg transition so position/scale animates smoothly
  const backgroundSlideForPosScale = sameBgNoTransition && targetSlide ? targetSlide : currentSlide
  const persistentBackgroundSlide = backgroundTransitionActive && outgoingTransitionSlide
    ? outgoingTransitionSlide
    : backgroundSlideForPosScale
  const incomingBackgroundSlide = (backgroundTransitionActive && targetSlide)
    || (bgIncomingHold && slideHasBackgroundMedia(currentSlide) ? currentSlide : null)
  const transitionStyleSlide = targetSlide ?? currentSlide
  const resolvedTransitionStyle = resolveTransitionStyle(transitionStyle, transitionStyleSlide)
  const transitionDurationMs = getTransitionDuration(resolvedTransitionStyle)
  const textExitDurationMs = getTextExitDuration(transitionDurationMs)
  const activeTransitionStyle = normalizeTransitionStyle(resolvedTransitionStyle)

  const canvasPushActive = transitionPhase === 'canvas-push' && targetSlide
  const activeCanvasPushDirection = targetSlide
    ? resolveCanvasPushDirection(canvasPushDirection, targetSlide)
    : canvasPushDirection
  const canvasPushConfig = canvasPushActive
    ? getCanvasPushTransform(activeCanvasPushDirection, pendingDirectionRef.current)
    : null
  const canvasPushPanels = canvasPushActive && canvasPushConfig
    ? (canvasPushConfig.panelOrder === 'out-in'
      ? [
          { slide: currentSlide, motion: outgoingMotion, key: 'out' },
          { slide: targetSlide, motion: incomingMotion, key: 'in' },
        ]
      : [
          { slide: targetSlide, motion: incomingMotion, key: 'in' },
          { slide: currentSlide, motion: outgoingMotion, key: 'out' },
        ])
    : []

  const hasTextEntranceAnim = motion.textAnimation && motion.textAnimation !== 'none'
  const outgoingBulletPoints = outgoingTransitionSlide ? getBulletPoints(outgoingTransitionSlide) : []
  const outgoingIsBulletSlide = outgoingTransitionSlide && (outgoingTransitionSlide.layout || 'default') === 'bulletpoints'

  const renderCanvasPushTrack = (layerKind) => (
    <div
      className={`play-canvas-push-viewport play-canvas-push-${layerKind}`}
      style={{
        '--transition-duration': `${transitionDurationMs}ms`,
        '--push-from-x': canvasPushConfig.fromX,
        '--push-to-x': canvasPushConfig.toX,
        '--push-from-y': canvasPushConfig.fromY,
        '--push-to-y': canvasPushConfig.toY,
      }}
    >
      <div className={`play-canvas-push-track ${canvasPushConfig.vertical ? 'canvas-push-vertical' : 'canvas-push-horizontal'}`}>
        {canvasPushPanels.map(({ slide, motion: panelMotion, key }) => (
          <div key={key} className="play-canvas-push-panel">
            {layerKind === 'bg' ? (
              <>
                <div className="play-layer-bg-color" style={{ backgroundColor: getSlideBackgroundColor(slide, backgroundColor || '#1a1a1a') }} />
                {slideHasBackgroundMedia(slide) && (
                  <SlideBackground
                    slide={slide}
                    kenBurns={panelMotion.kenBurns}
                    backgroundKenBurnsDirection={panelMotion.backgroundKenBurnsDirection}
                    frozenScaleProgress={null}
                    isPreload={false}
                    isPlayMode={true}
                  />
                )}
              </>
            ) : (
              <>
                <GradientOverlay slide={slide} backgroundColor={backgroundColor} />
                <div className="play-slide-container play-slide-content-only">
                  <Slide
                    slide={slide}
                    {...commonSlideProps}
                    cameraOverrideEnabled={false}
                    visibleBulletIndex={-1}
                    visibleLineIndex={null}
                    suppressTextAnimation={key === 'out'}
                    isPreload={false}
                    hideBackground={true}
                    hideGradient={true}
                  />
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )

  const currentSlideBgColor = getSlideBackgroundColor(currentSlide, backgroundColor || '#1a1a1a')

  const cameraStyle = getSubSlideCameraStyle(activeSubSlideRect)

  return (
    <div className="play-mode" onClick={handleClick} style={{ paddingBottom: showMenu ? '80px' : '0', backgroundColor: backgroundColor || '#1a1a1a', '--transition-duration': `${transitionDurationMs}ms`, '--text-exit-duration': `${textExitDurationMs}ms` }}>
      <div
        className="play-canvas-wrapper"
        style={{
          width: canvasSize.w,
          height: canvasSize.h,
          transform: `scale(${scale})`,
          transformOrigin: 'center center'
        }}
      >
      <div className="play-camera-layer" style={cameraStyle}>
      {/* Layer 0: Background color */}
      {!canvasPushActive && (
      <>
      <div
        className="play-layer-bg-color"
        style={{
          backgroundColor: currentSlideBgColor,
          transition: `background-color ${WEBCAM_TRANSITION_MS}ms ${WEBCAM_EASING}`,
        }}
        aria-hidden="true"
      />
      {/* Layer 1: Background image/video - transition applied here (not webcam) */}
      <div className="play-background-transition-wrapper">
        {usePersistentVideo && videoSlideForLayer && (
          <PersistentVideoLayer
            videoSlide={videoSlideForLayer}
            layout={videoLayoutForLayer}
            isSlidingOff={isSlidingOff}
            isSlidingIn={isSlidingIn}
            canvasSize={canvasSize}
            recordSettings={recordSettings}
          />
        )}
        {incomingBackgroundSlide && (
          <div
            className={`play-bg-incoming-overlay ${bgIncomingHold ? 'play-bg-incoming-settled' : `play-bg-incoming-transition transition-${activeTransitionStyle}`}`}
            style={{
              '--bg-opacity': incomingBackgroundSlide?.backgroundOpacity !== undefined ? incomingBackgroundSlide.backgroundOpacity : 0.6,
              '--transition-duration': `${transitionDurationMs}ms`,
            }}
            aria-hidden="true"
          >
            <SlideBackground
              key={getBackgroundMediaKey(incomingBackgroundSlide)}
              slide={incomingBackgroundSlide}
              kenBurns={incomingMotion.kenBurns}
              backgroundKenBurnsDirection={incomingMotion.backgroundKenBurnsDirection}
              frozenScaleProgress={frozenBgScale.incoming}
              isPreload={false}
              isPlayMode={true}
            />
          </div>
        )}
        {usePersistentBackground && (
          <div
            className={`play-background-layer ${backgroundTransitionActive ? `play-bg-outgoing-transition transition-${activeTransitionStyle}` : 'play-bg-settled'} ${sameBgNoTransition ? 'play-bg-pos-scale-transition' : ''}`}
            style={{
              '--bg-opacity': persistentBackgroundSlide?.backgroundOpacity !== undefined ? persistentBackgroundSlide.backgroundOpacity : 0.6,
              '--pos-scale-duration': `${transitionDurationMs}ms`,
              '--transition-duration': `${transitionDurationMs}ms`,
            }}
            aria-hidden="true"
          >
            <SlideBackground
              key={getBackgroundMediaKey(persistentBackgroundSlide)}
              slide={persistentBackgroundSlide}
              kenBurns={backgroundTransitionActive ? outgoingMotion.kenBurns : motion.kenBurns}
              backgroundKenBurnsDirection={backgroundTransitionActive ? outgoingMotion.backgroundKenBurnsDirection : motion.backgroundKenBurnsDirection}
              frozenScaleProgress={backgroundTransitionActive ? frozenBgScale.outgoing : null}
              isPreload={false}
              isPlayMode={true}
            />
          </div>
        )}
      </div>
      </>
      )}
      {canvasPushActive && canvasPushConfig && renderCanvasPushTrack('bg')}
      {!canvasPushActive && usePersistentGradient && (
        <GradientOverlay
          slide={currentSlide}
          backgroundColor={backgroundColor}
        />
      )}
      {/* Persistent webcam — above gradient, below slide text; survives slide changes for smooth layout morphs */}
      {anySlideHasWebcam && webcamCameraId && (
        <div
          className="play-webcam-layer"
          aria-hidden="true"
          style={{ '--webcam-transition-duration': `${WEBCAM_TRANSITION_MS}ms` }}
        >
          <WebcamOverlay
            cameraId={webcamCameraId}
            layout={webcamTargetLayout}
            webcamSize={normalizeWebcamSizePercent(recordSettings.webcamSize)}
            isVisible={currentSlideHasWebcam}
            shouldPreload={webcamShouldPreload}
            shouldKeepAlive={webcamShouldKeepAlive}
            isSlidingOff={isWebcamSlidingOff}
            isSlidingIn={isWebcamSlidingIn}
            cameraOverrideEnabled={webcamTargetSlide?.cameraOverrideEnabled === true || recordSettings.cameraOverrideEnabled === true}
            cameraOverridePosition={webcamTargetSlide?.cameraOverridePosition || recordSettings.cameraOverridePosition || 'fullscreen'}
            recordSettings={recordSettings}
            canvasSize={canvasSize}
          />
        </div>
      )}
      {canvasPushActive && canvasPushConfig && renderCanvasPushTrack('content')}
      {/* Content layer: incoming slide renders below; outgoing overlay fades out on top during transitions */}
      {!canvasPushActive && outgoingTransitionSlide && (
      <div
        className={`play-slide-container play-content-outgoing play-slide-content-only text-out ${outgoingTextExitClass}`}
        aria-hidden="true"
        style={{ '--text-exit-duration': `${textExitDurationMs}ms` }}
      >
        <Slide
          slide={outgoingTransitionSlide}
          {...commonSlideProps}
          cameraOverrideEnabled={outgoingTransitionSlide?.cameraOverrideEnabled === true || recordSettings?.cameraOverrideEnabled === true}
          cameraOverridePosition={outgoingTransitionSlide?.cameraOverridePosition || recordSettings?.cameraOverridePosition || 'fullscreen'}
          visibleBulletIndex={outgoingIsBulletSlide ? Math.max(0, outgoingBulletPoints.length - 1) : -1}
          visibleLineIndex={null}
          suppressTextAnimation={true}
          isPreload={false}
          hideBackground={true}
          hideGradient={true}
        />
      </div>
      )}
      {!canvasPushActive && (
      <div 
        key={currentSlide?.id ?? currentIndex}
        className={`play-slide-container play-slide-content-transition transition-${activeTransitionStyle} ${outgoingTransitionSlide ? 'transition-in-progress' : ''} ${hasTextEntranceAnim ? 'has-text-entrance-anim' : ''} ${currentSlideLayout === 'video' || currentSlideLayout === 'left-video' || currentSlideLayout === 'right-video' ? 'play-slide-container-video-layout' : ''} ${usePersistentBackground || usePersistentVideo || backgroundTransitionActive ? 'play-slide-content-only' : ''} ${motion.backgroundBlurOnTextEnter ? 'bg-blur-on-text-enter' : ''}`}
        style={{ '--bg-opacity': currentSlide?.backgroundOpacity !== undefined ? currentSlide.backgroundOpacity : 0.6 }}
      >
        <Slide 
          slide={presentationSlides[currentIndex]} 
          {...commonSlideProps}
          cameraOverrideEnabled={currentSlide?.cameraOverrideEnabled === true || recordSettings?.cameraOverrideEnabled === true}
          cameraOverridePosition={currentSlide?.cameraOverridePosition || recordSettings?.cameraOverridePosition || 'fullscreen'}
          visibleBulletIndex={isBulletSlide ? Math.max(0, visibleBulletIndex) : visibleBulletIndex}
          visibleLineIndex={null}
          suppressTextAnimation={suppressTextEntranceAfterCanvasPushRef.current || !!outgoingTransitionSlide}
          isPreload={false}
          hideBackground={true}
          hideGradient={true}
        />
      </div>
      )}
      {/* Preload next slides' videos so they play immediately when entering (bounded to PRELOAD_AHEAD to limit memory). Only render after first paint to avoid overlapping text on play start. */}
      <DrawingLayer
        ref={drawingLayerRef}
        slideId={currentSlide?.id}
        width={canvasSize.w}
        height={canvasSize.h}
        penColors={penColors}
        projectName={projectName}
        drawingEnabled={drawingEnabled}
        tool={drawTool}
        color={drawColor}
        brushSize={drawBrushSize}
        onDrawingPersist={(slideId, path) => {
          onDrawingPersist?.(slideId, path ? drawingRelativePath(slideId) : null)
        }}
      />
      {preloadReady && (
      <div className="play-preload-zone" aria-hidden="true">
        {Array.from({ length: PRELOAD_AHEAD }, (_, i) => currentIndex + i + 1).map((idx) => {
          const preloadSlide = presentationSlides[idx]
          if (!preloadSlide) return null
          return (
            <div key={preloadSlide.id} className="play-preload-slide">
              {slideHasBackgroundMedia(preloadSlide) && (
                <SlideBackground
                  key={getBackgroundMediaKey(preloadSlide)}
                  slide={preloadSlide}
                  isPreload={true}
                  isPlayMode={true}
                />
              )}
              <Slide
                slide={preloadSlide}
                {...commonSlideProps}
                cameraOverrideEnabled={preloadSlide?.cameraOverrideEnabled === true || recordSettings?.cameraOverrideEnabled === true}
                cameraOverridePosition={preloadSlide?.cameraOverridePosition || recordSettings?.cameraOverridePosition || 'fullscreen'}
                visibleBulletIndex={-1}
                visibleLineIndex={null}
                isPreload={true}
                hideBackground={true}
                hideGradient={true}
              />
            </div>
          )
        })}
      </div>
      )}
      </div>
      </div>
      {captionsProcessing !== 'idle' && (
        <div className="captions-processing-overlay">
          <div className="captions-processing-content">
            <span className="captions-processing-spinner" />
            <span>
              {captionsProcessing === 'transcribing' && 'Transcribing audio…'}
              {captionsProcessing === 'burning' && 'Adding captions to video…'}
              {captionsProcessing === 'encoding' && 'Encoding to MP4…'}
            </span>
          </div>
        </div>
      )}
      <div className={`play-controls ${showMenu ? 'play-controls-bar' : ''}`}>
          <DrawingToolbar
            drawingEnabled={drawingEnabled}
            onToggleDrawing={() => setDrawingEnabled((v) => !v)}
            penColors={penColors}
            tool={drawTool}
            onToolChange={setDrawTool}
            color={drawColor}
            onColorChange={setDrawColor}
            brushSize={drawBrushSize}
            onBrushSizeChange={setDrawBrushSize}
            onClear={() => drawingLayerRef.current?.clear()}
          />
          <div className="play-slide-indicator">
            {currentIndex + 1} / {presentationSlides.length}
            {subSlides.length > 0 && subSlideIndex >= 0 && (
              <span className="play-subslide-indicator"> · Sub {subSlideIndex + 1}/{subSlides.length}</span>
            )}
          </div>
          {isRecording && recordingState === 'recording' && (
            <div className="recording-indicator">
              <span className="recording-dot"></span>
              <span>Recording</span>
            </div>
          )}
        <button type="button" className="btn-exit" onClick={(e) => { e.stopPropagation(); onExit() }}>Exit</button>
      </div>
    </div>
  )
}

export default PlayMode
