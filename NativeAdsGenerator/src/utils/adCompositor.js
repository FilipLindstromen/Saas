export const FORMATS = {
  landscape: { id: 'landscape', label: '1920 × 1080', width: 1920, height: 1080 },
  portrait: { id: 'portrait', label: '1080 × 1920', width: 1080, height: 1920 },
  square: { id: 'square', label: '1080 × 1080', width: 1080, height: 1080 },
  instagram: { id: 'instagram', label: '1080 × 1440', width: 1080, height: 1440 },
}

import {
  COPY_VERSION_COUNT,
  DEFAULT_COPY_SLOT,
  createDefaultCopyVersions,
  getActiveCopy,
  normalizeCopyVersions,
} from './copyVersions'

export { COPY_VERSION_COUNT, createDefaultCopyVersions, getActiveCopy, normalizeCopyVersions }

export const FONT_OPTIONS = [
  'DM Sans',
  'Inter',
  'Roboto',
  'Montserrat',
  'Poppins',
  'Oswald',
  'Bebas Neue',
]

export const TEXT_ALIGN_OPTIONS = [
  { id: 'left', label: 'Left' },
  { id: 'center', label: 'Center' },
  { id: 'right', label: 'Right' },
]

export const DEFAULT_TEXT = {
  ...DEFAULT_COPY_SLOT,
  copyVersions: createDefaultCopyVersions(),
  activeCopyVersion: 0,
  showLinkTitle: true,
  linkTitleFontSize: 26,
  linkTitleFontWeight: 600,
  fontFamily: 'Montserrat',
  headlineFontSize: 72,
  copyFontSize: 32,
  fontWeight: 700,
  copyFontWeight: 500,
  color: '#ffffff',
  textAlign: 'center',
  wordWrap: true,
  textPadding: null,
  dropShadow: true,
  shadowBlur: 12,
  shadowOffsetX: 0,
  shadowOffsetY: 4,
  shadowColor: 'rgba(0,0,0,0.65)',
  highlight: false,
  highlightColor: '#ff6b35',
  highlightOpacity: 0.85,
  highlightPadding: 16,
  highlightHeadlineOnly: true,
  showSubheadline: true,
  outline: false,
  outlineColor: '#000000',
  outlineWidth: 3,
  glow: false,
  glowColor: '#ffffff',
  glowBlur: 24,
}

export const DEFAULT_MEDIA = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
}

function getHorizontalPadding(width, text) {
  if (typeof text.textPadding === 'number' && text.textPadding >= 0) {
    return text.textPadding
  }
  return Math.round(width * 0.06)
}

function wrapLongWord(ctx, word, maxWidth) {
  const lines = []
  let current = ''
  for (const char of word) {
    const test = current + char
    if (ctx.measureText(test).width <= maxWidth) {
      current = test
    } else {
      if (current) lines.push(current)
      current = char
    }
  }
  if (current) lines.push(current)
  return lines
}

function wrapParagraph(ctx, paragraph, maxWidth) {
  const words = paragraph.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return []

  const lines = []
  let current = words[0]

  if (ctx.measureText(current).width > maxWidth) {
    const broken = wrapLongWord(ctx, current, maxWidth)
    if (broken.length > 1) {
      lines.push(...broken.slice(0, -1))
      current = broken[broken.length - 1]
    } else {
      current = broken[0] || current
    }
  }

  for (let i = 1; i < words.length; i += 1) {
    const word = words[i]
    const test = `${current} ${word}`
    if (ctx.measureText(test).width <= maxWidth) {
      current = test
      continue
    }

    lines.push(current)

    if (ctx.measureText(word).width > maxWidth) {
      const broken = wrapLongWord(ctx, word, maxWidth)
      lines.push(...broken.slice(0, -1))
      current = broken[broken.length - 1] || ''
    } else {
      current = word
    }
  }

  if (current) lines.push(current)
  return lines
}

