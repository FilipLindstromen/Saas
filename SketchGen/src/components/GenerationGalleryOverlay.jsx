import { useEffect } from 'react'
import './GenerationGalleryOverlay.css'

function formatWhen(createdAt) {
  if (!createdAt) return ''
  try {
    return new Date(createdAt).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

export default function GenerationGalleryOverlay({
  isOpen,
  onClose,
  items,
  activeId,
  onSelect,
  onDelete,
}) {
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <>
      <button type="button" className="generation-gallery-backdrop" aria-label="Close gallery" onClick={onClose} />
      <div className="generation-gallery-overlay" role="dialog" aria-labelledby="generation-gallery-title">
        <div className="generation-gallery-header">
          <h2 id="generation-gallery-title">Generated images</h2>
          <span className="generation-gallery-count">{items.length}</span>
          <button type="button" className="generation-gallery-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="generation-gallery-body">
          {!items.length ? (
            <p className="generation-gallery-empty">No generated images yet. Create one from the sketch view.</p>
          ) : (
            <div className="generation-gallery-grid">
              {items.map((item) => (
                <div
                  key={item.id}
                  className={`generation-gallery-item${item.id === activeId ? ' active' : ''}`}
                >
                  <button
                    type="button"
                    className="generation-gallery-thumb-btn"
                    onClick={() => onSelect(item)}
                    title={item.styleName || 'Generated image'}
                  >
                    <img src={item.dataUrl} alt="" />
                    <span className="generation-gallery-meta">
                      <span className="generation-gallery-style">{item.styleName || 'Generation'}</span>
                      <span className="generation-gallery-date">{formatWhen(item.createdAt)}</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="generation-gallery-delete"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete(item.id)
                    }}
                    aria-label="Delete image"
                    title="Delete from library"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
