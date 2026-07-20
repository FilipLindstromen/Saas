export async function searchUnsplashImage(query, unsplashKey, orientation = 'landscape') {
  const q = String(query || '').trim()
  if (!q || !unsplashKey?.trim()) return null

  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=1&orientation=${orientation}`,
      { headers: { Authorization: `Client-ID ${unsplashKey.trim()}` } }
    )
    if (!res.ok) return null
    const data = await res.json()
    return data?.results?.[0]?.urls?.regular || null
  } catch (error) {
    console.error('Unsplash search failed:', error)
    return null
  }
}
