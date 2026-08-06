import { useMemo, useState } from 'react'
import './LayersPanel.css'

function reorderDisplayLayers(displayLayers, dragId, targetId) {
  if (!dragId || dragId === targetId) return displayLayers
  const from = displayLayers.findIndex((l) => l.id === dragId)
  const to = displayLayers.findIndex((l) => l.id === targetId)
  if (from < 0 || to < 0) return displayLayers
  const next = [...displayLayers]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

export default function LayersPanel({
  layers,
  activeLayerId,
  onSelect,
  onToggleVisibility,
  onAdd,
  onRemove,
  onReorder,
}) {
  const [draggingId, setDraggingId] = useState(null)
  const [dropTargetId, setDropTargetId] = useState(null)

  // Topmost layer (last in the stack) shown first, matching typical design-tool convention.
  const displayLayers = useMemo(() => [...layers].reverse(), [layers])

  const commitReorder = (dragId, targetId) => {
    const reorderedDisplay = reorderDisplayLayers(displayLayers, dragId, targetId)
    const stackBottomToTop = [...reorderedDisplay].reverse().map((l) => l.id)
    onReorder?.(stackBottomToTop)
  }

  const handleDropOn = (targetId) => {
    if (draggingId) commitReorder(draggingId, targetId)
    setDraggingId(null)
    setDropTargetId(null)
  }

  return (
    <div className="layers-panel-section side-panel">
      <div className="layers-panel-header side-panel-header">
        <span>Layers</span>
        <button type="button" className="layers-add-btn" onClick={onAdd} title="Add layer">
          + Add
        </button>
      </div>
      <div className="layers-panel-list side-panel-body">
        {displayLayers.map((layer) => (
          <div
            key={layer.id}
            className={`layers-panel-row${layer.id === activeLayerId ? ' active' : ''}${layer.id === dropTargetId ? ' drop-target' : ''}${layer.id === draggingId ? ' dragging' : ''}`}
            onDragOver={(e) => {
              e.preventDefault()
              if (draggingId && layer.id !== draggingId) setDropTargetId(layer.id)
            }}
            onDragLeave={() => {
              if (dropTargetId === layer.id) setDropTargetId(null)
            }}
            onDrop={(e) => {
              e.preventDefault()
              handleDropOn(layer.id)
            }}
          >
            <span
              className="layers-drag-handle"
              draggable
              title="Drag to reorder"
              aria-label={`Reorder ${layer.name}`}
              onDragStart={(e) => {
                setDraggingId(layer.id)
                e.dataTransfer.effectAllowed = 'move'
                e.dataTransfer.setData('text/plain', layer.id)
              }}
              onDragEnd={() => {
                setDraggingId(null)
                setDropTargetId(null)
              }}
            >
              <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor" aria-hidden>
                <circle cx="2.5" cy="2.5" r="1.2" />
                <circle cx="7.5" cy="2.5" r="1.2" />
                <circle cx="2.5" cy="7" r="1.2" />
                <circle cx="7.5" cy="7" r="1.2" />
                <circle cx="2.5" cy="11.5" r="1.2" />
                <circle cx="7.5" cy="11.5" r="1.2" />
              </svg>
            </span>
            <button
              type="button"
              className="layers-visibility-btn"
              onClick={() => onToggleVisibility(layer.id)}
              title={layer.visible ? 'Hide layer' : 'Show layer'}
            >
              {layer.visible ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.94 10.94 0 0112 19c-7 0-11-7-11-7a18.6 18.6 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 7 11 7a18.5 18.5 0 01-2.16 3.19" />
                  <path d="M14.12 14.12a3 3 0 11-4.24-4.24" />
                  <path d="M1 1l22 22" />
                </svg>
              )}
            </button>
            <button type="button" className="layers-name-btn" onClick={() => onSelect(layer.id)}>
              {layer.kind === 'generation' && <span className="layers-kind-badge" title="Generated layer">✨</span>}
              {layer.name}
            </button>
            <button
              type="button"
              className="layers-remove-btn"
              onClick={() => onRemove(layer.id)}
              disabled={layers.length <= 1}
              title={layers.length <= 1 ? "Can't remove the last layer" : 'Remove layer'}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
