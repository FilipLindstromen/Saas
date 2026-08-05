import { chatCompletion } from '@shared/openai'

const CHUNK_SIZE = 6000
const MAX_CHUNKS = 5
const MAX_POSTS = 14

const SYSTEM_PROMPT = `You turn source material into a swipeable micro-learning deck, like an Instagram-carousel study app.

Read the provided text and extract the distinct, learnable ideas in it. For each idea, produce one "post" — a short sequence of slides someone can swipe through in under a minute and actually remember.

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
- Only use ideas actually present in the source text. Do not invent facts not supported by it.
- Produce as many posts as there are genuinely distinct ideas, but no more than 8 posts for this chunk of text.`

function chunkText(text) {
  const clean = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  const chunks = []
  for (let i = 0; i < clean.length && chunks.length < MAX_CHUNKS; i += CHUNK_SIZE) {
    chunks.push(clean.slice(i, i + CHUNK_SIZE))
  }
  return chunks
}

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
 * Turn raw extracted text into an array of { title, slides } posts using OpenAI.
 * @param {string} text
 * @param {{ apiKey?: string, onProgress?: (msg: string) => void }} [opts]
 */
export async function generateLessonsFromText(text, opts = {}) {
  const chunks = chunkText(text || '')
  if (!chunks.length) return []

  const posts = []
  for (let i = 0; i < chunks.length; i++) {
    opts.onProgress?.(`Reading part ${i + 1} of ${chunks.length}...`)
    let raw
    try {
      raw = await chatCompletion({
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: chunks[i] },
        ],
        model: 'gpt-4o-mini',
        temperature: 0.4,
        max_tokens: 3000,
        response_format: { type: 'json_object' },
        apiKey: opts.apiKey,
      })
    } catch (err) {
      if (i === 0) throw err
      break
    }
    let parsed
    try {
      parsed = JSON.parse(raw)
    } catch {
      continue
    }
    const chunkPosts = Array.isArray(parsed.posts) ? parsed.posts.map(normalizePost).filter(Boolean) : []
    posts.push(...chunkPosts)
    if (posts.length >= MAX_POSTS) break
  }

  return posts.slice(0, MAX_POSTS)
}
