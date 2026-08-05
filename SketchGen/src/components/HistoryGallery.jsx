import './HistoryGallery.css'

export default function HistoryGallery({ items, activeId, onSelect, onDelete }) {
  if (!items.length) return null

  return (
    <div className="history-gallery-section side-panel">
      <div className="side-panel-header">History</div>
      <div className="side-panel-body">
        <div className="history-gallery-strip">
          {items.map((item) => (
            <div key={item.id} className={`history-gallery-item ${item.id === activeId ? 'active' : ''}`}>
              <button type="button" onClick={() => onSelect(item)} title={`${item.styleName}${item.instructions ? ' — ' + item.instructions : ''}`}>
                <img src={item.dataUrl} alt={item.styleName} />
                <span className="history-gallery-label">{item.styleName}</span>
              </button>
              <button
                type="button"
                className="history-gallery-delete"
                onClick={(e) => { e.stopPropagation(); onDelete(item.id) }}
                aria-label="Delete"
                title="Delete"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