function buildTextLines(ctx, rawText, fontSize, fontWeight, fontFamily, maxWidth, wordWrap) {
  if (!rawText?.trim()) return []

  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}, sans-serif`

  if (!wordWrap) {
    return rawText.split('\n').map((line) => line.trim()).filter(Boolean)
  }

  const lines = []
  rawText.split('\n').forEach((paragraph) => {
    const trimmed = paragraph.trim()
    if (!trimmed) return
    lines.push(...wrapParagraph(ctx, trimmed, maxWidth))
  })
  return lines
}

function getTextPositions(align, width, padH, textW, boxW, highlightPad) {
  if (align === 'left') {
    const textX = padH
    const boxX = Math.max(0, padH - highlightPad)
    return { textX, boxX }
  }
  if (align === 'right') {
    const textX = width - padH
    const boxX = width - padH - textW - highlightPad
    return { textX, boxX }
  }
  return {
    textX: width / 2,
    boxX: width / 2 - boxW / 2,
  }
}

/**
 * Draw composed ad to a 2D canvas context.
 */
export function drawAd(ctx, {
  width,
  height,
  backgroundColor = '#000000',
  mediaElement,
  mediaScale = 1,
  mediaOffsetX = 0,
  mediaOffsetY = 0,
  text,
}) {
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = backgroundColor
  ctx.fillRect(0, 0, width, height)

  if (mediaElement) {
    const mw = mediaElement.videoWidth || mediaElement.naturalWidth || 0
    const mh = mediaElement.videoHeight || mediaElement.naturalHeight || 0
    if (mw > 0 && mh > 0) {
      const coverScale = Math.max(width / mw, height / mh) * mediaScale
      const dw = mw * coverScale
      const dh = mh * coverScale
      const dx = (width - dw) / 2 + mediaOffsetX
      const dy = (height - dh) / 2 + mediaOffsetY
      ctx.drawImage(mediaElement, dx, dy, dw, dh)
    }
  }

  const activeCopy = getActiveCopy(text)
  const showSubheadline = text.showSubheadline !== false
  const showLinkTitle = text.showLinkTitle !== false
  const headline = activeCopy.headline?.trim() || ''
  const bodyCopy = activeCopy.copy?.trim() || ''
  const linkTitle = activeCopy.linkTitle?.trim() || ''

  if (!headline && !(showSubheadline && bodyCopy) && !(showLinkTitle && linkTitle)) return

  const fontFamily = text.fontFamily || 'Montserrat'
  const headlineSize = text.headlineFontSize || text.fontSize || 72
  const copySize = text.copyFontSize || Math.round(headlineSize * 0.45)
  const linkTitleSize = text.linkTitleFontSize ?? Math.round(copySize * 0.85)
  const align = text.textAlign || 'center'
  const wordWrap = text.wordWrap !== false
  const padH = getHorizontalPadding(width, text)
  const maxTextWidth = Math.max(40, width - padH * 2)

  const headlineLines = headline
    ? buildTextLines(ctx, headline, headlineSize, text.fontWeight || 700, fontFamily, maxTextWidth, wordWrap)
    : []
  const copyLines = showSubheadline && bodyCopy
    ? buildTextLines(ctx, bodyCopy, copySize, text.copyFontWeight || 500, fontFamily, maxTextWidth, wordWrap)
    : []
  const linkLines = showLinkTitle && linkTitle
    ? buildTextLines(
      ctx,
      linkTitle,
      linkTitleSize,
      text.linkTitleFontWeight ?? 600,
      fontFamily,
      maxTextWidth,
      wordWrap
    )
    : []

  const gap = headlineLines.length && copyLines.length ? headlineSize * 0.35 : 0
  const linkGap = (headlineLines.length || copyLines.length) && linkLines.length
    ? headlineSize * 0.28
    : 0

  const headlineBlockH = headlineLines.length * headlineSize * 1.15
  const copyBlockH = copyLines.length * copySize * 1.3
  const linkBlockH = linkLines.length ? linkLines.length * linkTitleSize * 1.2 + linkGap : 0
  const totalHeight = headlineBlockH + gap + copyBlockH + linkBlockH
  let cursorY = height / 2 - totalHeight / 2

  ctx.textAlign = align

  const drawLine = (line, y, fontSize, fontWeight, useHighlight) => {
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}, sans-serif`
    const metrics = ctx.measureText(line)
    const ascent = metrics.actualBoundingBoxAscent || fontSize * 0.78
    const descent = metrics.actualBoundingBoxDescent || fontSize * 0.22
    const textW = metrics.width
    const textH = ascent + descent
    const highlightPad = useHighlight && text.highlight ? (text.highlightPadding ?? 16) : 0
    const boxH = textH + highlightPad * 2
    const lineH = Math.max(fontSize * 1.15, boxH)
    const blockTop = y + (lineH - boxH) / 2
    const boxW = textW + highlightPad * 2
    const { textX, boxX } = getTextPositions(align, width, padH, textW, boxW, highlightPad)
    const boxY = blockTop
    const baselineY = boxY + highlightPad + ascent

    if (useHighlight && text.highlight) {
      ctx.save()
      ctx.globalAlpha = text.highlightOpacity ?? 0.85
      ctx.fillStyle = text.highlightColor || '#ff6b35'
      ctx.fillRect(boxX, boxY, boxW, boxH)
      ctx.restore()
    }

    if (text.glow) {
      ctx.save()
      ctx.shadowColor = text.glowColor || text.color || '#ffffff'
      ctx.shadowBlur = text.glowBlur ?? 24
      ctx.shadowOffsetX = 0
      ctx.shadowOffsetY = 0
      ctx.fillStyle = text.color || '#ffffff'
      ctx.textBaseline = 'alphabetic'
      ctx.fillText(line, textX, baselineY)
      ctx.restore()
    }

    if (text.outline) {
      ctx.save()
      ctx.strokeStyle = text.outlineColor || '#000000'
      ctx.lineWidth = text.outlineWidth ?? 3
      ctx.lineJoin = 'round'
      ctx.miterLimit = 2
      ctx.textBaseline = 'alphabetic'
      ctx.strokeText(line, textX, baselineY)
      ctx.restore()
    }

    ctx.save()
    if (text.dropShadow) {
      ctx.shadowColor = text.shadowColor || 'rgba(0,0,0,0.65)'
      ctx.shadowBlur = text.shadowBlur ?? 12
      ctx.shadowOffsetX = text.shadowOffsetX ?? 0
      ctx.shadowOffsetY = text.shadowOffsetY ?? 4
    }
    ctx.fillStyle = text.color || '#ffffff'
    ctx.textBaseline = 'alphabetic'
    ctx.fillText(line, textX, baselineY)
    ctx.restore()

    return lineH
  }

  headlineLines.forEach((line) => {
    const highlight = text.highlight && (text.highlightHeadlineOnly !== false)
    const lineH = drawLine(line, cursorY, headlineSize, text.fontWeight || 700, highlight)
    cursorY += lineH
  })

  if (gap) cursorY += gap

  copyLines.forEach((line) => {
    const highlight = text.highlight && text.highlightHeadlineOnly === false
    const lineH = drawLine(line, cursorY, copySize, text.copyFontWeight || 500, highlight)
    cursorY += lineH * 1.15
  })

  if (linkGap) cursorY += linkGap

  linkLines.forEach((line) => {
    drawLine(line, cursorY, linkTitleSize, text.linkTitleFontWeight ?? 600, false)
    cursorY += linkTitleSize * 1.2
  })
}

export async function renderAdToCanvas(options) {
  const { width, height } = options
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  drawAd(ctx, { width, height, ...options })
  return canvas
}

export async function exportCanvasAsPng(canvas, filename = 'native-ad.png') {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to export image'))
        return
      }
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.click()
      URL.revokeObjectURL(url)
      resolve(blob)
    }, 'image/png')
  })
}

export async function copyCanvasToClipboard(canvas) {
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Failed to copy image'))), 'image/png')
  })
  if (!navigator.clipboard?.write) {
    throw new Error('Clipboard API not available in this browser')
  }
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
  return blob
}
