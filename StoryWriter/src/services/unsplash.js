import { getSettings } from '../utils/settings';

const UNSPLASH_SEARCH = 'https://api.unsplash.com/search/photos';

/**
 * Search Unsplash and return the first result, or null.
 * @returns {Promise<{ url: string, credit: string } | null>}
 */
export async function searchUnsplashFirst(query) {
  const accessKey = getSettings().unsplashAccessKey?.trim();
  if (!accessKey) return null;
  const q = String(query ?? '').trim().slice(0, 100);
  if (!q) return null;
  try {
    const params = new URLSearchParams({
      query: q,
      per_page: '1',
      client_id: accessKey,
    });
    const res = await fetch(`${UNSPLASH_SEARCH}?${params}`);
    if (!res.ok) return null;
    const data = await res.json();
    const results = Array.isArray(data.results) ? data.results : [];
    const photo = results[0];
    if (!photo?.urls) return null;
    const url = photo.urls.regular || photo.urls.full || photo.urls.raw;
    const credit = photo.user?.name || '';
    return url ? { url, credit } : null;
  } catch {
    return null;
  }
}
