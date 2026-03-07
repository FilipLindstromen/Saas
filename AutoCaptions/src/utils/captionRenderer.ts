import type { CaptionSegment, CaptionStyle, CaptionAnimation } from '../types'

const ANIM_DURATION = 0.3

function smoothStep(t: number): number {
  const x = Math.max(0, Math.min(1, t))
  return x * x * (3 - 2 * x)
}

function getAnimationProgress(
  currentTime: number,
  startTime: number,
  endTime: number
): { inProgress: number; outProgress: number; opacity: number } {
  const inRaw = startTime >= endTime ? 1 : (currentTime - startTime) / ANIM_DURATION
  const outRaw = startTime >= endTime ? 1 : (endTime - currentTime) / ANIM_DURATION
  const inProgress = Math.max(0, Math.min(1, inRaw))
  const outProgress = Math.max(0, Math.min(1, outRaw))
  const inEased = smoothStep(inProgress)
  const outEased = smoothStep(outProgress)
  return { inProgress, outProgress, opacity: inEased * outEased }
}

function getAnimationTransform(
  anim: CaptionAnimation,
  width: number,
  height: number,
  currentTime: number,
  startTime: number,
  endTime: number,
  inProgress: number,
  outProgress: number
): { scale: number; offsetX: number; offsetY: number } {
  const distX = width * 0.05
  const distY = height * 0.03
  let offsetX = 0
  let offsetY = 0
  let scale = 1
  const inPhase = currentTime < startTime + ANIM_DURATION
  const outPhase = currentTime > endTime - ANIM_DURATION

  if (anim === 'fade-slide-left') {
    if (inPhase) offsetX = -distX * (1 - inProgress)
    else if (outPhase) offsetX = -distX * (1 - outProgress)
  } else if (anim === 'fade-slide-right') {
    if (inPhase) offsetX = distX * (1 - inProgress)
    else if (outPhase) offsetX = distX * (1 - outProgress)
  } else if (anim === 'fade-slide-up') {
    if (inPhase) offsetY = -distY * (1 - inProgress)
    else if (outPhase) offsetY = -distY * (1 - outProgress)
  } else if (anim === 'fade-slide-down') {
    if (inPhase) offsetY = distY * (1 - inProgress)
    else if (outPhase) offsetY = distY * (1 - outProgress)
  } else if (anim === 'scale-in') {
    if (inPhase) scale = 0.3 + 0.7 * inProgress
    else if (outPhase) scale = 0.3 + 0.7 * outProgress
    else scale = 1
  } else if (anim === 'scale-out') {
    if (inPhase) scale = 1
    else if (outPhase) scale = 0.3 + 0.7 * (1 - outProgress)
    else scale = 1
  } else if (anim === 'slide-from-bottom') {
    if (inPhase) offsetY = distY * 2 * (1 - inProgress)
    else if (outPhase) offsetY = distY * 2 * (1 - outProgress)
  } else if (anim === 'bounce') {
    if (inPhase) {
      const t = inProgress
      scale = t < 0.5 ? 1 + 0.2 * (1 - 4 * (t - 0.5) * (t - 0.5)) : 1
    } else if (outPhase) {
      const t = outProgress
      scale = t > 0.5 ? 1 + 0.2 * (1 - 4 * (t - 0.5) * (t - 0.5)) : 1
    }
  }
  return { scale, offsetX, offsetY }
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const test = line ? line + ' ' + w : w
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = w
    } else line = test
  }
  if (line) lines.push(line)
  return lines
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = (ctx as CanvasRenderingContext2D & { roundRect?: (x: number, y: number, w: number, h: number, r: number) => void }).roundRect
  if (typeof rr === 'function') {
    rr.call(ctx, x, y, w, h, r)
    return
  }
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
}

export interface DrawCaptionOptions {
  fontFamily?: string
  fontSizePercent?: number
  captionY?: number
  animation?: CaptionAnimation
  /** When true, apply in/out animation per word (uses word.start/word.end). Requires segment.words. */
  animateByWord?: boolean
}

function getDisplayText(segment: CaptionSegment, currentTime: number, wordByWord: boolean): { displayText: string; words: { word: string; start: number; end: number }[] } {
  const words = segment.words
  if (!words || words.length === 0) return { displayText: segment.text, words: [] }
  if (!wordByWord) return { displayText: segment.text, words }
  const visible = words.filter((w) => w.start <= currentTime)
  return { displayText: visible.map((w) => w.word).join(' '), words }
}

