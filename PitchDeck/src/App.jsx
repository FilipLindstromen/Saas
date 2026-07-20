import { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from 'react'
import { loadApiKeys, saveApiKeys } from '@shared/apiKeys'
import { getTheme, setTheme as setSharedTheme, initThemeSync } from '@shared/theme'
import SlideList from './components/SlideList'
import SlidePreview from './components/SlidePreview'
import PlanMode from './components/PlanMode'
import Settings from './components/Settings'
import ShortcutsModal from './components/ShortcutsModal'
import CommandPalette from './components/CommandPalette'
import AppHeader from './components/AppHeader'
import InspectorPanel from './components/InspectorPanel'
import { normalizeInspectorTab } from './components/InspectorIcons'
import TypographyOptions, { SERIF_OPTIONS } from './components/TypographyOptions'
import InstagramCarouselExportModal from './components/InstagramCarouselExportModal'
import { formatTimeAgo } from './utils/formatTimeAgo'
import { isInstagramCarouselFormat } from './utils/slideFormats'
import { normalizeSlide } from './utils/normalizeSlide'
import { normalizeWebcamSizePercent } from './utils/webcamSize'
import { useUndoRedo } from './hooks/useUndoRedo'
import { searchStockVideo } from './api/videoSearch'
import { formatSlidesForClipboard } from './utils/slidePlainText'
import { copyTextToClipboard } from './utils/clipboard'
import { generateMediaSearchQuery, getSlideSearchKeywords } from './utils/mediaSearchQuery'
import './App.css'

const ProjectOverview = lazy(() => import('./components/ProjectOverview'))
const PlayMode = lazy(() => import('./components/PlayMode'))
const VideoEditingMode = lazy(() => import('./components/VideoEditingMode'))
// Dynamic import keeps IndexedDB folder helpers out of the initial graph when unused
const getProjectFolderStorage = () => import('@shared/projectFolderStorage')

const PERSISTED_APP_MODES = ['plan', 'edit']

function readPersistedAppMode() {
  try {
    const saved = localStorage.getItem('pitchDeckMode')
    if (PERSISTED_APP_MODES.includes(saved)) return saved
  } catch (_) {}
  return 'plan'
}

function App() {
  const makeDefaultSlides = () => ([
    {
      id: 1,
      content: 'IF YOU WANT TO FEEL CALM & IN CONTROL',
      subtitle: '',
      imageUrl: '',
      backgroundVideoUrl: '',
      layout: 'default',
      gradientStrength: 0.7,
      flipHorizontal: false,
      backgroundOpacity: 0.6,
      gradientFlipped: false,
      imageScale: 1.0,
      imagePositionX: 50,
      imagePositionY: 50,
      textHeadingLevel: null,
      subtitleHeadingLevel: null,
      infographicProjectId: undefined,
      infographicTabId: undefined,
      graphicOverlays: [],
      subSlides: [],
    },
  ])

  // Load slides and selectedSlideId from localStorage on initial mount
  const loadSavedData = () => {
    try {
      const savedSlides = localStorage.getItem('pitchDeckSlides')
      const savedSelectedId = localStorage.getItem('pitchDeckSelectedId')
      
      if (savedSlides) {
        const parsedSlides = JSON.parse(savedSlides)
        if (Array.isArray(parsedSlides) && parsedSlides.length > 0) {
          // Ensure all slides have layout, gradientStrength, flipHorizontal, backgroundOpacity, gradientFlipped, and subtitle properties for backward compatibility
          const slidesWithLayout = parsedSlides.map(slide => ({
            ...slide,
            layout: slide.layout || 'default',
            gradientStrength: slide.gradientStrength !== undefined ? slide.gradientStrength : 0.7,
            flipHorizontal: slide.flipHorizontal !== undefined ? slide.flipHorizontal : false,
            backgroundOpacity: slide.backgroundOpacity !== undefined ? slide.backgroundOpacity : 0.6,
            gradientFlipped: slide.gradientFlipped !== undefined ? slide.gradientFlipped : false,
            subtitle: slide.subtitle || '',
            backgroundVideoUrl: slide.backgroundVideoUrl ?? '',
            imageScale: slide.imageScale !== undefined ? slide.imageScale : 1.0,
            imagePositionX: slide.imagePositionX !== undefined ? slide.imagePositionX : 50,
            imagePositionY: slide.imagePositionY !== undefined ? slide.imagePositionY : 50,
            textHeadingLevel: slide.textHeadingLevel || null,
            subtitleHeadingLevel: slide.subtitleHeadingLevel || null,
            graphicOverlays: Array.isArray(slide.graphicOverlays) ? slide.graphicOverlays : [],
            subSlides: Array.isArray(slide.subSlides) ? slide.subSlides : []
          }))
          return {
            slides: slidesWithLayout,
            selectedId: savedSelectedId ? parseInt(savedSelectedId, 10) : slidesWithLayout[0].id
          }
        }
      }
    } catch (error) {
      console.error('Error loading saved data:', error)
    }
    
    // Default template if no saved data
    return { slides: makeDefaultSlides(), selectedId: 1 }
  }

  const initialData = loadSavedData()
  // Ensure selectedId exists in slides, fallback to first slide
  const validSelectedId = initialData.slides.find(s => s.id === initialData.selectedId) 
    ? initialData.selectedId 
    : initialData.slides[0]?.id || 1
  
  const [chapters, setChapters] = useState(() => {
    const saved = localStorage.getItem('pitchDeckChapters')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) {
          const normalized = parsed
            .map((chapter, index) => {
              const chapterId = Number(chapter?.id)
              const chapterSlides = Array.isArray(chapter?.slides) ? chapter.slides : []
              return {
                id: Number.isFinite(chapterId) ? chapterId : index + 1,
                name: typeof chapter?.name === 'string' && chapter.name.trim() ? chapter.name : `Chapter ${index + 1}`,
                slides: chapterSlides,
              }
            })
            .filter((chapter) => Array.isArray(chapter.slides) && chapter.slides.length > 0)
          if (normalized.length > 0) return normalized
        }
      } catch (e) {
        console.error('Error parsing chapters:', e)
      }
    }
    // Default: create one chapter with existing slides
    return [{
      id: 1,
      name: 'Chapter 1',
      slides: initialData.slides
    }]
  })
  const [currentChapterId, setCurrentChapterId] = useState(() => {
    const saved = localStorage.getItem('pitchDeckCurrentChapterId')
    const parsed = saved ? parseInt(saved, 10) : NaN
    return Number.isFinite(parsed) ? parsed : 1
  })
  const [slides, setSlides] = useState(() => {
    const currentChapter = chapters.find(c => c.id === currentChapterId) || chapters[0]
    return currentChapter ? currentChapter.slides : initialData.slides
  })
  const [selectedSlideId, setSelectedSlideId] = useState(validSelectedId)
  const [mode, setMode] = useState(readPersistedAppMode)
  const lastRecordingBlobRef = useRef(null)
  const [lastRecordingBlobVersion, setLastRecordingBlobVersion] = useState(0)
  const [isRecordingInPlace, setIsRecordingInPlace] = useState(false)
  const recordingMediaRecorderRef = useRef(null)
  const recordingChunksRef = useRef([])
  const recordingStreamRef = useRef(null)
  const recordingAudioStreamRef = useRef(null)
  const recordingAudioContextRef = useRef(null)
  const [editingVideoBlob, setEditingVideoBlob] = useState(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [chapterMenuOpen, setChapterMenuOpen] = useState(false)
  const [inspectorTab, setInspectorTabState] = useState(() => {
    try {
      return normalizeInspectorTab(localStorage.getItem('pitchDeckInspectorTab') || 'layout')
    } catch {
      return 'layout'
    }
  })
  const setInspectorTab = useCallback((tab) => {
    setInspectorTabState(normalizeInspectorTab(tab))
  }, [])
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('pitchDeckSidebarCollapsed') === 'true')
  const [inspectorDrawerOpen, setInspectorDrawerOpen] = useState(false)
  const previousModeRef = useRef(readPersistedAppMode())
  const [theme, setTheme] = useState(() => getTheme())
  const [showProjectOverview, setShowProjectOverview] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [selectedSlides, setSelectedSlides] = useState(new Set())
  const [selectedGraphicId, setSelectedGraphicId] = useState(null)
  const [selectedSubSlideId, setSelectedSubSlideId] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState(null)
  const [isExportingPng, setIsExportingPng] = useState(false)
  const [isBulkSelectingVideos, setIsBulkSelectingVideos] = useState(false)
  const [exportProgress, setExportProgress] = useState('')
  const [showInstagramExport, setShowInstagramExport] = useState(false)
  const [recentFiles, setRecentFiles] = useState(() => {
    try {
      const saved = localStorage.getItem('pitchDeckRecentFiles')
      if (!saved) return []
      const parsed = JSON.parse(saved)
      return Array.isArray(parsed) ? parsed : []
    } catch (e) {
      return []
    }
  })
  const [workspaces, setWorkspaces] = useState(() => {
    try {
      const saved = localStorage.getItem('pitchDeckWorkspaces')
      if (!saved) return [{ id: 'default', name: 'Default Workspace' }]
      const parsed = JSON.parse(saved)
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : [{ id: 'default', name: 'Default Workspace' }]
    } catch (e) {
      return [{ id: 'default', name: 'Default Workspace' }]
    }
  })
  const [currentWorkspace, setCurrentWorkspace] = useState(() => {
    return localStorage.getItem('pitchDeckCurrentWorkspace') || 'default'
  })
  const fileInputRef = useRef(null)
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('sidebarWidth')
    return saved ? parseInt(saved, 10) : 350
  })
  const [inspectorWidth, setInspectorWidth] = useState(() => {
    const saved = localStorage.getItem('pitchDeckInspectorWidth')
    return saved ? parseInt(saved, 10) : 320
  })
  const [projectName, setProjectName] = useState(() => {
    return localStorage.getItem('pitchDeckProjectName') || ''
  })
  const [isResizing, setIsResizing] = useState(false)
  const [isResizingInspector, setIsResizingInspector] = useState(false)
  const sidebarRef = useRef(null)
  const updateSlideTimeoutRef = useRef(null)
  const latestStateRef = useRef(null)
  const [settings, setSettings] = useState(() => {
    const apiKeys = loadApiKeys()
    const savedSettings = {
      openaiKey: apiKeys.openai || '',
      unsplashKey: apiKeys.unsplash || '',
      backgroundColor: localStorage.getItem('backgroundColor') || '#1a1a1a',
      textColor: localStorage.getItem('textColor') || '#ffffff',
      fontFamily: localStorage.getItem('fontFamily') || 'Poppins',
      defaultTextSize: parseFloat(localStorage.getItem('defaultTextSize')) || 5,
      h1Size: parseFloat(localStorage.getItem('h1Size')) || 7,
      h2Size: parseFloat(localStorage.getItem('h2Size')) || 3.5,
      h3Size: parseFloat(localStorage.getItem('h3Size')) || 2.5,
      h1FontFamily: localStorage.getItem('h1FontFamily') || 'Poppins',
      h2FontFamily: localStorage.getItem('h2FontFamily') || 'Poppins',
      h3FontFamily: localStorage.getItem('h3FontFamily') || 'Oswald',
      textDropShadow: localStorage.getItem('textDropShadow') === 'true',
      shadowBlur: parseInt(localStorage.getItem('shadowBlur')) || 4,
      shadowOffsetX: parseInt(localStorage.getItem('shadowOffsetX')) || 2,
      shadowOffsetY: parseInt(localStorage.getItem('shadowOffsetY')) || 2,
      shadowColor: localStorage.getItem('shadowColor') || '#000000',
      textOutline: localStorage.getItem('textOutline') === 'true',
      outlineWidth: parseInt(localStorage.getItem('outlineWidth')) || 2,
      outlineColor: localStorage.getItem('outlineColor') || '#000000',
      textInlineBackground: localStorage.getItem('textInlineBackground') === 'true',
      inlineBgColor: localStorage.getItem('inlineBgColor') || '#000000',
      inlineBgOpacity: parseFloat(localStorage.getItem('inlineBgOpacity')) || 0.7,
      inlineBgPadding: parseInt(localStorage.getItem('inlineBgPadding')) || 8,
      transitionStyle: localStorage.getItem('transitionStyle') || 'default',
      transitionSpeed: parseFloat(localStorage.getItem('transitionSpeed')) || 1,
      canvasPushDirection: localStorage.getItem('canvasPushDirection') || 'left',
      textAnimation: localStorage.getItem('textAnimation') || 'none',
      textAnimationUnit: localStorage.getItem('textAnimationUnit') || 'word',
      textAnimationSpeed: parseFloat(localStorage.getItem('textAnimationSpeed')) || 1,
      textAnimationStagger: parseFloat(localStorage.getItem('textAnimationStagger')) || 0.07,
      textExitAnimation: localStorage.getItem('textExitAnimation') || 'match-in',
      subtitleDelay: parseFloat(localStorage.getItem('subtitleDelay')) || 0,
      backgroundKenBurnsDirection: localStorage.getItem('backgroundKenBurnsDirection') || 'zoom-in',
      backgroundBlurOnTextEnter: localStorage.getItem('backgroundBlurOnTextEnter') === 'true',
      graphicAnimationIn: localStorage.getItem('graphicAnimationIn') || 'fade-scale',
      motionPreset: localStorage.getItem('motionPreset') || 'custom',
      kenBurns: localStorage.getItem('kenBurns') === 'true' || localStorage.getItem('backgroundScaleAnimation') === 'true',
      lineHeight: parseFloat(localStorage.getItem('lineHeight')) || 1,
      bulletLineHeight: parseFloat(localStorage.getItem('bulletLineHeight')) || 1,
      bulletTextSize: parseFloat(localStorage.getItem('bulletTextSize')) || 3,
      bulletGap: (() => {
        const v = parseFloat(localStorage.getItem('bulletGap'))
        return Number.isFinite(v) ? v : 0
      })(),
      bulletStyle: localStorage.getItem('bulletStyle') || 'dot',
      textStyleMode: localStorage.getItem('textStyleMode') || 'fontPairing',
      fontPairingSerifFont: localStorage.getItem('fontPairingSerifFont') || 'Playfair Display',
      contentBottomOffset: parseFloat(localStorage.getItem('contentBottomOffset')) || 12,
      contentEdgeOffset: parseFloat(localStorage.getItem('contentEdgeOffset')) || 9,
      contentVerticalAlign: localStorage.getItem('contentVerticalAlign') || 'bottom',
      defaultFontWeight: parseInt(localStorage.getItem('defaultFontWeight'), 10) || 700,
      h1Weight: parseInt(localStorage.getItem('h1Weight'), 10) || 700,
      h2Weight: parseInt(localStorage.getItem('h2Weight'), 10) || 700,
      h3Weight: parseInt(localStorage.getItem('h3Weight'), 10) || 700,
      h1LineHeight: parseFloat(localStorage.getItem('h1LineHeight')) || 1.2,
      h2LineHeight: parseFloat(localStorage.getItem('h2LineHeight')) || 1.2,
      h3LineHeight: parseFloat(localStorage.getItem('h3LineHeight')) || 1.2,
      googleClientId: apiKeys.googleClientId || '',
      pexelsKey: apiKeys.pexels || '',
      pixabayKey: apiKeys.pixabay || '',
      showBullets: localStorage.getItem('showBullets') !== 'false',
    }
    return savedSettings
  })
  const [recordSettings, setRecordSettings] = useState(() => {
    const saved = localStorage.getItem('pitchDeckRecordSettings')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        return {
          ...parsed,
          webcamSize: normalizeWebcamSizePercent(parsed.webcamSize),
          webcamFlipHorizontal: parsed.webcamFlipHorizontal === true,
          webcamFlipVertical: parsed.webcamFlipVertical === true,
          recordingFileFormat: parsed.recordingFileFormat || 'webm-vp9',
          recordingResolution: parsed.recordingResolution || '1080p',
          recordingQuality: parsed.recordingQuality || 'high',
          captionsEnabled: parsed.captionsEnabled === true,
          captionStyle: parsed.captionStyle || 'bottom-black',
          captionFont: parsed.captionFont || 'Poppins',
          captionFontSize: parsed.captionFontSize || 'medium',
          captionDropShadow: parsed.captionDropShadow === true,
        }
      } catch (e) {
        console.error('Error parsing record settings:', e)
      }
    }
    return {
      recordInPresentMode: false,
      webcamEnabled: false,
      webcamSize: 20,
      webcamFlipHorizontal: false,
      webcamFlipVertical: false,
      selectedCameraId: '',
      microphoneEnabled: false,
      selectedMicrophoneId: '',
      recordingFileFormat: 'webm-vp9',
      recordingResolution: '1080p',
      recordingQuality: 'high',
      captionsEnabled: false,
      captionStyle: 'bottom-black',
      captionFont: 'Poppins',
      captionFontSize: 'medium',
      captionDropShadow: false,
      videoBrightness: 1,
      videoContrast: 1,
      videoSaturation: 1,
      videoShadows: 1,
      videoMidtones: 1,
      videoHighlights: 1,
      videoShadowHue: 0,
      videoMidHue: 0,
      videoHighlightHue: 0,
      cameraOverrideEnabled: false,
      cameraOverridePosition: 'fullscreen',
    }
  })

  useEffect(() => {
    if (mode === 'present' || mode === 'record' || mode === 'video-editing') return
    localStorage.setItem('pitchDeckMode', mode)
  }, [mode])

  // Preload FFmpeg after mount (dynamic import keeps ffmpeg out of the initial sync module graph)
  useEffect(() => {
    import('./utils/ffmpegExport').then((m) => m.preloadFFmpeg()).catch(() => {})
  }, [])

  // Update current chapter's slides when slides change
  useEffect(() => {
    setChapters(prevChapters => {
      const updated = prevChapters.map(chapter => 
        chapter.id === currentChapterId 
          ? { ...chapter, slides: slides }
          : chapter
      )
      try {
        localStorage.setItem('pitchDeckChapters', JSON.stringify(updated))
      } catch (error) {
        console.error('Error saving chapters:', error)
      }
      return updated
    })
  }, [slides, currentChapterId])

  // Update slides when current chapter changes
  useEffect(() => {
    const currentChapter = chapters.find(c => c.id === currentChapterId)
    if (currentChapter) {
      setSlides(currentChapter.slides)
      // Select first slide of new chapter
      const firstSlide = currentChapter.slides.find(s => s.layout !== 'section') || currentChapter.slides[0]
      if (firstSlide) {
        setSelectedSlideId(firstSlide.id)
      }
    }
    try {
      localStorage.setItem('pitchDeckCurrentChapterId', currentChapterId.toString())
    } catch (error) {
      console.error('Error saving current chapter ID:', error)
    }
  }, [currentChapterId])

  // Save chapters to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('pitchDeckChapters', JSON.stringify(chapters))
    } catch (error) {
      console.error('Error saving chapters:', error)
    }
  }, [chapters])

  // Save selectedSlideId to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('pitchDeckSelectedId', selectedSlideId.toString())
    } catch (error) {
      console.error('Error saving selected slide ID:', error)
    }
  }, [selectedSlideId])

  /** Recover when storage/chapters disagree (missing slide id) — avoids crashing SlidePreview on slide.* */
  useEffect(() => {
    if (slides.length === 0) return
    if (!slides.some((s) => s.id === selectedSlideId)) {
      setSelectedSlideId(slides[0].id)
    }
  }, [slides, selectedSlideId])

  // Clear overlay selection when changing slides; keep inspector tab as-is
  useEffect(() => {
    setSelectedGraphicId(null)
    setSelectedSubSlideId(null)
  }, [selectedSlideId])
  useEffect(() => {
    if (selectedGraphicId) setInspectorTab('active-object')
  }, [selectedGraphicId, setInspectorTab])

  // Save sidebar width to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('sidebarWidth', sidebarWidth.toString())
    } catch (error) {
      console.error('Error saving sidebar width:', error)
    }
  }, [sidebarWidth])

  // Save inspector width to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('pitchDeckInspectorWidth', inspectorWidth.toString())
    } catch (error) {
      console.error('Error saving inspector width:', error)
    }
  }, [inspectorWidth])

  useEffect(() => {
    try {
      localStorage.setItem('pitchDeckInspectorTab', inspectorTab)
    } catch (error) {
      console.error('Error saving inspector tab:', error)
    }
  }, [inspectorTab])

  // Save recordSettings to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('pitchDeckRecordSettings', JSON.stringify(recordSettings))
    } catch (error) {
      console.error('Error saving record settings:', error)
    }
  }, [recordSettings])

  // Handle sidebar resize
  const handleResizeStart = (e) => {
    e.preventDefault()
    setIsResizing(true)
  }

  // Handle inspector (right panel) resize
  const handleInspectorResizeStart = (e) => {
    e.preventDefault()
    setIsResizingInspector(true)
  }

  useEffect(() => {
    const handleResizeMove = (e) => {
      if (!isResizing) return
      const newWidth = e.clientX
      // Constrain width between 250px and 600px
      const constrainedWidth = Math.max(250, Math.min(600, newWidth))
      setSidebarWidth(constrainedWidth)
    }

    const handleResizeEnd = () => {
      setIsResizing(false)
    }

    if (isResizing) {
      window.addEventListener('mousemove', handleResizeMove)
      window.addEventListener('mouseup', handleResizeEnd)
      return () => {
        window.removeEventListener('mousemove', handleResizeMove)
        window.removeEventListener('mouseup', handleResizeEnd)
      }
    }
  }, [isResizing])

  useEffect(() => {
    const handleInspectorResizeMove = (e) => {
      if (!isResizingInspector) return
      // Inspector width = distance from mouse to right edge of viewport
      const newWidth = window.innerWidth - e.clientX
      const constrainedWidth = Math.max(280, Math.min(600, newWidth))
      setInspectorWidth(constrainedWidth)
    }

    const handleInspectorResizeEnd = () => {
      setIsResizingInspector(false)
    }

    if (isResizingInspector) {
      window.addEventListener('mousemove', handleInspectorResizeMove)
      window.addEventListener('mouseup', handleInspectorResizeEnd)
      return () => {
        window.removeEventListener('mousemove', handleInspectorResizeMove)
        window.removeEventListener('mouseup', handleInspectorResizeEnd)
      }
    }
  }, [isResizingInspector])

  // Load Google Fonts
  useEffect(() => {
    const fontsToLoad = new Set()
    const fontFamily = settings.fontFamily || 'Inter'
    fontsToLoad.add(fontFamily)
    
    // Add heading fonts if they're different
    if (settings.h1FontFamily && settings.h1FontFamily !== fontFamily) {
      fontsToLoad.add(settings.h1FontFamily)
    }
    if (settings.h2FontFamily && settings.h2FontFamily !== fontFamily) {
      fontsToLoad.add(settings.h2FontFamily)
    }
    if (settings.h3FontFamily && settings.h3FontFamily !== fontFamily) {
      fontsToLoad.add(settings.h3FontFamily)
    }
    // Serif pairing font and all serif options (for dropdown preview)
    const serifFont = settings.fontPairingSerifFont || 'Playfair Display'
    fontsToLoad.add(serifFont)
    SERIF_OPTIONS.forEach(f => fontsToLoad.add(f))
    
    // Remove old font links
    const oldLinks = document.querySelectorAll('link[data-google-font]')
    oldLinks.forEach(link => link.remove())
    
    // Load each unique font
    fontsToLoad.forEach(font => {
      const fontFamilyEncoded = font.replace(/\s+/g, '+')
      const fontUrl = `https://fonts.googleapis.com/css2?family=${fontFamilyEncoded}:wght@400;600;700&display=swap`
      
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = fontUrl
      link.setAttribute('data-google-font', font)
      document.head.appendChild(link)
    })
  }, [settings.fontFamily, settings.h1FontFamily, settings.h2FontFamily, settings.h3FontFamily, settings.fontPairingSerifFont])

  // Apply theme to document when it changes
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  // Sync theme with shared saas-apps-theme (global across apps)
  useEffect(() => {
    const unsub = initThemeSync()
    const handler = () => setTheme(getTheme())
    window.addEventListener('saas-theme-change', handler)
    return () => {
      unsub?.()
      window.removeEventListener('saas-theme-change', handler)
    }
  }, [])

  // Save settings to localStorage (API keys go to shared storage)
  useEffect(() => {
    saveApiKeys({
      openai: settings.openaiKey || '',
      unsplash: settings.unsplashKey || '',
      pexels: settings.pexelsKey || '',
      pixabay: settings.pixabayKey || '',
      googleClientId: settings.googleClientId || ''
    })
    localStorage.setItem('backgroundColor', settings.backgroundColor)
    localStorage.setItem('textColor', settings.textColor)
    localStorage.setItem('fontFamily', settings.fontFamily)
    localStorage.setItem('defaultTextSize', settings.defaultTextSize?.toString() || '5')
    localStorage.setItem('h1Size', settings.h1Size?.toString() || '5')
    localStorage.setItem('h2Size', settings.h2Size?.toString() || '3.5')
    localStorage.setItem('h3Size', settings.h3Size?.toString() || '2.5')
    if (settings.h1FontFamily) {
      localStorage.setItem('h1FontFamily', settings.h1FontFamily)
    } else {
      localStorage.removeItem('h1FontFamily')
    }
    if (settings.h2FontFamily) {
      localStorage.setItem('h2FontFamily', settings.h2FontFamily)
    } else {
      localStorage.removeItem('h2FontFamily')
    }
    if (settings.h3FontFamily) {
      localStorage.setItem('h3FontFamily', settings.h3FontFamily)
    } else {
      localStorage.removeItem('h3FontFamily')
    }
    localStorage.setItem('textDropShadow', settings.textDropShadow ? 'true' : 'false')
    localStorage.setItem('shadowBlur', settings.shadowBlur?.toString() || '4')
    localStorage.setItem('shadowOffsetX', settings.shadowOffsetX?.toString() || '2')
    localStorage.setItem('shadowOffsetY', settings.shadowOffsetY?.toString() || '2')
    localStorage.setItem('shadowColor', settings.shadowColor || '#000000')
    localStorage.setItem('textOutline', settings.textOutline ? 'true' : 'false')
    localStorage.setItem('outlineWidth', settings.outlineWidth?.toString() || '2')
    localStorage.setItem('outlineColor', settings.outlineColor || '#000000')
    localStorage.setItem('textInlineBackground', settings.textInlineBackground ? 'true' : 'false')
    localStorage.setItem('inlineBgColor', settings.inlineBgColor || '#000000')
    localStorage.setItem('inlineBgOpacity', settings.inlineBgOpacity?.toString() || '0.7')
    localStorage.setItem('inlineBgPadding', settings.inlineBgPadding?.toString() || '8')
    localStorage.setItem('transitionStyle', settings.transitionStyle || 'default')
    localStorage.setItem('transitionSpeed', (settings.transitionSpeed ?? 1).toString())
    localStorage.setItem('canvasPushDirection', settings.canvasPushDirection || 'left')
    localStorage.setItem('textAnimation', settings.textAnimation || 'none')
    localStorage.setItem('textAnimationUnit', settings.textAnimationUnit || 'word')
    localStorage.setItem('textAnimationSpeed', (settings.textAnimationSpeed ?? 1).toString())
    localStorage.setItem('textAnimationStagger', (settings.textAnimationStagger ?? 0.07).toString())
    localStorage.setItem('textExitAnimation', settings.textExitAnimation || 'match-in')
    localStorage.setItem('subtitleDelay', (settings.subtitleDelay ?? 0).toString())
    localStorage.setItem('backgroundKenBurnsDirection', settings.backgroundKenBurnsDirection || 'zoom-in')
    localStorage.setItem('backgroundBlurOnTextEnter', settings.backgroundBlurOnTextEnter ? 'true' : 'false')
    localStorage.setItem('graphicAnimationIn', settings.graphicAnimationIn || 'fade-scale')
    localStorage.setItem('motionPreset', settings.motionPreset || 'custom')
    localStorage.setItem('kenBurns', settings.kenBurns ? 'true' : 'false')
    localStorage.setItem('lineHeight', settings.lineHeight?.toString() || '1')
    localStorage.setItem('bulletLineHeight', settings.bulletLineHeight?.toString() || '1')
    localStorage.setItem('bulletTextSize', settings.bulletTextSize?.toString() || '3')
    localStorage.setItem('bulletGap', String(settings.bulletGap ?? 0))
    localStorage.setItem('bulletStyle', settings.bulletStyle || 'dot')
    localStorage.setItem('textStyleMode', settings.textStyleMode || 'fontPairing')
    localStorage.setItem('fontPairingSerifFont', settings.fontPairingSerifFont || 'Playfair Display')
    if (settings.contentBottomOffset !== undefined) localStorage.setItem('contentBottomOffset', settings.contentBottomOffset.toString())
    if (settings.contentEdgeOffset !== undefined) localStorage.setItem('contentEdgeOffset', settings.contentEdgeOffset.toString())
    localStorage.setItem('contentVerticalAlign', settings.contentVerticalAlign || 'bottom')
    localStorage.setItem('showBullets', settings.showBullets !== false ? 'true' : 'false')
    if (settings.defaultFontWeight !== undefined) localStorage.setItem('defaultFontWeight', settings.defaultFontWeight.toString())
    if (settings.h1Weight !== undefined) localStorage.setItem('h1Weight', settings.h1Weight.toString())
    if (settings.h2Weight !== undefined) localStorage.setItem('h2Weight', settings.h2Weight.toString())
    if (settings.h3Weight !== undefined) localStorage.setItem('h3Weight', settings.h3Weight.toString())
    if (settings.h1LineHeight !== undefined) localStorage.setItem('h1LineHeight', settings.h1LineHeight.toString())
    if (settings.h2LineHeight !== undefined) localStorage.setItem('h2LineHeight', settings.h2LineHeight.toString())
    if (settings.h3LineHeight !== undefined) localStorage.setItem('h3LineHeight', settings.h3LineHeight.toString())
    if (settings.slideFormat) localStorage.setItem('slideFormat', settings.slideFormat)
  }, [settings])

  // Save workspace data when it changes
  useEffect(() => {
    if (currentWorkspace) {
      const workspaceData = {
        chapters,
        currentChapterId,
        settings,
        projectName
      }
      localStorage.setItem(`pitchDeckWorkspace_${currentWorkspace}`, JSON.stringify(workspaceData))
    }
  }, [currentWorkspace, chapters, currentChapterId, settings, projectName])

  // Auto-save to project folder after any edit (planning, editing, naming, settings, etc.) — debounced
  const autoSaveTimeoutRef = useRef(null)
  const exportDataRef = useRef(null)
  useEffect(() => {
    exportDataRef.current = {
      chapters,
      currentChapterId,
      slides,
      selectedSlideId,
      settings,
      recordSettings,
      sidebarWidth,
      inspectorWidth,
      projectName,
    }
  }, [chapters, currentChapterId, slides, selectedSlideId, settings, recordSettings, sidebarWidth, inspectorWidth, projectName])
  useEffect(() => {
    if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current)
    autoSaveTimeoutRef.current = setTimeout(async () => {
      autoSaveTimeoutRef.current = null
      const data = exportDataRef.current
      if (!data) return
      const exportData = {
        version: '1.0',
        ...data,
        exportedAt: new Date().toISOString()
      }
      try {
        const { hasConnectedFolder, saveProjectToConnectedFolder } = await getProjectFolderStorage()
        if (await hasConnectedFolder()) {
          setIsSaving(true)
          const projName = (data.projectName || '').trim() || 'Untitled Project'
          await saveProjectToConnectedFolder('PitchDeck', projName, () => exportData)
          setLastSaved(new Date())
          localStorage.setItem('pitchDeckLastModified', String(Date.now()))
        }
      } catch (e) {
        console.warn('Auto-save to project folder failed:', e)
      } finally {
        setIsSaving(false)
      }
    }, 1500)
    return () => {
      if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current)
    }
  }, [chapters, currentChapterId, slides, selectedSlideId, settings, recordSettings, sidebarWidth, inspectorWidth, projectName])

  // Save recent files
  useEffect(() => {
    localStorage.setItem('pitchDeckRecentFiles', JSON.stringify(recentFiles))
  }, [recentFiles])

  // Save workspaces
  useEffect(() => {
    localStorage.setItem('pitchDeckWorkspaces', JSON.stringify(workspaces))
  }, [workspaces])

  const restoreHistoryState = useCallback((snapshot) => {
    if (snapshot.slides) setSlides(snapshot.slides)
    if (snapshot.chapters) setChapters(snapshot.chapters)
    if (snapshot.currentChapterId !== undefined) setCurrentChapterId(snapshot.currentChapterId)
    if (snapshot.selectedSlideId !== undefined) setSelectedSlideId(snapshot.selectedSlideId)
    if (snapshot.settings) setSettings(snapshot.settings)
    if (snapshot.recordSettings) setRecordSettings(snapshot.recordSettings)
  }, [])

  const historySnapshot = useMemo(() => ({
    slides,
    selectedSlideId,
    chapters,
    currentChapterId,
    settings,
    recordSettings,
  }), [slides, selectedSlideId, chapters, currentChapterId, settings, recordSettings])

  const { saveToHistory, resetHistory, undo, redo, historyIndex, canUndo, canRedo } = useUndoRedo(historySnapshot, restoreHistoryState)

  // Keep latest state in ref so debounced updateSlide save uses current state
  useEffect(() => {
    latestStateRef.current = {
      slides,
      chapters,
      currentChapterId,
      selectedSlideId,
      settings,
      recordSettings,
    }
  }, [slides, chapters, currentChapterId, selectedSlideId, settings, recordSettings])

  const defaultSlideShape = useCallback(() => ({
    content: '',
    subtitle: '',
    imageUrl: '',
    backgroundVideoUrl: '',
    infographicProjectId: undefined,
    infographicTabId: undefined,
    layout: 'default',
    gradientStrength: 0.7,
    flipHorizontal: false,
    backgroundOpacity: 0.6,
    gradientFlipped: false,
    imageScale: 1.0,
    imagePositionX: 50,
    imagePositionY: 50,
    textHeadingLevel: null,
    subtitleHeadingLevel: null,
    backgroundColorOverride: false,
    backgroundColorOverrideValue: undefined,
    textColorOverride: false,
    textColorOverrideValue: undefined
  }), [])

  const getExportData = useCallback(() => {
    const normalizeSlide = (slide) => ({
      ...defaultSlideShape(),
      ...slide,
      id: slide.id,
      content: slide.content ?? '',
      subtitle: slide.subtitle ?? '',
      imageUrl: slide.imageUrl ?? '',
      backgroundVideoUrl: slide.backgroundVideoUrl ?? '',
      infographicProjectId: slide.infographicProjectId ?? undefined,
      infographicTabId: slide.infographicTabId ?? undefined,
      layout: slide.layout ?? 'default',
      gradientStrength: slide.gradientStrength !== undefined ? slide.gradientStrength : 0.7,
      flipHorizontal: slide.flipHorizontal !== undefined ? slide.flipHorizontal : false,
      backgroundOpacity: slide.backgroundOpacity !== undefined ? slide.backgroundOpacity : 0.6,
      gradientFlipped: slide.gradientFlipped !== undefined ? slide.gradientFlipped : false,
      imageScale: slide.imageScale !== undefined ? slide.imageScale : 1.0,
      imagePositionX: slide.imagePositionX !== undefined ? slide.imagePositionX : 50,
      imagePositionY: slide.imagePositionY !== undefined ? slide.imagePositionY : 50,
      textHeadingLevel: slide.textHeadingLevel ?? null,
      subtitleHeadingLevel: slide.subtitleHeadingLevel ?? null,
    })
    const normalizedChapters = (chapters || []).map(ch => ({
      id: ch.id,
      name: ch.name ?? `Chapter ${ch.id}`,
      slides: (ch.slides || []).map(normalizeSlide)
    }))
    return {
      version: '1.0',
      chapters: normalizedChapters,
      currentChapterId,
      slides: (slides || []).map(normalizeSlide),
      selectedSlideId,
      settings: { ...settings },
      recordSettings: { ...recordSettings },
      sidebarWidth,
      inspectorWidth,
      projectName,
      exportedAt: new Date().toISOString()
    }
  }, [chapters, currentChapterId, slides, selectedSlideId, settings, recordSettings, sidebarWidth, inspectorWidth, projectName, defaultSlideShape])

  // Save current project to connected folder (PitchDeck/[projectName]/project.json)
  const handleSaveToFolder = useCallback(async () => {
    const { hasConnectedFolder, saveProjectToConnectedFolder } = await getProjectFolderStorage()
    if (!(await hasConnectedFolder())) {
      setShowProjectOverview(true)
      return
    }
    try {
      const projName = (projectName || '').trim() || 'Untitled Project'
      await saveProjectToConnectedFolder('PitchDeck', projName, getExportData)
      setLastSaved(new Date())
      localStorage.setItem('pitchDeckLastModified', String(Date.now()))
    } catch (e) {
      console.warn('Save to folder failed:', e)
    }
  }, [projectName, getExportData])

  // Save to project folder when one is open, otherwise download to Downloads
  const handleExportFile = useCallback(async () => {
    const exportData = {
      version: '1.0',
      chapters: chapters,
      currentChapterId: currentChapterId,
      slides: slides,
      selectedSlideId: selectedSlideId,
      settings: settings,
      recordSettings: recordSettings,
      sidebarWidth: sidebarWidth,
      projectName: projectName,
      exportedAt: new Date().toISOString()
    }

    const filename = projectName.trim()
      ? `${projectName.trim().replace(/[^a-z0-9]/gi, '-').toLowerCase()}.json`
      : `pitch-deck-${new Date().toISOString().split('T')[0]}.json`

    const fileInfo = {
      name: projectName.trim() || filename,
      path: filename,
      lastOpened: new Date().toISOString(),
      data: exportData
    }

    try {
      const { hasConnectedFolder, saveProjectToConnectedFolder } = await getProjectFolderStorage()
      if (await hasConnectedFolder()) {
        await saveProjectToConnectedFolder('PitchDeck', (projectName || '').trim() || 'Untitled Project', () => exportData)
        localStorage.setItem('pitchDeckLastModified', String(Date.now()))
        setRecentFiles(prev => {
          const filtered = prev.filter(f => f.path !== filename)
          return [fileInfo, ...filtered].slice(0, 10)
        })
        return
      }
    } catch (e) {
      console.warn('Save to project folder failed, falling back to download:', e)
    }

    // No project folder or save failed: download to Downloads folder
    const dataStr = JSON.stringify(exportData, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    setRecentFiles(prev => {
      const filtered = prev.filter(f => f.path !== filename)
      return [fileInfo, ...filtered].slice(0, 10)
    })
  }, [chapters, currentChapterId, slides, selectedSlideId, settings, recordSettings, sidebarWidth, projectName])

  // Copy current chapter's slide texts to clipboard
  const exportSlidesAsText = useCallback(async () => {
    const currentChapter = chapters.find((c) => c.id === currentChapterId) ?? chapters[0]
    if (!currentChapter?.slides?.length) {
      alert('No slides to copy.')
      return false
    }

    const output = formatSlidesForClipboard([currentChapter])
    try {
      await copyTextToClipboard(output)
      return true
    } catch (err) {
      console.error('Failed to copy to clipboard:', err)
      alert('Could not copy to clipboard. Check browser permissions and try again.')
      return false
    }
  }, [chapters, currentChapterId])

  const handleExportSlidesAsPng = useCallback(async () => {
    if (isExportingPng) return
    const allSlides = chapters.flatMap((ch) => ch.slides)
    if (!allSlides.length) {
      alert('No slides to export.')
      return
    }
    setIsExportingPng(true)
    setExportProgress('Preparing export…')
    try {
      const { exportSlidesAsPng } = await import('./utils/exportSlidesAsPng.jsx')
      await exportSlidesAsPng({
        slides: allSlides,
        settings,
        slideFormat: settings.slideFormat || '16:9',
        projectName,
        onProgress: setExportProgress,
      })
    } catch (err) {
      console.error('PNG export failed:', err)
      alert(`PNG export failed: ${err?.message ?? 'Unknown error'}`)
    } finally {
      setIsExportingPng(false)
      setExportProgress('')
    }
  }, [chapters, settings, projectName, isExportingPng])

  const handleInstagramCarouselExport = useCallback(async (options) => {
    if (isExportingPng) return
    const allSlides = chapters.flatMap((ch) => ch.slides)
    if (!allSlides.length) {
      alert('No slides to export.')
      return
    }
    setIsExportingPng(true)
    setExportProgress('Preparing carousel…')
    try {
      const { exportInstagramCarousel } = await import('./utils/exportSlidesAsPng.jsx')
      await exportInstagramCarousel({
        slides: allSlides,
        settings,
        projectName,
        onProgress: setExportProgress,
        ...options,
      })
      setShowInstagramExport(false)
    } catch (err) {
      console.error('Instagram export failed:', err)
      alert(`Instagram export failed: ${err?.message ?? 'Unknown error'}`)
    } finally {
      setIsExportingPng(false)
      setExportProgress('')
    }
  }, [chapters, settings, projectName, isExportingPng])

  const addSlide = () => {
    const newId = Math.max(...slides.map(s => s.id), 0) + 1
    const newSlide = { id: newId, content: '', subtitle: '', imageUrl: '', backgroundVideoUrl: '', infographicProjectId: undefined, infographicTabId: undefined, layout: 'default', gradientStrength: 0.7, flipHorizontal: false, backgroundOpacity: 0.6, gradientFlipped: false, imageScale: 1.0, imagePositionX: 50, imagePositionY: 50, textHeadingLevel: null, subtitleHeadingLevel: null }
    const newSlides = [...slides, newSlide]
    const newChapters = chapters.map(c => c.id === currentChapterId ? { ...c, slides: newSlides } : c)
    setSlides(newSlides)
    setSelectedSlideId(newId)
    saveToHistory({ slides: newSlides, selectedSlideId: newId, chapters: newChapters, currentChapterId, settings, recordSettings })
  }

  const deleteSlide = (id) => {
    if (slides.length === 1) return
    const newSlides = slides.filter(s => s.id !== id)
    const idx = slides.findIndex(s => s.id === id)
    const newSelected = selectedSlideId === id ? (idx > 0 ? slides[idx - 1].id : newSlides[0]?.id) : selectedSlideId
    const newChapters = chapters.map(c => c.id === currentChapterId ? { ...c, slides: newSlides } : c)
    setSlides(newSlides)
    setSelectedSlideId(newSelected)
    setChapters(newChapters)
    saveToHistory({ slides: newSlides, selectedSlideId: newSelected, chapters: newChapters, currentChapterId, settings, recordSettings })
  }

  const deleteSlides = (ids) => {
    const idsToDelete = new Set(Array.isArray(ids) ? ids : [ids])
    if (idsToDelete.size === 0) return
    const newSlides = slides.filter(s => !idsToDelete.has(s.id))
    if (newSlides.length === 0) return
    let newSelected = selectedSlideId
    if (idsToDelete.has(selectedSlideId)) {
      const firstRemaining = newSlides.find(s => s.layout !== 'section') || newSlides[0]
      newSelected = firstRemaining?.id ?? null
    }
    const newChapters = chapters.map(c => c.id === currentChapterId ? { ...c, slides: newSlides } : c)
    setSlides(newSlides)
    setSelectedSlideId(newSelected)
    setChapters(newChapters)
    saveToHistory({ slides: newSlides, selectedSlideId: newSelected, chapters: newChapters, currentChapterId, settings, recordSettings })
  }

  const duplicateSlide = (id) => {
    const slideToDuplicate = slides.find(s => s.id === id)
    if (!slideToDuplicate) return
    
    const newId = Math.max(...slides.map(s => s.id), 0) + 1
    const duplicatedSlide = { ...slideToDuplicate, id: newId }
    const slideIndex = slides.findIndex(s => s.id === id)
    const newSlides = [...slides]
    newSlides.splice(slideIndex + 1, 0, duplicatedSlide)
    const newChapters = chapters.map(c => c.id === currentChapterId ? { ...c, slides: newSlides } : c)
    setSlides(newSlides)
    saveToHistory({ slides: newSlides, selectedSlideId, chapters: newChapters, currentChapterId, settings, recordSettings })
  }

  // Comprehensive keyboard shortcuts handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't handle shortcuts if user is typing in an input/textarea
      const activeElement = document.activeElement
      const isInputFocused = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.isContentEditable
      )

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey

      // Show shortcuts modal (?)
      if (e.key === '?' && !isInputFocused) {
        e.preventDefault()
        setShowShortcuts(true)
        return
      }

      // Command palette (Cmd/Ctrl + K)
      if (e.key === 'k' && cmdOrCtrl && !isInputFocused) {
        e.preventDefault()
        setShowCommandPalette(true)
        return
      }

      // Don't handle other shortcuts if modals are open
      if (showShortcuts || showCommandPalette || showSettings || showInstagramExport) {
        if (e.key === 'Escape') {
          setShowShortcuts(false)
          setShowCommandPalette(false)
          setShowSettings(false)
          if (!isExportingPng) setShowInstagramExport(false)
        }
        return
      }

      if (showProjectOverview) return

      // Duplicate slide (Cmd/Ctrl + D)
      if (e.key === 'd' && cmdOrCtrl && !isInputFocused && mode === 'edit') {
        e.preventDefault()
        if (selectedSlideId) {
          duplicateSlide(selectedSlideId)
        }
        return
      }

      // Undo (Cmd/Ctrl + Z)
      if (e.key === 'z' && cmdOrCtrl && !e.shiftKey && !isInputFocused) {
        e.preventDefault()
        undo()
        return
      }

      // Redo (Cmd/Ctrl + Shift + Z or Ctrl+Y on Windows)
      if (e.key === 'z' && cmdOrCtrl && e.shiftKey && !isInputFocused) {
        e.preventDefault()
        redo()
        return
      }
      if (e.key === 'y' && cmdOrCtrl && !e.shiftKey && !isInputFocused) {
        e.preventDefault()
        redo()
        return
      }

      // Save (Cmd/Ctrl + S)
      if (e.key === 's' && cmdOrCtrl && !isInputFocused) {
        e.preventDefault()
        handleExportFile()
        return
      }

      // Delete selected slide(s)
      if (e.key === 'Delete' && !isInputFocused && mode === 'edit') {
        e.preventDefault()
        if (selectedSlides.size > 0) {
          const slidesToDelete = Array.from(selectedSlides)
          if (slides.length - slidesToDelete.length >= 1) {
            deleteSlides(slidesToDelete)
          }
          setSelectedSlides(new Set())
        } else if (selectedSlideId) {
          deleteSlide(selectedSlideId)
        }
        return
      }

      // Arrow keys for slide navigation (only in edit mode, not in input)
      if (mode === 'edit' && !isInputFocused) {
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          const currentIndex = slides.findIndex(s => s.id === selectedSlideId)
          if (currentIndex > 0) {
            const newId = slides[currentIndex - 1].id
            setSelectedSlideId(newId)
            setSelectedSlides(new Set([newId]))
          }
        } else if (e.key === 'ArrowDown') {
          e.preventDefault()
          const currentIndex = slides.findIndex(s => s.id === selectedSlideId)
          if (currentIndex < slides.length - 1) {
            const newId = slides[currentIndex + 1].id
            setSelectedSlideId(newId)
            setSelectedSlides(new Set([newId]))
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [mode, selectedSlideId, slides, showShortcuts, showCommandPalette, showSettings, showInstagramExport, isExportingPng, selectedSlides, historyIndex, duplicateSlide, deleteSlide, handleExportFile, undo, redo])

  const updateSlide = (id, updates) => {
    // Use functional updater so rapid successive updates (e.g. auto-set serif for multiple slides) all apply;
    // otherwise each call would overwrite the previous when using stale `slides` from closure.
    setSlides(prevSlides => {
      return prevSlides.map(s => {
        if (s.id === id) {
          const updated = { ...s, ...updates }
          if (updates.layout === 'section' && updated.imageUrl) {
            updated.imageUrl = ''
          }
          return updated
        }
        return s
      })
    })

    // Debounced history save: use latest state from ref when timeout fires (state may have changed by then)
    if (updateSlideTimeoutRef.current) {
      clearTimeout(updateSlideTimeoutRef.current)
    }
    updateSlideTimeoutRef.current = setTimeout(() => {
      const latest = latestStateRef.current
      if (latest) {
        saveToHistory({ ...latest })
      }
    }, 1000)
  }

  const updateSlidesBatch = (updatesById) => {
    setSlides(prevSlides => {
      return prevSlides.map(s => {
        const updates = updatesById[s.id]
        if (!updates) return s
        const updated = { ...s, ...updates }
        if (updates.layout === 'section' && updated.imageUrl) {
          updated.imageUrl = ''
        }
        return updated
      })
    })
    if (updateSlideTimeoutRef.current) {
      clearTimeout(updateSlideTimeoutRef.current)
    }
    updateSlideTimeoutRef.current = setTimeout(() => {
      const latest = latestStateRef.current
      if (latest) {
        saveToHistory({ ...latest })
      }
    }, 1000)
  }

  const updateSlides = (newSlides) => {
    const newChapters = chapters.map(c => c.id === currentChapterId ? { ...c, slides: newSlides } : c)
    setSlides(newSlides)
    setChapters(newChapters)
    saveToHistory({ slides: newSlides, selectedSlideId, chapters: newChapters, currentChapterId, settings, recordSettings })
  }

  const updateChapterSlides = (chapterId, newSlides) => {
    const newChapters = chapters.map(c => c.id === chapterId ? { ...c, slides: newSlides } : c)
    setChapters(newChapters)
    if (currentChapterId === chapterId) {
      setSlides(newSlides)
    }
    saveToHistory({
      slides: currentChapterId === chapterId ? newSlides : slides,
      selectedSlideId,
      chapters: newChapters,
      currentChapterId,
      settings,
      recordSettings,
    })
  }

  const reorderChapters = (newOrderedChapters) => {
    setChapters(newOrderedChapters)
    saveToHistory({
      slides,
      selectedSlideId,
      chapters: newOrderedChapters,
      currentChapterId,
      settings,
      recordSettings,
    })
  }

  // Chapter management functions
  const handleAddChapter = () => {
    const newChapterId = Math.max(...chapters.map(c => c.id), 0) + 1
    const newChapter = {
      id: newChapterId,
      name: `Chapter ${newChapterId}`,
      slides: [{ id: 1, content: '', subtitle: '', imageUrl: '', backgroundVideoUrl: '', infographicProjectId: undefined, infographicTabId: undefined, layout: 'default', gradientStrength: 0.7, flipHorizontal: false, backgroundOpacity: 0.6, gradientFlipped: false, imageScale: 1.0, imagePositionX: 50, imagePositionY: 50, textHeadingLevel: null, subtitleHeadingLevel: null }]
    }
    const newChapters = [...chapters, newChapter]
    setChapters(newChapters)
    setCurrentChapterId(newChapterId)
    saveToHistory({ slides: newChapter.slides, selectedSlideId: 1, chapters: newChapters, currentChapterId: newChapterId, settings, recordSettings })
  }

  const handleDeleteChapter = (chapterId) => {
    if (chapters.length === 1) {
      alert('Cannot delete the last chapter. Create a new chapter first.')
      return
    }
    if (window.confirm('Are you sure you want to delete this chapter? All slides in this chapter will be lost.')) {
      const updatedChapters = chapters.filter(c => c.id !== chapterId)
      const nextChapterId = currentChapterId === chapterId ? updatedChapters[0].id : currentChapterId
      const nextSlides = currentChapterId === chapterId ? updatedChapters[0].slides : (chapters.find(c => c.id === currentChapterId)?.slides ?? slides)
      const nextSelectedId = currentChapterId === chapterId ? (nextSlides[0]?.id ?? selectedSlideId) : selectedSlideId
      setChapters(updatedChapters)
      if (currentChapterId === chapterId) {
        setCurrentChapterId(nextChapterId)
        setSlides(nextSlides)
        setSelectedSlideId(nextSelectedId)
      }
      saveToHistory({ slides: nextSlides, selectedSlideId: nextSelectedId, chapters: updatedChapters, currentChapterId: nextChapterId, settings, recordSettings })
    }
  }

  const handleUpdateChapterName = (chapterId, newName) => {
    const updatedChapters = chapters.map(c =>
      c.id === chapterId ? { ...c, name: newName } : c
    )
    setChapters(updatedChapters)
    saveToHistory({ slides, selectedSlideId, chapters: updatedChapters, currentChapterId, settings, recordSettings })
  }

  const handleChapterSelect = (nextId) => {
    const nextChapter = chapters.find(c => c.id === nextId)
    if (nextChapter) {
      const nextSlides = nextChapter.slides
      const nextSelected = nextSlides.some(s => s.id === selectedSlideId) ? selectedSlideId : (nextSlides[0]?.id ?? selectedSlideId)
      setCurrentChapterId(nextId)
      setSlides(nextSlides)
      setSelectedSlideId(nextSelected)
      saveToHistory({ slides: nextSlides, selectedSlideId: nextSelected, chapters, currentChapterId: nextId, settings, recordSettings })
    }
  }

  const handleChapterDrop = (e) => {
    e.preventDefault()
    const slideId = parseInt(e.dataTransfer.getData('text/html'), 10)
    if (!slideId) return
    const slide = slides.find(s => s.id === slideId)
    const targetChapter = chapters.find(c => c.id === currentChapterId)
    if (slide && targetChapter && !targetChapter.slides.some(s => s.id === slideId)) {
      const sourceChapter = chapters.find(c => c.slides.some(s => s.id === slideId))
      if (sourceChapter) {
        const updatedSource = { ...sourceChapter, slides: sourceChapter.slides.filter(s => s.id !== slideId) }
        const updatedTarget = { ...targetChapter, slides: [...targetChapter.slides, slide] }
        const updatedChapters = chapters.map(c => {
          if (c.id === sourceChapter.id) return updatedSource
          if (c.id === currentChapterId) return updatedTarget
          return c
        })
        const newSlidesForView = currentChapterId === sourceChapter.id ? updatedSource.slides : updatedTarget.slides
        setChapters(updatedChapters)
        setSlides(newSlidesForView)
        saveToHistory({ slides: newSlidesForView, selectedSlideId, chapters: updatedChapters, currentChapterId, settings, recordSettings })
      }
    }
  }

  const handleSwitchWorkspace = (workspaceId) => {
    setCurrentWorkspace(workspaceId)
    localStorage.setItem('pitchDeckCurrentWorkspace', workspaceId)
    const workspaceData = localStorage.getItem(`pitchDeckWorkspace_${workspaceId}`)
    if (!workspaceData) return
    try {
      const data = JSON.parse(workspaceData)
      if (data.chapters) setChapters(data.chapters)
      const chapterId = data.currentChapterId || data.chapters?.[0]?.id || 1
      setCurrentChapterId(chapterId)
      const chapter = data.chapters?.find(c => c.id === chapterId) ?? data.chapters?.[0]
      const chapterSlides = chapter?.slides ?? []
      if (chapter) {
        setSlides(chapterSlides)
        const firstSlide = chapterSlides.find(s => s.layout !== 'section') || chapterSlides[0]
        if (firstSlide) setSelectedSlideId(firstSlide.id)
      }
      if (data.settings) setSettings(prev => ({ ...prev, ...data.settings }))
      if (data.projectName) setProjectName(data.projectName)
      resetHistory({
        slides: chapterSlides,
        selectedSlideId: chapterSlides.find(s => s.layout !== 'section')?.id ?? chapterSlides[0]?.id ?? null,
        chapters: data.chapters ?? [],
        currentChapterId: chapterId,
        settings: data.settings ? { ...settings, ...data.settings } : settings,
        recordSettings,
      })
    } catch (e) {
      console.error('Error loading workspace:', e)
    }
  }

  const handleAddWorkspace = () => {
    const numericIds = workspaces.map((w) =>
      typeof w.id === 'number' && Number.isFinite(w.id) ? w.id : 0
    )
    const newId = Math.max(0, ...numericIds) + 1
    const newWorkspace = { id: newId, name: `Workspace ${newId}` }
    const next = [...workspaces, newWorkspace]
    setWorkspaces(next)
    localStorage.setItem('pitchDeckWorkspaces', JSON.stringify(next))
  }

  const exitToPreviousMode = () => {
    setMode(previousModeRef.current === 'plan' ? 'plan' : 'edit')
  }

  const handleEnterVideoEditing = () => {
    previousModeRef.current = mode
    setMode('video-editing')
  }

  useEffect(() => {
    if (selectedGraphicId) setInspectorTab('object')
  }, [selectedGraphicId, setInspectorTab])

  useEffect(() => {
    try {
      localStorage.setItem('pitchDeckSidebarCollapsed', String(sidebarCollapsed))
    } catch (_) {}
  }, [sidebarCollapsed])

  // Create a new presentation (clear all slides). If projectName is passed (from Projects modal), use it and skip confirm.
  const handleNewPresentation = (projectNameFromModal) => {
    const doCreate = () => {
      if (projectNameFromModal != null && projectNameFromModal !== '') {
        setProjectName(projectNameFromModal.trim())
      }
      const newSlide = {
        id: 1,
        content: '',
        subtitle: '',
        imageUrl: '',
        backgroundVideoUrl: '',
        infographicProjectId: undefined,
        infographicTabId: undefined,
        layout: 'default',
        gradientStrength: 0.7,
        flipHorizontal: false,
        backgroundOpacity: 0.6,
        gradientFlipped: false,
        imageScale: 1.0,
        imagePositionX: 50,
        imagePositionY: 50,
        textHeadingLevel: null,
        subtitleHeadingLevel: null
      }
      const newChapter = {
        id: 1,
        name: 'Chapter 1',
        slides: [newSlide]
      }
      setChapters([newChapter])
      setCurrentChapterId(1)
      setSlides([newSlide])
      setSelectedSlideId(newSlide.id)
      localStorage.removeItem('pitchDeckChapters')
      localStorage.removeItem('pitchDeckCurrentChapterId')
    }
    if (projectNameFromModal != null) {
      doCreate()
    } else if (window.confirm('Create a new presentation? This will clear all current slides.')) {
      doCreate()
    }
  }

  // Load a template
  const handleLoadTemplate = (templateSlides) => {
    // Regenerate IDs to ensure they're unique
    const newSlides = templateSlides.map((slide, index) => ({
      ...slide,
      id: index + 1
    }))
    const updatedChapters = chapters.map(chapter =>
      chapter.id === currentChapterId ? { ...chapter, slides: newSlides } : chapter
    )
    const firstNonSection = newSlides.find(s => s.layout !== 'section')
    const nextSelectedId = firstNonSection ? firstNonSection.id : newSlides[0]?.id || null
    setChapters(updatedChapters)
    setSlides(newSlides)
    setSelectedSlideId(nextSelectedId)
    saveToHistory({ slides: newSlides, selectedSlideId: nextSelectedId, chapters: updatedChapters, currentChapterId, settings, recordSettings })
  }

  // Save project name to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('pitchDeckProjectName', projectName)
  }, [projectName])

  // Load project data (from overview Open, or after file read). Same shape as export.
  const loadProjectFromData = useCallback((importData) => {
    if (!importData) return
    let normalizedChapters = []
    let nextChapterId = 1
    if (importData.chapters && Array.isArray(importData.chapters)) {
      normalizedChapters = importData.chapters.map(ch => ({
        ...ch,
        slides: (ch.slides || []).map(normalizeSlide).filter(Boolean)
      }))
      nextChapterId = importData.currentChapterId || importData.chapters[0]?.id || 1
      setChapters(normalizedChapters)
      setCurrentChapterId(nextChapterId)
    } else if (importData.slides && Array.isArray(importData.slides)) {
      const slidesWithLayout = importData.slides.map(normalizeSlide).filter(Boolean)
      normalizedChapters = [{ id: 1, name: 'Chapter 1', slides: slidesWithLayout }]
      nextChapterId = 1
      setChapters(normalizedChapters)
      setCurrentChapterId(1)
    } else return

    const currentChapter = normalizedChapters.find(c => c.id === nextChapterId) ?? normalizedChapters[0]
    const slidesWithLayout = currentChapter?.slides ?? []
    setSlides(slidesWithLayout)
    const validSelectedId = slidesWithLayout.find(s => s.id === importData.selectedSlideId)
      ? importData.selectedSlideId
      : slidesWithLayout[0]?.id || 1
    setSelectedSlideId(validSelectedId)

    const nextSettings = importData.settings ? { ...settings, ...importData.settings } : settings
    const nextRecordSettings = importData.recordSettings ? { ...recordSettings, ...importData.recordSettings } : recordSettings
    if (importData.settings) {
      setSettings(prev => ({ ...prev, ...importData.settings }))
    }
    if (importData.sidebarWidth !== undefined) setSidebarWidth(importData.sidebarWidth)
    if (importData.inspectorWidth !== undefined) setInspectorWidth(importData.inspectorWidth)
    if (importData.projectName !== undefined) setProjectName(importData.projectName)
    if (importData.recordSettings) setRecordSettings(importData.recordSettings)

    resetHistory({
      slides: slidesWithLayout,
      selectedSlideId: validSelectedId,
      chapters: normalizedChapters,
      currentChapterId: nextChapterId,
      settings: nextSettings,
      recordSettings: nextRecordSettings,
    })
  }, [resetHistory, settings, recordSettings])

  // On mount: if connected folder has project newer than browser, load from folder
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { hasConnectedFolder, loadProjectFromConnectedFolder } = await getProjectFolderStorage()
      if (!(await hasConnectedFolder())) return
      const projName = localStorage.getItem('pitchDeckProjectName') || 'Untitled Project'
      const result = await loadProjectFromConnectedFolder('PitchDeck', projName)
      if (cancelled || !result?.data) return
      const browserLastModified = parseInt(localStorage.getItem('pitchDeckLastModified') || '0', 10)
      if (result.modifiedTime > browserLastModified) {
        loadProjectFromData(result.data)
      }
    })()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Import data from a file
  const handleImportFile = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const importData = JSON.parse(event.target?.result || '{}')
        
        // Load chapters if available, otherwise fall back to slides
        if (importData.chapters && Array.isArray(importData.chapters)) {
          // New format with chapters
          setChapters(importData.chapters)
          if (importData.currentChapterId) {
            setCurrentChapterId(importData.currentChapterId)
          } else {
            setCurrentChapterId(importData.chapters[0]?.id || 1)
          }
        } else if (importData.slides && Array.isArray(importData.slides)) {
          // Old format - convert to chapters
          const slidesWithLayout = importData.slides.map(slide => ({
            ...slide,
            layout: slide.layout || 'default',
            gradientStrength: slide.gradientStrength !== undefined ? slide.gradientStrength : 0.7,
            flipHorizontal: slide.flipHorizontal !== undefined ? slide.flipHorizontal : false,
            backgroundOpacity: slide.backgroundOpacity !== undefined ? slide.backgroundOpacity : 0.6,
            gradientFlipped: slide.gradientFlipped !== undefined ? slide.gradientFlipped : false,
            subtitle: slide.subtitle || '',
            imageScale: slide.imageScale !== undefined ? slide.imageScale : 1.0,
            imagePositionX: slide.imagePositionX !== undefined ? slide.imagePositionX : 50,
            imagePositionY: slide.imagePositionY !== undefined ? slide.imagePositionY : 50,
            textHeadingLevel: slide.textHeadingLevel || null,
            subtitleHeadingLevel: slide.subtitleHeadingLevel || null
          }))
          const convertedChapter = {
            id: 1,
            name: 'Chapter 1',
            slides: slidesWithLayout
          }
          setChapters([convertedChapter])
          setCurrentChapterId(1)
        } else {
          alert('Invalid file format. The file must contain slides or chapters data.')
          return
        }

        const confirmMessage = `This will replace your current presentation with the imported data. Continue?`
        if (!window.confirm(confirmMessage)) {
          e.target.value = ''
          return
        }

        loadProjectFromData(importData)

        const slideCount = importData.chapters?.length
          ? (importData.chapters.find(c => c.id === (importData.currentChapterId || importData.chapters[0]?.id))?.slides?.length
            ?? importData.chapters[0]?.slides?.length ?? 0)
          : (importData.slides?.length ?? 0)
        alert(`Successfully imported ${slideCount} slide(s)!`)
      } catch (error) {
        console.error('Error importing file:', error)
        alert('Error importing file. Please make sure it is a valid JSON file.')
      }
    }

    reader.onerror = () => {
      alert('Error reading file. Please try again.')
    }

    reader.readAsText(file)
    
    // Reset file input so same file can be selected again
    e.target.value = ''
  }

  // Bulk select images for all slides without images
  const handleBulkSelectImages = async () => {
    if (!settings.openaiKey || !settings.unsplashKey) {
      alert('Please set your OpenAI and Unsplash API keys in settings first.')
      return
    }

    // Find slides without image or video background (exclude sections and fullscreen camera layout)
    const slidesWithoutImages = slides.filter(slide => {
      const layout = slide.layout || 'default'
      if (layout === 'section' || layout === 'video') return false
      const hasImage = !!(slide.imageUrl && slide.imageUrl.trim())
      const hasVideo = !!(slide.backgroundVideoUrl && slide.backgroundVideoUrl.trim())
      return !hasImage && !hasVideo
    })
    
    if (slidesWithoutImages.length === 0) {
      alert('All slides already have an image or video background!')
      return
    }

    const confirmMessage = `This will automatically select images for ${slidesWithoutImages.length} slide(s). This may take a moment. Continue?`
    if (!window.confirm(confirmMessage)) {
      return
    }

    // Process slides one by one
    const updatedSlides = [...slides]
    let successCount = 0
    let failCount = 0

    for (let i = 0; i < slidesWithoutImages.length; i++) {
      const slide = slidesWithoutImages[i]
      
      try {
        if (!getSlideSearchKeywords(slide)) {
          failCount++
          continue
        }

        const searchQuery = await generateMediaSearchQuery({
          slide,
          mediaType: 'image',
          openaiKey: settings.openaiKey,
        })

        if (!searchQuery) {
          failCount++
          continue
        }

        // Search Unsplash for images
        const unsplashResponse = await fetch(
          `https://api.unsplash.com/search/photos?query=${encodeURIComponent(searchQuery)}&per_page=5&orientation=landscape`,
          {
            headers: {
              'Authorization': `Client-ID ${settings.unsplashKey}`
            }
          }
        )

        const unsplashData = await unsplashResponse.json()
        const firstResult = unsplashData?.results?.[0]
        const imageUrl = firstResult?.urls?.regular
        if (imageUrl) {
          const slideIndex = updatedSlides.findIndex(s => s.id === slide.id)
          if (slideIndex !== -1) {
            updatedSlides[slideIndex] = { ...updatedSlides[slideIndex], imageUrl, backgroundOpacity: 0.6 }
            successCount++
          }
        } else {
          failCount++
        }

        // Add a small delay to avoid rate limiting
        if (i < slidesWithoutImages.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      } catch (error) {
        console.error(`Error selecting image for slide ${slide.id}:`, error)
        failCount++
      }
    }

    setSlides(updatedSlides)
    const newChapters = chapters.map(c => c.id === currentChapterId ? { ...c, slides: updatedSlides } : c)
    setChapters(newChapters)
    saveToHistory({ slides: updatedSlides, selectedSlideId, chapters: newChapters, currentChapterId, settings, recordSettings })
    
    const message = `Image selection complete!\n${successCount} image(s) added successfully.${failCount > 0 ? `\n${failCount} slide(s) could not be processed.` : ''}`
    alert(message)
  }

  const handleBulkSelectVideos = async () => {
    if (!settings.openaiKey) {
      alert('Please set your OpenAI API key in settings first.')
      return
    }
    if (!settings.pexelsKey && !settings.pixabayKey) {
      alert('Please set your Pexels or Pixabay API key in settings first.')
      return
    }

    const slidesWithoutBackground = slides.filter((slide) => {
      const layout = slide.layout || 'default'
      if (layout === 'section' || layout === 'video') return false
      const hasImage = !!(slide.imageUrl && slide.imageUrl.trim())
      const hasVideo = !!(slide.backgroundVideoUrl && slide.backgroundVideoUrl.trim())
      const hasInfographic = !!slide.infographicProjectId
      return !hasImage && !hasVideo && !hasInfographic
    })

    if (slidesWithoutBackground.length === 0) {
      alert('All slides already have an image or video background!')
      return
    }

    const confirmMessage = `This will automatically select videos for ${slidesWithoutBackground.length} slide(s). This may take a moment. Continue?`
    if (!window.confirm(confirmMessage)) {
      return
    }

    setIsBulkSelectingVideos(true)
    const updatedSlides = [...slides]
    let successCount = 0
    let failCount = 0

    try {
      for (let i = 0; i < slidesWithoutBackground.length; i++) {
        const slide = slidesWithoutBackground[i]

        try {
          if (!getSlideSearchKeywords(slide)) {
            failCount++
            continue
          }

          const searchQuery = await generateMediaSearchQuery({
            slide,
            mediaType: 'video',
            openaiKey: settings.openaiKey,
          })

          if (!searchQuery) {
            failCount++
            continue
          }

          const { url: videoUrl } = await searchStockVideo({
            query: searchQuery,
            pexelsKey: settings.pexelsKey,
            pixabayKey: settings.pixabayKey,
          })

          if (videoUrl) {
            const slideIndex = updatedSlides.findIndex((s) => s.id === slide.id)
            if (slideIndex !== -1) {
              updatedSlides[slideIndex] = {
                ...updatedSlides[slideIndex],
                backgroundVideoUrl: videoUrl,
                imageUrl: '',
                backgroundOpacity: 0.6,
                imageScale: 1.0,
                imageScaleCustomized: false,
              }
              successCount++
            }
          } else {
            failCount++
          }

          if (i < slidesWithoutBackground.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 500))
          }
        } catch (error) {
          console.error(`Error selecting video for slide ${slide.id}:`, error)
          failCount++
        }
      }

      setSlides(updatedSlides)
      const newChapters = chapters.map((c) => (c.id === currentChapterId ? { ...c, slides: updatedSlides } : c))
      setChapters(newChapters)
      saveToHistory({ slides: updatedSlides, selectedSlideId, chapters: newChapters, currentChapterId, settings, recordSettings })

      const message = `Video selection complete!\n${successCount} video(s) added successfully.${failCount > 0 ? `\n${failCount} slide(s) could not be processed.` : ''}`
      alert(message)
    } finally {
      setIsBulkSelectingVideos(false)
    }
  }

  const selectedSlide =
    slides.length === 0
      ? null
      : (slides.find((s) => s.id === selectedSlideId) ?? slides[0])

  // Present: open present view and fullscreen (one button, one action)
  const handlePresentClick = () => {
    previousModeRef.current = mode
    if (document.activeElement?.isContentEditable) {
      document.activeElement.blur()
      setTimeout(() => setMode('present'), 0)
    } else {
      setMode('present')
    }
  }

  const handleCommandPaletteAction = (action, arg) => {
    switch (action) {
      case 'undo': undo(); break
      case 'redo': redo(); break
      case 'newSlide': addSlide(); break
      case 'duplicateSlide': duplicateSlide(selectedSlideId); break
      case 'deleteSlide': deleteSlide(selectedSlideId); break
      case 'export': handleExportFile(); break
      case 'exportPng': handleExportSlidesAsPng(); break
      case 'exportInstagram': setShowInstagramExport(true); break
      case 'copyText': exportSlidesAsText(); break
      case 'import': handleImportFile(); break
      case 'settings': setShowSettings(true); break
      case 'transitions':
        setMode('edit')
        setInspectorTab('transitions')
        setInspectorDrawerOpen(true)
        break
      case 'toggleTheme': setSharedTheme(theme === 'dark' ? 'light' : 'dark'); break
      case 'present':
        if (document.activeElement?.isContentEditable) {
          document.activeElement.blur()
          setTimeout(() => setMode('present'), 0)
        } else {
          setMode('present')
        }
        break
      case 'goToSlide': if (arg) setSelectedSlideId(arg); break
      case 'switchChapter': if (arg) setCurrentChapterId(arg); break
      default: break
    }
  }

  // Record: start screen recording in-place (no present mode, no fullscreen)
  const handleRecordClick = async () => {
    try {
      recordingChunksRef.current = []

      // Request microphone first (same user gesture) when enabled, so audio is ready before display picker
      let audioStream = null
      if (recordSettings.microphoneEnabled) {
        const deviceId = recordSettings.selectedMicrophoneId
        try {
          if (deviceId) {
            audioStream = await navigator.mediaDevices.getUserMedia({
              audio: { deviceId: { exact: deviceId } }
            })
          }
          if (!audioStream && deviceId) {
            audioStream = await navigator.mediaDevices.getUserMedia({
              audio: { deviceId: { ideal: deviceId } }
            })
          }
          if (!audioStream) {
            audioStream = await navigator.mediaDevices.getUserMedia({ audio: true })
          }
          if (audioStream) recordingAudioStreamRef.current = audioStream
        } catch (e) {
          console.warn('Could not access microphone:', e)
        }
      }

      const resolution = recordSettings.recordingResolution || '1080p'
      const videoConstraint = resolution === 'original'
        ? true
        : resolution === '1080p'
          ? { width: { ideal: 1920 }, height: { ideal: 1080 } }
          : resolution === '720p'
            ? { width: { ideal: 1280 }, height: { ideal: 720 } }
            : { width: { ideal: 854 }, height: { ideal: 480 } }
      const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: videoConstraint, audio: false })
      recordingStreamRef.current = displayStream

      const streamToRecord = new MediaStream()
      displayStream.getVideoTracks().forEach((t) => streamToRecord.addTrack(t))

      // Route mic through Web Audio API so MediaRecorder reliably encodes audio (Chrome can drop raw getUserMedia audio when mixed with display video)
      let audioTrackForRecorder = null
      if (audioStream && audioStream.getAudioTracks().length > 0) {
        try {
          const audioContext = new (window.AudioContext || window.webkitAudioContext)()
          if (audioContext.state === 'suspended') await audioContext.resume()
          const source = audioContext.createMediaStreamSource(audioStream)
          const destination = audioContext.createMediaStreamDestination()
          source.connect(destination)
          const destTracks = destination.stream.getAudioTracks()
          if (destTracks.length > 0) {
            audioTrackForRecorder = destTracks[0]
            recordingAudioContextRef.current = audioContext
          }
        } catch (e) {
          console.warn('Web Audio fallback failed, using raw mic track:', e)
          audioTrackForRecorder = audioStream.getAudioTracks()[0]
        }
        if (!audioTrackForRecorder) audioTrackForRecorder = audioStream.getAudioTracks()[0]
        if (audioTrackForRecorder) streamToRecord.addTrack(audioTrackForRecorder)
      }

      const format = recordSettings.recordingFileFormat || 'webm-vp9'
      const formatCandidates =
        format === 'webm-vp9'
          ? ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
          : format === 'webm-vp8'
            ? ['video/webm;codecs=vp8,opus', 'video/webm']
            : ['video/webm']
      const mimeType = formatCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || 'video/webm'
      const quality = recordSettings.recordingQuality || 'high'
      const videoBitsPerSecond = quality === 'low' ? 1000000 : quality === 'medium' ? 2500000 : 5000000
      const hasAudio = streamToRecord.getAudioTracks().length > 0
      const mediaRecorder = new MediaRecorder(streamToRecord, {
        mimeType,
        videoBitsPerSecond,
        audioBitsPerSecond: hasAudio ? 128000 : undefined
      })
      recordingMediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordingChunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(recordingChunksRef.current, { type: mediaRecorder.mimeType || 'video/webm' })
        if (recordingStreamRef.current) {
          recordingStreamRef.current.getTracks().forEach((t) => t.stop())
          recordingStreamRef.current = null
        }
        if (recordingAudioStreamRef.current) {
          recordingAudioStreamRef.current.getTracks().forEach((t) => t.stop())
          recordingAudioStreamRef.current = null
        }
        if (recordingAudioContextRef.current) {
          recordingAudioContextRef.current.close().catch(() => {})
          recordingAudioContextRef.current = null
        }
        recordingMediaRecorderRef.current = null
        setIsRecordingInPlace(false)

        if (blob.size < 1000) {
          alert('Recording produced no data. Make sure you chose a screen/window to share.')
          return
        }

        const dateStr = new Date().toISOString().split('T')[0]
        const webmFilename = `presentation-recording-${dateStr}.webm`

        lastRecordingBlobRef.current = blob
        setLastRecordingBlobVersion((v) => v + 1)
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = webmFilename
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
      }

      const track = displayStream.getVideoTracks()[0]
      if (track) {
        track.onended = () => {
          if (recordingMediaRecorderRef.current?.state !== 'inactive') handleStopRecording()
        }
      }

      mediaRecorder.start(1000)
      setIsRecordingInPlace(true)
    } catch (e) {
      if (e?.name !== 'NotAllowedError') console.warn('Screen share cancelled or failed:', e)
    }
  }

  const handleStopRecording = () => {
    if (recordingMediaRecorderRef.current?.state !== 'inactive') {
      recordingMediaRecorderRef.current.stop()
    }
  }

  // Present mode (fullscreen)
  if (mode === 'present') {
    return (
      <Suspense fallback={null}>
        <PlayMode 
          slides={slides} 
          onExit={exitToPreviousMode} 
          backgroundColor={settings.backgroundColor} 
          textColor={settings.textColor} 
          fontFamily={settings.fontFamily}
          defaultTextSize={settings.defaultTextSize}
          h1Size={settings.h1Size}
          h2Size={settings.h2Size}
          h3Size={settings.h3Size}
          h1FontFamily={settings.h1FontFamily}
          h2FontFamily={settings.h2FontFamily}
          h3FontFamily={settings.h3FontFamily}
          textDropShadow={settings.textDropShadow}
          shadowBlur={settings.shadowBlur}
          shadowOffsetX={settings.shadowOffsetX}
          shadowOffsetY={settings.shadowOffsetY}
          shadowColor={settings.shadowColor}
          textOutline={settings.textOutline}
          outlineWidth={settings.outlineWidth}
          outlineColor={settings.outlineColor}
          textInlineBackground={settings.textInlineBackground}
          inlineBgColor={settings.inlineBgColor}
          inlineBgOpacity={settings.inlineBgOpacity}
          inlineBgPadding={settings.inlineBgPadding}
          showMenu={true}
          initialSlideId={selectedSlideId}
          transitionStyle={settings.transitionStyle || 'default'}
          transitionSpeed={settings.transitionSpeed ?? 1}
          canvasPushDirection={settings.canvasPushDirection || 'left'}
          lineHeight={settings.lineHeight ?? 1}
          bulletLineHeight={settings.bulletLineHeight ?? 1}
          bulletTextSize={settings.bulletTextSize ?? 3}
          bulletGap={settings.bulletGap ?? 0}
          bulletStyle={settings.bulletStyle || 'dot'}
          recordSettings={recordSettings}
          isRecording={false}
          textStyleMode={settings.textStyleMode || 'fontPairing'}
          fontPairingSerifFont={settings.fontPairingSerifFont || 'Playfair Display'}
          openaiKey={settings.openaiKey || ''}
          slideFormat={settings.slideFormat || '16:9'}
          contentBottomOffset={settings.contentBottomOffset ?? 12}
          contentEdgeOffset={settings.contentEdgeOffset ?? 9}
          contentVerticalAlign={settings.contentVerticalAlign ?? 'bottom'}
          showBullets={settings.showBullets !== false}
          defaultFontWeight={settings.defaultFontWeight ?? 700}
          h1Weight={settings.h1Weight ?? 700}
          h2Weight={settings.h2Weight ?? 700}
          h3Weight={settings.h3Weight ?? 700}
          h1LineHeight={settings.h1LineHeight ?? 1.2}
          h2LineHeight={settings.h2LineHeight ?? 1.2}
          h3LineHeight={settings.h3LineHeight ?? 1.2}
          onRecordingDone={(blob) => {
            lastRecordingBlobRef.current = blob
            setLastRecordingBlobVersion((v) => v + 1)
          }}
        />
      </Suspense>
    )
  }

  return (
    <div className={`app${mode === 'plan' ? ' plan-mode-app' : ''}${mode === 'edit' ? ' edit-mode-app' : ''}`}>
        <AppHeader
          mode={mode}
          projectName={projectName}
          onProjectNameChange={setProjectName}
          onOpenProjectOverview={() => setShowProjectOverview(true)}
          chapters={chapters}
          currentChapterId={currentChapterId}
          onChapterChange={handleChapterSelect}
          onAddChapter={handleAddChapter}
          onUpdateChapterName={handleUpdateChapterName}
          onChapterDrop={handleChapterDrop}
          workspaces={workspaces}
          currentWorkspace={currentWorkspace}
          onSwitchWorkspace={handleSwitchWorkspace}
          onAddWorkspace={handleAddWorkspace}
          onSetMode={setMode}
          onPresent={handlePresentClick}
          onRecord={handleRecordClick}
          onVideoEditing={handleEnterVideoEditing}
          isRecordingInPlace={isRecordingInPlace}
          onBulkSelectImages={handleBulkSelectImages}
          bulkImagesDisabled={!settings.openaiKey || !settings.unsplashKey}
          onBulkSelectVideos={handleBulkSelectVideos}
          bulkVideosDisabled={isBulkSelectingVideos || !settings.openaiKey || (!settings.pexelsKey && !settings.pixabayKey)}
          onExportProject={handleExportFile}
          onExportPng={handleExportSlidesAsPng}
          onExportInstagram={() => setShowInstagramExport(true)}
          onCopyText={exportSlidesAsText}
          onSaveToFolder={handleSaveToFolder}
          onImport={handleImportFile}
          slideFormat={settings.slideFormat}
          isExportingPng={isExportingPng}
          theme={theme}
          onToggleTheme={setTheme}
          onOpenPreferences={() => setShowSettings(true)}
          onToggleSidebar={() => setSidebarCollapsed((v) => !v)}
          sidebarCollapsed={sidebarCollapsed}
          onToggleInspector={() => setInspectorDrawerOpen((v) => !v)}
          inspectorOpen={inspectorDrawerOpen}
          showLayoutToggles={mode === 'edit'}
        />
      <div className={`app-content ${(isResizing || isResizingInspector) ? 'resizing' : ''} ${mode === 'video-editing' ? 'video-editing-content' : ''}${mode === 'plan' ? ' plan-mode-content' : ''}`}>
        {mode === 'plan' ? (
          <PlanMode
            slides={slides}
            onUpdateSlides={updateSlides}
            chapters={chapters}
            currentChapterId={currentChapterId}
            onUpdateChapterSlides={updateChapterSlides}
            onReorderChapters={reorderChapters}
            onUpdateChapterName={handleUpdateChapterName}
            onLoadTemplate={handleLoadTemplate}
            showTemplates={showTemplates}
            setShowTemplates={setShowTemplates}
            settings={settings}
            projectName={projectName}
            onProjectNameChange={setProjectName}
          />
        ) : mode === 'video-editing' ? (
          <Suspense fallback={null}>
            <VideoEditingMode
              key={lastRecordingBlobVersion}
              videoBlob={lastRecordingBlobRef.current}
              latestRecordingRef={lastRecordingBlobRef}
              onExit={exitToPreviousMode}
              openaiKey={settings.openaiKey}
            />
          </Suspense>
        ) : (
          <>
            <div 
              ref={sidebarRef}
              className={`sidebar-container${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}
              style={sidebarCollapsed
                ? { width: '52px', minWidth: '52px', maxWidth: '52px' }
                : { width: `${sidebarWidth}px`, minWidth: `${sidebarWidth}px`, maxWidth: `${sidebarWidth}px` }}
            >
              <SlideList
                slides={slides}
                selectedSlideId={selectedSlideId}
                selectedSlides={selectedSlides}
                setSelectedSlides={setSelectedSlides}
                onSelect={setSelectedSlideId}
                onAdd={addSlide}
                onDelete={deleteSlide}
                onDuplicate={duplicateSlide}
                onUpdate={updateSlide}
                onBatchUpdate={updateSlidesBatch}
                onReorder={updateSlides}
              />
            </div>
            {!sidebarCollapsed && (
            <div 
              className="resize-handle"
              onMouseDown={handleResizeStart}
              style={{ cursor: 'col-resize' }}
            />
            )}
            <div className="main-preview-area">
            <SlidePreview
          slide={selectedSlide}
          onUpdate={(updates) => updateSlide(selectedSlideId, updates)}
          selectedGraphicId={selectedGraphicId}
          onSelectGraphic={setSelectedGraphicId}
          onDeselectGraphic={() => setSelectedGraphicId(null)}
          selectedSubSlideId={selectedSubSlideId}
          onSelectSubSlide={setSelectedSubSlideId}
          onDeselectSubSlide={() => setSelectedSubSlideId(null)}
          settings={settings}
          slideFormat={settings.slideFormat || '16:9'}
          onUpdateSettings={setSettings}
          backgroundColor={settings.backgroundColor}
          textColor={settings.textColor}
          fontFamily={settings.fontFamily}
          defaultTextSize={settings.defaultTextSize}
          h1Size={settings.h1Size}
          h2Size={settings.h2Size}
          h3Size={settings.h3Size}
          h1FontFamily={settings.h1FontFamily}
          h2FontFamily={settings.h2FontFamily}
          h3FontFamily={settings.h3FontFamily}
          textDropShadow={settings.textDropShadow}
          shadowBlur={settings.shadowBlur}
          shadowOffsetX={settings.shadowOffsetX}
          shadowOffsetY={settings.shadowOffsetY}
          shadowColor={settings.shadowColor}
          textOutline={settings.textOutline}
          outlineWidth={settings.outlineWidth}
          outlineColor={settings.outlineColor}
          textInlineBackground={settings.textInlineBackground}
          inlineBgColor={settings.inlineBgColor}
          inlineBgOpacity={settings.inlineBgOpacity}
          inlineBgPadding={settings.inlineBgPadding}
          lineHeight={settings.lineHeight ?? 1}
          bulletLineHeight={settings.bulletLineHeight ?? 1}
          bulletTextSize={settings.bulletTextSize ?? 3}
          bulletGap={settings.bulletGap ?? 0}
          bulletStyle={settings.bulletStyle || 'dot'}
          contentBottomOffset={settings.contentBottomOffset ?? 12}
          contentEdgeOffset={settings.contentEdgeOffset ?? 9}
          contentVerticalAlign={settings.contentVerticalAlign ?? 'bottom'}
          showBullets={settings.showBullets !== false}
          defaultFontWeight={settings.defaultFontWeight ?? 700}
          h1Weight={settings.h1Weight ?? 700}
          h2Weight={settings.h2Weight ?? 700}
          h3Weight={settings.h3Weight ?? 700}
          h1LineHeight={settings.h1LineHeight ?? 1.2}
          h2LineHeight={settings.h2LineHeight ?? 1.2}
          h3LineHeight={settings.h3LineHeight ?? 1.2}
          recordSettings={recordSettings}
        />
            </div>
            {mode === 'edit' && (
              <>
                <div
                  className="resize-handle resize-handle-inspector"
                  onMouseDown={handleInspectorResizeStart}
                  style={{ cursor: 'col-resize' }}
                  title="Drag to resize inspector"
                />
                <div
                  className={`inspector-panel-wrapper${inspectorDrawerOpen ? ' inspector-drawer-open' : ''}`}
                  style={{
                    width: `${inspectorWidth}px`,
                    minWidth: `${inspectorWidth}px`,
                    maxWidth: `${inspectorWidth}px`
                  }}
                >
                  <InspectorPanel
                    activeTab={inspectorTab}
                    onTabChange={setInspectorTab}
                    recordSettings={recordSettings}
                    onUpdateRecordSettings={(updated) => setRecordSettings(updated)}
                    settings={settings}
                    onUpdateSettings={(updated) => setSettings(prev => ({ ...prev, ...updated }))}
                    slides={slides}
                    onUpdateSlide={updateSlide}
                    selectedSlide={selectedSlide}
                    selectedSlideId={selectedSlideId}
                    selectedSlides={selectedSlides}
                    selectedGraphicId={selectedGraphicId}
                    onDeselectGraphic={() => setSelectedGraphicId(null)}
                    backgroundColor={settings.backgroundColor}
                  />
                </div>
              </>
            )}
            </>
        )}
      </div>
      {isRecordingInPlace && (
        <div className="recording-bar">
          <span className="recording-bar-dot" />
          <span className="recording-bar-text">Recording</span>
          <button type="button" className="recording-bar-stop" onClick={handleStopRecording} title="Stop recording">
            Stop
          </button>
        </div>
      )}
      {showProjectOverview && (
        <Suspense fallback={null}>
          <ProjectOverview
            onClose={() => setShowProjectOverview(false)}
            recentFiles={recentFiles}
            getExportData={getExportData}
            onLoadProject={loadProjectFromData}
            onNewProject={handleNewPresentation}
            projectName={projectName}
            googleClientId={settings.googleClientId}
          />
        </Suspense>
      )}
      {showSettings && (
        <Settings
          settings={settings}
          onUpdate={setSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
      {showShortcuts && (
        <ShortcutsModal onClose={() => setShowShortcuts(false)} />
      )}
      {showCommandPalette && (
        <CommandPalette
          onClose={() => setShowCommandPalette(false)}
          onAction={handleCommandPaletteAction}
          slides={slides}
          chapters={chapters}
          currentChapterId={currentChapterId}
          instagramCarouselEnabled={isInstagramCarouselFormat(settings.slideFormat)}
        />
      )}
      {showInstagramExport && (
        <InstagramCarouselExportModal
          slides={chapters.flatMap((ch) => ch.slides)}
          projectName={projectName}
          onClose={() => { if (!isExportingPng) setShowInstagramExport(false) }}
          onExport={handleInstagramCarouselExport}
          isExporting={isExportingPng}
          exportProgress={exportProgress}
        />
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleFileChange}
        style={{ display: 'none' }}
        aria-hidden="true"
      />
      {/* Auto-save indicator */}
      {isExportingPng && (
        <div className="auto-save-indicator auto-save-indicator-export">
          <div className="auto-save-spinner"></div>
          <span>{exportProgress || 'Exporting…'}</span>
        </div>
      )}
      {!isExportingPng && isSaving && (
        <div className="auto-save-indicator">
          <div className="auto-save-spinner"></div>
          <span>Saving...</span>
        </div>
      )}
      {!isExportingPng && !isSaving && lastSaved && (
        <div className="auto-save-indicator saved">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>Saved {formatTimeAgo(lastSaved)}</span>
        </div>
      )}
    </div>
  )
}

export default App
