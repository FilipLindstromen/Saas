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
  const fadeInMs = cta?.fadeInMs ?? 600
  const holdMs = cta?.holdMs ?? 1800
  const baseDuration = fadeInMs + holdMs
  const totalDuration = Math.max(cta?.durationMs ?? baseDuration, baseDuration)
  const hasCustomImage = Boolean(cta?.backgroundType === 'image' && cta?.imageUrl)
  const hasCustomVideo = Boolean(cta?.backgroundType === 'video' && cta?.backgroundVideoUrl)
  const useCustomBackground = Boolean(cta?.enabled && cta?.useSameBackground === false && (hasCustomImage || hasCustomVideo))

  // Calculate CTA opacity based on time (for fade in/out)
  const getCTAOpacity = (): number => {
    if (!isRecording) return 1 // During preview, use CSS transitions
    
    if (recordingTime < fadeInMs) {
      return fadeInMs > 0 ? recordingTime / fadeInMs : 1
    }
    if (recordingTime < totalDuration) {
      return 1
    }
    return 0
  }

  // Animation logic for text appearance
  useEffect(() => {
    if (isRecording) {
      // During recording, calculate when to show text based on recording time
      setShowText(recordingTime >= fadeInMs && recordingTime < totalDuration)
    } else {
      // During preview, animate text with timing
      setShowText(false)
      // Show text after fade in delay
      const textTimer = setTimeout(() => {
        setShowText(true)
      }, fadeInMs)
      const hideTimer = setTimeout(() => {
        setShowText(false)
      }, totalDuration)
      
      return () => {
        clearTimeout(textTimer)
        clearTimeout(hideTimer)
      }
    }
  }, [isRecording, recordingTime, fadeInMs, totalDuration])

  // Auto-finish after duration
  useEffect(() => {
    if (!isRecording && onFinished) {
      timeoutRef.current = setTimeout(() => {
        onFinished()
      }, totalDuration)
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [onFinished, totalDuration, isRecording])

  // Determine background to use
  const getCTABackground = () => {
    if (!useCustomBackground) return null

    if (hasCustomImage) {
      return {
        type: 'image' as const,
        imageUrl: cta!.imageUrl!
      }
    }

    if (hasCustomVideo) {
      return {
        type: 'video' as const,
        videoUrl: cta!.backgroundVideoUrl!
      }
    }

    return null
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
      {useCustomBackground && ctaBackground && (
        <BackgroundRenderer
          background={ctaBackground}
          zoom={quiz.settings?.bgZoomEnabled ? (quiz.settings?.bgZoomScale ?? 1.1) : 1}
          isPlaying={!isRecording}
          playKey={0}
          quiz={quiz}
        />
      )}
      
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
