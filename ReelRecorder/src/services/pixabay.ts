const PIXABAY_API = 'https://pixabay.com/api'

export interface PixabayVideoHit {
  id: number
  pageURL: string
  type: string
  tags: string
  duration: number
  picture_id: string
  videos: {
    large?: { url: string; width: number; height: number }
    medium?: { url: string; width: number; height: number }
    small?: { url: string; width: number; height: number }
    tiny?: { url: string; width: number; height: number }
  }
  views: number
  downloads: number
  user: string
}

export interface PixabayVideoSearchResult {
  total: number
  totalHits: number
  hits: PixabayVideoHit[]
}

/**
 * Search Pixabay videos. Requires API key from Settings.
 */
export async function searchPixabayVideos(
  apiKey: string,
  query: string,
  page = 1,
  perPage = 15
): Promise<PixabayVideoSearchResult> {
  const params = new URLSearchParams({
    key: apiKey,
    q: query.trim() || 'nature',
    page: String(page),
    per_page: String(Math.min(perPage, 200)),
    video_type: 'all',
  })
  const res = await fetch(`${PIXABAY_API}/videos/?${params}`)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(res.status === 401 ? 'Invalid Pixabay API key' : text || `Pixabay API error ${res.status}`)
  }
  const data = (await res.json()) as { total?: number; totalHits?: number; hits?: PixabayVideoHit[] }
  return {
    total: data.total ?? 0,
    totalHits: data.totalHits ?? 0,
    hits: data.hits ?? [],
  }
}

/** Get best video URL (prefer large, then medium). */
export function getPixabayVideoUrl(hit: PixabayVideoHit): string {
  const v = hit.videos
  return v.large?.url ?? v.medium?.url ?? v.small?.url ?? v.tiny?.url ?? ''
}

export function getPixabayVideoDimensions(hit: PixabayVideoHit): { width: number; height: number } {
  const v = hit.videos
  const src = v.large ?? v.medium ?? v.small ?? v.tiny
  return { width: src?.width ?? 1920, height: src?.height ?? 1080 }
}
