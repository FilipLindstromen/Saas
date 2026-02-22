/**
 * Shared top bar for all tools.
 * Structure: [Logo] [Project] [Tabs] [Actions]
 * Project and Tabs are optional; Actions slot for tool-specific buttons.
 */
import ProjectSelector from '../ProjectSelector/ProjectSelector';
import TabBar from '../TabBar/TabBar';
import './AppTopBar.css';

export default function AppTopBar({
  logo,
  showProject = true,
  projectProps = {},
  showTabs = true,
  tabProps = {},
  actions,
  className = '',
}) {
  return (
    <header className={`shared-app-top-bar ${className}`}>
      {logo && <div className="shared-app-top-bar-logo">{logo}</div>}
      {showProject && (
        <ProjectSelector
          projects={projectProps.projects ?? []}
          currentProjectId={projectProps.currentProjectId}
          currentProjectName={projectProps.currentProjectName}
          onSwitchProject={projectProps.onSwitchProject}
          onCreateProject={projectProps.onCreateProject}
          onRenameProject={projectProps.onRenameProject}
          onDeleteProject={projectProps.onDeleteProject}
        />
      )}
      {showTabs && (
        <div className="shared-app-top-bar-tabs">
          <TabBar
            tabs={tabProps.tabs ?? []}
            currentTabId={tabProps.currentTabId}
            onSwitchTab={tabProps.onSwitchTab}
            onAddTab={tabProps.onAddTab}
            onRenameTab={tabProps.onRenameTab}
            onDeleteTab={tabProps.onDeleteTab}
            disabled={tabProps.disabled}
            defaultTabName={tabProps.defaultTabName}
            addTitle={tabProps.addTitle}
          />
        </div>
      )}
      <div className="shared-app-top-bar-spacer" />
      {actions && <div className="shared-app-top-bar-actions">{actions}</div>}
    </header>
  );
}
