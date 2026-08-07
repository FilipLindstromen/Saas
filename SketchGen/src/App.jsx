import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import TopBar from './components/TopBar'
import CanvasBoard from './components/CanvasBoard'
import ToolRail from './components/ToolRail'
import OptionsBar from './components/OptionsBar'
import StylePickerOverlay from './components/StylePickerOverlay'
import GenerationGalleryOverlay from './components/GenerationGalleryOverlay'
import CanvaConnectOverlay from './components/CanvaConnectOverlay'
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
import { exportImageDataUrl, exportSketchComposite } from './utils/imageExport'
import { loadAppSettings, saveAppSettings } from './utils/appSettings'
import {
  DEFAULT_SKETCH_FORMAT_ID,
  normalizeSketchFormatId,
  SKETCH_FORMATS,
} from './utils/canvasFormat'
import {
  generateProjectId,
  drawingKeyFor,
  loadProjects, saveProjects,
  loadCurrentProjectId, saveCurrentProjectId,
  loadCurrentTabId, saveCurrentTabId,
  getProjectTabs, addProjectTab, removeProjectTab, renameProjectTab,
  deleteProjectStorage,
} from './utils/projectStorage'
import {
  completeCanvaOAuthFromRedirect,
  getCanvaAccessToken,
  isCanvaConnected,
} from './utils/canva/canvaAuth'
import { uploadImageDataUrlToCanva } from './utils/canva/canvaUpload'
import { canvaProjectsUrl } from './utils/canva/canvaConfig'
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
  const brandingOpenSnapshotRef = useRef(null)
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
  const [hasSketchContent, setHasSketchContent] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  const [customStyles, setCustomStyles] = useState(() => loadCustomStyles())
  const [imageStyles, setImageStyles] = useState([])
  const allStyles = useMemo(() => [...STYLES, ...customStyles, ...imageStyles], [customStyles, imageStyles])
  const [selectedStyleId, setSelectedStyleId] = useState(savedSettings.selectedStyleId || DEFAULT_STYLE_ID)
  const [instructions, setInstructions] = useState('')
  const [variations, setVariations] = useState(savedSettings.variations)
  const [styleSectionCollapsed, setStyleSectionCollapsed] = useState(savedSettings.styleSectionCollapsed)
  const [stylePickerOpen, setStylePickerOpen] = useState(false)
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [galleryItems, setGalleryItems] = useState([])
  const [canvaOverlayOpen, setCanvaOverlayOpen] = useState(false)
  const [canvaBusy, setCanvaBusy] = useState(false)
  const [canvaError, setCanvaError] = useState('')
  const [canvaSuccess, setCanvaSuccess] = useState('')
  const [canvaLinked, setCanvaLinked] = useState(() => isCanvaConnected())
  const [selectedTextItem, setSelectedTextItem] = useState(null)
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
  const [canvasBackgroundColor, setCanvasBackgroundColor] = useState(DEFAULT_BRAND_COLORS.brightBg)
  const [showSafeZone, setShowSafeZone] = useState(Boolean(savedSettings.showSafeZone))
  const [defringeMode, setDefringeMode] = useState(savedSettings.defringeMode)
  const [defringeStrength, setDefringeStrength] = useState(savedSettings.defringeStrength)
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
  const genBatchesRef = useRef(new Map())
  const genQueueRef = useRef([])
  const queuePumpActiveRef = useRef(false)
  const canceledJobsRef = useRef(new Set())
  const [error, setError] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsModalTitle, setSettingsModalTitle] = useState('Settings')
  const [placing, setPlacing] = useState(null)
  const [layers, setLayers] = useState([])
  const [activeLayerId, setActiveLayerId] = useState(null)
  const [imageContextMenu, setImageContextMenu] = useState(null)
  const [selectionActive, setSelectionActive] = useState(false)
  const [selectionFloating, setSelectionFloating] = useState(false)
  const [selectionScale, setSelectionScale] = useState(100)
  const [selectionRotation, setSelectionRotation] = useState(0)

  const [projects, setProjects] = useState([])
  const [currentProjectId, setCurrentProjectId] = useState(null)
  const [tabs, setTabs] = useState([])
  const [currentTabId, setCurrentTabId] = useState(null)
  const [hasHydrated, setHasHydrated] = useState(false)

  const instructionsRef = useRef('')
  instructionsRef.current = instructions

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
    showSafeZone,
    defringeMode,
    defringeStrength,
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (!params.get('code')) return
    completeCanvaOAuthFromRedirect()
      .then((completed) => {
        if (completed) {
          setCanvaLinked(true)
          setCanvaOverlayOpen(true)
          setCanvaSuccess('Canva connected. Click Send to Canva again to upload.')
        }
      })
      .catch((err) => {
        setCanvaError(err?.message || 'Canva sign-in failed.')
        setCanvaOverlayOpen(true)
      })
  }, [])

  const syncSketchContent = useCallback(() => {
    setHasSketchContent(Boolean(canvasRef.current?.hasContent?.()))
  }, [])

  /** Loads one drawing's canvas + generation history into the (already-switched) view. */
  const loadDrawing = useCallback(async (projectId, tabId) => {
    const key = drawingKeyFor(projectId, tabId)
    const settingsFallback = loadAppSettings()
    let snapshot = null
    try {
      snapshot = await kvGet(`canvas:${key}`)
      const format = snapshot?.formatId != null
        ? normalizeSketchFormatId(snapshot.formatId)
        : normalizeSketchFormatId(settingsFallback.canvasFormat)
      setCanvasFormat(format)
      const legacyGlobalBg =
        settingsFallback.canvasBackgroundColor != null
          ? normalizeHexColor(settingsFallback.canvasBackgroundColor, DEFAULT_BRAND_COLORS.brightBg)
          : null
      const docBg = normalizeHexColor(
        snapshot?.backgroundColor,
        legacyGlobalBg ?? DEFAULT_BRAND_COLORS.brightBg
      )
      setCanvasBackgroundColor(docBg)
      if (snapshot?.layers?.length) await canvasRef.current?.restoreLayers({ ...snapshot, formatId: format })
      else canvasRef.current?.resetBlank(format)
    } catch {
      setCanvasBackgroundColor(DEFAULT_BRAND_COLORS.brightBg)
      canvasRef.current?.resetBlank()
    }
    try {
      setGenerationHistory(await getAllGenerations(key))
    } catch {
      setGenerationHistory([])
    }
    try {
      const stored = await kvGet(`instructions:${key}`)
      if (stored !== undefined && stored !== null) {
        setInstructions(typeof stored === 'string' ? stored : String(stored))
      } else {
        const legacy = settingsFallback.instructions || ''
        setInstructions(legacy)
        if (legacy) await kvSet(`instructions:${key}`, legacy)
      }
    } catch {
      setInstructions('')
    }
    setGeneratedImage(null)
    setSketchSnapshot(null)
    setActiveGenerationId(null)
    setView('sketch')
    requestAnimationFrame(() => syncSketchContent())
  }, [syncSketchContent])

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

  const flushInstructions = useCallback(async (key = drawingKeyRef.current) => {
    if (!key) return
    try {
      await kvSet(`instructions:${key}`, instructionsRef.current ?? '')
    } catch {
      // ignore
    }
  }, [])

  const flushDrawingState = useCallback(async () => {
    await flushAutosave()
    await flushInstructions()
  }, [flushAutosave, flushInstructions])

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
  }, [tool, color, penSize, eraserSize, smoothing, wobble, zoom, canvasFormat, selectedStyleId, variations, styleSectionCollapsed, improveGeneration, brandColors, brandFonts, useBrandColorsInGeneration, textFontFamily, textFontSize, textFontBold, arrowStyleId, penSnapHV, generationQuality, addGenerationsAsLayers, showSafeZone, defringeMode, defringeStrength, flushAppSettings])

  // Per-drawing instructions (IndexedDB), debounced while typing.
  useEffect(() => {
    if (!hasHydrated) return
    const key = drawingKeyRef.current
    if (!key) return
    const timer = setTimeout(() => {
      kvSet(`instructions:${key}`, instructions).catch(() => {})
    }, 300)
    return () => {
      clearTimeout(timer)
      kvSet(`instructions:${key}`, instructions).catch(() => {})
    }
  }, [instructions, hasHydrated, currentProjectId, currentTabId])

  useEffect(() => {
    const onPageHide = () => {
      flushAppSettings()
      flushInstructions()
    }
    window.addEventListener('pagehide', onPageHide)
    window.addEventListener('beforeunload', onPageHide)
    return () => {
      window.removeEventListener('pagehide', onPageHide)
      window.removeEventListener('beforeunload', onPageHide)
    }
  }, [flushAppSettings, flushInstructions])

  // A persisted selectedStyleId might reference a custom/image style that was
  // deleted in a previous session — fall back once the real style list loads.
  useEffect(() => {
    if (allStyles.length && !allStyles.some((s) => s.id === selectedStyleId)) {
      setSelectedStyleId(DEFAULT_STYLE_ID)
    }
  }, [allStyles, selectedStyleId])

  const handleOpenSettings = useCallback(() => {
    brandingOpenSnapshotRef.current = {
      colors: { ...brandColors },
      fonts: { ...brandFonts },
    }
    setBrandingDraft({ colors: { ...brandColors }, fonts: { ...brandFonts } })
    setSettingsModalTitle('Settings')
    setSettingsOpen(true)
  }, [brandColors, brandFonts])

  const handleOpenBranding = useCallback(() => {
    brandingOpenSnapshotRef.current = {
      colors: { ...brandColors },
      fonts: { ...brandFonts },
    }
    setBrandingDraft({ colors: { ...brandColors }, fonts: { ...brandFonts } })
    setSettingsModalTitle('Brand')
    setSettingsOpen(true)
  }, [brandColors, brandFonts])

  const persistBrandSettings = useCallback((colors, fonts) => {
    const next = {
      ...persistedSettingsRef.current,
      brandColors: colors,
      brandFonts: fonts,
    }
    saveAppSettings(next)
  }, [])

  const handleBrandingChange = useCallback((next) => {
    setBrandingDraft(next)
    const colors = normalizeBrandColors(next?.colors)
    const fonts = normalizeBrandFonts(next?.fonts)
    setBrandColors(colors)
    setBrandFonts(fonts)
    persistBrandSettings(colors, fonts)
  }, [persistBrandSettings])

  const handleSaveSettings = useCallback(() => {
    const draft = brandingDraft ?? { colors: brandColors, fonts: brandFonts }
    const colors = normalizeBrandColors(draft.colors)
    const fonts = normalizeBrandFonts(draft.fonts)
    setBrandColors(colors)
    setBrandFonts(fonts)
    setBrandingDraft(null)
    brandingOpenSnapshotRef.current = null
    persistBrandSettings(colors, fonts)
  }, [brandingDraft, brandColors, brandFonts, persistBrandSettings])

  const handleCloseSettings = useCallback(() => {
    const snap = brandingOpenSnapshotRef.current
    if (snap) {
      const colors = normalizeBrandColors(snap.colors)
      const fonts = normalizeBrandFonts(snap.fonts)
      setBrandColors(colors)
      setBrandFonts(fonts)
      persistBrandSettings(colors, fonts)
    }
    brandingOpenSnapshotRef.current = null
    setBrandingDraft(null)
    setSettingsOpen(false)
  }, [persistBrandSettings])

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

  const handleExportImage = useCallback(async (action, { dataUrl: dataUrlOverride } = {}) => {
    setError('')
    try {
      if (dataUrlOverride) {
        await exportImageDataUrl(dataUrlOverride, action, { filenameBase: 'sketchgen-result' })
        return
      }
      if (view === 'sketch') {
        const board = canvasRef.current
        if (!board?.hasContent?.()) {
          setError('Nothing on the canvas to export yet.')
          return
        }
        await exportSketchComposite(board, action)
      } else {
        if (!generatedImage) {
          setError('No generated image to export.')
          return
        }
        await exportImageDataUrl(generatedImage, action, { filenameBase: 'sketchgen-result' })
      }
    } catch (err) {
      console.error(err)
      const msg = err?.message?.includes('Clipboard')
        ? 'Copy failed — try PNG download or allow clipboard access for this site.'
        : 'Export failed. Try again or use a different format.'
      setError(msg)
    }
  }, [generatedImage, view])

  const handleExportFromMenu = useCallback(
    async (action) => {
      const dataUrl = imageContextMenu?.dataUrl
      setImageContextMenu(null)
      if (!dataUrl) return
      await handleExportImage(action, { dataUrl })
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

  const handleDefringeLayer = useCallback(() => {
    setError('')
    const ok = canvasRef.current?.defringeActiveLayer?.()
    if (!ok) setError('Select a layer with artwork to defringe.')
  }, [])

  const handleSeparateParts = useCallback(() => {
    setError('')
    const result = canvasRef.current?.separateActiveLayerIntoParts?.()
    if (!result?.ok) {
      if (result?.reason === 'already-parts') {
        setError('This layer is already separated. Use the move tool on individual parts.')
      } else if (result?.reason === 'too-few-parts') {
        setError('Could not find enough separate regions. Try a flat background and clear gaps between elements.')
      } else {
        setError('Select a layer with an illustration to separate.')
      }
    } else {
      setTool('move')
    }
  }, [])

  const handleSelectionChange = useCallback(({ active, floating }) => {
    setSelectionActive(active)
    setSelectionFloating(Boolean(floating))
    if (!active) {
      setSelectionScale(100)
      setSelectionRotation(0)
    }
  }, [])

  const handleApplySelection = useCallback(() => {
    canvasRef.current?.applyFloatingSelection?.()
  }, [])

  const handleDeleteSelection = useCallback(() => {
    canvasRef.current?.deleteFloatingSelection?.()
    setSelectionScale(100)
    setSelectionRotation(0)
  }, [])

  const handleSelectionScaleChange = useCallback((percent) => {
    setSelectionScale(percent)
    canvasRef.current?.scaleFloatingSelection?.(percent)
  }, [])

  const handleSelectionRotationChange = useCallback((degrees) => {
    setSelectionRotation(degrees)
    canvasRef.current?.rotateFloatingSelection?.(degrees)
  }, [])

  /** Ctrl+T (Photoshop free transform): Move tool + lift pixel selection or whole layer for scale/rotate. */
  const handleTransformShortcut = useCallback(() => {
    setTool('move')
    setSelectionScale(100)
    setSelectionRotation(0)
    const lifted = canvasRef.current?.liftPixelSelectionToFloating?.()
    if (!lifted) canvasRef.current?.selectAllOnActiveLayer?.()
  }, [])

  useEffect(() => {
    const onKey = (e) => {
      const target = e.target
      const isEditable = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable
      if (isEditable) return
      if (view !== 'sketch') return
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 't') {
        e.preventDefault()
        handleTransformShortcut()
        return
      }
      if (!selectionActive) return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        handleDeleteSelection()
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        handleApplySelection()
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        handleApplySelection()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [view, selectionActive, handleDeleteSelection, handleApplySelection, handleTransformShortcut])

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

  const handleRenameLayer = useCallback((id, name) => {
    canvasRef.current?.renameLayer?.(id, name)
  }, [])

  const handleDuplicateLayer = useCallback((id) => {
    canvasRef.current?.duplicateLayer?.(id)
  }, [])

  const handleToggleLayerLock = useCallback((id) => {
    canvasRef.current?.toggleLayerLock?.(id)
  }, [])

  const handleLayerOpacityChange = useCallback((id, opacity) => {
    canvasRef.current?.setLayerOpacity?.(id, opacity)
  }, [])

  const handleLayerBlendModeChange = useCallback((id, blendMode) => {
    canvasRef.current?.setLayerBlendMode?.(id, blendMode)
  }, [])

  const handleTextSelectionChange = useCallback((item) => {
    setSelectedTextItem(item)
  }, [])

  const handleUpdateSelectedText = useCallback((patch) => {
    if (!selectedTextItem?.id) return
    canvasRef.current?.updateTextItem?.(selectedTextItem.id, patch)
    setSelectedTextItem((prev) => (prev ? { ...prev, ...patch } : null))
  }, [selectedTextItem?.id])

  const selectedStyle = useMemo(
    () => allStyles.find((s) => s.id === selectedStyleId) || allStyles[0],
    [allStyles, selectedStyleId]
  )

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
    setSketchSnapshot(entry.sketchDataUrl ?? null)
    setGeneratedImage(entry.dataUrl)
    setActiveGenerationId(entry.id)
    setView((v) => (v === 'sketch' ? 'generated' : v))
  }, [])

  const pickGenerationPreviewEntry = useCallback(() => {
    if (activeGenerationId) {
      const fromHistory = generationHistory.find((e) => e.id === activeGenerationId)
      if (fromHistory) return fromHistory
    }
    if (generatedImage) {
      return {
        id: activeGenerationId,
        dataUrl: generatedImage,
        sketchDataUrl: sketchSnapshot,
      }
    }
    return generationHistory[0] ?? null
  }, [activeGenerationId, generationHistory, generatedImage, sketchSnapshot])

  const handleViewChange = useCallback(
    (nextView) => {
      if (nextView === 'generated' || nextView === 'compare') {
        const entry = pickGenerationPreviewEntry()
        if (entry?.dataUrl) {
          setGeneratedImage(entry.dataUrl)
          setActiveGenerationId(entry.id ?? activeGenerationId)
          let sketch = entry.sketchDataUrl ?? sketchSnapshot
          if (!sketch && nextView === 'compare') {
            sketch = canvasRef.current?.exportPNG?.() ?? null
          }
          setSketchSnapshot(sketch)
        }
      }
      setView(nextView)
    },
    [pickGenerationPreviewEntry, activeGenerationId, sketchSnapshot]
  )

  const handleDeleteHistoryEntry = useCallback(async (id) => {
    await deleteGeneration(id)
    const key = drawingKeyRef.current
    const history = await getAllGenerations(key)
    setGenerationHistory(history)
    setGalleryItems(await getAllGenerations())
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

  useEffect(() => {
    genQueueRef.current = genQueue
  }, [genQueue])

  const patchGenQueue = useCallback((mapper) => {
    setGenQueue((prev) => {
      const next = mapper(prev)
      genQueueRef.current = next
      return next
    })
  }, [])

  const pickNextQueuedJob = useCallback(() => {
    return genQueueRef.current.find((j) => {
      if (j.status !== 'queued') return false
      const batch = genBatchesRef.current.get(j.id)
      if (batch?.multiVariant && batch.jobIndex > 0) {
        const leader = genQueueRef.current.find((l) => l.batchId === j.batchId && l.index === 0)
        if (!leader || leader.status === 'queued' || leader.status === 'running') return false
      }
      return true
    })
  }, [])

  const healGenerationQueue = useCallback(() => {
    const prev = genQueueRef.current
    let changed = false
    const next = prev.map((j) => {
      if (j.status === 'done' || j.status === 'error' || j.status === 'canceled') return j
      const batch = genBatchesRef.current.get(j.id)
      if (!batch) return j
      const leaderBatch = genBatchesRef.current.get(`${batch.batchId}-0`)
      const fromLeader = leaderBatch?.multiVariantResults?.[batch.jobIndex]
      const fromSelf = leaderBatch?.multiVariantResults?.[batch.jobIndex] ?? batch.resultDataUrl
      const dataUrl = batch.jobIndex === 0 ? (leaderBatch?.resultDataUrl ?? fromSelf ?? fromLeader) : fromLeader ?? fromSelf
      if (dataUrl && (j.status === 'running' || j.status === 'queued')) {
        changed = true
        return {
          ...j,
          status: 'done',
          dataUrl,
          historyId: j.historyId || j.id,
          sketchDataUrl: j.sketchDataUrl ?? batch.sketchDataUrl,
        }
      }
      return j
    })
    if (changed) {
      genQueueRef.current = next
      setGenQueue(next)
    }
    return changed ? next : prev
  }, [])

  const runGenerationJob = useCallback(async (jobId, { qualityOverride } = {}) => {
    const batch = genBatchesRef.current.get(jobId)
    if (!batch) return { ok: false }

    if (canceledJobsRef.current.has(jobId)) {
      return { ok: false, canceled: true }
    }

    if (batch.multiVariant && batch.jobIndex > 0) {
      const leaderId = `${batch.batchId}-0`
      const leaderBatch = genBatchesRef.current.get(leaderId)
      const dataUrl = leaderBatch?.multiVariantResults?.[batch.jobIndex]
      if (dataUrl) {
        patchGenQueue((prev) =>
          prev.map((j) =>
            j.id === jobId
              ? { ...j, status: 'done', dataUrl, historyId: jobId, sketchDataUrl: batch.sketchDataUrl }
              : j
          )
        )
        return { ok: true, dataUrl, jobId }
      }
      const leaderJob = genQueueRef.current.find((j) => j.id === leaderId)
      if (leaderJob?.status === 'error') {
        patchGenQueue((prev) =>
          prev.map((j) => (j.id === jobId ? { ...j, status: 'error', error: leaderJob.error } : j))
        )
        return { ok: false, error: new Error(leaderJob.error || 'Generation failed.') }
      }
      if (leaderJob?.status === 'canceled') {
        return { ok: false, canceled: true }
      }
      return { ok: false, waitingForLeader: true }
    }

    const ac = new AbortController()
    genAbortRef.current.set(jobId, ac)
    const batchJobIds =
      batch.multiVariant && batch.variantCount > 1
        ? Array.from({ length: batch.variantCount }, (_, i) => `${batch.batchId}-${i}`)
        : [jobId]
    patchGenQueue((prev) =>
      prev.map((j) =>
        batchJobIds.includes(j.id) && (j.status === 'queued' || j.status === 'running')
          ? { ...j, status: 'running', error: null }
          : j
      )
    )

    const quality = qualityOverride ?? batch.quality
    const variantCount = batch.multiVariant ? batch.variantCount : 1

    try {
      const result = await generateStyledImage({
        sketchDataUrl: batch.sketchDataUrl,
        style: batch.style,
        instructions: batch.instructions,
        formatId: batch.formatId,
        referenceImageDataUrl: batch.referenceImageDataUrl,
        brand: batch.brand,
        useBrandColors: Boolean(batch.useBrandColors),
        documentBackgroundColor: batch.documentBackgroundColor,
        instructionsOnly: Boolean(batch.instructionsOnly),
        quality,
        variantCount,
        signal: ac.signal,
      })

      const dataUrls = Array.isArray(result) ? result : [result]

      if (canceledJobsRef.current.has(jobId)) {
        patchGenQueue((prev) =>
          prev.map((j) => (batchJobIds.includes(j.id) ? { ...j, status: 'canceled' } : j))
        )
        return { ok: false, canceled: true }
      }

      if (batch.multiVariant) {
        genBatchesRef.current.set(jobId, { ...batch, multiVariantResults: dataUrls })
        for (let i = 0; i < batch.variantCount; i += 1) {
          const siblingId = `${batch.batchId}-${i}`
          const dataUrl = dataUrls[i]
          if (!dataUrl) continue
          await addGeneration({
            id: siblingId,
            batchId: batch.batchId,
            drawingKey: batch.key,
            createdAt: batch.createdAtBase + i,
            dataUrl,
            sketchDataUrl: batch.sketchDataUrl,
            styleId: batch.style.id,
            styleName: batch.style.name,
            instructions: batch.instructions,
          })
          if (batch.addGenerationsAsLayers && batch.key === drawingKeyRef.current) {
            await canvasRef.current?.addLayerFromImage?.(dataUrl, `Generation ${i + 1}`)
          }
        }
        patchGenQueue((prev) =>
          prev.map((j) => {
            if (j.batchId !== batch.batchId) return j
            const idx = j.index
            const dataUrl = dataUrls[idx]
            if (!dataUrl) return { ...j, status: 'error', error: 'Missing variant output' }
            return {
              ...j,
              status: 'done',
              dataUrl,
              historyId: `${batch.batchId}-${idx}`,
              sketchDataUrl: batch.sketchDataUrl,
            }
          })
        )
        return { ok: true, dataUrl: dataUrls[0], jobId }
      }

      const dataUrl = dataUrls[0]
      genBatchesRef.current.set(jobId, { ...batch, resultDataUrl: dataUrl })
      const entry = {
        id: jobId,
        batchId: batch.batchId,
        drawingKey: batch.key,
        createdAt: batch.createdAtBase + batch.jobIndex,
        dataUrl,
        sketchDataUrl: batch.sketchDataUrl,
        styleId: batch.style.id,
        styleName: batch.style.name,
        instructions: batch.instructions,
      }
      await addGeneration(entry)
      if (batch.addGenerationsAsLayers && batch.key === drawingKeyRef.current) {
        await canvasRef.current?.addLayerFromImage?.(dataUrl, `Generation ${batch.jobIndex + 1}`)
      }
      patchGenQueue((prev) =>
        prev.map((j) =>
          j.id === jobId
            ? { ...j, status: 'done', dataUrl, historyId: jobId, sketchDataUrl: batch.sketchDataUrl }
            : j
        )
      )
      return { ok: true, dataUrl, jobId }
    } catch (err) {
      if (err?.name === 'AbortError' || canceledJobsRef.current.has(jobId)) {
        patchGenQueue((prev) =>
          prev.map((j) => (batchJobIds.includes(j.id) ? { ...j, status: 'canceled', error: null } : j))
        )
        return { ok: false, canceled: true }
      }
      const msg = err?.message || 'Generation failed.'
      patchGenQueue((prev) =>
        prev.map((j) => (batchJobIds.includes(j.id) ? { ...j, status: 'error', error: msg } : j))
      )
      return { ok: false, error: err }
    } finally {
      genAbortRef.current.delete(jobId)
    }
  }, [patchGenQueue])

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

  const processGenerationQueue = useCallback(async () => {
    if (queuePumpActiveRef.current) return
    queuePumpActiveRef.current = true
    setIsGenerating(true)

    let softTimer = null

    try {
      while (true) {
        const job = pickNextQueuedJob()
        if (!job) break

        const batch = genBatchesRef.current.get(job.id)
        const verb = batch?.referenceImageDataUrl
          ? 'Improving'
          : batch?.instructionsOnly
            ? 'Creating'
            : 'Generating'
        const labelPrefix = job.drawingLabel ? `${job.drawingLabel} — ` : ''
        const batchJobs = genQueueRef.current.filter((j) => j.batchId === job.batchId)
        const batchTotal = batchJobs.length
        const batchDone = batchJobs.filter((j) => j.status === 'done').length

        setGenerationProgress({
          message: batch?.instructionsOnly
            ? `${labelPrefix}${verb} from instructions${batch?.multiVariant ? ` (${batch.variantCount} variations)…` : '…'}`
            : batch?.multiVariant
              ? `${labelPrefix}${verb} ${batch.variantCount} variations (one request)…`
              : `${labelPrefix}${verb} variation ${job.index + 1}…`,
          completed: batchDone,
          total: batchTotal,
          percent: 12,
        })

        softTimer = setInterval(() => {
          setGenerationProgress((prev) => {
            if (!prev || prev.percent >= 92) return prev
            return { ...prev, percent: Math.min(92, prev.percent + 1) }
          })
        }, 700)

        const result = await runGenerationJob(job.id)
        clearInterval(softTimer)
        softTimer = null

        if (result.waitingForLeader) {
          break
        }

        if (result.ok) {
          const healed = healGenerationQueue()
          const batchDoneNow = healed.filter((j) => j.batchId === job.batchId && j.status === 'done').length
          const batchTotalNow = healed.filter((j) => j.batchId === job.batchId).length
          setGenerationProgress({
            message: 'Complete',
            completed: batchDoneNow,
            total: batchTotalNow,
            percent: 100,
          })
        }

        if (result.ok && job.drawingKey === drawingKeyRef.current) {
          const showResult = !batch?.multiVariant || job.index === 0
          await pruneGenerations(job.drawingKey)
          await refreshHistory()
          if (showResult) {
            setSketchSnapshot(batch?.sketchDataUrl ?? sketchSnapshot)
            setGeneratedImage(result.dataUrl)
            setActiveGenerationId(batch?.multiVariant ? `${batch.batchId}-0` : result.jobId)
            setView('generated')
          }
        } else if (result.error && job.drawingKey === drawingKeyRef.current && (!batch?.multiVariant || job.index === 0)) {
          const classified = classifyGenerationError(result.error)
          setGenerationErrorDetail(classified)
          setError(classified.message)
        }
      }
    } finally {
      if (softTimer) clearInterval(softTimer)
      queuePumpActiveRef.current = false
      const queue = healGenerationQueue()
      const stillActive = queue.some((j) => j.status === 'queued' || j.status === 'running')
      setIsGenerating(stillActive)
      if (!stillActive) {
        setGenerationProgress(null)
      } else if (pickNextQueuedJob()) {
        void processGenerationQueue()
      }
    }
  }, [runGenerationJob, refreshHistory, sketchSnapshot, pickNextQueuedJob, healGenerationQueue])

  const handleRetryGenerationJob = useCallback(
    (jobId) => {
      canceledJobsRef.current.delete(jobId)
      setError('')
      setGenerationErrorDetail(null)
      setGenQueue((prev) => {
        const next = prev.map((j) =>
          j.id === jobId ? { ...j, status: 'queued', error: null } : j
        )
        genQueueRef.current = next
        return next
      })
      void processGenerationQueue()
    },
    [processGenerationQueue]
  )

  const handleUseQueueResult = useCallback((job) => {
    if (!job?.dataUrl) return
    setGeneratedImage(job.dataUrl)
    setActiveGenerationId(job.historyId || job.id)
    const batchSketch = job.sketchDataUrl ?? genBatchesRef.current.get(job.id)?.sketchDataUrl
    if (batchSketch) setSketchSnapshot(batchSketch)
    setView('generated')
  }, [])

  const handleDismissGenerationQueue = useCallback(() => {
    setGenQueue([])
    genQueueRef.current = []
  }, [])

  const handleRetryFailedGenerations = useCallback(
    (asDraft = false) => {
      const failedIds = genQueue.filter((j) => j.status === 'error').map((j) => j.id)
      if (!failedIds.length) return
      setError('')
      setGenerationErrorDetail(null)
      for (const id of failedIds) {
        canceledJobsRef.current.delete(id)
        const batch = genBatchesRef.current.get(id)
        if (batch && asDraft) genBatchesRef.current.set(id, { ...batch, quality: 'low' })
      }
      setGenQueue((prev) => {
        const next = prev.map((j) =>
          failedIds.includes(j.id) ? { ...j, status: 'queued', error: null } : j
        )
        genQueueRef.current = next
        return next
      })
      void processGenerationQueue()
    },
    [genQueue, processGenerationQueue]
  )

  const handleGenerate = useCallback(() => {
    setError('')
    setGenerationErrorDetail(null)
    const board = canvasRef.current
    const key = drawingKeyRef.current
    if (!key) return
    const style = allStyles.find((s) => s.id === selectedStyleId) || allStyles[0]
    const drawingLabel = tabs.find((t) => t.id === currentTabId)?.name ?? 'Drawing'

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
      if (!instructions?.trim()) {
        setError('Add instructions to generate without a sketch, or draw on the canvas first.')
        return
      }
    }

    const instructionsOnly = !improveGeneration && !board?.hasContent?.()
    const sketchDataUrl = improveGeneration
      ? (sketchSnapshot || board?.exportPNG?.())
      : instructionsOnly
        ? null
        : useBrandColorsInGeneration
          ? (board.exportCompositePNG?.(false) ?? board.exportPNG())
          : board.exportPNG()
    const referenceImageDataUrl = improveGeneration ? generatedImage : null
    const total = variations

    const batchId = `batch-${Date.now()}`
    const createdAtBase = Date.now()
    const jobs = Array.from({ length: total }, (_, i) => {
      const id = `${batchId}-${i}`
      genBatchesRef.current.set(id, {
        batchId,
        createdAtBase,
        jobIndex: i,
        sketchDataUrl,
        referenceImageDataUrl,
        style,
        instructions,
        formatId: canvasFormat,
        brand: { colors: normalizeBrandColors(brandColors), fonts: normalizeBrandFonts(brandFonts) },
        useBrandColors: useBrandColorsInGeneration,
        documentBackgroundColor: canvasBackgroundColor,
        instructionsOnly,
        key,
        quality: generationQuality,
        addGenerationsAsLayers,
        multiVariant: total > 1,
        variantCount: total,
      })
      return {
        id,
        batchId,
        index: i,
        status: 'queued',
        dataUrl: null,
        error: null,
        historyId: null,
        drawingKey: key,
        drawingLabel,
      }
    })

    setGenQueue((prev) => {
      const next = [...prev.filter((j) => j.status !== 'canceled'), ...jobs]
      genQueueRef.current = next
      return next
    })
    void processGenerationQueue()
  }, [
    allStyles,
    selectedStyleId,
    instructions,
    improveGeneration,
    generatedImage,
    sketchSnapshot,
    brandColors,
    brandFonts,
    useBrandColorsInGeneration,
    canvasBackgroundColor,
    generationQuality,
    addGenerationsAsLayers,
    processGenerationQueue,
    tabs,
    currentTabId,
  ])

  const handleExport = useCallback(
    (action) => handleExportImage(action),
    [handleExportImage]
  )

  const exportDisabled =
    view === 'sketch' ? !hasSketchContent : !generatedImage

  const generationPreview = useMemo(() => {
    if (generatedImage) {
      return { dataUrl: generatedImage, sketchDataUrl: sketchSnapshot }
    }
    if (activeGenerationId) {
      const hit = generationHistory.find((e) => e.id === activeGenerationId)
      if (hit) return { dataUrl: hit.dataUrl, sketchDataUrl: hit.sketchDataUrl ?? null }
    }
    const latest = generationHistory[0]
    if (latest) return { dataUrl: latest.dataUrl, sketchDataUrl: latest.sketchDataUrl ?? null }
    return null
  }, [generatedImage, sketchSnapshot, activeGenerationId, generationHistory])

  const showResultWorkspace = view !== 'sketch' && Boolean(generationPreview?.dataUrl)

  // --- Projects ---

  const switchProject = useCallback(async (projectId) => {
    if (projectId === currentProjectId) return
    await flushDrawingState()
    saveCurrentProjectId(projectId)
    const { tabs: nextTabs, tabId } = ensureProjectTabs(projectId)
    setCurrentProjectId(projectId)
    setTabs(nextTabs)
    setCurrentTabId(tabId)
    await loadDrawing(projectId, tabId)
  }, [currentProjectId, flushDrawingState, loadDrawing])

  const createProject = useCallback(async () => {
    await flushDrawingState()
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
  }, [projects, flushDrawingState, loadDrawing])

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
      await kvDelete(`instructions:${key}`).catch(() => {})
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
    await flushDrawingState()
    saveCurrentTabId(currentProjectId, tabId)
    setCurrentTabId(tabId)
    await loadDrawing(currentProjectId, tabId)
  }, [currentTabId, currentProjectId, flushDrawingState, loadDrawing])

  const addTab = useCallback(async () => {
    await flushDrawingState()
    const name = `Drawing ${tabs.length + 1}`
    const tabId = addProjectTab(currentProjectId, name)
    const nextTabs = getProjectTabs(currentProjectId)
    saveCurrentTabId(currentProjectId, tabId)
    setTabs(nextTabs)
    setCurrentTabId(tabId)
    await loadDrawing(currentProjectId, tabId)
  }, [currentProjectId, tabs.length, flushDrawingState, loadDrawing])

  const renameTab = useCallback((tabId, name) => {
    renameProjectTab(currentProjectId, tabId, name)
    setTabs(getProjectTabs(currentProjectId))
  }, [currentProjectId])

  const deleteTab = useCallback(async (tabId) => {
    if (tabs.length <= 1) return
    const wasCurrentTab = tabId === currentTabId
    const key = drawingKeyFor(currentProjectId, tabId)
    await kvDelete(`canvas:${key}`).catch(() => {})
    await kvDelete(`instructions:${key}`).catch(() => {})
    await deleteGenerationsForDrawing(key).catch(() => {})

    const fallbackTabId = removeProjectTab(currentProjectId, tabId)
    setTabs(getProjectTabs(currentProjectId))

    if (wasCurrentTab && fallbackTabId) {
      saveCurrentTabId(currentProjectId, fallbackTabId)
      setCurrentTabId(fallbackTabId)
      await loadDrawing(currentProjectId, fallbackTabId)
    }
  }, [tabs.length, currentTabId, currentProjectId, loadDrawing])

  const handleOpenGallery = useCallback(async () => {
    setGalleryItems(await getAllGenerations())
    setGalleryOpen(true)
  }, [])

  const handleGallerySelect = useCallback(
    async (entry) => {
      setGalleryOpen(false)
      const key = entry.drawingKey
      if (key && key !== drawingKeyRef.current) {
        const colon = key.indexOf(':')
        if (colon > 0) {
          const projectId = key.slice(0, colon)
          const tabId = key.slice(colon + 1)
          if (projectId !== currentProjectId) {
            await switchProject(projectId)
          }
          await flushDrawingState()
          saveCurrentTabId(projectId, tabId)
          setCurrentTabId(tabId)
          setTabs(getProjectTabs(projectId))
          await loadDrawing(projectId, tabId)
        }
      }
      setSketchSnapshot(entry.sketchDataUrl)
      setGeneratedImage(entry.dataUrl)
      setActiveGenerationId(entry.id)
      setView('generated')
      const historyKey = drawingKeyRef.current
      if (historyKey) {
        setGenerationHistory(await getAllGenerations(historyKey))
      }
    },
    [currentProjectId, switchProject, flushDrawingState, loadDrawing]
  )

  const handleGalleryDelete = useCallback(
    (id) => {
      void handleDeleteHistoryEntry(id)
    },
    [handleDeleteHistoryEntry]
  )

  const getImageDataUrlForCanva = useCallback(() => {
    if (view !== 'sketch' && generatedImage) return generatedImage
    const board = canvasRef.current
    return board?.exportCompositePNG?.(true) ?? board?.exportPNG?.() ?? null
  }, [view, generatedImage])

  const handleSendToCanva = useCallback(async () => {
    setCanvaError('')
    setCanvaSuccess('')
    if (!isCanvaConnected()) {
      setCanvaOverlayOpen(true)
      return
    }
    const dataUrl = getImageDataUrlForCanva()
    if (!dataUrl) {
      setCanvaError('Nothing to send — draw on the sketch or open a generated image first.')
      setCanvaOverlayOpen(true)
      return
    }
    setCanvaBusy(true)
    setCanvaOverlayOpen(true)
    try {
      const token = await getCanvaAccessToken()
      if (!token) {
        setCanvaLinked(false)
        setCanvaError('Canva session expired. Connect again.')
        return
      }
      const filename = `SketchGen-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.png`
      await uploadImageDataUrlToCanva(token, dataUrl, filename)
      setCanvaSuccess('Image uploaded to your Canva library.')
      window.open(canvaProjectsUrl(), '_blank', 'noopener,noreferrer')
    } catch (err) {
      setCanvaError(err?.message || 'Send to Canva failed.')
    } finally {
      setCanvaBusy(false)
    }
  }, [getImageDataUrlForCanva])

  const currentProjectName = projects.find((p) => p.id === currentProjectId)?.name

  return (
    <div className="app">
      <TopBar
        view={view}
        onViewChange={handleViewChange}
        hasGenerated={generationHistory.length > 0 || Boolean(generatedImage)}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onOpenSettings={handleOpenSettings}
        onOpenBranding={handleOpenBranding}
        onOpenGallery={handleOpenGallery}
        onSendToCanva={() => { void handleSendToCanva() }}
        canvaConnected={canvaLinked}
        canvaBusy={canvaBusy}
        brandColors={brandColors}
        onExport={handleExport}
        exportDisabled={exportDisabled}
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
          onSeparateParts={handleSeparateParts}
          defringeMode={defringeMode}
          onDefringeModeChange={setDefringeMode}
          defringeStrength={defringeStrength}
          onDefringeStrengthChange={setDefringeStrength}
          onDefringeLayer={handleDefringeLayer}
          selectionActive={selectionActive}
          selectionFloating={selectionFloating}
          selectionScale={selectionScale}
          onSelectionScaleChange={handleSelectionScaleChange}
          selectionRotation={selectionRotation}
          onSelectionRotationChange={handleSelectionRotationChange}
          onDeleteSelection={handleDeleteSelection}
          onApplySelection={handleApplySelection}
          onBeginTransform={handleTransformShortcut}
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
          canvasBackgroundColor={canvasBackgroundColor}
          onCanvasBackgroundColorChange={(hex) => {
            setCanvasBackgroundColor(hex)
            scheduleAutosave()
          }}
          selectedTextItem={selectedTextItem}
          onUpdateSelectedText={handleUpdateSelectedText}
          showSafeZone={showSafeZone}
          onShowSafeZoneChange={setShowSafeZone}
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
          <div className="app-workspace">
            <div
              className="app-sketch-area"
              style={{ display: view === 'sketch' ? 'flex' : 'none' }}
            >
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
                defringeMode={defringeMode}
                defringeStrength={defringeStrength}
                backgroundColor={canvasBackgroundColor}
                showSafeZone={showSafeZone}
                brandColors={brandColors}
                zoom={zoom}
                formatId={canvasFormat}
                placing={placing}
                onPlaced={handlePlaced}
                onDropFile={handleImportFile}
                onHistoryChange={({ canUndo: cu, canRedo: cr }) => {
                  setCanUndo(cu)
                  setCanRedo(cr)
                  syncSketchContent()
                }}
                onLayersChange={handleLayersChange}
                onCommit={() => {
                  scheduleAutosave()
                  syncSketchContent()
                  canvasRef.current?.refreshLayerPanel?.()
                }}
                onSelectionChange={handleSelectionChange}
                onTextSelectionChange={handleTextSelectionChange}
                onColorChange={setColor}
              />
            </div>
            {view !== 'sketch' && showResultWorkspace ? (
              <ResultView
                view={view}
                formatId={canvasFormat}
                sketchDataUrl={generationPreview.sketchDataUrl}
                generatedDataUrl={generationPreview.dataUrl}
                onUseAsSketch={handleUseAsSketch}
                onImageContextMenu={handleImageContextMenu}
                onExport={handleExport}
              />
            ) : null}
            {view !== 'sketch' && !showResultWorkspace ? (
              <div className="result-view-empty">
                Select a generation in History to preview or compare.
              </div>
            ) : null}
          </div>
        </main>

        <aside className="app-sidebar">
          {view === 'sketch' && (
            <LayersPanel
              layers={layers}
              activeLayerId={activeLayerId}
              onSelect={handleSelectLayer}
              onToggleVisibility={handleToggleLayerVisibility}
              onToggleLock={handleToggleLayerLock}
              onAdd={handleAddLayer}
              onDuplicate={handleDuplicateLayer}
              onRemove={handleRemoveLayer}
              onReorder={handleReorderLayers}
              onRename={handleRenameLayer}
              onOpacityChange={handleLayerOpacityChange}
              onBlendModeChange={handleLayerBlendModeChange}
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
          {tool !== 'stamp' && (
            <PromptBar
              selectedStyle={selectedStyle}
              onOpenStylePicker={() => setStylePickerOpen(true)}
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
          )}
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

      <SettingsModal
        isOpen={settingsOpen}
        title={settingsModalTitle}
        onClose={handleCloseSettings}
        onSave={handleSaveSettings}
      >
        <BrandingSettings
          value={brandingDraft ?? { colors: brandColors, fonts: brandFonts }}
          onChange={handleBrandingChange}
        />
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

      <StylePickerOverlay
        isOpen={stylePickerOpen}
        onClose={() => setStylePickerOpen(false)}
        styles={allStyles}
        selectedId={selectedStyleId}
        onSelect={setSelectedStyleId}
        onAddCustomStyle={handleAddCustomStyle}
        onDeleteCustomStyle={handleDeleteCustomStyle}
        onUploadImageStyle={handleUploadImageStyle}
        onDeleteImageStyle={handleDeleteImageStyle}
      />

      <GenerationGalleryOverlay
        isOpen={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        items={galleryItems}
        activeId={activeGenerationId}
        onSelect={handleGallerySelect}
        onDelete={handleGalleryDelete}
      />

      <CanvaConnectOverlay
        isOpen={canvaOverlayOpen}
        onClose={() => {
          if (canvaBusy) return
          setCanvaOverlayOpen(false)
          setCanvaSuccess('')
          setCanvaError('')
        }}
        onConnected={() => setCanvaLinked(isCanvaConnected())}
        error={canvaError}
        onClearError={() => setCanvaError('')}
        sending={canvaBusy}
        sendSuccess={canvaSuccess}
      />
    </div>
  )
}
