import { useState, useRef, useEffect } from 'react'
import type { CaptionStyle } from '../types'
import { CAPTION_STYLES } from '../constants'
import { IconWand, IconRefresh } from './Icons'
import { transcribeAudioFromVideo } from '../services/captions'
import type { CaptionSegment } from '../services/captions'
import { drawCaptionStyle } from '../utils/canvasCapture'
import styles from './CaptionBurnIn.module.css'

const PREVIEW_W = 240
const PREVIEW_H = 135
const SAMPLE_SEGMENT: CaptionSegment = { start: 0, end: 1, text: 'Sample caption text' }

interface CaptionBurnInProps {
  videoBlob: Blob | null
  onBurnedBlob: (blob: Blob) => void
  width: number
  height: number
  openaiApiKey?: string
  captionStyle?: CaptionStyle
  /** Caption font size as % of video width (e.g. 2 = 2%) */
  captionFontSizePercent?: number
  captionY?: number
  onCaptionStyleChange?: (style: CaptionStyle) => void
  onCaptionFontSizePercentChange?: (percent: number) => void
  onCaptionYChange?: (y: number) => void
  /** After transcription, segments are stored here; burn-in uses these (editable in left panel). */
  captionSegments: CaptionSegment[] | null
  onTranscriptionDone: (segments: CaptionSegment[]) => void
}

export function CaptionBurnIn({
  videoBlob,
  onBurnedBlob,
  width,
  height,
  openaiApiKey,
  captionStyle: controlledStyle,
  captionFontSizePercent: controlledFontSizePercent,
  captionY: controlledCaptionY,
  onCaptionStyleChange,
  onCaptionFontSizePercentChange,
  onCaptionYChange,
  captionSegments,
  onTranscriptionDone,
}: CaptionBurnInProps) {
  const [internalStyle, setInternalStyle] = useState<CaptionStyle>('lower-third')
  const [internalFontSizePercent, setInternalFontSizePercent] = useState(2)
  const [internalCaptionY, setInternalCaptionY] = useState(0.85)
  const [status, setStatus] = useState<'idle' | 'transcribing' | 'burning' | 'done' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const previewRef = useRef<HTMLCanvasElement>(null)
  const dragRef = useRef(false)

  const style = controlledStyle ?? internalStyle
  const fontSizePercent = controlledFontSizePercent ?? internalFontSizePercent
  const captionY = controlledCaptionY ?? internalCaptionY
  const setStyle = onCaptionStyleChange ?? setInternalStyle
  const setFontSizePercent = onCaptionFontSizePercentChange ?? setInternalFontSizePercent
  const setCaptionY = onCaptionYChange ?? setInternalCaptionY

  useEffect(() => {
    const canvas = previewRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    canvas.width = PREVIEW_W
    canvas.height = PREVIEW_H
    ctx.fillStyle = '#1a1a1e'
    ctx.fillRect(0, 0, PREVIEW_W, PREVIEW_H)
    drawCaptionStyle(
      ctx,
      PREVIEW_W,
      PREVIEW_H,
      [SAMPLE_SEGMENT],
      0,
      style,
      { fontSizePercent, captionY }
    )
  }, [style, fontSizePercent, captionY])

  const handlePreviewPointerDown = (e: React.PointerEvent) => {
    dragRef.current = true
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect()
    const y = (e.clientY - rect.top) / rect.height
    setCaptionY(Math.max(0, Math.min(1, y)))
    ;(e.target as HTMLCanvasElement).setPointerCapture?.(e.pointerId)
  }
  const handlePreviewPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect()
    const y = (e.clientY - rect.top) / rect.height
    setCaptionY(Math.max(0, Math.min(1, y)))
  }
  const handlePreviewPointerUp = (e: React.PointerEvent) => {
    dragRef.current = false
    ;(e.target as HTMLCanvasElement).releasePointerCapture?.(e.pointerId)
  }

  async function handleTranscribe() {
    if (!videoBlob) return
    setError(null)
    setStatus('transcribing')
    try {
      const segments = await transcribeAudioFromVideo(videoBlob, openaiApiKey)
      onTranscriptionDone(segments)
      setStatus('idle')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Transcription failed')
      setStatus('error')
    }
  }

  async function handleBurnIn() {
    if (!videoBlob || !captionSegments || captionSegments.length === 0) return
    setError(null)
    setStatus('burning')
    try {
      const blob = await burnCaptionsIntoVideo(videoBlob, captionSegments, style, width, height, { fontSizePercent, captionY })
      onBurnedBlob(blob)
      setStatus('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Burn-in failed')
      setStatus('error')
    }
  }

  if (!videoBlob) return null

  return (
    <div className={styles.wrap}>
      <h3 className={styles.title}>Burn-in captions (OpenAI Whisper)</h3>
      <p className={styles.hint}>Transcribes audio and burns captions into the video. Font: Oswald.</p>

      <div className={styles.previewSection}>
        <label className={styles.label}>Preview — drag to set vertical position</label>
        <div className={styles.previewWrap}>
          <canvas
            ref={previewRef}
            className={styles.previewCanvas}
            width={PREVIEW_W}
            height={PREVIEW_H}
            onPointerDown={handlePreviewPointerDown}
            onPointerMove={handlePreviewPointerMove}
            onPointerUp={handlePreviewPointerUp}
            onPointerLeave={handlePreviewPointerUp}
            style={{ cursor: 'ns-resize' }}
            title="Drag up or down to set caption position"
          />
        </div>
      </div>

      <div className={styles.row}>
        <label className={styles.label}>Style</label>
        <select
          className={styles.select}
          value={style}
          onChange={(e) => setStyle(e.target.value as CaptionStyle)}
        >
          {CAPTION_STYLES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>
      <div className={styles.sliderBlock}>
        <label className={styles.label}>Caption size (% of width)</label>
        <div className={styles.sliderRow}>
          <input
            type="range"
            className={styles.slider}
            min={50}
            max={5000}
            step={5}
            value={Math.round(fontSizePercent * 100)}
            onChange={(e) => setFontSizePercent(Number(e.target.value) / 100)}
            aria-label="Caption size percentage"
          />
          <span className={styles.sliderValue}>{fontSizePercent.toFixed(1)}%</span>
        </div>
      </div>
      {error && <p className={styles.error}>{error}</p>}
      <div className={styles.btnRow}>
        <button
          type="button"
          className={styles.btn}
          disabled={status === 'transcribing' || status === 'burning'}
          onClick={handleTranscribe}
          title={status === 'transcribing' ? 'Transcribing…' : 'Transcribe audio (edit in left panel, then Burn in)'}
          aria-label="Transcribe audio"
        >
          {status === 'transcribing' ? (
            <>Transcribing…</>
          ) : status === 'error' ? (
            <IconRefresh />
          ) : (
            'Transcribe'
          )}
        </button>
        {captionSegments && captionSegments.length > 0 && (
          <button
            type="button"
            className={styles.btnPrimary}
            disabled={status === 'transcribing' || status === 'burning'}
            onClick={handleBurnIn}
            title={status === 'burning' ? 'Burning…' : 'Burn edited captions into video'}
            aria-label="Burn captions into video"
          >
            {status === 'burning' ? 'Burning…' : 'Burn in'}
          </button>
        )}
      </div>
    </div>
  )
}

