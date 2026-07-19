/** Strip HTML and decode common entities from slide content. */
export function htmlToPlainText(content) {
  if (!content || typeof content !== 'string') return ''
  return content
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<div[^>]*>\s*/gi, '\n')
    .replace(/<\/div>\s*/gi, '')
    .replace(/<p[^>]*>\s*/gi, '\n')
    .replace(/<\/p>\s*/gi, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
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
