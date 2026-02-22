import { useState, useRef, useEffect } from 'react'
import './TabBar.css'

export default function TabBar({
  tabs = [],
  currentTabId,
  currentTabName,
  onSwitchTab,
  onAddTab,
  onRenameTab,
  onDeleteTab,
  disabled = false
}) {
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingId])

  const handleRename = (tabId, name) => {
    const trimmed = (name || '').trim()
    if (trimmed && onRenameTab) {
      onRenameTab(tabId, trimmed)
    }
    setEditingId(null)
    setEditName('')
  }

  return (
    <div className="tab-bar">
      <div className="tab-bar-tabs">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`tab-bar-tab ${tab.id === currentTabId ? 'active' : ''}`}
          >
            {editingId === tab.id ? (
              <input
                ref={inputRef}
                type="text"
                className="tab-bar-tab-edit"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleRename(tab.id, editName)
                  }
                  if (e.key === 'Escape') setEditingId(null)
                }}
                onBlur={() => handleRename(tab.id, editName)}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <button
                type="button"
                className="tab-bar-tab-btn"
                onClick={() => onSwitchTab?.(tab.id)}
                onDoubleClick={() => {
                  setEditingId(tab.id)
                  setEditName(tab.name)
                }}
                disabled={disabled}
              >
                {tab.name || 'Story'}
              </button>
            )}
            {tabs.length > 1 && (
              <button
                type="button"
                className="tab-bar-tab-close"
                onClick={(e) => {
                  e.stopPropagation()
                  onDeleteTab?.(tab.id)
                }}
                disabled={disabled}
                title="Close tab"
                aria-label="Close tab"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
      <button
        type="button"
        className="tab-bar-add"
        onClick={onAddTab}
        disabled={disabled}
        title="Add story"
        aria-label="Add story"
      >
        +
      </button>
    </div>
  )
}
