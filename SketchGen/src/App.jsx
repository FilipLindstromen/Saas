import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import TopBar from './components/TopBar'
import CanvasBoard from './components/CanvasBoard'
import ToolRail from './components/ToolRail'
import OptionsBar from './components/OptionsBar'
import StyleGrid from './components/StyleGrid'
import PromptBar from './components/PromptBar'
import ResultView from './components/ResultView'
import ImportPanel from './components/ImportPanel'
import HistoryGallery from './components/HistoryGallery'
import LayersPanel from './components/LayersPanel'
import ImageContextMenu from './components/ImageContextMenu'
import SettingsModal from '@shared/SettingsModal/SettingsModal'
import TabBar from '@shared/TabBar/TabBar'
import { getTheme, setTheme as persistTheme, initThemeSync } from '@shared/theme'
import { STYLES, DEFAULT_STYLE_ID } from './constants/styles'
import { generateStyledImage } from './api/generate'
import {
  kvGet, kvSet, kvDelete,
  addGeneration, getAllGenerations, deleteGeneration, deleteGenerationsForDrawing, pruneGenerations,
  addStyleReference, getAllStyleReferences, deleteStyleReference,
} from './utils/db'
import { loadCustomStyles, addCustomStyle, deleteCustomStyle } from './utils/customStyles'
import { copyImageToClipboard } from './utils/clipboard'
import { loadAppSettings, saveAppSettings } from './utils/appSettings'
import {
  DEFAULT_SKETCH_FORMAT_ID,
  normalizeSketchFormatId,
  SKETCH_FORMATS,
} from './utils/canvasFormat'
import {
  generateProjectId, drawingKeyFor,
  loadProjects, saveProjects,
  loadCurrentProjectId, saveCurrentProjectId,
  loadCurrentTabId, saveCurrentTabId,
  getProjectTabs, addProjectTab, removeProjectTab, renameProjectTab,
  deleteProjectStorage,
} from './utils/projectStorage'
import './App.css'

