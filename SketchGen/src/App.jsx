import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import TopBar from './components/TopBar'
import CanvasBoard from './components/CanvasBoard'
import ToolRail from './components/ToolRail'
import OptionsBar from './components/OptionsBar'
import StyleGrid from './components/StyleGrid'
import PromptBar from './components/PromptBar'
import GenerationProgress from './components/GenerationProgress'
import GenerationQueue from './components/GenerationQueue'
import ResultView from './components/ResultView'
import ImportPanel from './components/ImportPanel'
import HistoryGallery from './components/HistoryGallery'
import LayersPanel from './components/LayersPanel'
import ImageContextMenu from './components/ImageContextMenu'
import SettingsModal from '@shared/SettingsModal/SettingsModal'
import BrandingSettings from './components/BrandingSettings'
import { normalizeBrandColors, normalizeBrandFonts, normalizeHexColor, DEFAULT_BRAND_COLORS } from './constants/brand'
import TabBar from '@shared/TabBar/TabBar'
import { getTheme, setTheme as persistTheme, initThemeSync } from '@shared/theme'
import { STYLES, DEFAULT_STYLE_ID } from './constants/styles'
import { generateStyledImage } from './api/generate'
import { classifyGenerationError } from './utils/generationCost'
import {
  kvGet, kvSet, kvDelete,
  addGeneration, getAllGenerations, deleteGeneration, deleteGenerationsForDrawing, pruneGenerations,
  addStyleReference, getAllStyleReferences, deleteStyleReference,
} from './utils/db'
import { loadCustomStyles, addCustomStyle, deleteCustomStyle } from './utils/customStyles'
import { exportGeneratedImage } from './utils/imageExport'
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
  const [zoom, setZoom] = useState(savedSettings.zoom)
  const [canvasFormat, setCanvasFormat] = useState(() => normalizeSketchFormatId(savedSettings.canvasFormat))
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  const [customStyles, setCustomStyles] = useState(() => loadCustomStyles())
  const [imageStyles, setImageStyles] = useState([])
  const allStyles = useMemo(() => [...STYLES, ...customStyles, ...imageStyles], [customStyles, imageStyles])
  const [selectedStyleId, setSelectedStyleId] = useState(savedSettings.selectedStyleId || DEFAULT_STYLE_ID)
  const [instructions, setInstructions] = useState(savedSettings.instructions)
  const [variations, setVariations] = useState(savedSettings.variations)
  const [styleSectionCollapsed, setStyleSectionCollapsed] = useState(savedSettings.styleSectionCollapsed)
  const [improveGeneration, setImproveGeneration] = useState(savedSettings.improveGeneration)
  const [brandColors, setBrandColors] = useState(() => normalizeBrandColors(savedSettings.brandColors))
  const [brandFonts, setBrandFonts] = useState(() => normalizeBrandFonts(savedSettings.brandFonts))
  const [useBrandColorsInGeneration, setUseBrandColorsInGeneration] = useState(savedSettings.useBrandColorsInGeneration)
  const [textFontFamily, setTextFontFamily] = useState(savedSettings.textFontFamily)
  const [textFontSize, setTextFontSize] = useState(savedSettings.textFontSize)
  const [textFontBold, setTextFontBold] = useState(savedSettings.textFontBold)
  const [arrowStyleId, setArrowStyleId] = useState(savedSettings.arrowStyleId)
  const [penSnapHV, setPenSnapHV] = useState(savedSettings.penSnapHV)
  const [generationQuality, setGenerationQuality] = useState(savedSettings.generationQuality)
  const [addGenerationsAsLayers, setAddGenerationsAsLayers] = useState(savedSettings.addGenerationsAsLayers)
  const [canvasBackgroundColor, setCanvasBackgroundColor] = useState(() =>
    normalizeHexColor(savedSettings.canvasBackgroundColor, DEFAULT_BRAND_COLORS.bg)
  )
  const [brandingDraft, setBrandingDraft] = useState(null)

  const [view, setView] = useState('sketch')
  const [sketchSnapshot, setSketchSnapshot] = useState(null)
  const [generatedImage, setGeneratedImage] = useState(null)
  const [activeGenerationId, setActiveGenerationId] = useState(null)
  const [generationHistory, setGenerationHistory] = useState([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationProgress, setGenerationProgress] = useState(null)
  const [genQueue, setGenQueue] = useState([])
  const [generationErrorDetail, setGenerationErrorDetail] = useState(null)
  const genAbortRef = useRef(new Map())
  const lastGenBatchRef = useRef(null)
  const canceledJobsRef = useRef(new Set())
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

  const persistedSettingsRef = useRef(null)
  persistedSettingsRef.current = {
    tool,
    color,
    penSize,
    eraserSize,
    smoothing,
    wobble,
    zoom,
    canvasFormat,
    selectedStyleId,
    instructions,
    variations,
    styleSectionCollapsed,
    improveGeneration,
    brandColors,
    brandFonts,
    useBrandColorsInGeneration,
    textFontFamily,
    textFontSize,
    textFontBold,
    arrowStyleId,
    penSnapHV,
    generationQuality,
    addGenerationsAsLayers,
    canvasBackgroundColor,
  }

  const flushAppSettings = useCallback(() => {
    if (persistedSettingsRef.current) saveAppSettings(persistedSettingsRef.current)
  }, [])

  useEffect(() => {
    drawingKeyRef.current = currentProjectId && currentTabId ? drawingKeyFor(currentProjectId, currentTabId) : null
  }, [currentProjectId, currentTabId])

  useEffect(() => {
    if (!generatedImage && improveGeneration) setImproveGeneration(false)
  }, [generatedImage, improveGeneration])

  /** Loads one drawing's canvas + generation history into the (already-switched) view. */
  const loadDrawing = useCallback(async (projectId, tabId) => {
    const key = drawingKeyFor(projectId, tabId)
    const settingsFallback = loadAppSettings()
    try {
      const snapshot = await kvGet(`canvas:${key}`)
      const format = snapshot?.formatId != null
        ? normalizeSketchFormatId(snapshot.formatId)
        : normalizeSketchFormatId(settingsFallback.canvasFormat)
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

  // Persist tool settings across reloads — debounced for sliders/text; flushed on hide/unload.
  useEffect(() => {
    const timer = setTimeout(() => {
      flushAppSettings()
    }, 300)
    return () => {
      clearTimeout(timer)
      flushAppSettings()
    }
  }, [tool, color, penSize, eraserSize, smoothing, wobble, zoom, canvasFormat, selectedStyleId, instructions, variations, styleSectionCollapsed, improveGeneration, brandColors, brandFonts, useBrandColorsInGeneration, textFontFamily, textFontSize, textFontBold, arrowStyleId, penSnapHV, generationQuality, addGenerationsAsLayers, canvasBackgroundColor, flushAppSettings])

  useEffect(() => {
    const onPageHide = () => flushAppSettings()
    window.addEventListener('pagehide', onPageHide)
    window.addEventListener('beforeunload', onPageHide)
    return () => {
      window.removeEventListener('pagehide', onPageHide)
      window.removeEventListener('beforeunload', onPageHide)
    }
  }, [flushAppSettings])

  // A persisted selectedStyleId might reference a custom/image style that was
  // deleted in a previous session — fall back once the real style list loads.
  useEffect(() => {
    if (allStyles.length && !allStyles.some((s) => s.id === selectedStyleId)) {
      setSelectedStyleId(DEFAULT_STYLE_ID)
    }
  }, [allStyles, selectedStyleId])

  const handleOpenSettings = useCallback(() => {
    setBrandingDraft({ colors: { ...brandColors }, fonts: { ...brandFonts } })
    setSettingsOpen(true)
  }, [brandColors, brandFonts])

  const handleSaveSettings = useCallback(() => {
    if (brandingDraft) {
      setBrandColors(normalizeBrandColors(brandingDraft.colors))
      setBrandFonts(normalizeBrandFonts(brandingDraft.fonts))
    }
  }, [brandingDraft])

  const handleApplyBrandFont = useCallback((role) => {
    const family = brandFonts[role]
    if (family) setTextFontFamily(family)
  }, [brandFonts])

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

  const setImageAsSketch = useCallback(async (dataUrl) => {
    if (!dataUrl) return
    setError('')
    try {
      await canvasRef.current?.setAsSketch(dataUrl)
      setSketchSnapshot(dataUrl)
      setView('sketch')
      scheduleAutosave()
    } catch {
      setError('Could not set that image as the sketch.')
    }
  }, [scheduleAutosave])

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
    setImageAsSketch(generatedImage)
  }, [generatedImage, setImageAsSketch])

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

  const handleExportImage = useCallback(async (action, dataUrl = generatedImage) => {
    if (!dataUrl) return
    setError('')
    try {
      await exportGeneratedImage(dataUrl, action)
    } catch {
      setError('Export failed. Try again or use a different format.')
    }
  }, [generatedImage])

  const handleExportFromMenu = useCallback(
    async (action) => {
      const dataUrl = imageContextMenu?.dataUrl
      setImageContextMenu(null)
      if (!dataUrl) return
      await handleExportImage(action, dataUrl)
    },
    [imageContextMenu, handleExportImage]
  )

  const handleSetAsSketchFromMenu = useCallback(() => {
    const dataUrl = imageContextMenu?.dataUrl
    setImageContextMenu(null)
    if (dataUrl) setImageAsSketch(dataUrl)
  }, [imageContextMenu, setImageAsSketch])

  const handleAddAsLayerFromMenu = useCallback(async () => {
    const dataUrl = imageContextMenu?.dataUrl
    setImageContextMenu(null)
    if (!dataUrl) return
    try {
      await canvasRef.current?.addLayerFromImage?.(dataUrl, 'Imported image')
      setView('sketch')
    } catch {
      setError('Could not add that image as a layer.')
    }
  }, [imageContextMenu])

  const handleCleanUpSketch = useCallback(() => {
    canvasRef.current?.cleanUpActiveLayer?.()
  }, [])

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
  const handleReorderLayers = useCallback((orderedIdsBottomToTop) => {
    canvasRef.current?.reorderLayers(orderedIdsBottomToTop)
  }, [])

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

  const runGenerationJob = useCallback(async (jobId, { qualityOverride } = {}) => {
    const batch = lastGenBatchRef.current
    if (!batch) return { ok: false }
    const jobMeta = batch.jobs.find((j) => j.id === jobId)
    if (!jobMeta) return { ok: false }

    if (canceledJobsRef.current.has(jobId)) {
      return { ok: false, canceled: true }
    }

    const ac = new AbortController()
    genAbortRef.current.set(jobId, ac)
    setGenQueue((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, status: 'running', error: null } : j))
    )

    const quality = qualityOverride ?? batch.quality

    try {
      const dataUrl = await generateStyledImage({
        sketchDataUrl: batch.sketchDataUrl,
        style: batch.style,
        instructions: batch.instructions,
        formatId: batch.formatId,
        referenceImageDataUrl: batch.referenceImageDataUrl,
        brand: batch.brand,
        useBrandColors: batch.useBrandColors,
        quality,
        signal: ac.signal,
      })

      if (canceledJobsRef.current.has(jobId)) {
        setGenQueue((prev) =>
          prev.map((j) => (j.id === jobId ? { ...j, status: 'canceled' } : j))
        )
        return { ok: false, canceled: true }
      }

      const entry = {
        id: jobId,
        batchId: batch.batchId,
        drawingKey: batch.key,
        createdAt: batch.createdAtBase + jobMeta.index,
        dataUrl,
        sketchDataUrl: batch.sketchDataUrl,
        styleId: batch.style.id,
        styleName: batch.style.name,
        instructions: batch.instructions,
      }
      await addGeneration(entry)
      if (batch.addGenerationsAsLayers) {
        await canvasRef.current?.addLayerFromImage?.(dataUrl, `Generation ${jobMeta.index + 1}`)
      }
      setGenQueue((prev) =>
        prev.map((j) =>
          j.id === jobId ? { ...j, status: 'done', dataUrl, historyId: jobId } : j
        )
      )
      return { ok: true, dataUrl, jobId }
    } catch (err) {
      if (err?.name === 'AbortError' || canceledJobsRef.current.has(jobId)) {
        setGenQueue((prev) =>
          prev.map((j) => (j.id === jobId ? { ...j, status: 'canceled', error: null } : j))
        )
        return { ok: false, canceled: true }
      }
      const msg = err?.message || 'Generation failed.'
      setGenQueue((prev) =>
        prev.map((j) => (j.id === jobId ? { ...j, status: 'error', error: msg } : j))
      )
      return { ok: false, error: err }
    } finally {
      genAbortRef.current.delete(jobId)
    }
  }, [])

  const handleCancelGenerationJob = useCallback((jobId) => {
    canceledJobsRef.current.add(jobId)
    genAbortRef.current.get(jobId)?.abort()
    setGenQueue((prev) =>
      prev.map((j) =>
        j.id === jobId && (j.status === 'queued' || j.status === 'running')
          ? { ...j, status: 'canceled' }
          : j
      )
    )
  }, [])

  const handleRetryGenerationJob = useCallback(
    async (jobId) => {
      canceledJobsRef.current.delete(jobId)
      setError('')
      setGenerationErrorDetail(null)
      setIsGenerating(true)
      const result = await runGenerationJob(jobId)
      await pruneGenerations(drawingKeyRef.current)
      await refreshHistory()
      if (result.ok) {
        setSketchSnapshot(lastGenBatchRef.current?.sketchDataUrl ?? sketchSnapshot)
        setGeneratedImage(result.dataUrl)
        setActiveGenerationId(result.jobId)
        setView('generated')
      } else if (result.error) {
        const classified = classifyGenerationError(result.error)
        setGenerationErrorDetail(classified)
        setError(classified.message)
      }
      setIsGenerating(false)
    },
    [runGenerationJob, refreshHistory, sketchSnapshot]
  )

  const handleUseQueueResult = useCallback((job) => {
    if (!job?.dataUrl) return
    setGeneratedImage(job.dataUrl)
    setActiveGenerationId(job.historyId || job.id)
    const batchSketch = lastGenBatchRef.current?.sketchDataUrl
    if (batchSketch) setSketchSnapshot(batchSketch)
    setView('generated')
  }, [])

  const handleDismissGenerationQueue = useCallback(() => {
    setGenQueue([])
  }, [])

  const handleRetryFailedGenerations = useCallback(
    async (asDraft = false) => {
      const failedIds = genQueue.filter((j) => j.status === 'error').map((j) => j.id)
      if (!failedIds.length) return
      setError('')
      setGenerationErrorDetail(null)
      setIsGenerating(true)
      const qualityOverride = asDraft ? 'low' : undefined
      const results = await Promise.all(
        failedIds.map((id) => {
          canceledJobsRef.current.delete(id)
          return runGenerationJob(id, { qualityOverride })
        })
      )
      await pruneGenerations(drawingKeyRef.current)
      await refreshHistory()
      const firstSuccess = results.find((r) => r.ok)
      if (firstSuccess) {
        setSketchSnapshot(lastGenBatchRef.current?.sketchDataUrl ?? sketchSnapshot)
        setGeneratedImage(firstSuccess.dataUrl)
        setActiveGenerationId(firstSuccess.jobId)
        setView('generated')
      } else {
        const failed = results.find((r) => r.error)
        if (failed) {
          const classified = classifyGenerationError(failed.error)
          setGenerationErrorDetail(classified)
          setError(classified.message)
        }
      }
      setIsGenerating(false)
    },
    [genQueue, runGenerationJob, refreshHistory, sketchSnapshot]
  )

  const handleGenerate = useCallback(async () => {
    setError('')
    setGenerationErrorDetail(null)
    const board = canvasRef.current
    const key = drawingKeyRef.current
    const style = allStyles.find((s) => s.id === selectedStyleId) || allStyles[0]

    if (improveGeneration) {
      if (!generatedImage) {
        setError('Select a generated image in History before improving.')
        return
      }
      if (!instructions?.trim()) {
        setError('Add instructions describing what to change.')
        return
      }
    } else if (!board?.hasContent?.()) {
      setError('Draw something on the canvas first.')
      return
    }

    const sketchDataUrl = improveGeneration
      ? (sketchSnapshot || board?.exportPNG?.())
      : board.exportPNG()
    const referenceImageDataUrl = improveGeneration ? generatedImage : null
    const total = variations
    const verb = improveGeneration ? 'Improving' : 'Generating'

    canceledJobsRef.current = new Set()
    const batchId = `batch-${Date.now()}`
    const createdAtBase = Date.now()
    const jobs = Array.from({ length: total }, (_, i) => ({
      id: `${batchId}-${i}`,
      index: i,
      status: 'queued',
      dataUrl: null,
      error: null,
      historyId: null,
    }))
    setGenQueue(jobs)

    lastGenBatchRef.current = {
      batchId,
      createdAtBase,
      jobs,
      sketchDataUrl,
      referenceImageDataUrl,
      style,
      instructions,
      formatId: canvasFormat,
      brand: { colors: brandColors, fonts: brandFonts },
      useBrandColors: useBrandColorsInGeneration,
      key,
      quality: generationQuality,
      addGenerationsAsLayers,
    }

    setIsGenerating(true)
    setGenerationProgress({
      message: improveGeneration ? 'Preparing reference image…' : 'Preparing sketch…',
      completed: 0,
      total,
      percent: 5,
    })

    let softTimer = setInterval(() => {
      setGenerationProgress((prev) => {
        if (!prev || prev.completed >= prev.total) return prev
        const maxBeforeDone = 8 + (prev.completed / prev.total) * 82 + (prev.total > 1 ? 8 : 18)
        if (prev.percent >= maxBeforeDone) return prev
        return { ...prev, percent: Math.min(maxBeforeDone, prev.percent + 1) }
      })
    }, 700)

    let completed = 0

    try {
      setGenerationProgress({
        message:
          total > 1
            ? `${verb} ${total} variation${total > 1 ? 's' : ''} with the model…`
            : `${verb} illustration with the model…`,
        completed: 0,
        total,
        percent: 10,
      })

      const results = await Promise.all(
        jobs.map(async (job) => {
          if (canceledJobsRef.current.has(job.id)) {
            return { ok: false, canceled: true }
          }
          const result = await runGenerationJob(job.id)
          if (result.ok) {
            completed += 1
            const pct = Math.round(10 + (completed / total) * 85)
            setGenerationProgress({
              message:
                total > 1
                  ? `${verb} variation ${completed} of ${total}…`
                  : `${verb} illustration…`,
              completed,
              total,
              percent: pct,
            })
          }
          return result
        })
      )

      setGenerationProgress({
        message: 'Saving to history…',
        completed: results.filter((r) => r.ok).length,
        total,
        percent: 98,
      })
      await pruneGenerations(key)
      await refreshHistory()

      const firstSuccess = results.find((r) => r.ok)
      if (firstSuccess) {
        setSketchSnapshot(sketchDataUrl)
        setGeneratedImage(firstSuccess.dataUrl)
        setActiveGenerationId(firstSuccess.jobId)
        setView('generated')
      } else {
        const failed = results.find((r) => r.error && !r.canceled)
        if (failed) {
          const classified = classifyGenerationError(failed.error)
          setGenerationErrorDetail(classified)
          setError(classified.message)
        }
      }
    } catch (err) {
      const classified = classifyGenerationError(err)
      setGenerationErrorDetail(classified)
      setError(classified.message)
    } finally {
      clearInterval(softTimer)
      setGenerationProgress(null)
      setIsGenerating(false)
    }
  }, [
    allStyles,
    selectedStyleId,
    instructions,
    variations,
    refreshHistory,
    canvasFormat,
    improveGeneration,
    generatedImage,
    sketchSnapshot,
    brandColors,
    brandFonts,
    useBrandColorsInGeneration,
    generationQuality,
    addGenerationsAsLayers,
    runGenerationJob,
  ])

  const handleExport = useCallback(
    (action) => handleExportImage(action, generatedImage),
    [handleExportImage, generatedImage]
  )

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
        onOpenSettings={handleOpenSettings}
        onExport={handleExport}
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
          <div className="app-error-banner-actions">
            {generationErrorDetail?.type !== 'auth' && genQueue.some((j) => j.status === 'error') && (
              <>
                <button type="button" onClick={() => handleRetryFailedGenerations(false)}>
                  Retry failed
                </button>
                {generationErrorDetail?.canRetryDraft !== false && (
                  <button type="button" onClick={() => handleRetryFailedGenerations(true)}>
                    Retry as draft
                  </button>
                )}
              </>
            )}
            {generationErrorDetail?.type === 'auth' && (
              <button type="button" onClick={() => setSettingsOpen(true)}>
                Open settings
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setError('')
                setGenerationErrorDetail(null)
              }}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
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
          textFontFamily={textFontFamily}
          onTextFontFamilyChange={setTextFontFamily}
          textFontSize={textFontSize}
          onTextFontSizeChange={setTextFontSize}
          textFontBold={textFontBold}
          onTextFontBoldChange={setTextFontBold}
          brandFonts={brandFonts}
          brandColors={brandColors}
          onApplyBrandFont={handleApplyBrandFont}
          arrowStyleId={arrowStyleId}
          onArrowStyleChange={setArrowStyleId}
          penSnapHV={penSnapHV}
          onPenSnapHVChange={setPenSnapHV}
          onCleanUpSketch={handleCleanUpSketch}
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
          {isGenerating && generationProgress && (
            <div className="generation-progress-banner">
              <GenerationProgress progress={generationProgress} />
            </div>
          )}
          <div className="app-canvas-area" style={{ display: view === 'sketch' ? 'flex' : 'none', flex: 1, minHeight: 0 }}>
            <CanvasBoard
              ref={canvasRef}
              tool={tool}
              color={color}
              size={brushSize}
              smoothing={smoothing}
              wobble={wobble}
              textFontFamily={textFontFamily}
              textFontSize={textFontSize}
              textFontBold={textFontBold}
              arrowStyleId={arrowStyleId}
              penSnapHV={penSnapHV}
              backgroundColor={canvasBackgroundColor}
              brandColors={brandColors}
              onBackgroundColorChange={setCanvasBackgroundColor}
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
              onExport={handleExport}
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
              onReorder={handleReorderLayers}
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
            collapsed={styleSectionCollapsed}
            onCollapsedChange={setStyleSectionCollapsed}
          />
          <PromptBar
            value={instructions}
            onChange={setInstructions}
            onGenerate={handleGenerate}
            isGenerating={isGenerating}
            generationProgress={generationProgress}
            error={error}
            variations={variations}
            onVariationsChange={setVariations}
            improveGeneration={improveGeneration}
            onImproveGenerationChange={setImproveGeneration}
            canImproveGeneration={Boolean(generatedImage)}
            useBrandColors={useBrandColorsInGeneration}
            onUseBrandColorsChange={setUseBrandColorsInGeneration}
            generationQuality={generationQuality}
            onGenerationQualityChange={setGenerationQuality}
            addGenerationsAsLayers={addGenerationsAsLayers}
            onAddGenerationsAsLayersChange={setAddGenerationsAsLayers}
          />
          <GenerationQueue
            jobs={genQueue}
            onCancel={handleCancelGenerationJob}
            onRetry={handleRetryGenerationJob}
            onUseResult={handleUseQueueResult}
            onDismiss={handleDismissGenerationQueue}
          />
          <HistoryGallery
            items={generationHistory}
            activeId={activeGenerationId}
            onSelect={handleSelectHistoryEntry}
            onDelete={handleDeleteHistoryEntry}
            onImageContextMenu={handleImageContextMenu}
          />
        </aside>
      </div>

      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} onSave={handleSaveSettings}>
        {brandingDraft ? (
          <BrandingSettings value={brandingDraft} onChange={setBrandingDraft} />
        ) : null}
      </SettingsModal>

      {imageContextMenu && (
        <ImageContextMenu
          x={imageContextMenu.x}
          y={imageContextMenu.y}
          onExport={handleExportFromMenu}
          onSetAsSketch={handleSetAsSketchFromMenu}
          onAddAsLayer={handleAddAsLayerFromMenu}
          onClose={() => setImageContextMenu(null)}
        />
      )}
    </div>
  )
}
