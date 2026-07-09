import { useCallback, useEffect, useRef, useState } from 'react'
import ThemeToggle from '@shared/ThemeToggle'
import UnsplashPicker from '@shared/stockMedia/UnsplashPicker'
import { getTheme, initThemeSync, setTheme } from '@shared/theme'
import MediaControls from './components/MediaControls'
import CopySection from './components/CopySection'
import TextControls from './components/TextControls'
import PreviewPanel from './components/PreviewPanel'
import { useAdCompositor } from './hooks/useAdCompositor'
import { analyzeAsOgilvy, generateCopyVersions } from './services/copyAi'
import {
  DEFAULT_MEDIA,
  DEFAULT_TEXT,
  FORMATS,
  copyCanvasToClipboard,
  exportCanvasAsPng,
  renderAdToCanvas,
} from './utils/adCompositor'
import './App.css'

const saasAppsUrl = typeof window !== 'undefined'
  ? new URL('../index.html', window.location.href).href
  : '/index.html'

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    }
    img.src = url
  })
}

function loadImageFromUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = url
  })
}

function loadVideoFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.loop = true
    video.onloadeddata = () => {
      video.play().catch(() => {})
      resolve({ video, url })
    }
    video.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load video'))
    }
    video.src = url
  })
}

function captureWebcamPhoto(stream) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.srcObject = stream
    video.onloadedmetadata = () => {
      video.play()
        .then(() => {
          requestAnimationFrame(() => {
            const canvas = document.createElement('canvas')
            canvas.width = video.videoWidth
            canvas.height = video.videoHeight
            const ctx = canvas.getContext('2d')
            ctx.drawImage(video, 0, 0)
            const dataUrl = canvas.toDataURL('image/png')
            const img = new Image()
            img.onload = () => resolve(img)
            img.onerror = () => reject(new Error('Failed to capture photo'))
            img.src = dataUrl
          })
        })
        .catch(reject)
    }
    video.onerror = () => reject(new Error('Webcam error'))
  })
}

