export const ARROW_STYLES = [
  { id: 'straight', label: 'Straight' },
  { id: 'double', label: 'Double' },
  { id: 'curved', label: 'Curved' },
  { id: 'dashed', label: 'Dashed' },
  { id: 'chevron', label: 'Chevron' },
]

export const DEFAULT_ARROW_STYLE_ID = 'straight'

export function normalizeArrowStyleId(id) {
  return ARROW_STYLES.some((s) => s.id === id) ? id : DEFAULT_ARROW_STYLE_ID
}

function snapEnd(from, to, shiftKey) {
  if (!shiftKey) return to
  const dx = to.x - from.x
  const dy = to.y - from.y
  const angle = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4)
  const dist = Math.hypot(dx, dy)
  return { x: from.x + Math.cos(angle) * dist, y: from.y + Math.sin(angle) * dist }
}

function headSize(lineWidth) {
  return Math.max(lineWidth * 2.8, 10)
}

function strokeAt(ctx, color, width, dashed) {
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (dashed) ctx.setLineDash([Math.max(6, width * 1.8), Math.max(4, width * 1.2)])
  else ctx.setLineDash([])
}

function filledHead(ctx, tipX, tipY, angle, size, color) {
  const back = angle + Math.PI
  const x1 = tipX + Math.cos(back + 0.45) * size
  const y1 = tipY + Math.sin(back + 0.45) * size
  const x2 = tipX + Math.cos(back - 0.45) * size
  const y2 = tipY + Math.sin(back - 0.45) * size
  ctx.beginPath()
  ctx.moveTo(tipX, tipY)
  ctx.lineTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
}

function chevronHead(ctx, tipX, tipY, angle, size) {
  const back = angle + Math.PI
  const x1 = tipX + Math.cos(back + 0.5) * size
  const y1 = tipY + Math.sin(back + 0.5) * size
  const x2 = tipX + Math.cos(back - 0.5) * size
  const y2 = tipY + Math.sin(back - 0.5) * size
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(tipX, tipY)
  ctx.lineTo(x2, y2)
  ctx.stroke()
}

function insetFromTip(from, to, inset) {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const len = Math.hypot(dx, dy)
  if (len <= inset) return { ...from }
  const t = inset / len
  return { x: from.x + dx * t, y: from.y + dy * t }
}

function insetFromTail(from, to, inset) {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const len = Math.hypot(dx, dy)
  if (len <= inset) return { ...to }
  const t = (len - inset) / len
  return { x: from.x + dx * t, y: from.y + dy * t }
}

function drawTip(ctx, tipX, tipY, angle, size, styleId, color) {
  if (styleId === 'chevron') chevronHead(ctx, tipX, tipY, angle, size)
  else filledHead(ctx, tipX, tipY, angle, size, color)
}

/**
 * Draw an arrow from `from` to `to` on the canvas context.
 */
export function drawArrowShape(ctx, from, to, color, width, styleId, shiftKey) {
  const end = snapEnd(from, to, shiftKey)
  const size = headSize(width)
  const dashed = styleId === 'dashed'
  const double = styleId === 'double'
  const curved = styleId === 'curved'

  strokeAt(ctx, color, width, dashed)

  if (curved) {
    const midX = (from.x + end.x) / 2
    const midY = (from.y + end.y) / 2
    const dx = end.x - from.x
    const dy = end.y - from.y
    const cpx = midX - dy * 0.35
    const cpy = midY + dx * 0.35
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.quadraticCurveTo(cpx, cpy, end.x, end.y)
    ctx.stroke()
    ctx.setLineDash([])
    const endAngle = Math.atan2(end.y - cpy, end.x - cpx)
    drawTip(ctx, end.x, end.y, endAngle, size, styleId, color)
    if (double) {
      const startAngle = Math.atan2(from.y - cpy, from.x - cpx) + Math.PI
      drawTip(ctx, from.x, from.y, startAngle, size, styleId, color)
    }
    return
  }

  const angle = Math.atan2(end.y - from.y, end.x - from.x)
  const inset = size * 0.85
  const lineFrom = double ? insetFromTip(from, end, inset) : from
  const lineTo = insetFromTail(from, end, inset)

  ctx.beginPath()
  ctx.moveTo(lineFrom.x, lineFrom.y)
  ctx.lineTo(lineTo.x, lineTo.y)
  ctx.stroke()
  ctx.setLineDash([])

  drawTip(ctx, end.x, end.y, angle, size, styleId, color)
  if (double) drawTip(ctx, from.x, from.y, angle + Math.PI, size, styleId, color)
}
