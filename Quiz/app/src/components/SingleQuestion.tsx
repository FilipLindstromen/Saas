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
  onAppear?: () => void
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
  onAppear, 
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

  // Calculate timing for recording
  useEffect(() => {
    if (!isRecording) return

    const elapsed = recordingTime - questionStartTime
    const questionInMs = settings!.questionInMs
    const answersStaggerMs = settings!.answersStaggerMs
    const correctRevealMs = settings!.correctRevealMs
    const questionHoldMs = settings!.questionHoldMs

    // Show answers after question appears + stagger delay
    if (elapsed >= questionInMs + answersStaggerMs && !showAnswers) {
      setShowAnswers(true)
      onAppear?.()
    }

    // Show correct answer after all answers are shown + correct reveal timing
    const answersPerQuestion = 3
    const allAnswersShownTime = questionInMs + answersStaggerMs + (answersStaggerMs * (answersPerQuestion - 1))
    const correctRevealTime = allAnswersShownTime + correctRevealMs
    if (elapsed >= correctRevealTime && !showCorrect) {
      setShowCorrect(true)
      onCorrect?.()
    }

    // Fade out for last question - start fade 1 second before question ends
    const questionDuration = questionInMs + 
      (answersStaggerMs * (answersPerQuestion - 1)) + 
      correctRevealMs + 
      questionHoldMs
    const fadeOutStartTime = questionDuration - 1000 // Start fade 1 second before end
    
    if (isLastQuestion && elapsed >= fadeOutStartTime) {
      setFadeOut(true)
    }
  }, [recordingTime, questionStartTime, isRecording, showAnswers, showCorrect, settings, onAppear, onCorrect, isLastQuestion])

  // Reset states when not recording
  useEffect(() => {
    if (!isRecording) {
      setShowAnswers(false)
      setShowCorrect(false)
      setFadeOut(false)
    }
  }, [isRecording])

  // For normal playback (not recording), use CSS animations
  if (!isRecording) {
    // Set up timer for correct reveal in normal playback
    React.useEffect(() => {
      if (!isRecording) {
        // Calculate correct reveal timing to match recording - after all answers are shown
        const answersPerQuestion = 3
        const allAnswersShownTime = settings!.questionInMs + settings!.answersStaggerMs + (settings!.answersStaggerMs * (answersPerQuestion - 1))
        const correctRevealTimer = setTimeout(() => {
          setShowCorrect(true)
          onCorrect?.()
        }, allAnswersShownTime + settings!.correctRevealMs)

        // Set up timer for question completion
        const questionDuration = settings!.questionInMs + 
          (settings!.answersStaggerMs * (answersPerQuestion - 1)) + 
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
        transition={{ duration: settings!.questionInMs / 1000 }}
        onAnimationStart={onAppear}
        className="absolute inset-0 flex items-center justify-center p-6"
        style={{ opacity: fadeOut ? 0 : 1 }}
      >
        <div className="text-center w-full" style={{ maxWidth: '90%', margin: '0 auto' }}>
          {/* Question */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            style={{ marginBottom: '6vh' }}
          >
            <h2 
              className={`font-bold ${settings?.questionShadowEnabled ? 'drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]' : ''}`}
              style={{ 
                color: settings!.questionColor, 
                whiteSpace: 'pre-line',
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
            transition={{ duration: 0.3, delay: (settings!.questionInMs + settings!.answersStaggerMs) / 1000 }}
            style={{ display: 'flex', flexDirection: 'column', gap: '2vh' }}
          >
            {question.answers.map((answer, idx) => (
              <motion.div
                key={answer.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ 
                  duration: 0.3, 
                  delay: (settings!.questionInMs / 1000) + (settings!.answersStaggerMs / 1000) + (idx * settings!.answersStaggerMs / 1000)
                }}
                className="flex items-center justify-center"
              >
                <div 
                  className={`rounded-full font-semibold transition-all duration-300 ${
                    showCorrect && answer.isCorrect
                      ? 'bg-green-500 text-white'
                      : 'bg-white text-gray-900 hover:bg-gray-100'
                  }`}
                  style={{ 
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
  const questionInMs = settings!.questionInMs
  const answersStaggerMs = settings!.answersStaggerMs
  const correctRevealMs = settings!.correctRevealMs

  const questionOpacity = Math.min(elapsed / questionInMs, 1)
  const answersOpacity = elapsed >= questionInMs + answersStaggerMs ? 1 : 0

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
            transform: `translateY(${(1 - questionOpacity) * 20}px)`,
            transition: 'none',
            marginBottom: '6vh'
          }}
        >
          <h2 
            className={`font-bold ${settings?.questionShadowEnabled ? 'drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]' : ''}`}
            style={{ 
              color: settings!.questionColor, 
              whiteSpace: 'pre-line',
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
            const answerOpacity = Math.max(0, Math.min(answerElapsed / 300, 1))
            const isCorrectRevealed = elapsed >= questionInMs + answersStaggerMs + correctRevealMs

            return (
              <div
                key={answer.id}
                style={{
                  opacity: answerOpacity,
                  transform: `translateY(${(1 - answerOpacity) * 20}px)`,
                  transition: 'none'
                }}
                className="flex items-center justify-center"
              >
                <div 
                  className={`rounded-full font-semibold transition-all duration-300 ${
                    isCorrectRevealed && answer.isCorrect
                      ? 'bg-green-500 text-white'
                      : 'bg-white text-gray-900'
                  }`}
                  style={{ 
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
