const GIPHY_API = 'https://api.giphy.com/v1'

export interface GiphySticker {
  id: string
  /** Direct URL to the animated GIF (fixed_height, good for overlays) */
  url: string
  width: number
  height: number
  /** Preview/thumbnail URL for grid display */
  previewUrl: string
  title: string
}

export interface GiphyStickerSearchResult {
  data: GiphySticker[]
  totalCount: number
  hasMore: boolean
}

/**
 * Search GIPHY stickers (animated). Requires API key from developers.giphy.com.
 */
export async function searchGiphyStickers(
  apiKey: string,
  query: string,
  limit = 20,
  offset = 0
): Promise<GiphyStickerSearchResult> {
  const params = new URLSearchParams({
    api_key: apiKey,
    q: query.trim() || 'happy',
    limit: String(Math.min(limit, 50)),
    offset: String(offset),
    rating: 'g',
  })
  const res = await fetch(`${GIPHY_API}/stickers/search?${params}`)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(res.status === 401 ? 'Invalid GIPHY API key' : text || `GIPHY API error ${res.status}`)
  }
  const json = (await res.json()) as {
    data?: Array<{
      id: string
      title?: string
      images?: {
        fixed_height?: { url?: string; width?: string; height?: string }
        fixed_height_small?: { url?: string; width?: string; height?: string }
        downsized?: { url?: string }
      }
    }>
    pagination?: { total_count?: number; count?: number; offset?: number }
  }
  const data: GiphySticker[] = (json.data ?? []).map((item) => {
    const img = item.images?.fixed_height ?? item.images?.fixed_height_small ?? item.images?.downsized
    const url = img?.url ?? ''
    const w = parseInt(img?.width ?? '200', 10) || 200
    const h = parseInt(img?.height ?? '200', 10) || 200
    const preview = item.images?.fixed_height_small?.url ?? img?.url ?? ''
    return {
      id: item.id,
      url,
      width: w,
      height: h,
      previewUrl: preview || url,
      title: item.title ?? '',
    }
  })
  const totalCount = json.pagination?.total_count ?? 0
  const hasMore = offset + data.length < totalCount
  return { data, totalCount, hasMore }
}
