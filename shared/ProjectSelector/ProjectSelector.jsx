import { useState, useRef, useEffect } from 'react'
import './ProjectSelector.css'

export default function ProjectSelector({
  projects = [],
  currentProjectId,
  currentProjectName,
  onSwitchProject,
  onCreateProject,
  onRenameProject,
  onDeleteProject
}) {
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const containerRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
        setEditingId(null)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [open])

  const handleRename = (id, name) => {
    const trimmed = (name || '').trim()
    if (trimmed && onRenameProject) {
      onRenameProject(id, trimmed)
    }
    setEditingId(null)
    setEditName('')
  }

  const handleDelete = (e, id) => {
    e.stopPropagation()
    if (onDeleteProject) onDeleteProject(id)
  }

  return (
    <div className="project-selector" ref={containerRef}>
      <button
        type="button"
        className="project-selector-trigger"
        onClick={() => setOpen(!open)}
        title="Projects"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <path d="M16 13H8M16 17H8M10 9H8" />
        </svg>
        <span className="project-selector-name">{currentProjectName || 'Untitled'}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={open ? 'open' : ''}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="project-selector-dropdown">
          <div className="project-selector-list">
            {projects.map((p) => (
              <div
                key={p.id}
                className={`project-selector-item ${p.id === currentProjectId ? 'active' : ''}`}
                onClick={() => {
                  if (p.id !== currentProjectId && onSwitchProject) onSwitchProject(p.id)
                  setOpen(false)
                }}
              >
                {editingId === p.id ? (
                  <input
                    type="text"
                    className="project-selector-edit"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRename(p.id, editName)
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    onBlur={() => handleRename(p.id, editName)}
                    onClick={(e) => e.stopPropagation()}
                    autoFocus
                  />
                ) : (
                  <>
                    <span className="project-selector-item-name">{p.name}</span>
                    <div className="project-selector-item-actions">
                      <button
                        type="button"
                        className="project-selector-action"
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingId(p.id)
                          setEditName(p.name)
                        }}
                        title="Rename"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className="project-selector-action project-selector-delete"
                        onClick={(e) => handleDelete(e, p.id)}
                        title="Delete"
                        disabled={projects.length <= 1}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          <line x1="10" y1="11" x2="10" y2="17" />
                          <line x1="14" y1="11" x2="14" y2="17" />
                        </svg>
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            className="project-selector-new"
            onClick={() => {
              if (onCreateProject) onCreateProject()
              setOpen(false)
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New project
          </button>
        </div>
      )}
    </div>
  )
}
