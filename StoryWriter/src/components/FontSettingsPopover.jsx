import { useState, useEffect, useRef } from 'react';
import {
  getSettings,
  saveSettings,
  PRESENTATION_FONTS,
  PRESENTATION_SIZES,
  LINE_HEIGHT_OPTIONS,
  PRESENTATION_ASPECT_RATIOS,
} from '../utils/settings';
import './FontSettingsPopover.css';

export default function FontSettingsPopover({ onApply }) {
  const [open, setOpen] = useState(false);
  const [font, setFont] = useState('Poppins');
  const [fontSize, setFontSize] = useState('medium');
  const [fontSizePercent, setFontSizePercent] = useState(100);
  const [textWidthPercent, setTextWidthPercent] = useState(90);
  const [aspectRatio, setAspectRatio] = useState('full');
  const [lineHeight, setLineHeight] = useState('1.4');
  const popoverRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (open) {
      const s = getSettings();
      setFont(s.presentationFont || 'Poppins');
      setFontSize(s.presentationFontSize || 'medium');
      setFontSizePercent(s.presentationFontSizePercent ?? 100);
      setTextWidthPercent(s.presentationTextWidthPercent ?? 90);
      setAspectRatio(s.presentationAspectRatio || 'full');
      setLineHeight(LINE_HEIGHT_OPTIONS.some((o) => o.value === s.presentationLineHeight) ? s.presentationLineHeight : '1.4');
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target) && buttonRef.current && !buttonRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleApply = () => {
    const s = getSettings();
    saveSettings({
      ...s,
      presentationFont: font,
      presentationFontSize: fontSize,
      presentationFontSizePercent: fontSizePercent,
      presentationTextWidthPercent: textWidthPercent,
      presentationAspectRatio: aspectRatio,
      presentationLineHeight: lineHeight,
    });
    setOpen(false);
    onApply?.();
  };

  return (
    <div className="font-settings-wrap">
      <button
        ref={buttonRef}
        type="button"
        className="app-settings-btn font-settings-btn"
        onClick={() => setOpen((v) => !v)}
        title="Font settings"
        aria-label="Font settings"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="4 7 4 4 20 4 20 7" />
          <line x1="9" y1="20" x2="15" y2="20" />
          <line x1="12" y1="4" x2="12" y2="20" />
        </svg>
      </button>
      {open && (
        <div ref={popoverRef} className="font-settings-popover" role="dialog" aria-label="Font settings">
          <div className="font-settings-popover__title">Font settings</div>
          <label className="font-settings-popover__label">
            Presentation font
            <select
              className="font-settings-popover__select"
              value={font}
              onChange={(e) => setFont(e.target.value)}
            >
              {PRESENTATION_FONTS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>
          <label className="font-settings-popover__label">
            Text size
            <select
              className="font-settings-popover__select"
              value={fontSize}
              onChange={(e) => setFontSize(e.target.value)}
            >
              {PRESENTATION_SIZES.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="font-settings-popover__label">
            <span className="font-settings-popover__label-row">
              Font size <span className="font-settings-popover__value">{fontSizePercent}%</span>
            </span>
            <input
              type="range"
              className="font-settings-popover__slider"
              min={50}
              max={200}
              step={5}
              value={fontSizePercent}
              onChange={(e) => setFontSizePercent(Number(e.target.value))}
            />
          </label>
          <label className="font-settings-popover__label">
            <span className="font-settings-popover__label-row">
              Text width <span className="font-settings-popover__value">{textWidthPercent}%</span>
            </span>
            <input
              type="range"
              className="font-settings-popover__slider"
              min={20}
              max={100}
              step={5}
              value={textWidthPercent}
              onChange={(e) => setTextWidthPercent(Number(e.target.value))}
            />
          </label>
          <label className="font-settings-popover__label">
            Presentation format
            <select
              className="font-settings-popover__select"
              value={aspectRatio}
              onChange={(e) => setAspectRatio(e.target.value)}
            >
              {PRESENTATION_ASPECT_RATIOS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="font-settings-popover__label">
            Line height
            <select
              className="font-settings-popover__select"
              value={lineHeight}
              onChange={(e) => setLineHeight(e.target.value)}
            >
              {LINE_HEIGHT_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <div className="font-settings-popover__actions">
            <button type="button" className="font-settings-popover__btn font-settings-popover__btn--primary" onClick={handleApply}>
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
