/** Edit-mode sentence background stock providers. */
export const STOCK_MEDIA_SOURCES = new Set([
  'unsplash',
  'pexels-photo',
  'pexels-video',
  'pixabay-photo',
  'pixabay-video',
]);

export function isStockMediaSource(source) {
  return STOCK_MEDIA_SOURCES.has(source);
}

/** @returns {{ provider: 'unsplash' | 'pexels' | 'pixabay', media: 'photo' | 'video' } | null} */
export function parseStockMediaSource(source) {
  switch (source) {
    case 'unsplash':
      return { provider: 'unsplash', media: 'photo' };
    case 'pexels-photo':
      return { provider: 'pexels', media: 'photo' };
    case 'pexels-video':
      return { provider: 'pexels', media: 'video' };
    case 'pixabay-photo':
      return { provider: 'pixabay', media: 'photo' };
    case 'pixabay-video':
      return { provider: 'pixabay', media: 'video' };
    default:
      return null;
  }
}

export function stockSourceSearchLabel(source) {
  const parsed = parseStockMediaSource(source);
  if (!parsed) return 'stock media';
  const kind = parsed.media === 'video' ? 'videos' : 'photos';
  return `${parsed.provider} ${kind}`;
}

export function isVideoBackgroundUrl(url) {
  const u = String(url ?? '').trim();
  if (!u) return false;
  if (/\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(u)) return true;
  if (/videos\.pexels\.com/i.test(u)) return true;
  if (/pixabay\.com\/.*\/video/i.test(u)) return false;
  return false;
}
