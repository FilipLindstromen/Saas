import { useEffect, useState } from 'react'
import { QuizData, QuizQuestion, QuizAnswer, QuizBackground, QuizSettings, OverlayTextItem } from './types'

export function useQuizState(initial?: Partial<QuizData>) {
  // defaults
  const defaultSettings: QuizSettings = {
    aspectRatio: '9:16',
    animationType: 'quiz',
    showTitle: true,
    titleInMs: 600,
    titleHoldMs: 900,
    titleOutMs: 600,
    questionInMs: 500,
    questionHoldMs: 1200,
    answersStaggerMs: 180,
    correctRevealMs: 900,
    questionColor: '#ffffff',
    answerColor: '#111113',
    correctAnswerColor: '#10b981',
    correctAnswerButtonColor: '#10b981',
    correctAnswerTextColor: '#ffffff',
    overlayColor: '#000000',
    overlayOpacity: 0.4,
    bgZoomEnabled: false,
    bgZoomScale: 1.1,
    bgZoomDurationMs: 6000,
    fontFamily: 'Impact',
    music: undefined,
    sfx: { appearVolume: 0.6, correctVolume: 0.8 },
    overlay: {
      enabled: false,
      items: []
    },
    cta: {
      enabled: false,
      durationMs: 3000,
      useSameBackground: true,
      backgroundVideoUrl: undefined,
      backgroundType: 'video',
      showText: true,
      text: 'Thank You!',
      textSizePercent: 8,
      textColor: '#ffffff',
      textShadowEnabled: true,
      textShadowColor: '#000000',
      imageUrl: undefined,
      fontFamily: 'Impact',
      fadeInMs: 600,
      holdMs: 1800,
      fadeOutMs: 0,
      overlayEnabled: false,
      overlayColor: '#000000',
      overlayOpacity: 0.4
    }
  }

  function loadStoredSettings(): QuizSettings | null {
    try {
      const raw = localStorage.getItem('quiz_settings')
      if (!raw) return null
      const parsed = JSON.parse(raw) as Partial<QuizSettings>
      const merged: QuizSettings = { 
        ...defaultSettings, 
        ...parsed, 
        sfx: { ...defaultSettings.sfx, ...(parsed.sfx || {}) }, 
        music: parsed.music ? { ...parsed.music } : undefined,
        cta: { ...defaultSettings.cta, ...(parsed.cta || {}) }
      }
      if (parsed.correctAnswerButtonColor === undefined && parsed.correctAnswerColor) {
        merged.correctAnswerButtonColor = parsed.correctAnswerColor
      }
      if (parsed.correctAnswerTextColor === undefined) {
        merged.correctAnswerTextColor = merged.correctAnswerTextColor ?? '#ffffff'
      }
      if (merged.music) {
        merged.music.startOffsetSeconds = merged.music.startOffsetSeconds ?? 0
      }
      merged.bgZoomEnabled = merged.bgZoomEnabled ?? defaultSettings.bgZoomEnabled
      merged.bgZoomScale = merged.bgZoomScale ?? defaultSettings.bgZoomScale
      merged.bgZoomDurationMs = merged.bgZoomDurationMs ?? defaultSettings.bgZoomDurationMs
      if (merged.cta) {
        merged.cta.fontFamily = merged.cta.fontFamily ?? defaultSettings.cta?.fontFamily
        merged.cta.imageUrl = merged.cta.imageUrl ?? defaultSettings.cta?.imageUrl
        merged.cta.backgroundType = merged.cta.backgroundType ?? defaultSettings.cta?.backgroundType ?? 'video'
      }
      if (parsed.overlay || defaultSettings.overlay) {
        const createOverlayId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2))
        const sourceItems = parsed.overlay?.items ?? defaultSettings.overlay?.items ?? []
        merged.overlay = {
          enabled: parsed.overlay?.enabled ?? defaultSettings.overlay?.enabled ?? false,
          items: sourceItems.map(item => ({
            id: item.id ?? createOverlayId(),
            text: item.text ?? '',
            fontFamily: item.fontFamily ?? defaultSettings.fontFamily ?? 'Impact',
            fontSizePercent: item.fontSizePercent ?? 4,
            textColor: item.textColor ?? '#ffffff',
            backgroundColor: item.backgroundColor ?? '#000000',
            backgroundOpacity: item.backgroundOpacity ?? 0.7,
            padding: item.padding ?? 12,
            align: item.align ?? 'center',
            verticalPosition: item.verticalPosition ?? 'center',
            animationIn: item.animationIn ?? 'fade',
            animationOut: item.animationOut ?? 'fade',
            animationInDurationMs: item.animationInDurationMs ?? 500,
            animationOutDurationMs: item.animationOutDurationMs ?? 500,
            displayDurationMs: item.displayDurationMs ?? 2000,
            startOffsetMs: item.startOffsetMs ?? 0
          }))
        }
      }
      // Maintain legacy field in sync
      merged.correctAnswerColor = merged.correctAnswerButtonColor ?? merged.correctAnswerColor
      return merged
    } catch {
      return null
    }
  }

  function loadStoredQuiz(): Partial<QuizData> | null {
    try {
      const raw = localStorage.getItem('quiz_data')
      if (!raw) return null
      const parsed = JSON.parse(raw) as Partial<QuizData>
      return parsed
    } catch {
      return null
    }
  }

  const settingsFromStorage = loadStoredSettings()
  const storedQuiz = loadStoredQuiz()

  const [quiz, setQuiz] = useState<QuizData>({
    title: initial?.title ?? storedQuiz?.title ?? 'Your Anxiety Personality',
    background: initial?.background ?? storedQuiz?.background ?? { type: 'color', color: '#0b0b0c' },
    questions: initial?.questions ?? storedQuiz?.questions ?? [],
    settings: initial && 'settings' in initial ? initial.settings as QuizSettings : (settingsFromStorage ?? defaultSettings)
  })

  function updateTitle(title: string) {
    setQuiz(q => ({ ...q, title }))
  }

  function updateBackground(background: QuizBackground) {
    setQuiz(q => ({ ...q, background }))
  }

  function addQuestion(question: QuizQuestion) {
    setQuiz(q => ({ ...q, questions: [...q.questions, question] }))
  }

  function updateQuestion(updated: QuizQuestion) {
    setQuiz(q => ({
      ...q,
      questions: q.questions.map(qq => (qq.id === updated.id ? updated : qq)),
    }))
  }

  function removeQuestion(id: string) {
    setQuiz(q => ({ ...q, questions: q.questions.filter(qq => qq.id !== id) }))
  }

  function updateSettings(mutator: (s: QuizSettings) => QuizSettings) {
    setQuiz(q => ({ ...q, settings: mutator(q.settings!) }))
  }

  // persist settings
  useEffect(() => {
    try {
      if (quiz.settings) {
        localStorage.setItem('quiz_settings', JSON.stringify(quiz.settings))
        // Debug: Log CTA settings when they change
        if (quiz.settings.cta) {
          console.log('CTA settings saved to localStorage:', quiz.settings.cta)
        }
      }
    } catch {
      // ignore
    }
  }, [quiz.settings])

  // persist quiz data (title, background, questions)
  useEffect(() => {
    try {
      const quizData = {
        title: quiz.title,
        background: quiz.background,
        questions: quiz.questions
      }
      localStorage.setItem('quiz_data', JSON.stringify(quizData))
    } catch {
      // ignore
    }
  }, [quiz.title, quiz.background, quiz.questions])

  function toJsonString(): string {
    return JSON.stringify(quiz, null, 2)
  }

  function loadFromJsonString(json: string) {
    const parsed = JSON.parse(json) as QuizData
    setQuiz(parsed)
  }

  return {
    quiz,
    updateTitle,
    updateBackground,
    updateSettings,
    addQuestion,
    updateQuestion,
    removeQuestion,
    toJsonString,
    loadFromJsonString,
    setQuiz,
  }
}

export function createAnswer(text = '', isCorrect = false): QuizAnswer {
  return { id: crypto.randomUUID(), text, isCorrect }
}

export function createBooleanQuestion(title = 'True or False? (or both)') {
  return {
    id: crypto.randomUUID(),
    title,
    type: 'boolean' as const,
    answers: [createAnswer('True'), createAnswer('False')],
  }
}

export function createMultipleChoiceQuestion(title = 'Pick one or more') {
  return {
    id: crypto.randomUUID(),
    title,
    type: 'multiple' as const,
    answers: [createAnswer('A'), createAnswer('B'), createAnswer('C')],
  }
}


