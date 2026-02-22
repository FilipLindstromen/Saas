/**
 * Shared Unsplash service.
 */
import { getApiKey } from '@shared/apiKeys';

const UNSPLASH_API = 'https://api.unsplash.com';

export async function searchUnsplashPhotos(accessKey, query, page = 1, perPage = 20) {
  const key = (accessKey && accessKey.trim()) || getApiKey('unsplash');
  if (!key) throw new Error('Add Unsplash Access Key in Settings.');

  const params = new URLSearchParams({
    query: (query || 'nature').trim(),
    page: String(page),
    per_page: String(perPage),
  });
  const res = await fetch(`${UNSPLASH_API}/search/photos?${params}`, {
    headers: {
      Authorization: `Client-ID ${key}`,
      'Accept-Version': 'v1',
    },
  });
  if (!res.ok) throw new Error(res.status === 401 ? 'Invalid Unsplash key' : `Unsplash error ${res.status}`);
  const data = await res.json();
  return {
    total: data.total ?? 0,
    total_pages: data.total_pages ?? 0,
    results: data.results ?? [],
  };
}

/** Return first result or null. For quick single-image fetch. */
export async function searchUnsplashFirst(query) {
  const key = getApiKey('unsplash');
  if (!key) return null;
  const q = String(query ?? '').trim().slice(0, 100);
  if (!q) return null;
  try {
    const { results } = await searchUnsplashPhotos(key, q, 1, 1);
    const photo = results[0];
    if (!photo?.urls) return null;
    const url = photo.urls.regular || photo.urls.full || photo.urls.raw;
    const credit = photo.user?.name || '';
    return url ? { url, credit } : null;
  } catch {
    return null;
  }
}

export async function fetchUnsplashImageAsDataUrl(imageUrl, downloadLocation, accessKey) {
  const res = await fetch(imageUrl, { mode: 'cors' });
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
  const blob = await res.blob();
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read image'));
    reader.readAsDataURL(blob);
  });
  const key = (accessKey && accessKey.trim()) || getApiKey('unsplash');
  if (downloadLocation && key) {
    try {
      await fetch(`${downloadLocation}&client_id=${key}`);
    } catch {}
  }
  return dataUrl;
}
