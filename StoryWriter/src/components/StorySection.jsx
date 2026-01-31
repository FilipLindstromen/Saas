import { useRef, useEffect, useCallback } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import './StorySection.css';

export default function StorySection({
  sectionDef,
  sectionData,
  index,
  onContentChange,
  isGenerating,
}) {
  const { content = '' } = sectionData || {};
  const textareaRef = useRef(null);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sectionDef.id });

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.max(el.scrollHeight, 80) + 'px';
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [content, adjustHeight]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`story-section ${isDragging ? 'story-section--dragging' : ''}`}
    >
      <div className="story-section__handle" {...attributes} {...listeners} title="Drag to reorder">
        <span className="story-section__handle-icon">⋮⋮</span>
        <span className="story-section__number">{index + 1}</span>
      </div>
      <div className="story-section__body">
        <h3 className="story-section__title" title={sectionDef.description}>
          {sectionDef.title}
        </h3>
        <textarea
            ref={textareaRef}
            className="story-section__textarea"
            placeholder="Written or edited story text will appear here…"
            value={content}
            onChange={(e) => {
              onContentChange(sectionDef.id, e.target.value);
              adjustHeight();
            }}
            onFocus={adjustHeight}
            disabled={isGenerating}
            rows={3}
          />
      </div>
    </div>
  );
}