/** Draw caption with per-word in/out animation (animateByWord mode). */
function drawCaptionWordsAnimated(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  segment: CaptionSegment,
  words: { word: string; start: number; end: number }[],
  currentTime: number,
  centerY: number,
  fontSize: number,
  fontFamily: string,
  animation: CaptionAnimation,
  style: CaptionStyle
) {
  ctx.save()
  ctx.font = style === 'centered-subtitle' ? `${fontSize}px "${fontFamily}", sans-serif` : `bold ${fontSize}px "${fontFamily}", sans-serif`
  ctx.textBaseline = 'middle'
  const spaceWidth = ctx.measureText(' ').width
  const wordWidths = words.map((w) => ctx.measureText(w.word).width)
  const totalWidth = wordWidths.reduce((a, b) => a + b, 0) + (words.length - 1) * spaceWidth
  let x = (width - totalWidth) / 2
  for (let i = 0; i < words.length; i++) {
    const w = words[i]
    const { opacity } = getAnimationProgress(currentTime, w.start, w.end)
    const { scale, offsetX, offsetY } = getAnimationTransform(
      animation, width, height, currentTime, w.start, w.end,
      Math.max(0, Math.min(1, (currentTime - w.start) / ANIM_DURATION)),
      Math.max(0, Math.min(1, (w.end - currentTime) / ANIM_DURATION))
    )
    ctx.save()
    ctx.globalAlpha = opacity
    ctx.translate(x + wordWidths[i] / 2, centerY)
    ctx.scale(scale, scale)
    ctx.translate(offsetX, offsetY)
    ctx.translate(-(x + wordWidths[i] / 2), -centerY)
    ctx.fillStyle = '#fff'
    ctx.strokeStyle = '#000'
    ctx.lineWidth = Math.max(2, fontSize / 10)
    ctx.textAlign = 'left'
    ctx.fillText(w.word, x, centerY)
    ctx.strokeText(w.word, x, centerY)
    ctx.restore()
    x += wordWidths[i] + spaceWidth
  }
  ctx.restore()
}

