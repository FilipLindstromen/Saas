import ExportButtons from './ExportButtons'
import ProjectSelector from './ProjectSelector'
import { ELEMENT_TYPES, getElementTypeColor } from '../constants/elementTypes'
import './Toolbar.css'

export default function Toolbar({ projects = [], currentProjectId, currentProjectName, onSwitchProject, onCreateProject, onRenameProject, onDeleteProject, onOpenSettings, onShowShortcuts, onToggleTheme, theme = 'dark', onAddElement, showTimeline = true, onToggleTimeline, canvasRef, includeBackgroundInExport = true, onBeforeExport, canvasData }) {
  return (
    <div className="toolbar">
      <span className="toolbar-logo">INFOGRAPHIC GENERATOR</span>
      <ProjectSelector
        projects={projects}
        currentProjectId={currentProjectId}
        currentProjectName={currentProjectName}
        onSwitchProject={onSwitchProject}
        onCreateProject={onCreateProject}
        onRenameProject={onRenameProject}
        onDeleteProject={onDeleteProject}
      />
      <div className="toolbar-spacer" />
      <div className="toolbar-elements">
        {ELEMENT_TYPES.map(({ type, title, icon }) => (
          <button
            key={type}
            type="button"
            className="toolbar-btn toolbar-btn-element"
            style={{ '--element-color': getElementTypeColor(type) }}
            onClick={() => onAddElement?.(type)}
            title={title}
          >
            {icon}
          </button>
        ))}
      </div>
      <div className="toolbar-spacer" />
      <ExportButtons
        canvasRef={canvasRef}
        includeBackgroundInExport={includeBackgroundInExport}
        onBeforeExport={onBeforeExport}
        canvasData={canvasData}
      />
      <button
        type="button"
        className={`toolbar-btn toolbar-btn-icon ${showTimeline ? 'active' : ''}`}
        onClick={onToggleTimeline}
        title={showTimeline ? 'Hide timeline' : 'Show timeline'}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="6" width="20" height="12" rx="2" />
          <path d="M7 10v4M11 9v6M15 8v8M19 10v4" />
        </svg>
      </button>
      <button className="toolbar-btn toolbar-btn-icon" onClick={onShowShortcuts} title="Keyboard shortcuts (?)">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M6 16h12" />
        </svg>
      </button>
      <button
        type="button"
        className="toolbar-btn toolbar-btn-icon toolbar-btn-theme"
        onClick={onToggleTheme}
        title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      >
        {theme === 'dark' ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        )}
      </button>
      <button className="toolbar-btn toolbar-btn-icon" onClick={onOpenSettings} title="Settings">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>
    </div>
  )
}
