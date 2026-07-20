const PART_SECTION_RE = /^\[([^\]]*)\]$/i
const PART_IN_BRACKETS = /PART/i
const BRACKET_LINE_RE = /^\[([^\]]+)\]$/
const BULLET_LINE_RE = /^\s*-\s*/

/** Turn bracket instruction like "Person thinking" into an Unsplash-friendly query. */
export function formatImageSearchQuery(instruction) {
  const q = String(instruction || '').trim()
  if (!q) return ''
  const lower = q.toLowerCase()
  if (/^(a|an|the)\s/.test(lower)) return lower
  return `a ${lower}`
}

/** Collapse 3+ line breaks down to 2 before splitting slides. */
export function normalizePasteText(text) {
  if (!text || typeof text !== 'string') return ''
  return text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}

export function splitPasteBlocks(text) {
  return normalizePasteText(text)
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
}

function parseSlideBody(body) {
  const trimmed = body.trim()
  if (!trimmed) return null

  const lines = trimmed.split('\n').map((line) => line.trim()).filter(Boolean)
  const isBulletBlock = lines.length > 0 && lines.every((line) => BULLET_LINE_RE.test(line))
  if (isBulletBlock) {
    const bullets = lines.map((line) => line.replace(/^\s*-\s*/, '').trim()).filter(Boolean)
    return { layout: 'bulletpoints', content: bullets.join('\n') }
  }

  return { layout: 'default', content: trimmed }
}

/**
 * Parse one pasted block into slide draft: layout, plain-text content, optional image query.
 */
export function parsePasteBlock(block) {
  const trimmed = block.trim()
  if (!trimmed) return null

  const sectionMatch = trimmed.match(PART_SECTION_RE)
  if (sectionMatch && PART_IN_BRACKETS.test(sectionMatch[1])) {
    return { layout: 'section', content: sectionMatch[1].trim() }
  }

  const lines = trimmed.split('\n')
  const firstLine = (lines[0] || '').trim()
  const imageInstructionMatch = firstLine.match(BRACKET_LINE_RE)

  if (imageInstructionMatch && !PART_IN_BRACKETS.test(imageInstructionMatch[1])) {
    const imageQuery = formatImageSearchQuery(imageInstructionMatch[1])
    const body = lines.slice(1).join('\n').trim()
    const parsed = parseSlideBody(body)
    if (!parsed) return null
    return { ...parsed, imageQuery }
  }

  return parseSlideBody(trimmed)
}

export function parsePasteTextToSlideDrafts(text) {
  return splitPasteBlocks(text).map(parsePasteBlock).filter(Boolean)
}
