/**
 * Search for images. Uses server when available, falls back to direct Iconify API
 * when server returns 500 or is unreachable (Iconify allows CORS, no API key needed).
 */
export async function searchImages({ service, type, q, apiKeys, offset = 0 }) {
  const query = String(q || '').trim()
  if (!query) return { results: [] }
  const off = Math.max(0, parseInt(offset, 10) || 0)

  // Try server first
  try {
    const headers = {}
    if (apiKeys?.giphy) headers['X-Giphy-Api-Key'] = apiKeys.giphy
    const res = await fetch(
      `/api/search?service=${service}&type=${type}&q=${encodeURIComponent(query)}&offset=${off}`,
      { headers }
    )
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      return { results: data.results || [] }
    }
    return { results: [], error: data?.error || `Search failed (${res.status})` }
  } catch (_) {
    // Network error - server likely not running
  }

  // Fallback: only use Iconify when user selected Iconify or server is unreachable for Iconify
  if (service === 'giphy') {
    return { results: [] }
  }
  try {
    const res = await fetch(
      `https://api.iconify.design/search?query=${encodeURIComponent(query)}&limit=32&start=${off}`
    )
    const data = await res.json()
    if (!data?.icons || !Array.isArray(data.icons)) return { results: [] }
    const results = data.icons.map((icon) => {
      const parts = String(icon).split(':')
      if (parts.length < 2) return null
      return { url: `https://api.iconify.design/${parts[0]}/${parts[1]}.svg` }
    }).filter(Boolean)
    return { results }
  } catch (e) {
    console.error('Iconify fallback error:', e)
    return { results: [] }
  }
}
