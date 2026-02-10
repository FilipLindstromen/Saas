import { useState } from 'react'
import { IconX } from './Icons'
import { STICKERS, fetchStickerAsDataUrl } from '../services/stickers'
import styles from './StickerPicker.module.css'

interface StickerPickerProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (imageDataUrl: string, naturalWidth: number, naturalHeight: number) => void
}

export function StickerPicker({ isOpen, onClose, onSelect }: StickerPickerProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handlePick = async (url: string, id: string) => {
    setError(null)
    setLoadingId(id)
    try {
      const dataUrl = await fetchStickerAsDataUrl(url)
      const img = new Image()
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('Failed to load image'))
        img.src = dataUrl
      })
      onSelect(dataUrl, img.naturalWidth, img.naturalHeight)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load sticker')
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Pick a sticker">
      <div className={styles.panel}>
        <div className={styles.header}>
          <h3 className={styles.title}>Add sticker</h3>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <IconX />
          </button>
        </div>
        {error && <p className={styles.error}>{error}</p>}
        <div className={styles.grid}>
          {STICKERS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={styles.stickerBtn}
              onClick={() => handlePick(s.url, s.id)}
              disabled={loadingId != null}
              title={s.name}
              aria-label={s.name}
            >
              {loadingId === s.id ? (
                <span className={styles.loading}>…</span>
              ) : (
                <img src={s.url} alt="" className={styles.stickerImg} loading="lazy" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
