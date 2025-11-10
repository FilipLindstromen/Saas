import React, { useEffect, useRef } from 'react'
import { QuizData } from '../types'

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
  const settings = quiz.settings!
  const numQuestions = quiz.questions.length
  
  // Title duration (if enabled)
  const titleDuration = (settings.showTitle ?? true) 
    ? (settings.titleInMs + settings.titleHoldMs + settings.titleOutMs)
    : 0
  
  // Per question duration
  const answersPerQuestion = 3
  const perQuestionDuration = settings.questionInMs + 
    (settings.answersStaggerMs * (answersPerQuestion - 1)) + 
    settings.correctRevealMs + 
    settings.questionHoldMs
  
  // Total duration
  const contentDuration = titleDuration + (perQuestionDuration * numQuestions)
  const endDelay = settings.endDelayMs ?? 1000
  const totalDuration = contentDuration + endDelay
  
  return totalDuration
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

  // Ensure video plays when isPlaying changes
  useEffect(() => {
    if (background.type === 'video' && videoRef.current) {
      if (isPlaying) {
        videoRef.current.play().catch(console.error)
      } else {
        videoRef.current.pause()
      }
    }
  }, [isPlaying, background.type])
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
            videoRef.current.play().catch(console.error)
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
          if (videoRef.current && isPlaying) {
            videoRef.current.play().catch(console.error)
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
