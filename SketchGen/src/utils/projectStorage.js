/**
 * Project/drawing metadata, mirroring StoryWriter's project+tab pattern
 * (see StoryWriter/src/utils/projectStorage.js) so SketchGen behaves the same
 * way: multiple projects, each holding multiple drawings ("tabs").
 *
 * Unlike StoryWriter, actual drawing content is NOT inlined here — a drawing's
 * canvas layers and generation history live in IndexedDB (src/utils/db.js),
 * keyed by `${projectId}:${tabId}`, since that content is full PNG data and
 * would blow past localStorage's quota. This file only tracks the lightweight
 * project/tab lists and "which one is currently open" pointers.
 */
const PROJECTS_KEY = 'sketchgen-projects'
const CURRENT_PROJECT_KEY = 'sketchgen-current-project'

function currentTabKey(projectId) {
  return `sketchgen-current-tab-${projectId}`
}

function projectTabsKey(projectId) {
  return `sketchgen-project-tabs-${projectId}`
}

export function generateProjectId() {
  return `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function generateTabId() {
  return `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function drawingKeyFor(projectId, tabId) {
  return `${projectId}:${tabId}`
}

export function loadProjects() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PROJECTS_KEY))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveProjects(projects) {
  try {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects))
  } catch {
    // ignore quota errors — project list is tiny, but fail soft regardless
  }
}

export function loadCurrentProjectId() {
  return localStorage.getItem(CURRENT_PROJECT_KEY)
}

export function saveCurrentProjectId(id) {
  try {
    localStorage.setItem(CURRENT_PROJECT_KEY, id)
  } catch {
    // ignore
  }
}

export function loadCurrentTabId(projectId) {
  return localStorage.getItem(currentTabKey(projectId))
}

export function saveCurrentTabId(projectId, tabId) {
  try {
    localStorage.setItem(currentTabKey(projectId), tabId)
  } catch {
    // ignore
  }
}

/** Returns [{id, name}] — no drawing content, just the tab list. */
export function getProjectTabs(projectId) {
  try {
    const parsed = JSON.parse(localStorage.getItem(projectTabsKey(projectId)))
    return Array.isArray(parsed?.tabs) ? parsed.tabs : []
  } catch {
    return []
  }
}

function saveProjectTabsList(projectId, tabs) {
  try {
    localStorage.setItem(projectTabsKey(projectId), JSON.stringify({ tabs }))
  } catch {
    // ignore
  }
}

/** Adds a new (empty) drawing tab and returns its id. */
export function addProjectTab(projectId, name) {
  const tabs = getProjectTabs(projectId)
  const id = generateTabId()
  saveProjectTabsList(projectId, [...tabs, { id, name }])
  return id
}

/** Removes a tab. Returns the id of the tab that should become active next, or null if none remain. */
export function removeProjectTab(projectId, tabId) {
  const tabs = getProjectTabs(projectId).filter((t) => t.id !== tabId)
  saveProjectTabsList(projectId, tabs)
  return tabs.length ? tabs[tabs.length - 1].id : null
}

export function renameProjectTab(projectId, tabId, name) {
  const tabs = getProjectTabs(projectId).map((t) => (t.id === tabId ? { ...t, name } : t))
  saveProjectTabsList(projectId, tabs)
}

/** Removes all localStorage bookkeeping for a project (call after also cleaning up its IndexedDB content). */
export function deleteProjectStorage(projectId) {
  localStorage.removeItem(projectTabsKey(projectId))
  localStorage.removeItem(currentTabKey(projectId))
}
