import { useState, useEffect, useRef, useCallback } from 'react'
import SlideList from './components/SlideList'
import SlidePreview from './components/SlidePreview'
import PlayMode from './components/PlayMode'
import PlanMode from './components/PlanMode'
import Settings from './components/Settings'
import RecordingOptions from './components/RecordingOptions'
import ColorOptions from './components/ColorOptions'
import TypographyOptions, { SERIF_OPTIONS } from './components/TypographyOptions'
import TextEffectsOptions from './components/TextEffectsOptions'
import TransitionOptions from './components/TransitionOptions'
import ShortcutsModal from './components/ShortcutsModal'
import CommandPalette from './components/CommandPalette'
import VideoEditingMode from './components/VideoEditingMode'
import ProjectOverview from './components/ProjectOverview'
import AppLogo from './components/AppLogo'
import InspectorPanel from './components/InspectorPanel'
import PresentationFeedback, { LOADING, DONE, ERROR } from './components/PresentationFeedback'
import { transcribeRecording, getPresentationFeedback } from './services/presentationAnalysis'
import { getProjectFolder, saveToProjectFolder } from './services/projectStorage'
import { preloadFFmpeg } from './utils/ffmpegExport'
import './App.css'

function App() {
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
            analysis: slide.analysis || null
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
    return {
      slides: [{ id: 1, content: 'IF YOU WANT TO FEEL CALM & IN CONTROL', subtitle: '', imageUrl: '', backgroundVideoUrl: '', layout: 'default', gradientStrength: 0.7, flipHorizontal: false, backgroundOpacity: 0.6, gradientFlipped: false, imageScale: 1.0, imagePositionX: 50, imagePositionY: 50, textHeadingLevel: null, subtitleHeadingLevel: null }],
      selectedId: 1
    }
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
        return JSON.parse(saved)
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
    return saved ? parseInt(saved, 10) : 1
  })
  const [slides, setSlides] = useState(() => {
    const currentChapter = chapters.find(c => c.id === currentChapterId) || chapters[0]
    return currentChapter ? currentChapter.slides : initialData.slides
  })
  const [selectedSlideId, setSelectedSlideId] = useState(validSelectedId)
  const [mode, setMode] = useState('edit') // 'plan', 'edit', 'present', 'record', 'video-editing'
  const lastRecordingBlobRef = useRef(null)
  const analyzeVideoInputRef = useRef(null)
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
  const [inspectorTab, setInspectorTab] = useState('slide')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisFolded, setAnalysisFolded] = useState(() => {
    const saved = localStorage.getItem('analysisFolded')
    return saved === 'true'
  })
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('appTheme')
    return saved || 'dark'
  })
  const [showProjectOverview, setShowProjectOverview] = useState(false)
  const [analyzeThisRecording, setAnalyzeThisRecording] = useState(false)
  const analyzeAfterRecordingRef = useRef(false)
  const analysisCallbackRef = useRef(null)
  const [showPresentationFeedback, setShowPresentationFeedback] = useState(false)
  const [presentationFeedback, setPresentationFeedback] = useState(null)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [selectedSlides, setSelectedSlides] = useState(new Set())
  const [history, setHistory] = useState([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState(null)
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
  const historyIndexRef = useRef(-1)
  const initialHistoryPushed = useRef(false)
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
    const savedSettings = {
      openaiKey: localStorage.getItem('openaiKey') || '',
      unsplashKey: localStorage.getItem('unsplashKey') || '',
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
      textInlineBackground: localStorage.getItem('textInlineBackground') === 'true',
      inlineBgColor: localStorage.getItem('inlineBgColor') || '#000000',
      inlineBgOpacity: parseFloat(localStorage.getItem('inlineBgOpacity')) || 0.7,
      inlineBgPadding: parseInt(localStorage.getItem('inlineBgPadding')) || 8,
      transitionStyle: localStorage.getItem('transitionStyle') || 'default',
      textAnimation: localStorage.getItem('textAnimation') || 'none',
      textAnimationUnit: localStorage.getItem('textAnimationUnit') || 'word',
      backgroundScaleAnimation: localStorage.getItem('backgroundScaleAnimation') === 'true',
      backgroundScaleTime: parseFloat(localStorage.getItem('backgroundScaleTime')) || 10,
      backgroundScaleAmount: parseFloat(localStorage.getItem('backgroundScaleAmount')) || 20,
      lineHeight: parseFloat(localStorage.getItem('lineHeight')) || 1,
      bulletLineHeight: parseFloat(localStorage.getItem('bulletLineHeight')) || 1,
      bulletTextSize: parseFloat(localStorage.getItem('bulletTextSize')) || 3,
      bulletGap: parseFloat(localStorage.getItem('bulletGap')) || 0.5,
      textStyleMode: localStorage.getItem('textStyleMode') || 'fontPairing',
      fontPairingSerifFont: localStorage.getItem('fontPairingSerifFont') || 'Playfair Display',
      contentBottomOffset: parseFloat(localStorage.getItem('contentBottomOffset')) || 12,
      contentEdgeOffset: parseFloat(localStorage.getItem('contentEdgeOffset')) || 9,
      defaultFontWeight: parseInt(localStorage.getItem('defaultFontWeight'), 10) || 700,
      h1Weight: parseInt(localStorage.getItem('h1Weight'), 10) || 700,
      h2Weight: parseInt(localStorage.getItem('h2Weight'), 10) || 700,
      h3Weight: parseInt(localStorage.getItem('h3Weight'), 10) || 700,
      googleClientId: localStorage.getItem('googleClientId') || '',
      pexelsKey: localStorage.getItem('pexelsKey') || '',
      pixabayKey: localStorage.getItem('pixabayKey') || '',
      showBullets: localStorage.getItem('showBullets') !== 'false',
      autoAdvance: localStorage.getItem('autoAdvance') === 'true',
      autoAdvanceDurationSeconds: parseFloat(localStorage.getItem('autoAdvanceDurationSeconds')) || 5
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
          webcamSize: parsed.webcamSize || 'large',
          webcamFlipHorizontal: parsed.webcamFlipHorizontal === true,
          recordingFileFormat: parsed.recordingFileFormat || 'webm-vp9',
          recordingResolution: parsed.recordingResolution || '1080p',
          recordingQuality: parsed.recordingQuality || 'high',
          captionsEnabled: parsed.captionsEnabled === true,
          captionStyle: parsed.captionStyle || 'bottom-black',
          captionFont: parsed.captionFont || 'Poppins',
          captionFontSize: parsed.captionFontSize || 'medium',
          captionDropShadow: parsed.captionDropShadow === true,
          analyzeWithAI: parsed.analyzeWithAI === true
        }
      } catch (e) {
        console.error('Error parsing record settings:', e)
      }
    }
    return {
      recordInPresentMode: false,
      webcamEnabled: false,
      webcamSize: 'large',
      webcamFlipHorizontal: false,
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
      analyzeWithAI: false
    }
  })

  // Preload FFmpeg on app load so it's ready when user opens video editing (Transcribe/Export)
  useEffect(() => {
    preloadFFmpeg()
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

  // Switch to slide settings tab when user selects a different slide (edit/plan mode)
  const prevSelectedSlideIdRef = useRef(selectedSlideId)
  useEffect(() => {
    if ((mode === 'edit' || mode === 'plan') && selectedSlideId != null && prevSelectedSlideIdRef.current !== selectedSlideId) {
      setInspectorTab('slide')
      prevSelectedSlideIdRef.current = selectedSlideId
    } else {
      prevSelectedSlideIdRef.current = selectedSlideId
    }
  }, [mode, selectedSlideId])

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

  // Save recordSettings to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('pitchDeckRecordSettings', JSON.stringify(recordSettings))
    } catch (error) {
      console.error('Error saving record settings:', error)
    }
  }, [recordSettings])

  // Callback for post-recording analysis (transcribe + coach feedback)
  useEffect(() => {
    analysisCallbackRef.current = async (blob) => {
      const apiKey = settings.openaiKey
      if (!apiKey) {
        setPresentationFeedback({ status: ERROR, errorMessage: 'OpenAI API key not set. Add it in Settings to use AI feedback.' })
        setShowPresentationFeedback(true)
        return
      }
      setShowPresentationFeedback(true)
      setPresentationFeedback({ status: LOADING })
      try {
        const transcript = await transcribeRecording(blob, apiKey)
        const slideTitles = (slides || []).map((s) => {
          const div = document.createElement('div')
          div.innerHTML = s.content || ''
          return (div.textContent || div.innerText || '').trim().slice(0, 120)
        })
        const feedback = await getPresentationFeedback(transcript, slideTitles, apiKey)
        setPresentationFeedback({ status: DONE, transcript, feedback })
      } catch (err) {
        setPresentationFeedback({ status: ERROR, errorMessage: err?.message || 'Analysis failed.' })
      }
    }
  }, [settings.openaiKey, slides])

  // Analyze video: use latest recording or uploaded file; run transcribe + feedback
  const handleAnalyzeVideo = useCallback(() => {
    if (lastRecordingBlobRef.current) {
      if (analysisCallbackRef.current) analysisCallbackRef.current(lastRecordingBlobRef.current)
      return
    }
    analyzeVideoInputRef.current?.click()
  }, [])

  const handleAnalyzeVideoFile = useCallback((e) => {
    const file = e.target?.files?.[0]
    e.target.value = ''
    if (!file) return
    const apiKey = settings.openaiKey
    if (!apiKey) {
      setPresentationFeedback({ status: ERROR, errorMessage: 'OpenAI API key not set. Add it in Settings to use AI feedback.' })
      setShowPresentationFeedback(true)
      return
    }
    setShowPresentationFeedback(true)
    setPresentationFeedback({ status: LOADING })
    const blob = file instanceof Blob ? file : new Blob([file])
    const run = async () => {
      try {
        const transcript = await transcribeRecording(blob, apiKey)
        const slideTitles = (slides || []).map((s) => {
          const div = document.createElement('div')
          div.innerHTML = s.content || ''
          return (div.textContent || div.innerText || '').trim().slice(0, 120)
        })
        const feedback = await getPresentationFeedback(transcript, slideTitles, apiKey)
        setPresentationFeedback({ status: DONE, transcript, feedback })
      } catch (err) {
        setPresentationFeedback({ status: ERROR, errorMessage: err?.message || 'Analysis failed.' })
      }
    }
    run()
  }, [settings.openaiKey, slides])

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

  // Save analysisFolded to localStorage
  useEffect(() => {
    localStorage.setItem('analysisFolded', analysisFolded.toString())
  }, [analysisFolded])

  // Save theme to localStorage and apply to document
  useEffect(() => {
    localStorage.setItem('appTheme', theme)
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  // Apply theme on initial load
  useEffect(() => {
    const savedTheme = localStorage.getItem('appTheme') || 'dark'
    document.documentElement.setAttribute('data-theme', savedTheme)
  }, [])

  // Save settings to localStorage
  useEffect(() => {
    if (settings.openaiKey) {
      localStorage.setItem('openaiKey', settings.openaiKey)
    }
    if (settings.unsplashKey) {
      localStorage.setItem('unsplashKey', settings.unsplashKey)
    }
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
    localStorage.setItem('textInlineBackground', settings.textInlineBackground ? 'true' : 'false')
    localStorage.setItem('inlineBgColor', settings.inlineBgColor || '#000000')
    localStorage.setItem('inlineBgOpacity', settings.inlineBgOpacity?.toString() || '0.7')
    localStorage.setItem('inlineBgPadding', settings.inlineBgPadding?.toString() || '8')
    localStorage.setItem('transitionStyle', settings.transitionStyle || 'default')
    localStorage.setItem('textAnimation', settings.textAnimation || 'none')
    localStorage.setItem('backgroundScaleAnimation', settings.backgroundScaleAnimation ? 'true' : 'false')
    localStorage.setItem('backgroundScaleTime', settings.backgroundScaleTime?.toString() || '10')
    localStorage.setItem('backgroundScaleAmount', settings.backgroundScaleAmount?.toString() || '20')
    localStorage.setItem('lineHeight', settings.lineHeight?.toString() || '1')
    localStorage.setItem('bulletLineHeight', settings.bulletLineHeight?.toString() || '1')
    localStorage.setItem('bulletTextSize', settings.bulletTextSize?.toString() || '3')
    localStorage.setItem('textStyleMode', settings.textStyleMode || 'fontPairing')
    localStorage.setItem('fontPairingSerifFont', settings.fontPairingSerifFont || 'Playfair Display')
    if (settings.contentBottomOffset !== undefined) localStorage.setItem('contentBottomOffset', settings.contentBottomOffset.toString())
    if (settings.contentEdgeOffset !== undefined) localStorage.setItem('contentEdgeOffset', settings.contentEdgeOffset.toString())
    localStorage.setItem('showBullets', settings.showBullets !== false ? 'true' : 'false')
    if (settings.defaultFontWeight !== undefined) localStorage.setItem('defaultFontWeight', settings.defaultFontWeight.toString())
    if (settings.h1Weight !== undefined) localStorage.setItem('h1Weight', settings.h1Weight.toString())
    if (settings.h2Weight !== undefined) localStorage.setItem('h2Weight', settings.h2Weight.toString())
    if (settings.h3Weight !== undefined) localStorage.setItem('h3Weight', settings.h3Weight.toString())
    if (settings.slideFormat) localStorage.setItem('slideFormat', settings.slideFormat)
    localStorage.setItem('autoAdvance', settings.autoAdvance ? 'true' : 'false')
    localStorage.setItem('autoAdvanceDurationSeconds', (settings.autoAdvanceDurationSeconds ?? 5).toString())
    if (settings.googleClientId !== undefined) localStorage.setItem('googleClientId', settings.googleClientId || '')
    if (settings.pexelsKey !== undefined) localStorage.setItem('pexelsKey', settings.pexelsKey || '')
    if (settings.pixabayKey !== undefined) localStorage.setItem('pixabayKey', settings.pixabayKey || '')
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
      analysisFolded
    }
  }, [chapters, currentChapterId, slides, selectedSlideId, settings, recordSettings, sidebarWidth, inspectorWidth, projectName, analysisFolded])
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
        const folder = await getProjectFolder()
        if (folder) {
          setIsSaving(true)
          await saveToProjectFolder(() => exportData, data.projectName)
          setLastSaved(new Date())
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
  }, [chapters, currentChapterId, slides, selectedSlideId, settings, recordSettings, sidebarWidth, inspectorWidth, projectName, analysisFolded])

  // Save recent files
  useEffect(() => {
    localStorage.setItem('pitchDeckRecentFiles', JSON.stringify(recentFiles))
  }, [recentFiles])

  // Save workspaces
  useEffect(() => {
    localStorage.setItem('pitchDeckWorkspaces', JSON.stringify(workspaces))
  }, [workspaces])

  // Keep ref in sync for use inside debounced saveToHistory
  useEffect(() => {
    historyIndexRef.current = historyIndex
  }, [historyIndex])

  // Keep latest state in ref so debounced updateSlide save uses current state
  useEffect(() => {
    latestStateRef.current = {
      slides,
      chapters,
      currentChapterId,
      selectedSlideId,
      settings,
      recordSettings,
      analysisFolded
    }
  }, [slides, chapters, currentChapterId, selectedSlideId, settings, recordSettings, analysisFolded])

  // Push initial state to history once so undo has a baseline
  useEffect(() => {
    if (initialHistoryPushed.current) return
    initialHistoryPushed.current = true
    setHistory([{
      slides,
      selectedSlideId,
      chapters,
      currentChapterId,
      settings,
      recordSettings,
      analysisFolded
    }])
    setHistoryIndex(0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // History management for undo/redo
  const saveToHistory = useCallback((stateSnapshot) => {
    const state = stateSnapshot ?? {
      slides,
      selectedSlideId,
      chapters,
      currentChapterId,
      settings,
      recordSettings,
      analysisFolded
    }
    setHistory(prevHistory => {
      const idx = historyIndexRef.current
      const newHistory = prevHistory.slice(0, idx + 1)
      return [...newHistory, state]
    })
    setHistoryIndex(prevIndex => prevIndex + 1)
  }, [slides, selectedSlideId, chapters, currentChapterId, settings, recordSettings, analysisFolded])

  const undo = useCallback(() => {
    if (historyIndex <= 0) return
    const prevIndex = historyIndex - 1
    const prevState = history[prevIndex]
    setHistoryIndex(prevIndex)
    setSlides(prevState.slides ?? slides)
    setChapters(prevState.chapters ?? chapters)
    setCurrentChapterId(prevState.currentChapterId ?? currentChapterId)
    setSelectedSlideId(prevState.selectedSlideId ?? selectedSlideId)
    if (prevState.settings) setSettings(prevState.settings)
    if (prevState.recordSettings) setRecordSettings(prevState.recordSettings)
    if (prevState.analysisFolded !== undefined) setAnalysisFolded(prevState.analysisFolded)
  }, [history, historyIndex, slides, chapters, currentChapterId, selectedSlideId])

  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1) return
    const nextIndex = historyIndex + 1
    const nextState = history[nextIndex]
    setHistoryIndex(nextIndex)
    setSlides(nextState.slides ?? slides)
    setChapters(nextState.chapters ?? chapters)
    setCurrentChapterId(nextState.currentChapterId ?? currentChapterId)
    setSelectedSlideId(nextState.selectedSlideId ?? selectedSlideId)
    if (nextState.settings) setSettings(nextState.settings)
    if (nextState.recordSettings) setRecordSettings(nextState.recordSettings)
    if (nextState.analysisFolded !== undefined) setAnalysisFolded(nextState.analysisFolded)
  }, [history, historyIndex, slides, chapters, currentChapterId, selectedSlideId])

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
      const folder = await getProjectFolder()
      if (folder) {
        await saveToProjectFolder(() => exportData, projectName)
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

  const addSlide = () => {
    const newId = Math.max(...slides.map(s => s.id), 0) + 1
    const newSlide = { id: newId, content: '', subtitle: '', imageUrl: '', backgroundVideoUrl: '', layout: 'default', gradientStrength: 0.7, flipHorizontal: false, backgroundOpacity: 0.6, gradientFlipped: false, imageScale: 1.0, imagePositionX: 50, imagePositionY: 50, textHeadingLevel: null, subtitleHeadingLevel: null }
    const newSlides = [...slides, newSlide]
    const newChapters = chapters.map(c => c.id === currentChapterId ? { ...c, slides: newSlides } : c)
    setSlides(newSlides)
    setSelectedSlideId(newId)
    saveToHistory({ slides: newSlides, selectedSlideId: newId, chapters: newChapters, currentChapterId, settings, recordSettings, analysisFolded })
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
    saveToHistory({ slides: newSlides, selectedSlideId: newSelected, chapters: newChapters, currentChapterId, settings, recordSettings, analysisFolded })
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
    saveToHistory({ slides: newSlides, selectedSlideId, chapters: newChapters, currentChapterId, settings, recordSettings, analysisFolded })
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
      if (showShortcuts || showCommandPalette || showSettings || showPresentationFeedback) {
        if (e.key === 'Escape') {
          setShowShortcuts(false)
          setShowCommandPalette(false)
          setShowSettings(false)
          if (showPresentationFeedback) {
            setShowPresentationFeedback(false)
          }
        }
        return
      }

      if (showProjectOverview) return

      // Toggle analysis (Cmd/Ctrl + /)
      if (e.key === '/' && cmdOrCtrl && !isInputFocused) {
        e.preventDefault()
        setAnalysisFolded(!analysisFolded)
        return
      }

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
          // Delete multiple selected slides
          const slidesToDelete = Array.from(selectedSlides)
          slidesToDelete.forEach(id => {
            if (slides.length > 1) {
              deleteSlide(id)
            }
          })
          setSelectedSlides(new Set())
        } else if (selectedSlideId) {
          deleteSlide(selectedSlideId)
        }
        return
      }

      // Tab to cycle through slides in sidebar (only in edit mode)
      if (e.key === 'Tab' && !isInputFocused && mode === 'edit' && !e.shiftKey) {
        e.preventDefault()
        const currentIndex = slides.findIndex(s => s.id === selectedSlideId)
        const nextIndex = (currentIndex + 1) % slides.length
        setSelectedSlideId(slides[nextIndex].id)
        return
      }

      // Shift+Tab to cycle backwards
      if (e.key === 'Tab' && !isInputFocused && mode === 'edit' && e.shiftKey) {
        e.preventDefault()
        const currentIndex = slides.findIndex(s => s.id === selectedSlideId)
        const prevIndex = currentIndex === 0 ? slides.length - 1 : currentIndex - 1
        setSelectedSlideId(slides[prevIndex].id)
        return
      }

      // Arrow keys for slide navigation (only in edit mode, not in input)
      if (mode === 'edit' && !isInputFocused) {
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          const currentIndex = slides.findIndex(s => s.id === selectedSlideId)
          if (currentIndex > 0) {
            setSelectedSlideId(slides[currentIndex - 1].id)
          }
        } else if (e.key === 'ArrowDown') {
          e.preventDefault()
          const currentIndex = slides.findIndex(s => s.id === selectedSlideId)
          if (currentIndex < slides.length - 1) {
            setSelectedSlideId(slides[currentIndex + 1].id)
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [mode, selectedSlideId, slides, showShortcuts, showCommandPalette, showSettings, showPresentationFeedback, analysisFolded, selectedSlides, history, historyIndex, duplicateSlide, deleteSlide, handleExportFile, undo, redo])

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

  const updateSlides = (newSlides) => {
    const newChapters = chapters.map(c => c.id === currentChapterId ? { ...c, slides: newSlides } : c)
    setSlides(newSlides)
    setChapters(newChapters)
    saveToHistory({ slides: newSlides, selectedSlideId, chapters: newChapters, currentChapterId, settings, recordSettings, analysisFolded })
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
      analysisFolded
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
      analysisFolded
    })
  }

  // Chapter management functions
  const handleAddChapter = () => {
    const newChapterId = Math.max(...chapters.map(c => c.id), 0) + 1
    const newChapter = {
      id: newChapterId,
      name: `Chapter ${newChapterId}`,
      slides: [{ id: 1, content: '', subtitle: '', imageUrl: '', backgroundVideoUrl: '', layout: 'default', gradientStrength: 0.7, flipHorizontal: false, backgroundOpacity: 0.6, gradientFlipped: false, imageScale: 1.0, imagePositionX: 50, imagePositionY: 50, textHeadingLevel: null, subtitleHeadingLevel: null }]
    }
    const newChapters = [...chapters, newChapter]
    setChapters(newChapters)
    setCurrentChapterId(newChapterId)
    saveToHistory({ slides: newChapter.slides, selectedSlideId: 1, chapters: newChapters, currentChapterId: newChapterId, settings, recordSettings, analysisFolded })
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
      saveToHistory({ slides: nextSlides, selectedSlideId: nextSelectedId, chapters: updatedChapters, currentChapterId: nextChapterId, settings, recordSettings, analysisFolded })
    }
  }

  const handleUpdateChapterName = (chapterId, newName) => {
    const updatedChapters = chapters.map(c =>
      c.id === chapterId ? { ...c, name: newName } : c
    )
    setChapters(updatedChapters)
    saveToHistory({ slides, selectedSlideId, chapters: updatedChapters, currentChapterId, settings, recordSettings, analysisFolded })
  }

  const defaultSlideShape = useCallback(() => ({
    content: '',
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
    analysis: null,
    backgroundColorOverride: false,
    backgroundColorOverrideValue: undefined
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
      analysis: slide.analysis ?? null
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
      analysisFolded,
      exportedAt: new Date().toISOString()
    }
  }, [chapters, currentChapterId, slides, selectedSlideId, settings, recordSettings, sidebarWidth, inspectorWidth, projectName, analysisFolded, defaultSlideShape])

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
    saveToHistory({ slides: newSlides, selectedSlideId: nextSelectedId, chapters: updatedChapters, currentChapterId, settings, recordSettings, analysisFolded })
  }

  // Save project name to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('pitchDeckProjectName', projectName)
  }, [projectName])

  // Normalize slide object with default layout and numeric props (shared for load/import).
  const normalizeSlide = useCallback((slide) => ({
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
    subtitleHeadingLevel: slide.subtitleHeadingLevel || null,
    analysis: slide.analysis != null ? slide.analysis : null,
    backgroundColorOverride: slide.backgroundColorOverride === true,
    backgroundColorOverrideValue: slide.backgroundColorOverrideValue ?? undefined
  }), [])

  // Load project data (from overview Open, or after file read). Same shape as export.
  const loadProjectFromData = useCallback((importData) => {
    if (!importData) return
    if (importData.chapters && Array.isArray(importData.chapters)) {
      const normalizedChapters = importData.chapters.map(ch => ({
        ...ch,
        slides: (ch.slides || []).map(normalizeSlide)
      }))
      setChapters(normalizedChapters)
      setCurrentChapterId(importData.currentChapterId || importData.chapters[0]?.id || 1)
    } else if (importData.slides && Array.isArray(importData.slides)) {
      const slidesWithLayout = importData.slides.map(normalizeSlide)
      setChapters([{ id: 1, name: 'Chapter 1', slides: slidesWithLayout }])
      setCurrentChapterId(1)
    } else return
    const chaptersToUse = importData.chapters && Array.isArray(importData.chapters)
      ? importData.chapters.map(ch => ({ ...ch, slides: (ch.slides || []).map(normalizeSlide) }))
      : [{ id: 1, name: 'Chapter 1', slides: (importData.slides || []).map(normalizeSlide) }]
    const currentChapter = chaptersToUse.find(c => c.id === (importData.currentChapterId || chaptersToUse[0]?.id))
    const slidesToLoad = currentChapter ? currentChapter.slides : (importData.slides || []).map(normalizeSlide)
    const slidesWithLayout = Array.isArray(slidesToLoad) ? slidesToLoad : []
    setSlides(slidesWithLayout)
    const validSelectedId = slidesWithLayout.find(s => s.id === importData.selectedSlideId)
      ? importData.selectedSlideId
      : slidesWithLayout[0]?.id || 1
    setSelectedSlideId(validSelectedId)
    if (importData.settings) {
      setSettings(prev => ({ ...prev, ...importData.settings }))
    }
    if (importData.sidebarWidth !== undefined) setSidebarWidth(importData.sidebarWidth)
    if (importData.inspectorWidth !== undefined) setInspectorWidth(importData.inspectorWidth)
    if (importData.projectName !== undefined) setProjectName(importData.projectName)
    if (importData.recordSettings) setRecordSettings(importData.recordSettings)
    if (importData.analysisFolded !== undefined) setAnalysisFolded(importData.analysisFolded)
  }, [normalizeSlide])

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

        // Ensure all slides have required properties (for current chapter)
        const currentChapter = importData.chapters 
          ? importData.chapters.find(c => c.id === (importData.currentChapterId || importData.chapters[0]?.id))
          : null
        const slidesToLoad = currentChapter 
          ? currentChapter.slides 
          : (importData.slides || [])
        
        const slidesWithLayout = slidesToLoad.map(slide => ({
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
          subtitleHeadingLevel: slide.subtitleHeadingLevel || null,
          webcamEnabled: slide.webcamEnabled !== undefined ? slide.webcamEnabled : false,
          selectedCameraId: slide.selectedCameraId || '',
          analysis: slide.analysis || null
        }))

        // Confirm before importing (to avoid losing current work)
        const confirmMessage = `This will replace your current presentation with the imported data. Continue?`
        if (!window.confirm(confirmMessage)) {
          e.target.value = '' // Reset file input
          return
        }

        // Load slides for current chapter
        setSlides(slidesWithLayout)
        
        // Load selected slide ID (validate it exists)
        const validSelectedId = slidesWithLayout.find(s => s.id === importData.selectedSlideId)
          ? importData.selectedSlideId
          : slidesWithLayout[0]?.id || 1
        setSelectedSlideId(validSelectedId)

        // Load settings if provided (merge with existing to preserve API keys if not in file)
        if (importData.settings) {
          setSettings(prevSettings => ({
            ...prevSettings,
            ...importData.settings
          }))
        }

        // Load sidebar width if provided
        if (importData.sidebarWidth !== undefined) {
          setSidebarWidth(importData.sidebarWidth)
        }

        // Load inspector width if provided
        if (importData.inspectorWidth !== undefined) {
          setInspectorWidth(importData.inspectorWidth)
        }

        // Load project name if provided
        if (importData.projectName !== undefined) {
          setProjectName(importData.projectName)
        }

        // Load record settings if provided
        if (importData.recordSettings) {
          setRecordSettings(importData.recordSettings)
        }

        alert(`Successfully imported ${slidesWithLayout.length} slide(s)!`)
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

    // Find slides without images (exclude sections and fullscreen camera layout)
    const slidesWithoutImages = slides.filter(slide => 
      (slide.layout || 'default') !== 'section' && 
      (slide.layout || 'default') !== 'video' && 
      (!slide.imageUrl || slide.imageUrl.trim() === '')
    )
    
    if (slidesWithoutImages.length === 0) {
      alert('All slides already have images!')
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
        // Get slide content (remove HTML tags)
        const tempDiv = document.createElement('div')
        tempDiv.innerHTML = slide.content || ''
        const slideText = tempDiv.textContent || tempDiv.innerText || ''
        
        if (!slideText.trim()) {
          failCount++
          continue
        }

        // Use OpenAI to generate a search query
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${settings.openaiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: [
              {
                role: 'system',
                content: 'You are a helpful assistant that generates concise, descriptive search queries for finding images on Unsplash. Return only a single search query (2-4 words) that best represents the content and mood of the text.'
              },
              {
                role: 'user',
                content: `Generate an Unsplash search query for this slide text: "${slideText}"`
              }
            ],
            max_tokens: 20
          })
        })

        const data = await response.json()
        if (!response.ok || !data.choices?.[0]?.message?.content) {
          failCount++
          continue
        }
        const searchQuery = String(data.choices[0].message.content).trim().replace(/['"]/g, '')

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
    
    const message = `Image selection complete!\n${successCount} image(s) added successfully.${failCount > 0 ? `\n${failCount} slide(s) could not be processed.` : ''}`
    alert(message)
  }

  const handleAnalyzeSlides = async () => {
    if (!settings.openaiKey) {
      alert('Please set your OpenAI API key in settings first.')
      return
    }

    if (slides.length === 0) {
      alert('No slides to analyze.')
      return
    }

    setIsAnalyzing(true)

    try {
      // Get current chapter name for context
      const currentChapter = chapters.find(c => c.id === currentChapterId)
      const chapterName = currentChapter?.name || 'Chapter'

      // Prepare slide data for analysis (exclude section slides)
      const slidesToAnalyze = slides.filter(s => (s.layout || 'default') !== 'section')
      
      if (slidesToAnalyze.length === 0) {
        alert('No content slides to analyze.')
        setIsAnalyzing(false)
        return
      }

      // Build context about slides
      const slidesContext = slidesToAnalyze.map((slide, index) => {
        const tempDiv = document.createElement('div')
        tempDiv.innerHTML = slide.content || ''
        const contentText = tempDiv.textContent || tempDiv.innerText || ''
        const subtitleText = slide.subtitle || ''
        return {
          index: index + 1,
          layout: slide.layout || 'default',
          content: contentText,
          subtitle: subtitleText
        }
      }).map(s => `Slide ${s.index} (${s.layout}): "${s.content}"${s.subtitle ? ` - Subtitle: "${s.subtitle}"` : ''}`).join('\n')

      // Build the request body - using OpenAI API
      const requestBody = {
        model: 'gpt-3.5-turbo',
        messages: [
            {
              role: 'system',
              content: `You are an expert presentation analyst. Analyze pitch deck slides and provide concise, actionable feedback for each slide. 

The slides are like headlines/outlines - they contain minimal content, not full paragraphs. Consider:
- The chapter/section context: "${chapterName}"
- What the slide should emphasize: emotions, facts, proof, credibility, benefits, etc.
- What would make the slide stronger
- Suggestions for additional slides if needed

IMPORTANT: Do NOT suggest changing the layout or template. Focus only on content, messaging, and what the slide should emphasize.

For each slide, provide:
1. What the slide should push on (emotions, facts, proof, etc.)
2. How to strengthen the content and messaging
3. Optional: Suggest adding more slides about specific topics if the presentation needs more depth

Keep each analysis concise (2-3 sentences max). You MUST return ONLY valid JSON with this exact structure:
{
  "analyses": [
    {"slideIndex": 1, "analysis": "Analysis text here"},
    {"slideIndex": 2, "analysis": "Analysis text here"}
  ]
}`
            },
          {
            role: 'user',
            content: `Analyze these slides from "${chapterName}":\n\n${slidesContext}\n\nReturn ONLY the JSON object, no other text.`
          }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 2000
      }

      // Analyze all slides at once using OpenAI API
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.openaiKey}`
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        let errorMessage = `API error: ${response.status} ${response.statusText}`
        try {
          const errorData = await response.json()
          if (errorData.error?.message) {
            errorMessage = errorData.error.message
          } else if (errorData.error) {
            errorMessage = JSON.stringify(errorData.error)
          }
        } catch (e) {
          // If we can't parse the error, use the status text
        }
        console.error('OpenAI API Error:', errorMessage)
        throw new Error(errorMessage)
      }

      const data = await response.json()
      
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Invalid response from OpenAI')
      }

      const analysisText = data.choices[0].message.content
      if (!analysisText) {
        throw new Error('Empty response from OpenAI')
      }

      let analysisData
      
      try {
        analysisData = JSON.parse(analysisText)
      } catch (e) {
        console.error('Failed to parse analysis response:', analysisText)
        throw new Error('Could not parse analysis response as JSON')
      }

      if (!analysisData.analyses || !Array.isArray(analysisData.analyses)) {
        throw new Error('Invalid analysis format: missing analyses array')
      }

      // Update slides with analysis
      const updatedSlides = slides.map(slide => {
        if ((slide.layout || 'default') === 'section') {
          return slide // Skip section slides
        }

        // Find analysis for this slide
        const slideIndex = slidesToAnalyze.findIndex(s => s.id === slide.id) + 1
        let analysis = null

        if (analysisData.analyses && Array.isArray(analysisData.analyses)) {
          const slideAnalysis = analysisData.analyses.find(a => a.slideIndex === slideIndex)
          if (slideAnalysis) {
            analysis = slideAnalysis.analysis
          }
        }

        return { ...slide, analysis }
      })

      const updatedChapters = currentChapter
        ? chapters.map(ch => ch.id === currentChapterId ? { ...ch, slides: updatedSlides } : ch)
        : chapters
      setSlides(updatedSlides)
      setChapters(updatedChapters)
      saveToHistory({ slides: updatedSlides, selectedSlideId, chapters: updatedChapters, currentChapterId, settings, recordSettings, analysisFolded })

      try {
        if (currentChapter) {
          localStorage.setItem('pitchDeckChapters', JSON.stringify(updatedChapters))
        }
      } catch (error) {
        console.error('Error saving analysis:', error)
      }

      alert(`Analysis complete! ${slidesToAnalyze.length} slide(s) analyzed.`)
    } catch (error) {
      console.error('Error analyzing slides:', error)
      const errorMessage = error.message || 'Unknown error'
      alert(`Error analyzing slides: ${errorMessage}\n\nPlease check your OpenAI API key in settings and ensure it's valid.`)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const selectedSlide = slides.find(s => s.id === selectedSlideId)

  // Present: open present view and go fullscreen (one button, one action)
  const handlePresentClick = () => {
    setMode('present')
  }

  // Record: start screen recording in-place (no present mode, no fullscreen)
  const handleRecordClick = async () => {
    try {
      recordingChunksRef.current = []
      const shouldAnalyze = recordSettings.analyzeWithAI ?? false
      analyzeAfterRecordingRef.current = shouldAnalyze
      setAnalyzeThisRecording(shouldAnalyze)

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

        if (analyzeAfterRecordingRef.current && analysisCallbackRef.current) {
          try {
            analysisCallbackRef.current(blob)
          } catch (e) {
            console.error('Presentation analysis failed:', e)
          }
        }
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
      <>
        <PlayMode 
          slides={slides} 
          onExit={() => setMode('edit')} 
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
          textInlineBackground={settings.textInlineBackground}
          inlineBgColor={settings.inlineBgColor}
          inlineBgOpacity={settings.inlineBgOpacity}
          inlineBgPadding={settings.inlineBgPadding}
          showMenu={true}
          initialSlideId={selectedSlideId}
          transitionStyle={settings.transitionStyle || 'default'}
          textAnimation={settings.textAnimation || 'none'}
          textAnimationUnit={settings.textAnimationUnit || 'word'}
          backgroundScaleAnimation={settings.backgroundScaleAnimation || false}
          backgroundScaleTime={settings.backgroundScaleTime || 10}
          backgroundScaleAmount={settings.backgroundScaleAmount ?? 20}
          lineHeight={settings.lineHeight ?? 1}
          bulletLineHeight={settings.bulletLineHeight ?? 1}
          bulletTextSize={settings.bulletTextSize ?? 3}
          bulletGap={settings.bulletGap ?? 0.5}
          recordSettings={recordSettings}
          isRecording={false}
          textStyleMode={settings.textStyleMode || 'fontPairing'}
          fontPairingSerifFont={settings.fontPairingSerifFont || 'Playfair Display'}
          openaiKey={settings.openaiKey || ''}
          slideFormat={settings.slideFormat || '16:9'}
          contentBottomOffset={settings.contentBottomOffset ?? 12}
          contentEdgeOffset={settings.contentEdgeOffset ?? 9}
          showBullets={settings.showBullets !== false}
          autoAdvance={settings.autoAdvance === true}
          autoAdvanceDurationSeconds={settings.autoAdvanceDurationSeconds ?? 5}
          defaultFontWeight={settings.defaultFontWeight ?? 700}
          h1Weight={settings.h1Weight ?? 700}
          h2Weight={settings.h2Weight ?? 700}
          h3Weight={settings.h3Weight ?? 700}
          onRecordingDone={(blob) => {
            lastRecordingBlobRef.current = blob
            setLastRecordingBlobVersion((v) => v + 1)
          }}
        />
      </>
    )
  }

  // Plan mode
  if (mode === 'plan') {
    return (
      <div className="app plan-mode-app">
        <div className="app-header">
          <div className="header-top-row">
            <div className="header-left">
            <button type="button" className="header-app-title" onClick={() => setShowProjectOverview(true)} title="Project overview">
              <AppLogo />
            </button>
            <div className="header-file-actions">
              {workspaces.length > 1 && (
                <div className="workspace-switcher">
                  <button className="btn-icon-header btn-workspace" title="Switch workspace">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <line x1="9" y1="3" x2="9" y2="21" />
                    </svg>
                    <span>{workspaces.find(w => w.id === currentWorkspace)?.name || 'Workspace'}</span>
                  </button>
                  <div className="workspace-menu">
                    {workspaces.map(workspace => (
                      <button
                        key={workspace.id}
                        className={`workspace-item ${currentWorkspace === workspace.id ? 'active' : ''}`}
                        onClick={() => {
                          setCurrentWorkspace(workspace.id)
                          localStorage.setItem('pitchDeckCurrentWorkspace', workspace.id)
                          // Load workspace data
                          const workspaceData = localStorage.getItem(`pitchDeckWorkspace_${workspace.id}`)
                          if (workspaceData) {
                            try {
                              const data = JSON.parse(workspaceData)
                              if (data.chapters) setChapters(data.chapters)
                              if (data.currentChapterId) setCurrentChapterId(data.currentChapterId)
                              if (data.settings) setSettings(prev => ({ ...prev, ...data.settings }))
                              if (data.projectName) setProjectName(data.projectName)
                            } catch (e) {
                              console.error('Error loading workspace:', e)
                            }
                          }
                        }}
                      >
                        {workspace.name}
                      </button>
                    ))}
                    <button
                      className="workspace-item add"
                      onClick={() => {
                        const newId = Math.max(...workspaces.map(w => w.id), 0) + 1
                        const newWorkspace = { id: newId, name: `Workspace ${newId}` }
                        setWorkspaces([...workspaces, newWorkspace])
                        localStorage.setItem('pitchDeckWorkspaces', JSON.stringify([...workspaces, newWorkspace]))
                      }}
                    >
                      + New Workspace
                    </button>
                  </div>
                </div>
              )}
              <input
                type="text"
                className="project-name-input"
                placeholder="Project name"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                title="Project name (used when saving files)"
              />
              </div>
              {(mode === 'plan' || mode === 'edit') && (
                <div
                  className="header-chapters"
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'move'
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    const slideId = parseInt(e.dataTransfer.getData('text/html'))
                    if (slideId) {
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
                          saveToHistory({ slides: newSlidesForView, selectedSlideId, chapters: updatedChapters, currentChapterId, settings, recordSettings, analysisFolded })
                        }
                      }
                    }
                  }}
                >
                  <select
                    className="chapter-dropdown"
                    value={currentChapterId}
                    onChange={(e) => {
                      const nextId = parseInt(e.target.value, 10)
                      const nextChapter = chapters.find(c => c.id === nextId)
                      if (nextChapter) {
                        const nextSlides = nextChapter.slides
                        const nextSelected = nextSlides.some(s => s.id === selectedSlideId) ? selectedSlideId : (nextSlides[0]?.id ?? selectedSlideId)
                        setCurrentChapterId(nextId)
                        setSlides(nextSlides)
                        setSelectedSlideId(nextSelected)
                        saveToHistory({ slides: nextSlides, selectedSlideId: nextSelected, chapters, currentChapterId: nextId, settings, recordSettings, analysisFolded })
                      }
                    }}
                    title="Chapter"
                  >
                    {chapters.map((chapter) => (
                      <option key={chapter.id} value={chapter.id}>
                        {chapter.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="chapter-rename-btn"
                    onClick={() => {
                      const currentChapter = chapters.find(c => c.id === currentChapterId)
                      if (!currentChapter) return
                      const newName = window.prompt('Rename chapter', currentChapter.name)
                      if (newName != null && newName.trim() !== '') {
                        handleUpdateChapterName(currentChapterId, newName.trim())
                      }
                    }}
                    title="Rename chapter"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button
                    className="chapter-tab-add"
                    onClick={handleAddChapter}
                    title="Add chapter"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
            <div className="header-center">
              <div className="header-mode-buttons">
                <button
                  className={`header-mode-btn ${mode === 'plan' ? 'active' : ''}`}
                  onClick={() => setMode('plan')}
                  title="Plan"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                  <span>Plan</span>
                </button>
                <button
                  className={`header-mode-btn ${mode === 'edit' ? 'active' : ''}`}
                  onClick={() => setMode('edit')}
                  title="Edit"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  <span>Edit</span>
                </button>
                <button
                  className={`header-mode-btn ${mode === 'present' ? 'active' : ''}`}
                  onClick={handlePresentClick}
                  title="Present (fullscreen)"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  <span>Present</span>
                </button>
                <button
                  className={`header-mode-btn ${isRecordingInPlace ? 'active' : ''} present-with-recording`}
                  onClick={handleRecordClick}
                  disabled={isRecordingInPlace}
                  title="Record screen"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="12" r="3" fill="currentColor" />
                  </svg>
                  <span>Record</span>
                </button>
                <button
                  className={`header-mode-btn ${mode === 'video-editing' ? 'active' : ''}`}
                  onClick={() => setMode('video-editing')}
                  title="Video editing"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="23 7 16 12 23 17 23 7" />
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                  </svg>
                  <span>Video editing</span>
                </button>
              </div>
              <div className="header-format-select-wrap">
                <label htmlFor="header-slide-format" className="header-format-label">Format</label>
                <select
                  id="header-slide-format"
                  className="header-format-select"
                  value={settings.slideFormat || '16:9'}
                  onChange={(e) => setSettings(prev => ({ ...prev, slideFormat: e.target.value }))}
                  title="Slide aspect ratio"
                >
                  <option value="16:9">16:9</option>
                  <option value="1:1">1:1</option>
                  <option value="9:16">9:16</option>
                </select>
              </div>
            </div>
            <div className="header-right">
              <div className="header-icon-group">
                <button
                  className="btn-icon-header btn-undo"
                  onClick={undo}
                  title="Undo (Ctrl+Z)"
                  disabled={historyIndex <= 0}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 10h10a5 5 0 0 1 5 5v2" />
                    <polyline points="3 10 8 5 3 0" />
                  </svg>
                </button>
                <button
                  className="btn-icon-header btn-redo"
                  onClick={redo}
                  title="Redo (Ctrl+Y)"
                  disabled={historyIndex >= history.length - 1 || history.length === 0}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10H11a5 5 0 0 0-5 5v2" />
                    <polyline points="21 10 16 5 21 0" />
                  </svg>
                </button>
              </div>
              <div className="header-icon-group-divider" aria-hidden="true" />
              <div className="header-icon-group">
                <button 
                  className="btn-icon-header btn-bulk-images" 
                  onClick={handleBulkSelectImages}
                  title="Auto-select images for all slides without images"
                  disabled={!settings.openaiKey || !settings.unsplashKey}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                </button>
                <button 
                  className="btn-icon-header btn-analyze" 
                  onClick={handleAnalyzeSlides}
                  title="Analyze slides"
                  disabled={!settings.openaiKey || isAnalyzing}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 11a3 3 0 1 0 6 0 3 3 0 0 0-6 0z" />
                    <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 0 1-2.827 0l-4.244-4.243a8 8 0 1 1 11.314 0z" />
                    <path d="M15 11a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="btn-icon-header btn-view-feedback"
                  onClick={() => setShowPresentationFeedback(true)}
                  title="AI training feedback: view coach feedback from your recording"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  <span className="btn-tooltip">AI feedback</span>
                </button>
                <button
                  type="button"
                  className="btn-icon-header"
                  onClick={handleAnalyzeVideo}
                  title={lastRecordingBlobRef.current ? "Analyze latest recorded video" : "Analyze video (upload or use latest recording)"}
                  disabled={!settings.openaiKey}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="23 7 16 12 23 17 23 7" />
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                  </svg>
                  <span className="btn-tooltip">Analyze video</span>
                </button>
              </div>
              <div className="header-icon-group-divider" aria-hidden="true" />
              <div className="header-icon-group">
                <button 
                  className="btn-icon-header btn-theme-toggle" 
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} 
                  title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                >
                  {theme === 'dark' ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="5" />
                      <line x1="12" y1="1" x2="12" y2="3" />
                      <line x1="12" y1="21" x2="12" y2="23" />
                      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                      <line x1="1" y1="12" x2="3" y2="12" />
                      <line x1="21" y1="12" x2="23" y2="12" />
                      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                    </svg>
                  )}
                </button>
                <button className="btn-icon-header btn-settings" onClick={() => setShowSettings(true)} title="API Keys & Settings">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="app-content plan-mode-content">
          <PlanMode slides={slides} onUpdateSlides={updateSlides} chapters={chapters} currentChapterId={currentChapterId} onUpdateChapterSlides={updateChapterSlides} onReorderChapters={reorderChapters} onUpdateChapterName={handleUpdateChapterName} onLoadTemplate={handleLoadTemplate} showTemplates={showTemplates} setShowTemplates={setShowTemplates} settings={settings} projectName={projectName} onProjectNameChange={setProjectName} />
        </div>
        {showProjectOverview && (
          <ProjectOverview
            onClose={() => setShowProjectOverview(false)}
            recentFiles={recentFiles}
            getExportData={getExportData}
            onLoadProject={loadProjectFromData}
            onNewProject={handleNewPresentation}
            projectName={projectName}
            googleClientId={settings.googleClientId}
          />
        )}
        {showSettings && (
          <Settings
            settings={settings}
            onUpdate={setSettings}
            onClose={() => setShowSettings(false)}
          />
        )}
    </div>
  )
}

  return (
    <div className="app">
        <div className="app-header">
          <div className="header-top-row">
            <div className="header-left">
              <button type="button" className="header-app-title" onClick={() => setShowProjectOverview(true)} title="Project overview">
                <AppLogo />
              </button>
              <div className="header-file-actions">
                <input
                  type="text"
                  className="project-name-input"
                  placeholder="Project name"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  title="Project name (used when saving files)"
                />
              </div>
              {(mode === 'plan' || mode === 'edit') && (
                <div
                  className="header-chapters"
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'move'
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    const slideId = parseInt(e.dataTransfer.getData('text/html'))
                    if (slideId) {
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
                          saveToHistory({ slides: newSlidesForView, selectedSlideId, chapters: updatedChapters, currentChapterId, settings, recordSettings, analysisFolded })
                        }
                      }
                    }
                  }}
                >
                  <select
                    className="chapter-dropdown"
                    value={currentChapterId}
                    onChange={(e) => {
                      const nextId = parseInt(e.target.value, 10)
                      const nextChapter = chapters.find(c => c.id === nextId)
                      if (nextChapter) {
                        const nextSlides = nextChapter.slides
                        const nextSelected = nextSlides.some(s => s.id === selectedSlideId) ? selectedSlideId : (nextSlides[0]?.id ?? selectedSlideId)
                        setCurrentChapterId(nextId)
                        setSlides(nextSlides)
                        setSelectedSlideId(nextSelected)
                        saveToHistory({ slides: nextSlides, selectedSlideId: nextSelected, chapters, currentChapterId: nextId, settings, recordSettings, analysisFolded })
                      }
                    }}
                    title="Chapter"
                  >
                    {chapters.map((chapter) => (
                      <option key={chapter.id} value={chapter.id}>
                        {chapter.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="chapter-rename-btn"
                    onClick={() => {
                      const currentChapter = chapters.find(c => c.id === currentChapterId)
                      if (!currentChapter) return
                      const newName = window.prompt('Rename chapter', currentChapter.name)
                      if (newName != null && newName.trim() !== '') {
                        handleUpdateChapterName(currentChapterId, newName.trim())
                      }
                    }}
                    title="Rename chapter"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button
                    className="chapter-tab-add"
                    onClick={handleAddChapter}
                    title="Add chapter"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
            <div className="header-center">
              <div className="header-mode-buttons">
                <button
                  className={`header-mode-btn ${mode === 'plan' ? 'active' : ''}`}
                  onClick={() => setMode('plan')}
                  title="Plan"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                  <span>Plan</span>
                </button>
                <button
                  className={`header-mode-btn ${mode === 'edit' ? 'active' : ''}`}
                  onClick={() => setMode('edit')}
                  title="Edit"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  <span>Edit</span>
                </button>
                <button
                  className={`header-mode-btn ${mode === 'present' ? 'active' : ''}`}
                  onClick={handlePresentClick}
                  title="Present (fullscreen)"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  <span>Present</span>
                </button>
                <button
                  className={`header-mode-btn ${isRecordingInPlace ? 'active' : ''} present-with-recording`}
                  onClick={handleRecordClick}
                  disabled={isRecordingInPlace}
                  title="Record screen"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="12" r="3" fill="currentColor" />
                  </svg>
                  <span>Record</span>
                </button>
                <button
                  className={`header-mode-btn ${mode === 'video-editing' ? 'active' : ''}`}
                  onClick={() => setMode('video-editing')}
                  title="Video editing"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="23 7 16 12 23 17 23 7" />
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                  </svg>
                  <span>Video editing</span>
                </button>
              </div>
              <div className="header-format-select-wrap">
                <label htmlFor="header-slide-format" className="header-format-label">Format</label>
                <select
                  id="header-slide-format"
                  className="header-format-select"
                  value={settings.slideFormat || '16:9'}
                  onChange={(e) => setSettings(prev => ({ ...prev, slideFormat: e.target.value }))}
                  title="Slide aspect ratio"
                >
                  <option value="16:9">16:9</option>
                  <option value="1:1">1:1</option>
                  <option value="9:16">9:16</option>
                </select>
              </div>
            </div>
            <div className="header-right">
              <div className="header-icon-group">
                <button
                  className="btn-icon-header btn-undo"
                  onClick={undo}
                  title="Undo (Ctrl+Z)"
                  disabled={historyIndex <= 0}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 10h10a5 5 0 0 1 5 5v2" />
                    <polyline points="3 10 8 5 3 0" />
                  </svg>
                </button>
                <button
                  className="btn-icon-header btn-redo"
                  onClick={redo}
                  title="Redo (Ctrl+Y)"
                  disabled={historyIndex >= history.length - 1 || history.length === 0}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10H11a5 5 0 0 0-5 5v2" />
                    <polyline points="21 10 16 5 21 0" />
                  </svg>
                </button>
              </div>
              <div className="header-icon-group-divider" aria-hidden="true" />
              <div className="header-icon-group">
                <button 
                  className="btn-icon-header btn-bulk-images" 
                  onClick={handleBulkSelectImages}
                  title="Auto-select images for all slides without images"
                  disabled={!settings.openaiKey || !settings.unsplashKey}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                </button>
                <button 
                  className="btn-icon-header btn-analyze" 
                  onClick={handleAnalyzeSlides}
                  title="Analyze slides"
                  disabled={!settings.openaiKey || isAnalyzing}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 11a3 3 0 1 0 6 0 3 3 0 0 0-6 0z" />
                    <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 0 1-2.827 0l-4.244-4.243a8 8 0 1 1 11.314 0z" />
                    <path d="M15 11a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="btn-icon-header btn-view-feedback"
                  onClick={() => setShowPresentationFeedback(true)}
                  title="AI training feedback: view coach feedback from your recording"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  <span className="btn-tooltip">AI feedback</span>
                </button>
                <button
                  type="button"
                  className="btn-icon-header"
                  onClick={handleAnalyzeVideo}
                  title={lastRecordingBlobRef.current ? "Analyze latest recorded video" : "Analyze video (upload or use latest recording)"}
                  disabled={!settings.openaiKey}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="23 7 16 12 23 17 23 7" />
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                  </svg>
                  <span className="btn-tooltip">Analyze video</span>
                </button>
              </div>
              <div className="header-icon-group-divider" aria-hidden="true" />
              <div className="header-icon-group">
                <button 
                  className="btn-icon-header btn-theme-toggle" 
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} 
                  title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                >
                  {theme === 'dark' ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="5" />
                      <line x1="12" y1="1" x2="12" y2="3" />
                      <line x1="12" y1="21" x2="12" y2="23" />
                      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                      <line x1="1" y1="12" x2="3" y2="12" />
                      <line x1="21" y1="12" x2="23" y2="12" />
                      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                    </svg>
                  )}
                </button>
                <button className="btn-icon-header btn-settings" onClick={() => setShowSettings(true)} title="API Keys & Settings">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
      </div>
      <div className={`app-content ${(isResizing || isResizingInspector) ? 'resizing' : ''} ${mode === 'video-editing' ? 'video-editing-content' : ''}`}>
        {mode === 'video-editing' ? (
          <VideoEditingMode
            key={lastRecordingBlobVersion}
            videoBlob={lastRecordingBlobRef.current}
            latestRecordingRef={lastRecordingBlobRef}
            onExit={() => setMode('edit')}
            openaiKey={settings.openaiKey}
          />
        ) : (
          <>
            <div 
              ref={sidebarRef}
              className="sidebar-container"
              style={{ width: `${sidebarWidth}px`, minWidth: `${sidebarWidth}px`, maxWidth: `${sidebarWidth}px` }}
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
                onReorder={updateSlides}
              />
            </div>
            <div 
              className="resize-handle"
              onMouseDown={handleResizeStart}
              style={{ cursor: 'col-resize' }}
            />
            <div className="main-preview-area">
            <SlidePreview
          slide={selectedSlide}
          onUpdate={(updates) => updateSlide(selectedSlideId, updates)}
          settings={settings}
          slideFormat={settings.slideFormat || '16:9'}
          onUpdateSettings={setSettings}
          analysisFolded={analysisFolded}
          onToggleAnalysisFold={() => setAnalysisFolded(!analysisFolded)}
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
          textInlineBackground={settings.textInlineBackground}
          inlineBgColor={settings.inlineBgColor}
          inlineBgOpacity={settings.inlineBgOpacity}
          inlineBgPadding={settings.inlineBgPadding}
          lineHeight={settings.lineHeight ?? 1}
          bulletLineHeight={settings.bulletLineHeight ?? 1}
          bulletTextSize={settings.bulletTextSize ?? 3}
          bulletGap={settings.bulletGap ?? 0.5}
          contentBottomOffset={settings.contentBottomOffset ?? 12}
          contentEdgeOffset={settings.contentEdgeOffset ?? 9}
          showBullets={settings.showBullets !== false}
          autoAdvance={settings.autoAdvance === true}
          autoAdvanceDurationSeconds={settings.autoAdvanceDurationSeconds ?? 5}
          defaultFontWeight={settings.defaultFontWeight ?? 700}
          h1Weight={settings.h1Weight ?? 700}
          h2Weight={settings.h2Weight ?? 700}
          h3Weight={settings.h3Weight ?? 700}
          recordSettings={recordSettings}
        />
            </div>
            {(mode === 'plan' || mode === 'edit') && (
              <>
                <div
                  className="resize-handle resize-handle-inspector"
                  onMouseDown={handleInspectorResizeStart}
                  style={{ cursor: 'col-resize' }}
                  title="Drag to resize inspector"
                />
                <div
                  className="inspector-panel-wrapper"
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
          <label className="recording-bar-analyze">
            <input
              type="checkbox"
              checked={analyzeThisRecording}
              onChange={(e) => {
                const v = e.target.checked
                setAnalyzeThisRecording(v)
                analyzeAfterRecordingRef.current = v
                setRecordSettings((prev) => ({ ...prev, analyzeWithAI: v }))
              }}
            />
            <span>Get AI feedback</span>
          </label>
          <button type="button" className="recording-bar-stop" onClick={handleStopRecording} title="Stop recording">
            Stop
          </button>
        </div>
      )}
      {showPresentationFeedback && (
        <PresentationFeedback
          onClose={() => setShowPresentationFeedback(false)}
          status={presentationFeedback?.status}
          transcript={presentationFeedback?.transcript}
          feedback={presentationFeedback?.feedback}
          errorMessage={presentationFeedback?.errorMessage}
          onUploadVideo={() => analyzeVideoInputRef.current?.click()}
        />
      )}
      {showProjectOverview && (
        <ProjectOverview
          onClose={() => setShowProjectOverview(false)}
          recentFiles={recentFiles}
          getExportData={getExportData}
          onLoadProject={loadProjectFromData}
          onNewProject={handleNewPresentation}
          projectName={projectName}
          googleClientId={settings.googleClientId}
        />
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
      <input
        ref={analyzeVideoInputRef}
        type="file"
        accept="video/*,.webm,.mp4,.mov"
        onChange={handleAnalyzeVideoFile}
        style={{ display: 'none' }}
        aria-hidden="true"
      />
      {/* Auto-save indicator */}
      {isSaving && (
        <div className="auto-save-indicator">
          <div className="auto-save-spinner"></div>
          <span>Saving...</span>
        </div>
      )}
      {!isSaving && lastSaved && (
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

// Helper function to format time ago
function formatTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default App
