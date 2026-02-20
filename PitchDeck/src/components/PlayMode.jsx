import { useState, useEffect, useCallback, useRef } from 'react'
import Slide from './Slide'
import SlideBackground from './SlideBackground'
import { convertToMp4 } from '../utils/ffmpegExport'
import './PlayMode.css'

// Two slides share the same background if they use the same image or video
function sameBackground(a, b) {
  if (!a || !b) return false
  const layoutA = (a.layout || 'default') === 'section'
  const layoutB = (b.layout || 'default') === 'section'
  if (layoutA || layoutB) return false
  const hasBgA = !!(a.imageUrl || a.backgroundVideoUrl)
  const hasBgB = !!(b.imageUrl || b.backgroundVideoUrl)
  if (!hasBgA || !hasBgB) return false
  return (a.imageUrl || '') === (b.imageUrl || '') && (a.backgroundVideoUrl || '') === (b.backgroundVideoUrl || '')
}

// Both slides use video layout with background video - keep video layer persistent to avoid fade/flicker
function bothVideoLayoutWithMedia(a, b) {
  if (!a || !b) return false
  const layoutA = (a.layout || 'default') === 'video'
  const layoutB = (b.layout || 'default') === 'video'
  if (!layoutA || !layoutB) return false
  return !!(a.backgroundVideoUrl || a.imageUrl) && !!(b.backgroundVideoUrl || b.imageUrl)
}

// Two slides have gradient in the same position (gradientFlipped). Gradient shows for default, bulletpoints, video layouts.
function sameGradientPosition(a, b) {
  if (!a || !b) return false
  const layoutA = a.layout || 'default'
  const layoutB = b.layout || 'default'
  const hasGradientA = !!(a.imageUrl || a.backgroundVideoUrl) && a.gradientEnabled !== false && layoutA !== 'section' && ['default', 'bulletpoints', 'video'].includes(layoutA)
  const hasGradientB = !!(b.imageUrl || b.backgroundVideoUrl) && b.gradientEnabled !== false && layoutB !== 'section' && ['default', 'bulletpoints', 'video'].includes(layoutB)
  if (!hasGradientA || !hasGradientB) return false
  return (a.gradientFlipped === true) === (b.gradientFlipped === true)
}

// Hex to RGB for gradient
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : { r: 26, g: 26, b: 26 }
}

