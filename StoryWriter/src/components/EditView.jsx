import { useRef, useEffect, useCallback, useState } from 'react';
import { getSettings } from '../utils/settings';
import UnsplashPicker from './UnsplashPicker';
import './EditView.css';

function EditStep({
  sectionId,
  sectionTitle,
  content,
  backgroundImageUrl,
  onContentChange,
  onSetBackgroundImage,
  onRemoveBackgroundImage,
}) {
  const textareaRef = useRef(null);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.max(el.scrollHeight, 80) + 'px';
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [content, adjustHeight]);

  return (
    <div className="edit-step">
      <div className="edit-step__label">{sectionTitle}</div>
      <textarea
        ref={textareaRef}
        className="edit-step__content"
        value={content}
        onChange={(e) => {
          onContentChange(sectionId, e.target.value);
          adjustHeight();
        }}
        onFocus={adjustHeight}
        placeholder="Story text for this step…"
        rows={3}
      />
      <div className="edit-step__background">
        {backgroundImageUrl ? (
          <>
            <img
              className="edit-step__background-thumb"
              src={backgroundImageUrl}
              alt="Section background"
            />
            <button
              type="button"
              className="edit-step__background-btn"
              onClick={() => onSetBackgroundImage(sectionId)}
            >
              Change image
            </button>
            <button
              type="button"
              className="edit-step__background-remove"
              onClick={() => onRemoveBackgroundImage(sectionId)}
            >
              Remove
            </button>
          </>
        ) : (
          <button
            type="button"
            className="edit-step__background-btn"
            onClick={() => onSetBackgroundImage(sectionId)}
          >
            Add background image
          </button>
        )}
      </div>
    </div>
  );
}

export default function EditView({
  sectionOrder,
  sectionDefs,
  sectionsData,
  onContentChange,
  onSectionBackgroundChange,
  onBackgroundOpacityChange,
}) {
  const [pickerSectionId, setPickerSectionId] = useState(null);
  const [opacity, setOpacity] = useState(() => getSettings().presentationBackgroundOpacity ?? 0.35);

  const handleOpacityChange = useCallback(
    (e) => {
      const v = parseFloat(e.target.value);
      setOpacity(v);
      onBackgroundOpacityChange?.(v);
    },
    [onBackgroundOpacityChange]
  );

  const handlePickerSelect = useCallback(
    (url, credit) => {
      if (pickerSectionId) {
        onSectionBackgroundChange?.(pickerSectionId, { url, credit });
        setPickerSectionId(null);
      }
    },
    [pickerSectionId, onSectionBackgroundChange]
  );

  return (
    <div className="edit-view">
      <div className="edit-view__opacity">
        <span className="edit-view__opacity-label">Background image transparency</span>
        <input
          type="range"
          className="edit-view__opacity-slider"
          min="0"
          max="1"
          step="0.05"
          value={opacity}
          onChange={handleOpacityChange}
          aria-label="Background image transparency"
        />
      </div>
      {sectionOrder.map((sectionId) => {
        const def = sectionDefs[sectionId];
        const section = sectionsData[sectionId];
        return (
          <EditStep
            key={sectionId}
            sectionId={sectionId}
            sectionTitle={def?.title ?? sectionId}
            content={section?.content ?? ''}
            backgroundImageUrl={section?.backgroundImageUrl ?? ''}
            onContentChange={onContentChange}
            onSetBackgroundImage={setPickerSectionId}
            onRemoveBackgroundImage={(id) => onSectionBackgroundChange?.(id, { url: '', credit: '' })}
          />
        );
      })}
      <UnsplashPicker
        isOpen={pickerSectionId !== null}
        onClose={() => setPickerSectionId(null)}
        onSelect={handlePickerSelect}
      />
    </div>
  );
}
