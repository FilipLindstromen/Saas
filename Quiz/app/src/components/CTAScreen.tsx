import React, { useEffect, useRef, useState } from 'react'
import { QuizData } from '../types'
import { BackgroundRenderer } from './BackgroundRenderer'

interface CTAScreenProps {
  quiz: QuizData
  onFinished?: () => void
  isRecording?: boolean
  recordingTime?: number
}

export function CTAScreen({ 
  quiz, 
  onFinished, 
  isRecording = false, 
  recordingTime = 0 
}: CTAScreenProps) {
  const timeoutRef = useRef<NodeJS.Timeout>()
  const [showText, setShowText] = useState(false)
  const cta = quiz.settings?.cta

  // Calculate CTA opacity based on time (for fade in/out)
  const getCTAOpacity = (): number => {
    if (!isRecording) return 1 // During preview, use CSS transitions
    
    const fadeInMs = cta?.fadeInMs ?? 600
    const holdMs = cta?.holdMs ?? 1800
    const fadeOutMs = cta?.fadeOutMs ?? 600
    
    if (recordingTime < fadeInMs) {
      return recordingTime / fadeInMs
    } else if (recordingTime < fadeInMs + holdMs) {
      return 1
    } else {
      const fadeOutElapsed = recordingTime - (fadeInMs + holdMs)
      if (fadeOutElapsed > fadeOutMs) return 0
      return 1 - (fadeOutElapsed / fadeOutMs)
    }
  }

  // Animation logic for text appearance
  useEffect(() => {
    if (isRecording) {
      // During recording, calculate when to show text based on recording time
      const fadeInMs = cta?.fadeInMs ?? 600
      setShowText(recordingTime >= fadeInMs)
    } else {
      // During preview, animate text with timing
      const fadeInMs = cta?.fadeInMs ?? 600
      
      // Show text after fade in delay
      const textTimer = setTimeout(() => {
        setShowText(true)
      }, fadeInMs)
      
      return () => {
        clearTimeout(textTimer)
      }
    }
  }, [isRecording, recordingTime, cta?.fadeInMs])

  // Auto-finish after duration
  useEffect(() => {
    if (!isRecording && onFinished) {
      const duration = cta?.durationMs ?? 3000
      timeoutRef.current = setTimeout(() => {
        onFinished()
      }, duration)
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [onFinished, cta?.durationMs, isRecording])

  // Determine background to use
  const getCTABackground = () => {
    if (!cta?.enabled) return quiz.background

    if (cta.useSameBackground) {
      return quiz.background
    }

    if (cta.backgroundType === 'image' && cta.imageUrl) {
      return {
        type: 'image' as const,
        imageUrl: cta.imageUrl
      }
    }

    if (cta.backgroundType === 'video' && cta.backgroundVideoUrl) {
      return {
        type: 'video' as const,
        videoUrl: cta.backgroundVideoUrl
      }
    }

    return quiz.background
  }

  const ctaBackground = getCTABackground()

  // Calculate text size based on container width
  const getTextSize = () => {
    const sizePercent = cta?.textSizePercent ?? 8
    // Assume container is similar to quiz preview dimensions
    const baseWidth = 400 // Approximate container width
    return `${(baseWidth * sizePercent) / 100}px`
  }

  // Get shadow style
  const getShadowStyle = () => {
    if (!cta?.textShadowEnabled) return {}
    return {
      textShadow: `2px 2px 4px ${cta.textShadowColor || '#000000'}, -2px -2px 4px ${cta.textShadowColor || '#000000'}, 2px -2px 4px ${cta.textShadowColor || '#000000'}, -2px 2px 4px ${cta.textShadowColor || '#000000'}`
    }
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center">
      {/* Background */}
      <BackgroundRenderer
        background={ctaBackground}
        zoom={quiz.settings?.bgZoomEnabled ? (quiz.settings?.bgZoomScale ?? 1.1) : 1}
        isPlaying={true}
        playKey={0}
        quiz={quiz}
      />
      
      {/* Video Overlay */}
      {cta?.overlayEnabled && (
        <div 
          className="absolute inset-0 pointer-events-none" 
          style={{ 
            background: cta.overlayColor || '#000000', 
            opacity: isRecording 
              ? getCTAOpacity() * (cta.overlayOpacity || 0.4)
              : cta.overlayOpacity || 0.4,
            transition: isRecording ? 'none' : 'opacity 0.6s ease-in-out'
          }}
        />
      )}
      
      {/* CTA Content */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center p-8">
        <div 
          className={`${!isRecording && 'transition-opacity duration-600'} ${!isRecording && (showText ? 'opacity-100' : 'opacity-0')}`}
          style={{
            fontSize: getTextSize(),
            color: cta?.textColor || '#ffffff',
            fontFamily: cta?.fontFamily || quiz.settings?.fontFamily || 'Impact',
            fontWeight: (cta?.fontFamily || quiz.settings?.fontFamily || 'Impact') === 'Impact' ? 'normal' : 'bold',
            opacity: isRecording ? getCTAOpacity() : undefined,
            ...getShadowStyle()
          }}
        >
          {(cta?.text || 'Thank You!').split('\n').map((line, index) => (
            <div key={index}>{line}</div>
          ))}
        </div>
        
        {/* Optional: Show duration remaining in preview mode */}
        {!isRecording && cta?.durationMs && (
          <div className="mt-6 text-sm text-gray-300">
            Auto-advancing in {Math.ceil((cta.durationMs) / 1000)}s
          </div>
        )}
      </div>
    </div>
  )
}
