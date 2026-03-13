/**
 * Response model types and modular result generators.
 * Each quiz defines responseModel: "percentage" | "category" | "profile".
 */

export const RESPONSE_MODELS = {
  PERCENTAGE: 'percentage',
  CATEGORY: 'category',
  PROFILE: 'profile'
}

/**
 * Model 1 — Percentage (performance-based).
 * Questions have correctAnswerId; answers have weight.
 * Tiers: 0–40 Beginner, 41–75 Intermediate, 76–100 Advanced.
 * @param {Array<{ id, q, answers: Array<{ id, label, weight? }>, correctAnswerId? }>} questions
 * @param {Array<{ questionId, answerId }>} selections - user's selected answer id per question
 * @param {Array<{ min, max, level, title, message, suggestion, nextStep? }>} tiers
 * @returns {{ result_type: 'percentage', score, maxScore, percentage, level, title, message, suggestion, next_step? }}
 */
export function computePercentageResult(questions, selections, tiers) {
  let userScore = 0
  let maxScore = 0
  const selectionByQuestion = new Map(selections.map(s => [s.questionId, s.answerId]))

  for (const q of questions || []) {
    const correctId = q.correctAnswerId
    const selectedId = selectionByQuestion.get(q.id)
    const weights = (q.answers || []).map(a => (a.weight != null ? Number(a.weight) : 1))
    const questionMax = weights.reduce((s, w) => s + w, 0)
    maxScore += questionMax

    if (correctId != null && selectedId === correctId) {
      const idx = (q.answers || []).findIndex(a => a.id === correctId)
      userScore += idx >= 0 && weights[idx] != null ? weights[idx] : 1
    }
  }

  const percentage = maxScore > 0 ? Math.round((userScore / maxScore) * 100) : 0
  const sortedTiers = (tiers || []).slice().sort((a, b) => (b.min || 0) - (a.min || 0))
  let tier = sortedTiers.find(t => percentage >= (t.min || 0) && percentage <= (t.max || 100))
  if (!tier && sortedTiers.length) {
    tier = percentage <= (sortedTiers[sortedTiers.length - 1].max || 40)
      ? sortedTiers[sortedTiers.length - 1]
      : sortedTiers[0]
  }
  const fallbackTier = {
    level: percentage <= 40 ? 'Beginner' : percentage <= 75 ? 'Intermediate' : 'Advanced',
    title: 'Your Result',
    message: `You scored ${percentage}%.`,
    suggestion: 'Review the material and try again when ready.',
    nextStep: ''
  }

  return {
    result_type: 'percentage',
    score: userScore,
    maxScore,
    percentage,
    level: tier?.level ?? fallbackTier.level,
    title: tier?.title ?? fallbackTier.title,
    message: tier?.message ?? fallbackTier.message,
    suggestion: tier?.suggestion ?? fallbackTier.suggestion,
    next_step: tier?.nextStep ?? fallbackTier.nextStep ?? ''
  }
}

/**
 * Model 2 — Category (personality / profile type).
 * Each answer adds points to a category; highest (or hybrid) wins.
 * @param {Array<{ id, answers: Array<{ id, label, category?, points? }> }>} questions
 * @param {Array<{ questionId, answerId }>} selections
 * @param {Array<{ id, name, description?, strengths?, recommendation? }>} categoryConfig
 * @param {number} hybridThreshold - if second place is within this many points, return hybrid
 * @returns {{ result_type: 'category', category?, category2?, description, strengths, recommendation, scores }}
 */
