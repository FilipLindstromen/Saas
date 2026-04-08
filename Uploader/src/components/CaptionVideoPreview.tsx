import { useRef, useEffect, useCallback, useState } from 'react'
import type { CaptionSegment, CaptionStyle, CaptionAnimation } from '../types'
import { drawCaption } from '../utils/captionRenderer'
import styles from './CaptionVideoPreview.module.css'

interface CaptionVideoPreviewProps {
  videoUrl: string
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

function formatTime(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export function CaptionVideoPreview({
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
}: CaptionVideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const dragStartRef = useRef<{ y: number; startCaptionY: number } | null>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video || !videoUrl) return
    const onLoaded = () => onDurationChange(video.duration)
    const onTime = () => onTimeUpdate(video.currentTime)
    video.addEventListener('loadedmetadata', onLoaded)
    video.addEventListener('timeupdate', onTime)
    if (video.readyState >= 1) onLoaded()
    return () => {
      video.removeEventListener('loadedmetadata', onLoaded)
      video.removeEventListener('timeupdate', onTime)
    }
  }, [videoUrl, onDurationChange, onTimeUpdate])

  useEffect(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || !videoUrl) return
    const w = video.videoWidth || 1280
    const h = video.videoHeight || 720
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let rafId = 0
    const draw = () => {
      if (video.readyState >= 2) {
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
      }
      rafId = requestAnimationFrame(draw)
    }
    rafId = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafId)
  }, [videoUrl, segments, captionStyle, captionAnimation, fontFamily, fontSizePercent, captionY, animateByWord])

  const handlePlayPause = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) { video.play(); setIsPlaying(true) }
    else { video.pause(); setIsPlaying(false) }
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const onEnded = () => setIsPlaying(false)
    video.addEventListener('ended', onEnded)
    return () => video.removeEventListener('ended', onEnded)
  }, [])

  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const video = videoRef.current
      const container = e.currentTarget
      if (!video || !video.duration) return
      const rect = container.getBoundingClientRect()
      const t = ((e.clientX - rect.left) / rect.width) * video.duration
      video.currentTime = Math.max(0, Math.min(video.duration, t))
      onSeek(t)
    },
    [onSeek]
  )

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
      const next = Math.max(0.05, Math.min(0.95, dragStartRef.current.startCaptionY + delta / rect.height))
      onCaptionYChange(next)
    },
    [onCaptionYChange]
  )
  const handlePointerUpY = useCallback(() => {
    dragStartRef.current = null
    onDraggingYChange(false)
  }, [onDraggingYChange])

  const progress = videoRef.current?.duration
    ? (currentTime / videoRef.current.duration) * 100
    : 0

  return (
    <div className={styles.wrap} ref={containerRef}>
      <div className={styles.videoContainer}>
        <video
          ref={videoRef}
          src={videoUrl}
          className={styles.video}
          playsInline
          onClick={handlePlayPause}
        />
        <canvas ref={canvasRef} className={styles.canvas} />
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
        <button className={styles.playBtn} onClick={handlePlayPause} aria-label={isPlaying ? 'Pause' : 'Play'}>
          {isPlaying ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          )}
        </button>
        <div className={styles.progressWrap} onClick={handleProgressClick}>
          <div className={styles.progressFill} style={{ width: `${progress}%` }} />
        </div>
        <span className={styles.timeLabel}>
          {formatTime(currentTime)} / {videoRef.current?.duration ? formatTime(videoRef.current.duration) : '0:00'}
        </span>
      </div>
    </div>
  )
}
