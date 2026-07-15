/**
 * Search for images (Giphy, Iconify). Giphy and Iconify support CORS for client-side requests.
 */
export async function searchImages({ service, type, q, apiKeys, offset = 0 }) {
  const query = String(q || '').trim()
  if (!query) return { results: [] }
  const off = Math.max(0, parseInt(offset, 10) || 0)

  if (service === 'giphy') {
    const key = (apiKeys?.giphy || '').trim()
    if (!key) {
      return { results: [], error: 'Giphy API key required. Add it in Settings (gear icon).' }
    }
    try {
      const endpoint = (type || 'stickers') === 'stickers' ? 'stickers/search' : 'gifs/search'
      const res = await fetch(
        `https://api.giphy.com/v1/${endpoint}?api_key=${key}&q=${encodeURIComponent(query)}&limit=24&offset=${off}&rating=g`
      )
      const data = await res.json().catch(() => ({}))
      if (data?.meta?.status >= 400) {
        return { results: [], error: data?.meta?.msg || `Giphy error (${data?.meta?.status})` }
      }
      if (!data?.data || !Array.isArray(data.data)) return { results: [] }
      const results = data.data.map((item) => {
        const imgs = item?.images
        if (!imgs) return null
        const img = (type || 'stickers') === 'gifs'
          ? (imgs?.fixed_height || imgs?.fixed_height_small || imgs?.downsized || imgs?.original)
          : (imgs?.fixed_height_small || imgs?.downsized_small || imgs?.original)
        const url = img?.url || imgs.original?.url
        return url ? { url } : null
      }).filter(Boolean)
      return { results }
    } catch (e) {
      console.error('Giphy error:', e)
      return { results: [], error: e?.message || 'Search failed' }
    }
  }

  if (service === 'iconify') {
    try {
      const res = await fetch(
        `https://api.iconify.design/search?query=${encodeURIComponent(query)}&limit=32&start=${off}`
      )
      if (!res.ok) {
        return { results: [], error: `Iconify error (${res.status})` }
      }
      const data = await res.json().catch(() => ({}))
      const icons = data?.icons
      if (!icons || !Array.isArray(icons)) return { results: [] }
      const results = icons.map((icon) => {
        let prefix, name
        if (typeof icon === 'string') {
          const parts = icon.split(':')
          if (parts.length < 2) return null
          ;[prefix, name] = parts
        } else if (icon?.prefix && icon?.name) {
          prefix = icon.prefix
          name = icon.name
        } else {
          return null
        }
        return { url: `https://api.iconify.design/${prefix}/${name}.svg` }
      }).filter(Boolean)
      return { results }
    } catch (e) {
      console.error('Iconify error:', e)
      return { results: [], error: e?.message || 'Search failed' }
    }
  }

  return { results: [], error: 'Unknown service' }
}
