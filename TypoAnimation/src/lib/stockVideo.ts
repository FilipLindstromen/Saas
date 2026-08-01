import { getSharedApiKey } from './env';
export type {
  StockMediaResult,
  StockVideoResult,
  StockProvider,
  StockSearchScope,
} from './stockMediaTypes';
export { STOCK_PROVIDER_OPTIONS } from './stockMediaTypes';
import type { StockMediaResult, StockProvider, StockSearchScope } from './stockMediaTypes';

interface PexelsVideoFile {
  quality?: string;
  file_type?: string;
  link: string;
  width?: number;
  height?: number;
}

interface PexelsVideo {
  id: number;
  duration: number;
  image: string;
  width: number;
  height: number;
  video_files?: PexelsVideoFile[];
  user?: { name?: string };
}

// Port of Saas/shared/stockMedia/pexelsVideo.js's pickPexelsVideoUrl: prefer hd mp4, then sd,
// then any mp4, then any file at all.
function pickPexelsVideoUrl(video: PexelsVideo): string {
  const files = video.video_files || [];
  const mp4 = files.filter((f) => (f.file_type || '').includes('mp4'));
  const hd = mp4.find((f) => (f.quality || '').toLowerCase() === 'hd');
  const sd = mp4.find((f) => (f.quality || '').toLowerCase() === 'sd');
  return (hd || sd || mp4[0] || files[0])?.link || '';
}

async function searchPexelsVideos(query: string, perPage = 8): Promise<StockMediaResult[]> {
  const key = getSharedApiKey('PEXELS_API_KEY');
  if (!key) return [];
  const params = new URLSearchParams({ query: query || 'nature', page: '1', per_page: String(perPage) });
  const res = await fetch(`https://api.pexels.com/videos/search?${params}`, { headers: { Authorization: key } });
  if (!res.ok) return [];
  const data = (await res.json()) as { videos?: PexelsVideo[] };
  return (data.videos || [])
    .map((v) => ({
      id: String(v.id),
      provider: 'pexels' as const,
      kind: 'video' as const,
      thumbnail: v.image,
      width: v.width,
      height: v.height,
      durationSec: v.duration,
      downloadUrl: pickPexelsVideoUrl(v),
      credit: v.user?.name,
    }))
    .filter((v) => v.downloadUrl);
}

interface PixabayVideoFile {
  url: string;
  width: number;
  height: number;
}

interface PixabayHit {
  id: number;
  duration: number;
  picture_id: string;
  videos: { large?: PixabayVideoFile; medium?: PixabayVideoFile; small?: PixabayVideoFile };
  user?: string;
}

async function searchPixabayVideos(query: string, perPage = 8): Promise<StockMediaResult[]> {
  const key = getSharedApiKey('PIXABAY_API_KEY');
  if (!key) return [];
  const params = new URLSearchParams({ key, q: query || 'nature', per_page: String(Math.max(3, perPage)) });
  const res = await fetch(`https://pixabay.com/api/videos/?${params}`);
  if (!res.ok) return [];
  const data = (await res.json()) as { hits?: PixabayHit[] };
  return (data.hits || [])
    .map((h) => {
      const file = h.videos.large || h.videos.medium || h.videos.small;
      return {
        id: String(h.id),
        provider: 'pixabay' as const,
        kind: 'video' as const,
        thumbnail: `https://i.vimeocdn.com/video/${h.picture_id}_295x166.jpg`,
        width: file?.width || 0,
        height: file?.height || 0,
        durationSec: h.duration,
        downloadUrl: file?.url || '',
        credit: h.user,
      };
    })
    .filter((v) => v.downloadUrl);
}

interface UnsplashPhoto {
  id: string;
  width: number;
  height: number;
  urls: { regular: string; small: string };
  user?: { name?: string };
}

// Static-image alternative to the video providers above — same search-by-keyword flow, but
// for scenes that read better as a still photo than a moving clip. Doesn't call Unsplash's
// download-tracking endpoint (links.download_location) since this is an internal tool, not a
// public gallery — a fully API-guideline-compliant integration would ping that too.
async function searchUnsplashImages(query: string, perPage = 8): Promise<StockMediaResult[]> {
  const key = getSharedApiKey('UNSPLASH_ACCESS_KEY');
  if (!key) return [];
  const params = new URLSearchParams({ query: query || 'nature', per_page: String(perPage) });
  const res = await fetch(`https://api.unsplash.com/search/photos?${params}`, {
    headers: { Authorization: `Client-ID ${key}` },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { results?: UnsplashPhoto[] };
  return (data.results || [])
    .map((p) => ({
      id: p.id,
      provider: 'unsplash' as const,
      kind: 'image' as const,
      thumbnail: p.urls.small,
      width: p.width,
      height: p.height,
      downloadUrl: p.urls.regular,
      credit: p.user?.name,
    }))
    .filter((p) => p.downloadUrl);
}

// Pexels first when searching all sources, Pixabay and Unsplash as additional sources when
// their keys are set — extended to mix in Unsplash stills alongside video clips.
export async function searchStockMedia(
  query: string,
  opts: { perPage?: number; provider?: StockSearchScope } = {}
): Promise<StockMediaResult[]> {
  const perPage = opts.perPage ?? 8;
  const provider = opts.provider ?? 'all';

  if (provider === 'pexels') return searchPexelsVideos(query, perPage).catch(() => []);
  if (provider === 'pixabay') return searchPixabayVideos(query, perPage).catch(() => []);
  if (provider === 'unsplash') return searchUnsplashImages(query, perPage).catch(() => []);

  const [pexels, pixabay, unsplash] = await Promise.all([
    searchPexelsVideos(query, perPage).catch(() => []),
    searchPixabayVideos(query, perPage).catch(() => []),
    searchUnsplashImages(query, Math.max(3, Math.round(perPage / 2))).catch(() => []),
  ]);
  return [...pexels, ...pixabay, ...unsplash];
}

export async function searchStockVideos(query: string, perPage = 8): Promise<StockMediaResult[]> {
  return searchStockMedia(query, { perPage, provider: 'all' });
}
