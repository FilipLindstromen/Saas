import { estimateBackgroundColor } from './imageBackground'

function colorDistSq(r, g, b, cr, cg, cb) {
  const dr = r - cr
  const dg = g - cg
  const db = b - cb
  return dr * dr + dg * dg + db * db
}

function clampByte(n) {
  return Math.min(255, Math.max(0, Math.round(n)))
}

function resolveMattingColor(data, width, height, mode) {
  if (mode === 'light') return { r: 255, g: 255, b: 255 }
  if (mode === 'dark') return { r: 0, g: 0, b: 0 }
  const bg = estimateBackgroundColor(data, width, height)
  const lum = 0.299 * bg.r + 0.587 * bg.g + 0.114 * bg.b
  if (lum >= 140) return { r: 255, g: 255, b: 255 }
  if (lum <= 115) return { r: 0, g: 0, b: 0 }
  return bg
}

function isNearMatting(r, g, b, a, mat, tolSq, minAlpha = 8) {
  if (a < minAlpha) return false
  return colorDistSq(r, g, b, mat.r, mat.g, mat.b) <= tolSq
}

function sampleInterior(data, width, height, x, y, mat, matTolSq) {
  let sr = 0
  let sg = 0
  let sb = 0
  let sw = 0
  for (let ky = -2; ky <= 2; ky += 1) {
    for (let kx = -2; kx <= 2; kx += 1) {
      if (kx === 0 && ky === 0) continue
      const sx = x + kx
      const sy = y + ky
      if (sx < 0 || sx >= width || sy < 0 || sy >= height) continue
      const si = (sy * width + sx) * 4
      const sa = data[si + 3]
      if (sa < 160) continue
      const sr0 = data[si]
      const sg0 = data[si + 1]
      const sb0 = data[si + 2]
      if (isNearMatting(sr0, sg0, sb0, sa, mat, matTolSq)) continue
      const w = sa / 255
      sr += sr0 * w
      sg += sg0 * w
      sb += sb0 * w
      sw += w
    }
  }
  if (sw < 0.05) return null
  return { r: sr / sw, g: sg / sw, b: sb / sw }
}

function decontaminateRgb(r, g, b, a, mat) {
  const af = a / 255
  if (af < 0.04) return { r: 0, g: 0, b: 0 }
  const nr = (r - mat.r * (1 - af)) / af
  const ng = (g - mat.g * (1 - af)) / af
  const nb = (b - mat.b * (1 - af)) / af
  return { r: nr, g: ng, b: nb }
}

function isEdgePixel(data, width, height, x, y, alphaEdge = 235) {
  const idx = (y * width + x) * 4
  const a = data[idx + 3]
  if (a < 6) return false
  const neighbors = [
    [x - 1, y],
    [x + 1, y],
    [x, y - 1],
    [x, y + 1],
  ]
  let hasTransparent = false
  let hasSolid = false
  for (const [nx, ny] of neighbors) {
    if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
      hasTransparent = true
      continue
    }
    const na = data[(ny * width + nx) * 4 + 3]
    if (na < 20) hasTransparent = true
    else if (na > alphaEdge) hasSolid = true
  }
  return a < alphaEdge || (hasTransparent && hasSolid)
}

/**
 * Removes light or dark matte halos on anti-aliased edges (common on generated art).
 * @param {'auto'|'light'|'dark'} options.mode — halo color to remove
 * @param {number} options.strength — 0–1 blend toward clean edge colors
 * @param {number} options.passes — processing passes (1–3)
 */
export function defringeImageData(imageData, width, height, options = {}) {
  const mode = options.mode === 'light' || options.mode === 'dark' ? options.mode : 'auto'
  const strength = Math.min(1, Math.max(0, Number(options.strength) || 0.85))
  const passes = Math.min(3, Math.max(1, Math.round(Number(options.passes) || 2)))
  const matTol = Number(options.matteTolerance) || 58
  const matTolSq = matTol * matTol

  const { data } = imageData
  const mat = resolveMattingColor(data, width, height, mode)

  for (let pass = 0; pass < passes; pass += 1) {
    const src = new Uint8ClampedArray(data)
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const idx = (y * width + x) * 4
        const a = src[idx + 3]
        if (a < 4) continue
        if (!isEdgePixel(src, width, height, x, y)) continue

        const r = src[idx]
        const g = src[idx + 1]
        const b = src[idx + 2]
        const nearMat = isNearMatting(r, g, b, a, mat, matTolSq)
        const interior = sampleInterior(src, width, height, x, y, mat, matTolSq)

        if (!nearMat && a > 248) continue

        let nr = r
        let ng = g
        let nb = b
        let na = a

        if (a < 255 && (nearMat || a < 220)) {
          const dec = decontaminateRgb(r, g, b, a, mat)
          nr = dec.r
          ng = dec.g
          nb = dec.b
        }

        if (interior) {
          const distMat = Math.sqrt(colorDistSq(r, g, b, mat.r, mat.g, mat.b))
          const distIn = Math.sqrt(colorDistSq(r, g, b, interior.r, interior.g, interior.b))
          if (nearMat || distMat < distIn + 18 || a < 230) {
            const t = strength * (nearMat ? 1 : 0.65)
            nr = nr * (1 - t) + interior.r * t
            ng = ng * (1 - t) + interior.g * t
            nb = nb * (1 - t) + interior.b * t
            if (a < 200 && distIn + 24 < distMat) {
              na = Math.min(255, a + (255 - a) * strength * 0.35)
            }
          }
        } else if (nearMat && a < 96) {
          na = 0
          nr = 0
          ng = 0
          nb = 0
        }

        data[idx] = clampByte(nr)
        data[idx + 1] = clampByte(ng)
        data[idx + 2] = clampByte(nb)
        data[idx + 3] = clampByte(na)
      }
    }
  }

  return imageData
}

/** Apply defringe within a circular brush on a layer context. */
export function defringeRegion(ctx, cx, cy, radius, options = {}) {
  const pad = 4
  const { width, height } = ctx.canvas
  const x0 = Math.max(0, Math.floor(cx - radius - pad))
  const y0 = Math.max(0, Math.floor(cy - radius - pad))
  const x1 = Math.min(width, Math.ceil(cx + radius + pad))
  const y1 = Math.min(height, Math.ceil(cy + radius + pad))
  const w = x1 - x0
  const h = y1 - y0
  if (w <= 0 || h <= 0) return

  const before = ctx.getImageData(x0, y0, w, h)
  const working = ctx.getImageData(x0, y0, w, h)
  defringeImageData(working, w, h, options)

  const r2 = radius * radius
  const out = before.data
  const fixed = working.data
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const dx = x0 + x - cx
      const dy = y0 + y - cy
      if (dx * dx + dy * dy > r2) continue
      const idx = (y * w + x) * 4
      out[idx] = fixed[idx]
      out[idx + 1] = fixed[idx + 1]
      out[idx + 2] = fixed[idx + 2]
      out[idx + 3] = fixed[idx + 3]
    }
  }
  ctx.putImageData(before, x0, y0)
}
