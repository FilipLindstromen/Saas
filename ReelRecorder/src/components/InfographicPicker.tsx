import { useState, useEffect } from 'react'
import { loadInfographicProjects, loadInfographicProjectData } from '../utils/infographicLoader'
import type { InfographicProjectData } from '../utils/infographicLoader'
import styles from './InfographicPicker.module.css'

interface InfographicPickerProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (projectId: string, projectName: string) => void
}

interface InfographicPickerItemProps {
  project: { id: string; name: string }
  isSelected: boolean
  onSelect: () => void
}

function InfographicPickerItem({ project, isSelected, onSelect }: InfographicPickerItemProps) {
  const [data, setData] = useState<InfographicProjectData | null>(null)

  useEffect(() => {
    setData(loadInfographicProjectData(project.id))
  }, [project.id])

  const elementCount = data?.elements?.length ?? 0
  const hasTimeline =
    elementCount > 0 && data?.elements?.some((e) => e.clipStart != null || e.clipEnd != null)

  return (
    <button
      type="button"
      className={`${styles.item} ${isSelected ? styles.itemSelected : ''}`}
      onClick={onSelect}
    >
      <div className={styles.itemPreview}>
        {data?.elements?.length ? (
          <SimpleThumb data={data} />
        ) : (
          <div className={styles.placeholder}>
            <span>Empty</span>
          </div>
        )}
      </div>
      <div className={styles.itemInfo}>
        <span className={styles.itemName}>{project.name || 'Untitled'}</span>
        <span className={styles.itemMeta}>
          {elementCount} element{elementCount !== 1 ? 's' : ''}
          {hasTimeline && ' • Animated'}
        </span>
      </div>
    </button>
  )
}

/** Simple thumb: show a colored block with element count */
function SimpleThumb({ data }: { data: InfographicProjectData }) {
  const count = data?.elements?.length ?? 0
  return (
    <div className={styles.simpleThumb}>
      <span>{count} elements</span>
    </div>
  )
}

export function InfographicPicker({ isOpen, onClose, onSelect }: InfographicPickerProps) {
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setProjects(loadInfographicProjects())
      setSelectedId(null)
    }
  }, [isOpen])

  const handleConfirm = () => {
    if (selectedId) {
      const project = projects.find((p) => p.id === selectedId)
      onSelect(selectedId, project?.name || 'Untitled')
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>Import Infographic</h3>
          <p className={styles.hint}>
            Select an infographic from the InfoGraphics generator. It will appear as a timeline overlay
            and play its animations when active.
          </p>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className={styles.content}>
          {projects.length === 0 ? (
            <div className={styles.empty}>
              <p>No infographic projects found.</p>
              <p className={styles.emptyHint}>
                Create infographics in the{' '}
                <a
                  href="https://filiplindstromen.github.io/Saas/InfoGraphics/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  InfoGraphics generator
                </a>{' '}
                first.
              </p>
            </div>
          ) : (
            <div className={styles.list}>
              {projects.map((p) => (
                <InfographicPickerItem
                  key={p.id}
                  project={p}
                  isSelected={selectedId === p.id}
                  onSelect={() => setSelectedId(p.id)}
                />
              ))}
            </div>
          )}
        </div>
        <div className={styles.footer}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.confirmBtn}
            onClick={handleConfirm}
            disabled={!selectedId}
          >
            Add to timeline
          </button>
        </div>
      </div>
    </div>
  )
}
