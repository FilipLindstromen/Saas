import { useCallback, useEffect, useRef, useState } from 'react'
// @ts-ignore - shared module is JS
import { loadApiKeys } from '@shared/apiKeys'
// @ts-ignore - shared module is JS
import { getTheme, initThemeSync } from '@shared/theme'
// @ts-ignore - shared component is JSX
import ThemeToggle from '@shared/ThemeToggle'
// @ts-ignore - shared component is JSX
import SettingsModal from '@shared/SettingsModal/SettingsModal'
// @ts-ignore - shared component is JSX
import TabBar from '@shared/TabBar/TabBar'
import RecordTab from './tabs/RecordTab'
import CutTab from './tabs/CutTab'
import EditTab from './tabs/EditTab'
import ExportTab from './tabs/ExportTab'
import ErrorBoundary from './components/ErrorBoundary'
import CaptionsPanel from './components/CaptionsPanel'
import MusicPanel from './components/MusicPanel'
import { extractSearchQuery, searchAllSources } from './services/stockSearch'
import type { CaptionSettings, MusicTrack, Project, SearchSourceToggles } from './types'
import {
  createProjectEntry,
  deleteProjectEntry,
  loadCurrentProjectId,
  loadProjectData,
  loadProjectManifest,
  renameProjectEntry,
  saveCurrentProjectId,
  saveProjectData,
  type ProjectMeta,
} from './services/projectStore'
import './App.css'

const TOGGLES_KEY = 'brollEditor.sourceToggles'

