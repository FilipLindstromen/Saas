import { loadApiKeys } from '@shared/apiKeys';
import { searchUnsplashFirst } from '@shared/stockMedia/unsplash';
import { searchPexelsPhotos } from '@shared/stockMedia/pexels';
import { searchPexelsVideos, pickPexelsVideoUrl } from '@shared/stockMedia/pexelsVideo';
import { searchPixabayImages, searchPixabayVideos, getPixabayVideoUrl } from '@shared/stockMedia/pixabay';
import { getSettings } from '../utils/settings';
import { isStockMediaSource, parseStockMediaSource } from '../utils/stockMediaSource';

async function firstStockHit(source, query) {
  const parsed = parseStockMediaSource(source);
  if (!parsed) return null;
  const keys = loadApiKeys();
  const settings = getSettings();
  const q = String(query ?? '').trim().slice(0, 100);
  if (!q) return null;

  const { provider, media } = parsed;
  try {
    if (provider === 'unsplash') {
      return searchUnsplashFirst(q);
    }
    if (provider === 'pexels' && media === 'photo') {
      const key = settings.pexelsApiKey?.trim() || keys.pexels;
      if (!key) return null;
      const data = await searchPexelsPhotos(key, q, 1, 1);
      const photo = data.photos?.[0];
      if (!photo) return null;
      const url = photo.src?.large2x || photo.src?.large || photo.src?.original;
      return url ? { url, credit: photo.photographer || 'Pexels' } : null;
    }
    if (provider === 'pexels' && media === 'video') {
      const key = settings.pexelsApiKey?.trim() || keys.pexels;
      if (!key) return null;
      const data = await searchPexelsVideos(key, q, 1, 1);
      const video = data.videos?.[0];
      const url = video ? pickPexelsVideoUrl(video) : '';
      return url ? { url, credit: video.user?.name || 'Pexels' } : null;
    }
    if (provider === 'pixabay' && media === 'photo') {
      const key = settings.pixabayApiKey?.trim() || keys.pixabay;
      if (!key) return null;
      const data = await searchPixabayImages(key, q, 1, 1);
      const hit = data.hits?.[0];
      const url = hit?.largeImageURL || hit?.webformatURL;
      return url ? { url, credit: hit.user || 'Pixabay' } : null;
    }
    if (provider === 'pixabay' && media === 'video') {
      const key = settings.pixabayApiKey?.trim() || keys.pixabay;
      if (!key) return null;
      const data = await searchPixabayVideos(key, q, 1, 1);
      const hit = data.hits?.[0];
      const url = hit ? getPixabayVideoUrl(hit) : '';
      return url ? { url, credit: hit.user || 'Pixabay' } : null;
    }
  } catch {
    return null;
  }
  return null;
}

export { firstStockHit, isStockMediaSource };
