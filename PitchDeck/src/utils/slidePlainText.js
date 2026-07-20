/** Strip HTML and decode common entities from slide content. */
export function decodeBasicHtmlEntities(content) {
  if (!content || typeof content !== 'string') return ''
  return content
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, '\u00A0')
}

/** Collapse accidental double-encoding from contentEditable round-trips. */
export function fixDoubleEncodedEntities(content) {
  if (!content || typeof content !== 'string') return ''
  let prev = ''
  let cur = content
  while (cur !== prev) {
    prev = cur
    cur = cur.replace(/&amp;amp;/g, '&amp;')
  }
  return cur
}

export function htmlToPlainText(content) {
  if (!content || typeof content !== 'string') return ''
  return decodeBasicHtmlEntities(
    content
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<div[^>]*>\s*/gi, '\n')
      .replace(/<\/div>\s*/gi, '')
      .replace(/<p[^>]*>\s*/gi, '\n')
      .replace(/<\/p>\s*/gi, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/<[^>]*>/g, '')
  ).trim()
}

export function getSlidePlainText(slide) {
  if (!slide) return ''
  const main = htmlToPlainText(slide.content || '')
  const subtitle = htmlToPlainText(slide.subtitle || '')
  if (main && subtitle) return `${main}\n${subtitle}`
  return main || subtitle
}

/** Parse bullet lines for bullet layout slides (matches Slide.jsx / PlayMode). */
export function getBulletPointsFromSlide(slide) {
  if (!slide || (slide.layout || 'default') !== 'bulletpoints') return []
  const normalized = (slide.content || '').replace(/<br\s*\/?>/gi, '\n')
  const raw = normalized
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.replace(/^[-•*]\s*/, ''))
    .filter((line) => {
      const plain = line.replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').trim()
      return plain.length > 0
    })
  const seen = new Set()
  return raw.filter((line) => {
    if (seen.has(line)) return false
    seen.add(line)
    return true
  })
}

/** Plain-text body for a single slide (bullets, sections, subtitles). */
export function formatSlideTextBody(slide) {
  if (!slide) return ''
  const layout = slide.layout === 'title' ? 'centered' : (slide.layout || 'default')

  if (layout === 'bulletpoints') {
    const bullets = getBulletPointsFromSlide(slide)
    return bullets.map((b) => `- ${htmlToPlainText(b)}`).join('\n')
  }

  if (layout === 'section') {
    const name = htmlToPlainText(slide.content || '')
    return name ? `[${name}]` : ''
  }

  return getSlidePlainText(slide)
}

/** Format all slide copy for clipboard — plain text with a blank line between slides. */
export function formatSlidesForClipboard(chapters) {
  if (!chapters?.length) return ''

  const slideTexts = []
  for (const chapter of chapters) {
    for (const slide of chapter.slides || []) {
      const body = formatSlideTextBody(slide).trim()
      if (body) slideTexts.push(body)
    }
  }

  return slideTexts.join('\n\n')
}
