import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import StorySection from './StorySection';
import { SECTION_DEFINITIONS } from '../constants/sections';
import './SortableSectionList.css';

export default function SortableSectionList({
  sectionOrder,
  sectionsData,
  onReorder,
  onContentChange,
  isGenerating,
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sectionOrder.indexOf(active.id);
    const newIndex = sectionOrder.indexOf(over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const newOrder = arrayMove(sectionOrder, oldIndex, newIndex);
    onReorder(newOrder);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={sectionOrder} strategy={verticalListSortingStrategy}>
        <div className="section-list" role="list">
          {sectionOrder.map((sectionId, index) => {
            const def = SECTION_DEFINITIONS[sectionId];
            if (!def) return null;
            return (
              <StorySection
                key={sectionId}
                sectionDef={def}
                sectionData={sectionsData[sectionId]}
                index={index}
                onContentChange={onContentChange}
                isGenerating={isGenerating}
              />
            );
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
}
