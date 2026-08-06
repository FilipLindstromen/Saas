import './ImageContextMenu.css'

const EXPORT_ITEMS = [
  { id: 'png', label: 'Export as PNG' },
  { id: 'png-transparent', label: 'Export as transparent PNG' },
  { id: 'copy', label: 'Copy to clipboard' },
  { id: 'copy-transparent', label: 'Copy transparent to clipboard' },
]

/** Small floating menu shown at the cursor position on right-click over a generated image. */
export default function ImageContextMenu({
  x,
  y,
  onExport,
  onSetAsSketch,
  onAddAsLayer,
  onClose,
}) {
  return (
    <div
      className="image-context-menu-backdrop"
      onClick={onClose}
      onContextMenu={(e) => { e.preventDefault(); onClose() }}
    >
      <div
        className="image-context-menu"
        style={{ left: x, top: y }}
        onClick={(e) => e.stopPropagation()}
      >
        {EXPORT_ITEMS.map(({ id, label }) => (
          <button key={id} type="button" onClick={() => onExport?.(id)}>
            {label}
          </button>
        ))}
        {(onSetAsSketch || onAddAsLayer) && <div className="image-context-menu-divider" role="separator" />}
        {onSetAsSketch && (
          <button type="button" onClick={onSetAsSketch}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M8 12h8" />
              <path d="M12 8v8" />
            </svg>
            Set as sketch
          </button>
        )}
        {onAddAsLayer && (
          <button type="button" onClick={onAddAsLayer}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v12" />
              <path d="M3 12h18" />
              <rect x="3" y="14" width="18" height="7" rx="1" />
            </svg>
            Add as layer
          </button>
        )}
      </div>
    </div>
  )
}
