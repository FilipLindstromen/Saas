import { useState, useRef, useEffect, useCallback } from 'react'
import type { CaptionSegment } from '../services/captions'
import { generateYouTubeCaption } from '../services/youtubeDescription'
import {
  getYouTubeAccessToken,
  uploadVideoToYouTube,
  setYouTubeThumbnail,
} from '../services/youtubeUpload'
import type { AspectRatio } from '../types'
import { FONT_OPTIONS } from '../constants/fonts'
import { IconX, IconWand } from './Icons'
import { getStoredGoogleClientId } from './SettingsModal'
import styles from './ThumbnailCaptionsPanel.module.css'

export interface ThumbnailTextItem {
  id: string
  text: string
  x: number
  y: number
  fontSizePercent: number
  fontFamily?: string
}

const MIN_FONT_PCT = 2
const MAX_FONT_PCT = 50

function generateId() {
  return Math.random().toString(36).slice(2, 10)
}

interface ThumbnailCaptionsPanelProps {
  videoUrl: string
  videoBlob: Blob
  aspectRatio: AspectRatio
  captionSegments: CaptionSegment[] | null
  openaiApiKey?: string
  youtubeTitle: string
  onYoutubeTitleChange: (value: string) => void
  youtubeCaption: string
  onYoutubeCaptionChange: (value: string) => void
  thumbnailBlob: Blob | null
  onThumbnailChange: (blob: Blob | null) => void
  onClose: () => void
  /** When true, render in work area without modal overlay */
  embedded?: boolean
}

