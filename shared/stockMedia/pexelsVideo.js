/**
 * Shared Pexels video search helpers.
 */
import { getApiKey } from '@shared/apiKeys';

const PEXELS_VIDEOS_API = 'https://api.pexels.com/videos';

export function pickPexelsVideoUrl(video) {
  const files = video.video_files || [];
  const mp4 = files.filter((f) => (f.file_type || '').includes('mp4'));
  const hd = mp4.find((f) => (f.quality || '').toLowerCase() === 'hd');
  const sd = mp4.find((f) => (f.quality || '').toLowerCase() === 'sd');
  return (hd || sd || mp4[0] || files[0])?.link || '';
}

export async function searchPexelsVideos(apiKey, query, page = 1, perPage = 15) {
  const key = (apiKey && apiKey.trim()) || getApiKey('pexels');
  if (!key) throw new Error('Add Pexels API key in Settings.');

  const params = new URLSearchParams({
    query: (query || 'nature').trim(),
    page: String(page),
    per_page: String(perPage),
  });
  const res = await fetch(`${PEXELS_VIDEOS_API}/search?${params}`, {
    headers: { Authorization: key },
  });
  if (!res.ok) {
    throw new Error(res.status === 401 ? 'Invalid Pexels key' : `Pexels error ${res.status}`);
  }
  const data = await res.json();
  return {
    total_results: data.total_results ?? 0,
    page: data.page ?? 1,
    per_page: data.per_page ?? perPage,
    videos: data.videos ?? [],
  };
}

/** Fetch cross-origin video to a blob URL for canvas compositing. */
export async function fetchVideoAsBlobUrl(url) {
  const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
  if (!res.ok) throw new Error('Failed to fetch video');
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
