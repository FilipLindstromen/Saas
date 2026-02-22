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
