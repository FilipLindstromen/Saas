import React, { useRef, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { QuizData } from '../types'
import { SingleQuestion } from './SingleQuestion'
import { CTAScreen } from './CTAScreen'

interface SequencePreviewProps {
  quiz: QuizData
  onFinished?: () => void
  isRecording?: boolean
  recordingTime?: number
}

function useAudio(quiz: QuizData, playKey: number) {
  const musicRef = useRef<HTMLAudioElement | null>(null)
  const appearRef = useRef<HTMLAudioElement | null>(null)
  const correctRef = useRef<HTMLAudioElement | null>(null)

  // Generate simple sfx using WebAudio osc if no files; else use small embedded beeps
  const appearUrl = useMemo(() => {
    // tiny beep wav (data URL)
    return 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABYAAAAAAAB/////'
  }, [])
  const correctUrl = useMemo(() => {
    return 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABYAAAAAAAB/////'
  }, [])

  function playAppear(vol: number) { if (appearRef.current) { appearRef.current.volume = vol; appearRef.current.currentTime = 0; appearRef.current.play() } }
  function playCorrect(vol: number) { if (correctRef.current) { correctRef.current.volume = vol; correctRef.current.currentTime = 0; correctRef.current.play() } }

  return { musicRef, appearRef, correctRef, appearUrl, correctUrl, playAppear, playCorrect }
}

function TitleScreen({ 
  title, 
  settings, 
  onAppear, 
  onDone, 
  isRecording = false, 
  recordingTime = 0 
}: { 
  title: string
  settings: QuizData['settings']
  onAppear: () => void
  onDone: () => void
  isRecording?: boolean
  recordingTime?: number
}) {
  const [hasAppeared, setHasAppeared] = useState(false)
  const [hasFinished, setHasFinished] = useState(false)

  // Time-based animation control
  React.useEffect(() => {
    if (!isRecording) return

    const titleInMs = settings!.titleInMs
    const titleHoldMs = settings!.titleHoldMs
    const titleOutMs = settings!.titleOutMs

    if (recordingTime >= 0 && recordingTime < titleInMs && !hasAppeared) {
      setHasAppeared(true)
      onAppear()
    }

    if (recordingTime >= titleInMs + titleHoldMs && !hasFinished) {
      setHasFinished(true)
      onDone()
    }
  }, [recordingTime, isRecording, hasAppeared, hasFinished, settings, onAppear, onDone])

  // Reset states when not recording
  React.useEffect(() => {
    if (!isRecording) {
      setHasAppeared(false)
      setHasFinished(false)
    }
  }, [isRecording])

  // Calculate animation progress for recording
  const getAnimationProgress = () => {
    if (!isRecording) return 1

    const titleInMs = settings!.titleInMs
    const titleHoldMs = settings!.titleHoldMs
    const titleOutMs = settings!.titleOutMs

    if (recordingTime < titleInMs) {
      // Fade in
      return Math.min(recordingTime / titleInMs, 1)
    } else if (recordingTime < titleInMs + titleHoldMs) {
      // Hold
      return 1
    } else if (recordingTime < titleInMs + titleHoldMs + titleOutMs) {
      // Fade out
      const fadeOutProgress = (recordingTime - titleInMs - titleHoldMs) / titleOutMs
      return Math.max(1 - fadeOutProgress, 0)
    } else {
      // Finished
      return 0
    }
  }

  // For normal playback (not recording), use CSS animations
  if (!isRecording) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20, transition: { duration: settings!.titleOutMs / 1000 } }}
        transition={{ duration: settings!.titleInMs / 1000 }}
        onAnimationStart={onAppear}
        onAnimationComplete={() => { setTimeout(onDone, settings!.titleHoldMs) }}
        className="absolute inset-0 flex items-center justify-center"
      >
        <div className="text-center" style={{ padding: '0 3vw' }}>
          <div 
            className={`font-semibold ${settings?.titleShadowEnabled ? 'drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]' : ''}`}
            style={{ 
              color: settings!.questionColor, 
              whiteSpace: 'pre-line', 
              textShadow: settings?.titleShadowEnabled && settings?.titleShadowColor ? `0 1px 1px ${settings.titleShadowColor}` : undefined,
              fontSize: `${settings?.titleSizePercent ?? 6.0}vh`, // User-controlled percentage of viewport height
              lineHeight: '1.2'
            }}
          >
            {title}
          </div>
        </div>
      </motion.div>
    )
  }

  // For recording, use time-based animation
  const progress = getAnimationProgress()
  const yOffset = (1 - progress) * 20 // 20px movement

  return (
    <div 
      className="absolute inset-0 flex items-center justify-center"
      style={{
        opacity: progress,
        transform: `translateY(${yOffset}px)`
      }}
    >
      <div className="text-center" style={{ padding: '0 3vw' }}>
        <div 
          className={`font-semibold ${settings?.titleShadowEnabled ? 'drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]' : ''}`}
          style={{ 
            color: settings!.questionColor, 
            whiteSpace: 'pre-line', 
            textShadow: settings?.titleShadowEnabled && settings?.titleShadowColor ? `0 1px 1px ${settings.titleShadowColor}` : undefined,
            fontSize: `${settings?.titleSizePercent ?? 6.0}vh`, // User-controlled percentage of viewport height
            lineHeight: '1.2'
          }}
        >
          {title}
        </div>
      </div>
    </div>
  )
}

