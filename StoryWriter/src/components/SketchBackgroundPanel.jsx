import { useState, useEffect, useCallback, useRef } from 'react';
import { getSettings } from '../utils/settings';
import { generateNapkinSketchBackground } from '../services/sentenceBackgroundAi';
import './SketchBackgroundPanel.css';

export default function SketchBackgroundPanel({
  isOpen,
  onClose,
  sentenceText = '',
  onSelect,
  autoGenerate = false,
  instructions = '',
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const autoRanRef = useRef(false);

  const runGenerate = useCallback(async () => {
    const apiKey = getSettings().openaiApiKey?.trim();
    if (!apiKey) {
      setError('Add your OpenAI API key in Settings.');
      setPreviewUrl('');
      return;
    }
    const text = sentenceText.trim();
    if (!text) {
      setError('No sentence text to illustrate.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const dataUrl = await generateNapkinSketchBackground(text, apiKey, instructions);
      setPreviewUrl(dataUrl);
    } catch (err) {
      setError(err?.message || 'Generation failed.');
      setPreviewUrl('');
    } finally {
      setLoading(false);
    }
  }, [sentenceText, instructions]);

  useEffect(() => {
    if (!isOpen) {
      autoRanRef.current = false;
      setPreviewUrl('');
      setError('');
      setLoading(false);
      return;
    }
    if (autoGenerate && !autoRanRef.current) {
      autoRanRef.current = true;
      runGenerate();
    }
  }, [isOpen, autoGenerate, runGenerate]);

  if (!isOpen) return null;

  return (
    <div className="sketch-bg-panel">
      <div className="sketch-bg-panel__header">
        <h3 className="sketch-bg-panel__title">Generate napkin sketch</h3>
        <button type="button" className="sketch-bg-panel__close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      <p className="sketch-bg-panel__sentence">{sentenceText || 'This sentence'}</p>
      {error && <p className="sketch-bg-panel__error">{error}</p>}
      {loading && <p className="sketch-bg-panel__loading">Generating sketch…</p>}
      {previewUrl && !loading && (
        <div className="sketch-bg-panel__preview-wrap">
          <img className="sketch-bg-panel__preview" src={previewUrl} alt="Generated sketch background" />
        </div>
      )}
      <div className="sketch-bg-panel__actions">
        <button
          type="button"
          className="sketch-bg-panel__btn sketch-bg-panel__btn--primary"
          onClick={runGenerate}
          disabled={loading}
        >
          {previewUrl ? 'Regenerate' : 'Generate'}
        </button>
        {previewUrl && !loading && (
          <button
            type="button"
            className="sketch-bg-panel__btn sketch-bg-panel__btn--secondary"
            onClick={() => {
              onSelect?.(previewUrl, 'AI napkin sketch');
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
