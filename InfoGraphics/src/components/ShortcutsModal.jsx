import { useEffect } from 'react'
import './ShortcutsModal.css'

const SHORTCUTS = [
  { keys: ['Ctrl', 'Z'], desc: 'Undo' },
  { keys: ['Ctrl', 'Shift', 'Z'], desc: 'Redo' },
  { keys: ['Ctrl', 'D'], desc: 'Duplicate selection' },
  { keys: ['Delete'], desc: 'Delete selection' },
  { keys: ['?'], desc: 'Show shortcuts' },
  { keys: ['Ctrl', 'L'], desc: 'Align left' },
  { keys: ['Ctrl', 'E'], desc: 'Align center' },
  { keys: ['Ctrl', 'R'], desc: 'Align right' },
  { keys: ['Ctrl', 'T'], desc: 'Align top' },
  { keys: ['Ctrl', 'M'], desc: 'Align middle' },
  { keys: ['Ctrl', 'B'], desc: 'Align bottom' },
  { keys: ['Ctrl', 'Shift', 'H'], desc: 'Distribute horizontally' },
  { keys: ['Ctrl', 'Shift', 'V'], desc: 'Distribute vertically' }
]

export default function ShortcutsModal({ isOpen, onClose }) {
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' || e.key === '?') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="shortcuts-modal-overlay" onClick={onClose}>
      <div className="shortcuts-modal" onClick={e => e.stopPropagation()}>
        <div className="shortcuts-modal-header">
          <h3>Keyboard Shortcuts</h3>
          <button type="button" className="shortcuts-modal-close" onClick={onClose} title="Close (Esc)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="shortcuts-modal-list">
          {SHORTCUTS.map((s, i) => (
            <div key={i} className="shortcuts-modal-row">
              <span className="shortcuts-modal-desc">{s.desc}</span>
              <span className="shortcuts-modal-keys">
                {s.keys.map((k, j) => (
                  <kbd key={j}>{k}</kbd>
                ))}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
