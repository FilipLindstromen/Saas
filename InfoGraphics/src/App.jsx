import { useState, useEffect, useCallback, useRef } from 'react'
import Canvas from './components/Canvas'
import CanvasControls from './components/CanvasControls'
import LayersPanel from './components/LayersPanel'
import LeftPanel from './components/LeftPanel'
import RightPanel from './components/RightPanel'
import GenerateInput from './components/GenerateInput'
import Toolbar from './components/Toolbar'
import SettingsModal, { loadApiKeys, saveApiKeys } from './components/SettingsModal'
import { applyLayout } from './layouts'
import './App.css'

function getApiHeaders(apiKeys) {
  const h = { 'Content-Type': 'application/json' }
  if (apiKeys?.giphy) h['X-Giphy-Api-Key'] = apiKeys.giphy
  if (apiKeys?.openai) h['X-OpenAI-Api-Key'] = apiKeys.openai
  return h
}

const ASPECT_RATIOS = {
  '16:9': { w: 16, h: 9 },
  '9:16': { w: 9, h: 16 },
  '1:1': { w: 1, h: 1 }
}

let nextId = 1
function createElement(type, overrides = {}, defaults = {}) {
  const defFont = defaults.fontFamily || 'Inter'
  const defSize = defaults.fontSize ?? 14
  const base = {
    id: nextId++,
    type,
    x: 100,
    y: 100,
    width: type === 'headline' ? 300 : type === 'cta' ? 180 : type === 'image' ? 80 : 200,
    height: type === 'headline' ? 60 : type === 'cta' ? 48 : type === 'image' ? 80 : 120,
    rotation: 0,
    text: type === 'headline' ? 'Headline' : type === 'cta' ? 'Click Here' : '',
    imageUrl: (type === 'image-text' || type === 'image') ? '' : null,
    imageSource: null,
    imageTint: null,
    imageTintOpacity: 100,
    fontSize: type === 'headline' ? Math.round(defSize * 1.7) : type === 'cta' ? Math.round(defSize * 1.15) : defSize,
    fontFamily: defFont,
    color: '#000000',
    backgroundColor: type === 'cta' ? '#3b82f6' : null,
    arrowDirection: type === 'arrow' ? 'right' : null,
    arrowStyle: type === 'arrow' ? 'simple' : null,
    zIndex: 0,
    visible: true
  }
  return { ...base, ...overrides }
}

