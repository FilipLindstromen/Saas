import { useState, useEffect, useRef } from 'react'
import {
  hasConnectedFolder,
  getConnectedLocalFolder,
  openProjectFolder,
  clearConnectedLocalFolder,
  listProjectsInConnectedFolder,
  loadProjectFromConnectedFolder,
  saveProjectToConnectedFolder,
  isLocalFolderSupported
} from '@shared/projectFolderStorage'
import './ProjectOverview.css'

const APP_NAME = 'PitchDeck'

/** Get the first background image URL from a project's chapters/slides (first slide with imageUrl). */
function getFirstSlideImageUrl(data) {
  if (!data?.chapters) return null
  for (const ch of data.chapters) {
    const slides = ch?.slides || []
    for (const slide of slides) {
      if (slide?.imageUrl && typeof slide.imageUrl === 'string' && slide.imageUrl.trim()) {
        return slide.imageUrl
      }
    }
  }
  return null
}

function ProjectOverview({
  onClose,
  recentFiles = [],
  getExportData,
  onLoadProject,
  onNewProject,
  projectName,
  googleClientId
}) {
  const [connectedProjects, setConnectedProjects] = useState([])
  const [folderName, setFolderName] = useState(null)
  const [selectedProject, setSelectedProject] = useState(null)
  const [loading, setLoading] = useState('')
  const [error, setError] = useState('')
  const [showNewProjectOverlay, setShowNewProjectOverlay] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [thumbnails, setThumbnails] = useState({})
  const thumbnailUrlsRef = useRef(new Set())

  // Load projects from connected folder (SaaS settings)
  useEffect(() => {
    let cancelled = false
    hasConnectedFolder()
      .then((has) => {
        if (cancelled || !has) return
        return getConnectedLocalFolder()
      })
      .then((folder) => {
        if (cancelled) return
        if (folder) {
          setFolderName(folder.name)
          return listProjectsInConnectedFolder(APP_NAME)
        }
        setFolderName(null)
        return []
      })
      .then((list) => {
        if (cancelled) return
        setConnectedProjects(Array.isArray(list) ? list : [])
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  // Load thumbnails for projects
  useEffect(() => {
    if (connectedProjects.length === 0) {
      setThumbnails({})
      return
    }
    let cancelled = false
    thumbnailUrlsRef.current = new Set()
    connectedProjects.forEach((p) => {
      if (cancelled) return
      loadProjectFromConnectedFolder(APP_NAME, p.name)
        .then((result) => {
          if (cancelled) return
          const url = result ? getFirstSlideImageUrl(result.data) : null
          if (url?.startsWith('blob:')) thumbnailUrlsRef.current.add(url)
          setThumbnails((prev) => ({ ...prev, [p.name]: url || null }))
        })
        .catch(() => {
          if (!cancelled) setThumbnails((prev) => ({ ...prev, [p.name]: null }))
        })
    })
    return () => {
      cancelled = true
      thumbnailUrlsRef.current.forEach((u) => URL.revokeObjectURL(u))
      thumbnailUrlsRef.current = new Set()
    }
  }, [connectedProjects])

  const hasFolder = folderName != null
  const allProjects = [
    ...(folderName == null && recentFiles?.length
      ? recentFiles.map((f) => ({
          type: 'recent',
          id: `recent-${f.path}`,
          name: f.name || f.path,
          data: f.data,
          modifiedTime: f.lastOpened
        }))
      : []),
    ...connectedProjects.map((p) => ({
      type: 'connected',
      id: `connected-${p.name}`,
      name: p.name,
      modifiedTime: p.modifiedTime || 0
    }))
  ]

  const handleOpenProjectFolder = async () => {
    setError('')
    setLoading('Opening folder…')
    try {
      const { name } = await openProjectFolder()
      setFolderName(name)
      const list = await listProjectsInConnectedFolder(APP_NAME)
      setConnectedProjects(list)
    } catch (e) {
      setError(e?.message || 'Failed to open folder')
    } finally {
      setLoading('')
    }
  }

  const handleDisconnectFolder = async () => {
    setError('')
    try {
      await clearConnectedLocalFolder()
      setFolderName(null)
      setConnectedProjects([])
      setSelectedProject((p) => (p?.type === 'connected' ? null : p))
    } catch (e) {
      setError(e?.message || 'Failed to disconnect folder')
    }
  }

  const handleSaveToFolder = async () => {
    setError('')
    if (!getExportData) return
    setLoading('Saving…')
    try {
      const projName = (projectName || '').trim() || 'Untitled Project'
      const result = await saveProjectToConnectedFolder(APP_NAME, projName, getExportData)
      if (result) {
        const list = await listProjectsInConnectedFolder(APP_NAME)
        setConnectedProjects(list)
      }
    } catch (e) {
      setError(e?.message || 'Failed to save')
    } finally {
      setLoading('')
    }
  }

  const handleOpen = async () => {
    if (!selectedProject) return
    setError('')
    setLoading('Opening…')
    try {
      if (selectedProject.type === 'recent' && selectedProject.data) {
        onLoadProject(selectedProject.data)
        onClose()
        return
      }
      if (selectedProject.type === 'connected' && selectedProject.name) {
        const result = await loadProjectFromConnectedFolder(APP_NAME, selectedProject.name)
        if (result?.data) {
          onLoadProject(result.data)
          onClose()
        } else {
          setError('Project not found')
        }
      }
    } catch (e) {
      setError(e?.message || 'Failed to open project')
    } finally {
      setLoading('')
    }
  }

  const handleNewClick = () => {
    setNewProjectName('')
    setShowNewProjectOverlay(true)
  }

  const handleNewProjectCreate = () => {
    const name = newProjectName.trim() || 'Untitled Project'
    onNewProject(name)
    setShowNewProjectOverlay(false)
    onClose()
  }

  const handleNewProjectCancel = () => {
    setShowNewProjectOverlay(false)
    setNewProjectName('')
  }

  const localSupported = isLocalFolderSupported()

  return (
    <div className="project-overview-backdrop" onClick={onClose}>
      <div className="project-overview-modal" onClick={(e) => e.stopPropagation()}>
        <div className="project-overview-header">
          <h2 className="project-overview-title">Projects</h2>
          <button type="button" className="project-overview-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {error && (
          <div className="project-overview-error">
            {error}
          </div>
        )}
        {loading && (
          <div className="project-overview-loading">
            {loading}
          </div>
        )}

        <div className="project-overview-grid">
          {allProjects.length === 0 && !loading && (
            <div className="project-overview-empty">
              <p>No projects yet.</p>
              <p className="project-overview-empty-hint">
                Use <strong>Open project folder</strong> to connect the folder from SaaS Apps settings, or create a <strong>New Project</strong>.
                Projects save to <code>PitchDeck/[project name]/project.json</code>.
              </p>
            </div>
          )}
          {allProjects.map((proj) => (
            <button
              key={proj.id}
              type="button"
              className={`project-overview-card ${selectedProject?.id === proj.id ? 'selected' : ''}`}
              onClick={() => setSelectedProject(proj)}
            >
              <div className="project-overview-card-thumb">
                {(thumbnails[proj.name] ?? getFirstSlideImageUrl(proj.data)) ? (
                  <img src={thumbnails[proj.name] ?? getFirstSlideImageUrl(proj.data)} alt="" />
                ) : (
                  <div className="project-overview-card-placeholder" />
                )}
                {selectedProject?.id === proj.id && (
                  <span className="project-overview-card-check" aria-hidden>✓</span>
                )}
              </div>
              <span className="project-overview-card-name">{proj.name || 'Untitled Project'}</span>
              <span className="project-overview-card-badge">
                {proj.type === 'recent' && 'Recent'}
                {proj.type === 'connected' && 'Folder'}
              </span>
            </button>
          ))}
        </div>

        <div className="project-overview-actions">
          <div className="project-overview-actions-left">
            {localSupported && (
              <>
                {folderName !== null ? (
                  <>
                    <span className="project-overview-folder-label" title="Connected folder from SaaS settings">
                      Folder: {folderName || 'Unnamed'}
                    </span>
                    <button type="button" className="btn-project-overview secondary" onClick={handleSaveToFolder} disabled={!!loading}>
                      Save
                    </button>
                    <button type="button" className="btn-project-overview secondary" onClick={handleDisconnectFolder} disabled={!!loading}>
                      Disconnect folder
                    </button>
                  </>
                ) : (
                  <button type="button" className="btn-project-overview secondary" onClick={handleOpenProjectFolder} disabled={!!loading}>
                    Open project folder
                  </button>
                )}
              </>
            )}
          </div>
          <div className="project-overview-actions-right">
            <button type="button" className="btn-project-overview primary" onClick={handleNewClick}>
              New Project
            </button>
            <button
              type="button"
              className="btn-project-overview primary"
              onClick={handleOpen}
              disabled={!selectedProject || !!loading}
            >
              Open
            </button>
          </div>
        </div>

        {showNewProjectOverlay && (
          <div className="project-overview-new-overlay" onClick={handleNewProjectCancel}>
            <div className="project-overview-new-modal" onClick={(e) => e.stopPropagation()}>
              <h3 className="project-overview-new-title">New project</h3>
              <label htmlFor="new-project-name" className="project-overview-new-label">Project name</label>
              <input
                id="new-project-name"
                type="text"
                className="project-overview-new-input"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleNewProjectCreate()
                  if (e.key === 'Escape') handleNewProjectCancel()
                }}
                placeholder="e.g. Q4 Pitch"
                autoFocus
              />
              <div className="project-overview-new-actions">
                <button type="button" className="btn-project-overview secondary" onClick={handleNewProjectCancel}>
                  Cancel
                </button>
                <button type="button" className="btn-project-overview primary" onClick={handleNewProjectCreate}>
                  Create
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ProjectOverview
