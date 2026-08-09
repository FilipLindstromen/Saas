import './ImageContextMenu.css'

/** Right-click menu on the sketch canvas: layer actions, plus selection actions when one is floating. */
export default function CanvasContextMenu({
  x,
  y,
  hasFloatingSelection,
  canDeleteLayer,
  onFlipHorizontal,
  onFlipVertical,
  onDuplicateLayer,
  onClearLayer,
  onDeleteLayer,
  onSplitSelectionToLayer,
  onApplySelection,
  onDeleteSelection,
  onClose,
}) {
  const run = (fn) => () => {
    fn?.()
    onClose?.()
  }

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
        <button type="button" onClick={run(onFlipHorizontal)}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v18" strokeDasharray="2 2" />
            <path d="M17 8l3 4-3 4" />
            <path d="M7 8l-3 4 3 4" />
          </svg>
          Flip horizontal
        </button>
        <button type="button" onClick={run(onFlipVertical)}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12h18" strokeDasharray="2 2" />
            <path d="M8 7l4-3 4 3" />
            <path d="M8 17l4 3 4-3" />
          </svg>
          Flip vertical
        </button>

        <div className="image-context-menu-divider" role="separator" />

        <button type="button" onClick={run(onDuplicateLayer)}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="8" y="8" width="13" height="13" rx="2" />
            <path d="M3 16V5a2 2 0 0 1 2-2h11" />
          </svg>
          Duplicate layer
        </button>
        <button type="button" onClick={run(onClearLayer)}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18" />
            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          </svg>
          Clear layer
        </button>
        {canDeleteLayer && (
          <button type="button" onClick={run(onDeleteLayer)}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18" />
              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <path d="M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14" />
              <path d="M10 11v6M14 11v6" />
            </svg>
            Delete layer
          </button>
        )}

        {hasFloatingSelection && (
          <>
            <div className="image-context-menu-divider" role="separator" />
            <button type="button" onClick={run(onSplitSelectionToLayer)}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
                <path d="M10 6.5h4M12 6.5V10" strokeDasharray="2 2" />
              </svg>
              Split into new layer
            </button>
            <button type="button" onClick={run(onApplySelection)}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              Apply selection
            </button>
            <button type="button" onClick={run(onDeleteSelection)}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
              Delete selection
            </button>
          </>
        )}
      </div>
    </div>
  )
}
