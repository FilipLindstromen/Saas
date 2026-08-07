import { ensureGoogleFontLoaded } from '../constants/brand'

export function createTextItem({
  x,
  y,
  text,
  fontFamily,
  fontSize,
  fontBold,
  color,
}) {
  return {
    id: `txt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    x,
    y,
    text: text.replace(/\r\n/g, '\n'),
    fontFamily,
    fontSize,
    fontBold: Boolean(fontBold),
    color,
  }
}

export async function drawTextItems(ctx, items) {
  if (!items?.length || !ctx) return
  for (const item of items) {
    await drawTextItem(ctx, item)
  }
}

export function drawTextItemsSync(ctx, items) {
  if (!items?.length || !ctx) return
  for (const item of items) {
    drawTextItemSync(ctx, item)
  }
}

export function drawTextItemSync(ctx, item) {
  if (!item?.text || !ctx) return
  const weight = item.fontBold ? 'bold' : 'normal'
  ctx.font = `${weight} ${item.fontSize}px "${item.fontFamily}", sans-serif`
  ctx.fillStyle = item.color || '#1a1a1a'
  ctx.textBaseline = 'top'
  const lines = item.text.split('\n')
  const lineHeight = item.fontSize * 1.25
  lines.forEach((line, i) => {
    ctx.fillText(line, item.x, item.y + i * lineHeight)
  })
}

export async function drawTextItem(ctx, item) {
  if (!item?.text || !ctx) return
  await ensureGoogleFontLoaded(item.fontFamily)
  const weight = item.fontBold ? 'bold' : 'normal'
  ctx.font = `${weight} ${item.fontSize}px "${item.fontFamily}", sans-serif`
  ctx.fillStyle = item.color || '#1a1a1a'
  ctx.textBaseline = 'top'
  const lines = item.text.split('\n')
  const lineHeight = item.fontSize * 1.25
  lines.forEach((line, i) => {
    ctx.fillText(line, item.x, item.y + i * lineHeight)
  })
}

export function measureTextItem(ctx, item) {
  const weight = item.fontBold ? 'bold' : 'normal'
  ctx.font = `${weight} ${item.fontSize}px "${item.fontFamily}", sans-serif`
  const lines = item.text.split('\n')
  const lineHeight = item.fontSize * 1.25
  let maxW = 0
  for (const line of lines) {
    maxW = Math.max(maxW, ctx.measureText(line).width)
  }
  return {
    w: maxW,
    h: lines.length * lineHeight,
  }
}

export function hitTestTextItem(ctx, item, x, y, padding = 4) {
  const { w, h } = measureTextItem(ctx, item)
  return (
    x >= item.x - padding
    && x <= item.x + w + padding
    && y >= item.y - padding
    && y <= item.y + h + padding
  )
}

export function serializeTextItems(items) {
  if (!items?.length) return undefined
  return items.map(({ id, x, y, text, fontFamily, fontSize, fontBold, color }) => ({
    id,
    x,
    y,
    text,
    fontFamily,
    fontSize,
    fontBold,
    color,
  }))
}
