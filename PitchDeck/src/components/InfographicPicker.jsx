import { useState, useEffect } from 'react'
import { loadInfographicProjects, loadInfographicProjectData } from '../utils/infographicLoader'
import InfographicBackground from './InfographicBackground'
import './InfographicPicker.css'

function InfographicPicker({ isOpen, onClose, onSelect, currentProjectId }) {
  const [projects, setProjects] = useState([])
  const [selectedId, setSelectedId] = useState(null)

  useEffect(() => {
    if (isOpen) {
      setProjects(loadInfographicProjects())
      setSelectedId(currentProjectId || null)
    }
  }, [isOpen, currentProjectId])

  const handleSelect = (projectId) => {
    setSelectedId(projectId)
  }

  const handleConfirm = () => {
    if (selectedId) {
      onSelect(selectedId)
      onClose()
    }
  }

  const handleRemove = () => {
    onSelect(null)
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
                Create infographics in the <a href="https://filiplindstromen.github.io/InfoGraphics/" target="_blank" rel="noopener noreferrer">InfoGraphics generator</a> first.
              </p>
            </div>
          ) : (
            <div className="infographic-picker-list">
              {projects.map(p => (
                <InfographicPickerItem
                  key={p.id}
                  project={p}
                  isSelected={selectedId === p.id}
                  onSelect={() => handleSelect(p.id)}
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
              disabled={!selectedId}
            >
              Use as background
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function InfographicPickerItem({ project, isSelected, onSelect }) {
  const [data, setData] = useState(null)

  useEffect(() => {
    setData(loadInfographicProjectData(project.id))
  }, [project.id])

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
        <span className="infographic-picker-item-name">{project.name || 'Untitled'}</span>
        <span className="infographic-picker-item-meta">
          {elementCount} element{elementCount !== 1 ? 's' : ''}
          {hasTimeline && ' • Animated'}
        </span>
      </div>
    </button>
  )
}

export default InfographicPicker
