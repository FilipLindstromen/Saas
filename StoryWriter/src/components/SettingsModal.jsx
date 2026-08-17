import { useState, useEffect } from 'react';
import {
  getSettings,
  saveSettings,
  PRESENTATION_FONTS,
  PRESENTATION_SIZES,
  PRESENTATION_ASPECT_RATIOS,
  LINE_HEIGHT_OPTIONS,
} from '../utils/settings';
import './SettingsModal.css';

export default function SettingsModal({ isOpen, onClose }) {
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [unsplashAccessKey, setUnsplashAccessKey] = useState('');
  const [pexelsApiKey, setPexelsApiKey] = useState('');
  const [pixabayApiKey, setPixabayApiKey] = useState('');
  const [presentationFont, setPresentationFont] = useState('Poppins');
  const [presentationFontSize, setPresentationFontSize] = useState('medium');
  const [presentationFontSizePercent, setPresentationFontSizePercent] = useState(100);
  const [presentationTextWidthPercent, setPresentationTextWidthPercent] = useState(90);
  const [presentationAspectRatio, setPresentationAspectRatio] = useState('full');
  const [presentationLineHeight, setPresentationLineHeight] = useState('1.4');

  useEffect(() => {
    if (isOpen) {
      const s = getSettings();
      setOpenaiApiKey(s.openaiApiKey || '');
      setPresentationFont(s.presentationFont || 'Poppins');
      setPresentationFontSize(s.presentationFontSize || 'medium');
      setPresentationFontSizePercent(s.presentationFontSizePercent ?? 100);
      setPresentationTextWidthPercent(s.presentationTextWidthPercent ?? 90);
      setPresentationAspectRatio(s.presentationAspectRatio || 'full');
      setPresentationLineHeight(s.presentationLineHeight || '1.4');
      setUnsplashAccessKey(s.unsplashAccessKey || '');
      setPexelsApiKey(s.pexelsApiKey || '');
      setPixabayApiKey(s.pixabayApiKey || '');
    }
  }, [isOpen]);

  const handleSave = (e) => {
    e.preventDefault();
    saveSettings({
      ...getSettings(),
      openaiApiKey,
      unsplashAccessKey,
      pexelsApiKey,
      pixabayApiKey,
      presentationFont,
      presentationFontSize,
      presentationFontSizePercent,
      presentationTextWidthPercent,
      presentationAspectRatio,
      presentationLineHeight,
    });
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
            API keys are stored once and shared across all Saas apps (PitchDeck, InfoGraphics, ColorWriter, PowerWriter, etc.).
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
            Presentation size
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
          <label className="settings-label">
            <span className="settings-label-row">
              Font size <span className="settings-label-value">{presentationFontSizePercent}%</span>
            </span>
            <input
              type="range"
              className="settings-slider"
              min={50}
              max={200}
              step={5}
              value={presentationFontSizePercent}
              onChange={(e) => setPresentationFontSizePercent(Number(e.target.value))}
            />
          </label>
          <label className="settings-label">
            <span className="settings-label-row">
              Text width <span className="settings-label-value">{presentationTextWidthPercent}%</span>
            </span>
            <input
              type="range"
              className="settings-slider"
              min={20}
              max={100}
              step={5}
              value={presentationTextWidthPercent}
              onChange={(e) => setPresentationTextWidthPercent(Number(e.target.value))}
            />
          </label>
          <label className="settings-label">
            Presentation format
            <select
              className="settings-input"
              value={presentationAspectRatio}
              onChange={(e) => setPresentationAspectRatio(e.target.value)}
            >
              {PRESENTATION_ASPECT_RATIOS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="settings-label">
            Line height
            <select
              className="settings-input"
              value={presentationLineHeight}
              onChange={(e) => setPresentationLineHeight(e.target.value)}
            >
              {LINE_HEIGHT_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="settings-label">
            Unsplash Access Key
            <input
              type="password"
              className="settings-input"
              placeholder="For Unsplash photos"
              value={unsplashAccessKey}
              onChange={(e) => setUnsplashAccessKey(e.target.value)}
              autoComplete="off"
            />
          </label>
          <label className="settings-label">
            Pexels API Key
            <input
              type="password"
              className="settings-input"
              placeholder="For Pexels photos and videos"
              value={pexelsApiKey}
              onChange={(e) => setPexelsApiKey(e.target.value)}
              autoComplete="off"
            />
          </label>
          <label className="settings-label">
            Pixabay API Key
            <input
              type="password"
              className="settings-input"
              placeholder="For Pixabay photos and videos"
              value={pixabayApiKey}
              onChange={(e) => setPixabayApiKey(e.target.value)}
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
