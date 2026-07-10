import { useCallback, useEffect, useRef, useState } from 'react'
import ThemeToggle from '@shared/ThemeToggle'
import UnsplashPicker from '@shared/stockMedia/UnsplashPicker'
import PexelsVideoPicker from '@shared/stockMedia/PexelsVideoPicker'
import { fetchVideoAsBlobUrl } from '@shared/stockMedia/pexelsVideo'
import { getTheme, initThemeSync, setTheme } from '@shared/theme'
import MediaControls from './components/MediaControls'
import CopySection from './components/CopySection'
import TextControls from './components/TextControls'
import PreviewPanel from './components/PreviewPanel'
import SidebarTabs from './components/SidebarTabs'
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
import { exportAdAsVideo, isVideoBackgroundMode } from './utils/videoExport'
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

function loadVideoElement(url, { revokeOnError = true } = {}) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.loop = true
    video.onloadeddata = () => {
      video.play().catch(() => {})
      resolve(video)
    }
    video.onerror = () => {
      if (revokeOnError) URL.revokeObjectURL(url)
      reject(new Error('Failed to load video'))
    }
    video.src = url
  })
}

function loadVideoFromFile(file) {
  const url = URL.createObjectURL(file)
  return loadVideoElement(url).then((video) => ({ video, url }))
}

async function loadVideoFromUrl(url) {
  const isExternal = url.startsWith('http://') || url.startsWith('https://')
  const blobUrl = isExternal ? await fetchVideoAsBlobUrl(url) : url
  const video = await loadVideoElement(blobUrl, { revokeOnError: true })
  return { video, url: blobUrl }
}

function captureFromVideoElement(video) {
  return new Promise((resolve, reject) => {
    const w = video.videoWidth
    const h = video.videoHeight
    if (!w || !h) {
      reject(new Error('Webcam not ready'))
      return
    }
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0)
    const dataUrl = canvas.toDataURL('image/png')
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to capture photo'))
    img.src = dataUrl
  })
}

