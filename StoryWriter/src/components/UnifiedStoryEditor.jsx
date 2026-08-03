import { useRef } from 'react';
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

  return (
    <div className={`unified-story-editor ${className}`.trim()}>
      <textarea
        ref={textareaRef}
        className="unified-story-editor__textarea"
        value={value}
        onChange={(e) => onUnifiedChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        spellCheck
      />
    </div>
  );
}
