declare module '@shared/theme' {
  export function getTheme(): 'light' | 'dark'
  export function setTheme(theme: 'light' | 'dark'): void
  export function initThemeSync(): (() => void) | undefined
}

declare module '@shared/ThemeToggle' {
  import type { ComponentType } from 'react'
  interface ThemeToggleProps {
    theme?: 'light' | 'dark'
    onToggle?: (theme: 'light' | 'dark') => void
    className?: string
  }
  const ThemeToggle: ComponentType<ThemeToggleProps>
  export default ThemeToggle
}

declare module '@shared/ProjectSelector/ProjectSelector' {
  import type { ComponentType } from 'react'
  interface ProjectSelectorProps {
    projects?: { id: string; name: string }[]
    currentProjectId?: string
    currentProjectName?: string
    onSwitchProject?: (id: string) => void
    onCreateProject?: () => void
    onRenameProject?: (id: string, name: string) => void
    onDeleteProject?: (id: string) => void
  }
  const ProjectSelector: ComponentType<ProjectSelectorProps>
  export default ProjectSelector
}
