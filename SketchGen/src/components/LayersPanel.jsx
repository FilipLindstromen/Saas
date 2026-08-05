import './LayersPanel.css'

export default function LayersPanel({ layers, activeLayerId, onSelect, onToggleVisibility, onAdd, onRemove }) {
  // Topmost layer (last in the stack) shown first, matching typical design-tool convention.
  const displayLayers = [...layers].reverse()

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
          <div key={layer.id} className={`layers-panel-row ${layer.id === activeLayerId ? 'active' : ''}`}>
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
