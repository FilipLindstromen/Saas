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
import MetaExportModal from './components/MetaExportModal'
import { useAdCompositor } from './hooks/useAdCompositor'
import { analyzeAsOgilvy, generateCopyVersions } from './services/copyAi'
import { exportNativeAdToMeta } from './services/metaAdExport'
import { getApiKey } from '@shared/apiKeys'
import {
  DEFAULT_MEDIA,
  DEFAULT_TEXT,
  FORMATS,
  copyCanvasToClipboard,
  exportCanvasAsPng,
  normalizeCopyVersions,
  renderAdToCanvas,
} from './utils/adCompositor'
import { COPY_VERSION_COUNT, getActiveCopy } from './utils/copyVersions'
import { exportAdAsVideo, isVideoBackgroundMode } from './utils/videoExport'
import { isImageFile, isVideoFile, loadVideoElement, loadVideoFromFile } from './utils/mediaFiles'
import {
  clearPersistedMedia,
  clearPersistedMusic,
  loadProject,
  persistMediaSource,
  persistMusicSource,
  saveProject,
} from './utils/projectStorage'
import { restoreMediaFromPersisted, restoreMusicFromPersisted } from './utils/restoreMedia'
import './App.css'

const initialProject = typeof window !== 'undefined' ? loadProject() : null

function mergeText(saved) {
  const merged = { ...DEFAULT_TEXT, ...(saved && typeof saved === 'object' ? saved : {}) }
  const { copyVersions, activeCopyVersion } = normalizeCopyVersions(merged)
  return { ...merged, copyVersions, activeCopyVersion }
}

function getInitialSidebarTab(savedTab) {
  if (savedTab === 'copy') return 'format'
  return savedTab || 'format'
}

const saasAppsUrl = typeof window !== 'undefined'
  ? new URL('../index.html', window.location.href).href
  : '/index.html'

function loadImageFromBlob(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => resolve({ img, url })
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    }
    img.src = url
  })
}

