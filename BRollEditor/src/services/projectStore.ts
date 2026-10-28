import { createDefaultCaptionSettings, createDefaultMusic, createEmptyProject, type Project } from '../types'

// Same two-tier pattern as StoryWriter's project storage: a small manifest (id/name only) under
// one key, and each project's actual content under its own key — so switching projects is a
// cheap read of a small blob, not re-parsing every project's data just to build a tab list.
const LEGACY_KEY = 'brollEditor.project'
const PROJECTS_KEY = 'brollEditor.projects'
const CURRENT_PROJECT_KEY = 'brollEditor.currentProjectId'

export type ProjectMeta = { id: string; name: string; updatedAt: number }

function projectDataKey(id: string): string {
  return `brollEditor.project.${id}`
}

function newProjectId(): string {
  return `proj-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function readManifest(): ProjectMeta[] {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function writeManifest(list: ProjectMeta[]) {
  try {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(list))
  } catch {
    // ignore quota errors
  }
}

// Merged over fresh defaults so a project saved before a field (e.g. `music`) existed still
// loads with a valid value for it — same reasoning as the old single-project loader had, just
// applied per-project now. `captions`/`music` need their own nested merge — a plain shallow
// spread would keep a saved nested object exactly as written and never backfill fields added to
// it later.
function mergeProjectDefaults(saved: any): Project {
  return {
    ...createEmptyProject(),
    ...saved,
    captions: { ...createDefaultCaptionSettings(), ...(saved.captions || {}) },
    music: { ...createDefaultMusic(), ...(saved.music || {}) },
  } as Project
}

/** One-time migration from the pre-multi-project single `brollEditor.project` key, so an
 * existing user's in-progress work becomes "Project 1" instead of vanishing behind the new tab
 * bar. Only runs when no manifest exists yet. */
function migrateLegacyProject(): ProjectMeta[] {
  try {
    const raw = localStorage.getItem(LEGACY_KEY)
    if (!raw) return []
    const saved = JSON.parse(raw)
    const id = newProjectId()
    const meta: ProjectMeta = { id, name: 'Project 1', updatedAt: Date.now() }
    localStorage.setItem(projectDataKey(id), JSON.stringify(mergeProjectDefaults(saved)))
    localStorage.removeItem(LEGACY_KEY)
    return [meta]
  } catch {
    return []
  }
}

/** The tab bar's list. Falls back to migrating the old single-project key, and if there's
 * truly nothing saved yet, the caller is expected to create a first project itself. */
export function loadProjectManifest(): ProjectMeta[] {
  const existing = readManifest()
  if (existing.length > 0) return existing
  const migrated = migrateLegacyProject()
  if (migrated.length > 0) writeManifest(migrated)
  return migrated
}

export function createProjectEntry(name = 'New project'): ProjectMeta {
  const meta: ProjectMeta = { id: newProjectId(), name, updatedAt: Date.now() }
  writeManifest([...readManifest(), meta])
  localStorage.setItem(projectDataKey(meta.id), JSON.stringify(createEmptyProject()))
  return meta
}

export function renameProjectEntry(id: string, name: string): ProjectMeta[] {
  const list = readManifest().map((p) => (p.id === id ? { ...p, name } : p))
  writeManifest(list)
  return list
}

export function deleteProjectEntry(id: string): ProjectMeta[] {
  const list = readManifest().filter((p) => p.id !== id)
  writeManifest(list)
  try {
    localStorage.removeItem(projectDataKey(id))
  } catch {
    // ignore
  }
  return list
}

export function loadProjectData(id: string): Project {
  try {
    const raw = localStorage.getItem(projectDataKey(id))
    if (!raw) return createEmptyProject()
    return mergeProjectDefaults(JSON.parse(raw))
  } catch {
    return createEmptyProject()
  }
}

export function saveProjectData(id: string, project: Project) {
  try {
    localStorage.setItem(projectDataKey(id), JSON.stringify(project))
  } catch {
    // ignore quota errors
  }
}

export function loadCurrentProjectId(): string | null {
  try {
    return localStorage.getItem(CURRENT_PROJECT_KEY)
  } catch {
    return null
  }
}

export function saveCurrentProjectId(id: string) {
  try {
    localStorage.setItem(CURRENT_PROJECT_KEY, id)
  } catch {
    // ignore
  }
}