export function ThumbnailCaptionsPanel({
  videoUrl,
  videoBlob,
  aspectRatio,
  captionSegments,
  openaiApiKey,
  youtubeTitle,
  onYoutubeTitleChange,
  youtubeCaption,
  onYoutubeCaptionChange,
  thumbnailBlob,
  onThumbnailChange,
  onClose,
  embedded = false,
}: ThumbnailCaptionsPanelProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const webcamVideoRef = useRef<HTMLVideoElement>(null)
  const webcamStreamRef = useRef<MediaStream | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [seekTime, setSeekTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [texts, setTexts] = useState<ThumbnailTextItem[]>([])
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null)
  const [captionGenerating, setCaptionGenerating] = useState(false)
  const [captionError, setCaptionError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null)
  const [dragState, setDragState] = useState<{ id: string; startX: number; startY: number; startItemX: number; startItemY: number } | null>(null)
  const [resizeState, setResizeState] = useState<{
    id: string
    startY: number
    startFontSizePercent: number
  } | null>(null)
  const [webcamImageUrl, setWebcamImageUrl] = useState<string | null>(null)
  const [webcamLive, setWebcamLive] = useState(false)
  const [webcamError, setWebcamError] = useState<string | null>(null)
  const [previewWidth, setPreviewWidth] = useState(0)

  const isPortrait = aspectRatio === '9:16'
  const isSquare = aspectRatio === '1:1'
  const thumbWidth = isPortrait ? 1080 : isSquare ? 1080 : 1920
  const thumbHeight = isPortrait ? 1920 : isSquare ? 1080 : 1080

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const onLoaded = () => {
      setDuration(v.duration)
      setSeekTime(0)
    }
    v.addEventListener('loadedmetadata', onLoaded)
    if (v.duration && isFinite(v.duration)) onLoaded()
    return () => v.removeEventListener('loadedmetadata', onLoaded)
  }, [videoUrl])

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    v.currentTime = seekTime
  }, [seekTime, videoUrl])

  useEffect(() => {
    const stream = webcamStreamRef.current
    const v = webcamVideoRef.current
    if (!stream || !v) return
    v.srcObject = stream
    v.play().catch(() => {})
    return () => {
      v.srcObject = null
    }
  }, [webcamLive])

  useEffect(() => {
    return () => {
      const stream = webcamStreamRef.current
      if (stream) {
        stream.getTracks().forEach((t) => t.stop())
        webcamStreamRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (typeof w === 'number') setPreviewWidth(w)
    })
    ro.observe(el)
    setPreviewWidth(el.getBoundingClientRect().width)
    return () => ro.disconnect()
  }, [])

  const addText = useCallback(() => {
    const item: ThumbnailTextItem = {
      id: generateId(),
      text: 'Your title',
      x: 0.5,
      y: 0.5,
      fontSizePercent: 5,
      fontFamily: 'Oswald',
    }
    setTexts((prev) => [...prev, item])
    setSelectedTextId(item.id)
  }, [])

  const updateText = useCallback((id: string, patch: Partial<ThumbnailTextItem>) => {
    setTexts((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)))
  }, [])

  const removeText = useCallback((id: string) => {
    setTexts((prev) => prev.filter((t) => t.id !== id))
    if (selectedTextId === id) setSelectedTextId(null)
  }, [selectedTextId])

  const startWebcam = useCallback(async () => {
    setWebcamError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: thumbWidth }, height: { ideal: thumbHeight }, facingMode: 'user' },
        audio: false,
      })
      if (webcamStreamRef.current) {
        webcamStreamRef.current.getTracks().forEach((t) => t.stop())
      }
      webcamStreamRef.current = stream
      setWebcamImageUrl(null)
      setWebcamLive(true)
    } catch (e) {
      setWebcamError(e instanceof Error ? e.message : 'Could not access webcam')
    }
  }, [thumbWidth, thumbHeight])

  const captureWebcamPhoto = useCallback(() => {
    const v = webcamVideoRef.current
    const stream = webcamStreamRef.current
    if (!v || !stream || v.readyState < 2) return
    const canvas = document.createElement('canvas')
    canvas.width = v.videoWidth
    canvas.height = v.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(v, 0, 0)
    const dataUrl = canvas.toDataURL('image/png')
    setWebcamImageUrl(dataUrl)
    setWebcamLive(false)
    stream.getTracks().forEach((t) => t.stop())
    webcamStreamRef.current = null
  }, [])

  const clearWebcamPhoto = useCallback(() => {
    setWebcamImageUrl(null)
    if (webcamStreamRef.current) {
      webcamStreamRef.current.getTracks().forEach((t) => t.stop())
      webcamStreamRef.current = null
    }
    setWebcamLive(false)
    setWebcamError(null)
  }, [])

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, id: string) => {
      if ((e.target as HTMLElement).getAttribute?.('data-resize-handle') === 'true') return
      e.preventDefault()
      const t = texts.find((x) => x.id === id)
      if (!t) return
      setSelectedTextId(id)
      setDragState({
        id,
        startX: e.clientX,
        startY: e.clientY,
        startItemX: t.x,
        startItemY: t.y,
      })
      ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    },
    [texts]
  )

  const handleResizePointerDown = useCallback(
    (e: React.PointerEvent, id: string) => {
      e.preventDefault()
      e.stopPropagation()
      const t = texts.find((x) => x.id === id)
      if (!t) return
      setSelectedTextId(id)
      setResizeState({
        id,
        startY: e.clientY,
        startFontSizePercent: t.fontSizePercent,
      })
      containerRef.current?.setPointerCapture?.(e.pointerId)
    },
    [texts]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (resizeState) {
        const dy = e.clientY - resizeState.startY
        const percentPerPx = 0.08
        const delta = dy * percentPerPx
        const newPercent = Math.max(
          MIN_FONT_PCT,
          Math.min(MAX_FONT_PCT, resizeState.startFontSizePercent + delta)
        )
        updateText(resizeState.id, { fontSizePercent: newPercent })
        return
      }
      if (!dragState) return
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return
      const dx = (e.clientX - dragState.startX) / rect.width
      const dy = (e.clientY - dragState.startY) / rect.height
      const nx = Math.max(0, Math.min(1, dragState.startItemX + dx))
      const ny = Math.max(0, Math.min(1, dragState.startItemY + dy))
      updateText(dragState.id, { x: nx, y: ny })
    },
    [dragState, resizeState, updateText]
  )

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    setDragState(null)
    setResizeState(null)
    containerRef.current?.releasePointerCapture?.(e.pointerId)
    ;(e.target as HTMLElement).releasePointerCapture?.(e.pointerId)
  }, [])

  const drawTextsOnCanvas = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      ctx.textBaseline = 'middle'
      ctx.textAlign = 'center'
      for (const t of texts) {
        if (!t.text.trim()) continue
        const fontSize = (thumbWidth * t.fontSizePercent) / 100
        ctx.font = `bold ${fontSize}px "Oswald", sans-serif`
        ctx.fillStyle = '#ffffff'
        ctx.strokeStyle = '#000000'
        ctx.lineWidth = Math.max(2, fontSize / 30)
        const px = t.x * thumbWidth
        const py = t.y * thumbHeight
        ctx.strokeText(t.text, px, py)
        ctx.fillText(t.text, px, py)
      }
    },
    [texts, thumbWidth, thumbHeight]
  )

  const generateThumbnail = useCallback(() => {
    const canvas = document.createElement('canvas')
    canvas.width = thumbWidth
    canvas.height = thumbHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    if (webcamImageUrl) {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        ctx.drawImage(img, 0, 0, thumbWidth, thumbHeight)
        drawTextsOnCanvas(ctx)
        canvas.toBlob(
          (blob) => {
            if (blob) onThumbnailChange(blob)
          },
          'image/png',
          0.95
        )
      }
      img.onerror = () => {}
      img.src = webcamImageUrl
      return
    }

    const video = videoRef.current
    if (!video || video.readyState < 2) return
    ctx.drawImage(video, 0, 0, thumbWidth, thumbHeight)
    drawTextsOnCanvas(ctx)
    canvas.toBlob(
      (blob) => {
        if (blob) onThumbnailChange(blob)
      },
      'image/png',
      0.95
    )
  }, [texts, thumbWidth, thumbHeight, webcamImageUrl, drawTextsOnCanvas, onThumbnailChange])

  const generateCaption = useCallback(async () => {
    if (!captionSegments || captionSegments.length === 0) {
      setCaptionError('Transcribe the video first in Edit mode (Captions panel).')
      return
    }
    setCaptionError(null)
    setCaptionGenerating(true)
    try {
      const text = await generateYouTubeCaption(captionSegments, openaiApiKey)
      onYoutubeCaptionChange(text)
    } catch (e) {
      setCaptionError(e instanceof Error ? e.message : 'Failed to generate caption')
    } finally {
      setCaptionGenerating(false)
    }
  }, [captionSegments, openaiApiKey, onYoutubeCaptionChange])

  const handleUploadToYouTube = useCallback(async () => {
    const clientId = getStoredGoogleClientId()
    if (!clientId) {
      setUploadError('Add your Google Client ID in Settings to upload to YouTube.')
      return
    }
    const title = youtubeTitle.trim() || 'My video'
    setUploadError(null)
    setUploadSuccess(null)
    setUploading(true)
    try {
      const token = await getYouTubeAccessToken(clientId)
      const videoId = await uploadVideoToYouTube(token, videoBlob, {
        title,
        description: youtubeCaption.trim(),
        privacyStatus: 'private',
      })
      if (thumbnailBlob) {
        await setYouTubeThumbnail(token, videoId, thumbnailBlob)
      }
      setUploadSuccess(`Uploaded! Video ID: ${videoId}. Check your YouTube Studio.`)
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }, [videoBlob, youtubeTitle, youtubeCaption, thumbnailBlob])

  const selectedText = texts.find((t) => t.id === selectedTextId)

  const content = (
    <>
      <div className={styles.header}>
        <h2 className={styles.title}>Thumbnail &amp; Captions</h2>
        <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
          <IconX />
        </button>
      </div>
      <div className={styles.body}>
        <div className={embedded ? styles.bodyThreeColEmbed : styles.bodyThreeCol}>
          {/* Column 1: Edit thumbnail content + take photo + generate + upload */}
          <div className={styles.bodyColEdit}>
            <section className={styles.thumbSection}>
              <h3 className={styles.sectionTitle}>Thumbnail</h3>
              <p className={styles.hint}>
                Choose a frame (seek), add text and position it in the preview. Thumbnail is {thumbWidth}×{thumbHeight} ({aspectRatio}).
              </p>
              {webcamError && <p className={styles.error}>{webcamError}</p>}
              {!webcamLive && !webcamImageUrl && (
                <>
                  <label className={styles.label}>Frame time</label>
                  <input
                    type="range"
                    className={styles.slider}
                    min={0}
                    max={duration || 1}
                    step={0.1}
                    value={seekTime}
                    onChange={(e) => setSeekTime(Number(e.target.value))}
                  />
                  <span className={styles.timeValue}>{seekTime.toFixed(1)}s</span>
                  <button type="button" className={styles.btn} onClick={startWebcam}>
                    Take photo with webcam
                  </button>
                </>
              )}
              {webcamLive && (
                <>
                  <button type="button" className={styles.btnPrimary} onClick={captureWebcamPhoto}>
                    Capture photo
                  </button>
                  <button type="button" className={styles.btn} onClick={clearWebcamPhoto}>
                    Cancel
                  </button>
                </>
              )}
              {webcamImageUrl && (
                <button type="button" className={styles.btn} onClick={clearWebcamPhoto}>
                  Use video frame instead
                </button>
              )}
              <button type="button" className={styles.btn} onClick={addText}>
                Add text
              </button>
              {selectedText && (
                <div className={styles.textEdit}>
                  <label className={styles.label}>Selected text</label>
                  <input
                    type="text"
                    className={styles.input}
                    value={selectedText.text}
                    onChange={(e) => updateText(selectedText.id, { text: e.target.value })}
                    placeholder="Text"
                  />
                  <label className={styles.label}>Font</label>
                  <select
                    className={styles.select}
                    value={selectedText.fontFamily ?? 'Oswald'}
                    onChange={(e) => updateText(selectedText.id, { fontFamily: e.target.value })}
                    aria-label="Font family"
                  >
                    {FONT_OPTIONS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                  <label className={styles.label}>Size %</label>
                  <input
                    type="range"
                    className={styles.slider}
                    min={MIN_FONT_PCT}
                    max={MAX_FONT_PCT}
                    value={selectedText.fontSizePercent}
                    onChange={(e) => updateText(selectedText.id, { fontSizePercent: Number(e.target.value) })}
                  />
                  <span className={styles.sliderValue}>{selectedText.fontSizePercent.toFixed(1)}%</span>
                  <button type="button" className={styles.removeTextBtn} onClick={() => removeText(selectedText.id)}>
                    Remove text
                  </button>
                </div>
              )}
              <button type="button" className={styles.btnPrimary} onClick={generateThumbnail}>
                Generate thumbnail
              </button>
              {thumbnailBlob && (
                <p className={styles.doneHint}>Thumbnail saved. It will be used when you upload to YouTube.</p>
              )}
            </section>
            <section className={styles.uploadSection}>
              <h3 className={styles.sectionTitle}>Upload to YouTube</h3>
              <p className={styles.hint}>
                Upload the current video to your YouTube channel. Add your Google Client ID in Settings first. Videos upload as private by default.
              </p>
              {uploadError && <p className={styles.error}>{uploadError}</p>}
              {uploadSuccess && <p className={styles.success}>{uploadSuccess}</p>}
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={handleUploadToYouTube}
                disabled={uploading}
              >
                {uploading ? 'Uploading…' : 'Upload to YouTube'}
              </button>
            </section>
          </div>

          {/* Column 2: Preview (video/image + draggable text) */}
          <div className={styles.bodyColPreview}>
            <section className={styles.previewSection}>
              <h3 className={styles.sectionTitle}>Preview</h3>
              <div
                ref={containerRef}
                className={styles.previewWrap}
                style={{ aspectRatio: `${thumbWidth} / ${thumbHeight}` }}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
              >
                {webcamImageUrl ? (
                  <img src={webcamImageUrl} alt="Thumbnail" className={styles.videoBg} />
                ) : webcamLive ? (
                  <video ref={webcamVideoRef} muted playsInline autoPlay className={styles.videoBg} />
                ) : (
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    muted
                    playsInline
                    preload="metadata"
                    className={styles.videoBg}
                  />
                )}
                {texts.map((t) => {
                  const fontSizePx = previewWidth > 0 ? (previewWidth * t.fontSizePercent) / 100 : 24
                  const isSelected = selectedTextId === t.id
                  return (
                    <div
                      key={t.id}
                      className={`${styles.thumbText} ${isSelected ? styles.thumbTextSelected : ''}`}
                      style={{
                        left: `${t.x * 100}%`,
                        top: `${t.y * 100}%`,
                        transform: 'translate(-50%, -50%)',
                        fontSize: `${fontSizePx}px`,
                        fontFamily: `"${t.fontFamily ?? 'Oswald'}", sans-serif`,
                      }}
                      onPointerDown={(e) => handlePointerDown(e, t.id)}
                    >
                      <span className={styles.thumbTextContent}>{t.text || 'Text'}</span>
                      {isSelected && (
                        <span
                          className={styles.resizeHandle}
                          data-resize-handle="true"
                          onPointerDown={(e) => handleResizePointerDown(e, t.id)}
                          title="Drag to resize text"
                          aria-label="Resize text"
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          </div>

          {/* Column 3: Captions / YouTube description */}
          <div className={styles.bodyColCaptions}>
            <section className={styles.captionSection}>
              <h3 className={styles.sectionTitle}>Captions &amp; description</h3>
              <p className={styles.hint}>
                Video title and description for YouTube. Generate description from transcription or edit.
              </p>
              <label className={styles.label}>Video title</label>
              <input
                type="text"
                className={styles.input}
                value={youtubeTitle}
                onChange={(e) => onYoutubeTitleChange(e.target.value)}
                placeholder="Video title for YouTube"
              />
              <button
                type="button"
                className={styles.captionGenBtn}
                onClick={generateCaption}
                disabled={captionGenerating || !captionSegments?.length}
                title="Use OpenAI to write a YouTube-optimized description from the transcription"
              >
                {captionGenerating ? 'Generating…' : (
                  <>
                    <IconWand /> Generate from transcription
                  </>
                )}
              </button>
              {captionError && <p className={styles.error}>{captionError}</p>}
              <label className={styles.label}>Description</label>
              <textarea
                className={styles.textarea}
                value={youtubeCaption}
                onChange={(e) => onYoutubeCaptionChange(e.target.value)}
                placeholder="Video description for YouTube…"
                rows={10}
              />
            </section>
          </div>
        </div>
      </div>
    </>
  )

  if (embedded) {
    return (
      <div className={styles.embedded} aria-label="Thumbnail and captions">
        <div className={styles.panel}>{content}</div>
      </div>
    )
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Thumbnail and captions">
      <div className={styles.panel}>{content}</div>
    </div>
  )
}