// Persistent gradient overlay - used when consecutive slides have gradient in same position
function GradientOverlay({ slide, backgroundColor = '#1a1a1a' }) {
  if (!slide || (slide.layout || 'default') === 'section') return null
  const hasMedia = !!(slide.imageUrl || slide.backgroundVideoUrl)
  const layout = slide.layout || 'default'
  if (!hasMedia || !['default', 'bulletpoints', 'video'].includes(layout)) return null
  if (slide.gradientEnabled === false) return null

  const gradientStrength = slide.gradientStrength !== undefined ? slide.gradientStrength : 0.7
  const gradientFlipped = slide.gradientFlipped === true
  const slideBgColor = (slide.backgroundColorOverride && slide.backgroundColorOverrideValue) ? slide.backgroundColorOverrideValue : backgroundColor
  const rgb = hexToRgb(slideBgColor === 'transparent' ? backgroundColor : slideBgColor)
  const maxOpacity = 1
  const midOpacity = 0.57

  return (
    <div
      className="play-gradient-layer"
      style={{
        opacity: gradientStrength,
        transition: 'opacity 0.3s ease-in-out'
      }}
    >
      <div
        className="slide-gradient-overlay"
        style={{
          background: gradientFlipped
            ? `linear-gradient(to right, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${maxOpacity}) 0%, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${midOpacity}) 30%, transparent 100%)`
            : `linear-gradient(to left, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${maxOpacity}) 0%, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${midOpacity}) 30%, transparent 100%)`,
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

// Webcam overlay component - separate from slide transitions
function WebcamOverlay({ cameraId, layout, webcamSize = 'large', isVisible = true, cameraOverrideEnabled = false, cameraOverridePosition = 'fullscreen', recordSettings }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const containerRef = useRef(null)
  const prevLayoutRef = useRef(layout)
  const prevOverrideRef = useRef({ cameraOverrideEnabled, cameraOverridePosition })
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight })

  // Update dimensions on resize
  useEffect(() => {
    const handleResize = () => {
      setDimensions({ width: window.innerWidth, height: window.innerHeight })
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Get webcam size based on setting
  const getWebcamSize = () => {
    switch (webcamSize) {
      case 'small': return { width: '15%', minWidth: '100px', minHeight: '100px' }
      case 'medium': return { width: '20%', minWidth: '120px', minHeight: '120px' }
      case 'large': return { width: '25%', minWidth: '150px', minHeight: '150px' }
      default: return { width: '20%', minWidth: '120px', minHeight: '120px' }
    }
  }

  // Get webcam position: when camera override is enabled use cameraOverridePosition; otherwise use layout
  const getWebcamPosition = () => {
    const webcamWidth = dimensions.width * (webcamSize === 'small' ? 0.15 : webcamSize === 'medium' ? 0.20 : 0.25)
    const webcamHeight = webcamWidth
    const bottomOffset = dimensions.height * 0.04
    const sideOffset = dimensions.width * 0.04

    if (cameraOverrideEnabled) {
      switch (cameraOverridePosition) {
        case 'fullscreen':
          return { top: 0, left: 0, width: dimensions.width, height: dimensions.height, isCircle: false }
        case 'left-third': {
          const w = dimensions.width / 3
          return { top: 0, left: 0, width: w, height: dimensions.height, isCircle: false }
        }
        case 'right-third': {
          const w = dimensions.width / 3
          return { top: 0, left: dimensions.width - w, width: w, height: dimensions.height, isCircle: false }
        }
        case 'circle-top-left':
          return { top: bottomOffset, left: sideOffset, width: webcamWidth, height: webcamHeight, isCircle: true }
        case 'circle-top-right':
          return { top: bottomOffset, left: dimensions.width - sideOffset - webcamWidth, width: webcamWidth, height: webcamHeight, isCircle: true }
        case 'circle-bottom-left':
          return { top: dimensions.height - bottomOffset - webcamHeight, left: sideOffset, width: webcamWidth, height: webcamHeight, isCircle: true }
        case 'circle-bottom-right':
        default:
          return { top: dimensions.height - bottomOffset - webcamHeight, left: dimensions.width - sideOffset - webcamWidth, width: webcamWidth, height: webcamHeight, isCircle: true }
      }
    }

    // Use layout when override is disabled
    if (layout === 'video') {
      return { top: 0, left: 0, width: dimensions.width, height: dimensions.height, isCircle: false }
    }
    if (layout === 'left-video') {
      const w = dimensions.width / 3
      return { top: 0, left: dimensions.width - w, width: w, height: dimensions.height, isCircle: false }
    }
    if (layout === 'right-video') {
      const w = dimensions.width / 3
      return { top: 0, left: 0, width: w, height: dimensions.height, isCircle: false }
    }
    if (layout === 'right') {
      return { top: dimensions.height - bottomOffset - webcamHeight, left: sideOffset, width: webcamWidth, height: webcamHeight, isCircle: true }
    }
    return { top: dimensions.height - bottomOffset - webcamHeight, left: dimensions.width - sideOffset - webcamWidth, width: webcamWidth, height: webcamHeight, isCircle: true }
  }

  useEffect(() => {
    if (!cameraId || !isVisible || (cameraOverrideEnabled && cameraOverridePosition === 'disabled')) return

    const startStream = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: cameraId } }
        })
        if (videoRef.current) {
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
      }
    }
  }, [cameraId, isVisible, cameraOverrideEnabled, cameraOverridePosition])

  // Update transition when layout or camera override changes
  useEffect(() => {
    const overrideChanged = prevOverrideRef.current.cameraOverrideEnabled !== cameraOverrideEnabled ||
      prevOverrideRef.current.cameraOverridePosition !== cameraOverridePosition
    if ((prevLayoutRef.current !== layout || overrideChanged) && containerRef.current) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (containerRef.current) containerRef.current.offsetHeight
        })
      })
      prevLayoutRef.current = layout
      prevOverrideRef.current = { cameraOverrideEnabled, cameraOverridePosition }
    }
  }, [layout, dimensions, cameraOverrideEnabled, cameraOverridePosition])

  if (!isVisible || !cameraId) return null
  if (cameraOverrideEnabled && cameraOverridePosition === 'disabled') return null

  const size = getWebcamSize()
  const position = getWebcamPosition()
  const useCircle = position.isCircle
  const isFullscreen = position.width >= dimensions.width - 2 && position.height >= dimensions.height - 2

  const style = {
    position: 'fixed',
    top: `${position.top}px`,
    left: `${position.left}px`,
    width: `${position.width}px`,
    height: `${position.height}px`,
    minWidth: isFullscreen ? '0' : size.minWidth,
    minHeight: isFullscreen ? '0' : size.minHeight,
    maxWidth: 'none',
    maxHeight: 'none',
    aspectRatio: (isFullscreen || position.width !== position.height) ? 'auto' : '1 / 1',
    borderRadius: useCircle ? '50%' : '0',
    clipPath: useCircle ? 'circle(50% at center)' : 'none',
    WebkitClipPath: useCircle ? 'circle(50% at center)' : 'none',
    zIndex: 1000,
    pointerEvents: 'none'
  }

  return (
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
          transform: recordSettings?.webcamFlipHorizontal ? 'scaleX(-1)' : 'none'
        }}
      />
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
          const y0 = h - boxH - Math.round(h * bottomMargin)
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

