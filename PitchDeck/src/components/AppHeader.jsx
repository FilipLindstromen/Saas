import { useEffect, useRef, useState } from 'react'
import ThemeToggle from '@shared/ThemeToggle'
import AppLogo from './AppLogo'
import ShareExportMenu from './ShareExportMenu'
import './AppHeader.css'

function CopySlideCopyButton({ onCopyText }) {
  const [feedback, setFeedback] = useState(null)
  const feedbackTimerRef = useRef(null)

  useEffect(() => () => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
  }, [])

  const handleClick = async () => {
    if (!onCopyText) return
    try {
      const ok = await onCopyText()
      if (ok === false) return
      setFeedback('Copied!')
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
      feedbackTimerRef.current = setTimeout(() => setFeedback(null), 2000)
    } catch {
      setFeedback('Copy failed')
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
      feedbackTimerRef.current = setTimeout(() => setFeedback(null), 2500)
    }
  }

  return (
    <button
      type="button"
      className={`header-btn-labeled copy-slide-copy-btn${feedback === 'Copied!' ? ' copy-slide-copy-btn-copied' : ''}`}
      onClick={handleClick}
      disabled={!onCopyText}
      title="Copy all slide copy to clipboard"
      aria-label="Copy all slide copy to clipboard"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </svg>
      <span>{feedback || 'Copy all copy'}</span>
    </button>
  )
}

function PresentMenu({
  mode,
  isRecordingInPlace,
  onPresent,
  onRecord,
  onVideoEditing,
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  const run = (fn) => {
    setOpen(false)
    fn?.()
  }

  const isPresentActive = mode === 'present' || isRecordingInPlace || mode === 'video-editing'

  return (
    <div className="present-menu" ref={ref}>
      <button
        type="button"
        className={`header-mode-btn present-menu-trigger ${isPresentActive ? 'active' : ''}`}
        onClick={() => run(onPresent)}
        title="Present (fullscreen)"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="5 3 19 12 5 21 5 3" />
        </svg>
        <span>Present</span>
      </button>
      <button
        type="button"
        className="present-menu-chevron"
        onClick={() => setOpen((v) => !v)}
        aria-label="More present options"
        aria-expanded={open}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className="present-menu-dropdown" role="menu">
          <button type="button" role="menuitem" onClick={() => run(onPresent)}>Present fullscreen</button>
          <button type="button" role="menuitem" onClick={() => run(onRecord)} disabled={isRecordingInPlace}>
            Record screen
          </button>
          <button type="button" role="menuitem" onClick={() => run(onVideoEditing)}>Video editing</button>
        </div>
      )}
    </div>
  )
}

