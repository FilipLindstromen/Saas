import type { OverlayItem, OverlayTextAnimation } from '../types'
import type { CaptionSegment, CaptionWord } from '../services/captions'
import type { CaptionStyle } from '../types'
import type { InfographicProjectData } from './infographicLoader'
import { drawInfographicOnCanvas } from './infographicCanvas'

const TEXT_ANIM_DURATION = 0.3
const STAGGER_PER_WORD = 0.08

function smoothStep(t: number): number {
  const x = Math.max(0, Math.min(1, t))
  return x * x * (3 - 2 * x)
}

function getTextAnimationProgress(
  currentTime: number,
  startTime: number,
  endTime: number
): { inProgress: number; outProgress: number; opacity: number } {
  const inRaw = startTime >= endTime ? 1 : (currentTime - startTime) / TEXT_ANIM_DURATION
  const outRaw = startTime >= endTime ? 1 : (endTime - currentTime) / TEXT_ANIM_DURATION
  const inProgress = Math.max(0, Math.min(1, inRaw))
  const outProgress = Math.max(0, Math.min(1, outRaw))
  const inEased = smoothStep(inProgress)
  const outEased = smoothStep(outProgress)
  return { inProgress, outProgress, opacity: inEased * outEased }
}

function getTextAnimationOffset(
  anim: OverlayTextAnimation,
  width: number,
  height: number,
  currentTime: number,
  startTime: number,
  endTime: number,
  inProgress: number,
  outProgress: number
): { offsetX: number; offsetY: number } {
  const distX = width * 0.05
  const distY = height * 0.03
  let offsetX = 0
  let offsetY = 0
  const inPhase = currentTime < startTime + TEXT_ANIM_DURATION
  const outPhase = currentTime > endTime - TEXT_ANIM_DURATION
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
  }
  return { offsetX, offsetY }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  if (typeof (ctx as CanvasRenderingContext2D & { roundRect?: unknown }).roundRect === 'function') {
    ; (ctx as CanvasRenderingContext2D & { roundRect: (x: number, y: number, w: number, h: number, r: number) => void }).roundRect(x, y, w, h, r)
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

export interface DrawOverlaysOptions {
  textAnimation?: OverlayTextAnimation
  /** Global font settings; used for all text overlays */
  defaultFontFamily?: string
  defaultSecondaryFont?: string
  defaultBold?: boolean
  /** Preloaded image elements for image overlays (avoids creating new Image() each frame) */
  preloadedImages?: Map<string, HTMLImageElement>
  /** Preloaded video elements for video overlays; caller must set currentTime before each draw */
  preloadedVideos?: Map<string, HTMLVideoElement>
  /** Infographic project data keyed by project ID; required for infographic overlays */
  infographicProjects?: Map<string, InfographicProjectData>
  /** Preloaded images for infographic elements (keyed by element id) */
  infographicElementImages?: Map<string, HTMLImageElement>
}

export function drawOverlays(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  overlays: OverlayItem[],
  currentTime: number,
  options: DrawOverlaysOptions = {}
) {
  const textAnimation = options.textAnimation ?? 'none'
  const mainFontDefault = options.defaultFontFamily ?? 'Oswald'
  const secondaryFontDefault = options.defaultSecondaryFont ?? 'Playfair Display'
  const boldDefault = options.defaultBold ?? false
  const active = overlays.filter((o) => currentTime >= o.startTime && currentTime <= o.endTime)
  for (const o of active) {
    if (o.type === 'text' && o.text) {
      ctx.save()
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      const baseX = (o.x ?? 0.1) * width
      const baseY = (o.y ?? 0.1) * height
      const mainFont = mainFontDefault
      const secondaryFont = secondaryFontDefault
      const size = o.fontSizePercent != null
        ? (width * o.fontSizePercent) / 100
        : ((o.fontSize ?? 24) * width) / 1280
      const lineHeight = size * 1.2
      const fullText = o.text
      const ranges = (o.secondaryRanges ?? []).filter((r) => r.start < r.end && r.end <= fullText.length)
      const lines = fullText.split('\n')
      const hasHighlight = !!(o.highlightColor && o.highlightColor.trim())
      const pad = 4

      const wordsByLine: string[][] = lines.map((line) => line.split(/\s+/).filter((w) => w.length > 0))
      const totalWords = wordsByLine.reduce((sum, arr) => sum + arr.length, 0)

      ctx.font = `${size}px "${mainFont}", sans-serif`
      if (o.dropShadow) {
        ctx.shadowBlur = 6
        ctx.shadowOffsetX = 2
        ctx.shadowOffsetY = 2
        ctx.shadowColor = 'rgba(0,0,0,0.6)'
      }

      let globalWordIndex = 0
      ctx.fillStyle = o.color ?? '#ffffff'
      for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const words = wordsByLine[lineIndex]
        const y = baseY + lineIndex * lineHeight
        let x = baseX
        const lineStartChar = lines.slice(0, lineIndex).join('\n').length
        for (let wi = 0; wi < words.length; wi++) {
          const word = words[wi]
          const wordCharStart = lineStartChar + (wi === 0 ? 0 : words.slice(0, wi).join(' ').length + wi)
          const wordStart = o.startTime + globalWordIndex * STAGGER_PER_WORD
          const wordEnd = o.endTime - (totalWords - 1 - globalWordIndex) * STAGGER_PER_WORD
          const { inProgress, outProgress, opacity } = getTextAnimationProgress(currentTime, wordStart, wordEnd)
          const { offsetX, offsetY } = getTextAnimationOffset(
            textAnimation, width, height, currentTime, wordStart, wordEnd, inProgress, outProgress
          )
          const useSecondary = ranges.some((r) => r.start < wordCharStart + word.length && r.end > wordCharStart)
          const boldPrefix = boldDefault ? 'bold ' : ''
          ctx.save()
          if (textAnimation !== 'none') {
            ctx.globalAlpha = opacity
            ctx.translate(offsetX, offsetY)
          }
          ctx.font = useSecondary
            ? `${boldPrefix}${size}px "${secondaryFont}", serif`
            : `${boldPrefix}${size}px "${mainFont}", sans-serif`
          const wordW = ctx.measureText(word).width
          if (hasHighlight) {
            ctx.fillStyle = o.highlightColor!.trim()
            ctx.beginPath()
            roundRect(ctx, x - pad, y - pad, wordW + pad * 2, lineHeight + pad * 2, 4)
            ctx.fill()
            ctx.fillStyle = o.color ?? '#ffffff'
          }
          ctx.fillText(word, x, y)
          const spaceW = wi < words.length - 1 ? ctx.measureText(' ').width : 0
          if (spaceW > 0) {
            ctx.fillText(' ', x + wordW, y)
          }
          ctx.restore()
          x += wordW + spaceW
          globalWordIndex++
        }
      }
      if (o.dropShadow) {
        ctx.shadowBlur = 0
        ctx.shadowOffsetX = 0
        ctx.shadowOffsetY = 0
      }
      ctx.restore()
    }
    if (o.type === 'image' && (o.imageDataUrl || o.imageUrl)) {
      const img = options.preloadedImages?.get(o.id)
      const imgToUse = img ?? (() => {
        const im = new Image()
        im.crossOrigin = 'anonymous'
        im.src = o.imageDataUrl ?? o.imageUrl!
        return im
      })()
      if (imgToUse.complete && imgToUse.naturalWidth) {
        const scale = o.imageScale ?? 1
        const w = o.naturalWidth != null && o.naturalHeight != null
          ? o.naturalWidth * scale
          : imgToUse.naturalWidth * scale
        const h = o.naturalWidth != null && o.naturalHeight != null
          ? o.naturalHeight * scale
          : imgToUse.naturalHeight * scale
        const x = ((o.x ?? 0.5) * width) - w / 2
        const y = ((o.y ?? 0.5) * height) - h / 2
        const cx = x + w / 2
        const cy = y + h / 2
        const rot = (o.rotation ?? 0) * (Math.PI / 180)
        const flip = !!o.flipHorizontal
        if (rot !== 0 || flip) {
          ctx.save()
          ctx.translate(cx, cy)
          if (rot !== 0) ctx.rotate(rot)
          if (flip) ctx.scale(-1, 1)
          ctx.translate(-cx, -cy)
          ctx.drawImage(imgToUse, x, y, w, h)
          ctx.restore()
        } else {
          ctx.drawImage(imgToUse, x, y, w, h)
        }
      }
    }
    if (o.type === 'video' && o.videoUrl) {
      const video = options.preloadedVideos?.get(o.id)
      if (video && video.readyState >= 2) {
        const scale = o.imageScale ?? 1
        const w = (o.naturalWidth ?? video.videoWidth) * scale
        const h = (o.naturalHeight ?? video.videoHeight) * scale
        const x = ((o.x ?? 0.5) * width) - w / 2
        const y = ((o.y ?? 0.5) * height) - h / 2
        const cx = x + w / 2
        const cy = y + h / 2
        const rot = (o.rotation ?? 0) * (Math.PI / 180)
        const flip = !!o.flipHorizontal
        if (rot !== 0 || flip) {
          ctx.save()
          ctx.translate(cx, cy)
          if (rot !== 0) ctx.rotate(rot)
          if (flip) ctx.scale(-1, 1)
          ctx.translate(-cx, -cy)
          ctx.drawImage(video, x, y, w, h)
          ctx.restore()
        } else {
          ctx.drawImage(video, x, y, w, h)
        }
      }
    }
    if (o.type === 'infographic' && o.infographicProjectId) {
      const key = `${o.infographicProjectId}:${o.infographicTabId || 'default'}`
      const projectData = options.infographicProjects?.get(key)
      if (projectData) {
        const timelineDuration = Math.max(0.001, typeof projectData.timelineDuration === 'number' ? projectData.timelineDuration : 10)
        const elapsed = currentTime - o.startTime
        const infographicTime = elapsed >= 0 ? (elapsed % timelineDuration) : 0
        const scale = o.imageScale ?? 1
        const baseW = width
        const baseH = height
        const w = baseW * scale
        const h = baseH * scale
        const x = ((o.x ?? 0.5) * width) - w / 2
        const y = ((o.y ?? 0.5) * height) - h / 2
        const cx = x + w / 2
        const cy = y + h / 2
        const rot = (o.rotation ?? 0) * (Math.PI / 180)
        const flip = !!o.flipHorizontal
        if (rot !== 0 || flip) {
          ctx.save()
          ctx.translate(cx, cy)
          if (rot !== 0) ctx.rotate(rot)
          if (flip) ctx.scale(-1, 1)
          ctx.translate(-cx, -cy)
          drawInfographicOnCanvas(ctx, projectData, infographicTime, x, y, w, h, {
            preloadedImages: options.infographicElementImages,
          })
          ctx.restore()
        } else {
          drawInfographicOnCanvas(ctx, projectData, infographicTime, x, y, w, h, {
            preloadedImages: options.infographicElementImages,
          })
        }
      }
    }
  }
}

