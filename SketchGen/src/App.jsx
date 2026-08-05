import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import TopBar from './components/TopBar'
import CanvasBoard from './components/CanvasBoard'
import Toolbar from './components/Toolbar'
import StyleGrid from './components/StyleGrid'
import PromptBar from './components/PromptBar'
import ResultView from './components/ResultView'
import ImportPanel from './components/ImportPanel'
import HistoryGallery from './components/HistoryGallery'
import SettingsModal from '@shared/SettingsModal/SettingsModal'
import { getTheme, setTheme as persistTheme, initThemeSync } from '@shared/theme'
import { STYLES, DEFAULT_STYLE_ID } from './constants/styles'
import { generateStyledImage } from './api/generate'
import { kvGet, kvSet, addGeneration, getAllGenerations, deleteGeneration, pruneGenerations } from './utils/db'
import { loadCustomStyles, addCustomStyle, deleteCustomStyle } from './utils/customStyles'
import './App.css'

const CANVAS_SNAPSHOT_KEY = 'canvas-snapshot'
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

export default function App() {
  const canvasRef = useRef(null)
  const autosaveTimerRef = useRef(null)

  const [theme, setThemeState] = useState(getTheme())
  const [tool, setTool] = useState('pen')
  const [color, setColor] = useState('#1a1a1a')
  const [size, setSize] = useState(6)
  const [zoom, setZoom] = useState(1)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  const [customStyles, setCustomStyles] = useState(() => loadCustomStyles())
  const allStyles = useMemo(() => [...STYLES, ...customStyles], [customStyles])
  const [selectedStyleId, setSelectedStyleId] = useState(DEFAULT_STYLE_ID)
  const [instructions, setInstructions] = useState('')
  const [variations, setVariations] = useState(1)

  const [view, setView] = useState('sketch')
  const [sketchSnapshot, setSketchSnapshot] = useState(null)
  const [generatedImage, setGeneratedImage] = useState(null)
  const [activeGenerationId, setActiveGenerationId] = useState(null)
  const [generationHistory, setGenerationHistory] = useState([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [placing, setPlacing] = useState(null)

  // Restore autosaved canvas + generation history on mount.
  useEffect(() => {
    (async () => {
      try {
        const snapshot = await kvGet(CANVAS_SNAPSHOT_KEY)
        if (snapshot) await canvasRef.current?.restoreSnapshot(snapshot)
      } catch {
        // ignore restore failures — user just starts with a blank canvas
      }
      try {
        const history = await getAllGenerations()
        setGenerationHistory(history)
      } catch {
        // ignore
      }
    })()
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
      if (!board) return
      kvSet(CANVAS_SNAPSHOT_KEY, board.exportPNG()).catch(() => {})
    }, AUTOSAVE_DEBOUNCE_MS)
  }, [])

  useEffect(() => () => {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
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

  const handleAddCustomStyle = useCallback(({ name, prompt }) => {
    const next = addCustomStyle({ name, prompt })
    setCustomStyles(next)
  }, [])

  const handleDeleteCustomStyle = useCallback((id) => {
    const next = deleteCustomStyle(id)
    setCustomStyles(next)
    if (selectedStyleId === id) setSelectedStyleId(DEFAULT_STYLE_ID)
  }, [selectedStyleId])

  const refreshHistory = useCallback(async () => {
    const history = await getAllGenerations()
    setGenerationHistory(history)
  }, [])

  const handleSelectHistoryEntry = useCallback((entry) => {
    setSketchSnapshot(entry.sketchDataUrl)
    setGeneratedImage(entry.dataUrl)
    setActiveGenerationId(entry.id)
    setView((v) => (v === 'sketch' ? 'generated' : v))
  }, [])

  const handleDeleteHistoryEntry = useCallback(async (id) => {
    await deleteGeneration(id)
    const history = await getAllGenerations()
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
    if (!board?.hasContent?.()) {
      setError('Draw something on the canvas first.')
      return
    }
    const style = allStyles.find((s) => s.id === selectedStyleId) || allStyles[0]
    const sketchDataUrl = board.exportPNG()
    setIsGenerating(true)
    try {
      const results = await Promise.all(
        Array.from({ length: variations }, () => generateStyledImage({ sketchDataUrl, style, instructions }))
      )
      const batchId = `batch-${Date.now()}`
      const createdAt = Date.now()
      const entries = results.map((dataUrl, i) => ({
        id: `${batchId}-${i}`,
        batchId,
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
      await pruneGenerations()
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
  }, [allStyles, selectedStyleId, instructions, variations, refreshHistory])

  const handleDownload = useCallback(() => {
    if (!generatedImage) return
    const link = document.createElement('a')
    link.href = generatedImage
    link.download = 'sketchgen-result.png'
    link.click()
  }, [generatedImage])

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
      />

      {error && (
        <div className="app-error-banner">
          <span>{error}</span>
          <button type="button" onClick={() => setError('')} aria-label="Dismiss">×</button>
        </div>
      )}

      <div className="app-body">
        <main className="app-main">
          {view === 'sketch' && (
            <Toolbar
              tool={tool}
              onToolChange={setTool}
              color={color}
              onColorChange={setColor}
              size={size}
              onSizeChange={setSize}
              onUndo={handleUndo}
              onRedo={handleRedo}
              onClear={handleClear}
              canUndo={canUndo}
              canRedo={canRedo}
              zoom={zoom}
              onZoomChange={setZoom}
              onImportFile={handleImportFile}
            />
          )}

          <div className="app-canvas-area" style={{ display: view === 'sketch' ? 'flex' : 'none', flex: 1, minHeight: 0 }}>
            <CanvasBoard
              ref={canvasRef}
              tool={tool}
              color={color}
              size={size}
              zoom={zoom}
              placing={placing}
              onPlaced={handlePlaced}
              onDropFile={handleImportFile}
              onHistoryChange={({ canUndo: cu, canRedo: cr }) => {
                setCanUndo(cu)
                setCanRedo(cr)
              }}
              onCommit={scheduleAutosave}
            />
          </div>

          {view !== 'sketch' && generatedImage && (
            <ResultView
              view={view}
              sketchDataUrl={sketchSnapshot}
              generatedDataUrl={generatedImage}
              onUseAsSketch={handleUseAsSketch}
            />
          )}
        </main>

        <aside className="app-sidebar">
          {view === 'sketch' && (
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
    </div>
  )
}
