function parseHexRgb(hex) {
  const clean = String(hex || '#000000').replace('#', '')
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean
  const num = parseInt(full, 16)
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 }
}

/** Connected pixels matching the color at (startX, startY), same tolerance model as flood fill. */
export function floodSelectMask(rgba, width, height, startX, startY, tolerance = 40) {
  const mask = new Uint8Array(width * height)
  const sx = Math.floor(startX)
  const sy = Math.floor(startY)
  if (sx < 0 || sx >= width || sy < 0 || sy >= height) return mask

  const data = rgba
  const startIdx = (sy * width + sx) * 4
  const startR = data[startIdx]
  const startG = data[startIdx + 1]
  const startB = data[startIdx + 2]
  const startA = data[startIdx + 3]

  const tol2 = tolerance * tolerance
  const matches = (idx) => {
    const dr = data[idx] - startR
    const dg = data[idx + 1] - startG
    const db = data[idx + 2] - startB
    const da = data[idx + 3] - startA
    return dr * dr + dg * dg + db * db + da * da <= tol2
  }

  const stack = [[sx, sy]]
  while (stack.length) {
    const [x, y] = stack.pop()
    if (x < 0 || x >= width || y < 0 || y >= height) continue
    const pixelIdx = y * width + x
    if (mask[pixelIdx]) continue
    const idx = pixelIdx * 4
    if (!matches(idx)) continue
    mask[pixelIdx] = 1
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1])
  }
  return mask
}

export function maskHasPixels(mask) {
  if (!mask?.length) return false
  for (let i = 0; i < mask.length; i += 1) {
    if (mask[i]) return true
  }
  return false
}

/** Fill every selected pixel on the layer with a solid color. */
export function fillMaskOnLayer(ctx, mask, width, height, fillHex) {
  const fill = parseHexRgb(fillHex)
  const imageData = ctx.getImageData(0, 0, width, height)
  const data = imageData.data
  for (let i = 0; i < mask.length; i += 1) {
    if (!mask[i]) continue
    const p = i * 4
    data[p] = fill.r
    data[p + 1] = fill.g
    data[p + 2] = fill.b
    data[p + 3] = 255
  }
  ctx.putImageData(imageData, 0, 0)
}

/** After drawing, restore pixels outside the mask from a pre-stroke snapshot. */
export function constrainImageDataToMask(afterImageData, beforeImageData, mask) {
  const a = afterImageData.data
  const b = beforeImageData.data
  for (let i = 0; i < mask.length; i += 1) {
    if (mask[i]) continue
    const p = i * 4
    a[p] = b[p]
    a[p + 1] = b[p + 1]
    a[p + 2] = b[p + 2]
    a[p + 3] = b[p + 3]
  }
}

export function deletePixelsInMask(ctx, mask, width, height) {
  const imageData = ctx.getImageData(0, 0, width, height)
  const data = imageData.data
  for (let i = 0; i < mask.length; i += 1) {
    if (!mask[i]) continue
    const p = i * 4
    data[p] = 0
    data[p + 1] = 0
    data[p + 2] = 0
    data[p + 3] = 0
  }
  ctx.putImageData(imageData, 0, 0)
}

export function polygonToSvgPath(points, close = true) {
  if (!points?.length) return ''
  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 1; i < points.length; i += 1) {
    d += ` L ${points[i].x} ${points[i].y}`
  }
  if (close && points.length > 2) d += ' Z'
  return d
}

export function rectToPolygon(from, to) {
  const x0 = Math.min(from.x, to.x)
  const y0 = Math.min(from.y, to.y)
  const x1 = Math.max(from.x, to.x)
  const y1 = Math.max(from.y, to.y)
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ]
}

/** Rasterize a closed polygon into a full-canvas binary mask (1 = selected). */
export function maskFromPolygon(points, width, height) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!points.length) return new Uint8Array(width * height)
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i].x, points[i].y)
  }
  ctx.closePath()
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  const data = ctx.getImageData(0, 0, width, height).data
  const mask = new Uint8Array(width * height)
  for (let i = 0; i < mask.length; i += 1) {
    if (data[i * 4 + 3] > 127) mask[i] = 1
  }
  return mask
}

export function maskBoundingBox(mask, width, height) {
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!mask[y * width + x]) continue
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  if (maxX < minX || maxY < minY) return null
  return { minX, minY, maxX, maxY }
}

/**
 * Cut masked pixels from layer into a floating canvas; clears them on the layer.
 */
export function liftMaskedRegion(layerCtx, mask, width, height) {
  const bbox = maskBoundingBox(mask, width, height)
  if (!bbox) return null
  const { minX, minY, maxX, maxY } = bbox
  const w = maxX - minX + 1
  const h = maxY - minY + 1
  const layerData = layerCtx.getImageData(0, 0, width, height)
  const src = layerData.data
  const floatData = new Uint8ClampedArray(w * h * 4)
  const localMask = new Uint8Array(w * h)

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const gx = minX + x
      const gy = minY + y
      const mi = gy * width + gx
      if (!mask[mi]) continue
      const si = mi * 4
      const di = (y * w + x) * 4
      floatData[di] = src[si]
      floatData[di + 1] = src[si + 1]
      floatData[di + 2] = src[si + 2]
      floatData[di + 3] = src[si + 3]
      localMask[y * w + x] = 1
      src[si] = 0
      src[si + 1] = 0
      src[si + 2] = 0
      src[si + 3] = 0
    }
  }

  layerCtx.putImageData(layerData, 0, 0)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const fctx = canvas.getContext('2d')
  fctx.putImageData(new ImageData(floatData, w, h), 0, 0)

  return {
    x: minX,
    y: minY,
    w,
    h,
    canvas,
    ctx: fctx,
    localMask,
    outline: [
      { x: minX, y: minY },
      { x: maxX + 1, y: minY },
      { x: maxX + 1, y: maxY + 1 },
      { x: minX, y: maxY + 1 },
    ],
  }
}

export function hitTestFloatingSelection(floating, x, y) {
  if (!floating) return false
  const lx = Math.floor(x - floating.x)
  const ly = Math.floor(y - floating.y)
  if (lx < 0 || ly < 0 || lx >= floating.w || ly >= floating.h) return false
  const alpha = floating.ctx.getImageData(lx, ly, 1, 1).data[3]
  return alpha > 12
}

export function serializeFloatingSelection(floating) {
  if (!floating) return null
  return {
    layerId: floating.layerId,
    x: floating.x,
    y: floating.y,
    w: floating.w,
    h: floating.h,
    rotation: floating.rotation || 0,
    imageData: floating.ctx.getImageData(0, 0, floating.w, floating.h),
  }
}

export function deserializeFloatingSelection(saved) {
  if (!saved) return null
  const canvas = document.createElement('canvas')
  canvas.width = saved.w
  canvas.height = saved.h
  const ctx = canvas.getContext('2d')
  ctx.putImageData(saved.imageData, 0, 0)
  return {
    layerId: saved.layerId,
    x: saved.x,
    y: saved.y,
    w: saved.w,
    h: saved.h,
    rotation: saved.rotation || 0,
    canvas,
    ctx,
    outline: [
      { x: saved.x, y: saved.y },
      { x: saved.x + saved.w, y: saved.y },
      { x: saved.x + saved.w, y: saved.y + saved.h },
      { x: saved.x, y: saved.y + saved.h },
    ],
  }
}
