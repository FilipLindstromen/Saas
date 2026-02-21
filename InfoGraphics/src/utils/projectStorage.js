const PROJECTS_KEY = 'infographicsProjects'
const CURRENT_PROJECT_KEY = 'infographicsCurrentProject'
const PROJECT_DATA_PREFIX = 'infographicsProject_'
const LEGACY_DATA_KEY = 'infographicsData'

export function getProjectStorageKey(id) {
  return `${PROJECT_DATA_PREFIX}${id}`
}

export function loadProjects() {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY)
    if (raw) {
      const list = JSON.parse(raw)
      return Array.isArray(list) ? list : []
    }
  } catch (e) {
    console.error('Error loading projects:', e)
  }
  return []
}

export function saveProjects(projects) {
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects))
}

export function loadCurrentProjectId() {
  return localStorage.getItem(CURRENT_PROJECT_KEY) || null
}

export function saveCurrentProjectId(id) {
  if (id) {
    localStorage.setItem(CURRENT_PROJECT_KEY, id)
  } else {
    localStorage.removeItem(CURRENT_PROJECT_KEY)
  }
}

export function loadProjectData(id) {
  try {
    const raw = localStorage.getItem(getProjectStorageKey(id))
    return raw ? JSON.parse(raw) : null
  } catch (e) {
    console.error('Error loading project:', e)
  }
  return null
}

export function saveProjectData(id, data) {
  localStorage.setItem(getProjectStorageKey(id), JSON.stringify(data))
}

export function deleteProjectData(id) {
  localStorage.removeItem(getProjectStorageKey(id))
}

export function migrateLegacyData() {
  const legacy = localStorage.getItem(LEGACY_DATA_KEY)
  if (!legacy) return null
  try {
    const parsed = JSON.parse(legacy)
    if (parsed && (parsed.elements || Array.isArray(parsed.elements))) {
      return parsed
    }
  } catch (e) {}
  return null
}

export function clearLegacyData() {
  localStorage.removeItem(LEGACY_DATA_KEY)
}

export function generateProjectId() {
  return `p_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}
