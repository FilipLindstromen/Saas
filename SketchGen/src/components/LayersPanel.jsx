import { useEffect, useMemo, useRef, useState } from 'react'
import { LAYER_BLEND_MODES } from '../utils/layerBlend'
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

function LayerIconNew() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  )
}

function LayerIconDuplicate() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="9" y="9" width="11" height="11" rx="1" />
      <path d="M5 15H4a1 1 0 01-1-1V4a1 1 0 011-1h10a1 1 0 011 1v1" />
    </svg>
  )
}

function LayerIconDelete() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function LayersPanel({
  layers,
  activeLayerId,
  onSelect,
  onToggleVisibility,
  onToggleLock,
  onAdd,
  onDuplicate,
  onRemove,
  onReorder,
  onRename,
  onOpacityChange,
  onBlendModeChange,
}) {
  const [draggingId, setDraggingId] = useState(null)
  const [dropTargetId, setDropTargetId] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const renameInputRef = useRef(null)

  const displayLayers = useMemo(() => [...layers].reverse(), [layers])
  const activeLayer = layers.find((l) => l.id === activeLayerId) ?? layers[layers.length - 1]

  useEffect(() => {
    if (editingId && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [editingId])

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

  const startRename = (layer) => {
    setEditingId(layer.id)
    setEditName(layer.name)
  }

  const commitRename = () => {
    if (editingId) onRename?.(editingId, editName)
    setEditingId(null)
  }

  return (
    <div className="layers-panel side-panel">
      <div className="side-panel-header">
        <span className="side-panel-header-label">Layers</span>
        <span className="layers-panel-count">{layers.length}</span>
      </div>

      <div className="layers-panel-list" role="list">
        {displayLayers.map((layer) => {
          const isActive = layer.id === activeLayerId
          return (
            <div
              key={layer.id}
              role="listitem"
              className={`layers-row${isActive ? ' active' : ''}${!layer.visible ? ' hidden-layer' : ''}${layer.locked ? ' locked' : ''}${layer.id === dropTargetId ? ' drop-target' : ''}${layer.id === draggingId ? ' dragging' : ''}`}
              draggable={editingId !== layer.id}
              onDragStart={(e) => {
                if (editingId === layer.id) {
                  e.preventDefault()
                  return
                }
                setDraggingId(layer.id)
                e.dataTransfer.effectAllowed = 'move'
                e.dataTransfer.setData('text/plain', layer.id)
              }}
              onDragEnd={() => {
                setDraggingId(null)
                setDropTargetId(null)
              }}
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
              onClick={() => onSelect(layer.id)}
            >
              <div className="layers-thumb" aria-hidden>
                {layer.thumbnail ? (
                  <img src={layer.thumbnail} alt="" draggable={false} />
                ) : (
                  <span className="layers-thumb-empty" />
                )}
              </div>

              <button
                type="button"
                className="layers-eye-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleVisibility(layer.id)
                }}
                title={layer.visible ? 'Hide layer' : 'Show layer'}
                aria-label={layer.visible ? `Hide ${layer.name}` : `Show ${layer.name}`}
              >
                {layer.visible ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.94 10.94 0 0112 19c-7 0-11-7-11-7a18.6 18.6 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 7 11 7a18.5 18.5 0 01-2.16 3.19" />
                    <path d="M1 1l22 22" />
                  </svg>
                )}
              </button>

              <div className="layers-name-cell">
                {editingId === layer.id ? (
                  <input
                    ref={renameInputRef}
                    className="layers-rename-input"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onBlur={commitRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename()
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                  />
                ) : (
                  <span
                    className="layers-name-text"
                    onDoubleClick={(e) => {
                      e.stopPropagation()
                      startRename(layer)
                    }}
                    title="Double-click to rename"
                  >
                    {layer.kind === 'generation' && <span className="layers-kind-badge" title="Generated layer">✨</span>}
                    {layer.name}
                  </span>
                )}
              </div>

              <button
                type="button"
                className={`layers-lock-btn${layer.locked ? ' on' : ''}`}
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleLock?.(layer.id)
                }}
                title={layer.locked ? 'Unlock layer' : 'Lock layer'}
                aria-label={layer.locked ? `Unlock ${layer.name}` : `Lock ${layer.name}`}
              >
                {layer.locked ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="5" y="11" width="14" height="10" rx="2" />
                    <path d="M8 11V7a4 4 0 018 0v4" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="5" y="11" width="14" height="10" rx="2" />
                    <path d="M8 11V7a4 4 0 017.8-1" />
                  </svg>
                )}
              </button>
            </div>
          )
        })}
      </div>

      <div className="layers-panel-footer">
        <div className="layers-toolbar" role="toolbar" aria-label="Layer actions">
          <button type="button" className="layers-toolbar-btn" onClick={onAdd} title="New layer">
            <LayerIconNew />
          </button>
          <button
            type="button"
            className="layers-toolbar-btn"
            onClick={() => activeLayerId && onDuplicate?.(activeLayerId)}
            disabled={!activeLayerId}
            title="Duplicate active layer"
          >
            <LayerIconDuplicate />
          </button>
          <button
            type="button"
            className="layers-toolbar-btn"
            onClick={() => activeLayerId && onRemove?.(activeLayerId)}
            disabled={layers.length <= 1 || !activeLayerId}
            title={layers.length <= 1 ? "Can't delete the last layer" : 'Delete active layer'}
          >
            <LayerIconDelete />
          </button>
        </div>

        {activeLayer && (
          <div className="layers-active-controls">
            <div className="layers-control-row">
              <label className="layers-control-label" htmlFor="layer-opacity">Opacity</label>
              <input
                id="layer-opacity"
                type="range"
                min="0"
                max="100"
                value={Math.round((activeLayer.opacity ?? 1) * 100)}
                onChange={(e) => onOpacityChange?.(activeLayer.id, Number(e.target.value) / 100)}
              />
              <span className="layers-control-value">{Math.round((activeLayer.opacity ?? 1) * 100)}%</span>
            </div>
            <div className="layers-control-row">
              <label className="layers-control-label" htmlFor="layer-blend">Blend</label>
              <select
                id="layer-blend"
                className="layers-blend-select"
                value={activeLayer.blendMode ?? 'normal'}
                onChange={(e) => onBlendModeChange?.(activeLayer.id, e.target.value)}
              >
                {LAYER_BLEND_MODES.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