function loadImageFromFile(file) {
  return loadImageFromBlob(file).then(({ img }) => img)
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

function loadVideoFromUrl(url) {
  const isExternal = url.startsWith('http://') || url.startsWith('https://')
  return (async () => {
    const blobUrl = isExternal ? await fetchVideoAsBlobUrl(url) : url
    const video = await loadVideoElement(blobUrl, { revokeOnError: true })
    return { video, url: blobUrl }
  })()
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
  const persistedMediaRef = useRef(initialProject?.media ?? null)
  const persistedMusicRef = useRef(initialProject?.music ?? null)
  const [persistReady, setPersistReady] = useState(false)

  const [theme, setThemeState] = useState(() => getTheme())
  const [formatId, setFormatId] = useState(initialProject?.formatId || 'landscape')
  const [backgroundColor, setBackgroundColor] = useState(initialProject?.backgroundColor || '#000000')
  const [text, setText] = useState(() => mergeText(initialProject?.text))
  const [mediaTransform, setMediaTransform] = useState({
    ...DEFAULT_MEDIA,
    ...(initialProject?.mediaTransform && typeof initialProject.mediaTransform === 'object'
      ? initialProject.mediaTransform
      : {}),
  })
  const [mediaMode, setMediaMode] = useState(null)
  const [mediaElement, setMediaElement] = useState(null)
  const [webcamActive, setWebcamActive] = useState(false)
  const [webcamPhotoPreview, setWebcamPhotoPreview] = useState(false)
  const [isVideoPlaying, setIsVideoPlaying] = useState(false)
  const [unsplashOpen, setUnsplashOpen] = useState(false)
  const [pexelsOpen, setPexelsOpen] = useState(false)
  const [backgroundMusic, setBackgroundMusic] = useState(null)
  const [musicVolume, setMusicVolume] = useState(initialProject?.musicVolume ?? 0.8)
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState('')
  const [analysis, setAnalysis] = useState(initialProject?.analysis ?? null)
  const [sidebarTab, setSidebarTab] = useState(() => getInitialSidebarTab(initialProject?.sidebarTab))
  const [metaExportOpen, setMetaExportOpen] = useState(false)
  const [metaExportError, setMetaExportError] = useState('')
  const [metaExportSuccess, setMetaExportSuccess] = useState(null)

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
    persistedMediaRef.current = null
    clearPersistedMedia()
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
    persistedMusicRef.current = null
    clearPersistedMusic()
  }, [])

  const storeMediaPersist = async (mode, source) => {
    try {
      persistedMediaRef.current = await persistMediaSource(mode, source)
    } catch (err) {
      console.warn('Native Ads Generator: could not persist media', err)
      if (mode === 'pexels-video' && source.externalUrl) {
        persistedMediaRef.current = { mode, externalUrl: source.externalUrl }
      } else {
        persistedMediaRef.current = null
      }
    }
  }

  const handleUploadMusic = async (file) => {
    if (musicObjectUrlRef.current) {
      URL.revokeObjectURL(musicObjectUrlRef.current)
    }
    const url = URL.createObjectURL(file)
    musicObjectUrlRef.current = url
    setBackgroundMusic({ name: file.name, url })
    try {
      persistedMusicRef.current = await persistMusicSource(file)
    } catch (err) {
      console.warn('Native Ads Generator: could not persist music', err)
      persistedMusicRef.current = null
    }
  }

  const handleRemoveMusic = () => {
    clearBackgroundMusic()
  }

  const handleUploadImage = async (file) => {
    setBusy(true)
    setStatus('')
    try {
      clearMedia()
      const { img, url } = await loadImageFromBlob(file)
      setMedia(img, 'upload-image')
      URL.revokeObjectURL(url)
      storeMediaPersist('upload-image', { blob: file, fileName: file.name })
      setStatus('Image uploaded.')
    } catch (err) {
      setStatus(err?.message || 'Failed to load image')
      throw err
    } finally {
      setBusy(false)
    }
  }

  const handleUploadVideo = async (file) => {
    setBusy(true)
    setStatus('')
    try {
      clearMedia()
      const { video, url } = await loadVideoFromFile(file)
      videoObjectUrlRef.current = url
      setMedia(video, 'upload-video', { playing: true })
      storeMediaPersist('upload-video', { blob: file, fileName: file.name })
      setStatus('Video uploaded.')
    } catch (err) {
      setStatus(err?.message || 'Failed to load video')
      throw err
    } finally {
      setBusy(false)
    }
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
      await storeMediaPersist('webcam-photo', { dataUrl: img.src })
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
    await storeMediaPersist('unsplash', { dataUrl })
    setMedia(img, 'unsplash')
    setUnsplashOpen(false)
  }

  const handlePexelsVideoSelect = async (videoUrl) => {
    clearMedia()
    const { video, url } = await loadVideoFromUrl(videoUrl)
    videoObjectUrlRef.current = url
    await storeMediaPersist('pexels-video', { externalUrl: videoUrl })
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

  const handleAnalyze = async () => {
    const active = getActiveCopy(text)
    setAiBusy(true)
    setAiError('')
    try {
      const result = await analyzeAsOgilvy(active.headline, active.copy)
      setAnalysis(result)
    } catch (err) {
      setAiError(err?.message || 'Analysis failed')
    } finally {
      setAiBusy(false)
    }
  }

  const handleGenerateVersions = async () => {
    const active = getActiveCopy(text)
    setAiBusy(true)
    setAiError('')
    try {
      const result = await generateCopyVersions(active.headline, active.copy, COPY_VERSION_COUNT)
      if (!result.length) throw new Error('No versions were generated')
      setText((prev) => {
        const normalized = normalizeCopyVersions(prev)
        const copyVersions = [...normalized.copyVersions]
        result.forEach((version, i) => {
          if (i >= COPY_VERSION_COUNT) return
          copyVersions[i] = {
            ...copyVersions[i],
            headline: version.headline || copyVersions[i].headline,
            copy: version.copy || copyVersions[i].copy,
          }
        })
        return { ...prev, copyVersions }
      })
      setStatus(`AI filled ${Math.min(result.length, COPY_VERSION_COUNT)} copy versions.`)
    } catch (err) {
      setAiError(err?.message || 'Failed to generate versions')
    } finally {
      setAiBusy(false)
    }
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

  const handleMetaExport = async ({ adSetId, pageId, destinationUrl, adName }) => {
    setBusy(true)
    setMetaExportError('')
    setMetaExportSuccess(null)
    try {
      const accessToken = getApiKey('metaAccessToken')
      const adAccountId = getApiKey('metaAdAccountId')
      if (!accessToken?.trim() || !adAccountId?.trim()) {
        throw new Error('Add Meta credentials in API keys')
      }

      const canvas = await buildExportCanvas()
      const imageBlob = await new Promise((resolve, reject) => {
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Failed to render image'))), 'image/png')
      })

      const active = getActiveCopy(text)
      const primaryText = text.showSubheadline !== false ? active.copy : ''
      const headline = active.headline
      const description = text.showLinkTitle !== false ? active.linkTitle : ''

      const result = await exportNativeAdToMeta({
        accessToken: accessToken.trim(),
        adAccountId: adAccountId.trim(),
        pageId,
        adSetId,
        destinationUrl,
        imageBlob,
        primaryText,
        headline,
        description,
        adName,
        creativeName: `${adName} creative`,
      })

      setMetaExportSuccess(result)
      setStatus('Meta ad created (paused). Open Ads Manager to preview and publish.')
      setMetaExportOpen(false)
    } catch (err) {
      setMetaExportError(err?.message || 'Meta export failed')
    } finally {
      setBusy(false)
    }
  }

  const activeCopy = getActiveCopy(text)

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
    let cancelled = false
    ;(async () => {
      try {
        if (persistedMediaRef.current) {
          const restored = await restoreMediaFromPersisted(persistedMediaRef.current)
          if (!cancelled && restored) {
            if (restored.url) videoObjectUrlRef.current = restored.url
            mediaElementRef.current = restored.element
            setMediaElement(restored.element)
            setMediaMode(restored.mode)
            setIsVideoPlaying(restored.playing)
          }
        }
        if (persistedMusicRef.current) {
          const music = await restoreMusicFromPersisted(persistedMusicRef.current)
          if (!cancelled && music) {
            musicObjectUrlRef.current = music.url
            setBackgroundMusic(music)
          }
        }
      } catch (err) {
        console.warn('Native Ads Generator: failed to restore saved project', err)
      } finally {
        if (!cancelled) {
          setPersistReady(true)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!persistReady) return undefined
    const timer = window.setTimeout(() => {
      saveProject({
        formatId,
        backgroundColor,
        text,
        mediaTransform,
        media: persistedMediaRef.current,
        music: persistedMusicRef.current,
        musicVolume,
        sidebarTab,
        analysis,
      })
    }, 500)
    return () => window.clearTimeout(timer)
  }, [
    persistReady,
    formatId,
    backgroundColor,
    text,
    mediaTransform,
    mediaMode,
    mediaElement,
    backgroundMusic,
    musicVolume,
    sidebarTab,
    analysis,
  ])

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
              <button
                type="button"
                className="nag-btn nag-btn-meta"
                disabled={busy}
                onClick={() => {
                  setMetaExportError('')
                  setMetaExportSuccess(null)
                  setMetaExportOpen(true)
                }}
              >
                Export as Meta ad
              </button>
            </div>
            {metaExportSuccess?.adsManagerUrl && (
              <p className="nag-status">
                Paused ad created.{' '}
                <a href={metaExportSuccess.adsManagerUrl} target="_blank" rel="noopener noreferrer">
                  Open in Ads Manager
                </a>
              </p>
            )}
            {status && !metaExportSuccess?.adsManagerUrl && <p className="nag-status">{status}</p>}
          </section>
        </aside>

        <main className="nag-main">
          <PreviewPanel
            canvasRef={canvasRef}
            format={format}
            aspectRatio={aspectRatio}
            onPan={handlePan}
            canPan={!!mediaElement}
            onUploadImage={handleUploadImage}
            onUploadVideo={handleUploadVideo}
          />
        </main>

        <aside className="nag-copy-panel">
          <div className="nag-copy-panel-content">
            <CopySection
              panel
              text={text}
              onChange={setText}
              analysis={analysis}
              aiBusy={aiBusy}
              aiError={aiError}
              onAnalyze={handleAnalyze}
              onGenerateVersions={handleGenerateVersions}
            />
          </div>
        </aside>
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

      <MetaExportModal
        isOpen={metaExportOpen}
        onClose={() => setMetaExportOpen(false)}
        onSubmit={handleMetaExport}
        busy={busy}
        error={metaExportError}
        defaultAdName={activeCopy.headline?.trim() || 'Native ad'}
      />
    </div>
  )
}