const CAPTION_FONT = 'Oswald'

export interface CaptionOptions {
  style: CaptionStyle
  /** In/out animation for the caption block (same options as overlay text) */
  textAnimation?: OverlayTextAnimation
  /** Font size in pixels (used if fontSizePercent not set) */
  fontSize?: number
  /** Font size as % of width (e.g. 2 = 2%); overrides fontSize when set */
  fontSizePercent?: number
  /** Vertical position 0 = top, 1 = bottom; caption block center is placed here */
  captionY?: number
}

/** For word-level timing: text to show at currentTime (words that have started) and words for karaoke. */
function getCaptionDisplay(
  segment: CaptionSegment,
  currentTime: number,
  wordByWord: boolean = false
): { displayText: string; words: CaptionWord[]; currentWord?: CaptionWord } {
  const words = segment.words

  // Word-by-word mode requires word-level timestamps
  if (wordByWord) {
    if (!words || words.length === 0) {
      // No word-level data - show nothing (user needs to re-transcribe)
      return { displayText: '', words: [] }
    }
    // Show only the current word (word being spoken right now)
    const currentWord = words.find((w) => currentTime >= w.start && currentTime < w.end)
    return {
      displayText: currentWord?.word ?? '',
      words,
      currentWord
    }
  }

  // Default modes: show all words that have started, or segment text if no word data
  if (!words || words.length === 0) {
    return { displayText: segment.text, words: [] }
  }
  const visible = words.filter((w) => w.start <= currentTime)
  const displayText = visible.map((w) => w.word).join(' ')
  return { displayText, words }
}