export function SequencePreview({ quiz, onFinished, isRecording = false, recordingTime = 0 }: SequencePreviewProps) {
  const [playKey, setPlayKey] = useState(0)
  const settings = quiz.settings!
  const { musicRef, appearRef, correctRef, appearUrl, correctUrl, playAppear, playCorrect } = useAudio(quiz, playKey)
  const musicStartedRef = useRef(false)
  const [stage, setStage] = useState<'title' | 'question' | 'cta'>('title')
  const [qIndex, setQIndex] = useState(0)
  const [currentQuestionStartTime, setCurrentQuestionStartTime] = useState(0)

  // Single music play effect - handles all music playback
  React.useEffect(() => {
    if (!musicRef.current || !settings.music?.url) return

    const playMusic = async () => {
      try {
        // Set volume first
        musicRef.current!.volume = settings.music!.volume
        
        // Only play if we haven't started music yet or if it's a new URL
        if (!musicStartedRef.current || musicRef.current!.ended) {
          musicRef.current!.currentTime = 0
          musicStartedRef.current = true
          
          await musicRef.current!.play()
          console.log('Music started playing:', settings.music!.url)
        }
      } catch (error) {
        // Only log non-AbortError issues
        if (error instanceof Error && error.name !== 'AbortError') {
          console.log('Music play failed:', error)
        }
      }
    }

    // Small delay to ensure audio element is ready
    const timer = setTimeout(playMusic, 300)
    
    return () => clearTimeout(timer)
  }, [settings.music?.url]) // Only depend on URL changes

  // Reset music started flag when URL changes
  React.useEffect(() => {
    musicStartedRef.current = false
  }, [settings.music?.url])


  // Calculate timing for questions
  const titleDuration = (settings.showTitle ?? true) 
    ? (settings.titleInMs + settings.titleHoldMs + settings.titleOutMs)
    : 0

  const answersPerQuestion = 3
  const perQuestionDuration = settings.questionInMs + 
    (settings.answersStaggerMs * (answersPerQuestion - 1)) + 
    settings.correctRevealMs + 
    settings.questionHoldMs

  // During recording, calculate stage and question index based on recording time
  React.useEffect(() => {
    if (!isRecording) return

    if (recordingTime < titleDuration) {
      setStage('title')
      setQIndex(0)
    } else {
      setStage('question')
      const questionTime = recordingTime - titleDuration
      const currentQuestionIndex = Math.floor(questionTime / perQuestionDuration)
      const clampedIndex = Math.min(currentQuestionIndex, quiz.questions.length - 1)
      setQIndex(clampedIndex)
      
      // Calculate when current question started
      const questionStartTime = titleDuration + (clampedIndex * perQuestionDuration)
      setCurrentQuestionStartTime(questionStartTime)
    }
  }, [recordingTime, isRecording, settings, quiz.questions.length, titleDuration, perQuestionDuration])

  // Reset stage and question index when not recording
  React.useEffect(() => {
    if (!isRecording) {
      setStage((settings.showTitle ?? true) ? 'title' : 'question')
      setQIndex(0)
      setCurrentQuestionStartTime(0)
    }
  }, [isRecording, settings.showTitle])

  // Stop music/SFX on unmount
  React.useEffect(() => () => {
    ;[musicRef.current, appearRef.current, correctRef.current].forEach(a => { if (a) { a.pause(); a.currentTime = 0 } })
  }, [])

  // Handle question progression for normal playback
  const handleQuestionComplete = () => {
    if (qIndex < quiz.questions.length - 1) {
      setQIndex(qIndex + 1)
    } else {
      // Check if CTA is enabled
      if (settings.cta?.enabled) {
        setStage('cta')
      } else {
        onFinished?.()
      }
    }
  }

  return (
    <div key={playKey} className="relative z-10 w-full h-full flex items-center justify-center">
      {/* Music */}
      {settings.music?.url && (
        settings.music.url.includes('pixabay') ? (
          // For Pixabay video URLs, use a video element to extract audio
          <video 
            ref={musicRef as any} 
            src={settings.music.url} 
            autoPlay 
            controls={false} 
            loop={false} 
            preload="auto"
            crossOrigin="anonymous"
            muted={false}
            style={{ display: 'none' }}
          onLoadedData={() => { 
            console.log('Music loaded successfully:', settings.music?.url)
            // Volume is set in the main useEffect, no need to play here
          }}
          onError={(e) => {
            console.log('Music load error:', e)
            console.log('Music URL:', settings.music?.url)
            console.log('Error details:', e.currentTarget.error)
            
            // If it's a video URL that failed, try to handle it differently
            if (settings.music?.url && settings.music.url.includes('pixabay')) {
              console.log('Pixabay video URL failed, this might be expected for video URLs in audio elements')
            }
          }}
          onCanPlay={() => {
            console.log('Music can play:', settings.music?.url)
            // Play logic is handled in the main useEffect
          }}
          />
        ) : (
          // For regular audio URLs, use audio element
          <audio 
            ref={musicRef} 
            src={settings.music.url} 
            controls={false} 
            loop={false} 
            preload="auto"
            crossOrigin="anonymous"
            onLoadedData={() => { 
              console.log('Music loaded successfully:', settings.music?.url)
              // Volume and play logic is handled in the main useEffect
            }}
            onError={(e) => {
              console.log('Music load error:', e)
              console.log('Music URL:', settings.music?.url)
              console.log('Error details:', e.currentTarget.error)
            }}
            onCanPlay={() => {
              console.log('Music can play:', settings.music?.url)
              // Play logic is handled in the main useEffect
            }}
          />
        )
      )}
      <audio ref={appearRef} src={appearUrl} />
      <audio ref={correctRef} src={correctUrl} />

      <AnimatePresence mode="wait">
        {stage === 'title' && (settings.showTitle ?? true) && (
          <TitleScreen 
            key="title" 
            title={quiz.title} 
            settings={settings} 
            onAppear={() => playAppear(settings.sfx.appearVolume)} 
            onDone={() => setStage('question')}
            isRecording={isRecording}
            recordingTime={recordingTime}
          />
        )}
      </AnimatePresence>

      {stage === 'question' && quiz.questions[qIndex] && (
        <SingleQuestion
          key={`question-${qIndex}`}
          question={quiz.questions[qIndex]}
          settings={settings}
          onAppear={() => playAppear(settings.sfx.appearVolume)}
          onCorrect={() => playCorrect(settings.sfx.correctVolume)}
          onComplete={handleQuestionComplete}
          isRecording={isRecording}
          recordingTime={recordingTime}
          questionStartTime={currentQuestionStartTime}
          isLastQuestion={qIndex === quiz.questions.length - 1}
        />
      )}

      {stage === 'cta' && (
        <CTAScreen
          quiz={quiz}
          onFinished={onFinished}
          isRecording={isRecording}
          recordingTime={recordingTime}
        />
      )}
    </div>
  )
}
