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

  const handleSelectProject = (projectId) => {
    setSelectedProjectId(projectId)
    if (projectId) {
      const tabs = getInfographicProjectTabs(projectId)
      setSelectedTabId(tabs.length > 0 ? tabs[0].id : null)
    } else {
      setSelectedTabId(null)
    }
  }

  const handleSelectTab = (tabId) => {
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

  const tabs = selectedProjectId ? getInfographicProjectTabs(selectedProjectId) : []

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
            <>
              <div className="infographic-picker-project-select">
                <label htmlFor="infographic-picker-project">Project:</label>
                <select
                  id="infographic-picker-project"
                  className="infographic-picker-project-dropdown"
                  value={selectedProjectId || ''}
                  onChange={(e) => handleSelectProject(e.target.value || null)}
                >
                  <option value="">Select a project...</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name || 'Untitled'}</option>
                  ))}
                </select>
              </div>
              {selectedProjectId && (
                <div className="infographic-picker-tabs-section">
                  <p className="infographic-picker-tabs-label">Select tab:</p>
                  <div className="infographic-picker-list">
                    {tabs.map(tab => (
                      <InfographicPickerTab
                        key={tab.id}
                        projectId={selectedProjectId}
                        tab={tab}
                        isSelected={selectedTabId === tab.id}
                        onSelect={() => handleSelectTab(tab.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
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

function InfographicPickerTab({ projectId, tab, isSelected, onSelect }) {
  const [data, setData] = useState(null)

  useEffect(() => {
    setData(loadInfographicProjectData(projectId, tab.id))
  }, [projectId, tab.id])

  const elementCount = data?.elements?.length ?? 0
  const hasTimeline = elementCount > 0 && data?.elements?.some(e => (e.clipStart != null || e.clipEnd != null))

  return (
    <button
      type="button"
      className={`infographic-picker-item ${isSelected ? 'selected' : ''}`}
      onClick={onSelect}
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
        <span className="infographic-picker-item-name">{tab.name || 'Document'}</span>
        <span className="infographic-picker-item-meta">
          {elementCount} element{elementCount !== 1 ? 's' : ''}
          {hasTimeline && ' • Animated'}
        </span>
      </div>
    </button>
  )
}

export default InfographicPicker