function PlayMode({ slides, onExit, backgroundColor = '#1a1a1a', textColor = '#ffffff', fontFamily = 'Inter', defaultTextSize = 4, h1Size = 10, h2Size = 3.5, h3Size = 2.5, h1FontFamily = '', h2FontFamily = '', h3FontFamily = '', defaultFontWeight = 700, h1Weight = 700, h2Weight = 700, h3Weight = 700, h1LineHeight = 1.2, h2LineHeight = 1.2, h3LineHeight = 1.2, showMenu = false, textDropShadow, shadowBlur, shadowOffsetX, shadowOffsetY, shadowColor, textInlineBackground, inlineBgColor, inlineBgOpacity, inlineBgPadding, initialSlideId, transitionStyle = 'default', textAnimation = 'none', textAnimationUnit = 'word', backgroundScaleAnimation = false, backgroundScaleTime = 10, backgroundScaleAmount = 20, lineHeight = 1, bulletLineHeight = 1, bulletTextSize = 3, bulletGap = 0.5, contentBottomOffset = 12, contentEdgeOffset = 9, showBullets = true, autoAdvance = false, autoAdvanceDurationSeconds = 5, recordSettings = { webcamEnabled: false, selectedCameraId: '', microphoneEnabled: false, selectedMicrophoneId: '', captionsEnabled: false, captionStyle: 'bottom-black' }, isRecording = false, initialScreenStreamRef, textStyleMode = 'standard', fontPairingSerifFont = 'Playfair Display', openaiKey = '', slideFormat = '16:9', onRecordingDone }) {
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
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [transitionPhase, setTransitionPhase] = useState('idle') // 'idle', 'fade-out', 'fade-in'
  const [visibleBulletIndex, setVisibleBulletIndex] = useState(-1)
  const [visibleLineIndex, setVisibleLineIndex] = useState(0)
  const [slideKey, setSlideKey] = useState(0) // Force re-render on slide change
  const [preloadReady, setPreloadReady] = useState(false) // Defer preload until after first paint to avoid overlapping text on play start
  
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
  const getBulletPoints = (slide) => {
    if (!slide || (slide.layout || 'default') !== 'bulletpoints') return []
    return slide.content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => line.replace(/^[-•*]\s*/, ''))
  }

  const currentSlide = presentationSlides[currentIndex]
  const nextSlideData = presentationSlides[currentIndex + 1]
  const prevSlideData = presentationSlides[currentIndex - 1]
  // Use persistent background when: consecutive slides share same bg, both are video layout, OR current slide is fullscreen video (keeps video in stable layer to avoid flicker)
  const isCurrentVideoLayout = (currentSlide?.layout || 'default') === 'video' && !!(currentSlide?.backgroundVideoUrl || currentSlide?.imageUrl)
  const usePersistentBackground = isCurrentVideoLayout || (nextSlideData && (sameBackground(currentSlide, nextSlideData) || bothVideoLayoutWithMedia(currentSlide, nextSlideData))) || (prevSlideData && (sameBackground(currentSlide, prevSlideData) || bothVideoLayoutWithMedia(currentSlide, prevSlideData)))
  const usePersistentGradient = usePersistentBackground && ((nextSlideData && sameGradientPosition(currentSlide, nextSlideData)) || (prevSlideData && sameGradientPosition(currentSlide, prevSlideData)))
  const bulletPoints = getBulletPoints(currentSlide)
  const isBulletSlide = (currentSlide?.layout || 'default') === 'bulletpoints'
  const revealOneLineAtATime = !!currentSlide?.revealOneLineAtATime

  // Content line count for non-bullet slides (must match Slide getContentLines: <div>, <p>, <br> → newline)
  const getContentLineCount = (slide) => {
    if (!slide?.content) return 1
    const normalized = (slide.content + '')
      .replace(/<div[^>]*>\s*/gi, '\n')
      .replace(/<\/div>\s*/gi, '\n')
      .replace(/<p[^>]*>\s*/gi, '\n')
      .replace(/<\/p>\s*/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
    const lines = normalized.split('\n')
    return Math.max(1, lines.length)
  }
  const contentLineCount = !isBulletSlide && currentSlide ? getContentLineCount(currentSlide) : 0

  // Defer preload slides until after first paint so only the selected slide shows when play starts
  useEffect(() => {
    const rafId = requestAnimationFrame(() => {
      requestAnimationFrame(() => setPreloadReady(true))
    })
    return () => cancelAnimationFrame(rafId)
  }, [])

  // Reset line/bullet reveal when changing slides (start with first line visible for line reveal)
  useEffect(() => {
    setVisibleBulletIndex(-1)
    setVisibleLineIndex(0)
  }, [currentIndex])

  // Get transition duration based on style
  const getTransitionDuration = (style) => {
    switch (style) {
      case 'dissolve':
        return 500 // 0.5s
      case 'sequence':
        return 600 // 0.6s
      case 'blur':
        return 400 // 0.4s
      case 'zoom':
        return 300 // 0.3s
      case 'slide':
        return 300 // 0.3s
      default:
        return 300 // 0.3s
    }
  }

  const nextSlide = useCallback(() => {
    setCurrentIndex((prevIndex) => {
      if (prevIndex < presentationSlides.length - 1) {
        const nextIndex = prevIndex + 1
        const currentLayout = (presentationSlides[prevIndex]?.layout || 'default') === 'video'
        const nextLayout = (presentationSlides[nextIndex]?.layout || 'default') === 'video'
        const isVideoTransition = currentLayout || nextLayout

        if (isVideoTransition) {
          // Video layout: switch immediately, no delay or remount to avoid flicker
          setVisibleBulletIndex(-1)
          setTransitionPhase('idle')
          return nextIndex
        }

        setIsTransitioning(true)
        setVisibleBulletIndex(-1) // Reset bullet animation
        const duration = getTransitionDuration(transitionStyle)
        setTransitionPhase('fade-out')

        setTimeout(() => {
          setTransitionPhase('fade-in')
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              setCurrentIndex(nextIndex)
              setSlideKey(prev => prev + 1)
              setTimeout(() => {
                setIsTransitioning(false)
                setTransitionPhase('idle')
              }, duration)
            })
          })
        }, duration)

        return prevIndex
      }
      return prevIndex
    })
  }, [presentationSlides, transitionStyle])

  const prevSlide = useCallback(() => {
    setCurrentIndex((prevIndex) => {
      if (prevIndex > 0) {
        const nextIndex = prevIndex - 1
        const currentLayout = (presentationSlides[prevIndex]?.layout || 'default') === 'video'
        const prevLayout = (presentationSlides[nextIndex]?.layout || 'default') === 'video'
        const isVideoTransition = currentLayout || prevLayout

        if (isVideoTransition) {
          // Video layout: switch immediately, no delay or remount to avoid flicker
          setVisibleBulletIndex(-1)
          setTransitionPhase('idle')
          return nextIndex
        }

        setIsTransitioning(true)
        setVisibleBulletIndex(-1)
        const duration = getTransitionDuration(transitionStyle)
        setTransitionPhase('fade-out')

        setTimeout(() => {
          setTransitionPhase('fade-in')
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              setCurrentIndex(nextIndex)
              setSlideKey(prev => prev + 1)
              setTimeout(() => {
                setIsTransitioning(false)
                setTransitionPhase('idle')
              }, duration)
            })
          })
        }, duration)

        return prevIndex
      }
      return prevIndex
    })
  }, [presentationSlides, transitionStyle])

  // Reset bullet index when slide changes
  useEffect(() => {
    setVisibleBulletIndex(-1)
  }, [currentIndex])

  // Auto-advance timer: after duration on each slide, go to next (unless on last slide or transitioning)
  useEffect(() => {
    if (!autoAdvance || isTransitioning || currentIndex >= presentationSlides.length - 1) return
    const durationMs = Math.max(1000, (autoAdvanceDurationSeconds || 5) * 1000)
    const timer = setTimeout(() => {
      nextSlide()
    }, durationMs)
    return () => clearTimeout(timer)
  }, [autoAdvance, autoAdvanceDurationSeconds, currentIndex, isTransitioning, presentationSlides.length, nextSlide])

  // Auto-start recording when entering record mode (stream from Record button, then start recorder)
  useEffect(() => {
    if (isRecording && recordingState === 'idle' && !isStartingRecordingRef.current) {
      isStartingRecordingRef.current = true
      startRecording()
    } else if (!isRecording && recordingState === 'recording') {
      stopRecording()
      isStartingRecordingRef.current = false
    }
  }, [isRecording, recordingState])

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
          convertToMp4(resultBlob)
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

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      setRecordingState('stopping')
      mediaRecorderRef.current.stop()
    }
    isStartingRecordingRef.current = false
  }

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
      } else if ((e.key === 'ArrowRight' || e.key === ' ') && !isTransitioning) {
        e.preventDefault()
        if (revealOneLineAtATime && isBulletSlide && visibleBulletIndex < bulletPoints.length - 1) {
          setVisibleBulletIndex(prev => prev + 1)
        } else if (revealOneLineAtATime && !isBulletSlide && visibleLineIndex < contentLineCount - 1) {
          setVisibleLineIndex(prev => prev + 1)
        } else {
          nextSlide()
        }
      } else if (e.key === 'ArrowLeft' && !isTransitioning) {
        e.preventDefault()
        if (revealOneLineAtATime && isBulletSlide && visibleBulletIndex >= 0) {
          setVisibleBulletIndex(prev => prev - 1)
        } else if (revealOneLineAtATime && !isBulletSlide && visibleLineIndex >= 0) {
          setVisibleLineIndex(prev => prev - 1)
        } else {
          prevSlide()
        }
      } else if (e.key === 'ArrowDown' && !isTransitioning) {
        e.preventDefault()
        if (revealOneLineAtATime && isBulletSlide && visibleBulletIndex < bulletPoints.length - 1) {
          setVisibleBulletIndex(prev => prev + 1)
        } else if (revealOneLineAtATime && !isBulletSlide && visibleLineIndex < contentLineCount - 1) {
          setVisibleLineIndex(prev => prev + 1)
        } else {
          nextSlide()
        }
      } else if (e.key === 'ArrowUp' && !isTransitioning) {
        e.preventDefault()
        if (revealOneLineAtATime && isBulletSlide && visibleBulletIndex >= 0) {
          setVisibleBulletIndex(prev => prev - 1)
        } else if (revealOneLineAtATime && !isBulletSlide && visibleLineIndex >= 0) {
          setVisibleLineIndex(prev => prev - 1)
        } else {
          prevSlide()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isTransitioning, onExit, nextSlide, prevSlide, isBulletSlide, revealOneLineAtATime, visibleBulletIndex, visibleLineIndex, bulletPoints.length, contentLineCount, recordingState, stopRecording])

  const handleClick = (e) => {
    if (isTransitioning) return
    
    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const width = rect.width
    
    if (clickX > width / 2) {
      if (revealOneLineAtATime && isBulletSlide && visibleBulletIndex < bulletPoints.length - 1) {
        setVisibleBulletIndex(prev => prev + 1)
      } else if (revealOneLineAtATime && !isBulletSlide && visibleLineIndex < contentLineCount - 1) {
        setVisibleLineIndex(prev => prev + 1)
      } else {
        nextSlide()
      }
    } else {
      if (revealOneLineAtATime && isBulletSlide && visibleBulletIndex >= 0) {
        setVisibleBulletIndex(prev => prev - 1)
      } else if (revealOneLineAtATime && !isBulletSlide && visibleLineIndex >= 0) {
        setVisibleLineIndex(prev => prev - 1)
      } else {
        prevSlide()
      }
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
    webcamEnabled: recordSettings?.webcamEnabled ?? false,
    selectedCameraId: recordSettings?.selectedCameraId ?? '',
    webcamFlipHorizontal: recordSettings?.webcamFlipHorizontal === true,
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
    contentBottomOffset,
    contentEdgeOffset,
    showBullets,
    defaultFontWeight,
    h1Weight,
    h2Weight,
    h3Weight,
    h1LineHeight,
    h2LineHeight,
    h3LineHeight,
    backgroundScaleAnimation,
    backgroundScaleTime,
    backgroundScaleAmount,
    textAnimation,
    textAnimationUnit,
    textStyleMode: textStyleMode || 'standard',
    fontPairingSerifFont: fontPairingSerifFont || 'Playfair Display',
    slideFormat
  }

  return (
    <div className="play-mode" onClick={handleClick} style={{ paddingBottom: showMenu ? '80px' : '0' }}>
      {/* Persistent background layer: when consecutive slides share the same background, keep it visible during transitions */}
      {usePersistentBackground && (
        <div className="play-background-layer" aria-hidden="true">
          <SlideBackground
            slide={currentSlide}
            backgroundScaleAnimation={backgroundScaleAnimation}
            backgroundScaleTime={backgroundScaleTime}
            backgroundScaleAmount={backgroundScaleAmount}
            isPreload={false}
          />
        </div>
      )}
      {usePersistentGradient && (
        <GradientOverlay
          slide={currentSlide}
          backgroundColor={backgroundColor}
        />
      )}
      <div 
        key={currentSlideLayout === 'video' ? 'video-persistent' : slideKey}
        className={`play-slide-container transition-${transitionStyle} ${transitionPhase === 'fade-out' && currentSlideLayout !== 'video' ? 'fade-out' : transitionPhase === 'fade-in' && currentSlideLayout !== 'video' ? 'fade-in' : 'visible'} ${currentSlideLayout === 'video' ? 'play-slide-container-video-layout' : ''} ${usePersistentBackground ? 'play-slide-content-only' : ''}`}
        style={(currentSlide?.cameraOverrideEnabled === true || recordSettings.cameraOverrideEnabled === true) && (currentSlide?.cameraOverridePosition || recordSettings.cameraOverridePosition || 'fullscreen') === 'fullscreen' ? { zIndex: 1001 } : undefined}
      >
        <Slide 
          slide={presentationSlides[currentIndex]} 
          {...commonSlideProps}
          cameraOverrideEnabled={currentSlide?.cameraOverrideEnabled === true || recordSettings?.cameraOverrideEnabled === true}
          cameraOverridePosition={currentSlide?.cameraOverridePosition || recordSettings?.cameraOverridePosition || 'fullscreen'}
          visibleBulletIndex={isBulletSlide && !revealOneLineAtATime ? Math.max(0, bulletPoints.length - 1) : visibleBulletIndex}
          visibleLineIndex={!isBulletSlide && revealOneLineAtATime ? visibleLineIndex : null}
          isPreload={false}
          hideBackground={usePersistentBackground}
          hideGradient={usePersistentGradient}
        />
      </div>
      {/* Preload next slides' videos so they play immediately when entering (bounded to PRELOAD_AHEAD to limit memory). Only render after first paint to avoid overlapping text on play start. */}
      {preloadReady && (
      <div className="play-preload-zone" aria-hidden="true">
        {Array.from({ length: PRELOAD_AHEAD }, (_, i) => currentIndex + i + 1).map((idx) => {
          const preloadSlide = presentationSlides[idx]
          if (!preloadSlide) return null
          return (
            <div key={preloadSlide.id} className="play-preload-slide">
              <Slide
                slide={preloadSlide}
                {...commonSlideProps}
                cameraOverrideEnabled={preloadSlide?.cameraOverrideEnabled === true || recordSettings?.cameraOverrideEnabled === true}
                cameraOverridePosition={preloadSlide?.cameraOverridePosition || recordSettings?.cameraOverridePosition || 'fullscreen'}
                visibleBulletIndex={-1}
                visibleLineIndex={null}
                isPreload={true}
              />
            </div>
          )
        })}
      </div>
      )}
      {/* Webcam overlay - outside slide transitions */}
      {recordSettings.webcamEnabled && recordSettings.selectedCameraId && (
        <WebcamOverlay
          cameraId={recordSettings.selectedCameraId}
          layout={currentSlideLayout}
          webcamSize={recordSettings.webcamSize || 'large'}
          isVisible={true}
          cameraOverrideEnabled={currentSlide?.cameraOverrideEnabled === true || recordSettings.cameraOverrideEnabled === true}
          cameraOverridePosition={currentSlide?.cameraOverridePosition || recordSettings.cameraOverridePosition || 'fullscreen'}
          recordSettings={recordSettings}
        />
      )}
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
      {!showMenu && (
        <div className="play-controls">
          <div className="play-slide-indicator">
            {currentIndex + 1} / {presentationSlides.length}
            {autoAdvance && (
              <span className="play-auto-advance-badge" title={`Auto-advancing every ${autoAdvanceDurationSeconds}s`}>
                Auto · {autoAdvanceDurationSeconds}s
              </span>
            )}
          </div>
          {isRecording && recordingState === 'recording' && (
            <div className="recording-indicator">
              <span className="recording-dot"></span>
              <span>Recording</span>
            </div>
          )}
          <button className="btn-exit" onClick={onExit}>Exit</button>
        </div>
      )}
    </div>
  )
}

export default PlayMode
