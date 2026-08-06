function hexToRgb(hex) {
  const clean = String(hex || '#ffffff').replace('#', '')
  const num = parseInt(clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean, 16)
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 }
}

/**
 * Split non-background pixels into connected components (8-connected).
 * Returns bounding boxes and cropped RGBA buffers for each region.
 */
export function separateIntoParts(imageData, width, height, backgroundHex, options = {}) {
  const { tolerance = 42, minArea = 64, maxParts = 150 } = options
  const data = imageData.data
  const bg = hexToRgb(backgroundHex)
  const tolSq = tolerance * tolerance

  const isForeground = (pixelIndex) => {
    const i = pixelIndex * 4
    const a = data[i + 3]
    if (a < 14) return false
    const dr = data[i] - bg.r
    const dg = data[i + 1] - bg.g
    const db = data[i + 2] - bg.b
    return dr * dr + dg * dg + db * db > tolSq
  }

  const labels = new Int32Array(width * height)
  const components = []
  let nextLabel = 1

  const neighbors = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ]

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const startIdx = y * width + x
      if (labels[startIdx] !== 0 || !isForeground(startIdx)) continue
      if (nextLabel > maxParts) break

      const label = nextLabel
      nextLabel += 1
      labels[startIdx] = label

      let minX = x
      let maxX = x
      let minY = y
      let maxY = y
      let area = 0
      const stack = [startIdx]
      const seen = new Uint8Array(width * height)

      while (stack.length) {
        const cur = stack.pop()
        if (seen[cur]) continue
        seen[cur] = 1
        area += 1
        const cx = cur % width
        const cy = (cur / width) | 0
        if (cx < minX) minX = cx
        if (cx > maxX) maxX = cx
        if (cy < minY) minY = cy
        if (cy > maxY) maxY = cy

        for (const [dx, dy] of neighbors) {
          const nx = cx + dx
          const ny = cy + dy
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue
          const nIdx = ny * width + nx
          if (labels[nIdx] !== 0 || !isForeground(nIdx)) continue
          labels[nIdx] = label
          stack.push(nIdx)
        }
      }

      if (area >= minArea) {
        components.push({ label, minX, minY, maxX, maxY, area })
      } else {
        for (let i = 0; i < labels.length; i += 1) {
          if (labels[i] === label) labels[i] = 0
        }
        nextLabel -= 1
      }
    }
  }

  components.sort((a, b) => b.area - a.area)

  return components.map((comp, index) => {
    const w = comp.maxX - comp.minX + 1
    const h = comp.maxY - comp.minY + 1
    const partData = new Uint8ClampedArray(w * h * 4)
    for (let py = comp.minY; py <= comp.maxY; py += 1) {
      for (let px = comp.minX; px <= comp.maxX; px += 1) {
        const srcIdx = py * width + px
        if (labels[srcIdx] !== comp.label) continue
        const dstIdx = ((py - comp.minY) * w + (px - comp.minX)) * 4
        const si = srcIdx * 4
        partData[dstIdx] = data[si]
        partData[dstIdx + 1] = data[si + 1]
        partData[dstIdx + 2] = data[si + 2]
        partData[dstIdx + 3] = data[si + 3]
      }
    }
    return {
      id: `part-${index + 1}`,
      x: comp.minX,
      y: comp.minY,
      w,
      h,
      imageData: new ImageData(partData, w, h),
    }
  })
}

export function hitTestPartAt(parts, x, y) {
  if (!parts?.length) return null
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const p = parts[i]
    const lx = Math.floor(x - p.x)
    const ly = Math.floor(y - p.y)
    if (lx < 0 || ly < 0 || lx >= p.w || ly >= p.h) continue
    const alpha = p.ctx.getImageData(lx, ly, 1, 1).data[3]
    if (alpha > 12) return p.id
  }
  return null
}
