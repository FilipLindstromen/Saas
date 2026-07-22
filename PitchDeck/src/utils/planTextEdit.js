import { htmlToPlainText, getBulletPointsFromSlide } from './slidePlainText'
import { prepareBulletLayoutContent } from './bulletStyles'

const SLIDE_HEADER_RE = /^\[Slide\s+\d+\](?:\s*\(([^)]+)\))?\s*$/i

export function plainTextToSlideStorage(text) {
  if (!text || typeof text !== 'string') return ''
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')
}

function normalizeLayout(layout) {
  if (layout === 'title') return 'centered'
  return layout || 'default'
}

function layoutFromTag(tag) {
  if (!tag) return null
  const t = tag.trim().toLowerCase()
  if (t === 'bullet list' || t === 'bulletpoints' || t === 'bullets') return 'bulletpoints'
  if (t === 'section') return 'section'
  return null
}

function layoutToTag(layout) {
  const normalized = normalizeLayout(layout)
  if (normalized === 'bulletpoints') return ' (bullet list)'
  if (normalized === 'section') return ' (section)'
  return ''
}

export function createEmptySlide(id) {
  return {
    id,
    content: '',
    subtitle: '',
    imageUrl: '',
    layout: 'default',
    gradientStrength: 0.7,
    flipHorizontal: false,
    backgroundOpacity: 0.6,
    gradientFlipped: false,
    imageScale: 1.0,
    imagePositionX: 50,
    imagePositionY: 50,
    textHeadingLevel: null,
    subtitleHeadingLevel: null,
  }
}

/** Serialize slides to the plan Text Edit format. */
export function formatSlidesForTextEdit(slides) {
  if (!slides?.length) return ''

  return slides
    .map((slide, index) => {
      const layout = normalizeLayout(slide.layout)
      const header = `[Slide ${index + 1}]${layoutToTag(layout)}`
      let body = ''

      if (layout === 'bulletpoints') {
        body = getBulletPointsFromSlide(slide)
          .map((bullet) => `- ${htmlToPlainText(bullet)}`)
          .join('\n')
      } else if (layout === 'section') {
        body = htmlToPlainText(slide.content || '')
      } else {
        body = htmlToPlainText(slide.content || '')
      }

      return body.trim() ? `${header}\n${body.trim()}` : header
    })
    .join('\n\n')
}

function parseSlideBody(body, layout) {
  const trimmed = body.trim()
  if (layout === 'bulletpoints') {
    const lines = trimmed
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
    const bullets = lines
      .map((line) => line.replace(/^[-•*]\s*/, '').trim())
      .filter(Boolean)
    return plainTextToSlideStorage(bullets.join('\n'))
  }
  return plainTextToSlideStorage(trimmed)
}

/** Parse Text Edit document into slides, preserving metadata from existing slides by position. */
export function parseTextEditToSlides(text, existingSlides = [], nextIdStart = 1) {
  const normalized = (text || '').replace(/\r\n/g, '\n').trim()
  if (!normalized) return []

  const parts = normalized.split(/(?=\[Slide\s+\d+\])/i).map((part) => part.trim()).filter(Boolean)
  const blocks = []

  for (const part of parts) {
    const lines = part.split('\n')
    const headerLine = (lines[0] || '').trim()
    const headerMatch = headerLine.match(SLIDE_HEADER_RE)
    if (!headerMatch) continue

    const body = lines.slice(1).join('\n').trim()
    blocks.push({
      layoutTag: headerMatch[1] || null,
      body,
    })
  }

  let nextId = nextIdStart

  return blocks.map((block, index) => {
    const existing = existingSlides[index] || null
    const hasLayoutTag = block.layoutTag != null && String(block.layoutTag).trim() !== ''
    const layoutFromHeader = hasLayoutTag ? layoutFromTag(block.layoutTag) : null

    let layout = 'default'
    if (layoutFromHeader) {
      layout = layoutFromHeader
    } else if (existing) {
      const existingLayout = normalizeLayout(existing.layout || 'default')
      // Tag removed (or absent): section/bullet list tags control layout — without them, revert to default
      if (existingLayout !== 'section' && existingLayout !== 'bulletpoints') {
        layout = existingLayout
      }
    }

    let content = parseSlideBody(block.body, layout)

    if (layout === 'bulletpoints') {
      content = prepareBulletLayoutContent(content.replace(/<br\s*\/?>/gi, '\n'))
    }

    if (existing) {
      return {
        ...existing,
        layout,
        content,
      }
    }

    const slide = createEmptySlide(nextId++)
    slide.layout = layout
    slide.content = content
    return slide
  })
}

export function getNextSlideId(slides, chapters) {
  const allIds = []
  if (chapters?.length) {
    chapters.forEach((chapter) => {
      chapter.slides?.forEach((slide) => allIds.push(slide.id))
    })
  } else if (slides?.length) {
    slides.forEach((slide) => allIds.push(slide.id))
  }
  return Math.max(0, ...allIds) + 1
}
