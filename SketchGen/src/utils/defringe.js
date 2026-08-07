import { estimateBackgroundColor } from './imageBackground'

const MAT_LIGHT = { r: 255, g: 255, b: 255 }
const MAT_DARK = { r: 0, g: 0, b: 0 }

function colorDistSq(r, g, b, cr, cg, cb) {
  const dr = r - cr
  const dg = g - cg
  const db = b - cb
  return dr * dr + dg * dg + db * db
}

function clampByte(n) {
  return Math.min(255, Math.max(0, Math.round(n)))
}

function resolveMattingColors(data, width, height, mode) {
  if (mode === 'light') return { primary: MAT_LIGHT, secondary: MAT_DARK }
  if (mode === 'dark') return { primary: MAT_DARK, secondary: MAT_LIGHT }
  const border = estimateBackgroundColor(data, width, height)
  const lum = 0.299 * border.r + 0.587 * border.g + 0.114 * border.b
  if (lum >= 140) return { primary: MAT_LIGHT, secondary: MAT_DARK }
  if (lum <= 115) return { primary: MAT_DARK, secondary: MAT_LIGHT }
  return { primary: border, secondary: lum > 128 ? MAT_DARK : MAT_LIGHT }
}

function pickMatForPixel(r, g, b, mats, mode) {
  if (mode === 'light') return mats.primary
  if (mode === 'dark') return mats.primary
  const dP = colorDistSq(r, g, b, mats.primary.r, mats.primary.g, mats.primary.b)
  const dS = colorDistSq(r, g, b, mats.secondary.r, mats.secondary.g, mats.secondary.b)
  return dP <= dS ? mats.primary : mats.secondary
}

function isNearMatting(r, g, b, mat, tolSq, minAlpha = 6) {
  if (minAlpha > 255) return false
  return colorDistSq(r, g, b, mat.r, mat.g, mat.b) <= tolSq
}

/** Manhattan distance from each pixel to nearest transparent pixel (alpha < 16). */
function distanceToTransparency(data, width, height) {
  const dist = new Int16Array(width * height)
  dist.fill(32767)
  const queue = new Int32Array(width * height * 2)
  let head = 0
  let tail = 0

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x
      if (data[idx * 4 + 3] < 16) {
        dist[idx] = 0
        queue[tail++] = x
        queue[tail++] = y
      }
    }
  }

  while (head < tail) {
    const x = queue[head++]
    const y = queue[head++]
    const base = dist[y * width + x]
    const next = base + 1
    const neighbors = [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ]
    for (const [nx, ny] of neighbors) {
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue
      const nidx = ny * width + nx
      if (data[nidx * 4 + 3] < 8) continue
      if (dist[nidx] <= next) continue
      dist[nidx] = next
      queue[tail++] = nx
      queue[tail++] = ny
    }
  }
  return dist
}

function sampleInteriorColor(data, width, height, x, y, mat, matTolSq, radius = 4) {
  let sr = 0
  let sg = 0
  let sb = 0
  let sw = 0
  for (let ky = -radius; ky <= radius; ky += 1) {
    for (let kx = -radius; kx <= radius; kx += 1) {
      if (kx === 0 && ky === 0) continue
      const sx = x + kx
      const sy = y + ky
      if (sx < 0 || sx >= width || sy < 0 || sy >= height) continue
      const si = (sy * width + sx) * 4
      const sa = data[si + 3]
      if (sa < 180) continue
      const sr0 = data[si]
      const sg0 = data[si + 1]
      const sb0 = data[si + 2]
      if (isNearMatting(sr0, sg0, sb0, mat, matTolSq, sa)) continue
      const spatial = 1 / (1 + Math.hypot(kx, ky))
      const w = (sa / 255) * spatial
      sr += sr0 * w
      sg += sg0 * w
      sb += sb0 * w
      sw += w
    }
  }
  if (sw < 0.04) return null
  return { r: sr / sw, g: sg / sw, b: sb / sw }
}

