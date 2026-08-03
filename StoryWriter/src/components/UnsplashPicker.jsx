import { useState, useEffect, useCallback } from 'react';
import { getSettings } from '../utils/settings';
import { searchUnsplashPhotos } from '@shared/stockMedia/unsplash';
import './UnsplashPicker.css';

function formatUnsplashError(err) {
  const message = err?.message || '';
  if (message.includes('403')) {
    return 'Unsplash rejected the request (403). Add a valid Access Key in Settings → Unsplash, and ensure your app is active at unsplash.com/developers.';
  }
  if (message.includes('401')) {
    return 'Invalid Unsplash Access Key. Update it in Settings.';
  }
  return message || 'Search failed.';
}

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
      const data = await searchUnsplashPhotos(accessKey, q, 1, 20);
      setResults(Array.isArray(data.results) ? data.results : []);
    } catch (err) {
      setError(formatUnsplashError(err));
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
