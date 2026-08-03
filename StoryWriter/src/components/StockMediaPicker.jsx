import { useState, useEffect, useCallback } from 'react';
import { loadApiKeys } from '@shared/apiKeys';
import { searchUnsplashPhotos } from '@shared/stockMedia/unsplash';
import { searchPexelsPhotos } from '@shared/stockMedia/pexels';
import { searchPexelsVideos, pickPexelsVideoUrl } from '@shared/stockMedia/pexelsVideo';
import {
  searchPixabayImages,
  searchPixabayVideos,
  getPixabayVideoUrl,
  getPixabayVideoThumb,
} from '@shared/stockMedia/pixabay';
import { getSettings } from '../utils/settings';
import { parseStockMediaSource } from '../utils/stockMediaSource';
import './UnsplashPicker.css';

function formatStockError(provider, err) {
  const message = err?.message || '';
  if (message.includes('403')) {
    return `${provider} rejected the request (403). Check your API key in Settings and that the app is active.`;
  }
  if (message.includes('401') || message.toLowerCase().includes('invalid')) {
    return `Invalid ${provider} API key. Update it in Settings.`;
  }
  return message || 'Search failed.';
}

function getApiKeyForProvider(provider) {
  const keys = loadApiKeys();
  const settings = getSettings();
  if (provider === 'unsplash') return settings.unsplashAccessKey?.trim() || keys.unsplash || '';
  if (provider === 'pexels') return settings.pexelsApiKey?.trim() || keys.pexels || '';
  if (provider === 'pixabay') return settings.pixabayApiKey?.trim() || keys.pixabay || '';
  return '';
}

async function searchStock(provider, media, apiKey, query, perPage) {
  if (provider === 'unsplash') {
    const data = await searchUnsplashPhotos(apiKey, query, 1, perPage);
    return (data.results ?? []).map((photo) => ({
      id: `unsplash-${photo.id}`,
      thumbUrl: photo.urls?.thumb || photo.urls?.small || '',
      url: photo.urls?.regular || photo.urls?.full || photo.urls?.raw || '',
      credit: photo.user?.name || 'Unsplash',
      isVideo: false,
    }));
  }
  if (provider === 'pexels' && media === 'photo') {
    const data = await searchPexelsPhotos(apiKey, query, 1, perPage);
    return (data.photos ?? []).map((photo) => ({
      id: `pexels-${photo.id}`,
      thumbUrl: photo.src?.medium || photo.src?.small || '',
      url: photo.src?.large2x || photo.src?.large || photo.src?.original || '',
      credit: photo.photographer || 'Pexels',
      isVideo: false,
    }));
  }
  if (provider === 'pexels' && media === 'video') {
    const data = await searchPexelsVideos(apiKey, query, 1, perPage);
    return (data.videos ?? []).map((video) => ({
      id: `pexels-v-${video.id}`,
      thumbUrl: video.image || '',
      url: pickPexelsVideoUrl(video),
      credit: video.user?.name || 'Pexels',
      isVideo: true,
    }));
  }
  if (provider === 'pixabay' && media === 'photo') {
    const data = await searchPixabayImages(apiKey, query, 1, perPage);
    return (data.hits ?? []).map((hit) => ({
      id: `pixabay-${hit.id}`,
      thumbUrl: hit.previewURL || hit.webformatURL || '',
      url: hit.largeImageURL || hit.webformatURL || '',
      credit: hit.user || 'Pixabay',
      isVideo: false,
    }));
  }
  if (provider === 'pixabay' && media === 'video') {
    const data = await searchPixabayVideos(apiKey, query, 1, perPage);
    return (data.hits ?? []).map((hit) => ({
      id: `pixabay-v-${hit.id}`,
      thumbUrl: getPixabayVideoThumb(hit),
      url: getPixabayVideoUrl(hit),
      credit: hit.user || 'Pixabay',
      isVideo: true,
    }));
  }
  return [];
}

