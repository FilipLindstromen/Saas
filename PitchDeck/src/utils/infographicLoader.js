/**
 * Load infographic projects from InfoGraphics generator (shared localStorage).
 * Uses the same keys as InfoGraphics/src/utils/projectStorage.js
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

export function loadInfographicProjectData(id) {
  try {
    const raw = localStorage.getItem(getProjectStorageKey(id))
    return raw ? JSON.parse(raw) : null
  } catch (e) {
    console.error('Error loading infographic project:', e)
  }
  return null
}