function AppHeader({
  mode,
  projectName,
  onProjectNameChange,
  onOpenProjectOverview,
  chapters,
  currentChapterId,
  onChapterChange,
  onAddChapter,
  onUpdateChapterName,
  onChapterDrop,
  workspaces,
  currentWorkspace,
  onSwitchWorkspace,
  onAddWorkspace,
  onSetMode,
  onPresent,
  onRecord,
  onVideoEditing,
  isRecordingInPlace,
  onBulkSelectImages,
  bulkImagesDisabled,
  onBulkSelectVideos,
  bulkVideosDisabled,
  onExportProject,
  onExportPng,
  onExportInstagram,
  onCopyText,
  onSaveToFolder,
  onImport,
  slideFormat,
  isExportingPng,
  theme,
  onToggleTheme,
  onOpenPreferences,
  onToggleSidebar,
  sidebarCollapsed,
  onToggleInspector,
  inspectorOpen,
  showLayoutToggles = false,
}) {
  const [editingChapter, setEditingChapter] = useState(false)
  const [chapterNameDraft, setChapterNameDraft] = useState('')
  const chapterInputRef = useRef(null)

  const currentChapter = chapters.find((c) => c.id === currentChapterId)

  useEffect(() => {
    if (editingChapter && chapterInputRef.current) {
      chapterInputRef.current.focus()
      chapterInputRef.current.select()
    }
  }, [editingChapter])

  const startChapterRename = () => {
    if (!currentChapter) return
    setChapterNameDraft(currentChapter.name)
    setEditingChapter(true)
  }

  const commitChapterRename = () => {
    const trimmed = chapterNameDraft.trim()
    if (trimmed && currentChapter && trimmed !== currentChapter.name) {
      onUpdateChapterName(currentChapterId, trimmed)
    }
    setEditingChapter(false)
  }

  return (
    <div className="app-header">
      <div className="header-top-row">
        <div className="header-left">
          {showLayoutToggles && (
            <button
              type="button"
              className="btn-icon-header header-layout-toggle"
              onClick={onToggleSidebar}
              title={sidebarCollapsed ? 'Expand slide list' : 'Collapse slide list'}
              aria-label={sidebarCollapsed ? 'Expand slide list' : 'Collapse slide list'}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="9" y1="3" x2="9" y2="21" />
              </svg>
            </button>
          )}
          <button type="button" className="header-app-title" onClick={onOpenProjectOverview} title="Project overview">
            <AppLogo />
          </button>
          <div className="header-file-actions">
            {workspaces.length > 1 && (
              <div className="workspace-switcher">
                <button className="btn-icon-header btn-workspace" title="Switch workspace" type="button">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <line x1="9" y1="3" x2="9" y2="21" />
                  </svg>
                  <span>{workspaces.find((w) => w.id === currentWorkspace)?.name || 'Workspace'}</span>
                </button>
                <div className="workspace-menu">
                  {workspaces.map((workspace) => (
                    <button
                      key={workspace.id}
                      type="button"
                      className={`workspace-item ${currentWorkspace === workspace.id ? 'active' : ''}`}
                      onClick={() => onSwitchWorkspace(workspace.id)}
                    >
                      {workspace.name}
                    </button>
                  ))}
                  <button type="button" className="workspace-item add" onClick={onAddWorkspace}>
                    + New Workspace
                  </button>
                </div>
              </div>
            )}
            <input
              type="text"
              className="project-name-input"
              placeholder="Project name"
              value={projectName}
              onChange={(e) => onProjectNameChange(e.target.value)}
              title="Project name (used when saving files)"
            />
          </div>
          {(mode === 'plan' || mode === 'edit') && (
            <div
              className="header-chapters"
              onDragOver={(e) => {
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
              }}
              onDrop={onChapterDrop}
            >
              <select
                className="chapter-dropdown"
                value={currentChapterId}
                onChange={(e) => onChapterChange(parseInt(e.target.value, 10))}
                title="Chapter"
              >
                {chapters.map((chapter) => (
                  <option key={chapter.id} value={chapter.id}>
                    {chapter.name}
                  </option>
                ))}
              </select>
              {editingChapter ? (
                <input
                  ref={chapterInputRef}
                  type="text"
                  className="chapter-rename-input"
                  value={chapterNameDraft}
                  onChange={(e) => setChapterNameDraft(e.target.value)}
                  onBlur={commitChapterRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitChapterRename()
                    if (e.key === 'Escape') setEditingChapter(false)
                  }}
                  aria-label="Chapter name"
                />
              ) : (
                <button type="button" className="chapter-rename-btn" onClick={startChapterRename} title="Rename chapter">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
              )}
              <button type="button" className="chapter-tab-add" onClick={onAddChapter} title="Add chapter">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
            </div>
          )}
        </div>

        <div className="header-center">
          <div className="header-mode-buttons">
            <button
              type="button"
              className={`header-mode-btn ${mode === 'plan' ? 'active' : ''}`}
              onClick={() => onSetMode('plan')}
              title="Plan — outline and structure"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              <span>Plan</span>
            </button>
            <button
              type="button"
              className={`header-mode-btn ${mode === 'edit' ? 'active' : ''}`}
              onClick={() => onSetMode('edit')}
              title="Edit — visual polish"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              <span>Edit</span>
            </button>
            <PresentMenu
              mode={mode}
              isRecordingInPlace={isRecordingInPlace}
              onPresent={onPresent}
              onRecord={onRecord}
              onVideoEditing={onVideoEditing}
            />
          </div>
        </div>

        <div className="header-right">
          {mode === 'edit' && (
            <>
              <div className="header-icon-group">
                <button
                  type="button"
                  className="btn-icon-header btn-bulk-images"
                  onClick={onBulkSelectImages}
                  title="Auto-select images for all slides without image or video backgrounds"
                  aria-label="Auto-select images"
                  disabled={bulkImagesDisabled}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="btn-icon-header btn-bulk-videos"
                  onClick={onBulkSelectVideos}
                  title="Auto-select videos for all slides without image or video backgrounds"
                  aria-label="Auto-select videos"
                  disabled={bulkVideosDisabled}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <polygon points="10 8 16 12 10 16 10 8" />
                  </svg>
                </button>
              </div>
              <div className="header-icon-group-divider" aria-hidden="true" />
            </>
          )}
          <CopySlideCopyButton onCopyText={onCopyText} />
          <ShareExportMenu
            onExportProject={onExportProject}
            onExportPng={onExportPng}
            onExportInstagram={onExportInstagram}
            onCopyText={onCopyText}
            onSaveToFolder={onSaveToFolder}
            onImport={onImport}
            slideFormat={slideFormat}
            isExporting={isExportingPng}
          />
          {showLayoutToggles && (
            <button
              type="button"
              className="btn-icon-header header-inspector-toggle"
              onClick={onToggleInspector}
              title={inspectorOpen ? 'Hide inspector' : 'Show inspector'}
              aria-label={inspectorOpen ? 'Hide inspector' : 'Show inspector'}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="15" y1="3" x2="15" y2="21" />
                <rect x="3" y="3" width="18" height="18" rx="2" />
              </svg>
            </button>
          )}
          <div className="header-overflow-menu">
            <ThemeToggle theme={theme} onToggle={onToggleTheme} className="btn-icon-header btn-theme-toggle" />
            <button
              type="button"
              className="btn-icon-header btn-settings"
              onClick={onOpenPreferences}
              title="Preferences"
              aria-label="Preferences"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AppHeader
