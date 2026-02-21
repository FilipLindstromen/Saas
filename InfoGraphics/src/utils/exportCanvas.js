import html2canvas from 'html2canvas'

/**
 * Capture the canvas element at full resolution and return a canvas.
 * @param {HTMLElement} canvasEl - The canvas element to capture
 * @param {Object} options - Capture options
 * @param {boolean} options.includeBackground - If false, export with transparent background
 */
export async function captureCanvas(canvasEl, { includeBackground = true } = {}) {
  if (!canvasEl) throw new Error('Canvas element required')
  const prevBg = canvasEl.style.backgroundColor
  if (!includeBackground) {
    canvasEl.style.backgroundColor = 'transparent'
  }
  try {
    return await html2canvas(canvasEl, {
      scale: 1,
      useCORS: true,
      allowTaint: true,
      backgroundColor: includeBackground ? undefined : null,
      logging: false
    })
  } finally {
    if (!includeBackground) {
      canvasEl.style.backgroundColor = prevBg
    }
  }
}

/**
 * Export canvas to PNG and trigger download.
 */
export async function exportToPng(canvasEl, options = {}) {
  const canvas = await captureCanvas(canvasEl, options)
  const link = document.createElement('a')
  link.download = `infographic-${Date.now()}.png`
  link.href = canvas.toDataURL('image/png')
  link.click()
}

/**
 * Export canvas to clipboard at full resolution.
 */
export async function exportToClipboard(canvasEl, options = {}) {
  const canvas = await captureCanvas(canvasEl, options)
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('Failed to create image blob')
  await navigator.clipboard.write([
    new ClipboardItem({ 'image/png': blob })
  ])
}

/**
 * Export canvas data (elements, layout, etc.) as JSON to clipboard.
 * Can be pasted into another tool to restore the canvas.
 */
export async function exportCanvasCodeToClipboard(canvasData) {
  const json = JSON.stringify(canvasData, null, 2)
  await navigator.clipboard.writeText(json)
}

/**
 * Export canvas as a short video (MP4 or WebM).
 * Creates a 2-second static video of the infographic.
 */
export async function exportToMp4(canvasEl, options = {}) {
  const canvas = await captureCanvas(canvasEl, options)
  const stream = canvas.captureStream(30)
  const mimeTypes = ['video/mp4', 'video/webm;codecs=vp9', 'video/webm']
  const mimeType = mimeTypes.find((m) => MediaRecorder.isTypeSupported(m)) || 'video/webm'
  const ext = mimeType.includes('mp4') ? 'mp4' : 'webm'

  return new Promise((resolve, reject) => {
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8000000 })
    const chunks = []

    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data)
    }
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType })
      const link = document.createElement('a')
      link.download = `infographic-${Date.now()}.${ext}`
      link.href = URL.createObjectURL(blob)
      link.click()
      URL.revokeObjectURL(link.href)
      resolve()
    }
    recorder.onerror = () => reject(new Error('Recording failed'))

    recorder.start()
    setTimeout(() => recorder.stop(), 2000)
  })
}
