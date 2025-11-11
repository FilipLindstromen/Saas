import React, { useRef, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { QuizData, OverlayTextItem, OverlayAnimation } from '../types'
import { SingleQuestion } from './SingleQuestion'
import { CTAScreen } from './CTAScreen'
import { computeQuizTimeline } from '../utils/quizTiming'
import appearSfxUrl from '../../sfx/appear.wav'
import correctSfxUrl from '../../sfx/correct.wav'

const arraysEqual = (a: string[], b: string[]) => {
  if (a.length !== b.length) return false
  return a.every((value, index) => value === b[index])
}

const hexToRgba = (hex: string | undefined, alpha: number) => {
  const defaultHex = '#000000'
  let normalized = (hex || defaultHex).replace('#', '')
  if (normalized.length === 3) {
    normalized = normalized.split('').map(c => c + c).join('')
  }
  if (normalized.length !== 6) {
    normalized = defaultHex.replace('#', '')
  }
  const num = parseInt(normalized, 16)
  const r = (num >> 16) & 255
  const g = (num >> 8) & 255
  const b = num & 255
  const clampedAlpha = Math.min(Math.max(alpha, 0), 1)
  return `rgba(${r}, ${g}, ${b}, ${clampedAlpha})`
}

const initialStyles: Record<OverlayAnimation, any> = {
  none: { opacity: 1 },
  fade: { opacity: 0 },
  'slide-up': { opacity: 0, y: 40 },
  'slide-down': { opacity: 0, y: -40 },
  scale: { opacity: 0, scale: 0.9 }
}

const visibleStyles: Record<OverlayAnimation, any> = {
  none: { opacity: 1 },
  fade: { opacity: 1, y: 0 },
  'slide-up': { opacity: 1, y: 0 },
  'slide-down': { opacity: 1, y: 0 },
  scale: { opacity: 1, scale: 1 }
}

const exitStyles: Record<OverlayAnimation, any> = {
  none: { opacity: 0 },
  fade: { opacity: 0 },
  'slide-up': { opacity: 0, y: -40 },
  'slide-down': { opacity: 0, y: 40 },
  scale: { opacity: 0, scale: 0.9 }
}

const getOverlayMotionStyles = (item: OverlayTextItem) => {
  const animationIn: OverlayAnimation = item.animationIn ?? 'fade'
  const animationOut: OverlayAnimation = item.animationOut ?? animationIn
  const inDuration = Math.max((item.animationInDurationMs ?? 500) / 1000, 0.01)
  const outDuration = Math.max((item.animationOutDurationMs ?? 500) / 1000, 0.01)

  return {
    initial: initialStyles[animationIn] ?? initialStyles.fade,
    animate: {
      ...(visibleStyles[animationIn] ?? visibleStyles.fade),
      transition: { duration: inDuration, ease: 'easeOut' }
    },
    exit: {
      ...(exitStyles[animationOut] ?? exitStyles.fade),
      transition: { duration: outDuration, ease: 'easeIn' }
    }
  }
}

const buildOverlayStyle = (item: OverlayTextItem, quiz: QuizData): React.CSSProperties => {
  const padding = item.padding ?? 12
  const background = hexToRgba(item.backgroundColor ?? '#000000', item.backgroundOpacity ?? 0.7)
  const align = item.align ?? 'center'
  const vertical = item.verticalPosition ?? 'center'
  const style: React.CSSProperties = {
    position: 'absolute',
    maxWidth: '80%',
    fontFamily: item.fontFamily ?? quiz.settings?.fontFamily ?? 'Impact',
    fontSize: `${item.fontSizePercent ?? 4}vh`,
    color: item.textColor ?? '#ffffff',
    backgroundColor: background,
    padding: `${padding}px`,
    borderRadius: '8px',
    whiteSpace: 'pre-line',
    lineHeight: 1.3,
    textAlign: align,
    pointerEvents: 'none',
    zIndex: 40,
    boxShadow: '0 8px 20px rgba(0,0,0,0.35)',
    display: 'inline-block'
  }

  const transforms: string[] = []
  const horizontalMargin = '8%'
  if (align === 'left') {
    style.left = horizontalMargin
  } else if (align === 'right') {
    style.right = horizontalMargin
  } else {
    style.left = '50%'
    transforms.push('translateX(-50%)')
  }

  if (vertical === 'top') {
    style.top = '12%'
  } else if (vertical === 'bottom') {
    style.bottom = '12%'
  } else {
    style.top = '50%'
    transforms.push('translateY(-50%)')
  }

  if (transforms.length > 0) {
    style.transform = transforms.join(' ')
  }

  ;(style as any).WebkitBoxDecorationBreak = 'clone'
  ;(style as any).boxDecorationBreak = 'clone'

  return style
}

interface SequencePreviewProps {
  quiz: QuizData
  onFinished?: () => void
  isRecording?: boolean
  recordingTime?: number
  playSignal?: number
}

function useAudio() {
  const musicRef = useRef<HTMLAudioElement | null>(null)
  const appearRef = useRef<HTMLAudioElement | null>(null)
  const correctRef = useRef<HTMLAudioElement | null>(null)

  const appearUrl = appearSfxUrl
  const correctUrl = correctSfxUrl

  function playSound(ref: React.MutableRefObject<HTMLAudioElement | null>, vol: number) {
    const base = ref.current
    if (!base) return
    const clamp = Math.min(Math.max(vol, 0), 1)
    const canReuse = base.paused || base.ended
    const audio = canReuse ? base : (base.cloneNode(true) as HTMLAudioElement)
    audio.volume = clamp
    audio.currentTime = 0
    void audio.play().catch((error) => {
      if (error instanceof Error && error.name === 'NotAllowedError') return
      console.warn('SFX play failed:', error)
    })
  }

  function playAppear(vol: number) { playSound(appearRef, vol) }
  function playCorrect(vol: number) { playSound(correctRef, vol) }

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
              fontFamily: settings?.fontFamily ?? 'Impact',
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
            fontFamily: settings?.fontFamily ?? 'Impact',
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

export function SequencePreview({ quiz, onFinished, isRecording = false, recordingTime = 0, playSignal }: SequencePreviewProps) {
  const settings = quiz.settings!
  const { musicRef, appearRef, correctRef, appearUrl, correctUrl, playAppear, playCorrect } = useAudio()
  const musicStartedRef = useRef(false)
  const [stage, setStage] = useState<'title' | 'question' | 'cta'>('title')
  const [qIndex, setQIndex] = useState(0)
  const [currentQuestionStartTime, setCurrentQuestionStartTime] = useState(0)
  const timeline = useMemo(() => computeQuizTimeline(quiz), [quiz])
  const titleDuration = timeline.showTitle ? timeline.titleDuration : 0
  const totalQuestionDuration = timeline.totalQuestionDuration
  const questionTimings = timeline.questionTimings
  const ctaStartTime = timeline.totalContentDuration
  const overlaySettings = quiz.settings?.overlay
  const overlayItems = useMemo(() => overlaySettings?.items ?? [], [overlaySettings])
  const overlayEnabled = Boolean(overlaySettings?.enabled && overlayItems.length > 0)
  const overlayScheduleKey = useMemo(
    () =>
      overlayItems
        .map(item =>
          [
            item.id,
            item.startOffsetMs,
            item.displayDurationMs,
            item.animationInDurationMs,
            item.animationOutDurationMs
          ].join(':')
        )
        .join('|'),
    [overlayItems]
  )
  const [previewVisibleOverlayIds, setPreviewVisibleOverlayIds] = useState<string[]>([])
  const [recordingVisibleOverlayIds, setRecordingVisibleOverlayIds] = useState<string[]>([])
  const overlayTotalDuration = useMemo(() => {
    if (!overlayEnabled) return 0
    return overlayItems.reduce((max, item) => {
      const start = Number(item.startOffsetMs ?? 0)
      const inMs = Number(item.animationInDurationMs ?? 500)
      const holdMs = Number(item.displayDurationMs ?? 2000)
      const outMs = Number(item.animationOutDurationMs ?? 500)
      return Math.max(max, start + inMs + holdMs + outMs)
    }, 0)
  }, [overlayEnabled, overlayItems])

  const applyMusicOffset = React.useCallback((media?: HTMLMediaElement | null) => {
    if (!media) return
    const desired = Math.max(0, settings.music?.startOffsetSeconds ?? 0)
    const duration = media.duration
    const clamped = Number.isFinite(duration) && duration > 0
      ? Math.min(Math.max(0, desired), Math.max(0, duration - 0.05))
      : desired
    if (!Number.isNaN(clamped)) {
      try {
        media.currentTime = clamped
      } catch (error) {
        console.warn('Failed to set music offset:', error)
      }
    }
  }, [settings.music?.startOffsetSeconds])

  // Single music play effect - handles all music playback
  React.useEffect(() => {
    if (!musicRef.current || !settings.music?.url) return
    if (isRecording) return

    const media = musicRef.current as HTMLMediaElement

    const playMusic = async () => {
      try {
        media.pause()
        media.currentTime = 0
        applyMusicOffset(media)
        const desiredVolume = Math.min(Math.max(settings.music?.volume ?? 0.6, 0), 1)
        media.volume = desiredVolume

        if (!musicStartedRef.current || media.ended) {
          musicStartedRef.current = true
          await media.play()
          console.log('Music started playing:', settings.music!.url)
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return
          console.log('Music play failed:', error)
      }
    }

    const timer = window.setTimeout(playMusic, 150)

    return () => {
      window.clearTimeout(timer)
    }
  }, [settings.music?.url, playSignal, isRecording, applyMusicOffset])

  // Reset music started flag when URL changes or preview restarts
  React.useEffect(() => {
    musicStartedRef.current = false
  }, [settings.music?.url, playSignal])

  React.useEffect(() => {
    applyMusicOffset(musicRef.current)
  }, [applyMusicOffset, musicRef])

  React.useEffect(() => {
    setPreviewVisibleOverlayIds([])
    if (isRecording || !overlayEnabled) {
      return
    }
    const timers: NodeJS.Timeout[] = []
    overlayItems.forEach(item => {
      const start = Math.max(0, item.startOffsetMs ?? 0)
      const inDuration = item.animationInDurationMs ?? 500
      const holdDuration = item.displayDurationMs ?? 2000
      const outDuration = item.animationOutDurationMs ?? 500
      const totalVisible = inDuration + holdDuration + outDuration
      timers.push(
        setTimeout(() => {
          setPreviewVisibleOverlayIds(ids => [...ids, item.id])
          timers.push(
            setTimeout(() => {
              setPreviewVisibleOverlayIds(ids => ids.filter(id => id !== item.id))
            }, totalVisible)
          )
        }, start)
      )
    })
    return () => {
      timers.forEach(clearTimeout)
      setPreviewVisibleOverlayIds([])
    }
  }, [isRecording, overlayEnabled, overlayScheduleKey])

  React.useEffect(() => {
    if (!isRecording || !overlayEnabled) {
      setRecordingVisibleOverlayIds([])
      return
    }
    const now = recordingTime
    const ids = overlayItems
      .filter(item => {
        const start = item.startOffsetMs ?? 0
        const inDuration = item.animationInDurationMs ?? 500
        const holdDuration = item.displayDurationMs ?? 2000
        const outDuration = item.animationOutDurationMs ?? 500
        const total = start + inDuration + holdDuration + outDuration
        return now >= start && now <= total
      })
      .map(item => item.id)
    setRecordingVisibleOverlayIds(prev => (arraysEqual(prev, ids) ? prev : ids))
  }, [isRecording, recordingTime, overlayEnabled, overlayScheduleKey])

  React.useEffect(() => {
    if (!overlayEnabled) {
      setPreviewVisibleOverlayIds([])
      setRecordingVisibleOverlayIds([])
    }
  }, [overlayEnabled])

  const activeOverlayIds = isRecording ? recordingVisibleOverlayIds : previewVisibleOverlayIds
  const overlaysToRender = overlayEnabled
    ? overlayItems.filter(item => activeOverlayIds.includes(item.id))
    : []

  React.useEffect(() => {
    if (settings.animationType !== 'overlay') return
    if (isRecording) return
    if (!overlayEnabled || overlayTotalDuration <= 0) return
    if (!onFinished) return
    const timer = setTimeout(() => onFinished(), overlayTotalDuration)
    return () => clearTimeout(timer)
  }, [settings.animationType, overlayEnabled, overlayTotalDuration, isRecording, onFinished, overlayScheduleKey])

  React.useEffect(() => {
    if (settings.animationType !== 'overlay') return
    if (isRecording) return
    if (overlayEnabled) return
    onFinished?.()
  }, [settings.animationType, overlayEnabled, isRecording, onFinished])


  // During recording, calculate stage and question index based on recording time
  React.useEffect(() => {
    if (!isRecording) return
    if (settings.animationType === 'overlay') return

    if (timeline.showTitle && recordingTime < titleDuration) {
      setStage('title')
      setQIndex(0)
      setCurrentQuestionStartTime(0)
      return
    }

    const adjustedTime = recordingTime - titleDuration

    if (questionTimings.length === 0 || adjustedTime < 0) {
      if (settings.cta?.enabled) {
        setStage('cta')
      } else {
        setStage('question')
      }
      return
    }

    if (adjustedTime >= totalQuestionDuration) {
      if (settings.cta?.enabled) {
        setStage('cta')
      } else {
        setStage('question')
        const lastTiming = questionTimings[questionTimings.length - 1]
        setQIndex(Math.max(questionTimings.length - 1, 0))
        setCurrentQuestionStartTime(titleDuration + lastTiming.start)
      }
      return
    }

    setStage('question')
    let currentIdx = questionTimings.length - 1
    for (let i = questionTimings.length - 1; i >= 0; i--) {
      if (adjustedTime >= questionTimings[i].start) {
        currentIdx = i
        break
      }
    }
    setQIndex(currentIdx)
    setCurrentQuestionStartTime(titleDuration + questionTimings[currentIdx].start)
  }, [isRecording, recordingTime, settings.cta?.enabled, questionTimings, titleDuration, totalQuestionDuration, timeline.showTitle])

  // Reset stage and question index when not recording
  React.useEffect(() => {
    if (!isRecording) {
      if (settings.animationType === 'overlay') {
        setStage('question')
        setQIndex(0)
        setCurrentQuestionStartTime(0)
        return
      }
      if (timeline.showTitle) {
        setStage('title')
        setCurrentQuestionStartTime(0)
      } else if (quiz.questions.length > 0) {
        setStage('question')
        setCurrentQuestionStartTime(0)
      } else if (settings.cta?.enabled) {
        setStage('cta')
      } else {
        setStage('question')
      }
      setQIndex(0)
    }
  }, [isRecording, timeline.showTitle, quiz.questions.length, settings.cta?.enabled, settings.animationType])

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
    <div className="relative z-10 w-full h-full flex items-center justify-center">
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
            applyMusicOffset(musicRef.current as any)
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
            applyMusicOffset(musicRef.current as any)
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
              applyMusicOffset(musicRef.current)
              // Volume and play logic is handled in the main useEffect
            }}
            onError={(e) => {
              console.log('Music load error:', e)
              console.log('Music URL:', settings.music?.url)
              console.log('Error details:', e.currentTarget.error)
            }}
            onCanPlay={() => {
              console.log('Music can play:', settings.music?.url)
              applyMusicOffset(musicRef.current)
              // Play logic is handled in the main useEffect
            }}
          />
        )
      )}
      <audio ref={appearRef} src={appearUrl} preload="auto" />
      <audio ref={correctRef} src={correctUrl} preload="auto" />

      {settings.animationType === 'overlay' ? (
        overlayEnabled && (
          <AnimatePresence>
            {overlaysToRender.map(item => {
              const motionStyles = getOverlayMotionStyles(item)
              const overlayStyle = buildOverlayStyle(item, quiz)
              return (
                <motion.div
                  key={item.id}
                  initial={motionStyles.initial}
                  animate={motionStyles.animate}
                  exit={motionStyles.exit}
                  style={overlayStyle}
                >
                  {item.text.split('\n').map((line, idx) => (
                    <div key={idx}>{line}</div>
                  ))}
                </motion.div>
              )
            })}
          </AnimatePresence>
        )
      ) : (
        <>
          <AnimatePresence mode="wait">
            {stage === 'title' && timeline.showTitle && (
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
              onQuestionAppear={() => playAppear(settings.sfx.appearVolume)}
              onAnswerAppear={() => playAppear(settings.sfx.appearVolume)}
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
              recordingTime={isRecording ? Math.max(0, recordingTime - ctaStartTime) : 0}
            />
          )}

          {overlayEnabled && (
            <AnimatePresence>
              {overlaysToRender.map(item => {
                const motionStyles = getOverlayMotionStyles(item)
                const overlayStyle = buildOverlayStyle(item, quiz)
                return (
                  <motion.div
                    key={item.id}
                    initial={motionStyles.initial}
                    animate={motionStyles.animate}
                    exit={motionStyles.exit}
                    style={overlayStyle}
                  >
                    {item.text.split('\n').map((line, idx) => (
                      <div key={idx}>{line}</div>
                    ))}
                  </motion.div>
                )
              })}
            </AnimatePresence>
          )}
        </>
      )}
    </div>
  )
}
