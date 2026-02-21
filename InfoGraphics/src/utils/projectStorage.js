const PROJECTS_KEY = 'infographicsProjects'
const CURRENT_PROJECT_KEY = 'infographicsCurrentProject'
const CURRENT_TAB_KEY = 'infographicsCurrentTab_'
const PROJECT_DATA_PREFIX = 'infographicsProject_'
const LEGACY_DATA_KEY = 'infographicsData'

export function getProjectStorageKey(id) {
  return `${PROJECT_DATA_PREFIX}${id}`
}

export function generateTabId() {
  return `t_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export function loadCurrentTabId(projectId) {
  return localStorage.getItem(CURRENT_TAB_KEY + projectId) || null
}

export function saveCurrentTabId(projectId, tabId) {
  if (projectId && tabId) {
    localStorage.setItem(CURRENT_TAB_KEY + projectId, tabId)
  }
}

/** Normalize raw project data: ensure { tabs: [{ id, name, data }] } format. Migrates legacy single-doc format. */
export function normalizeProjectData(raw) {
  if (!raw) return { tabs: [] }
  if (Array.isArray(raw.tabs) && raw.tabs.length > 0) {
    return raw
  }
  const hasLegacyDoc = raw.elements != null || Array.isArray(raw.elements)
  if (hasLegacyDoc) {
    const tabId = generateTabId()
    return {
      tabs: [{ id: tabId, name: 'Document 1', data: raw }]
    }
  }
  return { tabs: [] }
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

/** Load a specific tab's document data from a project. Returns null if not found. */
export function loadTabData(projectId, tabId) {
  const raw = loadProjectData(projectId)
  const normalized = normalizeProjectData(raw)
  const tab = normalized.tabs.find(t => t.id === tabId)
  return tab ? tab.data : null
}

/** Save document data to a specific tab. Creates tab if it doesn't exist. */
export function saveTabData(projectId, tabId, tabName, data) {
  const raw = loadProjectData(projectId)
  const normalized = normalizeProjectData(raw)
  const idx = normalized.tabs.findIndex(t => t.id === tabId)
  const tabEntry = { id: tabId, name: tabName || 'Document', data }
  if (idx >= 0) {
    normalized.tabs[idx] = { ...normalized.tabs[idx], ...tabEntry }
  } else {
    normalized.tabs.push(tabEntry)
  }
  localStorage.setItem(getProjectStorageKey(projectId), JSON.stringify(normalized))
}

export function saveProjectData(id, data) {
  const raw = loadProjectData(id)
  const normalized = normalizeProjectData(raw)
  if (normalized.tabs.length === 0) {
    const tabId = generateTabId()
    normalized.tabs = [{ id: tabId, name: 'Document 1', data }]
  } else {
    normalized.tabs[0].data = data
  }
  localStorage.setItem(getProjectStorageKey(id), JSON.stringify(normalized))
}

/** Get all tabs for a project (for external loaders like PitchDeck/ReelRecorder). */
export function getProjectTabs(projectId) {
  const raw = loadProjectData(projectId)
  const normalized = normalizeProjectData(raw)
  return normalized.tabs.map(t => ({ id: t.id, name: t.name }))
}

/** Get document data for a project. If tabId given, returns that tab's data; else first tab (for backward compat). */
export function getDocumentDataForProject(projectId, tabId = null) {
  const raw = loadProjectData(projectId)
  const normalized = normalizeProjectData(raw)
  if (normalized.tabs.length === 0) return null
  const tab = tabId
    ? normalized.tabs.find(t => t.id === tabId)
    : normalized.tabs[0]
  return tab ? tab.data : null
}

/** Add a new tab to a project. Returns the new tab id. */
export function addProjectTab(projectId, name = 'New document') {
  const raw = loadProjectData(projectId)
  const normalized = normalizeProjectData(raw)
  const tabId = generateTabId()
  const defaultData = {
    elements: [],
    aspectRatio: '16:9',
    resolution: 800,
    backgroundColor: '#ffffff',
    zoom: 100,
    selectedIds: [],
    leftPanelTab: 'document',
    rightPanelTab: 'inspector',
    leftPanelWidth: 240,
    rightPanelWidth: 320,
    includeBackgroundInExport: true,
    defaultFontFamily: 'Inter',
    defaultFontSize: 14,
    timelineDuration: 10,
    showTimeline: true,
    timelineHeight: 140,
    brandPrimaryColor: '#3b82f6',
    brandSecondaryColor: '#1e40af',
    brandFontFamily: 'Inter'
  }
  normalized.tabs.push({ id: tabId, name, data: defaultData })
  localStorage.setItem(getProjectStorageKey(projectId), JSON.stringify(normalized))
  return tabId
}

/** Remove a tab. Returns the id of the tab to switch to (or null). */
export function removeProjectTab(projectId, tabId) {
  const raw = loadProjectData(projectId)
  const normalized = normalizeProjectData(raw)
  const idx = normalized.tabs.findIndex(t => t.id === tabId)
  if (idx < 0) return null
  normalized.tabs.splice(idx, 1)
  if (normalized.tabs.length === 0) return null
  const nextTab = normalized.tabs[Math.min(idx, normalized.tabs.length - 1)]
  localStorage.setItem(getProjectStorageKey(projectId), JSON.stringify(normalized))
  return nextTab.id
}

/** Rename a tab. */
export function renameProjectTab(projectId, tabId, name) {
  const raw = loadProjectData(projectId)
  const normalized = normalizeProjectData(raw)
  const tab = normalized.tabs.find(t => t.id === tabId)
  if (tab) {
    tab.name = (name || 'Document').trim()
    localStorage.setItem(getProjectStorageKey(projectId), JSON.stringify(normalized))
  }
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
