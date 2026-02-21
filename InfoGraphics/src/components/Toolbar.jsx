import ExportButtons from './ExportButtons'
import ProjectSelector from './ProjectSelector'
import { ELEMENT_TYPES } from '../constants/elementTypes'
import './Toolbar.css'

export default function Toolbar({ projects = [], currentProjectId, currentProjectName, onSwitchProject, onCreateProject, onRenameProject, onDeleteProject, onOpenSettings, onAddElement, showTimeline = true, onToggleTimeline, canvasRef, includeBackgroundInExport = true, onBeforeExport, canvasData }) {
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
      <button className="toolbar-btn toolbar-btn-icon" onClick={onOpenSettings} title="Settings">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>
    </div>
  )
}
