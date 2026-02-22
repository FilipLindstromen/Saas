import { useState, useEffect } from 'react';
import { getSettings, saveSettings } from '../utils/settings';
import './SettingsModal.css';

export default function SettingsModal({ isOpen, onClose }) {
  const [apiBaseUrl, setApiBaseUrl] = useState('');

  const saasAppsUrl = typeof window !== 'undefined'
    ? new URL('../index.html', window.location.href).href
    : '/index.html';

  useEffect(() => {
    if (isOpen) {
      const s = getSettings();
      setApiBaseUrl(s.apiBaseUrl || '');
    }
  }, [isOpen]);

  const handleSave = (e) => {
    e.preventDefault();
    saveSettings({ ...getSettings(), apiBaseUrl });
    onClose();
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="settings-backdrop" onClick={handleBackdropClick} role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <div className="settings-modal">
        <div className="settings-header">
          <h2 id="settings-title">Settings</h2>
          <button type="button" className="settings-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <form onSubmit={handleSave} className="settings-form">
          <p className="settings-hint">
            API keys (OpenAI, ElevenLabs) are configured in the{' '}
            <a href={saasAppsUrl} target="_blank" rel="noopener noreferrer" className="settings-link">
              SaaS Apps screen
            </a>
            . They are shared across all apps.
          </p>
          <label className="settings-label">
            API base URL <span className="settings-optional">(optional)</span>
            <input
              type="text"
              className="settings-input"
              placeholder="e.g. http://localhost:3001 or leave empty for /api"
              value={apiBaseUrl}
              onChange={(e) => setApiBaseUrl(e.target.value)}
              autoComplete="off"
            />
          </label>
          <div className="settings-actions">
            <button type="button" className="btn secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn primary">
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