export function drawCaption(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  segments: CaptionSegment[],
  currentTime: number,
  style: CaptionStyle,
  options: DrawCaptionOptions = {}
) {
  const segment = segments.find((s) => currentTime >= s.start && currentTime <= s.end)
  if (!segment) return

  const fontFamily = options.fontFamily ?? 'Oswald'
  const fontSize = options.fontSizePercent != null ? (width * options.fontSizePercent) / 100 : 26
  const captionYNorm = Math.max(0, Math.min(1, options.captionY ?? 0.85))
  const centerY = height * captionYNorm
  const pad = Math.round(fontSize * 0.85)
  const lineHeight = Math.round(fontSize * 1.4)
  const maxWidth = width - pad * 2
  const animation = options.animation ?? 'none'
  const animateByWord = options.animateByWord === true && segment.words && segment.words.length > 0

  const { displayText, words } = getDisplayText(segment, currentTime, style === 'word-by-word')
  const hasWordTiming = words.length > 0

  if (animateByWord && hasWordTiming && animation !== 'none') {
    drawCaptionWordsAnimated(ctx, width, height, segment, words, currentTime, centerY, fontSize, fontFamily, animation, style)
    return
  }

  const { inProgress, outProgress, opacity } = getAnimationProgress(currentTime, segment.start, segment.end)
  const { scale, offsetX, offsetY } = getAnimationTransform(
    animation, width, height, currentTime, segment.start, segment.end, inProgress, outProgress
  )

  ctx.save()
  if (animation !== 'none') {
    ctx.globalAlpha = opacity
    ctx.translate(width / 2, centerY)
    ctx.scale(scale, scale)
    ctx.translate(-width / 2 + offsetX, -centerY + offsetY)
  }
  ctx.textAlign = 'center'

  if (style === 'word-by-word') {
    ctx.font = `bold ${fontSize}px "${fontFamily}", sans-serif`
    ctx.fillStyle = '#fff'
    ctx.strokeStyle = '#000'
    ctx.lineWidth = Math.max(3, fontSize / 8)
    ctx.textBaseline = 'middle'
    if (displayText) {
      ctx.strokeText(displayText, width / 2, centerY)
      ctx.fillText(displayText, width / 2, centerY)
    }
  } else if (style === 'lower-third') {
    ctx.font = `bold ${fontSize}px "${fontFamily}", sans-serif`
    const lines = wrapText(ctx, displayText, maxWidth)
    const boxH = lines.length * lineHeight + pad * 2
    const y = centerY - boxH / 2
    ctx.fillStyle = 'rgba(0,0,0,0.75)'
    ctx.fillRect(0, y, width, boxH)
    ctx.fillStyle = '#fff'
    ctx.textBaseline = 'top'
    lines.forEach((line, i) => ctx.fillText(line, width / 2, y + pad + i * lineHeight))
  } else if (style === 'centered-subtitle') {
    ctx.font = `${fontSize}px "${fontFamily}", sans-serif`
    ctx.fillStyle = '#fff'
    ctx.strokeStyle = '#000'
    ctx.lineWidth = Math.max(2, fontSize / 10)
    ctx.textBaseline = 'middle'
    const lines = wrapText(ctx, displayText, maxWidth)
    const totalH = lines.length * lineHeight
    const startY = centerY - totalH / 2 + lineHeight / 2
    lines.forEach((line, i) => {
      ctx.strokeText(line, width / 2, startY + i * lineHeight)
      ctx.fillText(line, width / 2, startY + i * lineHeight)
    })
  } else if (style === 'karaoke') {
    ctx.font = `bold ${fontSize}px "${fontFamily}", sans-serif`
    ctx.textBaseline = 'middle'
    if (hasWordTiming) {
      const spoken = words.filter((w) => w.end <= currentTime)
      const spokenText = spoken.map((w) => w.word).join(' ')
      const fullText = words.map((w) => w.word).join(' ')
      ctx.fillStyle = 'rgba(255,255,255,0.5)'
      ctx.fillText(fullText, width / 2, centerY)
      if (spokenText) {
        const fullWidth = ctx.measureText(fullText).width
        ctx.fillStyle = '#ffeb3b'
        ctx.textAlign = 'left'
        ctx.fillText(spokenText, width / 2 - fullWidth / 2, centerY)
        ctx.textAlign = 'center'
      }
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.5)'
      ctx.fillText(segment.text, width / 2, centerY)
      ctx.fillStyle = '#ffeb3b'
      ctx.fillText(segment.text, width / 2, centerY)
    }
  } else if (style === 'minimal') {
    ctx.font = `${fontSize}px "${fontFamily}", sans-serif`
    ctx.fillStyle = 'rgba(255,255,255,0.95)'
    ctx.textBaseline = 'middle'
    ctx.fillText(displayText, width / 2, centerY)
  } else if (style === 'yellow-highlight') {
    const yellowBg = '#FFEB3B'
    const lineGap = Math.round(fontSize * 0.25)
    ctx.font = `bold ${fontSize}px "${fontFamily}", sans-serif`
    ctx.textBaseline = 'top'
    const lines = wrapText(ctx, displayText, maxWidth)
    const visibleLines = lines.slice(-2)
    const blockPad = Math.round(fontSize * 0.5)
    const radius = 6
    const blockH = lineHeight + blockPad * 2
    const totalH = visibleLines.length * blockH + Math.max(0, visibleLines.length - 1) * lineGap
    let y = centerY - totalH / 2
    for (const line of visibleLines) {
      const lineW = ctx.measureText(line).width
      const boxW = lineW + blockPad * 2
      const boxH = lineHeight + blockPad * 2
      const x = (width - boxW) / 2
      ctx.fillStyle = yellowBg
      ctx.beginPath()
      roundRect(ctx, x, y, boxW, boxH, radius)
      ctx.fill()
      ctx.fillStyle = '#000'
      ctx.fillText(line, x + blockPad, y + blockPad)
      y += boxH + lineGap
    }
  } else if (style === 'outline') {
    ctx.font = `bold ${fontSize}px "${fontFamily}", sans-serif`
    ctx.strokeStyle = '#000'
    ctx.lineWidth = Math.max(3, fontSize / 6)
    ctx.fillStyle = '#fff'
    ctx.textBaseline = 'middle'
    const lines = wrapText(ctx, displayText, maxWidth)
    const totalH = lines.length * lineHeight
    const startY = centerY - totalH / 2 + lineHeight / 2
    lines.forEach((line, i) => {
      ctx.strokeText(line, width / 2, startY + i * lineHeight)
      ctx.fillText(line, width / 2, startY + i * lineHeight)
    })
  } else if (style === 'box-top') {
    ctx.font = `bold ${fontSize}px "${fontFamily}", sans-serif`
    const lines = wrapText(ctx, displayText, maxWidth)
    const boxH = lines.length * lineHeight + pad * 2
    const y = Math.max(pad, centerY - height * 0.35 - boxH / 2)
    ctx.fillStyle = 'rgba(0,0,0,0.8)'
    ctx.fillRect(pad, y, width - pad * 2, boxH)
    ctx.fillStyle = '#fff'
    ctx.textBaseline = 'top'
    lines.forEach((line, i) => ctx.fillText(line, width / 2, y + pad + i * lineHeight))
  } else if (style === 'typewriter') {
    ctx.font = `${fontSize}px "${fontFamily}", sans-serif`
    ctx.fillStyle = '#fff'
    ctx.strokeStyle = '#000'
    ctx.lineWidth = Math.max(2, fontSize / 10)
    ctx.textBaseline = 'middle'
    ctx.fillText(displayText, width / 2, centerY)
    ctx.strokeText(displayText, width / 2, centerY)
  } else {
    // bold-block
    ctx.font = `bold ${fontSize}px "${fontFamily}", sans-serif`
    const lines = wrapText(ctx, displayText, maxWidth)
    const boxH = lines.length * lineHeight + pad * 2
    const y = centerY - boxH / 2
    ctx.fillStyle = '#000'
    ctx.fillRect(pad, y, width - pad * 2, boxH)
    ctx.fillStyle = '#fff'
    ctx.textBaseline = 'top'
    lines.forEach((line, i) => ctx.fillText(line, width / 2, y + pad + i * lineHeight))
  }

  ctx.restore()
}
