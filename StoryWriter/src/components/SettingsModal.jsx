import { useState, useEffect } from 'react';
import { getSettings, saveSettings } from '../utils/settings';
import './SettingsModal.css';

export default function SettingsModal({ isOpen, onClose }) {
  const [openaiApiKey, setOpenaiApiKey] = useState('');

  useEffect(() => {
    if (isOpen) {
      const s = getSettings();
      setOpenaiApiKey(s.openaiApiKey || '');
    }
  }, [isOpen]);

  const handleSave = (e) => {
    e.preventDefault();
    saveSettings({ openaiApiKey });
    onClose();
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="settings-backdrop"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
    >
      <div className="settings-modal">
        <div className="settings-header">
          <h2 id="settings-title">Settings</h2>
          <button type="button" className="settings-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <form onSubmit={handleSave} className="settings-form">
          <p className="settings-hint">
            Your API key is stored only in this browser and is never sent to any server other than OpenAI.
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
