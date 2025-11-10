export interface QuestionTiming {
  duration: number
  start: number
}

export interface QuizTimeline {
  showTitle: boolean
  titleDuration: number
  titleInMs: number
  titleHoldMs: number
  titleOutMs: number
  questionTimings: QuestionTiming[]
  totalQuestionDuration: number
  totalContentDuration: number
  ctaDuration: number
  endDelay: number
}

export function computeQuizTimeline(quiz: any): QuizTimeline {
  const settings = quiz?.settings ?? {}

  if (settings.animationType === 'overlay') {
    const overlay = settings.overlay
    const overlayItems = Array.isArray(overlay?.items) ? overlay.items : []
    const overlayEnabled = Boolean(overlay?.enabled)

    let overlayDuration = 0
    if (overlayEnabled && overlayItems.length > 0) {
      overlayDuration = overlayItems.reduce((max: number, item: any) => {
        const start = Number(item?.startOffsetMs ?? 0)
        const inMs = Number(item?.animationInDurationMs ?? 500)
        const holdMs = Number(item?.displayDurationMs ?? 2000)
        const outMs = Number(item?.animationOutDurationMs ?? 500)
        return Math.max(max, start + inMs + holdMs + outMs)
      }, 0)
    }

    const endDelay = Number(settings.endDelayMs ?? 0)

    return {
      showTitle: false,
      titleDuration: 0,
      titleInMs: Number(settings.titleInMs ?? 600),
      titleHoldMs: Number(settings.titleHoldMs ?? 900),
      titleOutMs: Number(settings.titleOutMs ?? 600),
      questionTimings: [],
      totalQuestionDuration: 0,
      totalContentDuration: overlayDuration,
      ctaDuration: 0,
      endDelay,
    }
  }

  const showTitle = settings.showTitle ?? true
  const titleInMs = Number(settings.titleInMs ?? 600)
  const titleHoldMs = Number(settings.titleHoldMs ?? 900)
  const titleOutMs = Number(settings.titleOutMs ?? 600)
  const titleDuration = showTitle ? titleInMs + titleHoldMs + titleOutMs : 0

  const questionInMs = Number(settings.questionInMs ?? 500)
  const questionHoldMs = Number(settings.questionHoldMs ?? 1200)
  const answersStaggerMs = Number(settings.answersStaggerMs ?? 180)
  const correctRevealMs = Number(settings.correctRevealMs ?? 900)

  const questionTimings: QuestionTiming[] = []
  let cumulative = 0

  const questions = Array.isArray(quiz?.questions) ? quiz.questions : []

  for (const question of questions) {
    const answers = Array.isArray(question?.answers) ? question.answers : []
    const answersCount = answers.length > 0 ? answers.length : 3
    const staggerTotal = answersCount > 0 ? answersStaggerMs * Math.max(answersCount, 1) : 0
    const duration = questionInMs + staggerTotal + correctRevealMs + questionHoldMs
    questionTimings.push({ duration, start: cumulative })
    cumulative += duration
  }

  const totalQuestionDuration = cumulative
  const totalContentDuration = titleDuration + totalQuestionDuration
  const ctaEnabled = Boolean(settings.cta?.enabled)
  const ctaFadeInMs = Number(settings.cta?.fadeInMs ?? 600)
  const ctaHoldMs = Number(settings.cta?.holdMs ?? 1800)
  const ctaBaseDuration = ctaEnabled ? ctaFadeInMs + ctaHoldMs : 0
  const ctaConfiguredDuration = ctaEnabled ? Number(settings.cta?.durationMs ?? 0) : 0
  const ctaDuration = ctaEnabled ? Math.max(ctaConfiguredDuration, ctaBaseDuration) : 0
  const endDelay = Number(settings.endDelayMs ?? 0)

  return {
    showTitle,
    titleDuration,
    titleInMs,
    titleHoldMs,
    titleOutMs,
    questionTimings,
    totalQuestionDuration,
    totalContentDuration,
    ctaDuration,
    endDelay,
  }
}
