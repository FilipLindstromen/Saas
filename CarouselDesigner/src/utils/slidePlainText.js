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
