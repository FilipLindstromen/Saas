/**
 * Iconify public API — free SVG icon search (no API key).
 * @see https://iconify.design/docs/api/
 */

export async function searchIconifyIcons(query, limit = 32, start = 0) {
  const q = (query || '').trim()
  if (!q) return { data: [], total: 0 }

  const params = new URLSearchParams({
    query: q,
    limit: String(Math.min(Math.max(limit, 1), 64)),
    start: String(Math.max(0, start)),
  })
  const res = await fetch(`https://api.iconify.design/search?${params}`)
  if (!res.ok) {
    throw new Error(res.status === 429 ? 'Too many searches — try again in a moment.' : `Icon search failed (${res.status})`)
  }
  const json = await res.json()
  const icons = json?.icons
  if (!Array.isArray(icons)) return { data: [], total: 0 }

  const data = icons
    .map((icon) => {
      let prefix
      let name
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
      const id = `${prefix}:${name}`
      return {
        id,
        prefix,
        name,
        label: name.replace(/-/g, ' '),
        url: `https://api.iconify.design/${prefix}/${name}.svg`,
        previewUrl: `https://api.iconify.design/${prefix}/${name}.svg?color=%23888888`,
      }
    })
    .filter(Boolean)

  return {
    data,
    total: json?.total ?? data.length,
  }
}
