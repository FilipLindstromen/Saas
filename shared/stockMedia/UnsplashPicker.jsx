/**
 * Shared Unsplash image picker.
 */
import { useState, useEffect, useCallback } from 'react';
import { searchUnsplashPhotos, fetchUnsplashImageAsDataUrl } from './unsplash';
import { getApiKey } from '@shared/apiKeys';
import './StockPicker.css';

export default function UnsplashPicker({ isOpen, onClose, onSelect, initialQuery = '', returnDataUrl = false }) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pickingId, setPickingId] = useState(null);
  const [error, setError] = useState(null);

  const accessKey = getApiKey('unsplash');

  const search = useCallback(
    async (pageNum = 1, append = false) => {
      if (!accessKey?.trim()) {
        setError('Add Unsplash Access Key in Settings.');
        return;
      }
      setError(null);
      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);
      try {
        const data = await searchUnsplashPhotos(accessKey, query || 'nature', pageNum, 15);
        setTotalPages(data.total_pages ?? 0);
        setPage(pageNum);
        if (append) setResults((prev) => [...prev, ...(data.results ?? [])]);
        else setResults(data.results ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Search failed');
        if (!append) setResults([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [accessKey, query]
  );

  useEffect(() => {
    if (!isOpen) return;
    setQuery(initialQuery);
    if (initialQuery?.trim()) search(1);
    else setResults([]);
  }, [isOpen, initialQuery]);

  const handleSearch = () => search(1);
  const handleLoadMore = () => search(page + 1, true);

  const handlePick = async (photo) => {
    setError(null);
    setPickingId(photo.id);
    try {
      const imageUrl = photo.urls?.full || photo.urls?.regular;
      if (!imageUrl) throw new Error('No image URL');
      if (returnDataUrl) {
        const dataUrl = await fetchUnsplashImageAsDataUrl(
          imageUrl,
          photo.links?.download_location,
          accessKey
        );
        onSelect?.(dataUrl, photo.user?.name || '');
      } else {
        onSelect?.(imageUrl, photo.user?.name || '');
      }
      onClose?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load image');
    } finally {
      setPickingId(null);
    }
  };

  if (!isOpen) return null;

  const needKey = !accessKey?.trim();
  const showResults = !needKey && results.length > 0;

  return (
    <div className="stock-picker-backdrop" onClick={() => onClose?.()}>
      <div className="stock-picker-modal" onClick={(e) => e.stopPropagation()}>
        <div className="stock-picker-header">
          <h3>Unsplash</h3>
          <button type="button" className="stock-picker-close" onClick={onClose}>×</button>
        </div>
        <div className="stock-picker-body">
          {needKey ? (
            <p className="stock-picker-error">Add your Unsplash Access Key in Settings.</p>
          ) : (
            <>
              <div className="stock-picker-search">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Search images..."
                />
                <button type="button" onClick={handleSearch} disabled={loading}>Search</button>
              </div>
              {error && <p className="stock-picker-error">{error}</p>}
              {loading && <p className="stock-picker-loading">Loading...</p>}
              {showResults && (
                <div className="stock-picker-grid">
                  {results.map((photo) => (
                    <button
                      key={photo.id}
                      type="button"
                      className="stock-picker-item"
                      onClick={() => handlePick(photo)}
                      disabled={pickingId === photo.id}
                    >
                      <img src={photo.urls?.small || photo.urls?.thumb} alt={photo.alt_description || ''} />
                      {pickingId === photo.id && <span className="stock-picker-picking">...</span>}
                    </button>
                  ))}
                </div>
              )}
              {showResults && page < totalPages && (
                <button type="button" className="stock-picker-load-more" onClick={handleLoadMore} disabled={loadingMore}>
                  {loadingMore ? 'Loading...' : 'Load more'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
