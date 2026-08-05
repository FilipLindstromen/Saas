/** Copies an image (data URL) to the OS clipboard as real image bytes, not just the URL string. */
export async function copyImageToClipboard(dataUrl) {
  const res = await fetch(dataUrl)
  const blob = await res.blob()
  await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
}