export function drawCaptionStyle(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  segments: CaptionSegment[],
  currentTime: number,
  style: CaptionStyle,
  options: Partial<CaptionOptions> = {}
) {
  const segment = segments.find((s) => currentTime >= s.start && currentTime <= s.end)
  if (!segment) return

  const textAnimation = options.textAnimation ?? 'none'
  const { inProgress, outProgress, opacity } = getTextAnimationProgress(currentTime, segment.start, segment.end)
  const { offsetX, offsetY } = getTextAnimationOffset(
    textAnimation,
    width,
    height,
    currentTime,
    segment.start,
    segment.end,
    inProgress,
    outProgress
  )

  const { displayText, words } = getCaptionDisplay(segment, currentTime, style === 'word-by-word')
  const hasWordTiming = words.length > 0

  const fontSize =
    options.fontSizePercent != null
      ? (width * options.fontSizePercent) / 100
      : (options.fontSize ?? 26)
  const captionYNorm = Math.max(0, Math.min(1, options.captionY ?? 0.85))
  const centerY = height * captionYNorm
  const pad = Math.round(fontSize * 0.85)
  const lineHeight = Math.round(fontSize * 1.4)
  const maxWidth = width - pad * 2
  ctx.save()
  if (textAnimation !== 'none') {
    ctx.globalAlpha = opacity
    ctx.translate(offsetX, offsetY)
  }
  ctx.textAlign = 'center'

  if (style === 'word-by-word') {
    // Show only the current word, large and bold
    ctx.font = `bold ${fontSize}px "${CAPTION_FONT}", sans-serif`
    ctx.fillStyle = '#fff'
    ctx.strokeStyle = '#000'
    ctx.lineWidth = Math.max(3, fontSize / 8)
    ctx.textBaseline = 'middle'
    if (displayText) {
      ctx.strokeText(displayText, width / 2, centerY)
      ctx.fillText(displayText, width / 2, centerY)
    }
  } else if (style === 'lower-third') {
    ctx.font = `bold ${fontSize}px "${CAPTION_FONT}", sans-serif`
    const lines = wrapText(ctx, displayText, maxWidth)
    const boxH = lines.length * lineHeight + pad * 2
    const y = centerY - boxH / 2
    ctx.fillStyle = 'rgba(0,0,0,0.75)'
    ctx.fillRect(0, y, width, boxH)
    ctx.fillStyle = '#fff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    lines.forEach((line, i) => ctx.fillText(line, width / 2, y + pad + i * lineHeight))
  } else if (style === 'centered-subtitle') {
    ctx.font = `${fontSize}px "${CAPTION_FONT}", sans-serif`
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
    ctx.font = `bold ${fontSize}px "${CAPTION_FONT}", sans-serif`
    ctx.textBaseline = 'middle'
    if (hasWordTiming) {
      const spoken = words.filter((w) => w.end <= currentTime)
      const spokenText = spoken.map((w) => w.word).join(' ')
      const fullText = words.map((w) => w.word).join(' ')
      ctx.fillStyle = 'rgba(255,255,255,0.5)'
      ctx.fillText(fullText, width / 2, centerY)
      if (spokenText) {
        const spokenWidth = ctx.measureText(spokenText).width
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
    ctx.font = `${fontSize}px "${CAPTION_FONT}", sans-serif`
    ctx.fillStyle = 'rgba(255,255,255,0.95)'
    ctx.textBaseline = 'middle'
    ctx.fillText(displayText, width / 2, centerY)
  } else if (style === 'yellow-highlight') {
    // Black text on bright yellow blocks, each line in its own block, max 2 lines visible
    const yellowBg = '#FFEB3B'
    const lineGap = Math.round(fontSize * 0.25)
    ctx.font = `bold ${fontSize}px "${CAPTION_FONT}", sans-serif`
    ctx.textBaseline = 'top'
    const lines = wrapText(ctx, displayText, maxWidth)
    const visibleLines = lines.slice(-2)
    const blockPad = Math.round(fontSize * 0.5)
    const radius = 6
    const blockH = lineHeight + blockPad * 2
    const totalH = visibleLines.length * blockH + Math.max(0, visibleLines.length - 1) * lineGap
    const lineWidths = visibleLines.map((line) => ctx.measureText(line).width)
    let y = centerY - totalH / 2
    for (let i = 0; i < visibleLines.length; i++) {
      const line = visibleLines[i]
      const lineW = lineWidths[i]
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
  } else {
    // bold-block
    ctx.font = `bold ${fontSize}px "${CAPTION_FONT}", sans-serif`
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

/** Get the vertical bounds of the caption block for hit-testing (e.g. drag to reposition). */
export function getCaptionBlockRect(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  style: CaptionStyle,
  fontSizeOrPercent: number,
  captionY: number,
  sampleText: string,
  /** If true, fontSizeOrPercent is % of width; else pixels */
  isPercent: boolean = false
): { top: number; height: number } {
  const fontSize = isPercent ? (width * fontSizeOrPercent) / 100 : fontSizeOrPercent
  const captionYNorm = Math.max(0, Math.min(1, captionY))
  const centerY = height * captionYNorm
  const pad = Math.round(fontSize * 0.85)
  const lineHeight = Math.round(fontSize * 1.4)
  const maxWidth = width - pad * 2
  ctx.save()
  ctx.font =
    style === 'centered-subtitle'
      ? `${fontSize}px "${CAPTION_FONT}", sans-serif`
      : `bold ${fontSize}px "${CAPTION_FONT}", sans-serif`
  const lines = wrapText(ctx, sampleText, maxWidth)
  ctx.restore()
  const visibleLineCount = style === 'yellow-highlight' ? Math.min(2, lines.length) : lines.length
  const boxH =
    style === 'lower-third' || style === 'bold-block'
      ? lines.length * lineHeight + pad * 2
      : style === 'yellow-highlight'
        ? visibleLineCount * (lineHeight + pad) + Math.max(0, visibleLineCount - 1) * Math.round(fontSize * 0.25)
        : Math.max(lineHeight * lines.length, pad * 2)
  const top = centerY - boxH / 2
  return { top, height: boxH }
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const test = line ? line + ' ' + w : w
    const m = ctx.measureText(test)
    if (m.width > maxWidth && line) {
      lines.push(line)
      line = w
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  return lines
}
