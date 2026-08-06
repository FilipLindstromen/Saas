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

// What each topic teaches — used both to focus the model and, when the
// student has uploaded material, to find the angle in that material that
// fits this topic specifically (so "Headlines" pulls headline-shaped
// material out of their upload rather than reusing whatever "Basics" used).
const CATEGORY_FOCUS = {
  basics: 'foundational copywriting principles — features vs. benefits, writing to one specific reader, message structure (e.g. AIDA), specificity over vague claims',
  headlines: 'headline-writing techniques — curiosity gaps, the 4 U\'s (urgent/unique/ultra-specific/useful), how-to headlines, numbers in headlines, naming the enemy',
  intros: 'opening/intro techniques — mid-scene openers, surprising-stat hooks, bold claim opens, pattern interrupts',
  bullets: 'bullet-point copywriting — benefit-driven bullets, fascination bullets, bucket brigades, one idea per bullet',
  cta: 'call-to-action techniques — one clear action, risk reversal, real vs. fake urgency, reason-why closes',
  mine: 'whichever copywriting technique the reference material below is best suited to teach',
}

function buildSystemPrompt({ categoryFocus, hasReference }) {
  const groundingInstructions = hasReference
    ? `The student has uploaded reference material below. Do not treat it as vague inspiration — actually use it: pull specific claims, product details, numbers, or lines directly from it for your "example" and "challenge" slides (quote or closely paraphrase real content, don't invent an unrelated generic scenario). Every lesson in this batch should read as if it were written specifically for this student's own material. If today's teaching focus doesn't literally appear in the material, still use the material's actual subject/product/audience as the worked example while you teach the technique — never fall back to a random unconnected example when real material is available.`
    : `No reference material was provided for this batch — write purely from your own expert copywriting knowledge, staying tightly on today's teaching focus below.`

  return `You are an expert direct-response copywriter with decades of experience — the kind who has written control-beating emails, landing pages, and ads — now working one-on-one as a copywriting mentor. Your job is to keep teaching a student copywriting through an endless stream of swipeable lessons, like an Instagram-carousel study app — but with real depth, not one-liners.

TODAY'S TEACHING FOCUS: ${categoryFocus}

${groundingInstructions}

You'll also get a list of lesson titles you've already taught this student on this topic — never repeat those ideas; always find a genuinely new angle. You must always produce a full batch of new, distinct lessons. Never say you've run out of material or ideas — if the literal material runs dry, keep going with your own expertise (still flavored by the material's subject/domain when one was given).

Return STRICT JSON only, no markdown fences, matching this shape:
{
  "posts": [
    {
      "title": "short post title",
      "slides": [
        { "kind": "title", "kicker": "1-2 word topic label", "heading": "punchy heading, under 8 words" },
        { "kind": "point", "heading": "short heading", "body": "2-4 sentences with real depth — state the principle, explain the mechanism behind WHY it works, and note when to use (or not use) it. Under 500 characters." },
        { "kind": "example", "label": "short label for the set", "items": [ { "before": "optional weak/before version, or empty string", "after": "the strong/after version or concrete example" }, "... 3 to 5 of these, each a distinct product/context so the pattern actually sinks in through repetition, not one lonely example" ] },
        { "kind": "quiz", "prompt": "a question testing the idea", "options": ["option A", "option B"], "correct": 0, "explanation": "why that option is right, and why the other one is a common mistake, under 240 characters" },
        { "kind": "challenge", "prompt": "a short task the reader can try", "hint": "a nudge, under 100 characters", "modelAnswer": "a fully worked example answer with brief reasoning, under 350 characters" },
        { "kind": "takeaway", "body": "1-2 memorable sentences to close the post — the one thing to remember" }
      ]
    }
  ]
}

Rules:
- Every post MUST start with exactly one "title" slide and end with exactly one "takeaway" slide.
- Between them, use 2-5 slides mixing "point", "example", "quiz", and "challenge" kinds — whichever fit the content. Not every kind is required in every post.
- Every "example" slide's "items" array MUST contain 3 to 5 entries — never just one. Vary the product/business/audience across the entries so the technique is shown working in different contexts, not the same example restated.
- "quiz" options must have exactly 2 items, and "correct" is the 0-based index of the right one.
- No markdown, no bullet characters, no numbering inside strings.
- Write like a real copywriting mentor: concrete, opinionated, example-driven, with enough substance that the reader learns something specific — never generic filler or a single shallow sentence.
- Stay on today's teaching focus for every post in this batch — don't drift into a different topic.
${hasReference ? '- At least one slide per post (usually "example" or "challenge") must contain a specific, recognizable detail lifted from the reference material below — a real claim, product name, number, or line, not a paraphrase so loose it could belong to any business.' : ''}
- Produce exactly the requested number of posts, each teaching a genuinely distinct idea (no near-duplicates of each other or of the already-taught list).`
}

