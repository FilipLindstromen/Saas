import { useEffect } from 'react'
import StyleGridPanel from './StyleGridPanel'
import './StylePickerOverlay.css'

export default function StylePickerOverlay({
  isOpen,
  onClose,
  styles,
  selectedId,
  onSelect,
  onAddCustomStyle,
  onDeleteCustomStyle,
  onUploadImageStyle,
  onDeleteImageStyle,
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

  const pick = (id) => {
    onSelect(id)
    onClose()
  }

  return (
    <>
      <button type="button" className="style-picker-backdrop" aria-label="Close style picker" onClick={onClose} />
      <div className="style-picker-overlay" role="dialog" aria-labelledby="style-picker-title">
        <div className="style-picker-header">
          <h2 id="style-picker-title">Choose style</h2>
          <button type="button" className="style-picker-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="style-picker-body">
          <StyleGridPanel
            styles={styles}
            selectedId={selectedId}
            onSelect={pick}
            onAddCustomStyle={onAddCustomStyle}
            onDeleteCustomStyle={onDeleteCustomStyle}
            onUploadImageStyle={onUploadImageStyle}
            onDeleteImageStyle={onDeleteImageStyle}
            gridClassName="style-grid-overlay"
          />
        </div>
      </div>
    </>
  )
}