const AUTOSAVE_DEBOUNCE_MS = 800

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function loadImageElement(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

/** Ensures a project has at least one drawing tab and a valid "current tab" pointer; returns the resolved state. */
function ensureProjectTabs(projectId) {
  let tabs = getProjectTabs(projectId)
  if (!tabs.length) {
    const tabId = addProjectTab(projectId, 'Drawing 1')
    tabs = getProjectTabs(projectId)
    saveCurrentTabId(projectId, tabId)
  }
  let tabId = loadCurrentTabId(projectId)
  if (!tabs.some((t) => t.id === tabId)) {
    tabId = tabs[0].id
    saveCurrentTabId(projectId, tabId)
  }
  return { tabs, tabId }
}

export default function App() {
  const canvasRef = useRef(null)
  const autosaveTimerRef = useRef(null)
  const drawingKeyRef = useRef(null)

  const [savedSettings] = useState(() => loadAppSettings())

  const [theme, setThemeState] = useState(getTheme())
  const [tool, setTool] = useState(savedSettings.tool)
  const [color, setColor] = useState(savedSettings.color)
  const [penSize, setPenSize] = useState(savedSettings.penSize)
  const [eraserSize, setEraserSize] = useState(savedSettings.eraserSize)
  const brushSize = tool === 'eraser' ? eraserSize : penSize
  const handleBrushSizeChange = useCallback((next) => {
    if (tool === 'eraser') setEraserSize(next)
    else setPenSize(next)
  }, [tool])
  const [smoothing, setSmoothing] = useState(savedSettings.smoothing)
  const [wobble, setWobble] = useState(savedSettings.wobble)
  const [zoom, setZoom] = useState(1)
  const [canvasFormat, setCanvasFormat] = useState(DEFAULT_SKETCH_FORMAT_ID)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  const [customStyles, setCustomStyles] = useState(() => loadCustomStyles())
  const [imageStyles, setImageStyles] = useState([])
  const allStyles = useMemo(() => [...STYLES, ...customStyles, ...imageStyles], [customStyles, imageStyles])
  const [selectedStyleId, setSelectedStyleId] = useState(savedSettings.selectedStyleId || DEFAULT_STYLE_ID)
  const [instructions, setInstructions] = useState(savedSettings.instructions)
  const [variations, setVariations] = useState(savedSettings.variations)

  const [view, setView] = useState('sketch')
  const [sketchSnapshot, setSketchSnapshot] = useState(null)
  const [generatedImage, setGeneratedImage] = useState(null)
  const [activeGenerationId, setActiveGenerationId] = useState(null)
  const [generationHistory, setGenerationHistory] = useState([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [placing, setPlacing] = useState(null)
  const [layers, setLayers] = useState([])
  const [activeLayerId, setActiveLayerId] = useState(null)
  const [imageContextMenu, setImageContextMenu] = useState(null)

  const [projects, setProjects] = useState([])
  const [currentProjectId, setCurrentProjectId] = useState(null)
  const [tabs, setTabs] = useState([])
  const [currentTabId, setCurrentTabId] = useState(null)
  const [hasHydrated, setHasHydrated] = useState(false)

  useEffect(() => {
    drawingKeyRef.current = currentProjectId && currentTabId ? drawingKeyFor(currentProjectId, currentTabId) : null
  }, [currentProjectId, currentTabId])

  /** Loads one drawing's canvas + generation history into the (already-switched) view. */
  const loadDrawing = useCallback(async (projectId, tabId) => {
    const key = drawingKeyFor(projectId, tabId)
    try {
      const snapshot = await kvGet(`canvas:${key}`)
      const format = normalizeSketchFormatId(snapshot?.formatId)
      setCanvasFormat(format)
      if (snapshot?.layers?.length) await canvasRef.current?.restoreLayers({ ...snapshot, formatId: format })
      else canvasRef.current?.resetBlank(format)
    } catch {
      canvasRef.current?.resetBlank()
    }
    try {
      setGenerationHistory(await getAllGenerations(key))
    } catch {
      setGenerationHistory([])
    }
    setGeneratedImage(null)
    setSketchSnapshot(null)
    setActiveGenerationId(null)
    setView('sketch')
  }, [])

  const flushAutosave = useCallback(async () => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current)
      autosaveTimerRef.current = null
    }
    const board = canvasRef.current
    const key = drawingKeyRef.current
    if (!board || !key) return
    try {
      await kvSet(`canvas:${key}`, board.exportLayers())
    } catch {
      // ignore — best-effort flush
    }
  }, [])

  // Hydrate projects/tabs, then this drawing's canvas + generation history, on mount.
  useEffect(() => {
    (async () => {
      let projectList = loadProjects()
      if (!projectList.length) {
        const id = generateProjectId()
        projectList = [{ id, name: 'Untitled', updatedAt: Date.now() }]
        saveProjects(projectList)
        saveCurrentProjectId(id)
      }
      let curProjectId = loadCurrentProjectId()
      if (!projectList.some((p) => p.id === curProjectId)) {
        curProjectId = projectList[0].id
        saveCurrentProjectId(curProjectId)
      }

      const { tabs: curTabs, tabId: curTabId } = ensureProjectTabs(curProjectId)

      setProjects(projectList)
      setCurrentProjectId(curProjectId)
      setTabs(curTabs)
      setCurrentTabId(curTabId)

      await loadDrawing(curProjectId, curTabId)

      try {
        setImageStyles(await getAllStyleReferences())
      } catch {
        // ignore
      }

      setHasHydrated(true)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const cleanup = initThemeSync()
    const handler = (e) => setThemeState(e.detail)
    window.addEventListener('saas-theme-change', handler)
    return () => {
      cleanup?.()
      window.removeEventListener('saas-theme-change', handler)
    }
  }, [])

  // Persist tool settings, style selection, instructions, and variation count
  // so they survive a page reload — debounced since size/smoothing/wobble
  // sliders and the instructions textarea can fire on every pixel/keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      saveAppSettings({ tool, color, penSize, eraserSize, smoothing, wobble, selectedStyleId, instructions, variations })
    }, 300)
    return () => clearTimeout(timer)
  }, [tool, color, penSize, eraserSize, smoothing, wobble, selectedStyleId, instructions, variations])

  // A persisted selectedStyleId might reference a custom/image style that was
  // deleted in a previous session — fall back once the real style list loads.
  useEffect(() => {
    if (allStyles.length && !allStyles.some((s) => s.id === selectedStyleId)) {
      setSelectedStyleId(DEFAULT_STYLE_ID)
    }
  }, [allStyles, selectedStyleId])

  const handleToggleTheme = useCallback((next) => {
    persistTheme(next)
    setThemeState(next)
  }, [])

  const handleUndo = useCallback(() => canvasRef.current?.undo(), [])
  const handleRedo = useCallback(() => canvasRef.current?.redo(), [])
  const handleClear = useCallback(() => canvasRef.current?.clear(), [])

  const scheduleAutosave = useCallback(() => {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
    autosaveTimerRef.current = setTimeout(() => {
      const board = canvasRef.current
      const key = drawingKeyRef.current
      if (!board || !key) return
      kvSet(`canvas:${key}`, board.exportLayers()).catch(() => {})
    }, AUTOSAVE_DEBOUNCE_MS)
  }, [])

  // Best-effort flush when the tab/window is being closed or hidden, on top of the debounce above.
  useEffect(() => {
    const flushSync = () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
      const board = canvasRef.current
      const key = drawingKeyRef.current
      if (board && key) kvSet(`canvas:${key}`, board.exportLayers()).catch(() => {})
    }
    const onVisibilityChange = () => {
      if (document.hidden) flushSync()
    }
    window.addEventListener('beforeunload', flushSync)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.removeEventListener('beforeunload', flushSync)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && placing) {
        setPlacing(null)
        return
      }
      if (!(e.ctrlKey || e.metaKey)) return
      if (e.key.toLowerCase() !== 'z') return
      e.preventDefault()
      if (e.shiftKey) handleRedo()
      else handleUndo()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleUndo, handleRedo, placing])

  const loadImageOntoCanvas = useCallback(async (dataUrl) => {
    setError('')
    try {
      await canvasRef.current?.loadImage(dataUrl)
      setView('sketch')
    } catch {
      setError('Could not load that image.')
    }
  }, [])

  const handleImportFile = useCallback(async (file) => {
    const dataUrl = await readFileAsDataUrl(file)
    loadImageOntoCanvas(dataUrl)
  }, [loadImageOntoCanvas])

  const handleUseAsSketch = useCallback(() => {
    if (!generatedImage) return
    loadImageOntoCanvas(generatedImage)
  }, [generatedImage, loadImageOntoCanvas])

  // Paste an image from the OS clipboard (e.g. a screenshot, or an image copied
  // from another app or browser tab) straight onto the canvas. Skipped while an
  // editable field is focused so normal text pasting still works everywhere else.
  useEffect(() => {
    const onPaste = (e) => {
      const target = e.target
      const isEditable = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable
      if (isEditable) return
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault()
          const file = item.getAsFile()
          if (file) handleImportFile(file)
          break
        }
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [handleImportFile])

  const handleImageContextMenu = useCallback((e, dataUrl) => {
    e.preventDefault()
    setImageContextMenu({ x: e.clientX, y: e.clientY, dataUrl })
  }, [])

  const handleCopyImageFromMenu = useCallback(async () => {
    const dataUrl = imageContextMenu?.dataUrl
    setImageContextMenu(null)
    if (!dataUrl) return
    try {
      await copyImageToClipboard(dataUrl)
    } catch {
      setError('Could not copy image to clipboard.')
    }
  }, [imageContextMenu])

  const handleDownloadImageFromMenu = useCallback(() => {
    const dataUrl = imageContextMenu?.dataUrl
    setImageContextMenu(null)
    if (!dataUrl) return
    const link = document.createElement('a')
    link.href = dataUrl
    link.download = 'sketchgen-result.png'
    link.click()
  }, [imageContextMenu])

  const handleStartPlacing = useCallback(async ({ url, maxDim, label }) => {
    setError('')
    try {
      const img = await loadImageElement(url)
      setPlacing({ img, maxDim, label })
    } catch {
      setError('Could not load that image to place it.')
    }
  }, [])

  const handlePlaced = useCallback(() => {
    setPlacing(null)
  }, [])

  const handleLayersChange = useCallback(({ layers: nextLayers, activeLayerId: nextActiveId }) => {
    setLayers(nextLayers)
    setActiveLayerId(nextActiveId)
  }, [])

  const handleAddLayer = useCallback(() => canvasRef.current?.addLayer(), [])
  const handleRemoveLayer = useCallback((id) => canvasRef.current?.removeLayer(id), [])
  const handleToggleLayerVisibility = useCallback((id) => canvasRef.current?.toggleLayerVisibility(id), [])
  const handleSelectLayer = useCallback((id) => canvasRef.current?.setActiveLayer(id), [])

  const handleAddCustomStyle = useCallback(({ name, prompt }) => {
    const next = addCustomStyle({ name, prompt })
    setCustomStyles(next)
  }, [])

  const handleDeleteCustomStyle = useCallback((id) => {
    const next = deleteCustomStyle(id)
    setCustomStyles(next)
    if (selectedStyleId === id) setSelectedStyleId(DEFAULT_STYLE_ID)
  }, [selectedStyleId])

  const handleUploadImageStyle = useCallback(async (file) => {
    setError('')
    try {
      const dataUrl = await readFileAsDataUrl(file)
      const entry = {
        id: `imgstyle-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'image',
        name: file.name.replace(/\.[^.]+$/, '') || 'Style reference',
        referenceImageDataUrl: dataUrl,
        thumbnailDataUrl: dataUrl,
        createdAt: Date.now(),
      }
      await addStyleReference(entry)
      setImageStyles((prev) => [...prev, entry])
    } catch {
      setError('Could not upload that image as a style reference.')
    }
  }, [])

  const handleDeleteImageStyle = useCallback(async (id) => {
    await deleteStyleReference(id)
    setImageStyles((prev) => prev.filter((s) => s.id !== id))
    if (selectedStyleId === id) setSelectedStyleId(DEFAULT_STYLE_ID)
  }, [selectedStyleId])

  const refreshHistory = useCallback(async () => {
    const key = drawingKeyRef.current
    if (!key) return
    setGenerationHistory(await getAllGenerations(key))
  }, [])

  const handleSelectHistoryEntry = useCallback((entry) => {
    setSketchSnapshot(entry.sketchDataUrl)
    setGeneratedImage(entry.dataUrl)
    setActiveGenerationId(entry.id)
    setView((v) => (v === 'sketch' ? 'generated' : v))
  }, [])

  const handleDeleteHistoryEntry = useCallback(async (id) => {
    await deleteGeneration(id)
    const key = drawingKeyRef.current
    const history = await getAllGenerations(key)
    setGenerationHistory(history)
    if (id === activeGenerationId) {
      if (history.length) {
        setGeneratedImage(history[0].dataUrl)
        setSketchSnapshot(history[0].sketchDataUrl)
        setActiveGenerationId(history[0].id)
      } else {
        setGeneratedImage(null)
        setActiveGenerationId(null)
        setView('sketch')
      }
    }
  }, [activeGenerationId])

  const handleGenerate = useCallback(async () => {
    setError('')
    const board = canvasRef.current
    const key = drawingKeyRef.current
    if (!board?.hasContent?.()) {
      setError('Draw something on the canvas first.')
      return
    }
    const style = allStyles.find((s) => s.id === selectedStyleId) || allStyles[0]
    const sketchDataUrl = board.exportPNG()
    setIsGenerating(true)
    try {
      const results = await Promise.all(
        Array.from({ length: variations }, () =>
          generateStyledImage({ sketchDataUrl, style, instructions, formatId: canvasFormat })
        )
      )
      const batchId = `batch-${Date.now()}`
      const createdAt = Date.now()
      const entries = results.map((dataUrl, i) => ({
        id: `${batchId}-${i}`,
        batchId,
        drawingKey: key,
        createdAt: createdAt + i,
        dataUrl,
        sketchDataUrl,
        styleId: style.id,
        styleName: style.name,
        instructions,
      }))
      for (const entry of entries) {
        // eslint-disable-next-line no-await-in-loop
        await addGeneration(entry)
      }
      await pruneGenerations(key)
      await refreshHistory()
      setSketchSnapshot(sketchDataUrl)
      setGeneratedImage(entries[0].dataUrl)
      setActiveGenerationId(entries[0].id)
      setView('generated')
    } catch (err) {
      setError(err.message || 'Generation failed. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }, [allStyles, selectedStyleId, instructions, variations, refreshHistory, canvasFormat])

  const handleDownload = useCallback(() => {
    if (!generatedImage) return
    const link = document.createElement('a')
    link.href = generatedImage
    link.download = 'sketchgen-result.png'
    link.click()
  }, [generatedImage])

  // --- Projects ---

  const switchProject = useCallback(async (projectId) => {
    if (projectId === currentProjectId) return
    await flushAutosave()
    saveCurrentProjectId(projectId)
    const { tabs: nextTabs, tabId } = ensureProjectTabs(projectId)
    setCurrentProjectId(projectId)
    setTabs(nextTabs)
    setCurrentTabId(tabId)
    await loadDrawing(projectId, tabId)
  }, [currentProjectId, flushAutosave, loadDrawing])

  const createProject = useCallback(async () => {
    await flushAutosave()
    const id = generateProjectId()
    const nextProjects = [...projects, { id, name: 'Untitled', updatedAt: Date.now() }]
    saveProjects(nextProjects)
    saveCurrentProjectId(id)
    const tabId = addProjectTab(id, 'Drawing 1')
    saveCurrentTabId(id, tabId)
    setProjects(nextProjects)
    setCurrentProjectId(id)
    setTabs(getProjectTabs(id))
    setCurrentTabId(tabId)
    await loadDrawing(id, tabId)
  }, [projects, flushAutosave, loadDrawing])

  const renameProject = useCallback((id, name) => {
    const next = projects.map((p) => (p.id === id ? { ...p, name, updatedAt: Date.now() } : p))
    saveProjects(next)
    setProjects(next)
  }, [projects])

  const deleteProject = useCallback(async (id) => {
    if (projects.length <= 1) return
    const wasCurrentProject = id === currentProjectId

    const projectTabs = getProjectTabs(id)
    for (const t of projectTabs) {
      const key = drawingKeyFor(id, t.id)
      // eslint-disable-next-line no-await-in-loop
      await kvDelete(`canvas:${key}`).catch(() => {})
      // eslint-disable-next-line no-await-in-loop
      await deleteGenerationsForDrawing(key).catch(() => {})
    }
    deleteProjectStorage(id)

    const idx = projects.findIndex((p) => p.id === id)
    const next = projects.filter((p) => p.id !== id)
    saveProjects(next)
    setProjects(next)

    if (wasCurrentProject) {
      const fallback = next[Math.max(0, idx - 1)] || next[0]
      saveCurrentProjectId(fallback.id)
      const { tabs: fallbackTabs, tabId } = ensureProjectTabs(fallback.id)
      setCurrentProjectId(fallback.id)
      setTabs(fallbackTabs)
      setCurrentTabId(tabId)
      await loadDrawing(fallback.id, tabId)
    }
  }, [projects, currentProjectId, loadDrawing])

  // --- Drawings (tabs within the current project) ---

  const switchTab = useCallback(async (tabId) => {
    if (tabId === currentTabId) return
    await flushAutosave()
    saveCurrentTabId(currentProjectId, tabId)
    setCurrentTabId(tabId)
    await loadDrawing(currentProjectId, tabId)
  }, [currentTabId, currentProjectId, flushAutosave, loadDrawing])

  const addTab = useCallback(async () => {
    await flushAutosave()
    const name = `Drawing ${tabs.length + 1}`
    const tabId = addProjectTab(currentProjectId, name)
    const nextTabs = getProjectTabs(currentProjectId)
    saveCurrentTabId(currentProjectId, tabId)
    setTabs(nextTabs)
    setCurrentTabId(tabId)
    await loadDrawing(currentProjectId, tabId)
  }, [currentProjectId, tabs.length, flushAutosave, loadDrawing])

  const renameTab = useCallback((tabId, name) => {
    renameProjectTab(currentProjectId, tabId, name)
    setTabs(getProjectTabs(currentProjectId))
  }, [currentProjectId])

  const deleteTab = useCallback(async (tabId) => {
    if (tabs.length <= 1) return
    const wasCurrentTab = tabId === currentTabId
    const key = drawingKeyFor(currentProjectId, tabId)
    await kvDelete(`canvas:${key}`).catch(() => {})
    await deleteGenerationsForDrawing(key).catch(() => {})

    const fallbackTabId = removeProjectTab(currentProjectId, tabId)
    setTabs(getProjectTabs(currentProjectId))

    if (wasCurrentTab && fallbackTabId) {
      saveCurrentTabId(currentProjectId, fallbackTabId)
      setCurrentTabId(fallbackTabId)
      await loadDrawing(currentProjectId, fallbackTabId)
    }
  }, [tabs.length, currentTabId, currentProjectId, loadDrawing])

  const currentProjectName = projects.find((p) => p.id === currentProjectId)?.name

  return (
    <div className="app">
      <TopBar
        view={view}
        onViewChange={setView}
        hasGenerated={Boolean(generatedImage)}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onOpenSettings={() => setSettingsOpen(true)}
        onDownload={handleDownload}
        projects={projects}
        currentProjectId={currentProjectId}
        currentProjectName={currentProjectName}
        onSwitchProject={switchProject}
        onCreateProject={createProject}
        onRenameProject={renameProject}
        onDeleteProject={deleteProject}
      />

      <TabBar
        tabs={tabs}
        currentTabId={currentTabId}
        onSwitchTab={switchTab}
        onAddTab={addTab}
        onRenameTab={renameTab}
        onDeleteTab={deleteTab}
        disabled={!hasHydrated}
        defaultTabName="Drawing"
        addTitle="Add drawing"
      />

      {error && (
        <div className="app-error-banner">
          <span>{error}</span>
          <button type="button" onClick={() => setError('')} aria-label="Dismiss">×</button>
        </div>
      )}

      {view === 'sketch' && (
        <OptionsBar
          tool={tool}
          color={color}
          onColorChange={setColor}
          size={brushSize}
          onSizeChange={handleBrushSizeChange}
          smoothing={smoothing}
          onSmoothingChange={setSmoothing}
          wobble={wobble}
          onWobbleChange={setWobble}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onClear={handleClear}
          canUndo={canUndo}
          canRedo={canRedo}
          zoom={zoom}
          onZoomChange={setZoom}
          onImportFile={handleImportFile}
          canvasFormat={canvasFormat}
          onCanvasFormatChange={(id) => {
            setCanvasFormat(id)
            scheduleAutosave()
          }}
        />
      )}

      <div className="app-body">
        {view === 'sketch' && <ToolRail tool={tool} onToolChange={setTool} />}

        <main className="app-main">
          <div className="app-canvas-area" style={{ display: view === 'sketch' ? 'flex' : 'none', flex: 1, minHeight: 0 }}>
            <CanvasBoard
              ref={canvasRef}
              tool={tool}
              color={color}
              size={brushSize}
              smoothing={smoothing}
              wobble={wobble}
              zoom={zoom}
              formatId={canvasFormat}
              placing={placing}
              onPlaced={handlePlaced}
              onDropFile={handleImportFile}
              onHistoryChange={({ canUndo: cu, canRedo: cr }) => {
                setCanUndo(cu)
                setCanRedo(cr)
              }}
              onLayersChange={handleLayersChange}
              onCommit={scheduleAutosave}
            />
          </div>

          {view !== 'sketch' && generatedImage && (
            <ResultView
              view={view}
              sketchDataUrl={sketchSnapshot}
              generatedDataUrl={generatedImage}
              onUseAsSketch={handleUseAsSketch}
              onImageContextMenu={handleImageContextMenu}
            />
          )}
        </main>

        <aside className="app-sidebar">
          {view === 'sketch' && (
            <LayersPanel
              layers={layers}
              activeLayerId={activeLayerId}
              onSelect={handleSelectLayer}
              onToggleVisibility={handleToggleLayerVisibility}
              onAdd={handleAddLayer}
              onRemove={handleRemoveLayer}
            />
          )}
          {view === 'sketch' && tool === 'stamp' && (
            <ImportPanel
              penColor={color}
              placing={placing}
              onStartPlacing={handleStartPlacing}
              onCancelPlacing={() => setPlacing(null)}
            />
          )}
          <StyleGrid
            styles={allStyles}
            selectedId={selectedStyleId}
            onSelect={setSelectedStyleId}
            onAddCustomStyle={handleAddCustomStyle}
            onDeleteCustomStyle={handleDeleteCustomStyle}
            onUploadImageStyle={handleUploadImageStyle}
            onDeleteImageStyle={handleDeleteImageStyle}
          />
          <PromptBar
            value={instructions}
            onChange={setInstructions}
            onGenerate={handleGenerate}
            isGenerating={isGenerating}
            error={null}
            variations={variations}
            onVariationsChange={setVariations}
          />
          <HistoryGallery
            items={generationHistory}
            activeId={activeGenerationId}
            onSelect={handleSelectHistoryEntry}
            onDelete={handleDeleteHistoryEntry}
          />
        </aside>
      </div>

      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {imageContextMenu && (
        <ImageContextMenu
          x={imageContextMenu.x}
          y={imageContextMenu.y}
          onCopy={handleCopyImageFromMenu}
          onDownload={handleDownloadImageFromMenu}
          onClose={() => setImageContextMenu(null)}
        />
      )}
    </div>
  )
}
