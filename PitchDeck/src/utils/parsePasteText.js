const PART_SECTION_RE = /^\[([^\]]*)\]$/i
const PART_IN_BRACKETS = /PART/i
const PART_SECTION_BODY_RE = /^PART\s+\d+\s*$/i
const BRACKET_LINE_RE = /^\[([^\]]+)\]$/
const SLIDE_HEADER_LINE_RE = /^\[Slides?\s*\d+\](?:\s*\(([^)]+)\))?\s*$/i
const SLIDE_HEADER_IN_TEXT_RE = /\[Slides?\s*\d+\]/i
const BULLET_LINE_RE = /^\s*-\s*/

function isSlideBracketInstruction(instruction) {
  return /^Slides?\s*\d+/i.test(String(instruction || '').trim())
}

function isPartSectionContent(text) {
  return PART_SECTION_BODY_RE.test(String(text || '').trim())
}

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
  return text
    .replace(/^\uFEFF/, '')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function layoutFromTag(tag) {
  if (!tag) return null
  const t = tag.trim().toLowerCase()
  if (t === 'bullet list' || t === 'bulletpoints' || t === 'bullets') return 'bulletpoints'
  if (t === 'section') return 'section'
  return null
}

export function splitPasteBlocks(text) {
  const normalized = normalizePasteText(text)
  if (SLIDE_HEADER_IN_TEXT_RE.test(normalized)) {
    return normalized
      .split(/(?=\[Slides?\s*\d+\])/i)
      .map((part) => part.trim())
      .filter(Boolean)
  }
  return normalized
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
}

function parseSlideBody(body) {
  const trimmed = body.trim()
  if (!trimmed) return null

  if (isPartSectionContent(trimmed)) {
    return { layout: 'section', content: trimmed }
  }

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

  const lines = trimmed.split('\n')
  const firstLine = (lines[0] || '').trim()

  // Text Edit format: [Slide N] or [Slide N] (section|bullet list)
  const slideHeaderMatch = firstLine.match(SLIDE_HEADER_LINE_RE)
  if (slideHeaderMatch) {
    const layoutTag = slideHeaderMatch[1] || null
    const taggedLayout = layoutFromTag(layoutTag)
    const body = lines.slice(1).join('\n').trim()

    if (taggedLayout === 'section' || isPartSectionContent(body)) {
      if (!body) return null
      return { layout: 'section', content: body }
    }

    if (taggedLayout === 'bulletpoints') {
      const parsed = parseSlideBody(body)
      return {
        layout: 'bulletpoints',
        content: parsed?.content || body.replace(/^\s*-\s*/gm, '').trim(),
      }
    }

    const parsed = parseSlideBody(body)
    if (!parsed) return null
    return parsed
  }

  const sectionMatch = trimmed.match(PART_SECTION_RE)
  if (sectionMatch && PART_IN_BRACKETS.test(sectionMatch[1])) {
    return { layout: 'section', content: sectionMatch[1].trim() }
  }

  const bracketLineMatch = firstLine.match(BRACKET_LINE_RE)
  if (bracketLineMatch && isSlideBracketInstruction(bracketLineMatch[1])) {
    const body = lines.slice(1).join('\n').trim()
    if (isPartSectionContent(body)) {
      return body ? { layout: 'section', content: body } : null
    }
    const parsed = parseSlideBody(body)
    if (!parsed) return null
    return parsed
  }

  const imageInstructionMatch = firstLine.match(BRACKET_LINE_RE)

  if (
    imageInstructionMatch
    && !PART_IN_BRACKETS.test(imageInstructionMatch[1])
    && !isSlideBracketInstruction(imageInstructionMatch[1])
  ) {
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
