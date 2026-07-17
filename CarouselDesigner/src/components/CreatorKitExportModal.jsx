import { useEffect } from 'react'
import CaptionStudio from './CaptionStudio'
import './CreatorKitExportModal.css'

export default function CreatorKitExportModal({
  isOpen,
  onClose,
  onExport,
  slides,
  instructions,
  caption,
  hashtags,
  firstComment,
  onCaptionUpdate,
  busy = false,
  exportProgress = '',
}) {
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, busy, onClose])

  if (!isOpen) return null

  const slideCount = slides.filter((s) => (s.layout || 'default') !== 'section').length

  return (
    <div className="creator-kit-backdrop" onClick={() => !busy && onClose()} role="presentation">
      <div className="creator-kit-modal" onClick={(e) => e.stopPropagation()} role="dialog">
        <header className="creator-kit-header">
          <h2>Creator kit export</h2>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close">×</button>
        </header>

        <p className="creator-kit-desc">
          Download {slideCount} carousel images plus caption, hashtags, alt text, and platform posting guides for Instagram, LinkedIn, and TikTok.
        </p>

        <CaptionStudio
          slides={slides}
          instructions={instructions}
          caption={caption}
          hashtags={hashtags}
          firstComment={firstComment}
          onUpdate={(patch) => onCaptionUpdate?.({ caption, hashtags, firstComment, ...patch })}
          compact
        />

        <div className="creator-kit-footer">
          {exportProgress && <p className="creator-kit-progress">{exportProgress}</p>}
          <button type="button" className="creator-kit-export-btn" onClick={onExport} disabled={busy || slideCount === 0}>
            {busy ? 'Exporting…' : 'Download creator kit (ZIP)'}
          </button>
        </div>
      </div>
    </div>
  )
}