function decontaminateRgb(r, g, b, a, mat) {
  const af = a / 255
  if (af < 0.03) return { r: 0, g: 0, b: 0, a: 0 }
  let nr = (r - mat.r * (1 - af)) / af
  let ng = (g - mat.g * (1 - af)) / af
  let nb = (b - mat.b * (1 - af)) / af
  return { r: nr, g: ng, b: nb }
}

function smoothAlphaBand(data, width, height, dist, maxDist = 4) {
  const alpha = new Float32Array(width * height)
  for (let i = 0; i < width * height; i += 1) {
    alpha[i] = data[i * 4 + 3]
  }
  const out = new Float32Array(alpha)
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const idx = y * width + x
      if (dist[idx] > maxDist || dist[idx] === 32767) continue
      let sum = 0
      let n = 0
      for (let ky = -1; ky <= 1; ky += 1) {
        for (let kx = -1; kx <= 1; kx += 1) {
          sum += alpha[idx + ky * width + kx]
          n += 1
        }
      }
      out[idx] = sum / n
    }
  }
  for (let i = 0; i < width * height; i += 1) {
    if (dist[i] <= maxDist && dist[i] !== 32767) {
      data[i * 4 + 3] = clampByte(out[i])
    }
  }
}

/**
 * Removes light or dark matte halos on anti-aliased edges (common on generated art).
 */
export function defringeImageData(imageData, width, height, options = {}) {
  const mode = options.mode === 'light' || options.mode === 'dark' ? options.mode : 'auto'
  const strength = Math.min(1, Math.max(0, Number(options.strength) || 0.88))
  const passes = Math.min(4, Math.max(1, Math.round(Number(options.passes) || 3)))
  const fringeRadius = Math.min(8, Math.max(2, Math.round(Number(options.fringeRadius) || 5)))
  const matTol = Number(options.matteTolerance) || 72
  const matTolSq = matTol * matTol

  const { data } = imageData
  const mats = resolveMattingColors(data, width, height, mode)
  const dist = distanceToTransparency(data, width, height)

  for (let pass = 0; pass < passes; pass += 1) {
    const src = new Uint8ClampedArray(data)
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const pidx = y * width + x
        const idx = pidx * 4
        const a = src[idx + 3]
        if (a < 4) continue

        const edgeDist = dist[pidx]
        const inFringe = edgeDist !== 32767 && edgeDist <= fringeRadius
        const semiTrans = a < 252
        if (!inFringe && !(semiTrans && edgeDist !== 32767 && edgeDist <= fringeRadius + 2)) continue

        const r = src[idx]
        const g = src[idx + 1]
        const b = src[idx + 2]
        const mat = pickMatForPixel(r, g, b, mats, mode)
        const nearMat = isNearMatting(r, g, b, mat, matTolSq, a)
        const interior = sampleInteriorColor(src, width, height, x, y, mat, matTolSq)

        if (!nearMat && a > 248 && edgeDist > 2) continue

        let nr = r
        let ng = g
        let nb = b
        let na = a

        if (semiTrans || nearMat) {
          const dec = decontaminateRgb(r, g, b, a, mat)
          const tDec = strength * (nearMat ? 1 : 0.75)
          nr = r * (1 - tDec) + dec.r * tDec
          ng = g * (1 - tDec) + dec.g * tDec
          nb = b * (1 - tDec) + dec.b * tDec
        }

        if (interior) {
          const distMat = Math.sqrt(colorDistSq(r, g, b, mat.r, mat.g, mat.b))
          const distIn = Math.sqrt(colorDistSq(nr, ng, nb, interior.r, interior.g, interior.b))
          if (nearMat || distMat < distIn + 28 || a < 235) {
            const t = strength * (nearMat ? 1 : 0.7)
            nr = nr * (1 - t) + interior.r * t
            ng = ng * (1 - t) + interior.g * t
            nb = nb * (1 - t) + interior.b * t
          }
          if (na < 220 && distIn + 20 < Math.sqrt(colorDistSq(r, g, b, mat.r, mat.g, mat.b))) {
            na = Math.min(255, na + (255 - na) * strength * 0.45)
          }
        } else if (nearMat && na < 80) {
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

  smoothAlphaBand(data, width, height, dist, 3)
  return imageData
}
