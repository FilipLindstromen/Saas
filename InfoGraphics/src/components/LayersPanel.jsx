import { useState, useRef, useEffect } from 'react'
import './LayersPanel.css'

function getDefaultLabel(el) {
  if (el.type === 'headline') return el.text || 'Headline'
  if (el.type === 'cta') return el.text || 'CTA'
  if (el.type === 'arrow') return 'Arrow'
  if (el.type === 'image') return 'Image'
  if (el.type === 'image-text') return el.text || 'Image+Text'
  return el.type
}

function getElementLabel(el) {
  return (el.layerName && el.layerName.trim()) || getDefaultLabel(el)
}

export default function LayersPanel({ elements, selectedIds = [], onSelect, onReorder, onReorderToIndex, onToggleVisibility, onRename }) {
  const [dragOverIndex, setDragOverIndex] = useState(null)
  const [draggingId, setDraggingId] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState('')
  const sorted = [...elements].sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0))

  const handleDragStart = (e, el, index) => {
    if (e.target.closest('button')) {
      e.preventDefault()
      return
    }
    setDraggingId(el.id)
    e.dataTransfer.setData('text/plain', JSON.stringify({ id: el.id, index }))
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setDragImage(e.currentTarget, 0, 0)
  }

  const handleDragOver = (e, index) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIndex(index)
  }

  const handleDrop = (e, targetIndex) => {
    e.preventDefault()
    setDragOverIndex(null)
    setDraggingId(null)
    try {
      const { id } = JSON.parse(e.dataTransfer.getData('text/plain'))
      if (onReorderToIndex && id) onReorderToIndex(id, targetIndex)
    } catch (_) {}
  }

  const handleDragEnd = () => {
    setDragOverIndex(null)
    setDraggingId(null)
  }

  const editInputRef = useRef(null)
  useEffect(() => {
    if (editingId) editInputRef.current?.focus()
  }, [editingId])

  const startEditing = (el, e) => {
    e.stopPropagation()
    if (e.target.closest('button')) return
    setEditingId(el.id)
    setEditValue(getElementLabel(el))
  }

  const commitRename = (id) => {
    if (!onRename) return
    const trimmed = editValue.trim()
    onRename(id, trimmed || null)
    setEditingId(null)
    setEditValue('')
  }

  const handleRenameKeyDown = (e, id) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      commitRename(id)
    }
    if (e.key === 'Escape') {
      setEditingId(null)
      setEditValue('')
    }
  }

  return (
    <div className="layers-panel">
      <div className="layers-header">
        <span className="layers-title">Layers</span>
      </div>
      <div
        className="layers-list"
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) setDragOverIndex(null)
        }}
      >
        {sorted.map((el, i) => (
          <div
            key={el.id}
            draggable={editingId !== el.id}
            className={`layers-item ${selectedIds.includes(el.id) ? 'selected' : ''} ${el.visible === false ? 'hidden' : ''} ${draggingId === el.id ? 'layers-item-dragging' : ''} ${dragOverIndex === i ? 'layers-item-drag-over' : ''}`}
            onClick={(e) => onSelect(el.id, { shift: e.shiftKey })}
            onDragStart={(e) => handleDragStart(e, el, i)}
            onDragOver={(e) => handleDragOver(e, i)}
            onDrop={(e) => handleDrop(e, i)}
            onDragEnd={handleDragEnd}
          >
            <span className="layers-drag-handle" title="Drag to reorder">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" opacity="0.5">
                <circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" />
                <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
                <circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" />
              </svg>
            </span>
            <button
              type="button"
              className="layers-visibility"
              onClick={(e) => { e.stopPropagation(); onToggleVisibility(el.id) }}
              title={el.visible !== false ? 'Hide' : 'Show'}
            >
              {el.visible !== false ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              )}
            </button>
            {editingId === el.id ? (
              <input
                ref={editInputRef}
                type="text"
                className="layers-label-input"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={() => commitRename(el.id)}
                onKeyDown={(e) => handleRenameKeyDown(e, el.id)}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span
                className="layers-label"
                onDoubleClick={(e) => startEditing(el, e)}
                title="Double-click to rename"
              >
                {getElementLabel(el)}
              </span>
            )}
            <div className="layers-actions">
              <button
                type="button"
                className="layers-move"
                onClick={(e) => { e.stopPropagation(); onReorder(el.id, 'up') }}
                disabled={i === 0}
                title="Bring forward"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 15l-6-6-6 6" />
                </svg>
              </button>
              <button
                type="button"
                className="layers-move"
                onClick={(e) => { e.stopPropagation(); onReorder(el.id, 'down') }}
                disabled={i === sorted.length - 1}
                title="Send backward"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
