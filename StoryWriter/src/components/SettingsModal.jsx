import { useState, useEffect } from 'react';
import { getSettings, saveSettings, PRESENTATION_FONTS, PRESENTATION_SIZES } from '../utils/settings';
import './SettingsModal.css';

export default function SettingsModal({ isOpen, onClose }) {
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [presentationFont, setPresentationFont] = useState('Poppins');
  const [presentationFontSize, setPresentationFontSize] = useState('medium');
  const [unsplashAccessKey, setUnsplashAccessKey] = useState('');

  useEffect(() => {
    if (isOpen) {
      const s = getSettings();
      setOpenaiApiKey(s.openaiApiKey || '');
      setPresentationFont(s.presentationFont || 'Poppins');
      setPresentationFontSize(s.presentationFontSize || 'medium');
      setUnsplashAccessKey(s.unsplashAccessKey || '');
    }
  }, [isOpen]);

  const handleSave = (e) => {
    e.preventDefault();
    saveSettings({ openaiApiKey, presentationFont, presentationFontSize, unsplashAccessKey });
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
          <label className="settings-label">
            Presentation font
            <select
              className="settings-input"
              value={presentationFont}
              onChange={(e) => setPresentationFont(e.target.value)}
            >
              {PRESENTATION_FONTS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>
          <label className="settings-label">
            Unsplash Access Key
            <input
              type="password"
              className="settings-input"
              placeholder="For section background images (optional)"
              value={unsplashAccessKey}
              onChange={(e) => setUnsplashAccessKey(e.target.value)}
              autoComplete="off"
            />
          </label>
          <label className="settings-label">
            Presentation text size
            <select
              className="settings-input"
              value={presentationFontSize}
              onChange={(e) => setPresentationFontSize(e.target.value)}
            >
              {PRESENTATION_SIZES.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
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
