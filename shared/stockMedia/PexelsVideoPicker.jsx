/**
 * Shared Pexels video picker.
 */
import { useState, useEffect, useCallback } from 'react';
import { getApiKey } from '@shared/apiKeys';
import { pickPexelsVideoUrl, searchPexelsVideos } from './pexelsVideo';
import './StockPicker.css';

function readStoredQuery(storageKey) {
  if (!storageKey) return '';
  try {
    return localStorage.getItem(storageKey) || '';
  } catch {
    return '';
  }
}

function writeStoredQuery(storageKey, value) {
  if (!storageKey || !value?.trim()) return;
  try {
    localStorage.setItem(storageKey, value.trim());
  } catch {
    // ignore quota / private mode
  }
}

export default function PexelsVideoPicker({
  isOpen,
  onClose,
  onSelect,
  initialQuery = '',
  queryStorageKey = '',
}) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState([]);
  const [page, setPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [perPage, setPerPage] = useState(15);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pickingId, setPickingId] = useState(null);
  const [error, setError] = useState(null);

  const accessKey = getApiKey('pexels');

  const search = useCallback(
    async (pageNum = 1, append = false, queryOverride) => {
      const searchQuery = queryOverride ?? query;
      if (!accessKey?.trim()) {
        setError('Add Pexels API key in Settings.');
        return;
      }
      setError(null);
      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);
      try {
        const data = await searchPexelsVideos(accessKey, searchQuery || 'nature', pageNum, 15);
        setTotalResults(data.total_results ?? 0);
        setPerPage(data.per_page ?? 15);
        setPage(pageNum);
        const list = (data.videos ?? []).map((video) => ({
          id: video.id,
          url: pickPexelsVideoUrl(video),
          thumb: video.image || video.video_pictures?.[0]?.picture || '',
          user: video.user?.name || '',
        })).filter((v) => v.url);
        if (append) setResults((prev) => [...prev, ...list]);
        else setResults(list);
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
    const storedQuery = readStoredQuery(queryStorageKey);
    const nextQuery = storedQuery.trim() || initialQuery;
    setQuery(nextQuery);
    if (nextQuery.trim()) search(1, false, nextQuery);
    else setResults([]);
  }, [isOpen, initialQuery, queryStorageKey]);

  const handleSearch = () => {
    writeStoredQuery(queryStorageKey, query);
    search(1, false, query);
  };
  const handleLoadMore = () => search(page + 1, true);
  const hasMore = page * perPage < totalResults;

  const handlePick = async (video) => {
    setError(null);
    setPickingId(video.id);
    try {
      if (!video.url) throw new Error('No video URL');
      onSelect?.(video.url, video.user);
      onClose?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load video');
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
          <h3>Pexels video</h3>
          <button type="button" className="stock-picker-close" onClick={onClose}>×</button>
        </div>
        <div className="stock-picker-body">
          {needKey ? (
            <p className="stock-picker-error">Add your Pexels API key in Settings.</p>
          ) : (
            <>
              <div className="stock-picker-search">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Search videos..."
                />
                <button type="button" onClick={handleSearch} disabled={loading}>Search</button>
              </div>
              {error && <p className="stock-picker-error">{error}</p>}
              {loading && <p className="stock-picker-loading">Loading...</p>}
              {showResults && (
                <div className="stock-picker-grid">
                  {results.map((video) => (
                    <button
                      key={video.id}
                      type="button"
                      className="stock-picker-item"
                      onClick={() => handlePick(video)}
                      disabled={pickingId === video.id}
                    >
                      {video.thumb ? (
                        <img src={video.thumb} alt="" />
                      ) : (
                        <span className="stock-picker-picking">▶</span>
                      )}
                      {pickingId === video.id && <span className="stock-picker-picking">...</span>}
                    </button>
                  ))}
                </div>
              )}
              {showResults && hasMore && (
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
