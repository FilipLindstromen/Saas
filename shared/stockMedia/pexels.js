/**
 * Shared Pexels service for images.
 */
import { getApiKey } from '@shared/apiKeys';

const PEXELS_API = 'https://api.pexels.com/v1';

export async function searchPexelsPhotos(apiKey, query, page = 1, perPage = 20) {
  const key = (apiKey && apiKey.trim()) || getApiKey('pexels');
  if (!key) throw new Error('Add Pexels API key in Settings.');

  const params = new URLSearchParams({
    query: (query || 'nature').trim(),
    page: String(page),
    per_page: String(perPage),
  });
  const res = await fetch(`${PEXELS_API}/search?${params}`, {
    headers: { Authorization: key },
  });
  if (!res.ok) throw new Error(res.status === 401 ? 'Invalid Pexels key' : `Pexels error ${res.status}`);
  const data = await res.json();
  return {
    total_results: data.total_results ?? 0,
    page: data.page ?? 1,
    photos: data.photos ?? [],
  };
}
