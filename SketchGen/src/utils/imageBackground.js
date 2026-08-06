function loadImageElement(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = dataUrl
  })
}

/** Most common color along the image border (assumed background). */
function estimateBackgroundColor(data, width, height) {
  const buckets = new Map()
  const bucketKey = (r, g, b) => `${r >> 4},${g >> 4},${b >> 4}`

  const sample = (x, y) => {
    const i = (y * width + x) * 4
    const k = bucketKey(data[i], data[i + 1], data[i + 2])
    buckets.set(k, (buckets.get(k) || 0) + 1)
  }

  for (let x = 0; x < width; x += 1) {
    sample(x, 0)
    sample(x, height - 1)
  }
  for (let y = 1; y < height - 1; y += 1) {
    sample(0, y)
    sample(width - 1, y)
  }

  let bestKey = '8,8,8'
  let bestCount = 0
  for (const [k, n] of buckets) {
    if (n > bestCount) {
      bestCount = n
      bestKey = k
    }
  }
  const [rq, gq, bq] = bestKey.split(',').map((n) => parseInt(n, 10))
  return { r: (rq << 4) + 8, g: (gq << 4) + 8, b: (bq << 4) + 8 }
}

function colorDistSq(r, g, b, a, bg, alphaThreshold) {
  if (a < alphaThreshold) return 0
  const dr = r - bg.r
  const dg = g - bg.g
  const db = b - bg.b
  return dr * dr + dg * dg + db * db
}

/**
 * Removes edge-connected pixels that match the detected border background color.
 * Interior regions of the same color stay opaque (e.g. white shapes on gray bg).
 */
export function removeEdgeConnectedBackground(imageData, width, height, { tolerance = 42 } = {}) {
  const { data } = imageData
  const bg = estimateBackgroundColor(data, width, height)
  const tolSq = tolerance * tolerance
  const alphaThreshold = 12
  const visited = new Uint8Array(width * height)
  const queue = new Int32Array(width * height * 2)
  let head = 0
  let tail = 0

  const tryPush = (x, y) => {
    const idx = y * width + x
    if (visited[idx]) return
    const i = idx * 4
    if (colorDistSq(data[i], data[i + 1], data[i + 2], data[i + 3], bg, alphaThreshold) > tolSq) return
    visited[idx] = 1
    queue[tail++] = x
    queue[tail++] = y
  }

  for (let x = 0; x < width; x += 1) {
    tryPush(x, 0)
    tryPush(x, height - 1)
  }
  for (let y = 1; y < height - 1; y += 1) {
    tryPush(0, y)
    tryPush(width - 1, y)
  }

  while (head < tail) {
    const x = queue[head++]
    const y = queue[head++]
    const idx = y * width + x
    const i = idx * 4
    data[i + 3] = 0

    if (x > 0) tryPush(x - 1, y)
    if (x < width - 1) tryPush(x + 1, y)
    if (y > 0) tryPush(x, y - 1)
    if (y < height - 1) tryPush(x, y + 1)
  }

  return imageData
}

export async function dataUrlWithTransparentBackground(dataUrl, options) {
  const img = await loadImageElement(dataUrl)
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0)
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  removeEdgeConnectedBackground(imageData, canvas.width, canvas.height, options)
  ctx.putImageData(imageData, 0, 0)
  return canvas.toDataURL('image/png')
}
