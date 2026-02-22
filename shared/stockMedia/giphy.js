/**
 * Shared Giphy service for GIFs/stickers.
 */
import { getApiKey } from '@shared/apiKeys';

const GIPHY_API = 'https://api.giphy.com/v1';

export async function searchGiphyGifs(apiKey, query, limit = 20, offset = 0) {
  const key = (apiKey && apiKey.trim()) || getApiKey('giphy');
  if (!key) throw new Error('Add Giphy API key in Settings.');

  const params = new URLSearchParams({
    api_key: key,
    q: (query || 'happy').trim(),
    limit: String(Math.min(limit, 50)),
    offset: String(offset),
    rating: 'g',
  });
  const res = await fetch(`${GIPHY_API}/gifs/search?${params}`);
  if (!res.ok) throw new Error(res.status === 401 ? 'Invalid Giphy key' : `Giphy error ${res.status}`);
  const data = await res.json();
  const items = (data.data ?? []).map((item) => {
    const img = item.images?.fixed_height ?? item.images?.downsized;
    return {
      id: item.id,
      url: img?.url ?? '',
      previewUrl: item.images?.fixed_height_small?.url ?? img?.url ?? '',
      width: parseInt(img?.width ?? '200', 10) || 200,
      height: parseInt(img?.height ?? '200', 10) || 200,
      title: item.title ?? '',
    };
  });
  return {
    data: items,
    totalCount: data.pagination?.total_count ?? 0,
    hasMore: (offset + items.length) < (data.pagination?.total_count ?? 0),
  };
}

export async function searchGiphyStickers(apiKey, query, limit = 20, offset = 0) {
  const key = (apiKey && apiKey.trim()) || getApiKey('giphy');
  if (!key) throw new Error('Add Giphy API key in Settings.');

  const params = new URLSearchParams({
    api_key: key,
    q: (query || 'happy').trim(),
    limit: String(Math.min(limit, 50)),
    offset: String(offset),
    rating: 'g',
  });
  const res = await fetch(`${GIPHY_API}/stickers/search?${params}`);
  if (!res.ok) throw new Error(res.status === 401 ? 'Invalid Giphy key' : `Giphy error ${res.status}`);
  const data = await res.json();
  const items = (data.data ?? []).map((item) => {
    const img = item.images?.fixed_height ?? item.images?.fixed_height_small ?? item.images?.downsized;
    return {
      id: item.id,
      url: img?.url ?? '',
      previewUrl: item.images?.fixed_height_small?.url ?? img?.url ?? '',
      width: parseInt(img?.width ?? '200', 10) || 200,
      height: parseInt(img?.height ?? '200', 10) || 200,
      title: item.title ?? '',
    };
  });
  return {
    data: items,
    totalCount: data.pagination?.total_count ?? 0,
    hasMore: (offset + items.length) < (data.pagination?.total_count ?? 0),
  };
}
