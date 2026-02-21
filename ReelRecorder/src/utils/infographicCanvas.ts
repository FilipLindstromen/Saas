/**
 * Draw infographic project on canvas. Used for preview, recording, and export.
 * Matches InfoGraphics/PitchDeck InfographicBackground behavior.
 */
import type { InfographicProjectData } from './infographicLoader'

const ANIMATION_DURATION = 0.5

function smoothStep(t: number): number {
  const x = Math.max(0, Math.min(1, t))
  return x * x * (3 - 2 * x)
}

function getCanvasSize(aspectRatio: string, resolution: number): { w: number; h: number } {
  const r = resolution || 800
  if (aspectRatio === '16:9') return { w: r, h: Math.round((r * 9) / 16) }
  if (aspectRatio === '9:16') return { w: Math.round((r * 9) / 16), h: r }
  if (aspectRatio === '1:1') return { w: r, h: r }
  return { w: r, h: Math.round((r * 9) / 16) }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const roundRectFn = (ctx as CanvasRenderingContext2D & { roundRect?: (x: number, y: number, w: number, h: number, r: number) => void }).roundRect
  if (typeof roundRectFn === 'function') {
    roundRectFn.call(ctx, x, y, w, h, r)
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

// Arrow designs - must match InfoGraphics CanvasElement
const ARROW_DESIGNS: Record<string, { d: string; strokeWidth: number; strokeDasharray?: string; circle?: boolean; fill?: boolean; paths?: Array<{ d: string; fill?: boolean; strokeDasharray?: string }> }> = {
  simple: { d: 'M5 12h14M12 5l7 7-7 7', strokeWidth: 2 },
  thick: { d: 'M5 12h14M12 5l7 7-7 7', strokeWidth: 3 },
  thin: { d: 'M5 12h14M12 5l7 7-7 7', strokeWidth: 1 },
  chevron: { d: 'M9 6l6 6-6 6', strokeWidth: 2 },
  dashed: { d: 'M5 12h14M12 5l7 7-7 7', strokeWidth: 2, strokeDasharray: '4 2' },
  double: { d: 'M4 12h8M16 12h4M12 5l7 7-7 7', strokeWidth: 2 },
  circle: { d: 'M12 8v8M8 12h8', strokeWidth: 2, circle: true },
  filled: { d: 'M5 12h14l-7-7v14z', strokeWidth: 1, fill: true },
}

export interface DrawInfographicOptions {
  /** Preloaded images for element.imageUrl (keyed by element id) */
  preloadedImages?: Map<string, HTMLImageElement>
}

export function drawInfographicOnCanvas(
  ctx: CanvasRenderingContext2D,
  projectData: InfographicProjectData,
  infographicTime: number,
  destX: number,
  destY: number,
  destW: number,
  destH: number,
  options: DrawInfographicOptions = {}
): void {
  if (!projectData?.elements?.length) return

  const elements = projectData.elements
  const aspectRatio = projectData.aspectRatio || '16:9'
  const resolution = projectData.resolution || 800
  const backgroundColor = projectData.backgroundColor || '#ffffff'

  const size = getCanvasSize(aspectRatio, resolution)
  const scaleX = destW / size.w
  const scaleY = destH / size.h
  const scale = Math.min(scaleX, scaleY)
  const drawW = size.w * scale
  const drawH = size.h * scale
  const offsetX = destX + (destW - drawW) / 2
  const offsetY = destY + (destH - drawH) / 2

  const visibleElements = elements
    .filter((el) => {
      if (el.visible === false) return false
      const clipStart = el.clipStart ?? 0
      const clipEnd = el.clipEnd ?? 10
      return infographicTime >= clipStart && infographicTime < clipEnd
    })
    .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))

  ctx.save()
  ctx.translate(offsetX, offsetY)
  ctx.scale(scale, scale)

  // Background
  ctx.fillStyle = backgroundColor
  ctx.fillRect(0, 0, size.w, size.h)

  const preloadedImages = options.preloadedImages ?? new Map()

  for (const el of visibleElements) {
    const clipStart = el.clipStart ?? 0
    const clipEnd = el.clipEnd ?? 10
    const animIn = el.animationIn || 'none'
    const animOut = el.animationOut || 'none'
    const isInPhase = animIn !== 'none' && infographicTime < clipStart + ANIMATION_DURATION
    const isOutPhase = animOut !== 'none' && infographicTime >= clipEnd - ANIMATION_DURATION

    let opacity = 1
    let scaleAnim = 1
    let translateX = 0
    let translateY = 0

    if (isInPhase && animIn !== 'none') {
      const t = (infographicTime - clipStart) / ANIMATION_DURATION
      const eased = smoothStep(Math.max(0, Math.min(1, t)))
      if (animIn.includes('fade')) opacity = eased
      if (animIn.includes('scale')) scaleAnim = 0.8 + 0.2 * eased
      if (animIn.includes('move-x') && !animIn.includes('reverse')) translateX = -40 * (1 - eased)
      if (animIn.includes('move-x-reverse')) translateX = 40 * (1 - eased)
      if (animIn.includes('move-y') && !animIn.includes('reverse')) translateY = -40 * (1 - eased)
      if (animIn.includes('move-y-reverse')) translateY = 40 * (1 - eased)
      if (animIn === 'slide-x') translateX = -60 * (1 - eased)
      if (animIn === 'slide-x-reverse') translateX = 60 * (1 - eased)
      if (animIn === 'slide-y') translateY = -60 * (1 - eased)
      if (animIn === 'slide-y-reverse') translateY = 60 * (1 - eased)
    } else if (isOutPhase && animOut !== 'none') {
      const t = (clipEnd - infographicTime) / ANIMATION_DURATION
      const eased = smoothStep(Math.max(0, Math.min(1, t)))
      if (animOut.includes('fade')) opacity = eased
      if (animOut.includes('scale')) scaleAnim = 0.8 + 0.2 * eased
      if (animOut.includes('move-x') && !animOut.includes('reverse')) translateX = -40 * (1 - eased)
      if (animOut.includes('move-x-reverse')) translateX = 40 * (1 - eased)
      if (animOut.includes('move-y') && !animOut.includes('reverse')) translateY = -40 * (1 - eased)
      if (animOut.includes('move-y-reverse')) translateY = 40 * (1 - eased)
      if (animOut === 'slide-x') translateX = -60 * (1 - eased)
      if (animOut === 'slide-x-reverse') translateX = 60 * (1 - eased)
      if (animOut === 'slide-y') translateY = -60 * (1 - eased)
      if (animOut === 'slide-y-reverse') translateY = 60 * (1 - eased)
    }

    const x = el.x ?? 0
    const y = el.y ?? 0
    const w = el.width ?? 100
    const h = el.height ?? 60
    const rot = el.rotation ?? 0

    ctx.save()
    ctx.globalAlpha = opacity
    ctx.translate(x + w / 2, y + h / 2)
    ctx.translate(translateX, translateY)
    ctx.scale(scaleAnim, scaleAnim)
    ctx.rotate((rot * Math.PI) / 180)
    ctx.translate(-w / 2, -h / 2)

    const color = el.color || '#000000'

    if (el.type === 'image' && el.imageUrl) {
      const img = preloadedImages.get(el.id)
      if (img?.complete && img.naturalWidth) {
        ctx.drawImage(img, 0, 0, w, h)
      }
    } else if (el.type === 'image-text') {
      if (el.imageUrl) {
        const img = preloadedImages.get(el.id)
        if (img?.complete && img.naturalWidth) {
          const imgW = Math.min(w * 0.4, 110)
          ctx.drawImage(img, 0, 0, imgW, h * 0.9)
          ctx.translate(imgW + 8, 0)
        }
      }
      ctx.fillStyle = color
      ctx.font = `${el.fontSize ?? 14}px "${el.fontFamily ?? 'sans-serif'}", sans-serif`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText(el.text || 'Add text', 0, h / 2)
    } else if (el.type === 'headline') {
      ctx.fillStyle = color
      ctx.font = `bold ${el.fontSize ?? 24}px "${el.fontFamily ?? 'sans-serif'}", sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(el.text || 'Headline', w / 2, h / 2)
    } else if (el.type === 'arrow') {
      const dir = el.arrowDirection || 'right'
      const rotDeg = { right: 0, down: 90, left: 180, up: 270 }[dir] ?? 0
      const design = ARROW_DESIGNS[el.arrowStyle || 'simple'] ?? ARROW_DESIGNS.simple
      ctx.save()
      ctx.translate(w / 2, h / 2)
      ctx.rotate((rotDeg * Math.PI) / 180)
      ctx.translate(-12, -12)
      ctx.strokeStyle = color
      ctx.fillStyle = color
      ctx.lineWidth = design.strokeWidth ?? 2
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      if (design.strokeDasharray) ctx.setLineDash([4, 2])
      if (design.circle) {
        ctx.beginPath()
        ctx.arc(12, 12, 8, 0, Math.PI * 2)
        ctx.stroke()
      }
      try {
        const path = new Path2D(design.d)
        if (design.fill) ctx.fill(path)
        else ctx.stroke(path)
      } catch {
        ctx.stroke(new Path2D(design.d))
      }
      ctx.setLineDash([])
      ctx.restore()
    } else if (el.type === 'cta') {
      const bg = el.backgroundColor || '#3b82f6'
      ctx.fillStyle = bg
      ctx.beginPath()
      roundRect(ctx, 0, 0, w, h, 8)
      ctx.fill()
      ctx.fillStyle = '#ffffff'
      ctx.font = `${el.fontSize ?? 16}px "${el.fontFamily ?? 'sans-serif'}", sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(el.text || 'Click Here', w / 2, h / 2)
    } else if (el.type === 'gradient') {
      const gradColor = el.gradientColor || '#000000'
      const grad = ctx.createLinearGradient(0, 0, 0, h)
      grad.addColorStop(0, gradColor)
      grad.addColorStop(1, 'transparent')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, w, h)
    } else {
      // Fallback: text
      ctx.fillStyle = color
      ctx.font = `${el.fontSize ?? 14}px "${el.fontFamily ?? 'sans-serif'}", sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(el.text || '', w / 2, h / 2)
    }

    ctx.restore()
  }

  ctx.restore()
}
