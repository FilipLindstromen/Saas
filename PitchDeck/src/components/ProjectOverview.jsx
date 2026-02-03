import { useState, useEffect, useRef } from 'react'
import {
  isLocalFolderSupported,
  openProjectFolder,
  getProjectFolder,
  clearProjectFolder,
  listFromProjectFolder,
  saveToProjectFolder,
  renameProjectInFolder,
  deleteFileFromProjectFolder,
  readFromFileHandle,
  resolveProjectImageUrls,
  connectGoogleDrive,
  listDriveProjects,
  saveToDrive,
  readFromDrive
} from '../services/projectStorage'
import './ProjectOverview.css'

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
  const [localProjects, setLocalProjects] = useState([])
  const [localFolderName, setLocalFolderName] = useState(null) // display name of open project folder, or null
  const [driveProjects, setDriveProjects] = useState([])
  const [driveToken, setDriveToken] = useState(null)
  const [selectedProject, setSelectedProject] = useState(null)
  const [loading, setLoading] = useState('')
  const [error, setError] = useState('')
  const [showNewProjectOverlay, setShowNewProjectOverlay] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [showRenameProjectOverlay, setShowRenameProjectOverlay] = useState(false)
  const [renameProjectValue, setRenameProjectValue] = useState('')
  const [thumbnails, setThumbnails] = useState({}) // project id -> thumbnail URL (object URL or data URL)
  const thumbnailUrlsRef = useRef(new Set()) // track object URLs we created so we can revoke on cleanup

  // Restore project folder on mount and list its files
  useEffect(() => {
    if (!isLocalFolderSupported()) return
    let cancelled = false
    getProjectFolder()
      .then((folder) => {
        if (cancelled || !folder) return
        setLocalFolderName(folder.name)
        return listFromProjectFolder()
      })
      .then((list) => {
        if (cancelled) return
        if (Array.isArray(list)) setLocalProjects(list)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  // Load thumbnails (first background image) for local and drive projects
  useEffect(() => {
    const localList = localFolderName != null ? localProjects : []
    const driveList = driveToken != null ? driveProjects : []
    if (localList.length === 0 && driveList.length === 0) {
      setThumbnails({})
      return
    }
    let cancelled = false
    thumbnailUrlsRef.current = new Set()

    const loadLocalThumbnails = async () => {
      const folder = await getProjectFolder()
      if (!folder?.handle || cancelled) return
      for (const p of localList) {
        if (cancelled) break
        try {
          const data = await readFromFileHandle(p.handle)
          const resolved = await resolveProjectImageUrls(data, folder.handle)
          const url = getFirstSlideImageUrl(resolved)
          if (cancelled) {
            if (url?.startsWith('blob:')) URL.revokeObjectURL(url)
            break
          }
          if (url?.startsWith('blob:')) thumbnailUrlsRef.current.add(url)
          setThumbnails((prev) => ({ ...prev, [`local-${p.name}`]: url || null }))
        } catch (_) {
          if (!cancelled) setThumbnails((prev) => ({ ...prev, [`local-${p.name}`]: null }))
        }
      }
    }

    const loadDriveThumbnails = async () => {
      if (!driveToken || cancelled) return
      for (const p of driveList) {
        if (cancelled) break
        try {
          const data = await readFromDrive(driveToken, p.id)
          const url = getFirstSlideImageUrl(data)
          if (cancelled) break
          setThumbnails((prev) => ({ ...prev, [`drive-${p.id}`]: url || null }))
        } catch (_) {
          if (!cancelled) setThumbnails((prev) => ({ ...prev, [`drive-${p.id}`]: null }))
        }
      }
    }

    loadLocalThumbnails().then(() => loadDriveThumbnails())

    return () => {
      cancelled = true
      thumbnailUrlsRef.current.forEach((u) => URL.revokeObjectURL(u))
      thumbnailUrlsRef.current = new Set()
      setThumbnails({})
    }
  }, [localFolderName, localProjects, driveToken, driveProjects])

  const hasFolderOrDrive = localFolderName != null || driveToken != null
  const recentOnlyWhenNoFolder = localFolderName == null && driveToken != null
  const allProjects = !hasFolderOrDrive
    ? []
    : [
        ...(recentOnlyWhenNoFolder
          ? recentFiles.map((f) => ({
              type: 'recent',
              id: `recent-${f.path}`,
              name: f.name || f.path,
              data: f.data,
              modifiedTime: f.lastOpened
            }))
          : []),
        ...localProjects.map((p) => ({ type: 'local', id: `local-${p.name}`, name: p.name, handle: p.handle })),
        ...driveProjects.map((p) => ({
          type: 'drive',
          id: `drive-${p.id}`,
          driveId: p.id,
          name: p.name,
          modifiedTime: p.modifiedTime
        }))
      ]

  const handleOpenProjectFolder = async () => {
    setError('')
    setLoading('Opening folder…')
    try {
      const { handle, name } = await openProjectFolder()
      setLocalFolderName(name)
      const list = await listFromProjectFolder()
      setLocalProjects(list)
    } catch (e) {
      setError(e?.message || 'Failed to open folder')
    } finally {
      setLoading('')
    }
  }

  const handleDisconnectFolder = async () => {
    setError('')
    try {
      await clearProjectFolder()
      setLocalFolderName(null)
      setLocalProjects([])
      setShowRenameProjectOverlay(false)
      setSelectedProject((p) => (p?.type === 'local' ? null : p))
    } catch (e) {
      setError(e?.message || 'Failed to disconnect folder')
    }
  }

  const handleRenameProjectClick = () => {
    if (!selectedProject?.name) return
    setRenameProjectValue(selectedProject.name)
    setShowRenameProjectOverlay(true)
  }

  const handleRenameProjectSave = async () => {
    if (!selectedProject || selectedProject.type !== 'local' || !selectedProject.handle) return
    setError('')
    setLoading('Renaming…')
    try {
      const { name } = await renameProjectInFolder(selectedProject.handle, renameProjectValue)
      const list = await listFromProjectFolder()
      setLocalProjects(list)
      const updated = list.find((p) => p.name === name)
      setSelectedProject(updated ? { type: 'local', id: `local-${name}`, name, handle: updated.handle } : null)
      setShowRenameProjectOverlay(false)
    } catch (e) {
      setError(e?.message || 'Failed to rename project')
    } finally {
      setLoading('')
    }
  }

  const handleRenameProjectCancel = () => {
    setShowRenameProjectOverlay(false)
    setRenameProjectValue('')
  }

  const handleDeleteProject = async () => {
    if (!selectedProject || selectedProject.type !== 'local' || !selectedProject.handle) return
    if (!window.confirm(`Delete project "${selectedProject.name}" from the folder? This cannot be undone.`)) return
    setError('')
    setLoading('Deleting…')
    try {
      await deleteFileFromProjectFolder(selectedProject.handle)
      const list = await listFromProjectFolder()
      setLocalProjects(list)
      setSelectedProject(null)
    } catch (e) {
      setError(e?.message || 'Failed to delete project')
    } finally {
      setLoading('')
    }
  }

  const handleConnectDrive = async () => {
    setError('')
    if (!googleClientId?.trim()) {
      setError('Add Google Client ID in Settings (API Keys) first.')
      return
    }
    setLoading('Connecting to Google Drive…')
    try {
      const token = await connectGoogleDrive(googleClientId.trim())
      setDriveToken(token)
      const list = await listDriveProjects(token)
      setDriveProjects(list)
    } catch (e) {
      setError(e?.message || 'Google Drive connection failed')
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
      if (selectedProject.type === 'local' && selectedProject.handle) {
        const data = await readFromFileHandle(selectedProject.handle)
        const folder = await getProjectFolder()
        const resolvedData = folder?.handle
          ? await resolveProjectImageUrls(data, folder.handle)
          : data
        onLoadProject(resolvedData)
        onClose()
        return
      }
      if (selectedProject.type === 'drive' && selectedProject.driveId && driveToken) {
        const data = await readFromDrive(driveToken, selectedProject.driveId)
        onLoadProject(data)
        onClose()
        return
      }
    } catch (e) {
      setError(e?.message || 'Failed to open project')
    } finally {
      setLoading('')
    }
  }

  const handleSaveToFolder = async () => {
    setError('')
    if (!getExportData) return
    setLoading('Saving…')
    try {
      await saveToProjectFolder(getExportData, projectName)
      const list = await listFromProjectFolder()
      setLocalProjects(list)
      setLoading('')
    } catch (e) {
      setError(e?.message || 'Failed to save')
      setLoading('')
    }
  }

  const handleSaveToDrive = async () => {
    setError('')
    if (!driveToken || !getExportData) return
    setLoading('Saving to Google Drive…')
    try {
      await saveToDrive(driveToken, getExportData(), projectName || 'Untitled Project', null)
      const list = await listDriveProjects(driveToken)
      setDriveProjects(list)
      setLoading('')
    } catch (e) {
      setError(e?.message || 'Failed to save to Drive')
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
              <p className="project-overview-empty-hint">Use <strong>Open project folder</strong> to read and save directly to a folder on your computer, or <strong>Connect Google Drive</strong>, or create a <strong>New Project</strong>.</p>
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
                {(thumbnails[proj.id] ?? getFirstSlideImageUrl(proj.data)) ? (
                  <img src={thumbnails[proj.id] ?? getFirstSlideImageUrl(proj.data)} alt="" />
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
                {proj.type === 'local' && 'Folder'}
                {proj.type === 'drive' && 'Google Drive'}
              </span>
            </button>
          ))}
        </div>

        <div className="project-overview-actions">
          <div className="project-overview-actions-left">
            {localSupported && (
              <>
                {localFolderName !== null ? (
                  <>
                    <span className="project-overview-folder-label" title="Current project folder">
                      Folder: {localFolderName || 'Unnamed'}
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
            {driveToken ? (
              <button type="button" className="btn-project-overview secondary" onClick={handleSaveToDrive} disabled={!!loading}>
                Save to Google Drive
              </button>
            ) : (
              <button type="button" className="btn-project-overview secondary" onClick={handleConnectDrive} disabled={!!loading}>
                Connect Google Drive
              </button>
            )}
          </div>
          <div className="project-overview-actions-right">
            {selectedProject?.type === 'local' && (
              <>
                <button
                  type="button"
                  className="btn-project-overview secondary"
                  onClick={handleRenameProjectClick}
                  disabled={!!loading}
                >
                  Rename project
                </button>
                <button
                  type="button"
                  className="btn-project-overview danger"
                  onClick={handleDeleteProject}
                  disabled={!!loading}
                >
                  Delete project
                </button>
              </>
            )}
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

        {showRenameProjectOverlay && (
          <div className="project-overview-new-overlay" onClick={handleRenameProjectCancel}>
            <div className="project-overview-new-modal" onClick={(e) => e.stopPropagation()}>
              <h3 className="project-overview-new-title">Rename project</h3>
              <label htmlFor="rename-project-name" className="project-overview-new-label">Project name</label>
              <input
                id="rename-project-name"
                type="text"
                className="project-overview-new-input"
                value={renameProjectValue}
                onChange={(e) => setRenameProjectValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRenameProjectSave()
                  if (e.key === 'Escape') handleRenameProjectCancel()
                }}
                placeholder="e.g. Q4 Pitch"
                autoFocus
              />
              <div className="project-overview-new-actions">
                <button type="button" className="btn-project-overview secondary" onClick={handleRenameProjectCancel}>
                  Cancel
                </button>
                <button type="button" className="btn-project-overview primary" onClick={handleRenameProjectSave} disabled={!!loading}>
                  Save
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
