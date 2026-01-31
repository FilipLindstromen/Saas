import { useState, useEffect, useCallback } from 'react';
import { getSettings } from '../utils/settings';
import './UnsplashPicker.css';

const UNSPLASH_SEARCH = 'https://api.unsplash.com/search/photos';

export default function UnsplashPicker({ isOpen, onClose, onSelect, initialQuery = '', inline = false }) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const accessKey = getSettings().unsplashAccessKey?.trim();

  const searchWithQuery = useCallback(async (searchQuery) => {
    if (!accessKey) {
      setError('Add your Unsplash Access Key in Settings.');
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
      const params = new URLSearchParams({
        query: q,
        per_page: '20',
        client_id: accessKey,
      });
      const res = await fetch(`${UNSPLASH_SEARCH}?${params}`);
      if (!res.ok) {
        throw new Error(res.status === 401 ? 'Invalid Unsplash key.' : `Error ${res.status}`);
      }
      const data = await res.json();
      setResults(Array.isArray(data.results) ? data.results : []);
    } catch (err) {
      setError(err.message || 'Search failed.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [accessKey]);

  useEffect(() => {
    if (!isOpen) return;
    const q = (query || initialQuery).trim();
    if (!q) return;
    const t = setTimeout(() => searchWithQuery(q), 400);
    return () => clearTimeout(t);
  }, [isOpen, query, initialQuery, searchWithQuery]);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults([]);
      setError('');
    } else {
      setQuery(initialQuery);
    }
  }, [isOpen, initialQuery]);

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleSelect = (photo) => {
    const url = photo.urls?.regular || photo.urls?.full || photo.urls?.raw;
    const credit = photo.user?.name || '';
    if (url) onSelect?.(url, credit);
    onClose();
  };

  if (!isOpen) return null;

  const pickerContent = (
    <div className={inline ? 'unsplash-picker-inline' : 'unsplash-picker-modal'}>
      <div className="unsplash-picker-header">
        <h3 className="unsplash-picker-title">{initialQuery ? 'Set image for sentence' : 'Set section background image'}</h3>
        <button type="button" className="unsplash-picker-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      <div className="unsplash-picker-search">
        <input
          type="search"
          className="unsplash-picker-input"
          placeholder="Search Unsplash…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus={!inline}
        />
      </div>
      {!accessKey && (
        <p className="unsplash-picker-hint">
          Add your Unsplash Access Key in Settings. Get a free key at unsplash.com/developers.
        </p>
      )}
      {error && <p className="unsplash-picker-error">{error}</p>}
      {loading && <p className="unsplash-picker-loading">Loading…</p>}
      <div className="unsplash-picker-grid">
        {results.map((photo) => (
          <button
            type="button"
            key={photo.id}
            className="unsplash-picker-item"
            onClick={() => handleSelect(photo)}
            style={{ backgroundImage: `url(${photo.urls?.thumb || photo.urls?.small || ''})` }}
            title={photo.alt_description || 'Select'}
          />
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
      aria-label="Choose Unsplash image"
    >
      {pickerContent}
    </div>
  );
}
