import { useState, useEffect, useRef } from 'react';
import { getSettings, saveSettings, TEXT_ANIMATION_OPTIONS } from '../utils/settings';
import './BackgroundAnimationPopover.css';

const DURATION_MIN = 1;
const DURATION_MAX = 30;
const SCALE_MIN = 1;
const SCALE_MAX = 1.5;
const SCALE_STEP = 0.05;

export default function BackgroundAnimationPopover({ onApply }) {
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [duration, setDuration] = useState(30);
  const [scale, setScale] = useState(1.15);
  const [textAnimation, setTextAnimation] = useState('slide-up');
  const popoverRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (open) {
      const s = getSettings();
      setEnabled(s.presentationBackgroundAnimation !== false);
      const d = Number(s.presentationBackgroundAnimationDuration);
      setDuration(Math.min(DURATION_MAX, Math.max(DURATION_MIN, d || 30)));
      const sc = Number(s.presentationBackgroundAnimationScale);
      setScale(Math.min(SCALE_MAX, Math.max(SCALE_MIN, sc || 1.15)));
      const ta = s.presentationTextAnimation;
      setTextAnimation(TEXT_ANIMATION_OPTIONS.some((o) => o.value === ta) ? ta : 'slide-up');
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
      presentationBackgroundAnimation: enabled,
      presentationBackgroundAnimationDuration: duration,
      presentationBackgroundAnimationScale: scale,
      presentationTextAnimation: textAnimation,
    });
    setOpen(false);
    onApply?.();
  };

  return (
    <div className="background-animation-wrap">
      <button
        ref={buttonRef}
        type="button"
        className="app-settings-btn background-animation-btn"
        onClick={() => setOpen((v) => !v)}
        title="Background animation"
        aria-label="Background animation"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18" />
          <path d="M9 21V9" />
        </svg>
      </button>
      {open && (
        <div ref={popoverRef} className="background-animation-popover" role="dialog" aria-label="Background animation">
          <div className="background-animation-popover__title">Background animation</div>
          <label className="background-animation-popover__label background-animation-popover__label--checkbox">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            <span>Animate backgrounds in Present (zoom and drift)</span>
          </label>
          <label className="background-animation-popover__label">
            Duration (seconds) — {duration}
            <input
              type="range"
              className="background-animation-popover__range"
              min={DURATION_MIN}
              max={DURATION_MAX}
              step={1}
              value={duration}
              onChange={(e) => setDuration(Math.min(DURATION_MAX, Math.max(DURATION_MIN, Number(e.target.value) || DURATION_MIN)))}
            />
          </label>
          <label className="background-animation-popover__label">
            Text animation
            <select
              className="background-animation-popover__select"
              value={textAnimation}
              onChange={(e) => setTextAnimation(e.target.value)}
            >
              {TEXT_ANIMATION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="background-animation-popover__label">
            Scale (zoom) — {(scale * 100).toFixed(0)}%
            <input
              type="range"
              className="background-animation-popover__range"
              min={SCALE_MIN}
              max={SCALE_MAX}
              step={SCALE_STEP}
              value={scale}
              onChange={(e) => setScale(parseFloat(e.target.value))}
            />
          </label>
          <div className="background-animation-popover__actions">
            <button type="button" className="background-animation-popover__btn background-animation-popover__btn--primary" onClick={handleApply}>
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
