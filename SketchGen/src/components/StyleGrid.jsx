import StyleGridPanel from './StyleGridPanel'
import './StyleGrid.css'

/** @deprecated Sidebar style section — use StylePickerOverlay from the prompt bar. */
export default function StyleGrid(props) {
  const selectedStyle = props.styles.find((s) => s.id === props.selectedId)
  const { collapsed, onCollapsedChange, ...panelProps } = props

  return (
    <div className={`style-grid-section side-panel${collapsed ? ' side-panel-collapsed' : ''}`}>
      <div className="side-panel-header">
        <span className="side-panel-header-label">
          Style
          {collapsed && selectedStyle && (
            <span className="side-panel-header-summary"> · {selectedStyle.name}</span>
          )}
        </span>
        <button
          type="button"
          className="side-panel-toggle"
          onClick={() => onCollapsedChange?.(!collapsed)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand style section' : 'Collapse style section'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d={collapsed ? 'M9 18l6-6-6-6' : 'M6 9l6 6 6-6'} />
          </svg>
        </button>
      </div>
      {!collapsed && (
        <div className="side-panel-body">
          <StyleGridPanel {...panelProps} />
        </div>
      )}
    </div>
  )
}
