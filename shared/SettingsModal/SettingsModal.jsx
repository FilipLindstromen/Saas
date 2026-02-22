/**
 * Shared Settings Modal for API keys.
 * Used by StoryWriter, InfoGraphics, ColorWriter, ReelRecorder, etc.
 * Keys are stored via @shared/apiKeys.
 */
import { useState, useEffect } from 'react';
import { loadApiKeys, saveApiKeys } from '@shared/apiKeys';
import './SettingsModal.css';

const API_KEY_FIELDS = [
  { key: 'openai', label: 'OpenAI API Key', placeholder: 'sk-...', hint: 'For AI generation, transcription, captions.' },
  { key: 'unsplash', label: 'Unsplash Access Key', placeholder: 'Optional', hint: 'For stock images. Get at unsplash.com/developers' },
  { key: 'pexels', label: 'Pexels API Key', placeholder: 'Optional', hint: 'For stock images/videos. Get at pexels.com/api' },
  { key: 'pixabay', label: 'Pixabay API Key', placeholder: 'Optional', hint: 'For stock images/videos. Get at pixabay.com/api/docs/' },
  { key: 'giphy', label: 'Giphy API Key', placeholder: 'Optional', hint: 'For GIFs/stickers. Get at developers.giphy.com' },
  { key: 'googleClientId', label: 'Google Client ID', placeholder: 'For YouTube upload', hint: 'For YouTube upload. OAuth 2.0 Client ID from Google Cloud Console.' },
];

/**
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {function} props.onClose
 * @param {string[]} [props.fields] - Which API key fields to show (default: all). e.g. ['openai', 'unsplash']
 * @param {React.ReactNode} [props.children] - App-specific settings (e.g. font picker) rendered after API keys
 * @param {function} [props.onSave] - Called after API keys are saved; use to persist app-specific settings
 */
export default function SettingsModal({ isOpen, onClose, fields = null, children, onSave }) {
  const [local, setLocal] = useState({});

  const visibleFields = fields ?? API_KEY_FIELDS.map((f) => f.key);
  const fieldDefs = API_KEY_FIELDS.filter((f) => visibleFields.includes(f.key));

  useEffect(() => {
    if (isOpen) {
      setLocal(loadApiKeys());
    }
  }, [isOpen]);

  const handleChange = (key, value) => {
    setLocal((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = (e) => {
    e?.preventDefault();
    saveApiKeys(local);
    onSave?.();
    onClose();
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="shared-settings-backdrop"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="shared-settings-title"
    >
      <div className="shared-settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="shared-settings-header">
          <h2 id="shared-settings-title">Settings</h2>
          <button type="button" className="shared-settings-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <form onSubmit={handleSave} className="shared-settings-form">
          <p className="shared-settings-hint">
            API keys are stored once and shared across all Saas apps. They are stored locally only—never sent to our servers.
          </p>
          {fieldDefs.map(({ key, label, placeholder, hint }) => (
            <div key={key} className="shared-settings-field">
              <label htmlFor={`shared-key-${key}`}>{label}</label>
              <input
                id={`shared-key-${key}`}
                type={key === 'googleClientId' ? 'text' : 'password'}
                value={local[key] ?? ''}
                onChange={(e) => handleChange(key, e.target.value)}
                placeholder={placeholder}
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
              />
              {hint && <span className="shared-settings-field-hint">{hint}</span>}
            </div>
          ))}
          {children ? <div className="shared-settings-extra">{children}</div> : null}
          <div className="shared-settings-actions">
            <button type="button" className="shared-settings-btn secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="shared-settings-btn primary">
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
