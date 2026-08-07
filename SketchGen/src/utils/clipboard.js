function dataUrlToPngBlob(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas unavailable'))
        return
      }
      ctx.drawImage(img, 0, 0)
      canvas.toBlob((blob) => {
        if (blob) resolve(blob)
        else reject(new Error('Could not encode image'))
      }, 'image/png')
    }
    img.onerror = () => reject(new Error('Could not load image'))
    img.src = dataUrl
  })
}

/** Copies a hex color string (e.g. #1a2b3c) to the clipboard. */
export async function copyHexToClipboard(hex) {
  if (!navigator.clipboard?.writeText) {
    throw new Error('Clipboard not supported in this browser')
  }
  await navigator.clipboard.writeText(hex)
}

/** Copies an image (data URL) to the OS clipboard as real image bytes, not just the URL string. */
export async function copyImageToClipboard(dataUrl) {
  if (!navigator.clipboard?.write) {
    throw new Error('Clipboard not supported in this browser')
  }
  const blob = await dataUrlToPngBlob(dataUrl)
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
}
