/**
 * Analyze slide content for ColorWriter-style classification.
 * Classifies each slide as: statement, impact, evidence, or relevance.
 */
import { chatCompletion } from '@shared/openai'

const VALID_TYPES = ['statement', 'impact', 'evidence', 'relevance']

const SYSTEM_PROMPT = `You are a copywriting analyst. Classify presentation slide text into exactly ONE of these types:

- **statement**: Clear idea or claim. Headlines, main assertions, direct statements.
- **impact**: Why it matters. Consequences, significance, emotional weight, "what this means for you."
- **evidence**: Proof, logic, credibility. Facts, data, testimonials, mechanisms, reasoning.
- **relevance**: Why THIS audience should care NOW. "If you're someone who…", identity-level connection.

For each slide text provided, respond with ONLY a JSON array of classifications in the same order.
Example: ["statement","impact","evidence","relevance"]
Use only lowercase: statement, impact, evidence, relevance.`

/**
 * Analyze multiple slide texts and return classifications.
 * @param {string} apiKey - OpenAI API key
 * @param {Array<{id: string, text: string}>} slides - Slides with id and plain text content
 * @returns {Promise<Record<string, string>>} Map of slideId -> 'statement'|'impact'|'evidence'|'relevance'
 */
export async function analyzeSlides(apiKey, slides) {
  if (!slides || slides.length === 0) return {}

  const texts = slides.map((s) => (s.text || '').trim() || '(empty)')
  const userContent = texts
    .map((t, i) => `[${i + 1}] ${t}`)
    .join('\n\n')

  const response = await chatCompletion({
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Classify each slide:\n\n${userContent}` },
    ],
    model: 'gpt-4o-mini',
    temperature: 0.2,
    max_tokens: 500,
    apiKey,
  })

  let arr
  try {
    const parsed = JSON.parse(response.trim())
    arr = Array.isArray(parsed) ? parsed : [parsed]
  } catch {
    const match = response.match(/\[[\s\S]*?\]/)
    arr = match ? JSON.parse(match[0]) : []
  }

  const result = {}
  slides.forEach((slide, i) => {
    const raw = (arr[i] || 'statement').toString().toLowerCase().trim()
    result[slide.id] = VALID_TYPES.includes(raw) ? raw : 'statement'
  })
  return result
}