export default function StockMediaPicker({
  stockSource = 'unsplash',
  isOpen,
  onClose,
  onSelect,
  initialQuery = '',
  inline = false,
  autoSearch = true,
  resultsCount = 20,
}) {
  const parsed = parseStockMediaSource(stockSource) ?? { provider: 'unsplash', media: 'photo' };
  const { provider, media } = parsed;

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const apiKey = getApiKeyForProvider(provider);
  const providerLabel = provider.charAt(0).toUpperCase() + provider.slice(1);
  const mediaLabel = media === 'video' ? 'videos' : 'photos';

  const searchWithQuery = useCallback(
    async (searchQuery) => {
      if (!apiKey) {
        setError(`Add your ${providerLabel} API key in Settings.`);
        setResults([]);
        return;
      }
      const q = String(searchQuery ?? '').trim().slice(0, 100);
      if (!q) {
        setResults([]);
        setError('');
        return;
      }
      setLoading(true);
      setError('');
      try {
        const perPage = Math.min(30, Math.max(1, Number(resultsCount) || 20));
        const items = await searchStock(provider, media, apiKey, q, perPage);
        setResults(items.filter((item) => item.url));
      } catch (err) {
        setError(formatStockError(providerLabel, err));
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [apiKey, provider, media, providerLabel, resultsCount]
  );

  useEffect(() => {
    if (!isOpen) return;
    const q = (query || initialQuery).trim();
    if (!q) return;
    if (!autoSearch && query === initialQuery) return;
    const t = setTimeout(() => searchWithQuery(q), 400);
    return () => clearTimeout(t);
  }, [isOpen, query, initialQuery, searchWithQuery, autoSearch]);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults([]);
      setError('');
    } else {
      setQuery(initialQuery);
    }
  }, [isOpen, initialQuery, stockSource]);

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleSelect = (item) => {
    if (item.url) onSelect?.(item.url, item.credit);
    onClose();
  };

  if (!isOpen) return null;

  const pickerContent = (
    <div className={inline ? 'unsplash-picker-inline' : 'unsplash-picker-modal'}>
      <div className="unsplash-picker-header">
        <h3 className="unsplash-picker-title">
          {initialQuery ? `Set ${media === 'video' ? 'video' : 'image'} for sentence` : 'Set background'}
        </h3>
        <button type="button" className="unsplash-picker-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      <div className="unsplash-picker-search">
        <input
          type="search"
          className="unsplash-picker-input"
          placeholder={`Search ${providerLabel} ${mediaLabel}…`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus={!inline}
        />
      </div>
      {!apiKey && (
        <p className="unsplash-picker-hint">
          Add your {providerLabel} API key in Settings to search {mediaLabel}.
        </p>
      )}
      {error && <p className="unsplash-picker-error">{error}</p>}
      {loading && <p className="unsplash-picker-loading">Loading…</p>}
      <div className="unsplash-picker-grid">
        {results.map((item) => (
          <button
            type="button"
            key={item.id}
            className={`unsplash-picker-item${item.isVideo ? ' unsplash-picker-item--video' : ''}`}
            onClick={() => handleSelect(item)}
            title={item.isVideo ? 'Select video' : 'Select image'}
          >
            {item.isVideo ? (
              <>
                <span
                  className="unsplash-picker-item__thumb"
                  style={{ backgroundImage: item.thumbUrl ? `url(${item.thumbUrl})` : undefined }}
                />
                <span className="unsplash-picker-item__badge" aria-hidden="true">
                  ▶
                </span>
              </>
            ) : (
              <span
                className="unsplash-picker-item__thumb"
                style={{ backgroundImage: item.thumbUrl ? `url(${item.thumbUrl})` : undefined }}
              />
            )}
          </button>
        ))}
      </div>
    </div>
  );

  if (inline) return pickerContent;

  return (
    <div
      className="unsplash-picker-backdrop"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label={`Choose ${providerLabel} ${mediaLabel}`}
    >
      {pickerContent}
    </div>
  );
}
