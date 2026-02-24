/**
 * Analyze slide content for ColorWriter-style classification.
 * Uses the SAME block types and logic as ColorWriter's analyzeCopy.
 */
import { chatCompletion } from '@shared/openai'

const VALID_TYPES = ['statement', 'impact', 'evidence', 'relevance']

// Same block definitions as ColorWriter (openai.js analyzeCopy)
const SYSTEM_PROMPT = `You are an expert copy analysis engine (same as ColorWriter).
Your task is to classify each presentation slide into the Persuasive Cycle block types.

**BLOCK TYPES** (Use ONLY these four - same as ColorWriter):
1. **statement** — Clear idea or claim. Headlines, main assertions, direct statements.
2. **impact** — Why it matters. Consequences, significance, emotional weight, "what this means for you."
3. **evidence** — Proof, logic, credibility. Facts, data, testimonials, mechanisms, reasoning.
4. **relevance** — Why THIS audience should care NOW. "If you're someone who…", "This matters especially when…", identity-level connection.

**CRITICAL RULES** (same as ColorWriter):
1. Classify each slide into the MOST accurate of the four types based on the CONTENT. The content determines the type.
2. Use statement for openings, headlines, and clear claims.
3. Use impact for significance and consequences.
4. Use evidence for proof, logic, and mechanism.
5. Use relevance for audience connection and "why you" moments.
6. Every section should follow Statement → Impact → Evidence → Relevance where the content fits. When content could fit multiple types, prefer continuing this cycle. But content accuracy is always primary—do not assign based on slide position alone.

**Output**: Respond with a JSON object: { "classifications": ["statement","impact","evidence","relevance",...] }
The array must have exactly one classification per slide, in the same order. Use only lowercase: statement, impact, evidence, relevance.`

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
      { role: 'user', content: `Classify each slide into the most accurate block type based on its content:\n\n${userContent}` },
    ],
    model: 'gpt-4o',
    temperature: 0.1,
    max_tokens: 1000,
    apiKey,
    response_format: { type: 'json_object' },
  })

  let arr = []
  try {
    const parsed = JSON.parse((response || '').trim())
    arr = parsed?.classifications
    if (!Array.isArray(arr)) {
      arr = parsed?.results || parsed?.types || []
    }
  } catch {
    const match = (response || '').match(/\[[\s\S]*?\]/)
    if (match) {
      try {
        arr = JSON.parse(match[0])
      } catch {
        arr = []
      }
    }
  }

  const result = {}
  slides.forEach((slide, i) => {
    let raw = arr[i]
    if (raw != null && typeof raw === 'object') raw = raw.type || raw.classification || raw
    raw = (raw || 'statement').toString().toLowerCase().trim()
    result[slide.id] = VALID_TYPES.includes(raw) ? raw : 'statement'
  })
  return result
}
