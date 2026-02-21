import { useState, useEffect } from 'react'
import {
  loadInfographicProjects,
  loadInfographicProjectData,
  getInfographicProjectTabs,
} from '../utils/infographicLoader'
import type { InfographicProjectData } from '../utils/infographicLoader'
import styles from './InfographicPicker.module.css'

interface InfographicPickerProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (projectId: string, tabId: string, projectName: string, tabName: string) => void
}

interface InfographicPickerProjectProps {
  project: { id: string; name: string }
  selectedProjectId: string | null
  selectedTabId: string | null
  onSelect: (projectId: string, tabId: string) => void
}

function InfographicPickerProject({
  project,
  selectedProjectId,
  selectedTabId,
  onSelect,
}: InfographicPickerProjectProps) {
  const tabs = getInfographicProjectTabs(project.id)
  const effectiveTabId =
    selectedTabId && tabs.some((t) => t.id === selectedTabId) ? selectedTabId : tabs[0]?.id
  const [data, setData] = useState<InfographicProjectData | null>(null)

  useEffect(() => {
    setData(loadInfographicProjectData(project.id, effectiveTabId))
  }, [project.id, effectiveTabId])

  const elementCount = data?.elements?.length ?? 0
  const hasTimeline =
    elementCount > 0 && data?.elements?.some((e) => e.clipStart != null || e.clipEnd != null)
  const isSelected = selectedProjectId === project.id && selectedTabId === effectiveTabId

  return (
    <div className={styles.project}>
      <div className={styles.projectHeader}>
        <span className={styles.projectName}>{project.name || 'Untitled'}</span>
        {tabs.length > 1 && (
          <select
            className={styles.tabSelect}
            value={effectiveTabId || ''}
            onChange={(e) => onSelect(project.id, e.target.value)}
            onClick={(e) => e.stopPropagation()}
          >
            {tabs.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}
      </div>
      <button
        type="button"
        className={`${styles.item} ${isSelected ? styles.itemSelected : ''}`}
        onClick={() => onSelect(project.id, effectiveTabId || '')}
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
          <span className={styles.itemMeta}>
            {tabs.length > 1 ? `${tabs.find((t) => t.id === effectiveTabId)?.name || 'Document'} • ` : ''}
            {elementCount} element{elementCount !== 1 ? 's' : ''}
            {hasTimeline && ' • Animated'}
          </span>
        </div>
      </button>
    </div>
  )
}

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
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [selectedTabId, setSelectedTabId] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setProjects(loadInfographicProjects())
      setSelectedProjectId(null)
      setSelectedTabId(null)
    }
  }, [isOpen])

  const handleSelect = (projectId: string, tabId: string) => {
    setSelectedProjectId(projectId)
    setSelectedTabId(tabId)
  }

  const handleConfirm = () => {
    if (selectedProjectId && selectedTabId) {
      const project = projects.find((p) => p.id === selectedProjectId)
      const tabs = getInfographicProjectTabs(selectedProjectId)
      const tab = tabs.find((t) => t.id === selectedTabId)
      const projectName = project?.name || 'Untitled'
      const tabName = tabs.length > 1 ? (tab?.name || 'Document') : projectName
      onSelect(selectedProjectId, selectedTabId, projectName, tabName)
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
            Select an infographic from the InfoGraphics generator. It will appear as a timeline
            overlay and play its animations when active.
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
                <InfographicPickerProject
                  key={p.id}
                  project={p}
                  selectedProjectId={selectedProjectId}
                  selectedTabId={selectedTabId}
                  onSelect={handleSelect}
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
            disabled={!selectedProjectId || !selectedTabId}
          >
            Add to timeline
          </button>
        </div>
      </div>
    </div>
  )
}