function loadToggles(): SearchSourceToggles {
  try {
    const raw = localStorage.getItem(TOGGLES_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore
  }
  return { pexels: true, pixabay: true, unsplash: true, video: true, image: true }
}

type TabId = 'record' | 'cut' | 'edit' | 'export'

const TABS: { id: TabId; label: string }[] = [
  { id: 'record', label: '1. Record / Import / Transcribe' },
  { id: 'cut', label: '2. Cut' },
  { id: 'edit', label: '3. Edit & Select B-roll' },
  { id: 'export', label: '4. Export' },
]

function initialProjects(): ProjectMeta[] {
  const existing = loadProjectManifest()
  if (existing.length > 0) return existing
  // Truly first run: no manifest and nothing to migrate — start with one empty project rather
  // than showing an empty tab bar with nothing to click.
  return [createProjectEntry('Project 1')]
}

function initialProjectId(projects: ProjectMeta[]): string {
  const saved = loadCurrentProjectId()
  if (saved && projects.some((p) => p.id === saved)) return saved
  return projects[0].id
}

export default function App() {
  const [theme, setTheme] = useState(() => getTheme())
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [apiKeys, setApiKeys] = useState(() => loadApiKeys())
  const [activeTab, setActiveTab] = useState<TabId>('record')
  const [projects, setProjects] = useState<ProjectMeta[]>(initialProjects)
  const [currentProjectId, setCurrentProjectId] = useState<string>(() => initialProjectId(projects))
  const [project, setProject] = useState<Project>(() => loadProjectData(currentProjectId))
  const projectRef = useRef(project)
  const currentProjectIdRef = useRef(currentProjectId)
  const [past, setPast] = useState<Project[]>([])
  const [future, setFuture] = useState<Project[]>([])
  const coalesceTimerRef = useRef<number | null>(null)
  const [toggles, setToggles] = useState<SearchSourceToggles>(loadToggles)
  const [captionsOpen, setCaptionsOpen] = useState(false)
  const [musicOpen, setMusicOpen] = useState(false)
  const [autoFilling, setAutoFilling] = useState<{ done: number; total: number } | null>(null)
  const [selectedLineIds, setSelectedLineIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    const unsub = initThemeSync()
    const handler = (e: any) => setTheme(e.detail || getTheme())
    window.addEventListener('saas-theme-change', handler)
    return () => {
      unsub?.()
      window.removeEventListener('saas-theme-change', handler)
    }
  }, [])

  // Root .env keys (same ones every other Saas app uses) come from our own server on
  // localhost — see server/index.mjs's /api/keys for why this replaces Vite's env define.
  useEffect(() => {
    fetch('/api/keys')
      .then((r) => (r.ok ? r.json() : null))
      .then((serverKeys) => {
        if (!serverKeys) return
        setApiKeys((prev: any) => {
          const merged = { ...prev }
          for (const [k, v] of Object.entries(serverKeys)) {
            if (v) merged[k] = v
          }
          return merged
        })
      })
      .catch(() => {})
  }, [])

  // Kept in sync every render so the flush-before-switch below (and a future beforeunload flush)
  // always sees the latest project/id without needing to be a dependency of the effects that use
  // them — avoids the debounced save effect's closure going stale mid-timeout.
  useEffect(() => {
    projectRef.current = project
    currentProjectIdRef.current = currentProjectId
  })

  useEffect(() => {
    const t = setTimeout(() => saveProjectData(currentProjectId, project), 500)
    return () => clearTimeout(t)
  }, [project, currentProjectId])

  const MAX_HISTORY = 100
  const UNDO_COALESCE_MS = 600

  // Rapid-fire changes (typing, dragging) coalesce into one undo step: only the FIRST change in
  // a burst pushes a checkpoint; subsequent ones just keep resetting the "burst is still open"
  // timer. The actual state update uses setProject's FUNCTIONAL form (`prev => ...`) rather than
  // reading `project` from this closure — several callers (auto-fill's loop, most notably) call
  // updateProject multiple times back to back, and reading a closed-over `project` there would
  // have every call after the first compute its result from the same stale snapshot, silently
  // discarding all but the last one. The history checkpoint still uses projectRef (kept fresh by
  // the sync effect below) since it only needs to be "before this batch of calls", not exact
  // per-call — and setPast/setFuture stay independent top-level setState calls, not nested
  // inside setProject's updater, so this stays correct under React 18 Strict Mode (which
  // double-invokes updater functions in dev to catch impure ones).
  const updateProject = useCallback((updater: (p: Project) => Project) => {
    if (!coalesceTimerRef.current) {
      setPast((p) => [...p, projectRef.current].slice(-MAX_HISTORY))
      setFuture([])
    }
    if (coalesceTimerRef.current) window.clearTimeout(coalesceTimerRef.current)
    coalesceTimerRef.current = window.setTimeout(() => { coalesceTimerRef.current = null }, UNDO_COALESCE_MS)
    setProject((prev) => updater(prev))
  }, [])

  const handleTogglesChange = useCallback((t: SearchSourceToggles) => {
    setToggles(t)
    try { localStorage.setItem(TOGGLES_KEY, JSON.stringify(t)) } catch { /* ignore */ }
  }, [])

  const handleApplyPreset = useCallback((captions: CaptionSettings, brandColor: string) => {
    updateProject((p) => ({ ...p, captions, brandColor }))
  }, [updateProject])

  const handleMusicChange = useCallback((music: MusicTrack) => {
    updateProject((p) => ({ ...p, music }))
  }, [updateProject])

  const handleToggleLineSelection = useCallback((lineId: string) => {
    setSelectedLineIds((prev) => {
      const next = new Set(prev)
      if (next.has(lineId)) next.delete(lineId)
      else next.add(lineId)
      return next
    })
  }, [])

  // "Auto-fill b-roll" — the biggest time-save in the whole workflow: instead of manually
  // searching for every single line, run each empty line's own text (trimmed to a short,
  // search-friendly phrase) through the same multi-source search the panel uses, and take the
  // top result. Sequential (not Promise.all) on purpose — a handful of stock API calls in
  // parallel is fine, but this keeps it gentle on rate limits and lets the progress counter mean
  // something. Lives at the app level (not the Edit tab) since it's a project-wide action, not
  // specific to that one step. With 2+ scenes selected in the Edit tab, it scopes to just those
  // (still empty-only within the selection) instead of every empty line project-wide.
  const handleAutoFill = useCallback(async () => {
    const scoped = selectedLineIds.size > 1
    const emptyLines = project.lines.filter((l) => !l.broll && l.text.trim() && (!scoped || selectedLineIds.has(l.id)))
    if (emptyLines.length === 0) return
    setAutoFilling({ done: 0, total: emptyLines.length })
    for (let i = 0; i < emptyLines.length; i++) {
      const line = emptyLines[i]
      const query = extractSearchQuery(line.text)
      const results = await searchAllSources(query, toggles, apiKeys)
      const pick = (toggles.video && results.find((r) => r.type === 'video')) || results[0]
      if (pick) {
        updateProject((p) => ({
          ...p,
          lines: p.lines.map((l) =>
            l.id === line.id
              ? { ...l, broll: { type: pick.type, url: pick.url, thumbnailUrl: pick.thumbnailUrl, source: pick.source, kenBurns: pick.type === 'image', transition: 'cut' } }
              : l
          ),
        }))
      }
      setAutoFilling({ done: i + 1, total: emptyLines.length })
    }
    setAutoFilling(null)
    if (scoped) setSelectedLineIds(new Set())
  }, [project.lines, toggles, apiKeys, updateProject, selectedLineIds])

  const undo = useCallback(() => {
    if (past.length === 0) return
    const previous = past[past.length - 1]
    setPast(past.slice(0, -1))
    setFuture((f) => [...f, project].slice(-MAX_HISTORY))
    setProject(previous)
  }, [past, project])

  const redo = useCallback(() => {
    if (future.length === 0) return
    const next = future[future.length - 1]
    setFuture(future.slice(0, -1))
    setPast((p) => [...p, project].slice(-MAX_HISTORY))
    setProject(next)
  }, [future, project])

  // Ctrl+Z / Ctrl+Shift+Z (also Ctrl+Y, the Windows convention) always drive the project-wide
  // undo stack, even while focused in a text field — a controlled React input's own native undo
  // is unreliable anyway, and unlike a plain per-field undo, this one correctly reverts b-roll
  // picks, cuts, caption settings, etc., not just text. Ctrl+X is deliberately left untouched so
  // cutting text in the Script/Cut-tab fields keeps working exactly as normal.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ctrlOrCmd = e.ctrlKey || e.metaKey
      if (!ctrlOrCmd) return
      const key = e.key.toLowerCase()
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [undo, redo])

  const resetHistory = () => {
    setPast([])
    setFuture([])
    if (coalesceTimerRef.current) {
      window.clearTimeout(coalesceTimerRef.current)
      coalesceTimerRef.current = null
    }
    setSelectedLineIds(new Set())
  }

  const switchProject = useCallback((id: string) => {
    if (id === currentProjectIdRef.current) return
    // Flush the outgoing project immediately (not the debounced save) so switching tabs right
    // after an edit can never lose it.
    saveProjectData(currentProjectIdRef.current, projectRef.current)
    saveCurrentProjectId(id)
    setCurrentProjectId(id)
    setProject(loadProjectData(id))
    resetHistory()
  }, [])

  const addProject = useCallback(() => {
    saveProjectData(currentProjectIdRef.current, projectRef.current)
    const meta = createProjectEntry(`Project ${projects.length + 1}`)
    setProjects((list) => [...list, meta])
    saveCurrentProjectId(meta.id)
    setCurrentProjectId(meta.id)
    setProject(loadProjectData(meta.id))
    resetHistory()
    setActiveTab('record')
  }, [projects.length])

  const renameProject = useCallback((id: string, name: string) => {
    setProjects(renameProjectEntry(id, name))
  }, [])

  const deleteProject = useCallback((id: string) => {
    if (!window.confirm('Delete this project? This cannot be undone.')) return
    const remaining = deleteProjectEntry(id)
    setProjects(remaining)
    if (id === currentProjectIdRef.current) {
      const next = remaining[0]
      saveCurrentProjectId(next.id)
      setCurrentProjectId(next.id)
      setProject(loadProjectData(next.id))
      resetHistory()
    }
  }, [])

  return (
    <div className="broll-app">
      <header className="broll-header">
        <div className="broll-header__title">
          <span className="broll-header__logo">BRollEditor</span>
          <span className="broll-header__subtitle">Narration → b-roll → MP4</span>
        </div>
        <nav className="broll-header__nav">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`broll-header__nav-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <div className="broll-header__actions">
          <button type="button" className="broll-header__icon-btn" onClick={undo} disabled={past.length === 0} title="Undo (Ctrl+Z)" aria-label="Undo">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <polyline points="9 14 4 9 9 4" />
              <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
            </svg>
          </button>
          <button type="button" className="broll-header__icon-btn" onClick={redo} disabled={future.length === 0} title="Redo (Ctrl+Shift+Z)" aria-label="Redo">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <polyline points="15 14 20 9 15 4" />
              <path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
            </svg>
          </button>
          <button type="button" className="broll-header__icon-btn" onClick={() => setSettingsOpen(true)} title="Settings (API keys)" aria-label="Settings">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
          <ThemeToggle theme={theme} onToggle={(t: string) => setTheme(t)} className="broll-header__icon-btn" />
        </div>
      </header>

      <div className="broll-tabrow">
        <TabBar
          tabs={projects}
          currentTabId={currentProjectId}
          onSwitchTab={switchProject}
          onAddTab={addProject}
          onRenameTab={renameProject}
          onDeleteTab={deleteProject}
          defaultTabName="Project"
          addTitle="New project"
        />

        <div className="broll-global-toolbar">
          <button
            type="button"
            className="broll-global-toolbar__btn"
            onClick={handleAutoFill}
            disabled={!!autoFilling || !project.lines.some((l) => !l.broll && l.text.trim() && (selectedLineIds.size <= 1 || selectedLineIds.has(l.id)))}
            title={selectedLineIds.size > 1 ? `Search and assign b-roll for the ${selectedLineIds.size} selected scenes that don't have one yet` : "Search and assign b-roll automatically for every line that doesn't have one yet"}
          >
            {autoFilling
              ? `Filling ${autoFilling.done}/${autoFilling.total}…`
              : selectedLineIds.size > 1 ? `Auto-fill ${selectedLineIds.size} selected` : 'Auto-fill b-roll'}
          </button>
          <button
            type="button"
            className={`broll-global-toolbar__btn ${project.music.url ? 'active' : ''}`}
            onClick={() => setMusicOpen(true)}
          >
            Music
          </button>
          <button
            type="button"
            className={`broll-global-toolbar__btn ${project.captions.enabled ? 'active' : ''}`}
            onClick={() => setCaptionsOpen(true)}
          >
            Captions
          </button>
          <button
            type="button"
            className={`broll-global-toolbar__btn ${project.studioSound ? 'active' : ''}`}
            onClick={() => updateProject((p) => ({ ...p, studioSound: !p.studioSound }))}
            title="Clean up and normalize the narration's loudness on export."
          >
            Studio Sound
          </button>
        </div>
      </div>

      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} onSave={() => setApiKeys(loadApiKeys())} />

      <CaptionsPanel
        isOpen={captionsOpen}
        onClose={() => setCaptionsOpen(false)}
        captions={project.captions}
        onChange={(next) => updateProject((p) => ({ ...p, captions: next }))}
        brandColor={project.brandColor || '#3b82f6'}
        onApplyPreset={handleApplyPreset}
      />

      <MusicPanel
        isOpen={musicOpen}
        onClose={() => setMusicOpen(false)}
        music={project.music}
        onChange={handleMusicChange}
      />

      <main className="broll-main">
        <ErrorBoundary key={`${activeTab}-${currentProjectId}`}>
          {activeTab === 'record' && (
            <RecordTab
              project={project}
              onProjectChange={updateProject}
              openaiKey={apiKeys.openai}
              onDone={() => setActiveTab('cut')}
            />
          )}
          {activeTab === 'cut' && (
            <CutTab project={project} onProjectChange={updateProject} />
          )}
          {activeTab === 'edit' && (
            <EditTab
              project={project}
              onProjectChange={updateProject}
              apiKeys={apiKeys}
              toggles={toggles}
              onTogglesChange={handleTogglesChange}
              selectedLineIds={selectedLineIds}
              onToggleLineSelection={handleToggleLineSelection}
            />
          )}
          {activeTab === 'export' && (
            <ExportTab project={project} onProjectChange={updateProject} />
          )}
        </ErrorBoundary>
      </main>
    </div>
  )
}