async function burnCaptionsIntoVideo(
  videoBlob: Blob,
  segments: CaptionSegment[],
  style: CaptionStyle,
  width: number,
  height: number,
  options: { fontSizePercent: number; captionY: number }
): Promise<Blob> {
  const video = document.createElement('video')
  video.src = URL.createObjectURL(videoBlob)
  video.muted = false
  await new Promise<void>((resolve, reject) => {
    video.onloadeddata = () => resolve()
    video.onerror = () => reject(new Error('Video load failed'))
  })

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  const videoStream = canvas.captureStream(30)
  const audioCtx = new AudioContext()
  const source = audioCtx.createMediaElementSource(video)
  const dest = audioCtx.createMediaStreamDestination()
  source.connect(dest)
  source.connect(audioCtx.destination)
  const outStream = new MediaStream([...videoStream.getVideoTracks(), ...dest.stream.getAudioTracks()])

  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
    ? 'video/webm;codecs=vp9,opus'
    : 'video/webm'
  const recorder = new MediaRecorder(outStream, {
    mimeType,
    videoBitsPerSecond: 5_000_000,
    audioBitsPerSecond: 128_000,
  })
  const chunks: Blob[] = []
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data)

  await new Promise<void>((resolve) => {
    recorder.onstop = () => resolve()
    recorder.start(100)
    video.play()
  })

  const drawFrame = () => {
    if (video.ended || video.paused) return
    ctx.drawImage(video, 0, 0, width, height)
    drawCaptionStyle(ctx, width, height, segments, video.currentTime, style, options)
    requestAnimationFrame(drawFrame)
  }
  drawFrame()

  await new Promise<void>((resolve) => {
    video.onended = () => resolve()
  })

  recorder.stop()
  video.pause()
  URL.revokeObjectURL(video.src)

  await new Promise((r) => setTimeout(r, 400))
  return new Blob(chunks, { type: recorder.mimeType })
}
