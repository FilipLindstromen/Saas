import { useState } from 'react'
import type { LibraryClip } from '../types'
import styles from './ClipLibraryPanel.module.css'

interface ClipLibraryPanelProps {
  clips: LibraryClip[]
  onAddToTimeline: (clip: LibraryClip) => void
  onRemove: (libraryId: string) => void
}

export function ClipLibraryPanel({ clips, onAddToTimeline, onRemove }: ClipLibraryPanelProps) {
  const [open, setOpen] = useState(true)

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <span className={styles.title}>Clip library</span>
        <button
          type="button"
          className={styles.toggleBtn}
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          {open ? 'Collapse' : 'Expand'}
        </button>
      </div>
      {open && (
        <div className={styles.list}>
          {clips.length === 0 ? (
            <p className={styles.empty}>No clips saved. Select an overlay and use &quot;Save to library&quot; in the Inspector.</p>
          ) : (
            clips.map((clip) => (
              <div key={clip.libraryId} className={styles.item}>
                {clip.payload.type === 'image' && (clip.payload.imageDataUrl || clip.payload.imageUrl) ? (
                  <img
                    src={clip.payload.imageDataUrl ?? clip.payload.imageUrl ?? ''}
                    alt=""
                    className={styles.thumb}
                  />
                ) : clip.payload.type === 'video' && clip.payload.videoUrl ? (
                  <div className={styles.thumbPlaceholder} title="Video">▶</div>
                ) : clip.payload.type === 'infographic' && clip.payload.infographicProjectId ? (
                  <div className={styles.thumbPlaceholder} title="Infographic">📊</div>
                ) : (
                  <div className={styles.thumbPlaceholder} title="Text">T</div>
                )}
                <span className={styles.label} title={clip.name}>{clip.name}</span>
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.addBtn}
                    onClick={() => onAddToTimeline(clip)}
                    title="Add to timeline at playhead"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    className={styles.removeBtn}
                    onClick={() => onRemove(clip.libraryId)}
                    title="Remove from library"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
