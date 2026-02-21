/**
 * Load infographic projects from InfoGraphics generator (shared localStorage).
 * Uses the same keys as InfoGraphics/src/utils/projectStorage.js
 * Supports multi-tab: each project can have multiple tabs (documents).
 */
const PROJECTS_KEY = 'infographicsProjects'
const PROJECT_DATA_PREFIX = 'infographicsProject_'

export function getProjectStorageKey(id) {
  return `${PROJECT_DATA_PREFIX}${id}`
}

export function loadInfographicProjects() {
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

/** Get tabs for a project. Returns [{ id, name }]. */
export function getInfographicProjectTabs(projectId) {
  try {
    const raw = localStorage.getItem(getProjectStorageKey(projectId))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed?.tabs) && parsed.tabs.length > 0) {
      return parsed.tabs.map(t => ({ id: t.id, name: t.name || 'Document' }))
    }
    return [{ id: 'default', name: 'Document 1' }]
  } catch (e) {
    return []
  }
}

/** Load infographic document data. projectId required. tabId optional - if omitted, uses first tab (backward compat). */
export function loadInfographicProjectData(projectId, tabId = null) {
  try {
    const raw = localStorage.getItem(getProjectStorageKey(projectId))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed?.tabs) && parsed.tabs.length > 0) {
      const tab = tabId
        ? parsed.tabs.find(t => t.id === tabId)
        : parsed.tabs[0]
      return tab?.data ?? null
    }
    return parsed.elements != null ? parsed : null
  } catch (e) {
    console.error('Error loading infographic project:', e)
  }
  return null
}
