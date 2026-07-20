function pickPexelsLink(video) {
  const files = video.video_files || []
  const mp4 = files.filter((f) => (f.file_type || '').includes('mp4'))
  const hd = mp4.find((f) => (f.quality || '').toLowerCase() === 'hd')
  const sd = mp4.find((f) => (f.quality || '').toLowerCase() === 'sd')
  return (hd || sd || mp4[0] || files[0])?.link || ''
}

function pickPixabayLink(hit) {
  const v = hit.videos || {}
  return v.large?.url || v.medium?.url || v.small?.url || ''
}

export async function searchStockVideo({ query, pexelsKey, pixabayKey }) {
  const q = String(query || '').trim()
  if (!q) return { url: null, error: 'Empty search query' }

  const hasPexels = !!(pexelsKey && pexelsKey.trim())
  const hasPixabay = !!(pixabayKey && pixabayKey.trim())
  if (!hasPexels && !hasPixabay) {
    return { url: null, error: 'Pexels or Pixabay API key required' }
  }

  if (hasPexels) {
    try {
      const res = await fetch(
        `https://api.pexels.com/videos/search?query=${encodeURIComponent(q)}&per_page=5&page=1`,
        { headers: { Authorization: pexelsKey.trim() } }
      )
      if (res.ok) {
        const data = await res.json()
        const first = (data.videos || []).find((v) => pickPexelsLink(v))
        const url = first ? pickPexelsLink(first) : ''
        if (url) return { url }
      }
    } catch (e) {
      console.error('Pexels video search failed:', e)
    }
  }

  if (hasPixabay) {
    try {
      const res = await fetch(
        `https://pixabay.com/api/videos/?key=${encodeURIComponent(pixabayKey.trim())}&q=${encodeURIComponent(q)}&page=1&per_page=5`
      )
      if (res.ok) {
        const data = await res.json()
        const first = (data.hits || []).find((h) => pickPixabayLink(h))
        const url = first ? pickPixabayLink(first) : ''
        if (url) return { url }
      }
    } catch (e) {
      console.error('Pixabay video search failed:', e)
    }
  }

  return { url: null }
}
