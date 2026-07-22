/** Tracks background video URLs that have decoded at least once this session. */
const readyUrls = new Set()

export function markVideoUrlReady(url) {
  if (url) readyUrls.add(url)
}

export function isVideoUrlReady(url) {
  return !!(url && readyUrls.has(url))
}
