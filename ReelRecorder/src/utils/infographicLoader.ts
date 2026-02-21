/**
 * Load infographic projects from InfoGraphics generator (shared localStorage).
 * Uses the same keys as InfoGraphics/src/utils/projectStorage.js
 */
const PROJECTS_KEY = 'infographicsProjects'
const PROJECT_DATA_PREFIX = 'infographicsProject_'

export function getProjectStorageKey(id: string): string {
  return `${PROJECT_DATA_PREFIX}${id}`
}

export interface InfographicProjectMeta {
  id: string
  name: string
  updatedAt?: number
}

export interface InfographicProjectData {
  elements: Array<{
    id: string
    type: string
    x: number
    y: number
    width: number
    height: number
    rotation?: number
    text?: string
    imageUrl?: string
    fontSize?: number
    fontFamily?: string
    color?: string
    backgroundColor?: string
    arrowDirection?: string
    arrowStyle?: string
    imageTint?: string
    imageTintOpacity?: number
    animationIn?: string
    animationOut?: string
    gradientColor?: string
    clipStart?: number
    clipEnd?: number
    zIndex?: number
    visible?: boolean
  }>
  aspectRatio?: string
  resolution?: number
  backgroundColor?: string
  timelineDuration?: number
}

export function loadInfographicProjects(): InfographicProjectMeta[] {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY)
    if (raw) {
      const list = JSON.parse(raw)
      return Array.isArray(list) ? list : []
    }
  } catch (e) {
    console.error('Error loading infographic projects:', e)
  }
  return []
}

export interface InfographicTabMeta {
  id: string
  name: string
}

/** Get tabs for a project. Returns [{ id, name }]. */
export function getInfographicProjectTabs(projectId: string): InfographicTabMeta[] {
  try {
    const raw = localStorage.getItem(getProjectStorageKey(projectId))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed?.tabs) && parsed.tabs.length > 0) {
      return parsed.tabs.map((t: { id: string; name?: string }) => ({
        id: t.id,
        name: t.name || 'Document',
      }))
    }
    return [{ id: 'default', name: 'Document 1' }]
  } catch {
    return []
  }
}

/** Load infographic document data. projectId required. tabId optional - if omitted, uses first tab (backward compat). */
export function loadInfographicProjectData(
  projectId: string,
  tabId?: string | null
): InfographicProjectData | null {
  try {
    const raw = localStorage.getItem(getProjectStorageKey(projectId))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed?.tabs) && parsed.tabs.length > 0) {
      const tab = tabId
        ? parsed.tabs.find((t: { id: string }) => t.id === tabId)
        : parsed.tabs[0]
      return tab?.data ?? null
    }
    return parsed.elements != null ? parsed : null
  } catch (e) {
    console.error('Error loading infographic project:', e)
  }
  return null
}
