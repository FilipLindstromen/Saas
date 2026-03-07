import { useState, useCallback, useEffect, useRef } from 'react'
import type { CaptionSegment, CaptionStyle, CaptionAnimation } from './types'
import { loadApiKeys } from './utils/apiKeys'
import { getStoredTheme, initThemeSync, type Theme } from './utils/theme'
import { loadAutoCaptionsState, saveAutoCaptionsState } from './utils/persistence'
import { transcribeVideo } from './services/transcription'
import { exportVideoWithCaptions, getVideoDimensions, type ExportFormat } from './utils/export'
import { TranscriptPanel } from './components/TranscriptPanel'
import { VideoPreview } from './components/VideoPreview'
import { StylesPanel } from './components/StylesPanel'
import { FONT_SIZE_DEFAULT } from './constants'
import ThemeToggle from '@shared/ThemeToggle'
import styles from './App.module.css'

export default function App() {
  const openaiKey = loadApiKeys().openai
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme())

  const [videoBlob, setVideoBlob] = useState<Blob | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [videoDimensions, setVideoDimensions] = useState({ width: 1280, height: 720 })
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)

  const [segments, setSegments] = useState<CaptionSegment[]>([])
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [transcribeError, setTranscribeError] = useState<string | null>(null)

  const [captionStyle, setCaptionStyle] = useState<CaptionStyle>('lower-third')
  const [captionAnimation, setCaptionAnimation] = useState<CaptionAnimation>('fade')
  const [fontFamily, setFontFamily] = useState('Oswald')
  const [fontSizePercent, setFontSizePercent] = useState(FONT_SIZE_DEFAULT)
  const [captionY, setCaptionY] = useState(0.85)
  const [isDraggingY, setIsDraggingY] = useState(false)
  const [animateByWord, setAnimateByWord] = useState(false)

  const [exportFormat, setExportFormat] = useState<ExportFormat>('webm')
  const [exporting, setExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const isRestoringRef = useRef(false)

  useEffect(() => {
    const unsub = initThemeSync()
    const handler = () => setTheme(getStoredTheme() as Theme)
    window.addEventListener('saas-theme-change', handler)
    return () => {
      unsub?.()
      window.removeEventListener('saas-theme-change', handler)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    isRestoringRef.current = true
    loadAutoCaptionsState()
      .then((state) => {
        if (cancelled || !state) return
        setVideoBlob(state.videoBlob)
        setSegments(state.segments)
      })
      .catch(() => {})
      .finally(() => {
        isRestoringRef.current = false
      })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!videoBlob) {
      if (videoUrl) URL.revokeObjectURL(videoUrl)
      setVideoUrl(null)
      if (!isRestoringRef.current) setSegments([])
      setDuration(0)
      setCurrentTime(0)
      return
    }
    const url = URL.createObjectURL(videoBlob)
    setVideoUrl(url)
    getVideoDimensions(videoBlob).then(setVideoDimensions).catch(() => {})
    return () => URL.revokeObjectURL(url)
  }, [videoBlob])

  useEffect(() => {
    if (!videoBlob) return
    const t = setTimeout(() => {
      saveAutoCaptionsState({ videoBlob, segments }).catch(() => {})
    }, 1000)
    return () => clearTimeout(t)
  }, [videoBlob, segments])

  useEffect(() => {
    const saveOnUnload = () => {
      if (videoBlob) saveAutoCaptionsState({ videoBlob, segments }).catch(() => {})
    }
    window.addEventListener('beforeunload', saveOnUnload)
    return () => window.removeEventListener('beforeunload', saveOnUnload)
  }, [videoBlob, segments])

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('video/')) return
    setVideoBlob(file)
    setTranscribeError(null)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )
  const handleDragOver = useCallback((e: React.DragEvent) => e.preventDefault(), [])

  const handleTranscribe = useCallback(async () => {
    if (!videoBlob) return
    setTranscribeError(null)
    setIsTranscribing(true)
    try {
      const result = await transcribeVideo(videoBlob, openaiKey)
      setSegments(result)
    } catch (e) {
      setTranscribeError(e instanceof Error ? e.message : 'Transcription failed')
    } finally {
      setIsTranscribing(false)
    }
  }, [videoBlob, openaiKey])

  const handleSeek = useCallback((time: number) => {
    const video = document.querySelector('video')
    if (video) {
      video.currentTime = time
      setCurrentTime(time)
    }
  }, [])

  const handleExport = useCallback(async () => {
    if (!videoBlob || segments.length === 0) return
    setExporting(true)
    setExportProgress(0)
    try {
      const { blob, extension } = await exportVideoWithCaptions(videoBlob, {
        width: videoDimensions.width,
        height: videoDimensions.height,
        format: exportFormat,
        segments,
        captionStyle,
        captionAnimation,
        animateByWord,
        fontFamily,
        fontSizePercent,
        captionY,
        onProgress: setExportProgress,
      })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `captions_export.${extension}`
      a.click()
      URL.revokeObjectURL(a.href)
    } catch (e) {
      console.error('Export failed', e)
    } finally {
      setExporting(false)
      setExportProgress(0)
    }
  }, [
    videoBlob,
    segments,
    videoDimensions,
    exportFormat,
    captionStyle,
    captionAnimation,
    animateByWord,
    fontFamily,
    fontSizePercent,
    captionY,
  ])

  const saasAppsUrl =
    typeof window !== 'undefined' ? new URL('../index.html', window.location.href).href : '/index.html'

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.titleBlock}>
            <h1 className={styles.title}>AutoCaptions</h1>
            <p className={styles.subtitle}>Transcribe video and add styled captions</p>
          </div>
        </div>
        <div className={styles.headerRight}>
          <button
            type="button"
            className={styles.settingsBtn}
            onClick={() => setSettingsOpen(true)}
            title="Settings (API keys)"
            aria-label="Settings"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
          <ThemeToggle theme={theme} onToggle={(t) => setTheme(t as Theme)} className={styles.themeToggle} />
        </div>
      </header>

      {settingsOpen && (
        <div className={styles.modalOverlay} onClick={() => setSettingsOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>Settings</span>
              <button type="button" className={styles.modalClose} onClick={() => setSettingsOpen(false)} aria-label="Close">×</button>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.modalHint}>
                API keys are configured in the{' '}
                <a href={saasAppsUrl} target="_blank" rel="noopener noreferrer" className={styles.modalLink}>
                  SaaS Apps screen
                </a>
                . Your OpenAI key is shared across all apps for transcription.
              </p>
            </div>
          </div>
        </div>
      )}

      <div
        className={styles.body}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          className={styles.fileInput}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
            e.target.value = ''
          }}
          aria-label="Upload video"
        />

        <aside className={styles.leftPanel}>
          <TranscriptPanel
            segments={segments}
            onSegmentsChange={setSegments}
            currentTime={currentTime}
            onSeek={handleSeek}
            onTranscribe={handleTranscribe}
            isTranscribing={isTranscribing}
            transcribeError={transcribeError}
          />
        </aside>

        <main className={styles.main}>
          <div className={styles.uploadZone}>
            {!videoUrl ? (
              <button
                type="button"
                className={styles.uploadBtn}
                onClick={() => fileInputRef.current?.click()}
              >
                Click to upload or drag and drop a video
              </button>
            ) : (
              <div className={styles.previewArea}>
                <VideoPreview
                  videoUrl={videoUrl}
                  segments={segments.length > 0 ? segments : null}
                  currentTime={currentTime}
                  onTimeUpdate={setCurrentTime}
                  onDurationChange={setDuration}
                  onSeek={handleSeek}
                captionStyle={captionStyle}
                captionAnimation={captionAnimation}
                animateByWord={animateByWord}
                fontFamily={fontFamily}
                fontSizePercent={fontSizePercent}
                captionY={captionY}
                onCaptionYChange={setCaptionY}
                isDraggingY={isDraggingY}
                onDraggingYChange={setIsDraggingY}
              />
              </div>
            )}
          </div>

          {videoUrl && (
            <div className={styles.exportBar}>
              <label className={styles.exportLabel}>
                Export format:
                <select
                  className={styles.exportSelect}
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
                  aria-label="Export format"
                >
                  <option value="webm">WebM</option>
                  <option value="mp4">MP4</option>
                </select>
              </label>
              <button
                type="button"
                className={styles.exportBtn}
                onClick={handleExport}
                disabled={exporting || segments.length === 0}
              >
                {exporting ? `Exporting… ${Math.round(exportProgress)}%` : 'Export with captions'}
              </button>
              {segments.length === 0 && (
                <span className={styles.exportHint}>Transcribe first to export with captions.</span>
              )}
            </div>
          )}
        </main>

        <aside className={styles.rightPanel}>
          <StylesPanel
            captionStyle={captionStyle}
            onCaptionStyleChange={setCaptionStyle}
            captionAnimation={captionAnimation}
            onCaptionAnimationChange={setCaptionAnimation}
            animateByWord={animateByWord}
            onAnimateByWordChange={setAnimateByWord}
            fontFamily={fontFamily}
            onFontFamilyChange={setFontFamily}
            fontSizePercent={fontSizePercent}
            onFontSizeChange={setFontSizePercent}
            captionY={captionY}
            onCaptionYChange={setCaptionY}
          />
        </aside>
      </div>
    </div>
  )
}
