// @ts-ignore - shared module is JS
import { searchPexelsPhotos } from '@shared/stockMedia/pexels'
// @ts-ignore - shared module is JS
import { searchPexelsVideos, pickPexelsVideoUrl } from '@shared/stockMedia/pexelsVideo'
// @ts-ignore - shared module is JS
import { searchPixabayImages, searchPixabayVideos, getPixabayVideoUrl, getPixabayVideoThumb } from '@shared/stockMedia/pixabay'
// @ts-ignore - shared module is JS
import { searchUnsplashPhotos } from '@shared/stockMedia/unsplash'
import type { SearchSourceToggles, StockResult } from '../types'

export type StockApiKeys = { pexels: string; pixabay: string; unsplash: string }

async function safe<T>(fn: () => Promise<T[]>): Promise<T[]> {
  try {
    return await fn()
  } catch {
    return []
  }
}

/** Runs a query across every enabled source/media-type combination and merges the results —
 * shared by the manual search panel and the "auto-fill b-roll" flow, which both need the exact
 * same source logic, just triggered differently. */
export async function searchAllSources(query: string, toggles: SearchSourceToggles, apiKeys: StockApiKeys): Promise<StockResult[]> {
  if (!query.trim()) return []
  const jobs: Promise<StockResult[]>[] = []

  if (toggles.pexels && toggles.image) {
    jobs.push(safe(async () => {
      const { photos } = await searchPexelsPhotos(apiKeys.pexels, query)
      return photos.map((p: any): StockResult => ({
        id: `pexels-i-${p.id}`, type: 'image', source: 'pexels',
        url: p.src?.large2x || p.src?.large || p.src?.original,
        thumbnailUrl: p.src?.medium || p.src?.small,
      }))
    }))
  }
  if (toggles.pexels && toggles.video) {
    jobs.push(safe(async () => {
      const { videos } = await searchPexelsVideos(apiKeys.pexels, query)
      return videos.map((v: any): StockResult => ({
        id: `pexels-v-${v.id}`, type: 'video', source: 'pexels',
        url: pickPexelsVideoUrl(v),
        thumbnailUrl: v.video_pictures?.[0]?.picture || v.image,
      }))
    }))
  }
  if (toggles.pixabay && toggles.image) {
    jobs.push(safe(async () => {
      const { hits } = await searchPixabayImages(apiKeys.pixabay, query)
      return hits.map((h: any): StockResult => ({
        id: `pixabay-i-${h.id}`, type: 'image', source: 'pixabay',
        url: h.largeImageURL || h.webformatURL,
        thumbnailUrl: h.previewURL || h.webformatURL,
      }))
    }))
  }
  if (toggles.pixabay && toggles.video) {
    jobs.push(safe(async () => {
      const { hits } = await searchPixabayVideos(apiKeys.pixabay, query)
      return hits.map((h: any): StockResult => ({
        id: `pixabay-v-${h.id}`, type: 'video', source: 'pixabay',
        url: getPixabayVideoUrl(h),
        thumbnailUrl: getPixabayVideoThumb(h),
      }))
    }))
  }
  if (toggles.unsplash && toggles.image) {
    jobs.push(safe(async () => {
      const { results: r } = await searchUnsplashPhotos(apiKeys.unsplash, query)
      return r.map((p: any): StockResult => ({
        id: `unsplash-i-${p.id}`, type: 'image', source: 'unsplash',
        url: p.urls?.regular || p.urls?.full,
        thumbnailUrl: p.urls?.small || p.urls?.thumb,
      }))
    }))
  }

  if (jobs.length === 0) return []
  const settled = await Promise.all(jobs)
  return settled.flat().filter((r) => !!r.url)
}

const STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'to', 'of', 'in', 'on', 'and', 'or', 'but',
  'with', 'for', 'this', 'that', 'it', 'as', 'at', 'by', 'be', 'you', 'your', 'i', 'we', 'they',
  'he', 'she', 'so', 'if', 'then', 'just', 'really', 'very', 'like', 'my', 'me', 'them', 'his',
  'her', 'its', 'our', 'us', 'not', 'do', 'did', 'have', 'has', 'had', 'will', 'would', 'can',
  'there', 'here', 'what', 'when', 'how', 'all', 'from', 'get', 'got', 'im', 'youre', 'its',
])

/** Turns a full narration line into a short, search-friendly phrase — stock APIs return much
 * better (and more visual) results for "mountain hiking" than for the full sentence it came
 * from. Falls back to the first few raw words if stripping stopwords leaves nothing. */
export function extractSearchQuery(text: string): string {
  const words = text.toLowerCase().replace(/[^a-z0-9\s']/g, '').split(/\s+/).filter(Boolean)
  const meaningful = words.filter((w) => !STOPWORDS.has(w) && w.length > 2)
  const picked = (meaningful.length ? meaningful : words).slice(0, 4)
  return picked.join(' ') || text.trim()
}
