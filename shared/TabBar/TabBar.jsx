/**
 * Shared TabBar component.
 * Used by StoryWriter, InfoGraphics, ColorWriter.
 */
import { useState, useRef, useEffect } from 'react';
import './TabBar.css';

export default function TabBar({
  tabs = [],
  currentTabId,
  onSwitchTab,
  onAddTab,
  onRenameTab,
  onDeleteTab,
  disabled = false,
  defaultTabName = 'Tab',
  addTitle = 'Add tab',
}) {
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const handleRename = (tabId, name) => {
    const trimmed = (name || '').trim();
    if (trimmed && onRenameTab) {
      onRenameTab(tabId, trimmed);
    }
    setEditingId(null);
    setEditName('');
  };

  return (
    <div className="shared-tab-bar">
      <div className="shared-tab-bar-tabs">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`shared-tab-bar-tab ${tab.id === currentTabId ? 'active' : ''}`}
          >
            {editingId === tab.id ? (
              <input
                ref={inputRef}
                type="text"
                className="shared-tab-bar-edit"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleRename(tab.id, editName);
                  }
                  if (e.key === 'Escape') setEditingId(null);
                }}
                onBlur={() => handleRename(tab.id, editName)}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <button
                type="button"
                className="shared-tab-bar-btn"
                onClick={() => onSwitchTab?.(tab.id)}
                onDoubleClick={() => {
                  setEditingId(tab.id);
                  setEditName(tab.name ?? '');
                }}
                disabled={disabled}
              >
                {tab.name || defaultTabName}
              </button>
            )}
            {tabs.length > 1 && (
              <button
                type="button"
                className="shared-tab-bar-close"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteTab?.(tab.id);
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
        className="shared-tab-bar-add"
        onClick={onAddTab}
        disabled={disabled}
        title={addTitle}
        aria-label={addTitle}
      >
        +
      </button>
    </div>
  );
}
