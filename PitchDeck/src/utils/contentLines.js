/** Split slide HTML content into reveal lines (line-step present mode). */

export function getContentLinesFromHtml(content) {
  if (!content) return ['']
  const normalized = (content + '')
    .replace(/<div[^>]*>\s*/gi, '\n')
    .replace(/<\/div>\s*/gi, '\n')
    .replace(/<p[^>]*>\s*/gi, '\n')
    .replace(/<\/p>\s*/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
  const lines = normalized.split('\n')
  return lines.length ? lines : ['']
}

export function countRevealLines(slide) {
  const lines = getContentLinesFromHtml(slide?.content || '')
  return lines.filter((line) => line.replace(/<[^>]*>/g, '').trim().length > 0).length || lines.length
}

export function getLineStepLineCount(slide) {
  return getContentLinesFromHtml(slide?.content || '').length
}

export function slideUsesLineStepReveal(slide) {
  if (!slide || slide.lineStepReveal !== true) return false
  const layout = slide.layout || 'default'
  if (layout === 'bulletpoints' || layout === 'section') return false
  return countRevealLines(slide) > 1
}
