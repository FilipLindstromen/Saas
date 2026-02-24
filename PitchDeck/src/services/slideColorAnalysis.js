/**
 * Analyze slide content for ColorWriter-style classification.
 * Uses the same Persuasive Cycle as ColorWriter: Statement → Impact → Evidence → Relevance (repeating).
 */
import { chatCompletion } from '@shared/openai'

const VALID_TYPES = ['statement', 'impact', 'evidence', 'relevance']

const SYSTEM_PROMPT = `You are an expert copy analysis engine (same as ColorWriter).
Classify each presentation slide into the Persuasive Cycle block types.

**BLOCK TYPES** (Use ONLY these four - Persuasive Cycle):
1. **statement** — Clear idea or claim. Headlines, main assertions, direct statements. (📌 Red pushpin)
2. **impact** — Why it matters. Consequences, significance, emotional weight, "what this means for you." (⚡ Lightning)
3. **evidence** — Proof, logic, credibility. Facts, data, testimonials, mechanisms, reasoning. (📋 Document)
4. **relevance** — Why THIS audience should care NOW. "If you're someone who…", "This matters especially when…", identity-level connection. (🎯 Target)

**CRITICAL - PERSUASIVE CYCLE (loop of colors)**:
- Slides MUST follow the cycle: Statement → Impact → Evidence → Relevance → Statement → Impact → Evidence → Relevance...
- Classify each slide into the MOST accurate type, but PREFER continuing the cycle where the content fits.
- Use statement for openings, headlines, and clear claims.
- Use impact for significance and consequences.
- Use evidence for proof, logic, and mechanism.
- Use relevance for audience connection and "why you" moments.

**Output**: Respond with ONLY a JSON array of classifications in the same order as the slides.
Example: ["statement","impact","evidence","relevance","statement","impact",...]
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
      { role: 'user', content: `Classify each slide (follow the Persuasive Cycle - Statement → Impact → Evidence → Relevance loop):\n\n${userContent}` },
    ],
    model: 'gpt-4o',
    temperature: 0.2,
    max_tokens: 1000,
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
