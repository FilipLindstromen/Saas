import './BottomMenu.css'

function BottomMenu({ currentMode, onModeChange }) {
  return (
    <div className="bottom-menu">
      <button
        className={`menu-item ${currentMode === 'plan' ? 'active' : ''}`}
        onClick={() => onModeChange('plan')}
      >
        <div className="menu-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
        </div>
        <span className="menu-label">Plan</span>
      </button>
      <div className="menu-arrow">→</div>
      <button
        className={`menu-item ${currentMode === 'edit' ? 'active' : ''}`}
        onClick={() => onModeChange('edit')}
      >
        <div className="menu-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </div>
        <span className="menu-label">Edit</span>
      </button>
      <div className="menu-arrow">→</div>
      <button
        className={`menu-item ${currentMode === 'present' ? 'active' : ''}`}
        onClick={() => onModeChange('present')}
      >
        <div className="menu-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        </div>
        <span className="menu-label">Present</span>
      </button>
    </div>
  )
}

export default BottomMenu
