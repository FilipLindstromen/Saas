/**
 * Shared Pixabay service for images.
 */
import { getApiKey } from '@shared/apiKeys';

const PIXABAY_API = 'https://pixabay.com/api';

export async function searchPixabayImages(apiKey, query, page = 1, perPage = 20) {
  const key = (apiKey && apiKey.trim()) || getApiKey('pixabay');
  if (!key) throw new Error('Add Pixabay API key in Settings.');

  const params = new URLSearchParams({
    key: key,
    q: (query || 'nature').trim(),
    page: String(page),
    per_page: String(Math.min(perPage, 200)),
    image_type: 'photo',
  });
  const res = await fetch(`${PIXABAY_API}/?${params}`);
  if (!res.ok) throw new Error(res.status === 401 ? 'Invalid Pixabay key' : `Pixabay error ${res.status}`);
  const data = await res.json();
  return {
    total: data.total ?? 0,
    totalHits: data.totalHits ?? 0,
    hits: data.hits ?? [],
  };
}

const PIXABAY_VIDEOS_API = 'https://pixabay.com/api/videos';

export async function searchPixabayVideos(apiKey, query, page = 1, perPage = 15) {
  const key = (apiKey && apiKey.trim()) || getApiKey('pixabay');
  if (!key) throw new Error('Add Pixabay API key in Settings.');

  const params = new URLSearchParams({
    key,
    q: (query || 'nature').trim(),
    page: String(page),
    per_page: String(Math.min(perPage, 200)),
    video_type: 'all',
  });
  const res = await fetch(`${PIXABAY_VIDEOS_API}/?${params}`);
  if (!res.ok) throw new Error(res.status === 401 ? 'Invalid Pixabay key' : `Pixabay error ${res.status}`);
  const data = await res.json();
  return {
    total: data.total ?? 0,
    totalHits: data.totalHits ?? 0,
    hits: data.hits ?? [],
  };
}

export function getPixabayVideoUrl(hit) {
  const v = hit?.videos ?? {};
  return v.large?.url ?? v.medium?.url ?? v.small?.url ?? v.tiny?.url ?? '';
}

export function getPixabayVideoThumb(hit) {
  const v = hit?.videos ?? {};
  return v.tiny?.url ?? v.small?.url ?? v.medium?.url ?? '';
}