export function computeCategoryResult(questions, selections, categoryConfig, hybridThreshold = 2) {
  const scores = {}
  const selectionByQuestion = new Map(selections.map(s => [s.questionId, s.answerId]))

  for (const q of questions || []) {
    const selectedId = selectionByQuestion.get(q.id)
    const answer = (q.answers || []).find(a => a.id === selectedId)
    if (!answer) continue
    const cat = answer.category || answer.tag || 'default'
    const pts = answer.points != null ? Number(answer.points) : 2
    scores[cat] = (scores[cat] || 0) + pts
  }

  const entries = Object.entries(scores).sort((a, b) => b[1] - a[1])
  const first = entries[0]
  const second = entries[1]
  const firstScore = first?.[1] ?? 0
  const secondScore = second?.[1] ?? 0
  const isHybrid = second && firstScore - secondScore <= hybridThreshold

  const getConfig = (catId) => (categoryConfig || []).find(c => c.id === catId) || {}

  const primary = first?.[0] ?? 'default'
  const secondary = isHybrid ? second?.[0] : null
  const config = getConfig(primary)
  const config2 = secondary ? getConfig(secondary) : {}

  return {
    result_type: 'category',
    category: primary,
    category2: secondary || undefined,
    description: config.description ?? `You align most with ${primary}.`,
    strengths: config.strengths ?? [],
    recommendation: config.recommendation ?? 'Focus on areas that complement your strengths.',
    scores,
    ...(isHybrid && secondary
      ? {
          description: [config.description, config2.description].filter(Boolean).join(' ') || `You have traits of both ${primary} and ${secondary}.`,
          strengths: [...(config.strengths || []), ...(config2.strengths || [])].slice(0, 5),
          recommendation: config.recommendation || config2.recommendation || 'Leverage both profiles.'
        }
      : {})
  }
}

/**
 * Model 3 — Weighted insight profile (attributes).
 * Each answer updates attribute deltas; result = strongest, weakest, summary, recommendation.
 * @param {Array<{ id, answers: Array<{ id, label, attributes? }> }>} questions - answer.attributes = { experience?: number, confidence?: number, ... }
 * @param {Array<{ questionId, answerId }>} selections
 * @param {Array<{ key, label }>} attributeLabels - e.g. [{ key: 'experience', label: 'Experience level' }]
 * @param {{ summary?: string, recommendation?: string }} profileConfig - optional template or default text
 * @returns {{ result_type: 'profile', strongest_trait, weakest_trait, summary, recommendation, attributes }}
 */
export function computeProfileResult(questions, selections, attributeLabels, profileConfig = {}) {
  const attributes = {}
  const selectionByQuestion = new Map(selections.map(s => [s.questionId, s.answerId]))

  const defaultKeys = ['experience', 'confidence', 'knowledge', 'riskTolerance', 'learningStyle']
  const keys = (attributeLabels && attributeLabels.length)
    ? attributeLabels.map(a => a.key)
    : defaultKeys
  keys.forEach(k => { attributes[k] = 0 })

  for (const q of questions || []) {
    const selectedId = selectionByQuestion.get(q.id)
    const answer = (q.answers || []).find(a => a.id === selectedId)
    if (!answer || !answer.attributes) continue
    for (const [key, delta] of Object.entries(answer.attributes)) {
      if (typeof delta === 'number' && attributes[key] !== undefined) {
        attributes[key] += delta
      }
    }
  }

  const entries = Object.entries(attributes).sort((a, b) => b[1] - a[1])
  const strongest = entries[0]?.[0] ?? keys[0]
  const weakest = entries[entries.length - 1]?.[0] ?? keys[keys.length - 1]
  const label = (key) => (attributeLabels || []).find(a => a.key === key)?.label ?? key

  return {
    result_type: 'profile',
    strongest_trait: label(strongest),
    weakest_trait: label(weakest),
    summary: profileConfig.summary ?? `You show strength in ${label(strongest)} and room to grow in ${label(weakest)}.`,
    recommendation: profileConfig.recommendation ?? 'Focus on balancing your profile over time.',
    attributes: { ...attributes }
  }
}

/**
 * Dispatcher: compute result based on quiz response model.
 * @param {string} responseModel - 'percentage' | 'category' | 'profile'
 * @param {object} quizData - full quiz config (questions, percentageTiers, categories, etc.)
 * @param {Array<{ questionId, answerId }>} selections
 */
export function computeResult(responseModel, quizData, selections) {
  const questions = quizData.questions || []
  switch (responseModel) {
    case RESPONSE_MODELS.PERCENTAGE:
      return computePercentageResult(questions, selections, quizData.percentageTiers || [])
    case RESPONSE_MODELS.CATEGORY:
      return computeCategoryResult(questions, selections, quizData.categories || [], quizData.categoryHybridThreshold)
    case RESPONSE_MODELS.PROFILE:
      return computeProfileResult(questions, selections, quizData.attributeLabels || [], quizData.profileConfig || {})
    default:
      return { result_type: 'unknown', message: 'Unknown response model.' }
  }
}
