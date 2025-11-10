import React, { useRef, useEffect, useState } from 'react'
import { MemeData, QuizSettings } from '../types'
import { BackgroundRenderer } from './BackgroundRenderer'
import { CTAScreen } from './CTAScreen'

interface MemePreviewProps {
  meme: MemeData
  quizSettings: QuizSettings
  quizBackground: any
  isRecording?: boolean
  recordingTime?: number
}

export function MemePreview({ meme, quizSettings, quizBackground, isRecording = false, recordingTime = 0 }: MemePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const settings = meme.settings!
  const musicRef = useRef<HTMLAudioElement | null>(null)
  const [showTopText, setShowTopText] = useState(false)
  const [showBottomText, setShowBottomText] = useState(false)
  const [showCTA, setShowCTA] = useState(false)

  // Play music if available
  useEffect(() => {
    if (musicRef.current && quizSettings.music?.url) {
      musicRef.current.volume = quizSettings.music.volume
      musicRef.current.play().catch(console.log)
    }
  }, [quizSettings.music?.url])

  // Calculate text opacity based on time (for fade in/out)
  const getTextOpacity = (startTime: number, fadeInMs: number, fadeOutStartTime: number, fadeOutMs: number): number => {
    if (!isRecording) return 1 // During preview, use CSS transitions
    
    const elapsed = recordingTime - startTime
    if (elapsed < 0) return 0
    if (elapsed < fadeInMs) return elapsed / fadeInMs
    
    // Check if we're in fade out phase
    if (recordingTime >= fadeOutStartTime) {
      const fadeOutElapsed = recordingTime - fadeOutStartTime
      if (fadeOutElapsed > fadeOutMs) return 0
      return 1 - (fadeOutElapsed / fadeOutMs)
    }
    
    return 1 // Fully visible during hold phase
  }

  // Animation logic for text appearance
  useEffect(() => {
    if (isRecording) {
      // During recording, calculate when to show text based on recording time
      const topTextDelay = settings.topTextInMs || 500
      const bottomTextDelay = topTextDelay + (settings.bottomTextInMs || 500)
      const topTextHoldMs = settings.topTextHoldMs || 3000
      const bottomTextHoldMs = settings.bottomTextHoldMs || 3000
      const topTextFadeOutMs = settings.topTextFadeOutMs || 500
      const bottomTextFadeOutMs = settings.bottomTextFadeOutMs || 500
      
      // Calculate fade out times
      const topTextFadeOutStartTime = topTextDelay + topTextHoldMs
      const bottomTextFadeOutStartTime = bottomTextDelay + bottomTextHoldMs
      
      setShowTopText(recordingTime >= topTextDelay && recordingTime < topTextFadeOutStartTime + topTextFadeOutMs)
      setShowBottomText(recordingTime >= bottomTextDelay && recordingTime < bottomTextFadeOutStartTime + bottomTextFadeOutMs)
    } else {
      // During preview, animate text with timing
      const topTextInMs = settings.topTextInMs || 500
      const bottomTextInMs = settings.bottomTextInMs || 500
      const topTextHoldMs = settings.topTextHoldMs || 3000
      const bottomTextHoldMs = settings.bottomTextHoldMs || 3000
      const topTextFadeOutMs = settings.topTextFadeOutMs || 500
      const bottomTextFadeOutMs = settings.bottomTextFadeOutMs || 500
      
      const bottomTextDelay = topTextInMs + bottomTextInMs
      
      // Calculate when each text should fade out
      const topTextFadeOutStartTime = topTextInMs + topTextHoldMs
      const bottomTextFadeOutStartTime = bottomTextDelay + bottomTextHoldMs
      
      // Calculate total meme duration (when both texts are completely gone)
      const memeContentDuration = Math.max(
        topTextFadeOutStartTime + topTextFadeOutMs,
        bottomTextFadeOutStartTime + bottomTextFadeOutMs
      )
      
      // Show top text after delay
      const topTimer = setTimeout(() => {
        setShowTopText(true)
      }, topTextInMs)
      
      // Show bottom text after delay
      const bottomTimer = setTimeout(() => {
        setShowBottomText(true)
      }, bottomTextDelay)
      
      // Hide top text after its fade out
      const hideTopTimer = setTimeout(() => {
        setShowTopText(false)
      }, topTextFadeOutStartTime + topTextFadeOutMs)
      
      // Hide bottom text after its fade out
      const hideBottomTimer = setTimeout(() => {
        setShowBottomText(false)
      }, bottomTextFadeOutStartTime + bottomTextFadeOutMs)
      
      // Show CTA after meme completion if enabled
      const ctaTimer = setTimeout(() => {
        if (quizSettings.cta?.enabled) {
          setShowCTA(true)
        }
      }, memeContentDuration)
      
      return () => {
        clearTimeout(topTimer)
        clearTimeout(bottomTimer)
        clearTimeout(hideTopTimer)
        clearTimeout(hideBottomTimer)
        clearTimeout(ctaTimer)
      }
    }
  }, [isRecording, recordingTime, settings.topTextInMs, settings.bottomTextInMs, settings.topTextHoldMs, settings.bottomTextHoldMs, settings.topTextFadeOutMs, settings.bottomTextFadeOutMs, quizSettings.cta?.enabled])

  // Reset animation when settings change
  useEffect(() => {
    if (!isRecording) {
      setShowTopText(false)
      setShowBottomText(false)
    }
  }, [settings.topTextInMs, settings.bottomTextInMs, settings.holdMs, settings.textFadeOutMs, isRecording])

  const aspectStyle = (ar: string) => {
    const map: Record<string, string> = { '1:1': '1 / 1', '3:4': '3 / 4', '9:16': '9 / 16' }
    return { aspectRatio: map[ar] || '9 / 16' }
  }

  const getTextSize = (sizePercent: number) => {
    if (!containerRef.current) return '2rem'
    const containerWidth = containerRef.current.offsetWidth
    return `${(containerWidth * sizePercent) / 100}px`
  }

  const getShadowStyle = (enabled: boolean, color: string) => {
    if (!enabled) return {}
    return {
      textShadow: `2px 2px 4px ${color}, -2px -2px 4px ${color}, 2px -2px 4px ${color}, -2px 2px 4px ${color}`
    }
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <div
        ref={containerRef}
        className="relative overflow-hidden bg-black rounded-lg"
        style={aspectStyle(quizSettings.aspectRatio)}
      >
        {/* Background */}
        <BackgroundRenderer
          background={quizBackground}
          zoom={quizSettings.bgZoomEnabled ? (quizSettings.bgZoomScale ?? 1.1) : 1}
          isPlaying={false}
          playKey={0}
          quiz={{
            title: '',
            background: quizBackground,
            questions: [],
            settings: quizSettings
          }}
        />

        {/* Overlay - Must be BELOW text */}
        {settings.overlayColor && settings.overlayOpacity && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundColor: settings.overlayColor,
              opacity: settings.overlayOpacity
            }}
          />
        )}

        {/* Top Text */}
        {settings.showTopText && meme.topText && showTopText && (
          <div
            className="absolute left-4 right-4 text-center"
            style={{
              top: `${settings.topTextDistanceFromTop || 5}%`,
              fontSize: getTextSize(settings.topTextSizePercent || 8),
              color: settings.topTextColor,
              fontWeight: (quizSettings.fontFamily || 'Impact') === 'Impact' ? 'normal' : 'bold',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              fontFamily: quizSettings.fontFamily || 'Impact',
              opacity: isRecording 
                ? getTextOpacity(
                    settings.topTextInMs || 500,
                    settings.topTextInMs || 500,
                    (settings.topTextInMs || 500) + (settings.topTextHoldMs || 3000),
                    settings.topTextFadeOutMs || 500
                  )
                : 1,
              transition: isRecording ? 'none' : 'opacity 0.5s ease-in-out',
              ...getShadowStyle(settings.topTextShadowEnabled || false, settings.topTextShadowColor || '#000000')
            }}
          >
            {settings.textBackgroundEnabled && (
              <div
                className="absolute inset-0 rounded-lg"
                style={{
                  backgroundColor: settings.textBackgroundColor || '#000000',
                  opacity: 0.7,
                  zIndex: -1
                }}
              />
            )}
            {meme.topText.split('\n').map((line, index) => (
              <div key={index}>{line}</div>
            ))}
          </div>
        )}

        {/* Bottom Text */}
        {settings.showBottomText && meme.bottomText && showBottomText && (
          <div
            className="absolute left-4 right-4 text-center"
            style={{
              bottom: `${settings.bottomTextDistanceFromBottom || 5}%`,
              fontSize: getTextSize(settings.bottomTextSizePercent || 8),
              color: settings.bottomTextColor,
              fontWeight: (quizSettings.fontFamily || 'Impact') === 'Impact' ? 'normal' : 'bold',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              fontFamily: quizSettings.fontFamily || 'Impact',
              opacity: isRecording 
                ? getTextOpacity(
                    (settings.topTextInMs || 500) + (settings.bottomTextInMs || 500),
                    settings.bottomTextInMs || 500,
                    (settings.topTextInMs || 500) + (settings.bottomTextInMs || 500) + (settings.bottomTextHoldMs || 3000),
                    settings.bottomTextFadeOutMs || 500
                  )
                : 1,
              transition: isRecording ? 'none' : 'opacity 0.5s ease-in-out',
              ...getShadowStyle(settings.bottomTextShadowEnabled || false, settings.bottomTextShadowColor || '#000000')
            }}
          >
            {settings.textBackgroundEnabled && (
              <div
                className="absolute inset-0 rounded-lg"
                style={{
                  backgroundColor: settings.textBackgroundColor || '#000000',
                  opacity: 0.7,
                  zIndex: -1
                }}
              />
            )}
            {meme.bottomText.split('\n').map((line, index) => (
              <div key={index}>{line}</div>
            ))}
          </div>
        )}

        {/* Music element (hidden) */}
        {quizSettings.music?.url && (
          <audio
            ref={musicRef}
            src={quizSettings.music.url}
            controls={false}
            loop={false}
            preload="auto"
            crossOrigin="anonymous"
          />
        )}
      </div>

      {/* CTA Screen */}
      {showCTA && quizSettings.cta?.enabled && (
        <CTAScreen
          quiz={{
            title: 'Meme',
            background: quizBackground,
            questions: [],
            settings: quizSettings
          }}
          isRecording={isRecording}
          recordingTime={recordingTime}
        />
      )}
    </div>
  )
}


