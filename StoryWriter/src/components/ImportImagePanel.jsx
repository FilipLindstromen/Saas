import { useState, useRef, useCallback } from 'react';
import { readImageFileAsDataUrl } from '../utils/importImage';
import './ImportImagePanel.css';

export default function ImportImagePanel({ isOpen, onClose, onSelect, sentenceText = '', compact = false }) {
  const inputRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleFileChange = useCallback(async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setLoading(true);
    setError('');
    try {
      const dataUrl = await readImageFileAsDataUrl(file);
      setPreviewUrl(dataUrl);
    } catch (err) {
      setError(err?.message || 'Import failed.');
      setPreviewUrl('');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChoose = () => inputRef.current?.click();

  if (!isOpen) return null;

  return (
    <div className={`import-image-panel${compact ? ' import-image-panel--compact' : ''}`}>
      <div className="import-image-panel__header">
        {!compact && <h3 className="import-image-panel__title">Import image</h3>}
        {compact && <span className="import-image-panel__header-spacer" aria-hidden="true" />}
        <button type="button" className="import-image-panel__close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      {!compact && sentenceText ? <p className="import-image-panel__sentence">{sentenceText}</p> : null}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="import-image-panel__file-input"
        onChange={handleFileChange}
        aria-hidden="true"
        tabIndex={-1}
      />
      {error && <p className="import-image-panel__error">{error}</p>}
      {loading && <p className="import-image-panel__loading">Loading image…</p>}
      {previewUrl && !loading && (
        <div className="import-image-panel__preview-wrap">
          <img className="import-image-panel__preview" src={previewUrl} alt="Imported preview" />
        </div>
      )}
      <div className="import-image-panel__actions">
        <button
          type="button"
          className="import-image-panel__btn import-image-panel__btn--primary"
          onClick={handleChoose}
          disabled={loading}
        >
          {previewUrl ? 'Choose another file' : 'Choose image file'}
        </button>
        {previewUrl && !loading && (
          <button
            type="button"
            className="import-image-panel__btn import-image-panel__btn--secondary"
            onClick={() => {
              onSelect?.(previewUrl, 'Imported');
              onClose?.();
            }}
          >
            Use as background
          </button>
        )}
      </div>
    </div>
  );
}
