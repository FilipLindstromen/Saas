const PEXELS_VIDEOS_API = 'https://api.pexels.com/videos'

export interface PexelsVideoFile {
  id: number
  quality: string
  file_type: string
  width: number
  height: number
  link: string
}

export interface PexelsVideo {
  id: number
  width: number
  height: number
  url: string
  image: string
  duration: number
  video_files: PexelsVideoFile[]
  user: { name: string }
}

export interface PexelsSearchResult {
  page: number
  per_page: number
  videos: PexelsVideo[]
  total_results: number
  next_page?: string
}

/**
 * Search Pexels videos. Requires API key from Settings.
 */
export async function searchPexelsVideos(
  apiKey: string,
  query: string,
  page = 1,
  perPage = 15
): Promise<PexelsSearchResult> {
  const params = new URLSearchParams({
    query: query.trim() || 'nature',
    page: String(page),
    per_page: String(perPage),
  })
  const res = await fetch(`${PEXELS_VIDEOS_API}/search?${params}`, {
    headers: { Authorization: apiKey },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(res.status === 401 ? 'Invalid Pexels API key' : text || `Pexels API error ${res.status}`)
  }
  const data = (await res.json()) as {
    page: number
    per_page: number
    videos?: Array<{
      id: number
      width: number
      height: number
      url: string
      image: string
      duration: number
      video_files?: Array<{
        id: number
        quality: string
        file_type: string
        width: number
        height: number
        link: string
      }>
      user?: { name: string }
    }>
    total_results?: number
    next_page?: string
  }
  const videos: PexelsVideo[] = (data.videos ?? []).map((v) => ({
    id: v.id,
    width: v.width,
    height: v.height,
    url: v.url,
    image: v.image,
    duration: v.duration,
    video_files: v.video_files ?? [],
    user: v.user ?? { name: '' },
  }))
  return {
    page: data.page ?? 1,
    per_page: data.per_page ?? 15,
    videos,
    total_results: data.total_results ?? 0,
    next_page: data.next_page,
  }
}

/** Pick best video file URL (prefer mp4, then reasonable size). */
export function getPexelsVideoUrl(video: PexelsVideo): string {
  const files = video.video_files.filter((f) => f.file_type === 'video/mp4' || f.link.endsWith('.mp4'))
  if (files.length === 0) return video.video_files[0]?.link ?? ''
  const byQuality = (a: PexelsVideoFile, b: PexelsVideoFile) => (b.width * b.height) - (a.width * a.height)
  files.sort(byQuality)
  const mid = Math.min(2, files.length - 1)
  return files[mid]?.link ?? files[0]?.link ?? ''
}
