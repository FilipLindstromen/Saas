import { useEffect, useState } from 'react'
import { copyImageToClipboard } from '../utils/clipboard'
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
  const [copiedId, setCopiedId] = useState(null)
  const [copyError, setCopyError] = useState('')

  useEffect(() => {
    if (!copiedId) return
    const t = setTimeout(() => setCopiedId(null), 2000)
    return () => clearTimeout(t)
  }, [copiedId])

  useEffect(() => {
    if (!isOpen) {
      setCopiedId(null)
      setCopyError('')
      return
    }
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

  const handleCopy = async (item, e) => {
    e.stopPropagation()
    setCopyError('')
    try {
      await copyImageToClipboard(item.dataUrl)
      setCopiedId(item.id)
    } catch (err) {
      setCopyError(err?.message || 'Could not copy to clipboard.')
    }
  }

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
          {copyError ? <p className="generation-gallery-copy-error">{copyError}</p> : null}
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
                    className="generation-gallery-copy"
                    onClick={(e) => { void handleCopy(item, e) }}
                    aria-label="Copy full-size image to clipboard"
                    title="Copy full-size PNG to clipboard"
                  >
                    {copiedId === item.id ? (
                      'Copied'
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                        <rect x="9" y="9" width="13" height="13" rx="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                    )}
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
