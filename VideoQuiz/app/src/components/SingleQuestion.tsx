import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { QuizQuestion, QuizData, AnswerFormat } from '../types'

// Helper function to format answer labels
function formatAnswerLabel(index: number, format: AnswerFormat = 'letters'): string {
  switch (format) {
    case 'letters':
      return String.fromCharCode(65 + index) + ')'
    case 'numbers':
      return `${index + 1})`
    case 'steps':
      return `Step ${index + 1}:`
    default:
      return String.fromCharCode(65 + index) + ')'
  }
}

interface SingleQuestionProps {
  question: QuizQuestion
  settings: QuizData['settings']
  onQuestionAppear?: () => void
  onAnswerAppear?: () => void
  onCorrect?: () => void
  onComplete?: () => void
  isRecording?: boolean
  recordingTime?: number
  questionStartTime?: number
  isLastQuestion?: boolean
}

export function SingleQuestion({ 
  question, 
  settings, 
  onQuestionAppear, 
  onAnswerAppear,
  onCorrect, 
  onComplete,
  isRecording = false, 
  recordingTime = 0, 
  questionStartTime = 0,
  isLastQuestion = false 
}: SingleQuestionProps) {
  const [showAnswers, setShowAnswers] = useState(false)
  const [showCorrect, setShowCorrect] = useState(false)
  const [fadeOut, setFadeOut] = useState(false)
  const correctButtonColor = settings?.correctAnswerButtonColor ?? settings?.correctAnswerColor ?? '#10b981'
  const correctTextColor = settings?.correctAnswerTextColor ?? '#ffffff'
  const defaultAnswerTextColor = settings?.answerColor ?? '#111113'
  const defaultAnswerBackground = '#ffffff'
  const [questionSoundPlayed, setQuestionSoundPlayed] = useState(false)
  const [answersSoundPlayedCount, setAnswersSoundPlayedCount] = useState(0)
  const questionInMs = Math.max(0, settings!.questionInMs)
  const answersStaggerMs = settings!.answersStaggerMs
  const correctRevealMs = settings!.correctRevealMs
  const questionHoldMs = settings!.questionHoldMs

  // Calculate timing for recording
  useEffect(() => {
    if (!isRecording) return

    const elapsed = recordingTime - questionStartTime

    // Show answers after question appears + stagger delay
    if (elapsed >= questionInMs + answersStaggerMs && !showAnswers) {
      setShowAnswers(true)
    }

    // Show correct answer after all answers are shown + correct reveal timing
    const answersPerQuestion = Math.max(question.answers.length, 1)
    const allAnswersShownTime = questionInMs + answersStaggerMs + (answersStaggerMs * (answersPerQuestion - 1))
    const correctRevealTime = allAnswersShownTime + correctRevealMs
    if (elapsed >= correctRevealTime && !showCorrect) {
      setShowCorrect(true)
      onCorrect?.()
    }

    // Fade out for last question - start fade 1 second before question ends
    const questionDuration = questionInMs +
      (answersStaggerMs * answersPerQuestion) +
      correctRevealMs + 
      questionHoldMs
    const fadeOutStartTime = questionDuration - 1000 // Start fade 1 second before end
    
    if (isLastQuestion && elapsed >= fadeOutStartTime) {
      setFadeOut(true)
    }
  }, [recordingTime, questionStartTime, isRecording, showAnswers, showCorrect, settings, questionInMs, answersStaggerMs, correctRevealMs, questionHoldMs, onCorrect, isLastQuestion])

  useEffect(() => {
    if (!isRecording) return

    const elapsed = recordingTime - questionStartTime

    if (!questionSoundPlayed && elapsed >= 0) {
      setQuestionSoundPlayed(true)
      onQuestionAppear?.()
    }

    let nextCount = answersSoundPlayedCount
    for (let idx = answersSoundPlayedCount; idx < question.answers.length; idx++) {
      const answerStartTime = questionInMs + answersStaggerMs + (idx * answersStaggerMs)
      if (elapsed >= answerStartTime) {
        onAnswerAppear?.()
        nextCount = idx + 1
      } else {
        break
      }
    }

    if (nextCount !== answersSoundPlayedCount) {
      setAnswersSoundPlayedCount(nextCount)
    }
  }, [
    isRecording,
    recordingTime,
    questionStartTime,
    questionSoundPlayed,
    answersSoundPlayedCount,
    question.answers.length,
    questionInMs,
    answersStaggerMs,
    onQuestionAppear,
    onAnswerAppear
  ])

  // Reset states when not recording
  useEffect(() => {
    if (!isRecording) {
      setShowAnswers(false)
      setShowCorrect(false)
      setFadeOut(false)
      setQuestionSoundPlayed(false)
      setAnswersSoundPlayedCount(0)
    }
  }, [isRecording])

  // For normal playback (not recording), use CSS animations
  if (!isRecording) {
    // Set up timer for correct reveal in normal playback
    React.useEffect(() => {
      if (!isRecording) {
        // Calculate correct reveal timing to match recording - after all answers are shown
        const answersPerQuestion = Math.max(question.answers.length, 1)
        const allAnswersShownTime = settings!.questionInMs + settings!.answersStaggerMs + (settings!.answersStaggerMs * (answersPerQuestion - 1))
        const correctRevealTimer = setTimeout(() => {
          setShowCorrect(true)
          onCorrect?.()
        }, allAnswersShownTime + settings!.correctRevealMs)

        // Set up timer for question completion
        const questionDuration = settings!.questionInMs +
          (settings!.answersStaggerMs * answersPerQuestion) +
          settings!.correctRevealMs + 
          settings!.questionHoldMs

        // Set up fade-out timer for last question
        const fadeOutStartTime = questionDuration - 1000 // Start fade 1 second before end
        const fadeOutTimer = isLastQuestion ? setTimeout(() => {
          setFadeOut(true)
        }, fadeOutStartTime) : null

        const completionTimer = setTimeout(() => {
          onComplete?.()
        }, questionDuration)

        return () => {
          clearTimeout(correctRevealTimer)
          clearTimeout(completionTimer)
          if (fadeOutTimer) clearTimeout(fadeOutTimer)
        }
      }
    }, [isRecording, settings, onCorrect, onComplete])

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
          transition={{ duration: Math.max(settings!.questionInMs, 0) / 1000 }}
        onAnimationStart={onQuestionAppear}
        className="absolute inset-0 flex items-center justify-center p-6"
        style={{ opacity: fadeOut ? 0 : 1, transition: fadeOut ? 'opacity 1s ease-out' : undefined }}
      >
        <div className="text-center w-full" style={{ maxWidth: '90%', margin: '0 auto' }}>
          {/* Question */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: Math.max(settings!.questionInMs, 0) / 1000 }}
            style={{ marginBottom: '6vh', opacity: fadeOut ? 0 : 1, transition: fadeOut ? 'opacity 1s ease-out' : undefined }}
          >
            <h2 
              className={`font-bold ${settings?.questionShadowEnabled ? 'drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]' : ''}`}
              style={{ 
                color: settings!.questionColor, 
                whiteSpace: 'pre-line',
                fontFamily: settings?.fontFamily ?? 'Impact',
                textShadow: settings?.questionShadowEnabled && settings?.questionShadowColor ? `0 1px 1px ${settings.questionShadowColor}` : undefined,
                lineHeight: '1.2',
                fontSize: `${settings?.questionSizePercent ?? 4.5}vh`, // User-controlled percentage of viewport height
                marginBottom: '6vh'
              }}
            >
              {question.title}
            </h2>
          </motion.div>

          {/* Answers - Show immediately for normal playback */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: Math.max(settings!.questionInMs, 0) / 1000 }}
            style={{ display: 'flex', flexDirection: 'column', gap: '2vh', opacity: fadeOut ? 0 : 1, transition: fadeOut ? 'opacity 1s ease-out' : undefined }}
          >
            {question.answers.map((answer, idx) => (
              <motion.div
                key={answer.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ 
                  duration: Math.max(settings!.questionInMs, 0) / 1000,
                  delay: (settings!.questionInMs / 1000) + (idx * settings!.answersStaggerMs / 1000)
                }}
                className="flex items-center justify-center"
                onAnimationStart={onAnswerAppear}
              >
                <div 
                  className="rounded-full font-semibold transition-all duration-300"
                  style={{ 
                    backgroundColor: showCorrect && answer.isCorrect ? correctButtonColor : defaultAnswerBackground,
                    color: showCorrect && answer.isCorrect ? correctTextColor : defaultAnswerTextColor,
                    fontFamily: settings?.fontFamily ?? 'Impact',
                    whiteSpace: 'pre-line',
                    width: `${settings?.answerWidthPercent ?? 50}%`, // Direct percentage setting
                    height: '7.5vh', // Percentage of viewport height
                    fontSize: `${settings?.answerSizePercent ?? 2.2}vh`, // User-controlled percentage of viewport height
                    padding: '0 8%', // Percentage of pill width
                    textAlign: 'left',
                    lineHeight: '1.4',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  {formatAnswerLabel(idx, settings?.answerFormat)} {answer.text}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </motion.div>
    )
  }

  // For recording, use time-based animation
  const elapsed = recordingTime - questionStartTime
  const answersPerQuestion = question.answers.length
const totalAnswersStagger = answersStaggerMs * answersPerQuestion
const questionDuration = questionInMs + totalAnswersStagger + correctRevealMs + questionHoldMs
const correctRevealStart = questionInMs + totalAnswersStagger + correctRevealMs
const fadeOutStartMs = Math.max(questionDuration - 1000, 0)
  const fadeElapsed = fadeOut ? Math.max(0, elapsed - fadeOutStartMs) : 0
  const fadeMultiplier = fadeOut ? Math.max(0, 1 - Math.min(fadeElapsed / 1000, 1)) : 1

const ease = (t: number) => 1 - Math.pow(1 - Math.min(Math.max(t, 0), 1), 3)
const questionEase = questionInMs > 0 ? ease(Math.min(elapsed / questionInMs, 1)) : 1
const questionOpacity = questionEase * fadeMultiplier
const answersReady = elapsed >= questionInMs + answersStaggerMs
const answersOpacity = (answersReady ? 1 : 0) * fadeMultiplier

  return (
    <div 
      className="absolute inset-0 flex items-center justify-center p-6"
      style={{ 
        opacity: fadeOut ? 0 : 1,
        transition: fadeOut ? 'opacity 1s ease-out' : 'none'
      }}
    >
      <div className="text-center w-full" style={{ maxWidth: '90%', margin: '0 auto' }}>
        {/* Question */}
        <div
          style={{
            opacity: questionOpacity,
            transform: `translateY(${(1 - questionEase) * 20}px)`,
            transition: 'none',
            marginBottom: '6vh'
          }}
        >
          <h2 
            className={`font-bold ${settings?.questionShadowEnabled ? 'drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]' : ''}`}
            style={{ 
              color: settings!.questionColor, 
              whiteSpace: 'pre-line',
              fontFamily: settings?.fontFamily ?? 'Impact',
              textShadow: settings?.questionShadowEnabled && settings?.questionShadowColor ? `0 1px 1px ${settings.questionShadowColor}` : undefined,
              lineHeight: '1.2',
              fontSize: `${settings?.questionSizePercent ?? 4.5}vh`, // User-controlled percentage of viewport height
              marginBottom: '6vh'
            }}
          >
            {question.title}
          </h2>
        </div>

        {/* Answers */}
        <div
          style={{
            opacity: answersOpacity,
            transition: 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: '2vh'
          }}
        >
          {question.answers.map((answer, idx) => {
            const answerStartTime = questionInMs + answersStaggerMs + (idx * answersStaggerMs)
            const answerElapsed = elapsed - answerStartTime
            const baseFadeDuration = Math.max(questionInMs, 1)
            const answerProgress = questionInMs > 0 ? ease(Math.min(answerElapsed / baseFadeDuration, 1)) : answerElapsed >= 0 ? 1 : 0
            const clampedProgress = Math.max(0, Math.min(answerProgress, 1))
            const answerOpacity = clampedProgress * fadeMultiplier
            const isCorrectRevealed = elapsed >= correctRevealStart

            return (
              <div
                key={answer.id}
                style={{
                  opacity: answerOpacity,
                  transform: `translateY(${(1 - clampedProgress) * 20}px)`,
                  transition: 'none'
                }}
                className="flex items-center justify-center"
              >
                <div 
                  className="rounded-full font-semibold transition-all duration-300"
                  style={{ 
                    backgroundColor: isCorrectRevealed && answer.isCorrect ? correctButtonColor : defaultAnswerBackground,
                    color: isCorrectRevealed && answer.isCorrect ? correctTextColor : defaultAnswerTextColor,
                    fontFamily: settings?.fontFamily ?? 'Impact',
                    whiteSpace: 'pre-line',
                    width: `${settings?.answerWidthPercent ?? 50}%`, // Direct percentage setting
                    height: '7.5vh', // Percentage of viewport height
                    fontSize: `${settings?.answerSizePercent ?? 2.2}vh`, // User-controlled percentage of viewport height
                    padding: '0 8%', // Percentage of pill width
                    textAlign: 'left',
                    lineHeight: '1.4',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  {formatAnswerLabel(idx, settings?.answerFormat)} {answer.text}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
