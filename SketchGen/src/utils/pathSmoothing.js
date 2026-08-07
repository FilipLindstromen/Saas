/** Insert points along long segments so curves have enough resolution before smoothing. */
export function densifyPolyline(points, maxSegment = 4) {
  if (points.length < 2) return points.slice()
  const out = [points[0]]
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]
    const b = points[i]
    const dist = Math.hypot(b.x - a.x, b.y - a.y)
    if (dist <= maxSegment) {
      out.push(b)
      continue
    }
    const steps = Math.ceil(dist / maxSegment)
    for (let s = 1; s <= steps; s += 1) {
      const t = s / steps
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
    }
  }
  return out
}

export function chaikinSmoothClosed(points, iterations = 2) {
  if (points.length < 3) return points.slice()
  let pts = points
  for (let iter = 0; iter < iterations; iter += 1) {
    const next = []
    const n = pts.length
    for (let i = 0; i < n; i += 1) {
      const p0 = pts[i]
      const p1 = pts[(i + 1) % n]
      next.push(
        { x: p0.x * 0.75 + p1.x * 0.25, y: p0.y * 0.75 + p1.y * 0.25 },
        { x: p0.x * 0.25 + p1.x * 0.75, y: p0.y * 0.25 + p1.y * 0.75 },
      )
    }
    pts = next
  }
  return pts
}

export function chaikinSmoothOpen(points, iterations = 1) {
  if (points.length < 3) return points.slice()
  let pts = points
  for (let iter = 0; iter < iterations; iter += 1) {
    const next = [pts[0]]
    for (let i = 0; i < pts.length - 1; i += 1) {
      const p0 = pts[i]
      const p1 = pts[i + 1]
      if (i > 0) {
        next.push({ x: p0.x * 0.75 + p1.x * 0.25, y: p0.y * 0.75 + p1.y * 0.25 })
      }
      if (i < pts.length - 2) {
        next.push({ x: p0.x * 0.25 + p1.x * 0.75, y: p0.y * 0.25 + p1.y * 0.75 })
      }
    }
    next.push(pts[pts.length - 1])
    pts = next
  }
  return pts
}

/** Round lasso/freehand selection polygons before rasterizing or filling. */
export function smoothLassoPolygon(points, { closed = true } = {}) {
  if (!points?.length) return []
  if (points.length < 3) return points.slice()
  const dense = densifyPolyline(points, 3)
  return closed ? chaikinSmoothClosed(dense, 2) : chaikinSmoothOpen(dense, 1)
}

/** Smooth quadratic SVG path for overlay preview (open or closed). */
export function smoothPolylineToSvgPath(points, close = false) {
  if (!points?.length) return ''
  const pts = close ? smoothLassoPolygon(points, { closed: true }) : smoothLassoPolygon(points, { closed: false })
  if (pts.length < 2) return ''
  let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`
  for (let i = 1; i < pts.length; i += 1) {
    const p0 = pts[i - 1]
    const p1 = pts[i]
    const midX = (p0.x + p1.x) / 2
    const midY = (p0.y + p1.y) / 2
    d += ` Q ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} ${midX.toFixed(2)} ${midY.toFixed(2)}`
  }
  if (close && pts.length > 2) {
    const last = pts[pts.length - 1]
    const first = pts[0]
    d += ` Q ${last.x.toFixed(2)} ${last.y.toFixed(2)} ${first.x.toFixed(2)} ${first.y.toFixed(2)} Z`
  } else {
    const last = pts[pts.length - 1]
    d += ` L ${last.x.toFixed(2)} ${last.y.toFixed(2)}`
  }
  return d
}

export function traceSmoothClosedPath(ctx, points) {
  const pts = smoothLassoPolygon(points, { closed: true })
  if (pts.length < 3) return
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i += 1) {
    const p0 = pts[i - 1]
    const p1 = pts[i]
    const midX = (p0.x + p1.x) / 2
    const midY = (p0.y + p1.y) / 2
    ctx.quadraticCurveTo(p0.x, p0.y, midX, midY)
  }
  const last = pts[pts.length - 1]
  const first = pts[0]
  ctx.quadraticCurveTo(last.x, last.y, (last.x + first.x) / 2, (last.y + first.y) / 2)
  ctx.closePath()
}
