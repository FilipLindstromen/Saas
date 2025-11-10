import React, { useEffect, useRef, useCallback } from 'react'
import { QuizData } from '../types'
import { computeQuizTimeline } from '../utils/quizTiming'

interface BackgroundRendererProps {
  background: QuizData['background']
  zoom?: number
  isPlaying?: boolean
  playKey?: number
  isRecording?: boolean
  recordingTime?: number
  quiz: QuizData
}

function computeExactDuration(quiz: QuizData): number {
  const timeline = computeQuizTimeline(quiz)
  return timeline.totalContentDuration + timeline.endDelay
}

export function BackgroundRenderer({ 
  background, 
  zoom = 1, 
  isPlaying = false, 
  playKey = 0, 
  isRecording = false, 
  recordingTime = 0, 
  quiz 
}: BackgroundRendererProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  const applyVideoOffset = useCallback(
    (media?: HTMLVideoElement | null, options: { resume?: boolean } = {}) => {
      if (!media) return

      const desired = Math.max(0, background.type === 'video' ? background.videoStartOffsetSeconds ?? 0 : 0)

      const seekToOffset = () => {
        const duration = media.duration
        const clamped = Number.isFinite(duration) && duration > 0
          ? Math.min(Math.max(0, desired), Math.max(0, duration - 0.05))
          : desired

        if (Number.isNaN(clamped)) return

        const shouldResume = options.resume && isPlaying

        if (Math.abs(media.currentTime - clamped) < 0.01) {
          if (shouldResume) {
            media.play().catch(console.error)
          }
          return
        }

        try {
          media.currentTime = clamped
        } catch (error) {
          console.warn('Failed to set background video offset:', error)
          return
        }

        if (shouldResume) {
          const resumePlayback = () => {
            media.play().catch(console.error)
            media.removeEventListener('seeked', resumePlayback)
          }
          media.addEventListener('seeked', resumePlayback, { once: true })
        }
      }

      if (media.readyState >= 1) {
        seekToOffset()
      } else {
        const handleLoaded = () => {
          seekToOffset()
          media.removeEventListener('loadeddata', handleLoaded)
          media.removeEventListener('loadedmetadata', handleLoaded)
        }
        media.addEventListener('loadeddata', handleLoaded)
        media.addEventListener('loadedmetadata', handleLoaded)
      }
    },
    [background, isPlaying]
  )

  // Ensure video plays when isPlaying changes
  useEffect(() => {
    if (background.type === 'video' && videoRef.current) {
      if (isPlaying) {
        applyVideoOffset(videoRef.current, { resume: true })
      } else {
        videoRef.current.pause()
      }
    }
  }, [isPlaying, background.type, applyVideoOffset])

  useEffect(() => {
    if (background.type === 'video' && videoRef.current) {
      applyVideoOffset(videoRef.current, { resume: isPlaying })
    }
  }, [background.type, background.videoStartOffsetSeconds, background.videoUrl, playKey, isPlaying, applyVideoOffset])
  if (background.type === 'color') {
    return <div className="absolute inset-0" style={{ background: background.color ?? '#000' }} />
  }
  
  if (background.type === 'image') {
    // Calculate zoom progress for recording
    const getZoomProgress = () => {
      if (!isRecording || zoom <= 1) return 1
      const totalDuration = computeExactDuration(quiz)
      const progress = Math.min(recordingTime / totalDuration, 1)
      return 1 + (progress * (zoom - 1))
    }

    const zoomScale = getZoomProgress()

    return (
      <div className="absolute inset-0 overflow-hidden">
        <div 
          key={`bg-zoom-${playKey}`}
          className="absolute inset-0 will-change-transform" 
          style={{ 
            backgroundImage: `url(${background.imageUrl})`, 
            backgroundSize: 'cover', 
            backgroundPosition: 'center', 
            transform: `scale(${zoomScale})`,
            transition: isRecording ? 'none' : undefined
          }} 
        />
        {/* Background color overlay */}
        <div 
          className="absolute inset-0 pointer-events-none" 
          style={{ 
            background: quiz.settings?.bgOverlayColor ?? 'transparent', 
            opacity: quiz.settings?.bgOverlayOpacity ?? 0 
          }}
        />
      </div>
    )
  }
  
  // Calculate zoom progress for video recording
  const getVideoZoomProgress = () => {
    if (!isRecording || zoom <= 1) return 1
    const totalDuration = computeExactDuration(quiz)
    const progress = Math.min(recordingTime / totalDuration, 1)
    return 1 + (progress * (zoom - 1))
  }

  const videoZoomScale = getVideoZoomProgress()

  return (
    <div className="absolute inset-0 overflow-hidden">
      <video 
        ref={videoRef}
        key={`bg-zoom-${playKey}`}
        className="absolute inset-0 w-full h-full object-cover will-change-transform" 
        style={{ 
          transform: `scale(${videoZoomScale})`,
          transition: isRecording ? 'none' : undefined
        }} 
        autoPlay 
        loop
        muted 
        playsInline 
        preload="auto"
        crossOrigin="anonymous"
        src={background.videoUrl}
        onLoadedData={() => {
          // Ensure video plays when loaded
          if (videoRef.current) {
            applyVideoOffset(videoRef.current, { resume: isPlaying })
          }
        }}
        onError={(e) => {
          console.error('Video background error:', e)
          // Try without CORS if it fails
          if (videoRef.current && videoRef.current.crossOrigin) {
            videoRef.current.crossOrigin = null
            videoRef.current.load()
          }
        }}
        onCanPlay={() => {
          // Ensure video plays when it can play
          if (videoRef.current) {
            applyVideoOffset(videoRef.current, { resume: isPlaying })
          }
        }}
        onEnded={() => {
          if (videoRef.current) {
            applyVideoOffset(videoRef.current, { resume: isPlaying })
          }
        }}
      />
      {/* Background color overlay */}
      <div 
        className="absolute inset-0 pointer-events-none" 
        style={{ 
          background: quiz.settings?.bgOverlayColor ?? 'transparent', 
          opacity: quiz.settings?.bgOverlayOpacity ?? 0 
        }}
      />
    </div>
  )
}
