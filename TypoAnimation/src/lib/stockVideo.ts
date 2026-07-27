import { getSharedApiKey } from './env';

export interface StockVideoResult {
  id: string;
  provider: 'pexels' | 'pixabay';
  thumbnail: string;
  width: number;
  height: number;
  durationSec: number;
  downloadUrl: string;
  credit?: string;
}

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

async function searchPexelsVideos(query: string, perPage = 8): Promise<StockVideoResult[]> {
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

async function searchPixabayVideos(query: string, perPage = 8): Promise<StockVideoResult[]> {
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

// Pexels first (it's the one key that's actually configured for this monorepo), Pixabay as a
// bonus source if its key is ever added — mirrors PitchDeck's searchStockVideo fallback order.
export async function searchStockVideos(query: string, perPage = 8): Promise<StockVideoResult[]> {
  const [pexels, pixabay] = await Promise.all([
    searchPexelsVideos(query, perPage).catch(() => []),
    searchPixabayVideos(query, perPage).catch(() => []),
  ]);
  return [...pexels, ...pixabay];
}
