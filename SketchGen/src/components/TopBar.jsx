import ThemeToggle from '@shared/ThemeToggle'
import ProjectSelector from '@shared/ProjectSelector/ProjectSelector'
import ExportMenu from './ExportMenu'
import './TopBar.css'

export default function TopBar({
  view, onViewChange, hasGenerated, theme, onToggleTheme, onOpenSettings, onOpenBranding, brandColors, onExport,
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
        <ExportMenu variant="icon" className="export-menu-root-toolbar" onExport={onExport} />
      )}

      <button
        type="button"
        className="sketchgen-brand-btn"
        onClick={onOpenBranding}
        title="Brand colors, fonts, and palette"
      >
        <span className="sketchgen-brand-btn-swatches" aria-hidden>
          {[brandColors?.main, brandColors?.accent, brandColors?.line].map((c, i) => (
            <span key={i} className="sketchgen-brand-btn-swatch" style={{ '--swatch-color': c ?? '#ccc' }} />
          ))}
        </span>
        Brand
      </button>

      <ThemeToggle theme={theme} onToggle={onToggleTheme} className="sketchgen-icon-btn" />

      <button type="button" className="sketchgen-icon-btn" onClick={onOpenSettings} title="Settings and API keys">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>
    </header>
  )
}
