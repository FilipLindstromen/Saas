import { useState, useEffect } from 'react';
import { getSettings, saveSettings } from '../utils/settings';
import './SettingsModal.css';

export default function SettingsModal({ isOpen, onClose }) {
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [elevenlabsApiKey, setElevenlabsApiKey] = useState('');
  const [apiBaseUrl, setApiBaseUrl] = useState('');

  useEffect(() => {
    if (isOpen) {
      const s = getSettings();
      setOpenaiApiKey(s.openaiApiKey || '');
      setElevenlabsApiKey(s.elevenlabsApiKey || '');
      setApiBaseUrl(s.apiBaseUrl || '');
    }
  }, [isOpen]);

  const handleSave = (e) => {
    e.preventDefault();
    saveSettings({ openaiApiKey, elevenlabsApiKey, apiBaseUrl });
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
            API keys are stored in your browser only and sent to the backend with each request. Leave blank to use keys set in the server&apos;s .env.
          </p>
          <label className="settings-label">
            OpenAI API Key
            <input
              type="password"
              className="settings-input"
              placeholder="sk-..."
              value={openaiApiKey}
              onChange={(e) => setOpenaiApiKey(e.target.value)}
              autoComplete="off"
            />
          </label>
          <label className="settings-label">
            ElevenLabs API Key
            <input
              type="password"
              className="settings-input"
              placeholder="Your ElevenLabs API key"
              value={elevenlabsApiKey}
              onChange={(e) => setElevenlabsApiKey(e.target.value)}
              autoComplete="off"
            />
          </label>
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
