/**
 * Cheap visual derivatives of one image (no API) — used to pad multi-variant batches
 * when the edits API returns fewer images than requested.
 */

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not load image for local variant'))
    img.src = dataUrl
  })
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n))
}

/** @param {number} variantIndex 1-based index among local-only variants */
function drawLocalVariant(ctx, img, w, h, variantIndex) {
  ctx.clearRect(0, 0, w, h)
  const presets = [
    { scale: 1, brightness: 1.04, hue: 0 },
    { scale: 1.01, brightness: 0.96, hue: 12 },
    { scale: 0.99, brightness: 1.02, hue: -10 },
    { scale: 1.015, brightness: 0.98, hue: 18 },
    { scale: 0.985, brightness: 1.06, hue: -16 },
  ]
  const p = presets[(variantIndex - 1) % presets.length]
  const iw = img.naturalWidth
  const ih = img.naturalHeight
  const baseScale = Math.min(w / iw, h / ih) * p.scale
  const dw = iw * baseScale
  const dh = ih * baseScale
  const dx = (w - dw) / 2 + (variantIndex % 2 === 0 ? 2 : -2)
  const dy = (h - dh) / 2 + (variantIndex % 3 === 0 ? 1 : -1)

  ctx.filter = `brightness(${p.brightness}) hue-rotate(${p.hue}deg) saturate(1.05)`
  ctx.drawImage(img, dx, dy, dw, dh)
  ctx.filter = 'none'
}

/**
 * @param {string} dataUrl
 * @param {number} count — number of local variants to produce
 * @param {{ width: number, height: number }} size
 * @returns {Promise<string[]>}
 */
export async function createLocalImageVariants(dataUrl, count, { width, height }) {
  if (count <= 0) return []
  const img = await loadImage(dataUrl)
  const w = clamp(Math.round(width), 1, 4096)
  const h = clamp(Math.round(height), 1, 4096)
  const out = []
  for (let i = 0; i < count; i += 1) {
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) continue
    drawLocalVariant(ctx, img, w, h, i + 1)
    out.push(canvas.toDataURL('image/png'))
  }
  return out
}
