export const FORMATS = {
  landscape: { id: 'landscape', label: '1920 × 1080', width: 1920, height: 1080 },
  portrait: { id: 'portrait', label: '1080 × 1920', width: 1080, height: 1920 },
  square: { id: 'square', label: '1080 × 1080', width: 1080, height: 1080 },
}

export const FONT_OPTIONS = [
  'DM Sans',
  'Inter',
  'Roboto',
  'Montserrat',
  'Poppins',
  'Oswald',
  'Bebas Neue',
]

export const DEFAULT_TEXT = {
  headline: 'Your headline here',
  copy: 'Supporting copy that explains the benefit and invites action.',
  fontFamily: 'Montserrat',
  headlineFontSize: 72,
  copyFontSize: 32,
  fontWeight: 700,
  copyFontWeight: 500,
  color: '#ffffff',
  textAlign: 'center',
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
}

export const DEFAULT_MEDIA = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
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

  if (!text?.headline?.trim() && !(text.showSubheadline !== false && text?.copy?.trim())) return

  const headline = text.headline?.trim() || ''
  const bodyCopy = text.copy?.trim() || ''
  const showSubheadline = text.showSubheadline !== false
  const headlineLines = headline ? headline.split('\n').filter(Boolean) : []
  const copyLines = showSubheadline && bodyCopy ? bodyCopy.split('\n').filter(Boolean) : []

  const headlineSize = text.headlineFontSize || text.fontSize || 72
  const copySize = text.copyFontSize || Math.round(headlineSize * 0.45)
  const gap = headlineLines.length && copyLines.length ? headlineSize * 0.35 : 0

  const headlineBlockH = headlineLines.length * headlineSize * 1.15
  const copyBlockH = copyLines.length * copySize * 1.3
  const totalHeight = headlineBlockH + gap + copyBlockH
  let cursorY = height / 2 - totalHeight / 2

  ctx.textAlign = text.textAlign || 'center'
  ctx.textBaseline = 'top'

  const drawLine = (line, y, fontSize, fontWeight, useHighlight) => {
    ctx.font = `${fontWeight} ${fontSize}px ${text.fontFamily || 'Montserrat'}, sans-serif`
    const metrics = ctx.measureText(line)
    const textWidth = metrics.width
    const lineH = fontSize * 1.15

    if (useHighlight && text.highlight) {
      const pad = text.highlightPadding ?? 16
      const alpha = text.highlightOpacity ?? 0.85
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.fillStyle = text.highlightColor || '#ff6b35'
      const boxW = textWidth + pad * 2
      const boxH = fontSize + pad
      const boxX = width / 2 - boxW / 2
      const boxY = y + (lineH - boxH) / 2
      ctx.fillRect(boxX, boxY, boxW, boxH)
      ctx.restore()
    }

    if (text.dropShadow) {
      ctx.save()
      ctx.shadowColor = text.shadowColor || 'rgba(0,0,0,0.65)'
      ctx.shadowBlur = text.shadowBlur ?? 12
      ctx.shadowOffsetX = text.shadowOffsetX ?? 0
      ctx.shadowOffsetY = text.shadowOffsetY ?? 4
      ctx.fillStyle = text.color || '#ffffff'
      ctx.fillText(line, width / 2, y)
      ctx.restore()
    } else {
      ctx.fillStyle = text.color || '#ffffff'
      ctx.fillText(line, width / 2, y)
    }

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
