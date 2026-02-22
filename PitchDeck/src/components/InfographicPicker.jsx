import { useState, useEffect } from 'react'
import { loadInfographicProjects, loadInfographicProjectData, getInfographicProjectTabs } from '../utils/infographicLoader'
import InfographicBackground from './InfographicBackground'
import './InfographicPicker.css'

function InfographicPicker({ isOpen, onClose, onSelect, currentProjectId, currentTabId }) {
  const [projects, setProjects] = useState([])
  const [selectedProjectId, setSelectedProjectId] = useState(null)
  const [selectedTabId, setSelectedTabId] = useState(null)

  useEffect(() => {
    if (isOpen) {
      setProjects(loadInfographicProjects())
      setSelectedProjectId(currentProjectId || null)
      setSelectedTabId(currentTabId || null)
      if (currentProjectId && !currentTabId) {
        const tabs = getInfographicProjectTabs(currentProjectId)
        if (tabs.length > 0) setSelectedTabId(tabs[0].id)
      }
    }
  }, [isOpen, currentProjectId, currentTabId])

  const handleSelect = (projectId, tabId) => {
    setSelectedProjectId(projectId)
    setSelectedTabId(tabId)
  }

  const handleConfirm = () => {
    if (selectedProjectId) {
      onSelect(selectedProjectId, selectedTabId)
      onClose()
    }
  }

  const handleRemove = () => {
    onSelect(null, null)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="infographic-picker-overlay" onClick={onClose}>
      <div className="infographic-picker-modal" onClick={e => e.stopPropagation()}>
        <div className="infographic-picker-header">
          <h3>Use Infographic as Background</h3>
          <p className="infographic-picker-hint">
            Select an infographic from the InfoGraphics generator. Timeline animations will play during presentation.
          </p>
          <button type="button" className="infographic-picker-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="infographic-picker-content">
          {projects.length === 0 ? (
            <div className="infographic-picker-empty">
              <p>No infographic projects found.</p>
              <p className="infographic-picker-empty-hint">
                Create infographics in the <a href="https://filiplindstromen.github.io/Saas/InfoGraphics/" target="_blank" rel="noopener noreferrer">InfoGraphics generator</a> first.
              </p>
            </div>
          ) : (
            <div className="infographic-picker-list">
              {projects.map(p => (
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
        <div className="infographic-picker-footer">
          <button
            type="button"
            className="infographic-picker-btn infographic-picker-btn-remove"
            onClick={handleRemove}
          >
            Remove infographic
          </button>
          <div className="infographic-picker-footer-right">
            <button type="button" className="infographic-picker-btn infographic-picker-btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="infographic-picker-btn infographic-picker-btn-confirm"
              onClick={handleConfirm}
              disabled={!selectedProjectId}
            >
              Use as background
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function InfographicPickerProject({ project, selectedProjectId, selectedTabId, onSelect }) {
  const tabs = getInfographicProjectTabs(project.id)
  const effectiveTabId = selectedTabId && tabs.some(t => t.id === selectedTabId) ? selectedTabId : tabs[0]?.id
  const [data, setData] = useState(null)

  useEffect(() => {
    setData(loadInfographicProjectData(project.id, effectiveTabId))
  }, [project.id, effectiveTabId])

  const elementCount = data?.elements?.length ?? 0
  const hasTimeline = elementCount > 0 && data?.elements?.some(e => (e.clipStart != null || e.clipEnd != null))
  const isSelected = selectedProjectId === project.id && selectedTabId === effectiveTabId

  return (
    <div className="infographic-picker-project">
      <div className="infographic-picker-project-header">
        <span className="infographic-picker-project-name">{project.name || 'Untitled'}</span>
        {tabs.length > 1 && (
          <select
            className="infographic-picker-tab-select"
            value={effectiveTabId || ''}
            onChange={(e) => onSelect(project.id, e.target.value)}
            onClick={(e) => e.stopPropagation()}
          >
            {tabs.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        )}
      </div>
      <button
        type="button"
        className={`infographic-picker-item ${isSelected ? 'selected' : ''}`}
        onClick={() => onSelect(project.id, effectiveTabId)}
      >
        <div className="infographic-picker-item-preview">
          {data && data.elements?.length > 0 ? (
            <InfographicBackground
              projectData={data}
              isPlaying={false}
              showAllElements={true}
              opacity={1}
              className="infographic-picker-preview-bg"
            />
          ) : (
            <div className="infographic-picker-item-placeholder">
              <span>Empty</span>
            </div>
          )}
        </div>
        <div className="infographic-picker-item-info">
          <span className="infographic-picker-item-meta">
            {tabs.length > 1 ? `${tabs.find(t => t.id === effectiveTabId)?.name || 'Document'} • ` : ''}
            {elementCount} element{elementCount !== 1 ? 's' : ''}
            {hasTimeline && ' • Animated'}
          </span>
        </div>
      </button>
    </div>
  )
}

export default InfographicPicker
