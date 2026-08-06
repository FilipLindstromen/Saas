/**
 * Light canvas cleanup: boost contrast and snap near-white/near-black for cleaner line art.
 */
export function cleanUpSketchImageData(imageData, width, height) {
  const { data } = imageData
  const out = new Uint8ClampedArray(data.length)

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const a = data[i + 3]
    if (a < 16) {
      out[i] = 255
      out[i + 1] = 255
      out[i + 2] = 255
      out[i + 3] = 255
      continue
    }
    const lum = 0.299 * r + 0.587 * g + 0.114 * b
    let v = (lum - 128) * 1.35 + 128
    v = Math.min(255, Math.max(0, v))
    const ink = v < 200
    const final = ink ? 26 : 255
    out[i] = final
    out[i + 1] = final
    out[i + 2] = final
    out[i + 3] = 255
  }

  const smoothed = new Uint8ClampedArray(out)
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4
      if (out[idx] > 200) continue
      let inkNeighbors = 0
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const j = ((y + ky) * width + (x + kx)) * 4
          if (out[j] < 128) inkNeighbors++
        }
      }
      if (inkNeighbors <= 2) {
        smoothed[idx] = 255
        smoothed[idx + 1] = 255
        smoothed[idx + 2] = 255
      }
    }
  }

  imageData.data.set(smoothed)
  return imageData
}

/** Snap pointer to horizontal or vertical from origin when close to axis. */
export function snapPointToHorizontalVertical(origin, point, thresholdDeg = 14) {
  if (!origin) return point
  const dx = point.x - origin.x
  const dy = point.y - origin.y
  const dist = Math.hypot(dx, dy)
  if (dist < 6) return point
  let deg = (Math.atan2(dy, dx) * 180) / Math.PI
  if (deg < 0) deg += 360
  const nearHorizontal = deg <= thresholdDeg || deg >= 360 - thresholdDeg || Math.abs(deg - 180) <= thresholdDeg
  const nearVertical = Math.abs(deg - 90) <= thresholdDeg || Math.abs(deg - 270) <= thresholdDeg
  if (nearHorizontal) return { x: origin.x + (dx >= 0 ? dist : -dist), y: origin.y }
  if (nearVertical) return { x: origin.x, y: origin.y + (dy >= 0 ? dist : -dist) }
  return point
}
