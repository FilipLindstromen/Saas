import './ShortcutsModal.css'

function ShortcutsModal({ onClose }) {
  const shortcuts = [
    { key: '?', description: 'Show keyboard shortcuts' },
    { key: 'Cmd/Ctrl + K', description: 'Open command palette' },
    { key: 'Cmd/Ctrl + D', description: 'Duplicate selected slide' },
    { key: 'Cmd/Ctrl + /', description: 'Toggle analysis/comments' },
    { key: '↑ ↓', description: 'Navigate slides (edit mode)' },
    { key: 'Tab', description: 'Cycle through slides in sidebar' },
    { key: 'Cmd/Ctrl + Z', description: 'Undo' },
    { key: 'Cmd/Ctrl + Shift + Z', description: 'Redo' },
    { key: 'Ctrl + Y', description: 'Redo (Windows)' },
    { key: 'Cmd/Ctrl + S', description: 'Save project' },
    { key: 'Delete', description: 'Delete selected slide(s)' },
    { key: 'Esc', description: 'Close modals/dialogs' },
  ]

  return (
    <div className="shortcuts-modal-overlay" onClick={onClose}>
      <div className="shortcuts-modal" onClick={(e) => e.stopPropagation()}>
        <div className="shortcuts-modal-header">
          <h2>Keyboard Shortcuts</h2>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>
        <div className="shortcuts-modal-content">
          <div className="shortcuts-list">
            {shortcuts.map((shortcut, index) => (
              <div key={index} className="shortcut-item">
                <div className="shortcut-keys">
                  {shortcut.key.split(' + ').map((key, i) => (
                    <span key={i} className="shortcut-key">{key}</span>
                  ))}
                </div>
                <div className="shortcut-description">{shortcut.description}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ShortcutsModal
