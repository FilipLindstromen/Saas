import { chatCompletion } from '@shared/openai'

export const BATCH_SIZE = 10
// Trigger the next batch once this many (or fewer) unseen lessons remain —
// e.g. with BATCH_SIZE 10 and threshold 4, a new batch starts after the
// reader has swiped through 6 of the current 10.
export const REFILL_THRESHOLD = 4
// Circuit breaker against runaway generation from a stuck loop — not a
// real ceiling the reader would ever hit in normal use.
export const MAX_TOTAL_LESSONS = 300

const REFERENCE_CHAR_BUDGET = 9000

const SYSTEM_PROMPT = `You are an expert direct-response copywriter with decades of experience — the kind who has written control-beating emails, landing pages, and ads — now working one-on-one as a copywriting mentor. Your job is to keep teaching a student copywriting through an endless stream of short, swipeable lessons, like an Instagram-carousel study app.

You'll be given:
1. Reference material the student uploaded (could be an article, a book excerpt, notes, a product description — anything).
2. A list of lesson titles you've already taught this student. Never repeat these ideas.

Ground new lessons in the reference material where it genuinely teaches something about persuasive writing — extract the copywriting techniques, structures, or psychology it demonstrates, even if the material itself isn't explicitly "about" copywriting (e.g. a product description can teach a benefit-framing lesson; a news article can teach a hook technique). Once you've meaningfully mined the material, keep going using your own expert copywriting knowledge — classic formulas, persuasion psychology, headline/CTA/email techniques, structural patterns — staying loosely relevant to the material's subject or audience where it makes sense. You must always produce a full batch. Never say you've run out of material or ideas.

Return STRICT JSON only, no markdown fences, matching this shape:
{
  "posts": [
    {
      "title": "short post title",
      "slides": [
        { "kind": "title", "kicker": "1-2 word topic label", "heading": "punchy heading, under 8 words" },
        { "kind": "point", "heading": "short heading", "body": "1-2 sentences explaining the idea, under 220 characters" },
        { "kind": "example", "label": "short label", "before": "optional weak/before version, or empty string", "after": "the strong/after version or concrete example" },
        { "kind": "quiz", "prompt": "a question testing the idea", "options": ["option A", "option B"], "correct": 0, "explanation": "why that option is right, under 160 characters" },
        { "kind": "challenge", "prompt": "a short task the reader can try", "hint": "a nudge, under 100 characters", "modelAnswer": "one reasonable answer, under 200 characters" },
        { "kind": "takeaway", "body": "one memorable sentence to close the post" }
      ]
    }
  ]
}

Rules:
- Every post MUST start with exactly one "title" slide and end with exactly one "takeaway" slide.
- Between them, use 2-5 slides mixing "point", "example", "quiz", and "challenge" kinds — whichever fit the content. Not every kind is required in every post.
- "quiz" options must have exactly 2 items, and "correct" is the 0-based index of the right one.
- Keep every string short and mobile-friendly. No markdown, no bullet characters, no numbering.
- Write like a real copywriting mentor: concrete, opinionated, example-driven — never generic filler.
- Produce exactly the requested number of posts, each teaching a genuinely distinct idea (no near-duplicates of each other or of the already-taught list).`

function normalizeSlide(slide) {
  if (!slide || typeof slide !== 'object') return null
  switch (slide.kind) {
    case 'title':
      if (!slide.heading) return null
      return { kind: 'title', kicker: String(slide.kicker || 'Lesson').slice(0, 40), heading: String(slide.heading).slice(0, 120) }
    case 'point':
      if (!slide.heading || !slide.body) return null
      return { kind: 'point', heading: String(slide.heading).slice(0, 120), body: String(slide.body).slice(0, 400) }
    case 'example':
      if (!slide.after) return null
      return {
        kind: 'example',
        label: String(slide.label || 'Example').slice(0, 60),
        before: slide.before ? String(slide.before).slice(0, 200) : '',
        after: String(slide.after).slice(0, 300),
      }
    case 'quiz':
      if (!slide.prompt || !Array.isArray(slide.options) || slide.options.length !== 2) return null
      return {
        kind: 'quiz',
        prompt: String(slide.prompt).slice(0, 240),
        options: slide.options.map((o) => String(o).slice(0, 160)),
        correct: slide.correct === 1 ? 1 : 0,
        explanation: String(slide.explanation || '').slice(0, 300),
      }
    case 'challenge':
      if (!slide.prompt) return null
      return {
        kind: 'challenge',
        prompt: String(slide.prompt).slice(0, 240),
        hint: String(slide.hint || '').slice(0, 160),
        modelAnswer: String(slide.modelAnswer || '').slice(0, 300),
      }
    case 'takeaway':
      if (!slide.body) return null
      return { kind: 'takeaway', body: String(slide.body).slice(0, 300) }
    default:
      return null
  }
}

function normalizePost(raw) {
  if (!raw || !Array.isArray(raw.slides)) return null
  const slides = raw.slides.map(normalizeSlide).filter(Boolean)
  if (slides.length < 2) return null
  if (slides[0].kind !== 'title') {
    slides.unshift({ kind: 'title', kicker: 'Lesson', heading: String(raw.title || 'Lesson').slice(0, 120) })
  }
  if (slides[slides.length - 1].kind !== 'takeaway') {
    slides.push({ kind: 'takeaway', body: 'Review this again soon to make it stick.' })
  }
  return { title: String(raw.title || slides[0].heading || 'Lesson').slice(0, 120), slides }
}

/**
 * Generate the next batch of lessons, continuing from what's already been
 * taught. One OpenAI call per batch — this is meant to be called
 * repeatedly as the reader swipes, not once up front.
 * @param {Object} opts
 * @param {string} opts.referenceText - combined text from the uploaded source(s)
 * @param {string[]} [opts.coveredTitles] - titles already generated, to avoid repeats
 * @param {number} [opts.batchSize]
 * @param {string} [opts.apiKey]
 */
export async function generateLessonBatch({ referenceText, coveredTitles = [], batchSize = BATCH_SIZE, apiKey }) {
  const reference = (referenceText || '').replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, REFERENCE_CHAR_BUDGET)
  if (!reference) return []

  const coveredList = coveredTitles.length
    ? coveredTitles.map((t) => `- ${t}`).join('\n')
    : '(none yet — this is the first batch)'

  const userMessage = `REFERENCE MATERIAL:\n${reference}\n\nALREADY TAUGHT (do not repeat these):\n${coveredList}\n\nGenerate exactly ${batchSize} new lessons continuing this student's copywriting education.`

  let raw
  try {
    raw = await chatCompletion({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      model: 'gpt-4o-mini',
      temperature: 0.7,
      max_tokens: 4500,
      response_format: { type: 'json_object' },
      apiKey,
    })
  } catch (err) {
    throw err
  }

  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }

  const posts = Array.isArray(parsed.posts) ? parsed.posts.map(normalizePost).filter(Boolean) : []
  return posts.slice(0, batchSize)
}
