import './ImageContextMenu.css'

/** Small floating menu shown at the cursor position on right-click over a generated image. */
export default function ImageContextMenu({ x, y, onCopy, onDownload, onClose }) {
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
        <button type="button" onClick={onCopy}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          Copy Image
        </button>
        <button type="button" onClick={onDownload}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v12" />
            <path d="M7 10l5 5 5-5" />
            <path d="M4 21h16" />
          </svg>
          Download Image
        </button>
      </div>
    </div>
  )
}
