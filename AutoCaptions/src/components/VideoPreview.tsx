import { useRef, useEffect, useCallback, useState } from 'react'
import type { CaptionSegment, CaptionStyle, CaptionAnimation } from '../types'
import { drawCaption } from '../utils/captionRenderer'
import styles from './VideoPreview.module.css'

interface VideoPreviewProps {
  videoUrl: string | null
  segments: CaptionSegment[] | null
  currentTime: number
  onTimeUpdate: (time: number) => void
  onDurationChange: (duration: number) => void
  onSeek: (time: number) => void
  captionStyle: CaptionStyle
  captionAnimation: CaptionAnimation
  animateByWord: boolean
  fontFamily: string
  fontSizePercent: number
  captionY: number
  onCaptionYChange: (y: number) => void
  isDraggingY: boolean
  onDraggingYChange: (dragging: boolean) => void
}

export function VideoPreview({
  videoUrl,
  segments,
  currentTime,
  onTimeUpdate,
  onDurationChange,
  onSeek,
  captionStyle,
  captionAnimation,
  animateByWord,
  fontFamily,
  fontSizePercent,
  captionY,
  onCaptionYChange,
  isDraggingY,
  onDraggingYChange,
}: VideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const dragStartRef = useRef<{ y: number; startCaptionY: number } | null>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video || !videoUrl) return
    const onLoadedMetadata = () => {
      onDurationChange(video.duration)
      setDimensions({ width: video.videoWidth, height: video.videoHeight })
    }
    const onTimeUpdateHandler = () => onTimeUpdate(video.currentTime)
    video.addEventListener('loadedmetadata', onLoadedMetadata)
    video.addEventListener('timeupdate', onTimeUpdateHandler)
    if (video.readyState >= 1) onLoadedMetadata()
    return () => {
      video.removeEventListener('loadedmetadata', onLoadedMetadata)
      video.removeEventListener('timeupdate', onTimeUpdateHandler)
    }
  }, [videoUrl, onDurationChange, onTimeUpdate])

  useEffect(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || !videoUrl) return
    const w = video.videoWidth || 1280
    const h = video.videoHeight || 720
    if (canvas.width !== w) canvas.width = w
    if (canvas.height !== h) canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const draw = () => {
      if (video.readyState < 2) return
      ctx.drawImage(video, 0, 0, w, h)
      if (segments && segments.length > 0) {
        drawCaption(ctx, w, h, segments, video.currentTime, captionStyle, {
          fontFamily,
          fontSizePercent,
          captionY,
          animation: captionAnimation,
          animateByWord,
        })
      }
      requestAnimationFrame(draw)
    }
    const raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [videoUrl, segments, captionStyle, captionAnimation, fontFamily, fontSizePercent, captionY])

  const handlePlayPause = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      video.play()
      setIsPlaying(true)
    } else {
      video.pause()
      setIsPlaying(false)
    }
  }, [])

  const handleSeek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const video = videoRef.current
      const container = containerRef.current
      if (!video || !container || !video.duration) return
      const rect = container.getBoundingClientRect()
      const x = e.clientX - rect.left
      const t = (x / rect.width) * video.duration
      video.currentTime = Math.max(0, Math.min(video.duration, t))
      onSeek(t)
    },
    [onSeek]
  )

  const handleProgressEnd = useCallback(() => setIsPlaying(false), [])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const onEnded = () => handleProgressEnd()
    video.addEventListener('ended', onEnded)
    return () => video.removeEventListener('ended', onEnded)
  }, [handleProgressEnd])

  const handlePointerDownY = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      dragStartRef.current = { y: e.clientY, startCaptionY: captionY }
      onDraggingYChange(true)
      ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    },
    [captionY, onDraggingYChange]
  )
  const handlePointerMoveY = useCallback(
    (e: React.PointerEvent) => {
      if (!dragStartRef.current) return
      const delta = e.clientY - dragStartRef.current.y
      const container = containerRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()
      const deltaNorm = delta / rect.height
      let next = dragStartRef.current.startCaptionY + deltaNorm
      next = Math.max(0.05, Math.min(0.95, next))
      onCaptionYChange(next)
    },
    [onCaptionYChange]
  )
  const handlePointerUpY = useCallback(() => {
    dragStartRef.current = null
    onDraggingYChange(false)
  }, [onDraggingYChange])

  if (!videoUrl) {
    return (
      <div className={styles.placeholder}>
        <p className={styles.placeholderText}>Drop a video here or click to upload</p>
        <p className={styles.placeholderHint}>Supports MP4, WebM, and other video formats</p>
      </div>
    )
  }

  const src = videoUrl

  return (
    <div className={styles.wrap} ref={containerRef}>
      <div className={styles.videoContainer}>
        <video
          ref={videoRef}
          src={src}
          className={styles.video}
          playsInline
          muted={false}
          onClick={handlePlayPause}
        />
        <canvas ref={canvasRef} className={styles.canvas} />
        {/* Invisible drag strip for caption Y position */}
        <div
          className={`${styles.captionYStrip} ${isDraggingY ? styles.captionYStripActive : ''}`}
          style={{ top: `${captionY * 100}%`, transform: 'translateY(-50%)' }}
          onPointerDown={handlePointerDownY}
          onPointerMove={handlePointerMoveY}
          onPointerUp={handlePointerUpY}
          onPointerLeave={handlePointerUpY}
          title="Drag to move captions vertically"
        >
          <span className={styles.captionYLabel}>Caption position</span>
        </div>
      </div>
      <div className={styles.controls}>
        <button type="button" className={styles.playBtn} onClick={handlePlayPause} aria-label={isPlaying ? 'Pause' : 'Play'}>
          {isPlaying ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M8 5v14l11-7z" /></svg>
          )}
        </button>
        <div className={styles.progressWrap} onClick={handleSeek} role="slider" aria-valuemin={0} aria-valuemax={100} aria-valuenow={((currentTime / (videoRef.current?.duration || 1)) * 100) || 0}>
          <div className={styles.progressTrack} />
          <div className={styles.progressFill} style={{ width: `${((currentTime / (videoRef.current?.duration || 1)) * 100) || 0}%` }} />
        </div>
        <span className={styles.timeLabel}>
          {formatTime(currentTime)} / {videoRef.current?.duration ? formatTime(videoRef.current.duration) : '0:00'}
        </span>
      </div>
    </div>
  )
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}
