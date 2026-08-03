import { useRef, useEffect, useCallback } from 'react';
import { joinSectionContents } from '../utils/storyDocument';
import './UnifiedStoryEditor.css';

export default function UnifiedStoryEditor({
  sectionOrder,
  sectionsData,
  onUnifiedChange,
  disabled = false,
  placeholder = 'Written or edited story text will appear here…',
  className = '',
}) {
  const textareaRef = useRef(null);
  const value = joinSectionContents(sectionOrder, sectionsData);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(el.scrollHeight, 200)}px`;
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  return (
    <div className={`unified-story-editor ${className}`.trim()}>
      <textarea
        ref={textareaRef}
        className="unified-story-editor__textarea"
        value={value}
        onChange={(e) => {
          onUnifiedChange(e.target.value);
          adjustHeight();
        }}
        onFocus={adjustHeight}
        placeholder={placeholder}
        disabled={disabled}
        spellCheck
      />
    </div>
  );
}