function App() {
  const [aspectRatio, setAspectRatio] = useState('16:9')
  const [resolution, setResolution] = useState(800)
  const [elements, setElements] = useState([])
  const [selectedIds, setSelectedIds] = useState([])
  const [showImageSearch, setShowImageSearch] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [apiKeys, setApiKeys] = useState(() => loadApiKeys())
  const [latestImages, setLatestImages] = useState([])

  const selectedElement = elements.find(e => e.id === selectedIds[0])

  const [backgroundColor, setBackgroundColor] = useState('#ffffff')
  const [zoom, setZoom] = useState(100)
  const [includeBackgroundInExport, setIncludeBackgroundInExport] = useState(true)
  const [defaultFontFamily, setDefaultFontFamily] = useState('Inter')
  const [defaultFontSize, setDefaultFontSize] = useState(14)
  const [leftPanelTab, setLeftPanelTab] = useState('elements')
  const [rightPanelTab, setRightPanelTab] = useState('inspector')
  const [rightPanelWidth, setRightPanelWidth] = useState(320)
  const canvasRef = useRef(null)
  const hasHydrated = useRef(false)
  const undoStack = useRef([])
  const redoStack = useRef([])
  const isRestoring = useRef(false)
  const MAX_HISTORY = 50

  useEffect(() => {
    const saved = localStorage.getItem('infographicsData')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        const { elements: savedElements, aspectRatio: savedRatio, resolution: savedRes, backgroundColor: bg, zoom: savedZoom, selectedId: savedSelectedId, selectedIds: savedSelectedIds, leftPanelTab: savedLeftTab, rightPanelTab: savedTab, rightPanelWidth: savedRightWidth, includeBackgroundInExport: savedIncludeBg, defaultFontFamily: savedFont, defaultFontSize: savedFontSize } = parsed
        if (Array.isArray(savedElements)) {
          setElements(savedElements)
          nextId = savedElements.length > 0 ? Math.max(...savedElements.map(e => e.id), 0) + 1 : 1
          const ids = Array.isArray(savedSelectedIds)
            ? savedSelectedIds.filter(id => savedElements.some(e => e.id === id))
            : savedSelectedId != null && savedElements.some(e => e.id === savedSelectedId)
              ? [savedSelectedId]
              : []
          setSelectedIds(ids)
        }
        if (savedRatio) setAspectRatio(savedRatio)
        if (typeof savedRes === 'number' && [800, 1080, 1920].includes(savedRes)) setResolution(savedRes)
        if (bg) setBackgroundColor(bg)
        if (typeof savedZoom === 'number' && savedZoom >= 25 && savedZoom <= 200) setZoom(savedZoom)
        if (savedLeftTab && ['elements', 'document', 'layouts'].includes(savedLeftTab)) setLeftPanelTab(savedLeftTab)
        else if (savedTab && ['document', 'layouts'].includes(savedTab)) setLeftPanelTab(savedTab)
        if (savedTab && ['inspector', 'layers'].includes(savedTab)) setRightPanelTab(savedTab)
        if (typeof savedRightWidth === 'number' && savedRightWidth >= 200 && savedRightWidth <= 500) setRightPanelWidth(savedRightWidth)
        if (typeof savedIncludeBg === 'boolean') setIncludeBackgroundInExport(savedIncludeBg)
        if (savedFont && typeof savedFont === 'string') setDefaultFontFamily(savedFont)
        if (typeof savedFontSize === 'number' && savedFontSize >= 10 && savedFontSize <= 32) setDefaultFontSize(savedFontSize)
      } catch (e) {
        console.error('Error loading saved data:', e)
      }
    }
    queueMicrotask(() => { hasHydrated.current = true })
    const savedLatest = localStorage.getItem('infographicsLatestImages')
    if (savedLatest) {
      try {
        setLatestImages(JSON.parse(savedLatest))
      } catch (e) {
        console.error('Error loading latest images:', e)
      }
    }
  }, [])

  useEffect(() => {
    if (!hasHydrated.current) return
    localStorage.setItem('infographicsData', JSON.stringify({
      elements,
      aspectRatio,
      resolution,
      backgroundColor,
      zoom,
      selectedIds,
      leftPanelTab,
      rightPanelTab,
      rightPanelWidth,
      includeBackgroundInExport,
      defaultFontFamily,
      defaultFontSize
    }))
  }, [elements, aspectRatio, resolution, backgroundColor, zoom, selectedIds, leftPanelTab, rightPanelTab, rightPanelWidth, includeBackgroundInExport, defaultFontFamily, defaultFontSize])

  const pushUndoState = useCallback((els, ids) => {
    if (isRestoring.current) return
    undoStack.current.push({ elements: JSON.parse(JSON.stringify(els)), selectedIds: [...ids] })
    if (undoStack.current.length > MAX_HISTORY) undoStack.current.shift()
    redoStack.current = []
  }, [])

  const undo = useCallback(() => {
    if (undoStack.current.length === 0) return
    const prev = undoStack.current.pop()
    redoStack.current.push({ elements: JSON.parse(JSON.stringify(elements)), selectedIds: [...selectedIds] })
    isRestoring.current = true
    setElements(prev.elements)
    setSelectedIds(prev.selectedIds)
    isRestoring.current = false
  }, [elements, selectedIds])

  const redo = useCallback(() => {
    if (redoStack.current.length === 0) return
    const next = redoStack.current.pop()
    undoStack.current.push({ elements: JSON.parse(JSON.stringify(elements)), selectedIds: [...selectedIds] })
    isRestoring.current = true
    setElements(next.elements)
    setSelectedIds(next.selectedIds)
    isRestoring.current = false
  }, [elements, selectedIds])

  const addElement = useCallback((type, overrides = {}, indexHint) => {
    pushUndoState(elements, selectedIds)
    const baseY = indexHint != null ? 80 + indexHint * 100 : 100
    const baseX = indexHint != null ? 80 : 100
    const defaults = { fontFamily: defaultFontFamily, fontSize: defaultFontSize }
    const maxZ = elements.length > 0 ? Math.max(...elements.map(e => e.zIndex || 0), 0) : 0
    const el = createElement(type, { ...overrides, x: baseX, y: baseY, zIndex: maxZ + 1 }, defaults)
    setElements(prev => [...prev, el])
    setSelectedIds([el.id])
    return el.id
  }, [defaultFontFamily, defaultFontSize, elements, selectedIds, pushUndoState])

  const updateElement = useCallback((id, updates) => {
    setElements(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e))
  }, [])

  const deleteElement = useCallback((id) => {
    setElements(prev => prev.filter(e => e.id !== id))
    setSelectedIds(prev => prev.filter(x => x !== id))
  }, [])

  const deleteSelected = useCallback(() => {
    pushUndoState(elements, selectedIds)
    setElements(prev => prev.filter(e => !selectedIds.includes(e.id)))
    setSelectedIds([])
  }, [selectedIds, elements, pushUndoState])

  const duplicateSelected = useCallback(() => {
    if (selectedIds.length === 0) return
    pushUndoState(elements, selectedIds)
    const selected = elements.filter(e => selectedIds.includes(e.id))
    if (selected.length === 0) return
    const maxId = elements.length > 0 ? Math.max(...elements.map(e => e.id), 0) : 0
    const maxZ = elements.length > 0 ? Math.max(...elements.map(e => e.zIndex || 0), 0) : 0
    const duplicates = selected.map((el, i) => {
      const dup = JSON.parse(JSON.stringify(el))
      dup.id = maxId + 1 + i
      dup.x = (dup.x || 0) + 15
      dup.y = (dup.y || 0) + 15
      dup.zIndex = maxZ + 1 + i
      return dup
    })
    nextId = maxId + duplicates.length + 1
    setElements(prev => [...prev, ...duplicates])
    setSelectedIds(duplicates.map(d => d.id))
  }, [elements, selectedIds, pushUndoState])

  useEffect(() => {
    if (selectedIds.length > 0) {
      setRightPanelTab('inspector')
    }
  }, [selectedIds])

  useEffect(() => {
    const handleKeyDown = (e) => {
      const target = document.activeElement
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      if (!isInput) {
        if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault()
          if (e.shiftKey) redo()
          else undo()
        }
        if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length > 0) {
          e.preventDefault()
          deleteSelected()
        }
        if (e.key === 'd' && (e.ctrlKey || e.metaKey) && selectedIds.length > 0) {
          e.preventDefault()
          duplicateSelected()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedIds, deleteSelected, duplicateSelected, undo, redo])

  const reorderElement = useCallback((id, direction) => {
    pushUndoState(elements, selectedIds)
    const sorted = [...elements].sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0))
    const idx = sorted.findIndex(e => e.id === id)
    if (idx < 0) return
    if (direction === 'up' && idx > 0) {
      const prevZ = sorted[idx - 1].zIndex ?? 0
      setElements(prev => prev.map(e => e.id === id ? { ...e, zIndex: prevZ + 1 } : e))
    } else if (direction === 'down' && idx < sorted.length - 1) {
      const nextZ = sorted[idx + 1].zIndex ?? 0
      setElements(prev => prev.map(e => e.id === id ? { ...e, zIndex: Math.max(0, nextZ - 1) } : e))
    }
  }, [elements, selectedIds, pushUndoState])

  const reorderToIndex = useCallback((id, targetIndex) => {
    pushUndoState(elements, selectedIds)
    const sorted = [...elements].sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0))
    const fromIdx = sorted.findIndex(e => e.id === id)
    if (fromIdx < 0 || fromIdx === targetIndex) return
    const reordered = [...sorted]
    const [removed] = reordered.splice(fromIdx, 1)
    reordered.splice(targetIndex, 0, removed)
    const updates = {}
    reordered.forEach((el, i) => { updates[el.id] = reordered.length - 1 - i })
    setElements(prev => prev.map(e => (updates[e.id] !== undefined ? { ...e, zIndex: updates[e.id] } : e)))
  }, [elements, selectedIds, pushUndoState])

  const toggleVisibility = useCallback((id) => {
    setElements(prev => prev.map(e => e.id === id ? { ...e, visible: e.visible === false } : e))
  }, [])

  const handleSelect = useCallback((idsOrId, opts = {}) => {
    if (opts.shift && typeof idsOrId === 'number') {
      setSelectedIds(prev => {
        const id = idsOrId
        if (prev.includes(id)) return prev.filter(x => x !== id)
        return [...prev, id]
      })
    } else if (Array.isArray(idsOrId)) {
      setSelectedIds(idsOrId)
    } else if (idsOrId == null) {
      setSelectedIds([])
    } else {
      setSelectedIds([idsOrId])
    }
  }, [])

  const handleApplyLayout = useCallback((layoutId) => {
    pushUndoState(elements, selectedIds)
    const maxId = elements.length > 0 ? Math.max(...elements.map(e => e.id), 0) : 0
    const newElements = applyLayout(layoutId, maxId)
    setElements(newElements)
    setSelectedIds(newElements.length > 0 ? [newElements[0].id] : [])
    if (newElements.length > 0) {
      nextId = Math.max(...newElements.map(e => e.id), 0) + 1
    }
  }, [elements, selectedIds, pushUndoState])

  const addToLatest = useCallback((imageUrl, source, searchQuery) => {
    const entry = { url: imageUrl, source: source || 'giphy', addedAt: Date.now(), searchQuery: searchQuery || undefined }
    setLatestImages(prev => {
      const filtered = prev.filter(i => i.url !== imageUrl)
      const next = [entry, ...filtered].slice(0, 24)
      localStorage.setItem('infographicsLatestImages', JSON.stringify(next))
      return next
    })
  }, [])

  const handleSaveApiKeys = useCallback((keys) => {
    saveApiKeys(keys)
    setApiKeys(keys)
  }, [])

  const handleAddImageToElement = useCallback(async (imageUrl, source, searchQuery) => {
    let finalUrl = imageUrl
    try {
      const res = await fetch('/api/save-image', {
        method: 'POST',
        headers: getApiHeaders(apiKeys),
        body: JSON.stringify({ url: imageUrl })
      })
      if (res.ok) {
        const { url } = await res.json()
        finalUrl = url.startsWith('http') ? url : url
      }
    } catch (_) {
      // Server not available, use original URL
    }
    const layerName = searchQuery?.trim() ? searchQuery.trim().replace(/^\w/, c => c.toUpperCase()) : undefined
    const updates = { imageUrl: finalUrl, imageSource: source }
    if (layerName) updates.layerName = layerName
    if (selectedIds.length > 0) {
      selectedIds.forEach(id => updateElement(id, updates))
    } else {
      addElement('image-text', { ...updates })
    }
    addToLatest(finalUrl, source, searchQuery)
    setShowImageSearch(false)
  }, [selectedIds, updateElement, addElement, addToLatest, apiKeys])

  return (
    <div className="app">
      <Toolbar
        onShowImageSearch={() => setShowImageSearch(true)}
        onOpenSettings={() => setShowSettings(true)}
        canvasRef={canvasRef}
        includeBackgroundInExport={includeBackgroundInExport}
        onBeforeExport={() => {
          const prev = selectedIds
          setSelectedIds([])
          return () => setSelectedIds(prev)
        }}
      />
      <div className="app-main">
        <LeftPanel
          tab={leftPanelTab}
          onTabChange={setLeftPanelTab}
          onAddElement={addElement}
          onApplyLayout={handleApplyLayout}
          aspectRatio={aspectRatio}
          onAspectRatioChange={setAspectRatio}
          resolution={resolution}
          onResolutionChange={setResolution}
          backgroundColor={backgroundColor}
          onBackgroundColorChange={setBackgroundColor}
          includeBackgroundInExport={includeBackgroundInExport}
          onIncludeBackgroundInExportChange={setIncludeBackgroundInExport}
          defaultFontFamily={defaultFontFamily}
          onDefaultFontFamilyChange={setDefaultFontFamily}
          defaultFontSize={defaultFontSize}
          onDefaultFontSizeChange={setDefaultFontSize}
        />
        <div className="app-left">
          <GenerateInput
            onGenerate={async (prompt) => {
              let res
              try {
                res = await fetch('/api/generate', {
                  method: 'POST',
                  headers: getApiHeaders(apiKeys),
                  body: JSON.stringify({ prompt })
                })
              } catch (e) {
                throw new Error('Cannot reach server – start the backend with: npm run server (from InfoGraphics folder)')
              }
              if (!res.ok) {
                let msg = 'Generation failed'
                try {
                  const err = await res.json()
                  if (err?.error) msg = err.error
                } catch (_) {}
                if (res.status === 500 && msg === 'Generation failed') {
                  msg = 'Server error – ensure the backend is running (npm run server from InfoGraphics folder)'
                }
                throw new Error(msg)
              }
              const { steps } = await res.json()
              steps.forEach((step, i) => {
                addElement('image-text', {
                  text: step.text,
                  imageUrl: step.imageUrl || '',
                  imageSource: step.imageSource
                }, i)
              })
            }}
          />
          <CanvasControls
            zoom={zoom}
            onZoomChange={setZoom}
            backgroundColor={backgroundColor}
            onBackgroundColorChange={setBackgroundColor}
          />
          <Canvas
            aspectRatio={aspectRatio}
            resolution={resolution}
            elements={elements}
            canvasRef={canvasRef}
            selectedIds={selectedIds}
            onSelect={handleSelect}
            onUpdate={updateElement}
            onDeleteSelected={deleteSelected}
            onPushUndo={() => pushUndoState(elements, selectedIds)}
            backgroundColor={backgroundColor}
            zoom={zoom}
          />
        </div>
        <RightPanel
          element={selectedElement}
          elements={elements}
          selectedIds={selectedIds}
          tab={rightPanelTab}
          onTabChange={setRightPanelTab}
          onUpdate={(updates) => selectedIds.forEach(id => updateElement(id, updates))}
          onDelete={deleteSelected}
          onSelect={handleSelect}
          onReorder={reorderElement}
          onReorderToIndex={reorderToIndex}
          onToggleVisibility={toggleVisibility}
          onRename={(id, name) => updateElement(id, { layerName: name || undefined })}
          apiKeys={apiKeys}
          latestImages={latestImages}
          onImageSelect={handleAddImageToElement}
          showImageSearch={showImageSearch}
          onCloseImageSearch={() => setShowImageSearch(false)}
          width={rightPanelWidth}
          onResize={setRightPanelWidth}
        />
      </div>
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        apiKeys={apiKeys}
        onSave={handleSaveApiKeys}
      />
    </div>
  )
}

export default App
