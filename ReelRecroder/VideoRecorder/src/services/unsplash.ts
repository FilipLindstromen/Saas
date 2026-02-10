const UNSPLASH_API = 'https://api.unsplash.com'

export interface UnsplashPhoto {
  id: string
  urls: { regular: string; full?: string; raw?: string }
  width: number
  height: number
  alt_description: string | null
  user: { name: string; username: string }
  links: { html: string; download_location?: string }
}

export interface UnsplashSearchResult {
  total: number
  total_pages: number
  results: UnsplashPhoto[]
}

/**
 * Search Unsplash photos. Requires access key from Settings (Unsplash API).
 */
export async function searchUnsplashPhotos(
  accessKey: string,
  query: string,
  page = 1,
  perPage = 20
): Promise<UnsplashSearchResult> {
  const params = new URLSearchParams({
    query: query.trim() || 'nature',
    page: String(page),
    per_page: String(perPage),
  })
  const url = `${UNSPLASH_API}/search/photos?${params}`
  const res = await fetch(url, {
    headers: {
      Authorization: `Client-ID ${accessKey}`,
      'Accept-Version': 'v1',
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(res.status === 401 ? 'Invalid Unsplash Access Key' : text || `Unsplash API error ${res.status}`)
  }
  const data = await res.json()
  return {
    total: data.total ?? 0,
    total_pages: data.total_pages ?? 0,
    results: (data.results ?? []).map((p: Record<string, unknown>) => ({
      id: p.id as string,
      urls: (p.urls as UnsplashPhoto['urls']) ?? {},
      width: (p.width as number) ?? 0,
      height: (p.height as number) ?? 0,
      alt_description: (p.alt_description as string | null) ?? null,
      user: (p.user as UnsplashPhoto['user']) ?? { name: '', username: '' },
      links: (p.links as UnsplashPhoto['links']) ?? { html: '' },
    })),
  }
}

/**
 * Fetch image URL and return as data URL for use as overlay. Optionally trigger
 * Unsplash download tracking (photo.links.download_location).
 */
export async function fetchUnsplashImageAsDataUrl(
  imageUrl: string,
  downloadLocation?: string,
  accessKey?: string
): Promise<string> {
  const res = await fetch(imageUrl, { mode: 'cors' })
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`)
  const blob = await res.blob()
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Failed to read image'))
    reader.readAsDataURL(blob)
  })
  if (downloadLocation && accessKey) {
    try {
      await fetch(`${downloadLocation}&client_id=${accessKey}`)
    } catch {
      // ignore tracking failure
    }
  }
  return dataUrl
}
