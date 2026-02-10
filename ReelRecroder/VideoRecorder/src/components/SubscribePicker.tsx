import { IconX } from './Icons'
import { SUBSCRIBE_BUTTON_DATA_URL, SUBSCRIBE_BUTTON_WIDTH, SUBSCRIBE_BUTTON_HEIGHT } from '../services/subscribeButton'
import styles from './SubscribePicker.module.css'

interface SubscribePickerProps {
  isOpen: boolean
  onClose: () => void
  onAddStatic: (imageDataUrl: string, width: number, height: number) => void
  onOpenAnimated: () => void
}

export function SubscribePicker({ isOpen, onClose, onAddStatic, onOpenAnimated }: SubscribePickerProps) {
  if (!isOpen) return null

  const handleStatic = () => {
    onAddStatic(SUBSCRIBE_BUTTON_DATA_URL, SUBSCRIBE_BUTTON_WIDTH, SUBSCRIBE_BUTTON_HEIGHT)
    onClose()
  }

  const handleAnimated = () => {
    onClose()
    onOpenAnimated()
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Add YouTube subscribe button">
      <div className={styles.panel}>
        <div className={styles.header}>
          <h3 className={styles.title}>YouTube subscribe button</h3>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <IconX />
          </button>
        </div>
        <p className={styles.hint}>
          Add a subscribe button overlay. Choose static (built-in) or search for an animated one on GIPHY.
        </p>
        <div className={styles.actions}>
          <button
            type="button"
            className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
            onClick={handleStatic}
            aria-label="Add static subscribe button"
          >
            <img src={SUBSCRIBE_BUTTON_DATA_URL} alt="" className={styles.previewImg} aria-hidden />
            <span>Static button</span>
          </button>
          <button
            type="button"
            className={styles.actionBtn}
            onClick={handleAnimated}
            aria-label="Search animated subscribe button on GIPHY"
          >
            <span>Animated (search GIPHY)</span>
          </button>
        </div>
      </div>
    </div>
  )
}
