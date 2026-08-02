import { getApiKey } from '@shared/apiKeys'
import { CAROUSEL_LIMITS } from '../carousel/constants'

function parseJsonArray(text) {
  const jsonMatch = text.match(/\[[\s\S]*\]/)
  if (!jsonMatch) throw new Error('Could not parse AI response')
  const parsed = JSON.parse(jsonMatch[0])
  if (!Array.isArray(parsed)) throw new Error('Expected JSON array')
  return parsed
}

async function chatCompletion({ system, user, model = 'gpt-4o-mini', temperature = 0.75 }) {
  const openaiKey = getApiKey('openai')?.trim()
  if (!openaiKey) throw new Error('Add your OpenAI API key on the SaaS Apps screen.')

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature,
    }),
  })

  const data = await response.json()
  if (!response.ok) throw new Error(data?.error?.message || 'OpenAI request failed')
  return data.choices?.[0]?.message?.content?.trim() || ''
}

export async function generateCarouselIdeas({
  instructions = '',
  topic = '',
  slideCount = 5,
  templateHint = '',
  psychologyMode = true,
  referenceContext = '',
}) {
  const system = psychologyMode
    ? `You are an Instagram carousel copywriter. Each slide becomes one 1080×1440 image.
Rules:
- Slide 1 MUST be a scroll-stopping hook (question, bold claim, or curiosity gap)
- Middle slides: ONE idea each — short, scannable copy
- Last slide MUST have a clear CTA
- Return ONLY valid JSON: array of objects with "copy" (all text for that slide, use line breaks if needed), "role" (hook|value|proof|story|tip|cta|transition)
- Each "copy" under ${CAROUSEL_LIMITS.slideCopyWords} words and ${CAROUSEL_LIMITS.slideCopyChars} characters`
    : `Generate Instagram carousel slide ideas. Return ONLY JSON array with "copy", "role".`

  const user = [
    referenceContext.trim() && `Reference material:\n${referenceContext.trim()}`,
    instructions.trim() && `Instructions:\n${instructions.trim()}`,
    topic.trim() && `Topic:\n${topic.trim()}`,
    templateHint.trim() && `Structure:\n${templateHint.trim()}`,
    `Generate exactly ${slideCount} carousel slides.`,
  ].filter(Boolean).join('\n\n')

  const text = await chatCompletion({ system, user })
  const parsed = parseJsonArray(text)
  return parsed.map((item, i) => {
    const copy = String(
      item.copy
      || [item.headline, item.body].filter(Boolean).join('\n\n')
      || item.title
      || ''
    ).trim()
    return {
      id: `idea-${Date.now()}-${i}`,
      copy,
      role: item.role || (i === 0 ? 'hook' : i === parsed.length - 1 ? 'cta' : 'value'),
    }
  }).filter((item) => item.copy)
}

export async function generateCarouselVariants({
  instructions = '',
  topic = '',
  slideCount = 5,
  variantCount = 3,
  referenceContext = '',
}) {
  const system = `Generate ${variantCount} DISTINCT carousel concept variants for A/B testing.
Each variant is a complete carousel with ${slideCount} slides.
Return ONLY JSON: array of variants, each with "label" (A/B/C), "hookAngle" (short description), and "slides" array of {copy, role}.
Variants must differ in hook angle and CTA framing. Keep copy mobile-readable.`

  const user = [
    referenceContext.trim() && `Reference material:\n${referenceContext.trim()}`,
    instructions.trim() && `Instructions:\n${instructions.trim()}`,
    topic.trim() && `Topic:\n${topic.trim()}`,
    `Generate exactly ${slideCount} slides per variant.`,
  ].filter(Boolean).join('\n\n')

  const text = await chatCompletion({ system, user, temperature: 0.9 })
  return parseJsonArray(text)
}

export async function generateCarouselCaption({
  slides = [],
  instructions = '',
  platform = 'instagram',
}) {
  const slideSummary = slides
    .filter((s) => (s.layout || 'default') !== 'section')
    .map((s, i) => {
      const h = String(s.content || '').replace(/<[^>]+>/g, '').trim()
      const b = String(s.subtitle || '').replace(/<[^>]+>/g, '').trim()
      return `Slide ${i + 1}: ${h}${b ? ` — ${b}` : ''}`
    }).join('\n')

  const system = `Write a ${platform} carousel post caption. Include:
- Opening hook line (can reference "swipe" naturally)
- 2-4 short paragraphs expanding the carousel value
- CTA at the end
- Separate "hashtags" field with 8-15 relevant hashtags (with #)
Return ONLY JSON: {"caption": "...", "hashtags": "...", "firstComment": "optional engagement question"}.
Caption must stay under ${CAROUSEL_LIMITS.captionChars} characters including line breaks.`

  const user = [
    instructions.trim() && `Brand/context:\n${instructions.trim()}`,
    `Carousel slides:\n${slideSummary}`,
  ].filter(Boolean).join('\n\n')

  const text = await chatCompletion({ system, user, temperature: 0.7 })
  const objMatch = text.match(/\{[\s\S]*\}/)
  if (!objMatch) throw new Error('Could not parse caption response')
  return JSON.parse(objMatch[0])
}

export async function fitSlideCopyToCarousel({ headline = '', body = '' }) {
  const system = `Shorten carousel slide copy for mobile readability.
Limits: headline max ${CAROUSEL_LIMITS.headlineWords} words, body max ${CAROUSEL_LIMITS.bodyWords} words.
Return ONLY JSON: {"headline": "...", "body": "..."}`

  const user = `Headline: ${headline}\nBody: ${body || '(none)'}`
  const text = await chatCompletion({ system, user, temperature: 0.3 })
  const objMatch = text.match(/\{[\s\S]*\}/)
  if (!objMatch) throw new Error('Could not parse fit response')
  return JSON.parse(objMatch[0])
}

export async function fitAllSlidesCopy(slides) {
  const results = []
  for (const slide of slides) {
    if ((slide.layout || 'default') === 'section') {
      results.push(slide)
      continue
    }
    const headline = String(slide.content || '').replace(/<[^>]+>/g, '').trim()
    const body = String(slide.subtitle || '').replace(/<[^>]+>/g, '').trim()
    if (!headline) {
      results.push(slide)
      continue
    }
    try {
      const fitted = await fitSlideCopyToCarousel({ headline, body })
      results.push({ ...slide, _fittedHeadline: fitted.headline, _fittedBody: fitted.body || '' })
    } catch {
      results.push(slide)
    }
  }
  return results
}

export async function generateImageSearchQuery(slideText, visualTheme = '') {
  const openaiKey = getApiKey('openai')?.trim()
  if (!openaiKey) throw new Error('OpenAI key required')

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'Return ONLY a 2-4 word Unsplash search query. No quotes. Match visual theme if given.',
        },
        {
          role: 'user',
          content: `Slide: ${slideText.slice(0, 200)}${visualTheme ? `\nVisual theme: ${visualTheme}` : ''}`,
        },
      ],
      temperature: 0.5,
      max_tokens: 20,
    }),
  })

  const data = await response.json()
  if (!response.ok) throw new Error(data?.error?.message || 'Query generation failed')
  return (data.choices?.[0]?.message?.content || 'abstract minimal').trim().replace(/["']/g, '')
}

export async function searchUnsplash(query, unsplashKey) {
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=portrait`
  const res = await fetch(url, { headers: { Authorization: `Client-ID ${unsplashKey}` } })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.errors?.[0] || 'Unsplash search failed')
  return data.results?.[0]?.urls?.regular || ''
}
