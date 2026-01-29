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
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sectionDef.id });

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
        <h3 className="story-section__title">{sectionDef.title}</h3>
        <p className="story-section__desc">{sectionDef.description}</p>
        <label className="story-section__content-label">
          Story text
          <textarea
            className="story-section__textarea"
            placeholder="Generated or edited story text will appear here…"
            value={content}
            onChange={(e) => onContentChange(sectionDef.id, e.target.value)}
            disabled={isGenerating}
            rows={6}
          />
        </label>
      </div>
    </div>
  );
}