function normalizeSlide(slide) {
  if (!slide || typeof slide !== 'object') return null
  switch (slide.kind) {
    case 'title':
      if (!slide.heading) return null
      return { kind: 'title', kicker: String(slide.kicker || 'Lesson').slice(0, 40), heading: String(slide.heading).slice(0, 120) }
    case 'point':
      if (!slide.heading || !slide.body) return null
      return { kind: 'point', heading: String(slide.heading).slice(0, 120), body: String(slide.body).slice(0, 600) }
    case 'example': {
      const rawItems = Array.isArray(slide.items)
        ? slide.items
        // tolerate a model occasionally still returning the old single before/after shape
        : (slide.after ? [{ before: slide.before, after: slide.after }] : [])
      const items = rawItems
        .map((it) => ({
          before: it?.before ? String(it.before).slice(0, 200) : '',
          after: it?.after ? String(it.after).slice(0, 300) : '',
        }))
        .filter((it) => it.after)
        .slice(0, 5)
      if (!items.length) return null
      return { kind: 'example', label: String(slide.label || 'Examples').slice(0, 60), items }
    }
    case 'quiz':
      if (!slide.prompt || !Array.isArray(slide.options) || slide.options.length !== 2) return null
      return {
        kind: 'quiz',
        prompt: String(slide.prompt).slice(0, 240),
        options: slide.options.map((o) => String(o).slice(0, 160)),
        correct: slide.correct === 1 ? 1 : 0,
        explanation: String(slide.explanation || '').slice(0, 400),
      }
    case 'challenge':
      if (!slide.prompt) return null
      return {
        kind: 'challenge',
        prompt: String(slide.prompt).slice(0, 240),
        hint: String(slide.hint || '').slice(0, 160),
        modelAnswer: String(slide.modelAnswer || '').slice(0, 450),
      }
    case 'takeaway':
      if (!slide.body) return null
      return { kind: 'takeaway', body: String(slide.body).slice(0, 400) }
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
 * Generate the next batch of lessons for a topic, continuing from what's
 * already been taught. One OpenAI call per batch — meant to be called
 * repeatedly as the reader swipes, not once up front.
 *
 * Works with or without reference material: with it, lessons are grounded
 * in the student's own uploaded content; without it, lessons are written
 * from the mentor persona's own copywriting expertise on the given topic —
 * so every topic can generate an endless, non-repeating stream either way.
 *
 * @param {Object} opts
 * @param {string} opts.categoryId - one of basics/headlines/intros/bullets/cta/mine
 * @param {string} [opts.referenceText] - combined text from the uploaded source(s), if any
 * @param {string[]} [opts.coveredTitles] - titles already generated for this topic, to avoid repeats
 * @param {number} [opts.batchSize]
 * @param {string} [opts.apiKey]
 */
export async function generateLessonBatch({ categoryId, referenceText, coveredTitles = [], batchSize = BATCH_SIZE, apiKey }) {
  const reference = (referenceText || '').replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, REFERENCE_CHAR_BUDGET)
  // "mine" only exists to teach from the student's own material — nothing to generate without it.
  if (categoryId === 'mine' && !reference) return []

  const categoryFocus = CATEGORY_FOCUS[categoryId] || CATEGORY_FOCUS.basics
  const systemPrompt = buildSystemPrompt({ categoryFocus, hasReference: !!reference })

  const coveredList = coveredTitles.length
    ? coveredTitles.map((t) => `- ${t}`).join('\n')
    : '(none yet — this is the first batch on this topic)'

  const userMessage = `${reference ? `REFERENCE MATERIAL (the student's own uploaded content):\n${reference}\n\n` : ''}ALREADY TAUGHT ON THIS TOPIC (do not repeat these):\n${coveredList}\n\nGenerate exactly ${batchSize} new lessons continuing this student's copywriting education, staying on today's teaching focus.`

  const raw = await chatCompletion({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    model: 'gpt-4o-mini',
    temperature: 0.7,
    max_tokens: 12000,
    response_format: { type: 'json_object' },
    apiKey,
  })

  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }

  const posts = Array.isArray(parsed.posts) ? parsed.posts.map(normalizePost).filter(Boolean) : []
  return posts.slice(0, batchSize)
}
