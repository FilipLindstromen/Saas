import { useState, useEffect, useCallback, useRef } from 'react'
import Canvas from './components/Canvas'
import CanvasControls from './components/CanvasControls'
import Timeline from './components/Timeline'
import LayersPanel from './components/LayersPanel'
import LeftPanel from './components/LeftPanel'
import RightPanel from './components/RightPanel'
import GenerateInput from './components/GenerateInput'
import Toolbar from './components/Toolbar'
import ProjectSelector from './components/ProjectSelector'
import SettingsModal, { loadApiKeys, saveApiKeys } from './components/SettingsModal'
import ShortcutsModal from './components/ShortcutsModal'
import { applyLayout } from './layouts'
import * as projectStorage from './utils/projectStorage'
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
    const defFont = defaults.fontFamily || defaults.brandFontFamily || 'Inter'
  const defSize = defaults.fontSize ?? 14
  const base = {
    id: nextId++,
    type,
    x: 100,
    y: 100,
    width: type === 'headline' ? 300 : type === 'cta' ? 180 : type === 'image' ? 80 : type === 'gradient' ? 400 : 200,
    height: type === 'headline' ? 60 : type === 'cta' ? 48 : type === 'image' ? 80 : type === 'gradient' ? 300 : 120,
    rotation: 0,
    text: type === 'headline' ? 'Headline' : type === 'cta' ? 'Click Here' : '',
    imageUrl: (type === 'image-text' || type === 'image') ? '' : null,
    imageSource: null,
    imageTint: null,
    imageTintOpacity: 100,
    fontSize: type === 'headline' ? Math.round(defSize * 1.7) : type === 'cta' ? Math.round(defSize * 1.15) : defSize,
    fontFamily: defFont,
    color: '#000000',
    backgroundColor: type === 'cta' ? (defaults.brandPrimaryColor || '#3b82f6') : null,
    arrowDirection: type === 'arrow' ? 'right' : null,
    arrowStyle: type === 'arrow' ? 'simple' : null,
    gradientColor: type === 'gradient' ? '#000000' : null,
    zIndex: 0,
    visible: true,
    clipStart: 0,
    clipEnd: 10,
    animationIn: 'none',
    animationOut: 'none'
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
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [apiKeys, setApiKeys] = useState(() => loadApiKeys())
  const [latestImages, setLatestImages] = useState([])

  const selectedElement = elements.find(e => e.id === selectedIds[0])

  const [backgroundColor, setBackgroundColor] = useState('#ffffff')
  const [zoom, setZoom] = useState(100)
  const [includeBackgroundInExport, setIncludeBackgroundInExport] = useState(true)
  const [defaultFontFamily, setDefaultFontFamily] = useState('Inter')
  const [defaultFontSize, setDefaultFontSize] = useState(14)
  const [brandPrimaryColor, setBrandPrimaryColor] = useState('#3b82f6')
  const [brandSecondaryColor, setBrandSecondaryColor] = useState('#1e40af')
  const [brandFontFamily, setBrandFontFamily] = useState('Inter')
  const [leftPanelTab, setLeftPanelTab] = useState('document')
  const [rightPanelTab, setRightPanelTab] = useState('inspector')
  const [leftPanelWidth, setLeftPanelWidth] = useState(240)
  const [rightPanelWidth, setRightPanelWidth] = useState(320)
  const [timelineDuration, setTimelineDuration] = useState(10)
  const [timelineCurrentTime, setTimelineCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [showTimeline, setShowTimeline] = useState(true)
  const [timelineHeight, setTimelineHeight] = useState(140)
  const [projects, setProjects] = useState([])
  const [currentProjectId, setCurrentProjectId] = useState(null)
  const canvasRef = useRef(null)
  const hasHydrated = useRef(false)
  const undoStack = useRef([])
  const redoStack = useRef([])
  const isRestoring = useRef(false)
  const MAX_HISTORY = 50

  const applyProjectData = useCallback((parsed) => {
    if (!parsed) return
        const { elements: savedElements, aspectRatio: savedRatio, resolution: savedRes, backgroundColor: bg, zoom: savedZoom, selectedId: savedSelectedId, selectedIds: savedSelectedIds, leftPanelTab: savedLeftTab, rightPanelTab: savedTab, leftPanelWidth: savedLeftWidth, rightPanelWidth: savedRightWidth, includeBackgroundInExport: savedIncludeBg, defaultFontFamily: savedFont, defaultFontSize: savedFontSize, timelineDuration: savedTimelineDuration, timelineHeight: savedTimelineHeight, brandPrimaryColor: savedBrandPrimary, brandSecondaryColor: savedBrandSecondary, brandFontFamily: savedBrandFont } = parsed
    if (Array.isArray(savedElements)) {
      const duration = typeof parsed.timelineDuration === 'number' ? parsed.timelineDuration : 10
      const normalized = savedElements.map(e => ({
        ...e,
        clipStart: typeof e.clipStart === 'number' ? e.clipStart : 0,
        clipEnd: typeof e.clipEnd === 'number' ? e.clipEnd : duration,
        animationIn: e.animationIn || 'none',
        animationOut: e.animationOut || 'none',
        gradientColor: e.type === 'gradient' ? (e.gradientColor || '#000000') : e.gradientColor
      }))
      setElements(normalized)
      nextId = savedElements.length > 0 ? Math.max(...savedElements.map(e => e.id), 0) + 1 : 1
      const ids = Array.isArray(savedSelectedIds)
        ? savedSelectedIds.filter(id => savedElements.some(e => e.id === id))
        : savedSelectedId != null && savedElements.some(e => e.id === savedSelectedId)
          ? [savedSelectedId]
          : []
      setSelectedIds(ids)
      const earliestStart = normalized.length > 0 ? Math.min(...normalized.map(e => e.clipStart ?? 0)) : 0
      setTimelineCurrentTime(earliestStart)
    }
    if (savedRatio) setAspectRatio(savedRatio)
    if (typeof savedRes === 'number' && [800, 1080, 1920].includes(savedRes)) setResolution(savedRes)
    if (bg) setBackgroundColor(bg)
    if (typeof savedZoom === 'number' && savedZoom >= 25 && savedZoom <= 200) setZoom(savedZoom)
    if (savedLeftTab && ['document', 'layouts', 'brand'].includes(savedLeftTab)) setLeftPanelTab(savedLeftTab)
    else if (savedTab && ['document', 'layouts'].includes(savedTab)) setLeftPanelTab(savedTab)
    if (savedTab && ['inspector', 'layers'].includes(savedTab)) setRightPanelTab(savedTab)
    if (typeof savedLeftWidth === 'number' && savedLeftWidth >= 180 && savedLeftWidth <= 400) setLeftPanelWidth(savedLeftWidth)
    if (typeof savedRightWidth === 'number' && savedRightWidth >= 200 && savedRightWidth <= 500) setRightPanelWidth(savedRightWidth)
    if (typeof savedIncludeBg === 'boolean') setIncludeBackgroundInExport(savedIncludeBg)
    if (savedFont && typeof savedFont === 'string') setDefaultFontFamily(savedFont)
    if (typeof savedFontSize === 'number' && savedFontSize >= 10 && savedFontSize <= 32) setDefaultFontSize(savedFontSize)
    if (typeof savedTimelineDuration === 'number' && savedTimelineDuration >= 1 && savedTimelineDuration <= 300) setTimelineDuration(savedTimelineDuration)
    if (typeof parsed.showTimeline === 'boolean') setShowTimeline(parsed.showTimeline)
    if (typeof savedTimelineHeight === 'number' && savedTimelineHeight >= 80 && savedTimelineHeight <= 400) setTimelineHeight(savedTimelineHeight)
    if (savedBrandPrimary && /^#[0-9a-fA-F]{6}$/.test(savedBrandPrimary)) setBrandPrimaryColor(savedBrandPrimary)
    if (savedBrandSecondary && /^#[0-9a-fA-F]{6}$/.test(savedBrandSecondary)) setBrandSecondaryColor(savedBrandSecondary)
    if (savedBrandFont && typeof savedBrandFont === 'string') setBrandFontFamily(savedBrandFont)
  }, [])

  useEffect(() => {
    let projectList = projectStorage.loadProjects()
    let projectId = projectStorage.loadCurrentProjectId()

    const legacy = projectStorage.migrateLegacyData()
    if (legacy && projectList.length === 0) {
      const id = projectStorage.generateProjectId()
      projectList = [{ id, name: 'Untitled', updatedAt: Date.now() }]
      projectStorage.saveProjectData(id, legacy)
      projectStorage.saveProjects(projectList)
      projectStorage.saveCurrentProjectId(id)
      projectStorage.clearLegacyData()
      projectId = id
    }

    if (projectList.length === 0) {
      const id = projectStorage.generateProjectId()
      projectList = [{ id, name: 'Untitled', updatedAt: Date.now() }]
      projectStorage.saveProjects(projectList)
      projectStorage.saveCurrentProjectId(id)
      projectId = id
    }

    if (!projectId || !projectList.some(p => p.id === projectId)) {
      projectId = projectList[0].id
      projectStorage.saveCurrentProjectId(projectId)
    }

    setProjects(projectList)
    setCurrentProjectId(projectId)

    const data = projectStorage.loadProjectData(projectId)
    if (data) {
      try {
        applyProjectData(data)
      } catch (e) {
        console.error('Error loading project:', e)
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
  }, [applyProjectData])

  useEffect(() => {
    if (!hasHydrated.current || !currentProjectId) return
    const data = {
      elements,
      aspectRatio,
      resolution,
      backgroundColor,
      zoom,
      selectedIds,
      leftPanelTab,
      rightPanelTab,
      leftPanelWidth,
      rightPanelWidth,
      includeBackgroundInExport,
      defaultFontFamily,
      defaultFontSize,
      timelineDuration,
      showTimeline,
      timelineHeight,
      brandPrimaryColor,
      brandSecondaryColor,
      brandFontFamily
    }
    projectStorage.saveProjectData(currentProjectId, data)
  }, [currentProjectId, elements, aspectRatio, resolution, backgroundColor, zoom, selectedIds, leftPanelTab, rightPanelTab, leftPanelWidth, rightPanelWidth, includeBackgroundInExport, defaultFontFamily, defaultFontSize, timelineDuration, showTimeline, timelineHeight, brandPrimaryColor, brandSecondaryColor, brandFontFamily])

  const createProject = useCallback(() => {
    const id = projectStorage.generateProjectId()
    const newProject = { id, name: 'Untitled', updatedAt: Date.now() }
    const updated = [...projects, newProject]
    projectStorage.saveProjects(updated)
    projectStorage.saveCurrentProjectId(id)
    projectStorage.saveProjectData(id, {
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
    })
    setProjects(updated)
    setCurrentProjectId(id)
    setElements([])
    setSelectedIds([])
    setAspectRatio('16:9')
    setResolution(800)
    setBackgroundColor('#ffffff')
    setZoom(100)
    setLeftPanelTab('document')
    setRightPanelTab('inspector')
    setLeftPanelWidth(240)
    setRightPanelWidth(320)
    setIncludeBackgroundInExport(true)
    setDefaultFontFamily('Inter')
    setDefaultFontSize(14)
    setBrandPrimaryColor('#3b82f6')
    setBrandSecondaryColor('#1e40af')
    setBrandFontFamily('Inter')
    setTimelineDuration(10)
    setShowTimeline(true)
    setTimelineHeight(140)
    undoStack.current = []
    redoStack.current = []
    nextId = 1
  }, [projects])

  const saveCurrentProjectToStorage = useCallback(() => {
    if (!currentProjectId) return
    projectStorage.saveProjectData(currentProjectId, {
      elements,
      aspectRatio,
      resolution,
      backgroundColor,
      zoom,
      selectedIds,
      leftPanelTab,
      rightPanelTab,
      leftPanelWidth,
      rightPanelWidth,
      includeBackgroundInExport,
      defaultFontFamily,
      defaultFontSize,
      timelineDuration,
      showTimeline,
      timelineHeight,
      brandPrimaryColor,
      brandSecondaryColor,
      brandFontFamily
    })
  }, [currentProjectId, elements, aspectRatio, resolution, backgroundColor, zoom, selectedIds, leftPanelTab, rightPanelTab, leftPanelWidth, rightPanelWidth, includeBackgroundInExport, defaultFontFamily, defaultFontSize, timelineDuration, showTimeline, timelineHeight, brandPrimaryColor, brandSecondaryColor, brandFontFamily])

  const switchProject = useCallback((id) => {
    if (id === currentProjectId) return
    saveCurrentProjectToStorage()
    const data = projectStorage.loadProjectData(id)
    if (data) {
      isRestoring.current = true
      applyProjectData(data)
      isRestoring.current = false
    } else {
      setElements([])
      setSelectedIds([])
      setTimelineCurrentTime(0)
      nextId = 1
    }
    projectStorage.saveCurrentProjectId(id)
    setCurrentProjectId(id)
    undoStack.current = []
    redoStack.current = []
  }, [currentProjectId, applyProjectData, saveCurrentProjectToStorage])

  const renameProject = useCallback((id, name) => {
    if (!name.trim()) return
    const updated = projects.map(p => p.id === id ? { ...p, name: name.trim(), updatedAt: Date.now() } : p)
    projectStorage.saveProjects(updated)
    setProjects(updated)
  }, [projects])

  const deleteProject = useCallback((id) => {
    if (projects.length <= 1) return
    const idx = projects.findIndex(p => p.id === id)
    const nextIdToSwitch = idx > 0 ? projects[idx - 1].id : projects[idx + 1]?.id
    const updated = projects.filter(p => p.id !== id)
    projectStorage.saveProjects(updated)
    projectStorage.deleteProjectData(id)
    if (id === currentProjectId && nextIdToSwitch) {
      switchProject(nextIdToSwitch)
    } else if (id === currentProjectId) {
      setCurrentProjectId(updated[0]?.id || null)
      projectStorage.saveCurrentProjectId(updated[0]?.id || null)
    }
    setProjects(updated)
  }, [projects, currentProjectId, switchProject])

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
    const defaults = {
      fontFamily: brandFontFamily || defaultFontFamily,
      fontSize: defaultFontSize,
      brandFontFamily: brandFontFamily,
      brandPrimaryColor: brandPrimaryColor,
      brandSecondaryColor: brandSecondaryColor
    }
    const maxZ = elements.length > 0 ? Math.max(...elements.map(e => e.zIndex || 0), 0) : 0
    const clipDefaults = { clipStart: 0, clipEnd: timelineDuration }
    const el = createElement(type, { ...clipDefaults, ...overrides, x: baseX, y: baseY, zIndex: maxZ + 1 }, defaults)
    setElements(prev => [...prev, el])
    setSelectedIds([el.id])
    return el.id
  }, [defaultFontFamily, defaultFontSize, brandFontFamily, brandPrimaryColor, brandSecondaryColor, elements, selectedIds, pushUndoState, timelineDuration])

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
    if (elements.length === 0) return
    const earliestStart = Math.min(...elements.map(e => e.clipStart ?? 0))
    if (timelineCurrentTime === 0 && earliestStart > 0) {
      setTimelineCurrentTime(earliestStart)
    }
  }, [elements])

  useEffect(() => {
    setElements(prev => {
      const needsClamp = prev.some(e => (e.clipEnd ?? timelineDuration) > timelineDuration)
      if (!needsClamp) return prev
      return prev.map(e => {
        const start = e.clipStart ?? 0
        const end = e.clipEnd ?? timelineDuration
        if (end > timelineDuration) {
          return { ...e, clipEnd: timelineDuration, clipStart: Math.min(start, Math.max(0, timelineDuration - 0.5)) }
        }
        return e
      })
    })
  }, [timelineDuration])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = document.activeElement
        const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
        if (!isInput) {
          e.preventDefault()
          setShowShortcuts(s => !s)
        }
        return
      }
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
        if (e.key === 'l' && (e.ctrlKey || e.metaKey) && selectedIds.length >= 2) {
          e.preventDefault()
          alignElements('left')
        }
        if (e.key === 'e' && (e.ctrlKey || e.metaKey) && selectedIds.length >= 2) {
          e.preventDefault()
          alignElements('center')
        }
        if (e.key === 'r' && (e.ctrlKey || e.metaKey) && selectedIds.length >= 2) {
          e.preventDefault()
          alignElements('right')
        }
        if (e.key === 't' && (e.ctrlKey || e.metaKey) && selectedIds.length >= 2) {
          e.preventDefault()
          alignElements('top')
        }
        if (e.key === 'm' && (e.ctrlKey || e.metaKey) && selectedIds.length >= 2) {
          e.preventDefault()
          alignElements('middle')
        }
        if (e.key === 'b' && (e.ctrlKey || e.metaKey) && selectedIds.length >= 2) {
          e.preventDefault()
          alignElements('bottom')
        }
        if (e.key === 'H' && (e.ctrlKey || e.metaKey) && e.shiftKey && selectedIds.length >= 3) {
          e.preventDefault()
          distributeElements('horizontal')
        }
        if (e.key === 'V' && (e.ctrlKey || e.metaKey) && e.shiftKey && selectedIds.length >= 3) {
          e.preventDefault()
          distributeElements('vertical')
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedIds, deleteSelected, duplicateSelected, undo, redo, alignElements, distributeElements])

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

  const alignElements = useCallback((align) => {
    if (selectedIds.length < 2) return
    pushUndoState(elements, selectedIds)
    const selected = elements.filter(e => selectedIds.includes(e.id))
    const minX = Math.min(...selected.map(e => e.x))
    const maxX = Math.max(...selected.map(e => e.x + e.width))
    const minY = Math.min(...selected.map(e => e.y))
    const maxY = Math.max(...selected.map(e => e.y + e.height))
    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2
    setElements(prev => prev.map(e => {
      if (!selectedIds.includes(e.id)) return e
      const updates = {}
      if (align === 'left') updates.x = minX
      else if (align === 'right') updates.x = maxX - e.width
      else if (align === 'center') updates.x = centerX - e.width / 2
      else if (align === 'top') updates.y = minY
      else if (align === 'bottom') updates.y = maxY - e.height
      else if (align === 'middle') updates.y = centerY - e.height / 2
      return { ...e, ...updates }
    }))
  }, [selectedIds, elements, pushUndoState])

  const distributeElements = useCallback((direction) => {
    if (selectedIds.length < 3) return
    pushUndoState(elements, selectedIds)
    const selected = elements.filter(e => selectedIds.includes(e.id))
    const sorted = direction === 'horizontal'
      ? [...selected].sort((a, b) => a.x - b.x)
      : [...selected].sort((a, b) => a.y - b.y)
    const first = direction === 'horizontal' ? sorted[0].x : sorted[0].y
    const last = direction === 'horizontal'
      ? sorted[sorted.length - 1].x + sorted[sorted.length - 1].width
      : sorted[sorted.length - 1].y + sorted[sorted.length - 1].height
    const totalSize = sorted.reduce((sum, e) => sum + (direction === 'horizontal' ? e.width : e.height), 0)
    const gap = (last - first - totalSize) / (sorted.length - 1)
    let pos = first
    const updates = {}
    sorted.forEach(el => {
      if (direction === 'horizontal') {
        updates[el.id] = { x: pos }
        pos += el.width + gap
      } else {
        updates[el.id] = { y: pos }
        pos += el.height + gap
      }
    })
    setElements(prev => prev.map(e => updates[e.id] ? { ...e, ...updates[e.id] } : e))
  }, [selectedIds, elements, pushUndoState])

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

  const applyBrandToSelection = useCallback(() => {
    if (selectedIds.length === 0) return
    pushUndoState(elements, selectedIds)
    const updates = {
      fontFamily: brandFontFamily,
      color: brandPrimaryColor
    }
    setElements(prev => prev.map(e =>
      selectedIds.includes(e.id)
        ? { ...e, ...updates, ...(e.type === 'cta' ? { backgroundColor: brandPrimaryColor } : {}), ...(e.type === 'gradient' ? { gradientColor: brandSecondaryColor } : {}) }
        : e
    ))
  }, [selectedIds, elements, pushUndoState, brandFontFamily, brandPrimaryColor, brandSecondaryColor])

  const applyBrandToAll = useCallback(() => {
    if (elements.length === 0) return
    pushUndoState(elements, selectedIds)
    setElements(prev => prev.map(e => ({
      ...e,
      fontFamily: brandFontFamily,
      color: brandPrimaryColor,
      ...(e.type === 'cta' ? { backgroundColor: brandPrimaryColor } : {}),
      ...(e.type === 'gradient' ? { gradientColor: brandSecondaryColor } : {})
    })))
  }, [elements, selectedIds, pushUndoState, brandFontFamily, brandPrimaryColor, brandSecondaryColor])

  const handleApplyLayout = useCallback((layoutId) => {
    pushUndoState(elements, selectedIds)
    const maxId = elements.length > 0 ? Math.max(...elements.map(e => e.id), 0) : 0
    const raw = applyLayout(layoutId, maxId)
    const newElements = raw.map(e => ({
      ...e,
      clipStart: e.clipStart ?? 0,
      clipEnd: e.clipEnd ?? timelineDuration,
      animationIn: e.animationIn ?? 'none',
      animationOut: e.animationOut ?? 'none'
    }))
    setElements(newElements)
    setSelectedIds(newElements.length > 0 ? [newElements[0].id] : [])
    if (newElements.length > 0) {
      nextId = Math.max(...newElements.map(e => e.id), 0) + 1
    }
  }, [elements, selectedIds, pushUndoState, timelineDuration])

  const addToLatest = useCallback((imageUrl, source, searchQuery) => {
    const entry = { url: imageUrl, source: source || 'giphy', addedAt: Date.now(), searchQuery: searchQuery || undefined }
    setLatestImages(prev => {
      const filtered = prev.filter(i => i.url !== imageUrl)
      const next = [entry, ...filtered].slice(0, 48)
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
        projects={projects}
        currentProjectId={currentProjectId}
        currentProjectName={projects.find(p => p.id === currentProjectId)?.name}
        onSwitchProject={switchProject}
        onCreateProject={createProject}
        onRenameProject={renameProject}
        onDeleteProject={deleteProject}
        onOpenSettings={() => setShowSettings(true)}
        onShowShortcuts={() => setShowShortcuts(true)}
        onAddElement={addElement}
        showTimeline={showTimeline}
        onToggleTimeline={() => setShowTimeline(v => !v)}
        canvasRef={canvasRef}
        includeBackgroundInExport={includeBackgroundInExport}
        onBeforeExport={() => {
          const prev = selectedIds
          setSelectedIds([])
          return () => setSelectedIds(prev)
        }}
        canvasData={{
          format: 'infographics',
          version: 1,
          elements,
          aspectRatio,
          resolution,
          backgroundColor,
          defaultFontFamily,
          defaultFontSize,
          timelineDuration
        }}
      />
      <div className="app-main">
        <LeftPanel
          tab={leftPanelTab}
          onTabChange={setLeftPanelTab}
          onApplyLayout={handleApplyLayout}
          width={leftPanelWidth}
          onResize={setLeftPanelWidth}
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
          brandPrimaryColor={brandPrimaryColor}
          brandSecondaryColor={brandSecondaryColor}
          brandFontFamily={brandFontFamily}
          onBrandPrimaryColorChange={setBrandPrimaryColor}
          onBrandSecondaryColorChange={setBrandSecondaryColor}
          onBrandFontFamilyChange={setBrandFontFamily}
          onApplyBrandToSelection={applyBrandToSelection}
          onApplyBrandToAll={applyBrandToAll}
          hasSelection={selectedIds.length > 0}
          hasElements={elements.length > 0}
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
            currentTime={timelineCurrentTime}
            canvasRef={canvasRef}
            selectedIds={selectedIds}
            onSelect={handleSelect}
            onUpdate={updateElement}
            onDeleteSelected={deleteSelected}
            onPushUndo={() => pushUndoState(elements, selectedIds)}
            backgroundColor={backgroundColor}
            zoom={zoom}
          />
          {showTimeline && (
          <Timeline
            height={timelineHeight}
            onResize={setTimelineHeight}
            elements={elements}
            duration={timelineDuration}
            currentTime={timelineCurrentTime}
            onCurrentTimeChange={setTimelineCurrentTime}
            onDurationChange={setTimelineDuration}
            onUpdateClip={(id, updates) => updateElement(id, updates)}
            onClipEditStart={() => pushUndoState(elements, selectedIds)}
            onSelect={handleSelect}
            selectedIds={selectedIds}
            isPlaying={isPlaying}
            onPlayPause={setIsPlaying}
          />
          )}
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
      <ShortcutsModal
        isOpen={showShortcuts}
        onClose={() => setShowShortcuts(false)}
      />
    </div>
  )
}

export default App