export default function App() {
  const canvasRef = useRef(null)
  const mediaElementRef = useRef(null)
  const webcamStreamRef = useRef(null)
  const videoObjectUrlRef = useRef(null)

  const [theme, setThemeState] = useState(() => getTheme())
  const [formatId, setFormatId] = useState('landscape')
  const [backgroundColor, setBackgroundColor] = useState('#000000')
  const [text, setText] = useState(DEFAULT_TEXT)
  const [mediaTransform, setMediaTransform] = useState(DEFAULT_MEDIA)
  const [mediaMode, setMediaMode] = useState(null)
  const [mediaElement, setMediaElement] = useState(null)
  const [webcamActive, setWebcamActive] = useState(false)
  const [isVideoPlaying, setIsVideoPlaying] = useState(false)
  const [unsplashOpen, setUnsplashOpen] = useState(false)
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState('')
  const [analysis, setAnalysis] = useState(null)
  const [versions, setVersions] = useState([])

  const format = FORMATS[formatId] || FORMATS.landscape
  const aspectRatio = `${format.width} / ${format.height}`

  const clearMedia = useCallback(() => {
    if (webcamStreamRef.current) {
      webcamStreamRef.current.getTracks().forEach((t) => t.stop())
      webcamStreamRef.current = null
    }
    if (videoObjectUrlRef.current) {
      URL.revokeObjectURL(videoObjectUrlRef.current)
      videoObjectUrlRef.current = null
    }
    mediaElementRef.current = null
    setMediaElement(null)
    setWebcamActive(false)
    setIsVideoPlaying(false)
    setMediaMode(null)
  }, [])

  const setMedia = useCallback((element, mode, { playing = false } = {}) => {
    mediaElementRef.current = element
    setMediaElement(element)
    setMediaMode(mode)
    setIsVideoPlaying(playing)
  }, [])

  const handleUploadImage = async (file) => {
    clearMedia()
    const img = await loadImageFromFile(file)
    setMedia(img, 'upload-image')
  }

  const handleUploadVideo = async (file) => {
    clearMedia()
    const { video, url } = await loadVideoFromFile(file)
    videoObjectUrlRef.current = url
    setMedia(video, 'upload-video', { playing: true })
  }

  const handleStartWebcamPhoto = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Webcam is not supported in this browser')
    }
    clearMedia()
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
    webcamStreamRef.current = stream
    try {
      const img = await captureWebcamPhoto(stream)
      stream.getTracks().forEach((t) => t.stop())
      webcamStreamRef.current = null
      setMedia(img, 'webcam-photo')
    } catch (err) {
      stream.getTracks().forEach((t) => t.stop())
      webcamStreamRef.current = null
      throw err
    }
  }

  const handleStartWebcamVideo = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Webcam is not supported in this browser')
    }
    clearMedia()
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
    webcamStreamRef.current = stream
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.srcObject = stream
    await video.play()
    setWebcamActive(true)
    setMedia(video, 'webcam-video', { playing: true })
  }

  const handleStopWebcam = () => {
    clearMedia()
  }

  const handleUnsplashSelect = async (dataUrl) => {
    clearMedia()
    const img = await loadImageFromUrl(dataUrl)
    setMedia(img, 'unsplash')
    setUnsplashOpen(false)
  }

  const handlePan = (dx, dy) => {
    setMediaTransform((prev) => ({
      ...prev,
      offsetX: prev.offsetX + dx,
      offsetY: prev.offsetY + dy,
    }))
  }

  const handleResetTransform = () => setMediaTransform(DEFAULT_MEDIA)

  const handleHeadlineChange = (headline) => {
    setText((prev) => ({ ...prev, headline }))
  }

  const handleCopyChange = (copy) => {
    setText((prev) => ({ ...prev, copy }))
  }

  const handleAnalyze = async () => {
    setAiBusy(true)
    setAiError('')
    try {
      const result = await analyzeAsOgilvy(text.headline, text.copy)
      setAnalysis(result)
    } catch (err) {
      setAiError(err?.message || 'Analysis failed')
    } finally {
      setAiBusy(false)
    }
  }

  const handleGenerateVersions = async () => {
    setAiBusy(true)
    setAiError('')
    try {
      const result = await generateCopyVersions(text.headline, text.copy, 5)
      if (!result.length) throw new Error('No versions were generated')
      setVersions(result)
    } catch (err) {
      setAiError(err?.message || 'Failed to generate versions')
    } finally {
      setAiBusy(false)
    }
  }

  const handleApplyVersion = (version) => {
    setText((prev) => ({
      ...prev,
      headline: version.headline || prev.headline,
      copy: version.copy || prev.copy,
    }))
    setStatus('Version applied.')
  }

  const buildExportCanvas = async () => {
    return renderAdToCanvas({
      width: format.width,
      height: format.height,
      backgroundColor,
      mediaElement: mediaElementRef.current,
      mediaScale: mediaTransform.scale,
      mediaOffsetX: mediaTransform.offsetX,
      mediaOffsetY: mediaTransform.offsetY,
      text,
    })
  }

  const handleExport = async () => {
    setBusy(true)
    setStatus('')
    try {
      const canvas = await buildExportCanvas()
      await exportCanvasAsPng(canvas, `native-ad-${formatId}.png`)
      setStatus('Image exported.')
    } catch (err) {
      setStatus(err?.message || 'Export failed')
    } finally {
      setBusy(false)
    }
  }

  const handleCopy = async () => {
    setBusy(true)
    setStatus('')
    try {
      const canvas = await buildExportCanvas()
      await copyCanvasToClipboard(canvas)
      setStatus('Copied to clipboard.')
    } catch (err) {
      setStatus(err?.message || 'Copy failed')
    } finally {
      setBusy(false)
    }
  }

  useAdCompositor({
    canvasRef,
    format,
    backgroundColor,
    mediaElement,
    mediaScale: mediaTransform.scale,
    mediaOffsetX: mediaTransform.offsetX,
    mediaOffsetY: mediaTransform.offsetY,
    text,
    isVideoPlaying,
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => initThemeSync(), [])

  useEffect(() => {
    const onThemeChange = (e) => {
      if (e.detail === 'light' || e.detail === 'dark') setThemeState(e.detail)
    }
    window.addEventListener('saas-theme-change', onThemeChange)
    return () => window.removeEventListener('saas-theme-change', onThemeChange)
  }, [])

  useEffect(() => () => clearMedia(), [clearMedia])

  return (
    <div className="nag-app">
      <header className="nag-header">
        <div className="nag-header-left">
          <h1 className="nag-title">Native Ads Generator</h1>
          <p className="nag-subtitle">Compose ad images with media, text, and effects</p>
        </div>
        <div className="nag-header-actions">
          <a href={saasAppsUrl} className="nag-link" target="_blank" rel="noopener noreferrer">
            API keys
          </a>
          <ThemeToggle
            theme={theme}
            onToggle={() => {
              const next = theme === 'dark' ? 'light' : 'dark'
              setTheme(next)
              setThemeState(next)
            }}
          />
        </div>
      </header>

      <div className="nag-layout">
        <aside className="nag-sidebar">
          <section className="nag-panel-section">
            <h3 className="nag-section-title">Format</h3>
            <div className="nag-format-grid">
              {Object.values(FORMATS).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`nag-format-btn ${formatId === f.id ? 'active' : ''}`}
                  onClick={() => setFormatId(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </section>

          <MediaControls
            mediaMode={mediaMode}
            onMediaModeChange={setMediaMode}
            onUploadImage={handleUploadImage}
            onUploadVideo={handleUploadVideo}
            onStartWebcamPhoto={handleStartWebcamPhoto}
            onStartWebcamVideo={handleStartWebcamVideo}
            onStopWebcam={handleStopWebcam}
            onOpenUnsplash={() => setUnsplashOpen(true)}
            webcamActive={webcamActive}
            hasMedia={!!mediaElement}
            mediaScale={mediaTransform.scale}
            onMediaScaleChange={(scale) => setMediaTransform((p) => ({ ...p, scale }))}
            onResetTransform={handleResetTransform}
          />

          <CopySection
            headline={text.headline}
            copy={text.copy}
            onHeadlineChange={handleHeadlineChange}
            onCopyChange={handleCopyChange}
            analysis={analysis}
            versions={versions}
            aiBusy={aiBusy}
            aiError={aiError}
            onAnalyze={handleAnalyze}
            onGenerateVersions={handleGenerateVersions}
            onApplyVersion={handleApplyVersion}
          />

          <TextControls
            text={text}
            onChange={setText}
            backgroundColor={backgroundColor}
            onBackgroundColorChange={setBackgroundColor}
          />

          <section className="nag-panel-section nag-export-section">
            <h3 className="nag-section-title">Export</h3>
            <div className="nag-export-row">
              <button type="button" className="nag-btn nag-btn-accent" disabled={busy} onClick={handleExport}>
                Download PNG
              </button>
              <button type="button" className="nag-btn" disabled={busy} onClick={handleCopy}>
                Copy to clipboard
              </button>
            </div>
            {status && <p className="nag-status">{status}</p>}
          </section>
        </aside>

        <main className="nag-main">
          <PreviewPanel
            canvasRef={canvasRef}
            format={format}
            aspectRatio={aspectRatio}
            onPan={handlePan}
            canPan={!!mediaElement}
          />
        </main>
      </div>

      <UnsplashPicker
        isOpen={unsplashOpen}
        onClose={() => setUnsplashOpen(false)}
        onSelect={handleUnsplashSelect}
        returnDataUrl
        initialQuery="advertising"
      />
    </div>
  )
}