export default function App() {
  const canvasRef = useRef(null)
  const mediaElementRef = useRef(null)
  const webcamStreamRef = useRef(null)
  const videoObjectUrlRef = useRef(null)
  const musicObjectUrlRef = useRef(null)
  const previewMusicRef = useRef(null)

  const [theme, setThemeState] = useState(() => getTheme())
  const [formatId, setFormatId] = useState('landscape')
  const [backgroundColor, setBackgroundColor] = useState('#000000')
  const [text, setText] = useState(DEFAULT_TEXT)
  const [mediaTransform, setMediaTransform] = useState(DEFAULT_MEDIA)
  const [mediaMode, setMediaMode] = useState(null)
  const [mediaElement, setMediaElement] = useState(null)
  const [webcamActive, setWebcamActive] = useState(false)
  const [webcamPhotoPreview, setWebcamPhotoPreview] = useState(false)
  const [isVideoPlaying, setIsVideoPlaying] = useState(false)
  const [unsplashOpen, setUnsplashOpen] = useState(false)
  const [pexelsOpen, setPexelsOpen] = useState(false)
  const [backgroundMusic, setBackgroundMusic] = useState(null)
  const [musicVolume, setMusicVolume] = useState(0.8)
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState('')
  const [analysis, setAnalysis] = useState(null)
  const [versions, setVersions] = useState([])
  const [sidebarTab, setSidebarTab] = useState('format')

  const format = FORMATS[formatId] || FORMATS.landscape
  const aspectRatio = `${format.width} / ${format.height}`
  const canExportVideo = isVideoBackgroundMode(mediaMode, mediaElement)

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
    setWebcamPhotoPreview(false)
    setIsVideoPlaying(false)
    setMediaMode(null)
  }, [])

  const setMedia = useCallback((element, mode, { playing = false } = {}) => {
    mediaElementRef.current = element
    setMediaElement(element)
    setMediaMode(mode)
    setIsVideoPlaying(playing)
  }, [])

  const clearBackgroundMusic = useCallback(() => {
    if (previewMusicRef.current) {
      previewMusicRef.current.pause()
      previewMusicRef.current.src = ''
    }
    if (musicObjectUrlRef.current) {
      URL.revokeObjectURL(musicObjectUrlRef.current)
      musicObjectUrlRef.current = null
    }
    setBackgroundMusic(null)
  }, [])

  const handleUploadMusic = (file) => {
    if (musicObjectUrlRef.current) {
      URL.revokeObjectURL(musicObjectUrlRef.current)
    }
    const url = URL.createObjectURL(file)
    musicObjectUrlRef.current = url
    setBackgroundMusic({ name: file.name, url })
  }

  const handleRemoveMusic = () => {
    clearBackgroundMusic()
  }

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

  const handleWebcamPhoto = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Webcam is not supported in this browser')
    }

    if (webcamPhotoPreview && mediaElementRef.current) {
      const img = await captureFromVideoElement(mediaElementRef.current)
      if (webcamStreamRef.current) {
        webcamStreamRef.current.getTracks().forEach((t) => t.stop())
        webcamStreamRef.current = null
      }
      setWebcamPhotoPreview(false)
      setMedia(img, 'webcam-photo')
      return
    }

    clearMedia()
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
    webcamStreamRef.current = stream
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.srcObject = stream
    await video.play()
    setWebcamPhotoPreview(true)
    setMedia(video, 'webcam-photo-preview', { playing: true })
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

  const handlePexelsVideoSelect = async (videoUrl) => {
    clearMedia()
    const { video, url } = await loadVideoFromUrl(videoUrl)
    videoObjectUrlRef.current = url
    setMedia(video, 'pexels-video', { playing: true })
    setPexelsOpen(false)
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

  const handleExportVideo = async () => {
    setBusy(true)
    setStatus('Exporting video…')
    if (previewMusicRef.current) previewMusicRef.current.pause()
    try {
      await exportAdAsVideo({
        width: format.width,
        height: format.height,
        backgroundColor,
        mediaElement: mediaElementRef.current,
        mediaScale: mediaTransform.scale,
        mediaOffsetX: mediaTransform.offsetX,
        mediaOffsetY: mediaTransform.offsetY,
        text,
        mediaMode,
        backgroundMusicUrl: backgroundMusic?.url ?? null,
        musicVolume,
        filename: `native-ad-${formatId}.webm`,
        onProgress: (pct) => setStatus(`Exporting video… ${pct}%`),
      })
      setStatus('Video exported.')
    } catch (err) {
      setStatus(err?.message || 'Video export failed')
    } finally {
      setBusy(false)
      if (canExportVideo && backgroundMusic?.url && previewMusicRef.current) {
        previewMusicRef.current.play().catch(() => {})
      }
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

  useEffect(() => () => {
    clearMedia()
    clearBackgroundMusic()
  }, [clearMedia, clearBackgroundMusic])

  useEffect(() => {
    if (!canExportVideo || !backgroundMusic?.url) {
      if (previewMusicRef.current) {
        previewMusicRef.current.pause()
      }
      return undefined
    }

    const audio = previewMusicRef.current ?? new Audio()
    previewMusicRef.current = audio
    audio.src = backgroundMusic.url
    audio.loop = true
    audio.volume = musicVolume
    audio.play().catch(() => {})

    return () => {
      audio.pause()
    }
  }, [canExportVideo, backgroundMusic?.url, musicVolume])

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
          <SidebarTabs activeTab={sidebarTab} onTabChange={setSidebarTab} />

          <div className="nag-sidebar-content">
            {sidebarTab === 'format' && (
              <section className="nag-panel-section nag-panel-embedded">
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
            )}

            {sidebarTab === 'background' && (
              <>
                <MediaControls
                  embedded
                  mediaMode={mediaMode}
                  onMediaModeChange={setMediaMode}
                  onUploadImage={handleUploadImage}
                  onUploadVideo={handleUploadVideo}
                  onWebcamPhoto={handleWebcamPhoto}
                  onStartWebcamVideo={handleStartWebcamVideo}
                  onStopWebcam={handleStopWebcam}
                  onOpenUnsplash={() => setUnsplashOpen(true)}
                  onOpenPexelsVideo={() => setPexelsOpen(true)}
                  webcamActive={webcamActive}
                  webcamPhotoPreview={webcamPhotoPreview}
                  hasMedia={!!mediaElement}
                  mediaScale={mediaTransform.scale}
                  onMediaScaleChange={(scale) => setMediaTransform((p) => ({ ...p, scale }))}
                  onResetTransform={handleResetTransform}
                  isVideoBackground={canExportVideo}
                  backgroundMusic={backgroundMusic}
                  musicVolume={musicVolume}
                  onUploadMusic={handleUploadMusic}
                  onRemoveMusic={handleRemoveMusic}
                  onMusicVolumeChange={setMusicVolume}
                />
                <section className="nag-panel-section nag-panel-embedded">
                  <div className="nag-field-group">
                    <label className="nag-label" htmlFor="nag-sidebar-bg-color">Canvas background</label>
                    <div className="nag-color-row">
                      <input
                        id="nag-sidebar-bg-color"
                        type="color"
                        value={backgroundColor}
                        onChange={(e) => setBackgroundColor(e.target.value)}
                      />
                      <input
                        type="text"
                        className="nag-input"
                        value={backgroundColor}
                        onChange={(e) => setBackgroundColor(e.target.value)}
                      />
                    </div>
                    <p className="nag-hint">Shown behind media when the image or video does not cover the full canvas.</p>
                  </div>
                </section>
              </>
            )}

            {sidebarTab === 'fonts' && (
              <TextControls
                embedded
                hideBackgroundColor
                text={text}
                onChange={setText}
                backgroundColor={backgroundColor}
                onBackgroundColorChange={setBackgroundColor}
              />
            )}

            {sidebarTab === 'copy' && (
              <CopySection
                embedded
                headline={text.headline}
                copy={text.copy}
                showSubheadline={text.showSubheadline !== false}
                onHeadlineChange={handleHeadlineChange}
                onCopyChange={handleCopyChange}
                onShowSubheadlineChange={(show) => setText((prev) => ({ ...prev, showSubheadline: show }))}
                analysis={analysis}
                versions={versions}
                aiBusy={aiBusy}
                aiError={aiError}
                onAnalyze={handleAnalyze}
                onGenerateVersions={handleGenerateVersions}
                onApplyVersion={handleApplyVersion}
              />
            )}
          </div>

          <section className="nag-panel-section nag-export-section">
            <h3 className="nag-section-title">Export</h3>
            <div className="nag-export-row">
              <button type="button" className="nag-btn nag-btn-accent" disabled={busy} onClick={handleExport}>
                Download PNG
              </button>
              {canExportVideo && (
                <button type="button" className="nag-btn nag-btn-accent" disabled={busy} onClick={handleExportVideo}>
                  Download video
                </button>
              )}
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

      <PexelsVideoPicker
        isOpen={pexelsOpen}
        onClose={() => setPexelsOpen(false)}
        onSelect={handlePexelsVideoSelect}
        initialQuery="advertising"
      />
    </div>
  )
}
