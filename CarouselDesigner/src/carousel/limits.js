import { CAROUSEL_LIMITS } from './constants'

export function stripHtml(text) {
  if (!text) return ''
  return String(text)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim()
}

export function countWords(text) {
  const plain = stripHtml(text)
  if (!plain) return 0
  return plain.split(/\s+/).filter(Boolean).length
}

export function analyzeSlideText(slide) {
  const headline = stripHtml(slide?.content)
  const body = stripHtml(slide?.subtitle)
  const headlineWords = countWords(headline)
  const bodyWords = countWords(body)

  const warnings = []
  if (headlineWords > CAROUSEL_LIMITS.headlineWords) {
    warnings.push({ field: 'headline', type: 'words', value: headlineWords, limit: CAROUSEL_LIMITS.headlineWords })
  }
  if (headline.length > CAROUSEL_LIMITS.headlineChars) {
    warnings.push({ field: 'headline', type: 'chars', value: headline.length, limit: CAROUSEL_LIMITS.headlineChars })
  }
  if (bodyWords > CAROUSEL_LIMITS.bodyWords) {
    warnings.push({ field: 'body', type: 'words', value: bodyWords, limit: CAROUSEL_LIMITS.bodyWords })
  }
  if (body.length > CAROUSEL_LIMITS.bodyChars) {
    warnings.push({ field: 'body', type: 'chars', value: body.length, limit: CAROUSEL_LIMITS.bodyChars })
  }

  return {
    headline,
    body,
    headlineWords,
    bodyWords,
    headlineChars: headline.length,
    bodyChars: body.length,
    warnings,
    isOverLimit: warnings.length > 0,
  }
}

export function analyzeAllSlides(slides) {
  const contentSlides = (slides || []).filter((s) => (s.layout || 'default') !== 'section')
  return contentSlides.map((slide) => ({ slideId: slide.id, ...analyzeSlideText(slide) }))
}
