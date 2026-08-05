import ThemeToggle from '@shared/ThemeToggle'
import ProjectSelector from '@shared/ProjectSelector/ProjectSelector'
import './TopBar.css'

export default function TopBar({
  view, onViewChange, hasGenerated, theme, onToggleTheme, onOpenSettings, onDownload,
  projects, currentProjectId, currentProjectName, onSwitchProject, onCreateProject, onRenameProject, onDeleteProject,
}) {
  return (
    <header className="sketchgen-top-bar">
      <span className="sketchgen-logo">✏️ SketchGen</span>

      <ProjectSelector
        projects={projects}
        currentProjectId={currentProjectId}
        currentProjectName={currentProjectName}
        onSwitchProject={onSwitchProject}
        onCreateProject={onCreateProject}
        onRenameProject={onRenameProject}
        onDeleteProject={onDeleteProject}
      />

      <div className="sketchgen-view-switch">
        <button
          type="button"
          className={view === 'sketch' ? 'active' : ''}
          onClick={() => onViewChange('sketch')}
        >
          Sketch
        </button>
        <button
          type="button"
          className={view === 'generated' ? 'active' : ''}
          onClick={() => onViewChange('generated')}
          disabled={!hasGenerated}
        >
          Generated
        </button>
        <button
          type="button"
          className={view === 'compare' ? 'active' : ''}
          onClick={() => onViewChange('compare')}
          disabled={!hasGenerated}
        >
          Compare
        </button>
      </div>

      <div className="sketchgen-top-bar-spacer" />

      {hasGenerated && view !== 'sketch' && (
        <button type="button" className="sketchgen-icon-btn" onClick={onDownload} title="Download generated image">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v12" />
            <path d="M7 10l5 5 5-5" />
            <path d="M4 21h16" />
          </svg>
        </button>
      )}

      <ThemeToggle theme={theme} onToggle={onToggleTheme} className="sketchgen-icon-btn" />

      <button type="button" className="sketchgen-icon-btn" onClick={onOpenSettings} title="Settings">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>
    </header>
  )
}
