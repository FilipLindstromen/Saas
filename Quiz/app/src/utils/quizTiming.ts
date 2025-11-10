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
  const ctaDuration = settings.cta?.enabled ? Number(settings.cta?.durationMs ?? 3000) : 0
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
