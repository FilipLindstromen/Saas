import { useState, useEffect, useRef } from 'react';
import {
  TEXT_ANIMATION_TYPES,
  DEFAULT_PRESENTATION_ANIMATION_RULES,
  normalizePresentationAnimationRules,
} from '../utils/textAnimations';
import './PresentationAnimationPopover.css';

export default function PresentationAnimationPopover({ rules, onApply }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(DEFAULT_PRESENTATION_ANIMATION_RULES);
  const popoverRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (open) {
      setDraft(normalizePresentationAnimationRules(rules));
    }
  }, [open, rules]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const update = (patch) => setDraft((prev) => normalizePresentationAnimationRules({ ...prev, ...patch }));

  const handleApply = () => {
    onApply?.(normalizePresentationAnimationRules(draft));
    setOpen(false);
  };

  return (
    <div className="presentation-animation-wrap">
      <button
        ref={buttonRef}
        type="button"
        className="app-settings-btn presentation-animation-btn"
        onClick={() => setOpen((v) => !v)}
        title="Text animation rules (this project)"
        aria-label="Text animation rules"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 7V4h16v3" />
          <path d="M9 20h6" />
          <path d="M12 4v16" />
          <path d="m7 9 2 2-2 2" />
          <path d="m17 9-2 2 2 2" />
        </svg>
      </button>
      {open && (
        <div ref={popoverRef} className="presentation-animation-popover" role="dialog" aria-label="Text animation rules">
          <div className="presentation-animation-popover__title">Text animation rules</div>
          <p className="presentation-animation-popover__hint">
            Saved with this story. Short sentences drop into center; longer ones fade in word by word.
          </p>

          <label className="presentation-animation-popover__label">
            Mode
            <select
              className="presentation-animation-popover__select"
              value={draft.mode}
              onChange={(e) => update({ mode: e.target.value })}
            >
              <option value="smart">Smart (by sentence length)</option>
              <option value="fixed">Fixed animation for all</option>
            </select>
          </label>

          {draft.mode === 'fixed' ? (
            <label className="presentation-animation-popover__label">
              Animation
              <select
                className="presentation-animation-popover__select"
                value={draft.fixedAnimation}
                onChange={(e) => update({ fixedAnimation: e.target.value })}
              >
                {TEXT_ANIMATION_TYPES.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
          ) : (
            <>
              <label className="presentation-animation-popover__label">
                Short sentence — up to {draft.shortMaxWords} words
                <select
                  className="presentation-animation-popover__select"
                  value={draft.shortAnimation}
                  onChange={(e) => update({ shortAnimation: e.target.value })}
                >
                  {TEXT_ANIMATION_TYPES.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </label>
              <label className="presentation-animation-popover__label">
                Short max words — {draft.shortMaxWords}
                <input
                  type="range"
                  className="presentation-animation-popover__range"
                  min={3}
                  max={20}
                  step={1}
                  value={draft.shortMaxWords}
                  onChange={(e) => update({ shortMaxWords: Number(e.target.value) })}
                />
              </label>
              <label className="presentation-animation-popover__label">
                Medium sentence — up to {draft.mediumMaxWords} words
                <select
                  className="presentation-animation-popover__select"
                  value={draft.mediumAnimation}
                  onChange={(e) => update({ mediumAnimation: e.target.value })}
                >
                  {TEXT_ANIMATION_TYPES.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </label>
              <label className="presentation-animation-popover__label">
                Medium max words — {draft.mediumMaxWords}
                <input
                  type="range"
                  className="presentation-animation-popover__range"
                  min={draft.shortMaxWords + 1}
                  max={50}
                  step={1}
                  value={draft.mediumMaxWords}
                  onChange={(e) => update({ mediumMaxWords: Number(e.target.value) })}
                />
              </label>
              <label className="presentation-animation-popover__label">
                Long sentence — over {draft.mediumMaxWords} words
                <select
                  className="presentation-animation-popover__select"
                  value={draft.longAnimation}
                  onChange={(e) => update({ longAnimation: e.target.value })}
                >
                  {TEXT_ANIMATION_TYPES.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </label>
              <label className="presentation-animation-popover__label">
                Word fade stagger — {draft.wordStaggerMs}ms
                <input
                  type="range"
                  className="presentation-animation-popover__range"
                  min={20}
                  max={200}
                  step={5}
                  value={draft.wordStaggerMs}
                  onChange={(e) => update({ wordStaggerMs: Number(e.target.value) })}
                />
              </label>
            </>
          )}

          <div className="presentation-animation-popover__actions">
            <button type="button" className="presentation-animation-popover__btn presentation-animation-popover__btn--primary" onClick={handleApply}>
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
