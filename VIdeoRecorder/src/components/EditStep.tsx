import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Scene, RecordingTake } from '../App'
import { projectManager } from '../utils/projectManager'
import { transcribeAudio, WordTimestamp } from '../utils/transcription'
import { VideoCut, Layout, combineLayersWithLayout, concatVideos } from '../utils/videoProcessing'
import { trimVideo, getFFmpeg } from '../utils/ffmpeg'
import { fetchFile } from '@ffmpeg/util'
import { exportDaVinciResolveTimeline } from '../utils/davinciExport'
import { parseCubeLUT, applyLUTToImageData } from '../utils/lutProcessor'
import { analyzeWaveform } from '../utils/waveformAnalyzer'
import SettingsPanel from './SettingsPanel'
import { TimelineAudioClip } from './TimelineAudioClip'

interface EditStepProps {
  scenes: Scene[]
  onScenesChange?: (scenes: Scene[]) => void
  onEditedChange?: (edited: boolean) => void
  showExportDialog?: boolean
  onExportDialogChange?: (show: boolean) => void
  onSaveRequest?: (saveFn: () => Promise<void>) => void
}

type SidebarTab = 'canvas' | 'layout' | 'clip' | 'zoom' | 'cursor' | 'captions' | 'audio' | 'visual'

// ContentEditable component for rich text editing
const TitleEditor = React.forwardRef<HTMLDivElement, {
  html: string
  onChange: (html: string) => void
  onBlur: () => void
  className?: string
  placeholder?: string
}>(({ html, onChange, onBlur, className, placeholder }, ref) => {
  const innerRef = useRef<HTMLDivElement>(null)
  const isUpdatingRef = useRef(false)

  // Combine refs
  useEffect(() => {
    if (typeof ref === 'function') {
      ref(innerRef.current)
    } else if (ref) {
      (ref as React.MutableRefObject<HTMLDivElement | null>).current = innerRef.current
    }
  }, [ref])

  // Sync HTML content when prop changes (but not when user is typing)
  useEffect(() => {
    if (!innerRef.current || isUpdatingRef.current) return
    if (innerRef.current.innerHTML !== html) {
      innerRef.current.innerHTML = html || ''
    }
  }, [html])

  return (
    <>
      <div
        ref={innerRef}
        contentEditable
        suppressContentEditableWarning
        onInput={(e) => {
          isUpdatingRef.current = true
          if (innerRef.current) {
            onChange(innerRef.current.innerHTML)
          }
          setTimeout(() => {
            isUpdatingRef.current = false
          }, 0)
        }}
        onBlur={onBlur}
        className={className}
        style={{ whiteSpace: 'pre-wrap' }}
        data-placeholder={placeholder}
      />
      <style>{`
        [contenteditable][data-placeholder]:empty:before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
        }
      `}</style>
    </>
  )
})
TitleEditor.displayName = 'TitleEditor'

interface SceneTake {
  sceneId: string
  sceneIndex: number
  take: RecordingTake
  startTime: number // Start time in the combined timeline
  endTime: number // End time in the combined timeline
  trimmedStart: number // Amount trimmed from start (in seconds)
  trimmedEnd: number // Amount trimmed from end (in seconds)
}

export default function EditStep({ scenes, onScenesChange, onEditedChange, showExportDialog: externalShowExportDialog, onExportDialogChange, onSaveRequest }: EditStepProps) {
  // Track if there are unsaved edits
  const hasUnsavedEditsRef = useRef(false)
  
  // Mark edits as unsaved
  const markAsEdited = useCallback(() => {
    if (!hasUnsavedEditsRef.current) {
      hasUnsavedEditsRef.current = true
      onEditedChange?.(true)
    }
  }, [onEditedChange])
  
  // Mark edits as saved (called after successful save)
  const markAsSaved = useCallback(() => {
    if (hasUnsavedEditsRef.current) {
      hasUnsavedEditsRef.current = false
      onEditedChange?.(false)
    }
  }, [onEditedChange])
  // Get all selected takes from all scenes, arranged sequentially
  const [sceneTakes, setSceneTakes] = useState<SceneTake[]>([])
  const [selectedSceneIndex, setSelectedSceneIndex] = useState<number>(0)

  // Current scene being edited
  const currentSceneTake = sceneTakes[selectedSceneIndex]
  const selectedSceneId = currentSceneTake?.sceneId || ''
  const selectedTake = currentSceneTake?.take || null

  // Video playback - multiple video elements for canvas holders
  const videoRef = useRef<HTMLVideoElement>(null) // Main video (camera)
  const screenVideoRef = useRef<HTMLVideoElement>(null) // Screen video
  const audioRef = useRef<HTMLAudioElement>(null) // Audio
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [totalDuration, setTotalDuration] = useState(0) // Total duration of all scenes
  const [playbackRate, setPlaybackRate] = useState(1)

  // Sidebar
  const [activeTab, setActiveTab] = useState<SidebarTab>('captions')
  const [showSettings, setShowSettings] = useState(false)

  // Transcription (per scene)
  const [transcripts, setTranscripts] = useState<Map<string, { words: WordTimestamp[]; text: string }>>(new Map())
  const [selectedText, setSelectedText] = useState<{ start: number; end: number; sceneId: string } | null>(null)
  const [isTranscribing, setIsTranscribing] = useState<Map<string, boolean>>(new Map())

  // Deleted words (strikethrough) - per scene, stored as Set of word indices
  const [deletedWords, setDeletedWords] = useState<Map<string, Set<number>>>(new Map())
  
  // Selected words (per scene) - for deletion and correction
  const [selectedWordIndices, setSelectedWordIndices] = useState<Map<string, Set<number>>>(new Map())
  
  // Word corrections (per scene, word index -> corrected text)
  const [wordCorrections, setWordCorrections] = useState<Map<string, Map<number, string>>>(new Map())
  
  // State for correction dialog
  const [correctionDialog, setCorrectionDialog] = useState<{ sceneId: string; wordIndex: number; currentWord: string } | null>(null)
  
  // Track if C key is being held
  const isCPressedRef = useRef(false)

  // Cuts (per scene, stored with sceneId)
  const [cuts, setCuts] = useState<Map<string, VideoCut[]>>(new Map())

  // Layout clips - store layout data per timeline segment
  interface LayoutTitle {
    text: string
    enabled: boolean
    x: number // Position (0-1, relative to canvas width)
    y: number // Position (0-1, relative to canvas height)
  }

  interface LayoutBackgroundImage {
    url: string // Data URL or blob URL
    enabled: boolean
  }

  interface LayoutClip {
    id: string
    timelineStart: number // Start position on timeline (in seconds)
    timelineEnd: number // End position on timeline (in seconds)
    holders: CanvasVideoHolder[] // Canvas holder positions for this layout
    title?: LayoutTitle // Title configuration
    backgroundImage?: LayoutBackgroundImage // Background image configuration
    name?: string // Optional name for template
  }

  // Layout preset stored in browser
  interface LayoutPreset {
    id: string
    name: string
    thumbnail: string // Data URL
    holders: CanvasVideoHolder[]
    title?: LayoutTitle
    backgroundImage?: LayoutBackgroundImage
    createdAt: number
  }

  // Global title settings
  const [titleSettings, setTitleSettings] = useState({
    font: 'Inter, sans-serif',
    size: 48, // in pixels
  })

  const [layoutClips, setLayoutClips] = useState<LayoutClip[]>([])
  const [layoutPresets, setLayoutPresets] = useState<LayoutPreset[]>([])
  
  // Unsplash search state
  const [unsplashModalOpen, setUnsplashModalOpen] = useState(false)
  const [unsplashSearchQuery, setUnsplashSearchQuery] = useState('')
  const [unsplashResults, setUnsplashResults] = useState<Array<{
    id: string
    urls: { regular: string; small: string; thumb: string }
    description: string | null
    user: { name: string; username: string }
  }>>([])
  const [unsplashLoading, setUnsplashLoading] = useState(false)
  
  // State to force re-renders during transitions
  const [transitionFrame, setTransitionFrame] = useState(0)
  
  // Layout (global) - kept for backward compatibility and default layouts
  const [layout, setLayout] = useState<Layout>({ type: 'camera-only' })
  const [savedLayouts, setSavedLayouts] = useState<Layout[]>([])

  // Load layout presets from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('layoutPresets')
      if (stored) {
        setLayoutPresets(JSON.parse(stored))
      }
    } catch (error) {
      console.error('Error loading layout presets:', error)
    }
  }, [])

  // Save layout presets to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('layoutPresets', JSON.stringify(layoutPresets))
    } catch (error) {
      console.error('Error saving layout presets:', error)
    }
  }, [layoutPresets])

  // Load title settings from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('titleSettings')
      if (stored) {
        setTitleSettings(JSON.parse(stored))
      }
    } catch (error) {
      console.error('Error loading title settings:', error)
    }
  }, [])

  // Save title settings to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('titleSettings', JSON.stringify(titleSettings))
    } catch (error) {
      console.error('Error saving title settings:', error)
    }
  }, [titleSettings])

  // Export selection
  const [selectedScenesForExport, setSelectedScenesForExport] = useState<Set<string>>(new Set())
  const [internalShowExportDialog, setInternalShowExportDialog] = useState(false)
  const showExportDialog = externalShowExportDialog !== undefined ? externalShowExportDialog : internalShowExportDialog
  const setShowExportDialog = onExportDialogChange || setInternalShowExportDialog
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState('')
  const [exportFormat, setExportFormat] = useState<'mp4' | 'webm'>('mp4')
  const [exportMode, setExportMode] = useState<'combined' | 'separate'>('combined')
  const [exportProgressPercent, setExportProgressPercent] = useState(0)
  
  // FFmpeg loading state
  const [ffmpegLoading, setFfmpegLoading] = useState(false)
  const [ffmpegReady, setFfmpegReady] = useState(false)
  const [ffmpegError, setFfmpegError] = useState<string | null>(null)

  // Load edit data when project is available
  useEffect(() => {
    if (!projectManager.hasProject() || scenes.length === 0) return

    const loadEditData = async () => {
      try {
        const editData = await projectManager.loadEditData()
        if (!editData) {
          console.log('No edit data found to load')
          return
        }
        console.log('Loading edit data:', editData)

        // Restore cuts
        if (editData.cuts) {
          const cutsMap = new Map<string, VideoCut[]>()
          Object.entries(editData.cuts).forEach(([sceneId, cutsArray]) => {
            cutsMap.set(sceneId, cutsArray || [])
          })
          setCuts(cutsMap)
        }

        // Restore layout
        if (editData.layout) {
          setLayout(editData.layout as Layout)
        }

        // Restore layout clips
        if (editData.layoutClips && Array.isArray(editData.layoutClips)) {
          setLayoutClips(editData.layoutClips)
        }

        // Restore layout presets
        if (editData.layoutPresets && Array.isArray(editData.layoutPresets)) {
          setLayoutPresets(editData.layoutPresets)
        }

        // Restore timeline clips
        if (editData.timelineClips && Array.isArray(editData.timelineClips)) {
          setTimelineClips(editData.timelineClips)
        }

        // Restore clip properties
        if (editData.clipProperties) {
          const clipPropsMap = new Map<string, ClipProperties>()
          Object.entries(editData.clipProperties).forEach(([key, props]) => {
            clipPropsMap.set(key, props as ClipProperties)
          })
          setClipProperties(clipPropsMap)
        }

        // Restore deleted words
        if (editData.deletedWords) {
          const deletedWordsMap = new Map<string, Set<number>>()
          Object.entries(editData.deletedWords).forEach(([sceneId, wordIndices]) => {
            deletedWordsMap.set(sceneId, new Set(wordIndices || []))
          })
          setDeletedWords(deletedWordsMap)
        }

        // Restore audio settings
        if (editData.audioSettings) {
          setAudioSettings(editData.audioSettings)
        }

        // Restore visual settings
        if (editData.visualSettings) {
          setVisualSettings(editData.visualSettings)
        }

        // Restore canvas settings
        if (editData.canvasSettings) {
          setCanvasSettings(editData.canvasSettings)
        }

        // Restore caption settings
        if (editData.captionSettings) {
          setCaptionFont(editData.captionSettings.font || captionFont)
          setCaptionSize(editData.captionSettings.size ?? captionSize)
          setCaptionMaxWords(editData.captionSettings.maxWords ?? captionMaxWords)
          setSelectedCaptionStyle(editData.captionSettings.style || selectedCaptionStyle)
        }

        // Restore timeline settings
        if (editData.timelineSettings) {
          setTimelineZoom(editData.timelineSettings.zoom ?? timelineZoom)
          setTimelineHeight(editData.timelineSettings.height ?? timelineHeight)
          setTimelineLayerHeightScale(editData.timelineSettings.layerHeightScale ?? timelineLayerHeightScale)
        }

        // Restore title settings
        if (editData.titleSettings) {
          setTitleSettings(editData.titleSettings)
        }

        // Restore background music (file name only, user will need to re-upload file)
        if (editData.backgroundMusic) {
          setBackgroundMusic(prev => ({
            ...prev,
            volume: editData.backgroundMusic?.volume ?? prev.volume,
          }))
        }

        console.log('Edit data loaded successfully')
      } catch (error) {
        console.error('Error loading edit data:', error)
      }
    }

    loadEditData()
  }, [scenes.length]) // Load when scenes are available (projectManager.hasProject() is checked inside)

  // Pre-load FFmpeg when component mounts
  useEffect(() => {
    let cancelled = false
    
    const loadFFmpeg = async () => {
      setFfmpegLoading(true)
      setFfmpegError(null)
      
      try {
        await Promise.race([
          getFFmpeg(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('FFmpeg initialization timeout (60s)')), 60000)
          )
        ])
        
        if (!cancelled) {
          setFfmpegReady(true)
          setFfmpegLoading(false)
          console.log('FFmpeg loaded and ready')
        }
      } catch (error) {
        if (!cancelled) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          setFfmpegError(errorMessage)
          setFfmpegLoading(false)
          setFfmpegReady(false)
          console.error('Failed to load FFmpeg:', error)
        }
      }
    }
    
    loadFFmpeg()
    
    return () => {
      cancelled = true
    }
  }, [])

  // Clip selection and properties
  const [selectedClip, setSelectedClip] = useState<{ sceneId: string; takeId: string; layer: 'camera' | 'microphone' | 'screen' } | null>(null)

  interface ClipProperties {
    // Audio properties
    enhanceVoice: boolean
    volume: number // in dB, 0 is default
    removeNoise: boolean
    noiseRemovalLevel: number // 0-100
    audioQuality: 'fast' | 'balanced' | 'best'
    // Video properties
    brightness: number // -100 to 100
    contrast: number // -100 to 100
    saturation: number // -100 to 100
    exposure: number // -100 to 100
  }

  const [clipProperties, setClipProperties] = useState<Map<string, ClipProperties>>(new Map())

  // Audio settings (global)
  const [audioSettings, setAudioSettings] = useState({
    noiseReduction: false,
    noiseReductionLevel: 50, // 0-100
    enhanceVoice: false,
    normalizeAudio: false,
    removeEcho: false,
    removeBackgroundNoise: false,
    audioQuality: 'best' as 'fast' | 'balanced' | 'best',
  })

  // Visual settings (global)
  const [visualSettings, setVisualSettings] = useState({
    lutEnabled: false,
    lutFile: null as File | null,
    lutIntensity: 100, // 0-100
    colorGrading: {
      shadows: 0, // -100 to 100
      midtones: 0,
      highlights: 0,
    },
    backgroundColor: '#000000', // Background color for gaps/empty canvas
  })

  // Background music settings
  const [backgroundMusic, setBackgroundMusic] = useState<{
    file: File | null
    url: string | null
    volume: number // 0-100
  }>({
    file: null,
    url: null,
    volume: 50, // Default 50%
  })

  // Canvas settings (format, resolution, backgrounds, transitions)
  const [canvasSettings, setCanvasSettings] = useState({
    format: '16:9' as '16:9' | '9:16' | '1:1',
    resolution: {
      width: 1920,
      height: 1080,
    },
    workAreaBackgroundColor: '#1a1a1a', // Background color for work area
    videoBackgroundColor: '#000000', // Background color for video (used in export)
    transitionDuration: 0.5, // Duration of position transitions between clips (in seconds)
  })

  // Calculate canvas dimensions based on format and resolution
  const canvasDimensions = useMemo(() => {
    const { format, resolution } = canvasSettings
    let width = resolution.width
    let height = resolution.height

    // Strictly enforce aspect ratio based on format
    if (format === '16:9') {
      // 16:9 landscape: height = width / (16/9) = width * 9/16
      height = Math.round(width * 9 / 16)
    } else if (format === '9:16') {
      // 9:16 portrait: height = width / (9/16) = width * 16/9
      height = Math.round(width * 16 / 9)
    } else if (format === '1:1') {
      // 1:1 square: height = width
      height = width
    }

    const aspectRatio = width / height
    return { width, height, aspectRatio }
  }, [canvasSettings.format, canvasSettings.resolution.width, canvasSettings.resolution.height])

  // Media blobs (for current scene)
  const [cameraBlob, setCameraBlob] = useState<Blob | null>(null)
  const [microphoneBlob, setMicrophoneBlob] = useState<Blob | null>(null)
  const [screenBlob, setScreenBlob] = useState<Blob | null>(null)

  // Canvas refs
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const lutCanvasRef = useRef<HTMLCanvasElement>(null)
  // Load canvas zoom from localStorage
  const loadCanvasZoom = useCallback(() => {
    try {
      const saved = localStorage.getItem('canvasZoom')
      if (saved) {
        const parsed = parseFloat(saved)
        if (!isNaN(parsed) && parsed >= 0.1 && parsed <= 2) {
          return parsed
        }
      }
    } catch (e) {
      console.error('Error loading canvas zoom:', e)
    }
    return 1 // Default: 100%
  }, [])
  
  const [canvasZoom, setCanvasZoom] = useState(loadCanvasZoom)
  const canvasContainerRef = useRef<HTMLDivElement>(null)
  
  // Save canvas zoom to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('canvasZoom', canvasZoom.toString())
    } catch (e) {
      console.error('Error saving canvas zoom:', e)
    }
  }, [canvasZoom])
  
  // Load pan position from localStorage
  const loadPanPosition = useCallback(() => {
    try {
      const saved = localStorage.getItem('canvasPanPosition')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed && typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          return { x: parsed.x, y: parsed.y }
        }
      }
    } catch (e) {
      console.error('Error loading pan position:', e)
    }
    return { x: 0, y: 0 }
  }, [])

  const [canvasPan, setCanvasPan] = useState<{ x: number; y: number }>(loadPanPosition)
  const [isPanning, setIsPanning] = useState(false)
  const panStartPosRef = useRef<{ x: number; y: number } | null>(null)
  const panStartOffsetRef = useRef<{ x: number; y: number } | null>(null)

  // Save pan position to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('canvasPanPosition', JSON.stringify(canvasPan))
    } catch (e) {
      console.error('Error saving pan position:', e)
    }
  }, [canvasPan])

  // Video size (maintains aspect ratio)
  const [videoSize, setVideoSize] = useState({ width: 100, height: 100 }) // Percentage of container
  const [videoAspectRatio, setVideoAspectRatio] = useState<number | null>(null)

  // LUT data
  const [lutData, setLutData] = useState<number[][][] | null>(null)

  // Video thumbnails for timeline
  const [videoThumbnails, setVideoThumbnails] = useState<Map<string, string>>(new Map())

  // Waveform data for timeline (key: sceneId_takeId)
  const [waveforms, setWaveforms] = useState<Map<string, number[]>>(new Map())

  // Caption styles and settings
  type CaptionStyleId = 'none' | 'style1' | 'style2' | 'style3' | 'style4' | 'style5' | 'style6' | 'style7' | 'style8' | 'style9' | 'style10'

  interface CaptionStyle {
    id: CaptionStyleId
    name: string
    backgroundColor: string
    textColor: string
    padding: string
    borderRadius: string
    border?: string
    boxShadow?: string
    fontWeight: string | number
    textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize'
  }

  const captionStyles: CaptionStyle[] = [
    { id: 'none', name: 'No Captions', backgroundColor: 'transparent', textColor: '#ffffff', padding: '0', borderRadius: '0', fontWeight: 400 },
    { id: 'style1', name: 'Classic', backgroundColor: 'rgba(0, 0, 0, 0.75)', textColor: '#ffffff', padding: '8px 16px', borderRadius: '4px', fontWeight: 400 },
    { id: 'style2', name: 'Bold White', backgroundColor: 'rgba(255, 255, 255, 0.95)', textColor: '#000000', padding: '10px 18px', borderRadius: '6px', fontWeight: 700, boxShadow: '0 2px 8px rgba(0,0,0,0.3)' },
    { id: 'style3', name: 'Highlight Yellow', backgroundColor: '#FFEB3B', textColor: '#000000', padding: '8px 14px', borderRadius: '8px', fontWeight: 600 },
    { id: 'style4', name: 'Neon Blue', backgroundColor: 'rgba(107, 114, 128, 0.9)', textColor: '#ffffff', padding: '10px 20px', borderRadius: '12px', fontWeight: 600, boxShadow: '0 0 20px rgba(107, 114, 128, 0.5)' },
    { id: 'style5', name: 'Subtle Gray', backgroundColor: 'rgba(66, 66, 66, 0.85)', textColor: '#ffffff', padding: '6px 12px', borderRadius: '2px', fontWeight: 400 },
    { id: 'style6', name: 'Vibrant Red', backgroundColor: '#F44336', textColor: '#ffffff', padding: '10px 18px', borderRadius: '10px', fontWeight: 700, boxShadow: '0 4px 12px rgba(244, 67, 54, 0.4)' },
    { id: 'style7', name: 'Outlined', backgroundColor: 'rgba(0, 0, 0, 0.7)', textColor: '#ffffff', padding: '8px 16px', borderRadius: '4px', border: '2px solid #ffffff', fontWeight: 500 },
    { id: 'style8', name: 'Modern Gradient', backgroundColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', textColor: '#ffffff', padding: '10px 20px', borderRadius: '20px', fontWeight: 600, boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)' },
    { id: 'style9', name: 'Uppercase Bold', backgroundColor: 'rgba(0, 0, 0, 0.8)', textColor: '#ffffff', padding: '10px 18px', borderRadius: '6px', fontWeight: 700, textTransform: 'uppercase' },
    { id: 'style10', name: 'Soft Pink', backgroundColor: 'rgba(236, 64, 122, 0.9)', textColor: '#ffffff', padding: '9px 17px', borderRadius: '14px', fontWeight: 500, boxShadow: '0 2px 10px rgba(236, 64, 122, 0.3)' },
  ]

  const [selectedCaptionStyle, setSelectedCaptionStyle] = useState<CaptionStyleId>('style1')
  const [captionFont, setCaptionFont] = useState<string>('Inter')
  const [captionSize, setCaptionSize] = useState<number>(16)
  const [captionMaxWords, setCaptionMaxWords] = useState<number>(5) // Maximum words to show at once
  // Track which word indices have which style (per scene)
  const [captionWordStyles, setCaptionWordStyles] = useState<Map<string, Map<number, CaptionStyleId>>>(new Map())

  const availableFonts = [
    { name: 'Inter', value: 'Inter, sans-serif' },
    { name: 'Roboto', value: 'Roboto, sans-serif' },
    { name: 'Open Sans', value: '"Open Sans", sans-serif' },
    { name: 'Poppins', value: 'Poppins, sans-serif' },
    { name: 'Montserrat', value: 'Montserrat, sans-serif' },
    { name: 'Lato', value: 'Lato, sans-serif' },
    { name: 'Oswald', value: 'Oswald, sans-serif' },
    { name: 'Raleway', value: 'Raleway, sans-serif' },
    { name: 'Ubuntu', value: 'Ubuntu, sans-serif' },
  ]

  // Resizable transcript panel
  // Load transcript width from localStorage
  const loadTranscriptWidth = useCallback(() => {
    try {
      const saved = localStorage.getItem('transcriptPanelWidth')
      if (saved) {
        const parsed = parseInt(saved, 10)
        if (!isNaN(parsed) && parsed > 0) {
          return Math.max(200, Math.min(800, parsed)) // Clamp between 200-800px
        }
      }
    } catch (e) {
      console.error('Error loading transcript width:', e)
    }
    return 320
  }, [])

  // Load timeline height from localStorage
  const loadTimelineHeight = useCallback(() => {
    try {
      const saved = localStorage.getItem('timelineHeight')
      if (saved) {
        const parsed = parseInt(saved, 10)
        if (!isNaN(parsed) && parsed > 0) {
          return Math.max(100, Math.min(window.innerHeight * 0.5, parsed)) // Clamp between 100px and 50% of viewport
        }
      }
    } catch (e) {
      console.error('Error loading timeline height:', e)
    }
    return 192
  }, [])

  const [transcriptWidth, setTranscriptWidth] = useState(loadTranscriptWidth)
  const [isResizing, setIsResizing] = useState(false)
  const transcriptResizeRef = useRef<HTMLDivElement>(null)
  const titleEditorRef = useRef<HTMLDivElement>(null)

  // Resizable timeline
  const [timelineHeight, setTimelineHeight] = useState(loadTimelineHeight)
  const [isResizingTimeline, setIsResizingTimeline] = useState(false)

  // Save transcript width to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('transcriptPanelWidth', transcriptWidth.toString())
    } catch (e) {
      console.error('Error saving transcript width:', e)
    }
  }, [transcriptWidth])

  // Save timeline height to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('timelineHeight', timelineHeight.toString())
    } catch (e) {
      console.error('Error saving timeline height:', e)
    }
  }, [timelineHeight])

  // Ref for tracking playback state across scene switches and playback loop
  const wasPlayingRef = useRef(false)

  // Timeline View Settings
  const [timelineTrackHeight, setTimelineTrackHeight] = useState(80) // Default height px
  
  // Load timeline zoom from localStorage
  const loadTimelineZoom = useCallback(() => {
    try {
      const saved = localStorage.getItem('timelineZoom')
      if (saved) {
        const parsed = parseInt(saved, 10)
        if (!isNaN(parsed) && parsed >= 10 && parsed <= 200) {
          return parsed
        }
      }
    } catch (e) {
      console.error('Error loading timeline zoom:', e)
    }
    return 50 // Default: 50 pixels per second
  }, [])
  
  // Load timeline layer height scale from localStorage
  const loadTimelineLayerHeightScale = useCallback(() => {
    try {
      const saved = localStorage.getItem('timelineLayerHeightScale')
      if (saved) {
        const parsed = parseFloat(saved)
        if (!isNaN(parsed) && parsed >= 0.1 && parsed <= 3) {
          return parsed
        }
      }
    } catch (e) {
      console.error('Error loading timeline layer height scale:', e)
    }
    return 1 // Default: 100%
  }, [])
  
  const [timelineZoom, setTimelineZoom] = useState(loadTimelineZoom)
  const [timelineLayerHeightScale, setTimelineLayerHeightScale] = useState(loadTimelineLayerHeightScale)
  const minZoom = 10 // 10px per second (zoomed out)
  const maxZoom = 200 // 200px per second (zoomed in)
  
  // Save timeline zoom to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('timelineZoom', timelineZoom.toString())
    } catch (e) {
      console.error('Error saving timeline zoom:', e)
    }
  }, [timelineZoom])
  
  // Save timeline layer height scale to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('timelineLayerHeightScale', timelineLayerHeightScale.toString())
    } catch (e) {
      console.error('Error saving timeline layer height scale:', e)
    }
  }, [timelineLayerHeightScale])

  // Calculate optimal canvas display size based on available space and aspect ratio
  const canvasDisplaySize = useMemo(() => {
    // Calculate available space (accounting for sidebar, timeline, padding)
    const estimatedUIHeight = 152 // header + controls + padding
    const availableHeight = window.innerHeight - timelineHeight - estimatedUIHeight - 32 // 32px for padding
    const availableWidth = window.innerWidth - 320 - 32 // sidebar + padding
    
    // Calculate size that fits while maintaining aspect ratio
    const widthBasedHeight = availableWidth / canvasDimensions.aspectRatio
    const heightBasedWidth = availableHeight * canvasDimensions.aspectRatio
    
    // Choose the constraint that fits better - ensure it's centered
    if (widthBasedHeight <= availableHeight) {
      // Width is the limiting factor
      return {
        width: Math.min(availableWidth, availableHeight * canvasDimensions.aspectRatio),
        height: Math.min(widthBasedHeight, availableHeight)
      }
    } else {
      // Height is the limiting factor
      return {
        width: Math.min(heightBasedWidth, availableWidth),
        height: Math.min(availableHeight, availableWidth / canvasDimensions.aspectRatio)
      }
    }
  }, [canvasDimensions, timelineHeight])

  // Timeline tools
  type TimelineTool = 'select' | 'cut'
  const [timelineTool, setTimelineTool] = useState<TimelineTool>('select')

  // Timeline clips structure - proper clip-based editing like DaVinci Resolve
  interface TimelineClip {
    id: string
    sceneId: string
    takeId: string
    layer: 'camera' | 'microphone' | 'screen'
    // Timeline position
    timelineStart: number // Start position on timeline (in seconds)
    timelineEnd: number // End position on timeline (in seconds)
    // Source media in/out points (trim points)
    sourceIn: number // Start time in source media (in seconds)
    sourceOut: number // End time in source media (in seconds)
    // Original source duration (for limiting trims)
    sourceDuration: number // Full duration of source media
  }

  // Canvas video holder - represents a video clip on the canvas
  interface CanvasVideoHolder {
    id: string
    clipId: string // Reference to timeline clip
    layer: 'camera' | 'microphone' | 'screen'
    // Position and size on canvas (0-1 normalized coordinates)
    x: number // 0 = left edge, 1 = right edge
    y: number // 0 = top edge, 1 = bottom edge
    width: number // Width as fraction of canvas (0-1)
    height: number // Height as fraction of canvas (0-1)
    // Rotation (future)
    rotation: number // Degrees
    // Z-index for layering
    zIndex: number
  }

  // Clip holder on canvas - position and size for rendering
  interface ClipHolder {
    clipId: string // Links to TimelineClip.id
    x: number // Position X (0-1, relative to canvas width)
    y: number // Position Y (0-1, relative to canvas height)
    width: number // Width (0-1, relative to canvas width)
    height: number // Height (0-1, relative to canvas height)
  }

  const [timelineClips, setTimelineClips] = useState<TimelineClip[]>([])
  const [selectedClipIds, setSelectedClipIds] = useState<Set<string>>(new Set())
  const [selectedLayoutClipIds, setSelectedLayoutClipIds] = useState<Set<string>>(new Set())
  
  // Get current layout clip based on timeline time
  const getCurrentLayoutClip = useCallback((timelineTime: number): LayoutClip | null => {
    return layoutClips.find(lc => 
      timelineTime >= lc.timelineStart && timelineTime < lc.timelineEnd
    ) || null
  }, [layoutClips])
  
  // Canvas video holders - derived from current layout clip (not stored separately)
  // Positions and sizes are stored in layout clips, not in holders themselves
  const canvasHolders = useMemo(() => {
    const currentLayoutClip = getCurrentLayoutClip(currentTime)
    if (currentLayoutClip && currentLayoutClip.holders) {
      return currentLayoutClip.holders
    }
    return []
  }, [currentTime, getCurrentLayoutClip])
  
  // Holder transitions - track animated transitions between positions
  // Key is holder ID, but we also track by clipId_layer for layout clip transitions
  const transitioningHoldersRef = useRef<Map<string, {
    startPos: { x: number; y: number; width: number; height: number }
    endPos: { x: number; y: number; width: number; height: number }
    startRotation?: number
    endRotation?: number
    startTime: number
    duration: number
    clipId?: string // Store clipId for matching
    layer?: string // Store layer for matching
  }>>(new Map())
  
  // Track transitions by clipId_layer for layout clip changes
  const transitioningByClipRef = useRef<Map<string, {
    startPos: { x: number; y: number; width: number; height: number }
    endPos: { x: number; y: number; width: number; height: number }
    startRotation?: number
    endRotation?: number
    startTime: number
    duration: number
  }>>(new Map())
  
  // Fade-out transitions - track previous holders that should fade out
  const fadingOutHoldersRef = useRef<Map<string, {
    holder: CanvasVideoHolder
    startTime: number
    duration: number
  }>>(new Map())
  
  // Selected holder for editing
  const [selectedHolderId, setSelectedHolderId] = useState<string | null>(null)

  // Expose function to get all edit data for saving
  const getEditData = useCallback(() => {
    return {
      deletedWords: Object.fromEntries(
        Array.from(deletedWords.entries()).map(([k, v]) => [k, Array.from(v)])
      ),
      timelineClips: timelineClips.map(clip => ({
        ...clip,
        // Ensure all required fields are included
      })),
      clipProperties: Object.fromEntries(
        Array.from(clipProperties.entries()).map(([k, v]) => [k, { ...v }])
      ),
      cuts: Object.fromEntries(
        Array.from(cuts.entries()).map(([k, v]) => [k, [...v]])
      ),
      layout: JSON.parse(JSON.stringify(layout)),
      layoutClips: layoutClips.map(lc => ({ ...lc })),
      layoutPresets: layoutPresets.map(lp => ({ ...lp })),
      titleSettings: { ...titleSettings },
      canvasSettings: {
        ...canvasSettings,
        resolution: { ...canvasSettings.resolution },
      },
      audioSettings: { ...audioSettings },
      visualSettings: {
        ...visualSettings,
        colorGrading: { ...visualSettings.colorGrading },
      },
      captionSettings: {
        font: captionFont,
        size: captionSize,
        maxWords: captionMaxWords,
        style: selectedCaptionStyle,
      },
      timelineSettings: {
        zoom: timelineZoom,
        height: timelineHeight,
        layerHeightScale: timelineLayerHeightScale || 1,
      },
      backgroundMusic: {
        fileName: backgroundMusic.file?.name || null,
        volume: backgroundMusic.volume,
        // Note: File blob URL is not serialized - will need to be re-uploaded on load
      },
    }
  }, [deletedWords, timelineClips, clipProperties, cuts, layout, layoutClips, layoutPresets, titleSettings, canvasSettings, audioSettings, visualSettings, captionFont, captionSize, captionMaxWords, selectedCaptionStyle, timelineZoom, timelineHeight, timelineLayerHeightScale, backgroundMusic])
  
  // Explicit save function for edit data
  const saveEditData = useCallback(async () => {
    if (!projectManager.hasProject()) {
      console.warn('Cannot save edit data: no project loaded')
      return
    }
    
    try {
      const editData = getEditData()
      console.log('Saving edit data - timelineClips:', editData.timelineClips?.length || 0, 'layoutClips:', editData.layoutClips?.length || 0, 'canvasSettings:', editData.canvasSettings)
      await projectManager.saveEditData(editData as any)
      console.log('Edit data saved successfully')
      markAsSaved()
    } catch (error) {
      console.error('Error saving edit data:', error)
      throw error // Re-throw so caller knows it failed
    }
  }, [getEditData, markAsSaved])

  // Expose save function to parent component - update whenever saveEditData changes
  useEffect(() => {
    if (onSaveRequest) {
      onSaveRequest(saveEditData)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveEditData]) // Only depend on saveEditData, not onSaveRequest (it's stable)

  // Update holders in the current layout clip
  const updateHoldersInLayoutClip = useCallback((updatedHolders: CanvasVideoHolder[], skipSave = false) => {
    const currentLayoutClip = getCurrentLayoutClip(currentTime)
    
    // Filter out microphone layer as it's not visual
    const visualHolders = updatedHolders.filter(h => h.layer !== 'microphone')
    
    if (currentLayoutClip) {
      // Update existing layout clip with new holders
      setLayoutClips(prev => prev.map(lc => 
        lc.id === currentLayoutClip.id 
          ? { ...lc, holders: JSON.parse(JSON.stringify(visualHolders)) }
          : lc
      ))
      if (!skipSave) {
        markAsEdited()
        // Explicitly save edit data after updating layout clip holders
        setTimeout(() => {
          saveEditData()
        }, 0)
      }
    } else {
      // Create new layout clip for current time range
      const nextClip = layoutClips.find(lc => lc.timelineStart > currentTime)
      const endTime = nextClip ? nextClip.timelineStart : totalDuration
      
      const newLayoutClip: LayoutClip = {
        id: `layout_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        timelineStart: currentTime,
        timelineEnd: endTime,
        holders: JSON.parse(JSON.stringify(visualHolders)),
        title: {
          enabled: true,
          text: '',
          x: 0.5,
          y: 0.1,
        },
        backgroundImage: {
          enabled: true,
          url: '',
        },
      }
      
      setLayoutClips(prev => {
        const updated = [...prev, newLayoutClip].sort((a, b) => a.timelineStart - b.timelineStart)
        // Adjust end times to prevent gaps
        return updated.map((lc, idx) => {
          if (idx < updated.length - 1) {
            return { ...lc, timelineEnd: updated[idx + 1].timelineStart }
          }
          return { ...lc, timelineEnd: totalDuration }
        })
      })
      if (!skipSave) {
        markAsEdited()
        // Explicitly save edit data after creating layout clip
        setTimeout(() => {
          saveEditData()
        }, 0)
      }
    }
  }, [currentTime, getCurrentLayoutClip, layoutClips, totalDuration, markAsEdited, saveEditData])

  // Unsplash search function
  const searchUnsplash = useCallback(async (query: string) => {
    if (!query.trim()) {
      setUnsplashResults([])
      return
    }

    setUnsplashLoading(true)
    try {
      // Try to use Unsplash API with access key from localStorage
      const accessKey = localStorage.getItem('unsplash_access_key')
      
      if (accessKey) {
        // Use official Unsplash API
        const response = await fetch(
          `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=20&client_id=${accessKey}`
        )
        
        if (response.ok) {
          const data = await response.json()
          if (data.results) {
            setUnsplashResults(data.results)
            setUnsplashLoading(false)
            return
          }
        }
      }
      
      // Fallback: Use Unsplash Source API (no auth required, but limited)
      // Generate multiple variations of the search query for better results
      const variations = [
        query,
        `${query},nature`,
        `${query},landscape`,
        `${query},abstract`,
        `${query},background`,
        `${query},texture`,
        `${query},minimal`,
        `${query},gradient`,
        `${query},pattern`,
        `${query},colorful`,
        `${query},dark`,
        `${query},light`,
        `${query},modern`,
        `${query},vintage`,
        `${query},professional`,
        `${query},aesthetic`
      ]
      
      const curatedImages = variations.slice(0, 16).map((variation, index) => ({
        id: `unsplash-${index}-${Date.now()}`,
        urls: {
          regular: `https://source.unsplash.com/1600x900/?${encodeURIComponent(variation)}`,
          small: `https://source.unsplash.com/800x600/?${encodeURIComponent(variation)}`,
          thumb: `https://source.unsplash.com/400x300/?${encodeURIComponent(variation)}`
        },
        description: variation,
        user: { name: 'Unsplash', username: 'unsplash' }
      }))
      
      setUnsplashResults(curatedImages)
    } catch (error) {
      console.error('Error searching Unsplash:', error)
      // Fallback to basic images
      const fallbackImages = [
        {
          id: 'fallback-1',
          urls: {
            regular: `https://source.unsplash.com/1600x900/?${encodeURIComponent(query)}`,
            small: `https://source.unsplash.com/800x600/?${encodeURIComponent(query)}`,
            thumb: `https://source.unsplash.com/400x300/?${encodeURIComponent(query)}`
          },
          description: query,
          user: { name: 'Unsplash', username: 'unsplash' }
        }
      ]
      setUnsplashResults(fallbackImages)
    } finally {
      setUnsplashLoading(false)
    }
  }, [])

  // Dragging state for moving holders
  const [draggingHolderId, setDraggingHolderId] = useState<string | null>(null)
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number } | null>(null)
  const [dragStartHolder, setDragStartHolder] = useState<CanvasVideoHolder | null>(null)
  
  // Resizing state for resizing holders
  const [resizingHolderId, setResizingHolderId] = useState<string | null>(null)
  const [resizeCorner, setResizeCorner] = useState<'nw' | 'ne' | 'sw' | 'se' | null>(null)
  const [resizeStartPos, setResizeStartPos] = useState<{ x: number; y: number } | null>(null)
  const [resizeStartHolder, setResizeStartHolder] = useState<CanvasVideoHolder | null>(null)
  
  // Title dragging state
  const [draggingTitle, setDraggingTitle] = useState<boolean>(false)
  const [titleDragStartPos, setTitleDragStartPos] = useState<{ x: number; y: number } | null>(null)
  const [titleDragStartLayoutClip, setTitleDragStartLayoutClip] = useState<LayoutClip | null>(null)
  
  // Timeline clip dragging state (different from canvas holder dragging)
  const [draggingClipId, setDraggingClipId] = useState<string | null>(null)
  const [draggingOffset, setDraggingOffset] = useState<number>(0)
  const [trimmingClipId, setTrimmingClipId] = useState<string | null>(null)
  const [trimmingEdge, setTrimmingEdge] = useState<'in' | 'out' | null>(null)
  const [trimmingStartPos, setTrimmingStartPos] = useState<number>(0)
  
  // Layout clip dragging/trimming state
  const [draggingLayoutClipId, setDraggingLayoutClipId] = useState<string | null>(null)
  const [trimmingLayoutClipId, setTrimmingLayoutClipId] = useState<string | null>(null)
  const [trimmingLayoutEdge, setTrimmingLayoutEdge] = useState<'in' | 'out' | null>(null)

  // Undo/Redo History
  interface EditStateSnapshot {
    timelineClips: TimelineClip[]
    clipProperties: Map<string, ClipProperties>
    deletedWords: Map<string, Set<number>>
    cuts: Map<string, VideoCut[]>
    layout: Layout
    layoutClips: LayoutClip[]
    layoutPresets: LayoutPreset[]
    audioSettings: typeof audioSettings
    visualSettings: typeof visualSettings
    canvasSettings: typeof canvasSettings
    selectedCaptionStyle: CaptionStyleId
    captionFont: string
    captionSize: number
    captionMaxWords: number
    backgroundMusic: typeof backgroundMusic
  }

  const [history, setHistory] = useState<EditStateSnapshot[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const maxHistorySize = 50

  // Helper to create a deep copy of state for history
  const createSnapshot = useCallback((): EditStateSnapshot => {
    return {
      timelineClips: JSON.parse(JSON.stringify(timelineClips)),
      clipProperties: new Map(Array.from(clipProperties.entries()).map(([k, v]) => [k, { ...v }])),
      deletedWords: new Map(Array.from(deletedWords.entries()).map(([k, v]) => [k, new Set(v)])),
      cuts: new Map(Array.from(cuts.entries()).map(([k, v]) => [k, [...v]])),
      layout: JSON.parse(JSON.stringify(layout)),
      layoutClips: JSON.parse(JSON.stringify(layoutClips)),
      layoutPresets: JSON.parse(JSON.stringify(layoutPresets)),
      audioSettings: { ...audioSettings },
      visualSettings: {
        ...visualSettings,
        colorGrading: { ...visualSettings.colorGrading },
      },
      canvasSettings: {
        ...canvasSettings,
        resolution: { ...canvasSettings.resolution },
      },
      selectedCaptionStyle,
      captionFont,
      captionSize,
      captionMaxWords,
      backgroundMusic: {
        file: backgroundMusic.file,
        url: backgroundMusic.url,
        volume: backgroundMusic.volume
      },
    }
  }, [timelineClips, clipProperties, deletedWords, cuts, layout, layoutClips, layoutPresets, audioSettings, visualSettings, canvasSettings, selectedCaptionStyle, captionFont, captionSize, captionMaxWords, backgroundMusic])

  // Save current state to history
  const saveToHistory = useCallback(() => {
    markAsEdited() // Mark as edited whenever history is saved
    const snapshot = createSnapshot()
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1)
      newHistory.push(snapshot)
      // Limit history size
      if (newHistory.length > maxHistorySize) {
        newHistory.shift()
        return newHistory
      }
      return newHistory
    })
    setHistoryIndex(prev => Math.min(prev + 1, maxHistorySize - 1))
  }, [createSnapshot, historyIndex, markAsEdited])

  // Handle Unsplash image selection
  const handleSelectUnsplashImage = useCallback((imageUrl: string) => {
    const currentLayoutClip = getCurrentLayoutClip(currentTime)
    if (currentLayoutClip) {
      setLayoutClips(prev => prev.map(lc => 
        lc.id === currentLayoutClip.id 
          ? { 
              ...lc, 
              backgroundImage: { 
                enabled: true, 
                url: imageUrl 
              } 
            }
          : lc
      ))
      // Explicitly save edit data after updating background image
      setTimeout(() => {
        saveEditData()
      }, 0)
      markAsEdited()
      saveToHistory()
      // Explicitly save edit data after updating background image
      setTimeout(() => {
        saveEditData()
      }, 0)
      setUnsplashModalOpen(false)
      setUnsplashSearchQuery('')
      setUnsplashResults([])
    }
  }, [currentTime, getCurrentLayoutClip, markAsEdited, saveToHistory])
  
  // Auto-save edit data to project folder when changes occur
  useEffect(() => {
    if (!projectManager.hasProject()) return
    
    // Save immediately after each edit (minimal debounce to batch rapid changes)
    const timeoutId = setTimeout(async () => {
      try {
        const editData = getEditData()
        await projectManager.saveEditData(editData as any)
        markAsSaved()
      } catch (error) {
        console.error('Error auto-saving edit data:', error)
      }
    }, 100) // Auto-save after 100ms to batch rapid changes but save quickly
    
    return () => clearTimeout(timeoutId)
  }, [
    timelineClips,
    clipProperties,
    deletedWords,
    cuts,
    layoutClips,
    layoutPresets,
    titleSettings,
    canvasSettings,
    audioSettings,
    visualSettings,
    captionFont,
    captionSize,
    captionMaxWords,
    selectedCaptionStyle,
    timelineZoom,
    timelineHeight,
    timelineLayerHeightScale,
    backgroundMusic,
    getEditData,
    markAsSaved,
  ])

  // Restore state from snapshot
  const restoreFromSnapshot = useCallback((snapshot: EditStateSnapshot) => {
    setTimelineClips(snapshot.timelineClips)
    setClipProperties(snapshot.clipProperties)
    setDeletedWords(snapshot.deletedWords)
    setCuts(snapshot.cuts)
    setLayout(snapshot.layout)
    if (snapshot.layoutClips) {
      setLayoutClips(snapshot.layoutClips)
    }
    if (snapshot.layoutPresets) {
      setLayoutPresets(snapshot.layoutPresets)
    }
    setAudioSettings(snapshot.audioSettings)
    setVisualSettings(snapshot.visualSettings)
    setCanvasSettings(snapshot.canvasSettings)
    setSelectedCaptionStyle(snapshot.selectedCaptionStyle)
    setCaptionFont(snapshot.captionFont)
    setCaptionSize(snapshot.captionSize)
    setCaptionMaxWords(snapshot.captionMaxWords)
    setBackgroundMusic(snapshot.backgroundMusic)
  }, [])

  // Undo function
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1
      setHistoryIndex(newIndex)
      restoreFromSnapshot(history[newIndex])
    }
  }, [historyIndex, history, restoreFromSnapshot])

  // Redo function
  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1
      setHistoryIndex(newIndex)
      restoreFromSnapshot(history[newIndex])
    }
  }, [historyIndex, history, restoreFromSnapshot])

  // Check if undo/redo is available
  const canUndo = historyIndex > 0
  const canRedo = historyIndex < history.length - 1

  // Initialize history with current state
  useEffect(() => {
    if (history.length === 0 && timelineClips.length > 0) {
      const initialSnapshot = createSnapshot()
      setHistory([initialSnapshot])
      setHistoryIndex(0)
    }
  }, [timelineClips.length]) // Initialize when clips are loaded

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Z or Cmd+Z for undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        if (canUndo) {
          handleUndo()
        }
      }
      // Ctrl+Shift+Z or Cmd+Shift+Z or Ctrl+Y for redo
      if (((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') || ((e.ctrlKey || e.metaKey) && e.key === 'y')) {
        e.preventDefault()
        if (canRedo) {
          handleRedo()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [canUndo, canRedo, handleUndo, handleRedo])

  // Build scene takes from all scenes with selected takes
  useEffect(() => {
    const takes: SceneTake[] = []
    let currentStartTime = 0

    scenes.forEach((scene, index) => {
      const selectedTake = scene.recordings.find(r => r.selected)
      // Check if duration is valid (finite and > 0)
      const validDuration = selectedTake?.duration && Number.isFinite(selectedTake.duration) && selectedTake.duration > 0
      if (selectedTake && validDuration) {
        const safeDuration = selectedTake.duration
        takes.push({
          sceneId: scene.id,
          sceneIndex: index,
          take: selectedTake,
          startTime: currentStartTime,
          endTime: currentStartTime + safeDuration,
          trimmedStart: 0,
          trimmedEnd: 0,
        })
        currentStartTime += safeDuration
      }
    })

    setSceneTakes(takes)
    // Ensure totalDuration is always finite
    const safeDuration = Number.isFinite(currentStartTime) && currentStartTime > 0 ? currentStartTime : 1
    setTotalDuration(safeDuration)

    // Select first scene if available, or adjust index if current selection is invalid
    if (takes.length > 0) {
      if (selectedSceneIndex >= takes.length || selectedSceneIndex < 0) {
        setSelectedSceneIndex(0)
      }
    } else {
      setSelectedSceneIndex(0)
    }

    // Analyze waveforms for all microphone recordings
    takes.forEach((sceneTake) => {
      if (sceneTake.take.hasMicrophone) {
        const waveformKey = `${sceneTake.sceneId}_${sceneTake.take.id}`
        if (!waveforms.has(waveformKey)) {
          // Load and analyze waveform asynchronously
          projectManager.loadRecording(sceneTake.sceneId, `${sceneTake.take.id}_microphone`)
            .then(micBlob => {
              if (micBlob) {
                return analyzeWaveform(micBlob, 200)
              }
              return null
            })
            .then(waveformData => {
              if (waveformData) {
                setWaveforms(prev => new Map(prev.set(waveformKey, waveformData)))
              }
            })
            .catch(error => {
              console.error('Error loading/analyzing waveform:', error)
            })
        }
      }
    })
  }, [scenes])

  // Build timeline clips from scene takes - proper clip-based system
  useEffect(() => {
    const clips: TimelineClip[] = []
    let currentTimelinePos = 0

    sceneTakes.forEach((sceneTake) => {
      // Ensure duration is valid
      const rawDuration = sceneTake.take.duration
      const sourceDuration = Number.isFinite(rawDuration) && rawDuration > 0 ? rawDuration : 0

      if (sourceDuration <= 0) {
        console.warn(`Invalid duration for scene ${sceneTake.sceneId}, take ${sceneTake.take.id}: ${rawDuration}`)
        return // Skip this scene take if duration is invalid
      }

      // Create separate clips for each layer
      // timelineEnd must always equal timelineStart + (sourceOut - sourceIn) for accuracy
      const sourceIn = 0
      const sourceOut = sourceDuration // Initially, clip uses full source
      const trimmedDuration = sourceOut - sourceIn // Actual clip duration on timeline
      
      if (sceneTake.take.hasCamera) {
        clips.push({
          id: `${sceneTake.sceneId}_${sceneTake.take.id}_camera`,
          sceneId: sceneTake.sceneId,
          takeId: sceneTake.take.id,
          layer: 'camera',
          timelineStart: currentTimelinePos,
          timelineEnd: currentTimelinePos + trimmedDuration, // Must match trimmed duration exactly
          sourceIn: sourceIn,
          sourceOut: sourceOut,
          sourceDuration: sourceDuration // Store full source duration for reference
        })
      }

      if (sceneTake.take.hasMicrophone) {
        clips.push({
          id: `${sceneTake.sceneId}_${sceneTake.take.id}_microphone`,
          sceneId: sceneTake.sceneId,
          takeId: sceneTake.take.id,
          layer: 'microphone',
          timelineStart: currentTimelinePos,
          timelineEnd: currentTimelinePos + trimmedDuration,
          sourceIn: sourceIn,
          sourceOut: sourceOut,
          sourceDuration: sourceDuration
        })
      }

      if (sceneTake.take.hasScreen) {
        clips.push({
          id: `${sceneTake.sceneId}_${sceneTake.take.id}_screen`,
          sceneId: sceneTake.sceneId,
          takeId: sceneTake.take.id,
          layer: 'screen',
          timelineStart: currentTimelinePos,
          timelineEnd: currentTimelinePos + trimmedDuration,
          sourceIn: sourceIn,
          sourceOut: sourceOut,
          sourceDuration: sourceDuration
        })
      }

      // Move timeline position forward for next scene based on trimmed duration
      currentTimelinePos += trimmedDuration
    })

    setTimelineClips(clips)

    // Reset currentTime to 0 when clips are first created or rebuilt
    if (clips.length > 0 && currentTime !== 0 && !isPlaying) {
      setCurrentTime(0)
      timelineTimeRef.current = 0
    }

    // Initialize canvas holders in layout clips from timeline clips
    // This ensures all layout clips have holders for their active clips
    if (clips.length > 0) {
      setLayoutClips(prev => prev.map(layoutClip => {
        const holders: CanvasVideoHolder[] = []
        const existingHoldersMap = new Map(layoutClip.holders.map(h => [h.clipId, h]))
        
        // Get clips active during this layout clip's time range
        const activeClips = clips.filter(clip => 
          clip.timelineStart < layoutClip.timelineEnd && 
          clip.timelineEnd > layoutClip.timelineStart &&
          (clip.layer === 'camera' || clip.layer === 'screen')
        )
        
        activeClips.forEach(clip => {
          const existingHolder = existingHoldersMap.get(clip.id)
          if (existingHolder) {
            holders.push(existingHolder)
          } else {
            // Create new holder with default position
            const defaultX = clip.layer === 'camera' ? 0 : 0.5
            const defaultY = clip.layer === 'camera' ? 0 : 0.5
            const defaultWidth = clip.layer === 'camera' ? 1 : 0.5
            const defaultHeight = clip.layer === 'camera' ? 1 : 0.5
            
            holders.push({
              id: `holder_${clip.id}`,
              clipId: clip.id,
              layer: clip.layer,
              x: defaultX,
              y: defaultY,
              width: defaultWidth,
              height: defaultHeight,
              rotation: 0,
              zIndex: clip.layer === 'camera' ? 1 : 2,
            })
          }
        })
        
        // Remove holders for clips that no longer exist
        const validClipIds = new Set(clips.map(c => c.id))
        const filteredHolders = holders.filter(h => validClipIds.has(h.clipId))
        
        return { ...layoutClip, holders: filteredHolders }
      }))
    }

    // Update total duration - ensure it's always finite
    const maxEnd = clips.length > 0 ? Math.max(...clips.map(c => c.timelineEnd)) : 0
    const safeMaxEnd = Number.isFinite(maxEnd) && maxEnd > 0 ? maxEnd : 1
    setTotalDuration(safeMaxEnd)
  }, [sceneTakes])

  // Sync canvas holders in layout clips when timeline clips change (e.g., after cuts/splits)
  useEffect(() => {
    if (timelineClips.length === 0) return
    
    setLayoutClips(prev => prev.map(layoutClip => {
      const holders: CanvasVideoHolder[] = []
      const existingHoldersMap = new Map(layoutClip.holders.map(h => [h.clipId, h]))
      
      // Build a map of original clip IDs to holders (for finding parents of split clips)
      const originalHoldersMap = new Map<string, CanvasVideoHolder>()
      layoutClip.holders.forEach(holder => {
        const baseId = holder.clipId.split('_before_')[0].split('_after_')[0].split('_part1_')[0].split('_part2_')[0]
        if (!originalHoldersMap.has(baseId)) {
          originalHoldersMap.set(baseId, holder)
        }
      })
      
      // Get clips active during this layout clip's time range
      const activeClips = timelineClips.filter(clip => 
        clip.timelineStart < layoutClip.timelineEnd && 
        clip.timelineEnd > layoutClip.timelineStart &&
        (clip.layer === 'camera' || clip.layer === 'screen')
      )
      
      activeClips.forEach(clip => {
        const existingHolder = existingHoldersMap.get(clip.id)
        if (existingHolder) {
          holders.push(existingHolder)
        } else {
          // Try to find original holder by matching scene/take/layer
          let sourceHolder: CanvasVideoHolder | undefined = undefined
          
          const baseId = clip.id.split('_before_')[0].split('_after_')[0].split('_part1_')[0].split('_part2_')[0]
          const baseHolder = originalHoldersMap.get(baseId)
          if (baseHolder && baseHolder.layer === clip.layer) {
            sourceHolder = baseHolder
          } else {
            const matchingHolder = layoutClip.holders.find(h => {
              const hClip = timelineClips.find(c => c.id === h.clipId)
              return hClip && hClip.sceneId === clip.sceneId && hClip.takeId === clip.takeId && h.layer === clip.layer
            })
            if (matchingHolder) {
              sourceHolder = matchingHolder
            }
          }
          
          const defaultX = clip.layer === 'camera' ? 0 : 0.5
          const defaultY = clip.layer === 'camera' ? 0 : 0.5
          const defaultWidth = clip.layer === 'camera' ? 1 : 0.5
          const defaultHeight = clip.layer === 'camera' ? 1 : 0.5
          
          holders.push({
            id: `holder_${clip.id}`,
            clipId: clip.id,
            layer: clip.layer,
            x: sourceHolder?.x ?? defaultX,
            y: sourceHolder?.y ?? defaultY,
            width: sourceHolder?.width ?? defaultWidth,
            height: sourceHolder?.height ?? defaultHeight,
            rotation: sourceHolder?.rotation ?? 0,
            zIndex: sourceHolder?.zIndex ?? (clip.layer === 'camera' ? 1 : 2),
          })
        }
      })
      
      const validClipIds = new Set(timelineClips.map(c => c.id))
      return { ...layoutClip, holders: holders.filter(h => validClipIds.has(h.clipId)) }
    }))
  }, [timelineClips])

  // Ensure selectedSceneIndex is always valid
  useEffect(() => {
    if (sceneTakes.length > 0) {
      if (selectedSceneIndex >= sceneTakes.length || selectedSceneIndex < 0) {
        setSelectedSceneIndex(0)
      }
    } else {
      setSelectedSceneIndex(0)
    }
  }, [sceneTakes, selectedSceneIndex])

  // Handle keyboard events for word selection (Delete key) and C key tracking
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'c' || e.key === 'C') {
        isCPressedRef.current = true
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        // Delete selected words
        const selectedWords = selectedWordIndices
        if (selectedWords.size > 0) {
          setDeletedWords(prev => {
            const updated = new Map(prev)
            selectedWords.forEach((indices, sceneId) => {
              const sceneDeleted = updated.get(sceneId) || new Set<number>()
              const newDeleted = new Set(sceneDeleted)
              indices.forEach(index => newDeleted.add(index))
              updated.set(sceneId, newDeleted)
            })
            return updated
          })
          // Clear selection after deletion
          setSelectedWordIndices(new Map())
        }
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'c' || e.key === 'C') {
        isCPressedRef.current = false
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [selectedWordIndices])

  // Handle transcript panel resize
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return
      const newWidth = window.innerWidth - e.clientX
      setTranscriptWidth(Math.max(200, Math.min(800, newWidth)))
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isResizing])

  // Recalculate canvas zoom only when canvas dimensions change (not timeline height)
  const recalculateCanvasZoom = useCallback(() => {
    // Calculate available canvas area
    // Available height = window height - timeline height - other UI elements (header, controls, etc.)
    // Estimate: header ~64px, top controls ~56px, padding ~32px total
    const estimatedUIHeight = 152
    const availableHeight = window.innerHeight - timelineHeight - estimatedUIHeight
    const availableWidth = window.innerWidth - 320 // Sidebar width (256px) + some margin
    
    // Calculate zoom to fit canvas in available space
    // Canvas dimensions are in pixels, but we need to fit it in the available viewport
    // We'll calculate based on the aspect ratio and available space
    // Account for padding in the canvas container
    const containerWidth = availableWidth - 32 // Padding
    const containerHeight = availableHeight - 32 // Padding
    
    // Calculate what size the canvas would naturally be at 100% zoom
    // Canvas will size to fit container width while maintaining aspect ratio
    const naturalCanvasWidth = containerWidth
    const naturalCanvasHeight = naturalCanvasWidth / canvasDimensions.aspectRatio
    
    // If natural height exceeds container, base calculation on height instead
    const finalCanvasWidth = naturalCanvasHeight > containerHeight 
      ? containerHeight * canvasDimensions.aspectRatio 
      : naturalCanvasWidth
    const finalCanvasHeight = finalCanvasWidth / canvasDimensions.aspectRatio
    
    // Calculate zoom: compare desired display size to resolution size
    const widthBasedZoom = finalCanvasWidth / canvasDimensions.width
    const heightBasedZoom = finalCanvasHeight / canvasDimensions.height
    
    // Use the smaller zoom to ensure it fits in both dimensions
    const newZoom = Math.min(widthBasedZoom, heightBasedZoom, 2) // Cap at 200%
    setCanvasZoom(Math.max(0.1, newZoom)) // Min zoom 10%
  }, [canvasDimensions]) // Removed timelineHeight from dependencies

  // Recalculate zoom only when canvas dimensions change (not timeline height)
  useEffect(() => {
    recalculateCanvasZoom()
  }, [recalculateCanvasZoom])

  // Also recalculate zoom on window resize (but not timeline height changes)
  useEffect(() => {
    const handleResize = () => {
      recalculateCanvasZoom()
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [recalculateCanvasZoom])

  // Handle timeline resize - don't affect canvas at all, but limit to 50% of screen height
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingTimeline) return
      const newHeight = window.innerHeight - e.clientY
      const maxHeight = window.innerHeight * 0.5 // 50% of viewport height
      const clampedHeight = Math.max(100, Math.min(maxHeight, newHeight))
      setTimelineHeight(clampedHeight)
      // Canvas zoom remains unchanged - user controls it manually
    }

    const handleMouseUp = () => {
      setIsResizingTimeline(false)
    }

    if (isResizingTimeline) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isResizingTimeline])

  // Handle canvas panning
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isPanning || !panStartPosRef.current || !panStartOffsetRef.current) return
      
      const deltaX = e.clientX - panStartPosRef.current.x
      const deltaY = e.clientY - panStartPosRef.current.y
      
      setCanvasPan({
        x: panStartOffsetRef.current.x + deltaX,
        y: panStartOffsetRef.current.y + deltaY,
      })
    }

    const handleMouseUp = () => {
      setIsPanning(false)
      panStartPosRef.current = null
      panStartOffsetRef.current = null
    }

    if (isPanning) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isPanning])

  // Handle canvas holder dragging (moving)
  useEffect(() => {
    if (!draggingHolderId || !dragStartPos || !dragStartHolder) return

    const handleMouseMove = (e: MouseEvent) => {
      const canvasContainer = document.querySelector('[data-canvas-container]') as HTMLElement
      if (!canvasContainer) return

      const rect = canvasContainer.getBoundingClientRect()
      const deltaX = (e.clientX - dragStartPos.x) / rect.width
      const deltaY = (e.clientY - dragStartPos.y) / rect.height

      // Update holders in layout clip directly
      const currentLayoutClip = getCurrentLayoutClip(currentTime)
      if (!currentLayoutClip) return

      const updatedHolders = currentLayoutClip.holders.map(holder => {
        if (holder.id !== draggingHolderId) return holder

        let newX = dragStartHolder.x + deltaX
        let newY = dragStartHolder.y + deltaY

        // Constrain to canvas bounds
        newX = Math.max(0, Math.min(1 - holder.width, newX))
        newY = Math.max(0, Math.min(1 - holder.height, newY))

        return {
          ...holder,
          x: newX,
          y: newY,
        }
      })

      updateHoldersInLayoutClip(updatedHolders, true) // Skip save during drag
    }

    const handleMouseUp = () => {
      setDraggingHolderId(null)
      setDragStartPos(null)
      setDragStartHolder(null)
      saveToHistory()
      markAsEdited()
      // Save edit data after drag completes
      setTimeout(() => {
        saveEditData()
      }, 0)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [draggingHolderId, dragStartPos, dragStartHolder, currentTime, getCurrentLayoutClip, updateHoldersInLayoutClip, saveToHistory, markAsEdited, saveEditData])

  // Handle canvas holder resizing (corner handles)
  useEffect(() => {
    if (!resizingHolderId || !resizeCorner || !resizeStartPos || !resizeStartHolder) return

    const handleMouseMove = (e: MouseEvent) => {
      const canvasContainer = document.querySelector('[data-canvas-container]') as HTMLElement
      if (!canvasContainer) return

      const rect = canvasContainer.getBoundingClientRect()
      const deltaX = (e.clientX - resizeStartPos.x) / rect.width
      const deltaY = (e.clientY - resizeStartPos.y) / rect.height

      // Update holders in layout clip directly
      const currentLayoutClip = getCurrentLayoutClip(currentTime)
      if (!currentLayoutClip) return

      const updatedHolders = currentLayoutClip.holders.map(holder => {
        if (holder.id !== resizingHolderId) return holder

        let newX = resizeStartHolder.x
        let newY = resizeStartHolder.y
        let newWidth = resizeStartHolder.width
        let newHeight = resizeStartHolder.height

        // Resize based on corner
        if (resizeCorner === 'nw') {
          // Top-left: adjust x, y, width, height
          newX = Math.max(0, Math.min(1, resizeStartHolder.x + deltaX))
          newY = Math.max(0, Math.min(1, resizeStartHolder.y + deltaY))
          newWidth = Math.max(0.05, Math.min(1, resizeStartHolder.width - deltaX))
          newHeight = Math.max(0.05, Math.min(1, resizeStartHolder.height - deltaY))
        } else if (resizeCorner === 'ne') {
          // Top-right: adjust y, width, height
          newY = Math.max(0, Math.min(1, resizeStartHolder.y + deltaY))
          newWidth = Math.max(0.05, Math.min(1 - resizeStartHolder.x, resizeStartHolder.width + deltaX))
          newHeight = Math.max(0.05, Math.min(1, resizeStartHolder.height - deltaY))
        } else if (resizeCorner === 'sw') {
          // Bottom-left: adjust x, width, height
          newX = Math.max(0, Math.min(1, resizeStartHolder.x + deltaX))
          newWidth = Math.max(0.05, Math.min(1, resizeStartHolder.width - deltaX))
          newHeight = Math.max(0.05, Math.min(1 - resizeStartHolder.y, resizeStartHolder.height + deltaY))
        } else if (resizeCorner === 'se') {
          // Bottom-right: adjust width, height
          newWidth = Math.max(0.05, Math.min(1 - resizeStartHolder.x, resizeStartHolder.width + deltaX))
          newHeight = Math.max(0.05, Math.min(1 - resizeStartHolder.y, resizeStartHolder.height + deltaY))
        }

        // Ensure holder stays within canvas bounds
        if (newX + newWidth > 1) {
          newWidth = 1 - newX
        }
        if (newY + newHeight > 1) {
          newHeight = 1 - newY
        }

        return {
          ...holder,
          x: newX,
          y: newY,
          width: newWidth,
          height: newHeight,
        }
      })

      updateHoldersInLayoutClip(updatedHolders, true) // Skip save during resize
    }

    const handleMouseUp = () => {
      setResizingHolderId(null)
      setResizeCorner(null)
      setResizeStartPos(null)
      setResizeStartHolder(null)
      saveToHistory()
      markAsEdited()
      // Save edit data after resize completes
      setTimeout(() => {
        saveEditData()
      }, 0)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [resizingHolderId, resizeCorner, resizeStartPos, resizeStartHolder, currentTime, getCurrentLayoutClip, updateHoldersInLayoutClip, saveToHistory, markAsEdited, saveEditData])

  // Handle title dragging (repositioning)
  useEffect(() => {
    if (!draggingTitle || !titleDragStartPos || !titleDragStartLayoutClip) return

    const handleMouseMove = (e: MouseEvent) => {
      const canvasContainer = document.querySelector('[data-canvas-container]') as HTMLElement
      if (!canvasContainer) return

      const rect = canvasContainer.getBoundingClientRect()
      const deltaX = (e.clientX - titleDragStartPos.x) / rect.width
      const deltaY = (e.clientY - titleDragStartPos.y) / rect.height

      const currentLayoutClip = getCurrentLayoutClip(currentTime)
      if (!currentLayoutClip || currentLayoutClip.id !== titleDragStartLayoutClip.id) return

      const startTitle = titleDragStartLayoutClip.title
      if (!startTitle) return

      let newX = startTitle.x + deltaX
      let newY = startTitle.y + deltaY

      // Constrain to canvas bounds (0-1)
      newX = Math.max(0, Math.min(1, newX))
      newY = Math.max(0, Math.min(1, newY))

      setLayoutClips(prev => prev.map(lc => {
        if (lc.id !== currentLayoutClip.id) return lc
        return {
          ...lc,
          title: {
            ...lc.title!,
            x: newX,
            y: newY,
          }
        }
      }))
    }

    const handleMouseUp = () => {
      setDraggingTitle(false)
      setTitleDragStartPos(null)
      setTitleDragStartLayoutClip(null)
      saveToHistory()
      // Explicitly save edit data after title position change
      setTimeout(() => {
        saveEditData()
      }, 0)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [draggingTitle, titleDragStartPos, titleDragStartLayoutClip, currentTime, getCurrentLayoutClip, saveToHistory, saveEditData])

  // Load selected take's recordings
  useEffect(() => {
    const loadTakeRecordings = async () => {
      if (!selectedTake || !projectManager.hasProject()) {
        setCameraBlob(null)
        setMicrophoneBlob(null)
        setScreenBlob(null)
        return
      }

      try {
        const scene = scenes.find(s => s.id === selectedSceneId)
        if (!scene) return

        // Try to load camera layer (check both hasCamera flag and file existence)
        if (selectedTake.hasCamera !== false) {
          try {
            const cameraBlob = await projectManager.loadRecording(
              selectedSceneId,
              `${selectedTake.id}_camera`
            )
            setCameraBlob(cameraBlob)
          } catch (error) {
            console.log('Camera recording not found, trying legacy format')
            // Try legacy format
            try {
              const legacyBlob = await projectManager.loadRecording(
                selectedSceneId,
                selectedTake.id
              )
              setCameraBlob(legacyBlob)
            } catch {
              setCameraBlob(null)
            }
          }
        } else {
          setCameraBlob(null)
        }

        // Try to load microphone layer
        if (selectedTake.hasMicrophone !== false) {
          try {
            const micBlob = await projectManager.loadRecording(
              selectedSceneId,
              `${selectedTake.id}_microphone`
            )
            setMicrophoneBlob(micBlob)

            // Analyze waveform for timeline visualization
            const waveformKey = `${selectedSceneId}_${selectedTake.id}`
            if (!waveforms.has(waveformKey) && micBlob) {
              try {
                const waveformData = await analyzeWaveform(micBlob, 200)
                setWaveforms(prev => new Map(prev.set(waveformKey, waveformData)))
              } catch (error) {
                console.error('Error analyzing waveform:', error)
              }
            }
          } catch (error) {
            setMicrophoneBlob(null)
          }
        } else {
          setMicrophoneBlob(null)
        }

        // Try to load screen layer
        if (selectedTake.hasScreen !== false) {
          try {
            const screenBlob = await projectManager.loadRecording(
              selectedSceneId,
              `${selectedTake.id}_screen`
            )
            setScreenBlob(screenBlob)
          } catch (error) {
            setScreenBlob(null)
          }
        } else {
          setScreenBlob(null)
        }
      } catch (error) {
        console.error('Error loading recordings:', error)
      }
    }

    loadTakeRecordings()
  }, [selectedTake, selectedSceneId, scenes])

  // Convert timeline time to actual video time using clip-based system
  const timelineToVideoTime = useCallback((absoluteTime: number): { clip: TimelineClip | null; videoTime: number; sceneId: string; takeId: string } | null => {
    const clampedTime = Math.max(0, Math.min(totalDuration, absoluteTime))

    // Find which clip this time belongs to (prioritize camera, then microphone, then screen)
    // Use < for end boundary (exclusive) - at exactly timelineEnd, we're past the clip
    const cameraClip = timelineClips.find(c =>
      c.layer === 'camera' &&
      clampedTime >= c.timelineStart &&
      clampedTime < c.timelineEnd // Exclusive end
    )

    const clip = cameraClip || timelineClips.find(c =>
      clampedTime >= c.timelineStart &&
      clampedTime < c.timelineEnd // Exclusive end
    )

    if (!clip) return null

    // Calculate relative time within the timeline clip
    const relativeTimelineTime = clampedTime - clip.timelineStart
    const clipDuration = clip.timelineEnd - clip.timelineStart
    
    // Handle edge case where clip duration is 0 or very small
    if (clipDuration <= 0.001) {
      return {
        clip,
        videoTime: clip.sourceIn,
        sceneId: clip.sceneId,
        takeId: clip.takeId
      }
    }
    
    const sourceDuration = clip.sourceOut - clip.sourceIn

    // Map timeline position to source video time
    // Clamp to ensure we never exceed sourceOut
    const sourceTime = clip.sourceIn + Math.min(1, relativeTimelineTime / clipDuration) * sourceDuration

    return {
      clip,
      videoTime: Math.max(clip.sourceIn, Math.min(clip.sourceOut, sourceTime)),
      sceneId: clip.sceneId,
      takeId: clip.takeId
    }
  }, [timelineClips, totalDuration])

  // Function to draw video frame to canvas with LUT
  const drawFrame = useCallback(() => {
    const canvas = lutCanvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d', { willReadFrequently: false })
    if (!ctx) return

    // If we have canvas holders, don't draw video to canvas - let holders handle rendering
    // Only use canvas for captions/LUT overlays if needed
    if (canvasHolders.length > 0) {
      // Set canvas to match canvas dimensions (respecting aspect ratio)
      const container = document.querySelector('[data-canvas-container]') as HTMLElement
      if (container) {
        const rect = container.getBoundingClientRect()
        // Calculate dimensions that maintain aspect ratio
        const containerAspectRatio = rect.width / rect.height
        const targetAspectRatio = canvasDimensions.aspectRatio
        
        let canvasWidth: number
        let canvasHeight: number
        
        if (containerAspectRatio > targetAspectRatio) {
          // Container is wider - fit to height
          canvasHeight = rect.height
          canvasWidth = canvasHeight * targetAspectRatio
        } else {
          // Container is taller - fit to width
          canvasWidth = rect.width
          canvasHeight = canvasWidth / targetAspectRatio
        }
        
        if (Math.abs(canvas.width - canvasWidth) > 1 || Math.abs(canvas.height - canvasHeight) > 1) {
          canvas.width = canvasWidth
          canvas.height = canvasHeight
        }
      } else {
        // Fallback to canvas settings resolution (maintains aspect ratio)
      if (canvas.width === 0 || canvas.height === 0) {
          canvas.width = canvasDimensions.width
          canvas.height = canvasDimensions.height
        }
      }
      
      // Clear canvas (transparent - video is rendered by holders)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      
      // Only draw captions if enabled (video rendering is handled by holders)
      const timelineResult = timelineToVideoTime(currentTime)
      if (selectedCaptionStyle !== 'none' && timelineResult && timelineResult.clip) {
        const sceneTranscript = transcripts.get(timelineResult.sceneId)
        if (sceneTranscript) {
          // Calculate the timeline time relative to the scene start
          const sceneTake = sceneTakes.find(st => st.sceneId === timelineResult.sceneId)
          if (sceneTake) {
            // Get words that should be visible at current time
            const sceneRelativeTime = currentTime - sceneTake.startTime
            const visibleWords = sceneTranscript.words.filter(w => {
              const wordStart = w.start - sceneTake.startTime
              const wordEnd = w.end - sceneTake.startTime
              return sceneRelativeTime >= wordStart && sceneRelativeTime <= wordEnd
            })

            if (visibleWords.length > 0) {
              const style = captionStyles.find(s => s.id === selectedCaptionStyle) || captionStyles[0]
              const wordsToShow = visibleWords.slice(0, captionMaxWords)
              const text = wordsToShow.map(w => w.word).join(' ')
              const fontSize = Math.max(12, Math.min(200, (canvas.height / 1080) * captionSize))
              const fontFamily = captionFont
              
              ctx.save()
              ctx.font = `${style.fontWeight} ${fontSize}px ${fontFamily}`
              ctx.textAlign = 'center'
              ctx.textBaseline = 'bottom'
              
              const x = canvas.width / 2
              const y = canvas.height - (canvas.height * 0.1)
              
              const metrics = ctx.measureText(text)
              const textWidth = metrics.width
              const textHeight = fontSize
              const padding = parseFloat(style.padding) || 8
              const borderRadius = parseFloat(style.borderRadius) || 4
              
              const bgX = x - textWidth / 2 - padding
              const bgY = y - textHeight - padding
              const bgWidth = textWidth + (padding * 2)
              const bgHeight = textHeight + (padding * 2)
              
              // Draw rounded rectangle background
              ctx.beginPath()
              ctx.roundRect(bgX, bgY, bgWidth, bgHeight, borderRadius)
              ctx.fillStyle = style.backgroundColor
              ctx.fill()
              
              if (style.border) {
                ctx.strokeStyle = style.border.split(' ')[2] || '#ffffff'
                ctx.lineWidth = parseFloat(style.border.split(' ')[0]) || 2
                ctx.stroke()
              }
              
              // Draw text
              ctx.fillStyle = style.textColor
              ctx.fillText(text, x, y)
              
              ctx.restore()
            }
          }
        }
      }
      return
    }

    // OLD BEHAVIOR: Draw video to canvas when no holders (legacy mode)
    const video = videoRef.current
    const timelineResult = timelineToVideoTime(currentTime)
    const isInGap = !timelineResult || !timelineResult.clip

    // If we're in a gap, show background color
    if (isInGap) {
      // Set canvas to canvas dimensions (maintains aspect ratio)
      const container = document.querySelector('[data-canvas-container]') as HTMLElement
      if (container) {
        const rect = container.getBoundingClientRect()
        // Calculate dimensions that maintain aspect ratio
        const containerAspectRatio = rect.width / rect.height
        const targetAspectRatio = canvasDimensions.aspectRatio
        
        let canvasWidth: number
        let canvasHeight: number
        
        if (containerAspectRatio > targetAspectRatio) {
          // Container is wider - fit to height
          canvasHeight = rect.height
          canvasWidth = canvasHeight * targetAspectRatio
        } else {
          // Container is taller - fit to width
          canvasWidth = rect.width
          canvasHeight = canvasWidth / targetAspectRatio
        }
        
        if (Math.abs(canvas.width - canvasWidth) > 1 || Math.abs(canvas.height - canvasHeight) > 1) {
          canvas.width = canvasWidth
          canvas.height = canvasHeight
        }
      } else {
        // Fallback to canvas settings resolution (maintains aspect ratio)
        if (canvas.width === 0 || canvas.height === 0) {
          canvas.width = canvasDimensions.width
          canvas.height = canvasDimensions.height
        }
      }
      ctx.fillStyle = canvasSettings.videoBackgroundColor
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      return
    }

    // If no video or video not ready or seeking, don't draw (will preserve last frame)
    if (!video || video.readyState < 2 || isSeekingRef.current || video.videoWidth === 0 || video.videoHeight === 0) {
      return
    }

    // Set canvas to canvas dimensions (maintains aspect ratio) - NOT video dimensions
    const container = document.querySelector('[data-canvas-container]') as HTMLElement
    if (container) {
      const rect = container.getBoundingClientRect()
      // Calculate dimensions that maintain aspect ratio
      const containerAspectRatio = rect.width / rect.height
      const targetAspectRatio = canvasDimensions.aspectRatio
      
      let canvasWidth: number
      let canvasHeight: number
      
      if (containerAspectRatio > targetAspectRatio) {
        // Container is wider - fit to height
        canvasHeight = rect.height
        canvasWidth = canvasHeight * targetAspectRatio
      } else {
        // Container is taller - fit to width
        canvasWidth = rect.width
        canvasHeight = canvasWidth / targetAspectRatio
      }
      
      if (Math.abs(canvas.width - canvasWidth) > 1 || Math.abs(canvas.height - canvasHeight) > 1) {
        canvas.width = canvasWidth
        canvas.height = canvasHeight
      }
    } else {
      // Fallback to canvas settings resolution (maintains aspect ratio)
      if (canvas.width === 0 || canvas.height === 0 || 
          Math.abs(canvas.width / canvas.height - canvasDimensions.aspectRatio) > 0.01) {
        canvas.width = canvasDimensions.width
        canvas.height = canvasDimensions.height
      }
    }

    // Draw video frame - fit video to canvas while maintaining video's aspect ratio
    if (video.videoWidth > 0 && video.videoHeight > 0) {
      try {
        // Calculate how to fit video into canvas (letterbox/pillarbox if needed)
        const videoAspectRatio = video.videoWidth / video.videoHeight
        const canvasAspectRatio = canvas.width / canvas.height
        
        let drawWidth: number
        let drawHeight: number
        let drawX: number
        let drawY: number
        
        if (canvasAspectRatio > videoAspectRatio) {
          // Canvas is wider - fit to height (pillarbox)
          drawHeight = canvas.height
          drawWidth = drawHeight * videoAspectRatio
          drawX = (canvas.width - drawWidth) / 2
          drawY = 0
        } else {
          // Canvas is taller - fit to width (letterbox)
          drawWidth = canvas.width
          drawHeight = drawWidth / videoAspectRatio
          drawX = 0
          drawY = (canvas.height - drawHeight) / 2
        }
        
        // Fill background first
        ctx.fillStyle = canvasSettings.videoBackgroundColor
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        
        // Draw video
        ctx.drawImage(video, drawX, drawY, drawWidth, drawHeight)

    // Apply LUT if enabled
    if (visualSettings.lutEnabled && lutData && visualSettings.lutIntensity > 0) {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const processedData = applyLUTToImageData(imageData, lutData, visualSettings.lutIntensity)
      ctx.putImageData(processedData, 0, 0)
    }

        // Draw captions on canvas if enabled
        if (selectedCaptionStyle !== 'none' && timelineResult && timelineResult.clip) {
          const sceneTranscript = transcripts.get(timelineResult.sceneId)
          if (sceneTranscript) {
            // Calculate the timeline time relative to the scene start
            const sceneTake = sceneTakes.find(st => st.sceneId === timelineResult.sceneId)
            if (sceneTake) {
              // Get words that should be visible at current time
              // Adjust currentTime to be relative to scene start
              const sceneRelativeTime = currentTime - sceneTake.startTime
              const visibleWords = sceneTranscript.words.filter(w => {
                // Check if word is in the visible time range
                const wordStart = w.start - sceneTake.startTime
                const wordEnd = w.end - sceneTake.startTime
                return sceneRelativeTime >= wordStart && sceneRelativeTime <= wordEnd
              })

              if (visibleWords.length > 0) {
                const style = captionStyles.find(s => s.id === selectedCaptionStyle) || captionStyles[0]
                
                // Limit words to max words setting
                const wordsToShow = visibleWords.slice(0, captionMaxWords)
                
                // Prepare text to render
                const text = wordsToShow.map(w => w.word).join(' ')
                
                // Calculate font size based on canvas height (scale proportionally)
                const fontSize = Math.max(12, Math.min(200, (canvas.height / 1080) * captionSize))
                const fontFamily = captionFont
                
                // Set up text rendering
                ctx.save()
                ctx.font = `${style.fontWeight} ${fontSize}px ${fontFamily}`
                ctx.textAlign = 'center'
                ctx.textBaseline = 'bottom'
                
                // Calculate text position (bottom center)
                const x = canvas.width / 2
                const y = canvas.height - (canvas.height * 0.1) // 10% from bottom
                
                // Measure text for background
                const metrics = ctx.measureText(text)
                const textWidth = metrics.width
                const textHeight = fontSize
                
                // Draw background
                const padding = parseFloat(style.padding) || 8
                const borderRadius = parseFloat(style.borderRadius) || 4
                
                // Draw rounded rectangle background
                const bgX = x - textWidth / 2 - padding
                const bgY = y - textHeight - padding
                const bgW = textWidth + padding * 2
                const bgH = textHeight + padding * 2
                
                ctx.beginPath()
                if (ctx.roundRect) {
                  ctx.roundRect(bgX, bgY, bgW, bgH, borderRadius)
                } else {
                  // Fallback for browsers without roundRect
                  const r = borderRadius
                  ctx.moveTo(bgX + r, bgY)
                  ctx.lineTo(bgX + bgW - r, bgY)
                  ctx.quadraticCurveTo(bgX + bgW, bgY, bgX + bgW, bgY + r)
                  ctx.lineTo(bgX + bgW, bgY + bgH - r)
                  ctx.quadraticCurveTo(bgX + bgW, bgY + bgH, bgX + bgW - r, bgY + bgH)
                  ctx.lineTo(bgX + r, bgY + bgH)
                  ctx.quadraticCurveTo(bgX, bgY + bgH, bgX, bgY + bgH - r)
                  ctx.lineTo(bgX, bgY + r)
                  ctx.quadraticCurveTo(bgX, bgY, bgX + r, bgY)
                  ctx.closePath()
                }
                
                // Apply background color
                if (style.backgroundColor && style.backgroundColor !== 'transparent') {
                  if (style.backgroundColor.startsWith('linear-gradient')) {
                    // For gradients, use a solid color fallback
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)'
                  } else {
                    ctx.fillStyle = style.backgroundColor
                  }
                  ctx.fill()
                }
                
                // Draw border if specified
                if (style.border) {
                  ctx.strokeStyle = style.border.split(' ')[2] || '#ffffff'
                  ctx.lineWidth = parseFloat(style.border.split(' ')[0]) || 2
                  ctx.stroke()
                }
                
                // Draw text
                ctx.fillStyle = style.textColor || '#ffffff'
                if (style.textTransform === 'uppercase') {
                  ctx.fillText(text.toUpperCase(), x, y)
                } else if (style.textTransform === 'lowercase') {
                  ctx.fillText(text.toLowerCase(), x, y)
                } else if (style.textTransform === 'capitalize') {
                  ctx.fillText(text.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' '), x, y)
                } else {
                  ctx.fillText(text, x, y)
                }
                
                ctx.restore()
              }
            }
          }
        }
      } catch (e) {
        // If drawing fails, show background
        ctx.fillStyle = canvasSettings.videoBackgroundColor
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }
    } else {
      // Video not ready, show background
      ctx.fillStyle = canvasSettings.videoBackgroundColor
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }
  }, [visualSettings.lutEnabled, visualSettings.lutIntensity, lutData, timelineToVideoTime, currentTime, canvasSettings.videoBackgroundColor, selectedCaptionStyle, captionStyles, captionFont, captionSize, captionMaxWords, transcripts, sceneTakes])

  // Sync audio with video
  const syncAudio = useCallback(() => {
    const video = videoRef.current
    const audio = audioRef.current
    if (audio && video) {
      if (Math.abs(audio.currentTime - video.currentTime) > 0.1) {
        audio.currentTime = video.currentTime
      }
    }
  }, [])

  // Ref for tracking the precise clip we are currently playing
  // This disambiguates instances where multiple clips might use the same source time
  const playingClipIdRef = useRef<string | null>(null)

  // Ensure playingClipIdRef is valid
  useEffect(() => {
    if (!playingClipIdRef.current) return
    const exists = timelineClips.some(c => c.id === playingClipIdRef.current)
    if (!exists) playingClipIdRef.current = null
  }, [timelineClips])

  // Set up video and audio playback
  useEffect(() => {
    const video = videoRef.current
    const audio = audioRef.current
    if (!video) return

    // Track if we were playing before scene switch

    // Current blob references to check against existing src
    // This simple check prevents reloading if the blob hasn't changed
    const currentVideoSrc = video.getAttribute('data-blob-id')
    const currentAudioSrc = audio?.getAttribute('data-blob-id')

    // Determine target blob IDs - separate for camera and screen
    const targetCameraId = cameraBlob ? 'camera' + cameraBlob.size : ''
    const targetScreenId = screenBlob ? 'screen' + screenBlob.size : ''
    const targetAudioId = microphoneBlob ? 'mic' + microphoneBlob.size : ''

    const setupSources = () => {
      // Set camera video source if changed
      if (cameraBlob && currentVideoSrc !== targetCameraId) {
        if (video.src) URL.revokeObjectURL(video.src)
        video.src = URL.createObjectURL(cameraBlob)
        video.setAttribute('data-blob-id', targetCameraId)
        video.muted = true

        if (wasPlayingRef.current) {
          video.play().catch(e => console.error("Auto-resume failed", e))
        }
      } else if (!cameraBlob && currentVideoSrc && currentVideoSrc.startsWith('camera')) {
        video.src = ''
        video.removeAttribute('data-blob-id')
      }
      
      // Set screen video source if changed
      if (screenBlob && screenVideoRef.current) {
        const screenVideo = screenVideoRef.current
        const currentScreenSrc = screenVideo.getAttribute('data-blob-id')
        
        if (currentScreenSrc !== targetScreenId) {
          if (screenVideo.src) URL.revokeObjectURL(screenVideo.src)
          screenVideo.src = URL.createObjectURL(screenBlob)
          screenVideo.setAttribute('data-blob-id', targetScreenId)
          screenVideo.muted = true
          
          if (wasPlayingRef.current) {
            screenVideo.play().catch(e => console.error("Auto-resume failed", e))
          }
        }
      } else if (!screenBlob && screenVideoRef.current) {
        const screenVideo = screenVideoRef.current
        const currentScreenSrc = screenVideo.getAttribute('data-blob-id')
        if (currentScreenSrc && currentScreenSrc.startsWith('screen')) {
          if (screenVideo.src) URL.revokeObjectURL(screenVideo.src)
          screenVideo.src = ''
          screenVideo.removeAttribute('data-blob-id')
        }
      }

      // Set audio source if changed
      if (audio) {
        if (microphoneBlob && currentAudioSrc !== targetAudioId) {
          if (audio.src) URL.revokeObjectURL(audio.src)
          audio.src = URL.createObjectURL(microphoneBlob)
          audio.setAttribute('data-blob-id', targetAudioId)
        } else if (!microphoneBlob && currentAudioSrc) {
          audio.src = ''
          audio.removeAttribute('data-blob-id')
        }
      }
    }

    setupSources()

    video.onloadedmetadata = () => {
      if (audio && microphoneBlob) audio.load()
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        setVideoAspectRatio(video.videoWidth / video.videoHeight)
        setVideoSize({ width: 80, height: 80 })
      }

      // Check for duration mismatch and update clips to match actual video duration
      const currentTake = sceneTakes.find(st => st.sceneId === selectedSceneId && st.take.id === selectedTake?.id)
      // Only update if video.duration is valid (finite and positive)
      const validVideoDuration = video.duration && Number.isFinite(video.duration) && video.duration > 0
      if (currentTake && validVideoDuration && Math.abs(currentTake.take.duration - video.duration) > 0.1) {
        console.log(`Correcting duration mismatch: stored=${currentTake.take.duration}, actual=${video.duration}`)

        // Update sceneTakes with correct duration
        const newSceneTakes = sceneTakes.map(st => {
          if (st.sceneId === selectedSceneId && st.take.id === selectedTake?.id) {
            return {
              ...st,
              take: {
                ...st.take,
                duration: video.duration
              }
            }
          }
          return st
        })
        setSceneTakes(newSceneTakes)

        // Update timeline clips to ensure sourceOut never exceeds actual video duration
        // Also update totalDuration based on corrected clips
        setTimelineClips(prev => {
          const updatedClips = prev.map(clip => {
            if (clip.sceneId === selectedSceneId && clip.takeId === selectedTake?.id) {
              const actualDuration = video.duration
              // Clamp sourceOut to actual duration
              const clampedSourceOut = Math.min(clip.sourceOut, actualDuration)
              // Ensure sourceIn doesn't exceed sourceOut
              const clampedSourceIn = Math.min(clip.sourceIn, clampedSourceOut - 0.1)
              // Recalculate timelineEnd based on actual trimmed clip duration
              // timelineEnd must always equal timelineStart + (sourceOut - sourceIn)
              const trimmedDuration = clampedSourceOut - clampedSourceIn
              const newTimelineEnd = clip.timelineStart + trimmedDuration
              
              return {
                ...clip,
                sourceIn: clampedSourceIn,
                sourceOut: clampedSourceOut,
                sourceDuration: actualDuration,
                timelineEnd: newTimelineEnd
              }
            }
            return clip
          })
          
          // Recalculate totalDuration based on updated clips
          const maxEnd = updatedClips.length > 0 ? Math.max(...updatedClips.map(c => c.timelineEnd)) : 0
          const safeMaxEnd = Number.isFinite(maxEnd) && maxEnd > 0 ? maxEnd : 1
          setTotalDuration(safeMaxEnd)
          
          return updatedClips
        })
      }

      drawFrame()
    }

    video.ontimeupdate = () => {
      syncAudio()
      // Don't call drawFrame here - the timeline renderLoop handles drawing
    }

    // Playback Loop logic moved to top level effect

    video.onplay = () => {
      setIsPlaying(true)
      if (audio) {
        audio.currentTime = video.currentTime
        audio.play().catch(e => console.error(e))
      }
      // Don't start a separate draw loop - the timeline renderLoop handles drawing
    }

    video.onpause = () => {
      // Don't stop timeline playback if user manually paused - let timeline control it
      // Only stop if we're not in timeline-driven mode
      if (!isPlaying) {
      if (audio) audio.pause()
      }
    }

    video.onended = () => {
      // Don't stop timeline playback when video element ends
      // The timeline loop will handle transitions between clips
      // Only pause audio if timeline is also stopped
      if (!isPlaying && audio) {
        audio.pause()
      }
    }

    video.onseeked = () => {
      syncAudio()
      // Don't call drawFrame here - the timeline renderLoop handles drawing
    }

    // Cleanup function
    return () => {
      // convert to a "cleanup only if component unmounts" ? 
      // Current behavior: if blob changes, we revoke previous URL via setupSources check
      // We don't want to revoke everything on every render.
    }
  }, [cameraBlob, microphoneBlob, screenBlob, currentSceneTake, selectedSceneId, selectedTake, drawFrame, syncAudio, timelineClips, sceneTakes, selectedSceneIndex])

  // Timeline playhead tracking
  const timelineTimeRef = useRef(currentTime)
  useEffect(() => {
    if (!isPlaying) {
      timelineTimeRef.current = currentTime
    }
  }, [currentTime, isPlaying])

  // Recalculate total duration whenever timeline clips change
  useEffect(() => {
    if (timelineClips.length === 0) {
      setTotalDuration(1)
      // Reset to start when no clips
      if (currentTime > 0) {
        setCurrentTime(0)
        timelineTimeRef.current = 0
      }
      return
    }
    const maxEnd = Math.max(...timelineClips.map(c => c.timelineEnd), 0)
    const safeDuration = Number.isFinite(maxEnd) && maxEnd > 0 ? maxEnd : 1
    setTotalDuration(safeDuration)
    // Ensure currentTime doesn't exceed totalDuration
    if (currentTime > safeDuration) {
      setCurrentTime(0)
      timelineTimeRef.current = 0
    }
  }, [timelineClips, currentTime])

  // Handle seek - must be defined before playback loop
  const handleSeek = useCallback((absoluteTime: number, immediate: boolean = false) => {
    // Update timeline position immediately for smooth scrubbing
    const clampedTime = Math.max(0, Math.min(totalDuration, absoluteTime))
    setCurrentTime(clampedTime)
    timelineTimeRef.current = clampedTime

    const result = timelineToVideoTime(clampedTime)
    if (!result) {
      // If time is beyond all clips, pause and stay at current position
      const video = videoRef.current
      const audio = audioRef.current
      if (video && !video.paused) {
        video.pause()
      }
      if (audio && !audio.paused) {
        audio.pause()
      }
      setIsPlaying(false)
      return
    }

    const { videoTime, sceneId, takeId } = result

    // Switch to this scene/take if not already selected
    const sceneIndex = sceneTakes.findIndex(st =>
      st.sceneId === sceneId && st.take.id === takeId
    )

    const needsSceneSwitch = sceneIndex >= 0 && sceneIndex !== selectedSceneIndex

    if (needsSceneSwitch) {
      setSelectedSceneIndex(sceneIndex)
    }

    // Seek video/audio - use requestAnimationFrame for immediate updates during scrubbing
    const seekToTime = () => {
      const video = videoRef.current
      const audio = audioRef.current

      if (video) {
        if (video.readyState >= 2) {
          isSeekingRef.current = true
          video.currentTime = videoTime
          // Reset seeking flag after seek completes
          const onSeeked = () => {
            isSeekingRef.current = false
            video.removeEventListener('seeked', onSeeked)
          }
          video.addEventListener('seeked', onSeeked, { once: true })
        } else {
          // Wait for video to be ready
          const onCanPlay = () => {
            if (video) {
              isSeekingRef.current = true
              video.currentTime = videoTime
              // Reset seeking flag after seek completes
              const onSeeked = () => {
                isSeekingRef.current = false
                video.removeEventListener('seeked', onSeeked)
              }
              video.addEventListener('seeked', onSeeked, { once: true })
              video.removeEventListener('canplay', onCanPlay)
            }
          }
          video.addEventListener('canplay', onCanPlay)
        }
      }

      if (audio) {
        if (audio.readyState >= 2) {
          audio.currentTime = videoTime
        } else {
          // Wait for audio to be ready
          const onCanPlay = () => {
            if (audio) {
              audio.currentTime = videoTime
              audio.removeEventListener('canplay', onCanPlay)
            }
          }
          audio.addEventListener('canplay', onCanPlay)
        }
      }
    }

    if (immediate) {
      seekToTime()
    } else {
      requestAnimationFrame(seekToTime)
    }
  }, [totalDuration, timelineToVideoTime, sceneTakes, selectedSceneIndex, drawFrame])

  // Convert video time back to timeline time (inverse of timelineToVideoTime)
  const videoTimeToTimeline = useCallback((videoTime: number, clip: TimelineClip): number => {
    const sourceDuration = clip.sourceOut - clip.sourceIn
    if (sourceDuration <= 0.001) return clip.timelineStart
    
    // Calculate relative position within the source clip (0 to 1)
    const relativeSourceTime = (videoTime - clip.sourceIn) / sourceDuration
    const clipDuration = clip.timelineEnd - clip.timelineStart
    
    // Map back to timeline position
    return clip.timelineStart + (relativeSourceTime * clipDuration)
  }, [])

  // Playback Loop - timeline-driven with continuous advancement
  const currentClipRef = useRef<TimelineClip | null>(null)
  const isSeekingRef = useRef(false)
  const lastFrameTimeRef = useRef<number>(performance.now())
  const previousLayoutClipIdRef = useRef<string | null>(null)
  // wasPlayingRef is declared earlier for tracking playback state across scene switches
  
  useEffect(() => {
    let animationFrameId: number

    const renderLoop = () => {
      if (!isPlaying) {
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId)
        }
        return
      }

      const now = performance.now()
      // Use high-resolution time delta for accurate real-time playback
      // Only reset lastFrameTimeRef when playback starts (transition from paused to playing)
      if (!wasPlayingRef.current) {
        lastFrameTimeRef.current = now
        wasPlayingRef.current = true
      }
      
      const deltaTime = (now - lastFrameTimeRef.current) / 1000 // Convert to seconds
      lastFrameTimeRef.current = now

      const video = videoRef.current
      const audio = audioRef.current

      // Continuously advance timeline - this is the source of truth
      // Ensure deltaTime is valid (not negative or too large due to tab switching, etc.)
      // Increased cap to 200ms to handle occasional frame drops without losing time
      const validDeltaTime = Math.max(0, Math.min(deltaTime, 0.2)) // Cap at 200ms to handle tab switches
      const currentTimelineTime = timelineTimeRef.current
      // Apply playback rate to deltaTime for accurate real-time advancement
      const newTimelineTime = Math.min(currentTimelineTime + (validDeltaTime * playbackRate), totalDuration)
      timelineTimeRef.current = newTimelineTime
      // Always update state every frame for real-time playback (no throttling)
      setCurrentTime(newTimelineTime)

      // Stop at end
      if (newTimelineTime >= totalDuration - 0.01) {
        setIsPlaying(false)
        if (video) video.pause()
        if (audio) audio.pause()
        if (screenVideoRef.current) screenVideoRef.current.pause()
        setCurrentTime(totalDuration)
        drawFrame()
        return
      }

      // Get current layout clip and apply its holders
      const currentLayoutClip = getCurrentLayoutClip(timelineTimeRef.current)
      if (currentLayoutClip) {
        // Check if we've switched layout clips
        const layoutClipChanged = previousLayoutClipIdRef.current !== currentLayoutClip.id
        
        if (layoutClipChanged && previousLayoutClipIdRef.current && canvasSettings.transitionDuration > 0) {
          // Find previous layout clip
          const previousLayoutClip = layoutClips.find(lc => lc.id === previousLayoutClipIdRef.current)
          
          if (previousLayoutClip) {
            // Transition holders between layout clips
            // Check all holders in both clips for smooth transitions
            const allHolderKeys = new Set([
              ...previousLayoutClip.holders.map(h => `${h.clipId}_${h.layer}`),
              ...currentLayoutClip.holders.map(h => `${h.clipId}_${h.layer}`)
            ])
            
            allHolderKeys.forEach(key => {
              const [clipId, layer] = key.split('_')
              const prevHolder = previousLayoutClip.holders.find(h => h.clipId === clipId && h.layer === layer)
              const newHolder = currentLayoutClip.holders.find(h => h.clipId === clipId && h.layer === layer)
              
              // If holder exists in both clips, check for changes
              if (prevHolder && newHolder) {
                const hasPositionChange = 
                  Math.abs(prevHolder.x - newHolder.x) > 0.001 ||
                  Math.abs(prevHolder.y - newHolder.y) > 0.001 ||
                  Math.abs(prevHolder.width - newHolder.width) > 0.001 ||
                  Math.abs(prevHolder.height - newHolder.height) > 0.001 ||
                  Math.abs((prevHolder.rotation || 0) - (newHolder.rotation || 0)) > 0.1
                
                if (hasPositionChange) {
                  // Store transition by clipId_layer so we can apply it even if holder ID changes
                  const clipKey = `${clipId}_${layer}`
                  const existingTransition = transitioningByClipRef.current.get(clipKey)
                  const transitionStartTime = existingTransition ? existingTransition.startTime : performance.now()
                  
                  transitioningByClipRef.current.set(clipKey, {
                    startPos: { 
                      x: prevHolder.x, 
                      y: prevHolder.y, 
                      width: prevHolder.width, 
                      height: prevHolder.height 
                    },
                    endPos: { 
                      x: newHolder.x, 
                      y: newHolder.y, 
                      width: newHolder.width, 
                      height: newHolder.height 
                    },
                    startRotation: prevHolder.rotation || 0,
                    endRotation: newHolder.rotation || 0,
                    startTime: transitionStartTime,
                    duration: canvasSettings.transitionDuration * 1000
                  })
                  
                  // Also set on actual holder if it exists
                  const actualHolder = canvasHolders.find(h => h.clipId === clipId && h.layer === layer)
                  if (actualHolder) {
                    transitioningHoldersRef.current.set(actualHolder.id, {
                      startPos: { 
                        x: prevHolder.x, 
                        y: prevHolder.y, 
                        width: prevHolder.width, 
                        height: prevHolder.height 
                      },
                      endPos: { 
                        x: newHolder.x, 
                        y: newHolder.y, 
                        width: newHolder.width, 
                        height: newHolder.height 
                      },
                      startRotation: prevHolder.rotation || 0,
                      endRotation: newHolder.rotation || 0,
                      startTime: transitionStartTime,
                      duration: canvasSettings.transitionDuration * 1000,
                      clipId: clipId,
                      layer: layer
                    })
                  }
                }
              } else if (prevHolder && !newHolder) {
                // Holder exists in previous clip but not in new clip - fade out
                const actualHolder = canvasHolders.find(h => h.clipId === clipId && h.layer === layer)
                if (actualHolder) {
                  fadingOutHoldersRef.current.set(actualHolder.id, {
                    holder: { ...actualHolder },
                    startTime: performance.now(),
                    duration: canvasSettings.transitionDuration * 1000
                  })
                }
              } else if (!prevHolder && newHolder) {
                // Holder appears in new clip - fade in (start from new position with opacity transition)
                const actualHolder = canvasHolders.find(h => h.clipId === clipId && h.layer === layer)
                if (actualHolder) {
                  // For fade-in, we'll use the holder's current position but animate opacity
                  // The position is already correct, so we just need to handle opacity
                  transitioningHoldersRef.current.set(actualHolder.id, {
                    startPos: { 
                      x: newHolder.x, 
                      y: newHolder.y, 
                      width: newHolder.width, 
                      height: newHolder.height 
                    },
                    endPos: { 
                      x: newHolder.x, 
                      y: newHolder.y, 
                      width: newHolder.width, 
                      height: newHolder.height 
                    },
                    startRotation: newHolder.rotation || 0,
                    endRotation: newHolder.rotation || 0,
                    startTime: performance.now(),
                    duration: canvasSettings.transitionDuration * 1000,
                    fadeIn: true // Flag to indicate this is a fade-in
                  })
                }
              }
            })
          }
          
          previousLayoutClipIdRef.current = currentLayoutClip.id
        } else if (layoutClipChanged) {
          previousLayoutClipIdRef.current = currentLayoutClip.id
        }
        
        // Canvas holders are now derived from layout clips via useMemo
        // No need to set them here - they're automatically computed from currentLayoutClip.holders
      }

      // Find which clip should be playing at this timeline position
      const timelineResult = timelineToVideoTime(timelineTimeRef.current)

      if (timelineResult && timelineResult.clip) {
        const { clip, videoTime, sceneId, takeId } = timelineResult

        // Check if we've switched clips
        const clipChanged = currentClipRef.current?.id !== clip.id

        if (clipChanged) {
          // Switch to new clip - seek ONCE and let it play
          const previousClip = currentClipRef.current
          currentClipRef.current = clip
          
          // Animate holder transitions if positions differ
          if (previousClip && canvasSettings.transitionDuration > 0) {
            const previousHolder = canvasHolders.find(h => h.clipId === previousClip.id && h.layer === previousClip.layer)
            const newHolder = canvasHolders.find(h => h.clipId === clip.id && h.layer === clip.layer)
            
            if (previousHolder && newHolder) {
              const hasPositionChange = previousHolder.x !== newHolder.x || previousHolder.y !== newHolder.y || 
                                       previousHolder.width !== newHolder.width || previousHolder.height !== newHolder.height
              
              if (hasPositionChange) {
                // Start position transition animation for new holder
                transitioningHoldersRef.current.set(newHolder.id, {
                  startPos: { x: previousHolder.x, y: previousHolder.y, width: previousHolder.width, height: previousHolder.height },
                  endPos: { x: newHolder.x, y: newHolder.y, width: newHolder.width, height: newHolder.height },
                  startTime: performance.now(),
                  duration: canvasSettings.transitionDuration * 1000 // Convert to ms
                })
              }
              
              // Start fade-out animation for previous holder (always fade if there's a clip change)
              const transitionStartTime = performance.now()
              fadingOutHoldersRef.current.set(previousHolder.id, {
                holder: { ...previousHolder }, // Copy to preserve position at transition start
                startTime: transitionStartTime,
                duration: canvasSettings.transitionDuration * 1000
              })
            }
          }
          
          // Find the scene take for this clip
          const sceneTake = sceneTakes.find((st: SceneTake) => 
            st.sceneId === sceneId && st.take.id === takeId
          )
          
          if (sceneTake) {
            const sceneIndex = sceneTakes.findIndex((st: SceneTake) => 
              st.sceneId === sceneId && st.take.id === takeId
            )
            
            // Switch scene if needed
            if (sceneIndex >= 0 && sceneIndex !== selectedSceneIndex) {
              setSelectedSceneIndex(sceneIndex)
              // Wait for scene to load before seeking
              const seekWhenReady = () => {
                const v = videoRef.current
                const a = audioRef.current
                if (v && v.readyState >= 2) {
                  isSeekingRef.current = true
                  v.currentTime = videoTime
                  if (a && a.readyState >= 2) {
                    a.currentTime = videoTime
                  }
                  // Also handle screen video if this is a screen clip
                  if (clip.layer === 'screen' && screenVideoRef.current) {
                    const screenVideo = screenVideoRef.current
                    if (screenVideo.readyState >= 2) {
                      screenVideo.currentTime = videoTime
                      if (screenVideo.paused && isPlaying) {
                        screenVideo.play().catch(console.error)
                      }
                    }
                  }
                  const onSeeked = () => {
                    isSeekingRef.current = false
                    v.removeEventListener('seeked', onSeeked)
                    // Start playing after seek completes
                    if (isPlaying && v.paused) {
                      v.play().catch(console.error)
                    }
                    if (isPlaying && a && a.paused) {
                      a.play().catch(console.error)
                    }
                  }
                  v.addEventListener('seeked', onSeeked, { once: true })
                  v.removeEventListener('canplay', seekWhenReady)
                }
              }
              const v = videoRef.current
              if (v && v.readyState >= 2) {
                seekWhenReady()
              } else if (v) {
                v.addEventListener('canplay', seekWhenReady, { once: true })
              }
          } else {
              // Same scene, different clip - seek ONCE to correct position
              if (video && video.readyState >= 2 && !isSeekingRef.current) {
                isSeekingRef.current = true
                video.currentTime = videoTime
                if (audio && audio.readyState >= 2) {
                  audio.currentTime = videoTime
                }
                // Also handle screen video if this is a screen clip
                if (clip.layer === 'screen' && screenVideoRef.current) {
                  const screenVideo = screenVideoRef.current
                  if (screenVideo.readyState >= 2) {
                    screenVideo.currentTime = videoTime
                    if (screenVideo.paused && isPlaying) {
                      screenVideo.play().catch(console.error)
                    }
                  }
                }
                const onSeeked = () => {
                  isSeekingRef.current = false
                  video.removeEventListener('seeked', onSeeked)
                  // Start playing after seek completes
                  if (isPlaying && video.paused) {
                    video.play().catch(console.error)
                  }
                  if (isPlaying && audio && audio.paused) {
                    audio.play().catch(console.error)
                  }
                }
                video.addEventListener('seeked', onSeeked, { once: true })
              }
            }
          }
        } else {
          // Same clip - sync video to timeline position periodically to prevent drift
          // Only sync if there's a significant difference (> 0.1s) to avoid constant seeking

          // Keep video/audio playing - only start if paused
          if (clip.layer === 'camera' && video && video.readyState >= 2 && !isSeekingRef.current) {
            if (video.paused && isPlaying) {
              video.play().catch(console.error)
            } else if (!video.paused && isPlaying) {
              // Sync video currentTime to timeline position if drift is significant
              const expectedVideoTime = videoTime
              const actualVideoTime = video.currentTime
              const drift = Math.abs(expectedVideoTime - actualVideoTime)
              // Only sync if drift > 0.1s to avoid constant seeking
              if (drift > 0.1) {
                isSeekingRef.current = true
                video.currentTime = expectedVideoTime
                const onSeeked = () => {
                  isSeekingRef.current = false
                  video.removeEventListener('seeked', onSeeked)
                }
                video.addEventListener('seeked', onSeeked, { once: true })
              }
            }
          }
          if (clip.layer === 'screen' && screenVideoRef.current && !isSeekingRef.current) {
            const screenVideo = screenVideoRef.current
            if (screenVideo.readyState >= 2) {
              if (screenVideo.paused && isPlaying) {
                screenVideo.play().catch(console.error)
              } else if (!screenVideo.paused && isPlaying) {
                // Sync screen video to timeline position
                const expectedVideoTime = videoTime
                const actualVideoTime = screenVideo.currentTime
                const drift = Math.abs(expectedVideoTime - actualVideoTime)
                if (drift > 0.1) {
                  screenVideo.currentTime = expectedVideoTime
                }
              }
            }
          }
          if (audio && audio.readyState >= 2 && !isSeekingRef.current) {
            if (audio.paused && isPlaying) {
              // Sync audio to the appropriate video source
              const sourceVideo = clip.layer === 'screen' && screenVideoRef.current ? screenVideoRef.current : video
              if (sourceVideo && sourceVideo.readyState >= 2 && !sourceVideo.paused) {
                audio.currentTime = sourceVideo.currentTime
              }
              audio.play().catch(console.error)
            } else if (!audio.paused && isPlaying) {
              // Sync audio to timeline position
              const expectedAudioTime = videoTime
              const actualAudioTime = audio.currentTime
              const drift = Math.abs(expectedAudioTime - actualAudioTime)
              if (drift > 0.1) {
                audio.currentTime = expectedAudioTime
              }
            }
          }
        }
      } else {
        // In a gap: pause media and show background
        // Timeline continues advancing automatically above
        currentClipRef.current = null
        if (video && !video.paused) video.pause()
        if (audio && !audio.paused) audio.pause()
      }

      // Update holder transitions
      const transitionNow = performance.now()
      const transitioningHolders = transitioningHoldersRef.current
      const fadingOutHolders = fadingOutHoldersRef.current
      
      // Check if any transitions are active and clean up completed ones
      let hasActiveTransitions = false
      const holdersToDelete: string[] = []
      transitioningHolders.forEach((transition, holderId) => {
        const elapsed = transitionNow - transition.startTime
        if (elapsed < transition.duration) {
          hasActiveTransitions = true
        } else {
          holdersToDelete.push(holderId)
        }
      })
      holdersToDelete.forEach(id => transitioningHolders.delete(id))
      
      // Also check transitions tracked by clipId_layer
      const clipTransitionsToDelete: string[] = []
      transitioningByClipRef.current.forEach((transition, clipKey) => {
        const elapsed = transitionNow - transition.startTime
        if (elapsed < transition.duration) {
          hasActiveTransitions = true
        } else {
          clipTransitionsToDelete.push(clipKey)
        }
      })
      clipTransitionsToDelete.forEach(key => transitioningByClipRef.current.delete(key))
      
      // Clean up completed fade-outs
      const fadeOutsToDelete: string[] = []
      fadingOutHolders.forEach((fadeOut, holderId) => {
        const elapsed = transitionNow - fadeOut.startTime
        if (elapsed >= fadeOut.duration) {
          fadeOutsToDelete.push(holderId)
        } else {
          hasActiveTransitions = true
        }
      })
      fadeOutsToDelete.forEach(id => fadingOutHolders.delete(id))
      
      // Force re-render if transitions are active (so React updates the display positions)
      if (hasActiveTransitions) {
        // Use a counter state to force re-render during transitions
        // This is more efficient than updating currentTime
        setTransitionFrame(prev => prev + 1)
      }

      // Always draw frame
      drawFrame()

      animationFrameId = requestAnimationFrame(renderLoop)
    }

    if (isPlaying) {
      // Initialize clip tracking
      const initialResult = timelineToVideoTime(timelineTimeRef.current)
      currentClipRef.current = initialResult?.clip || null
      // Start the loop - lastFrameTimeRef will be reset in renderLoop on first frame
      animationFrameId = requestAnimationFrame(renderLoop)
    } else {
      currentClipRef.current = null
      wasPlayingRef.current = false // Reset when paused
    }

    return () => {
      if (animationFrameId) {
      cancelAnimationFrame(animationFrameId)
    }
    }
  }, [isPlaying, selectedSceneIndex, sceneTakes, timelineClips, totalDuration, playbackRate, drawFrame, timelineToVideoTime, canvasHolders, canvasSettings.transitionDuration])

  // Load transcriptions from project when sceneTakes change
  useEffect(() => {
    const loadTranscriptions = async () => {
      if (!projectManager.hasProject() || sceneTakes.length === 0) return

      const newTranscripts = new Map(transcripts)

      for (const sceneTake of sceneTakes) {
        try {
          const transcription = await projectManager.loadTranscription(
            sceneTake.sceneId,
            sceneTake.take.id
          )
          if (transcription) {
            // Adjust timestamps to be relative to scene start in timeline
            const adjustedWords = transcription.words.map(w => ({
              ...w,
              start: w.start + sceneTake.startTime,
              end: w.end + sceneTake.startTime,
            }))

            newTranscripts.set(sceneTake.sceneId, {
              words: adjustedWords,
              text: transcription.text,
            })
          }
        } catch (error) {
          console.error('Error loading transcription:', error)
        }
      }

      if (newTranscripts.size > 0) {
        setTranscripts(newTranscripts)
      }
    }

    loadTranscriptions()
  }, [sceneTakes])

  // Transcription
  const handleTranscribe = async (sceneId: string, takeId: string) => {
    const sceneTake = sceneTakes.find(st => st.sceneId === sceneId)
    if (!sceneTake) return

    // Load the microphone blob for this scene
    let micBlob: Blob | null = null
    try {
      micBlob = await projectManager.loadRecording(sceneId, `${takeId}_microphone`)
    } catch (error) {
      console.error('Error loading microphone recording:', error)
      alert('No microphone recording available for this scene')
      return
    }

    if (!micBlob) {
      alert('No microphone recording available for this scene')
      return
    }

    const apiKey = localStorage.getItem('openai_api_key')
    if (!apiKey) {
      alert('OpenAI API key not found. Please set it in Settings.')
      setShowSettings(true)
      return
    }

    setIsTranscribing(new Map(isTranscribing.set(sceneId, true)))
    try {
      const result = await transcribeAudio(micBlob, apiKey)

      // Save transcription to project folder (with original timestamps, not adjusted)
      if (projectManager.hasProject()) {
        try {
          await projectManager.saveTranscription(
            sceneId,
            takeId,
            {
              text: result.text,
              words: result.words, // Save original timestamps (relative to audio start)
            }
          )
        } catch (error) {
          console.error('Error saving transcription:', error)
        }
      }

      // Adjust timestamps to be relative to scene start in timeline
      const adjustedWords = result.words.map(w => ({
        ...w,
        start: w.start + sceneTake.startTime,
        end: w.end + sceneTake.startTime,
      }))

      setTranscripts(new Map(transcripts.set(sceneId, {
        words: adjustedWords,
        text: result.text,
      })))
    } catch (error) {
      console.error('Transcription error:', error)
      alert('Transcription failed: ' + (error as Error).message)
    } finally {
      setIsTranscribing(new Map(isTranscribing.set(sceneId, false)))
    }
  }

  // Get current scene's transcript
  const currentTranscript = selectedSceneId ? transcripts.get(selectedSceneId) : null

  // Handle text selection in transcript
  const handleTranscriptSelection = (sceneId: string) => {
    const sceneTranscript = transcripts.get(sceneId)
    if (!sceneTranscript) return

    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) {
      setSelectedText(null)
      return
    }

    const range = selection.getRangeAt(0)
    const selectedTextStr = range.toString().trim()
    if (!selectedTextStr) {
      setSelectedText(null)
      return
    }

    // Find word timestamps for selected text
    const words = sceneTranscript.words.filter(w =>
      selectedTextStr.toLowerCase().includes(w.word.toLowerCase()) ||
      w.word.toLowerCase().includes(selectedTextStr.toLowerCase())
    )

    if (words.length > 0) {
      const start = Math.min(...words.map(w => w.start))
      const end = Math.max(...words.map(w => w.end))
      setSelectedText({ start, end, sceneId })
    }
  }

  // Handle word click to select single word
  const handleWordClick = (word: WordTimestamp, sceneId: string, wordIndex?: number) => {
    setSelectedText({ start: word.start, end: word.end, sceneId })
    // Clear text selection
    window.getSelection()?.removeAllRanges()

    // Apply caption style if a style is selected and wordIndex is provided
    if (wordIndex !== undefined && selectedCaptionStyle !== 'none') {
      setCaptionWordStyles(prev => {
        const sceneStyles = prev.get(sceneId) || new Map<number, CaptionStyleId>()
        const newSceneStyles = new Map(sceneStyles)
        newSceneStyles.set(wordIndex, selectedCaptionStyle)
        const updated = new Map(prev)
        updated.set(sceneId, newSceneStyles)
        return updated
      })
    }
  }

  // Get caption style for a word - now uses global selectedCaptionStyle for all words
  const getCaptionStyleForWord = (sceneId: string, wordIndex: number): CaptionStyleId => {
    return selectedCaptionStyle
  }

  // Create cut from selected text
  // Remove a segment from a sceneTake (splits into 2 clips and removes the middle segment)
  const handleRemoveSegment = useCallback((sceneTake: SceneTake, segmentStart: number, segmentEnd: number) => {
    // Calculate relative times
    const relativeStart = segmentStart - sceneTake.startTime
    const relativeEnd = segmentEnd - sceneTake.startTime
    const sceneDuration = sceneTake.endTime - sceneTake.startTime

    // Don't remove if too close to edges or invalid
    if (relativeStart <= 0.1 || relativeEnd >= sceneDuration - 0.1 || relativeStart >= relativeEnd) {
      return
    }

    // Calculate video times (accounting for trims)
    const videoStartTime = sceneTake.trimmedStart + relativeStart
    const videoEndTime = sceneTake.trimmedStart + relativeEnd

    // Create first part: from start to segment start
    const firstPart: SceneTake = {
      ...sceneTake,
      startTime: sceneTake.startTime,
      endTime: segmentStart,
      trimmedStart: sceneTake.trimmedStart,
      trimmedEnd: sceneTake.take.duration - videoStartTime,
    }

    // Create second part: from segment end to end
    const segmentDuration = segmentEnd - segmentStart
    const secondPart: SceneTake = {
      ...sceneTake,
      startTime: segmentStart, // This will be adjusted to remove the gap
      endTime: sceneTake.endTime - segmentDuration, // Remove the segment duration
      trimmedStart: videoEndTime,
      trimmedEnd: sceneTake.trimmedEnd,
    }

    // Update sceneTakes: replace the original with the two parts
    setSceneTakes(prev => {
      const newTakes: SceneTake[] = []

      prev.forEach(st => {
        // Check if this is the sceneTake we're modifying
        if (st.sceneId === sceneTake.sceneId &&
          st.take.id === sceneTake.take.id &&
          Math.abs(st.startTime - sceneTake.startTime) < 0.01 &&
          Math.abs(st.endTime - sceneTake.endTime) < 0.01) {
          // Replace with the two parts
          newTakes.push(firstPart)
          newTakes.push(secondPart)
        } else if (st.startTime > segmentStart) {
          // Shift clips that come after the removed segment
          newTakes.push({
            ...st,
            startTime: st.startTime - segmentDuration,
            endTime: st.endTime - segmentDuration,
          })
        } else {
          // Keep other sceneTakes as-is
          newTakes.push(st)
        }
      })

      // Recalculate total duration (reduced by segment duration)
      const maxEnd = Math.max(...newTakes.map(st => st.endTime), 0)
      setTotalDuration(Math.max(maxEnd, 1))

      return newTakes
    })
  }, [])

  const handleCreateCut = useCallback(() => {
    if (!selectedText) return

    const sceneTake = sceneTakes.find(st => st.sceneId === selectedText.sceneId)
    if (!sceneTake) return

    // Find words that overlap with the selected text
    const sceneTranscript = transcripts.get(selectedText.sceneId)
    if (sceneTranscript) {
      const deletedIndices = new Set<number>()
      sceneTranscript.words.forEach((word, index) => {
        // Check if word overlaps with selected text
        if (word.start >= selectedText.start && word.end <= selectedText.end) {
          deletedIndices.add(index)
        }
      })

      // Mark words as deleted for strikethrough
      setDeletedWords(prev => {
        const newMap = new Map(prev)
        const existing = newMap.get(selectedText.sceneId) || new Set<number>()
        deletedIndices.forEach(idx => existing.add(idx))
        newMap.set(selectedText.sceneId, existing)
        return newMap
      })
    }

    // Calculate cut times in timeline coordinates
    const cutStartTime = selectedText.start
    const cutEndTime = selectedText.end
    const cutDuration = cutEndTime - cutStartTime

    // Update timeline clips - split clips that overlap with the cut and remove the middle part
    setTimelineClips(prev => {
      const updated: TimelineClip[] = []
      const clipsToProcess = [...prev]

      clipsToProcess.forEach(clip => {
        // Only process clips from the same scene
        if (clip.sceneId !== selectedText.sceneId) {
          updated.push(clip)
          return
        }

        // Check if clip overlaps with the cut
        const clipOverlapsCut = 
          (clip.timelineStart < cutEndTime && clip.timelineEnd > cutStartTime)

        if (!clipOverlapsCut) {
          // Clip doesn't overlap - just shift it if it's after the cut
          if (clip.timelineStart >= cutEndTime) {
            updated.push({
              ...clip,
              timelineStart: clip.timelineStart - cutDuration,
              timelineEnd: clip.timelineEnd - cutDuration,
            })
          } else {
            updated.push(clip)
          }
          return
        }

        // Clip overlaps with cut - need to split it
        // Case 1: Cut is entirely within the clip
        if (cutStartTime > clip.timelineStart && cutEndTime < clip.timelineEnd) {
          // Calculate source times for the cut points
          const clipDuration = clip.timelineEnd - clip.timelineStart
          const sourceDuration = clip.sourceOut - clip.sourceIn
          
          // Relative position of cut start within clip
          const relativeCutStart = cutStartTime - clip.timelineStart
          const relativeCutEnd = cutEndTime - clip.timelineStart
          
          // Source time at cut start
          const sourceCutStart = clip.sourceIn + (relativeCutStart / clipDuration) * sourceDuration
          // Source time at cut end
          const sourceCutEnd = clip.sourceIn + (relativeCutEnd / clipDuration) * sourceDuration

          // First part: from clip start to cut start
          const firstPart: TimelineClip = {
            ...clip,
            id: `${clip.id}_before_${Date.now()}`,
            timelineEnd: cutStartTime,
            sourceOut: sourceCutStart,
          }

          // Second part: from cut end to clip end (shifted back by cut duration)
          const secondPart: TimelineClip = {
            ...clip,
            id: `${clip.id}_after_${Date.now()}`,
            timelineStart: cutStartTime, // Shifted back
            timelineEnd: clip.timelineEnd - cutDuration,
            sourceIn: sourceCutEnd,
          }

          updated.push(firstPart)
          updated.push(secondPart)
        }
        // Case 2: Cut starts before clip but ends within clip
        else if (cutStartTime <= clip.timelineStart && cutEndTime > clip.timelineStart && cutEndTime < clip.timelineEnd) {
          const clipDuration = clip.timelineEnd - clip.timelineStart
          const sourceDuration = clip.sourceOut - clip.sourceIn
          const relativeCutEnd = cutEndTime - clip.timelineStart
          const sourceCutEnd = clip.sourceIn + (relativeCutEnd / clipDuration) * sourceDuration

          // Only keep the part after the cut
          const remainingPart: TimelineClip = {
            ...clip,
            id: `${clip.id}_after_${Date.now()}`,
            timelineStart: cutStartTime, // Shifted to cut start
            timelineEnd: clip.timelineEnd - cutDuration,
            sourceIn: sourceCutEnd,
          }

          updated.push(remainingPart)
        }
        // Case 3: Cut starts within clip but ends after clip
        else if (cutStartTime > clip.timelineStart && cutStartTime < clip.timelineEnd && cutEndTime >= clip.timelineEnd) {
          const clipDuration = clip.timelineEnd - clip.timelineStart
          const sourceDuration = clip.sourceOut - clip.sourceIn
          const relativeCutStart = cutStartTime - clip.timelineStart
          const sourceCutStart = clip.sourceIn + (relativeCutStart / clipDuration) * sourceDuration

          // Only keep the part before the cut
          const remainingPart: TimelineClip = {
            ...clip,
            id: `${clip.id}_before_${Date.now()}`,
            timelineEnd: cutStartTime,
            sourceOut: sourceCutStart,
          }

          updated.push(remainingPart)
        }
        // Case 4: Cut entirely contains the clip - remove it completely
        else if (cutStartTime <= clip.timelineStart && cutEndTime >= clip.timelineEnd) {
          // Don't add this clip - it's completely removed
        }
      })

      return updated
    })

    // Remove the segment corresponding to the selected word (updates sceneTakes)
    handleRemoveSegment(sceneTake, selectedText.start, selectedText.end)

    // Also create a cut for visualization/strikethrough
    const sceneRelativeStart = selectedText.start - sceneTake.startTime
    const sceneRelativeEnd = selectedText.end - sceneTake.startTime

    const newCut: VideoCut = {
      id: Date.now().toString(),
      start: sceneRelativeStart,
      end: sceneRelativeEnd,
    }

    setCuts(prevCuts => {
      const sceneCuts = prevCuts.get(selectedText.sceneId) || []
      return new Map(prevCuts.set(selectedText.sceneId, [...sceneCuts, newCut]))
    })
    setSelectedText(null)

    // Clear selection
    window.getSelection()?.removeAllRanges()

    // Save to history after cut is created
    setTimeout(() => saveToHistory(), 0)
    // Explicitly save edit data after cut is created
    setTimeout(() => {
      saveEditData()
    }, 0)
  }, [selectedText, sceneTakes, handleRemoveSegment, transcripts, timelineClips, saveToHistory, saveEditData])



  // Delete cut
  const handleDeleteCut = useCallback((cutId: string, sceneId: string) => {
    const sceneCuts = cuts.get(sceneId) || []
    const updatedCuts = new Map(cuts)
    updatedCuts.set(sceneId, sceneCuts.filter(c => c.id !== cutId))
    setCuts(updatedCuts)
    // Explicitly save edit data after cut is deleted
    setTimeout(() => {
      saveEditData()
    }, 0)
  }, [cuts, saveEditData])

  // ========== NEW CLIP-BASED EDITING FUNCTIONS ==========

  // Move layout clip - drag horizontally
  const handleStartMoveLayoutClip = useCallback((layoutClipId: string, mouseX: number) => {
    const layoutClip = layoutClips.find(lc => lc.id === layoutClipId)
    if (!layoutClip) return

    setDraggingLayoutClipId(layoutClipId)
    const timelineContainer = document.querySelector('[data-timeline-container]') as HTMLElement
    if (!timelineContainer) return

    const containerRect = timelineContainer.getBoundingClientRect()
    const initialMouseX = mouseX - containerRect.left
    const initialMouseTime = initialMouseX / timelineZoom

    // Calculate the offset from the drag start to the clip start
    const dragOffset = initialMouseTime - layoutClip.timelineStart

    // Set up smooth dragging
    const handleMouseMove = (e: MouseEvent) => {
      const rect = timelineContainer.getBoundingClientRect()
      const x = e.clientX - rect.left
      const currentMouseTime = x / timelineZoom

      // Calculate new start time based on mouse position and original offset
      const newStartTime = Math.max(0, currentMouseTime - dragOffset)
      const clipDuration = layoutClip.timelineEnd - layoutClip.timelineStart
      const newEndTime = newStartTime + clipDuration

      setLayoutClips(prev => prev.map(lc => {
        if (lc.id === layoutClipId) {
          return {
            ...lc,
            timelineStart: newStartTime,
            timelineEnd: newEndTime
          }
        }
        return lc
      }))
    }

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      setDraggingLayoutClipId(null)
      saveToHistory()
      // Explicitly save edit data after moving completes
      setTimeout(() => {
        saveEditData()
      }, 0)
    }

    document.addEventListener('mousemove', handleMouseMove, { passive: true })
    document.addEventListener('mouseup', handleMouseUp)
  }, [layoutClips, timelineZoom, saveToHistory, saveEditData])

  // Trim layout clip - drag edges
  const handleStartTrimLayoutClip = useCallback((layoutClipId: string, edge: 'in' | 'out', mouseX: number) => {
    const layoutClip = layoutClips.find(lc => lc.id === layoutClipId)
    if (!layoutClip) return

    setTrimmingLayoutClipId(layoutClipId)
    setTrimmingLayoutEdge(edge)

    const timelineContainer = document.querySelector('[data-timeline-container]') as HTMLElement
    if (!timelineContainer) return
    const containerRect = timelineContainer.getBoundingClientRect()

    // Calculate initial offset from the edge to the mouse
    const initialMouseX = mouseX - containerRect.left
    const initialMouseTime = initialMouseX / timelineZoom
    const initialEdgeTime = edge === 'in' ? layoutClip.timelineStart : layoutClip.timelineEnd
    const offsetFromEdge = initialMouseTime - initialEdgeTime

    // Set up smooth trimming - edge follows mouse directly
    const handleMouseMove = (e: MouseEvent) => {
      const rect = timelineContainer.getBoundingClientRect()
      const x = e.clientX - rect.left
      const currentMouseTime = x / timelineZoom

      setLayoutClips(prev => {
        const currentClip = prev.find(c => c.id === layoutClipId)
        if (!currentClip) return prev

        if (edge === 'in') {
          // Edge follows mouse directly, accounting for initial offset
          let newTimelineStart = currentMouseTime - offsetFromEdge
          newTimelineStart = Math.max(0, Math.min(newTimelineStart, currentClip.timelineEnd - 0.1))

          return prev.map(lc => 
            lc.id === layoutClipId 
              ? { ...lc, timelineStart: newTimelineStart }
              : lc
          )
        } else {
          // Edge follows mouse directly, accounting for initial offset
          let newTimelineEnd = currentMouseTime - offsetFromEdge
          newTimelineEnd = Math.max(currentClip.timelineStart + 0.1, newTimelineEnd)

          return prev.map(lc => 
            lc.id === layoutClipId 
              ? { ...lc, timelineEnd: newTimelineEnd }
              : lc
          )
        }
      })
    }

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      setTrimmingLayoutClipId(null)
      setTrimmingLayoutEdge(null)
      saveToHistory()
      // Explicitly save edit data after trimming completes
      setTimeout(() => {
        saveEditData()
      }, 0)
    }

    document.addEventListener('mousemove', handleMouseMove, { passive: true })
    document.addEventListener('mouseup', handleMouseUp)
  }, [layoutClips, timelineZoom, saveToHistory, saveEditData])

  // Split layout clip at timeline position
  const handleSplitLayoutClip = useCallback((cutTime: number) => {
    const layoutClip = layoutClips.find(lc => 
      cutTime >= lc.timelineStart && cutTime < lc.timelineEnd
    )
    
    if (!layoutClip) return
    
    // Create two new layout clips
    const firstPart: LayoutClip = {
      ...layoutClip,
      id: `${layoutClip.id}_part1_${Date.now()}`,
      timelineEnd: cutTime,
      holders: JSON.parse(JSON.stringify(layoutClip.holders))
    }
    
    const secondPart: LayoutClip = {
      ...layoutClip,
      id: `${layoutClip.id}_part2_${Date.now()}`,
      timelineStart: cutTime,
      holders: JSON.parse(JSON.stringify(layoutClip.holders))
    }
    
    setLayoutClips(prev => {
      const updated = prev.filter(lc => lc.id !== layoutClip.id)
      updated.push(firstPart, secondPart)
      return updated.sort((a, b) => a.timelineStart - b.timelineStart)
    })
    
    saveToHistory()
    markAsEdited()
    // Explicitly save edit data after splitting layout clip
    setTimeout(() => {
      saveEditData()
    }, 0)
  }, [layoutClips, saveToHistory, saveEditData, markAsEdited])

  // Cut clip - split at timeline position
  const handleCutClip = useCallback((clipId: string | null, cutTime: number) => {
    // Check if a layout clip is selected
    if (selectedLayoutClipIds.size > 0) {
      // Only cut the selected layout clip(s)
      selectedLayoutClipIds.forEach(layoutClipId => {
        const layoutClip = layoutClips.find(lc => lc.id === layoutClipId)
        if (layoutClip && cutTime > layoutClip.timelineStart && cutTime < layoutClip.timelineEnd) {
          handleSplitLayoutClip(cutTime)
        }
      })
      return
    }

    // Check if a video clip is selected
    if (selectedClipIds.size > 0 && clipId) {
    const mainClip = timelineClips.find(c => c.id === clipId)
    if (!mainClip) return

      // Find all linked clips (same scene/take) that overlap with the cut time
    const linkedClips = timelineClips.filter(c =>
      c.sceneId === mainClip.sceneId && c.takeId === mainClip.takeId &&
      cutTime > c.timelineStart && cutTime < c.timelineEnd
    )

    if (linkedClips.length === 0) return

    setTimelineClips(prev => {
      let updated = [...prev]

      linkedClips.forEach(clip => {
        // Calculate relative position within click
        const relativeTime = cutTime - clip.timelineStart
        const clipDuration = clip.timelineEnd - clip.timelineStart

        // Calculate source time at cut point
        const sourceTimeAtCut = clip.sourceIn + (relativeTime / clipDuration) * (clip.sourceOut - clip.sourceIn)

        const clip1: TimelineClip = {
          ...clip,
          id: `${clip.id}_part1_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          timelineEnd: cutTime,
          sourceOut: sourceTimeAtCut,
        }

        const clip2: TimelineClip = {
          ...clip,
          id: `${clip.id}_part2_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          timelineStart: cutTime,
          sourceIn: sourceTimeAtCut,
        }

          // Replace original clip with two new clips
          const clipIndex = updated.findIndex(c => c.id === clip.id)
          if (clipIndex >= 0) {
            updated.splice(clipIndex, 1, clip1, clip2)
          }
        })

        return updated.sort((a, b) => {
          if (a.timelineStart !== b.timelineStart) return a.timelineStart - b.timelineStart
          // Layer order: camera/screen first, then microphone
          const layerOrder = { 'camera': 0, 'screen': 1, 'microphone': 2 }
          return (layerOrder[a.layer] || 0) - (layerOrder[b.layer] || 0)
        })
      })

      // If cutting a video layer (camera or screen), also cut the corresponding audio layer
      if (mainClip.layer === 'camera' || mainClip.layer === 'screen') {
        const audioClip = timelineClips.find(c =>
          c.sceneId === mainClip.sceneId &&
          c.takeId === mainClip.takeId &&
          c.layer === 'microphone' &&
          cutTime > c.timelineStart &&
          cutTime < c.timelineEnd
        )
        
        if (audioClip) {
          // Cut the audio clip at the same time
          setTimelineClips(prev => {
            let updated = [...prev]
            const relativeTime = cutTime - audioClip.timelineStart
            const clipDuration = audioClip.timelineEnd - audioClip.timelineStart
            const sourceTimeAtCut = audioClip.sourceIn + (relativeTime / clipDuration) * (audioClip.sourceOut - audioClip.sourceIn)

            const audioClip1: TimelineClip = {
              ...audioClip,
              id: `${audioClip.id}_part1_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
              timelineEnd: cutTime,
              sourceOut: sourceTimeAtCut,
            }

            const audioClip2: TimelineClip = {
              ...audioClip,
              id: `${audioClip.id}_part2_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
              timelineStart: cutTime,
              sourceIn: sourceTimeAtCut,
            }

            const clipIndex = updated.findIndex(c => c.id === audioClip.id)
            if (clipIndex >= 0) {
              updated.splice(clipIndex, 1, audioClip1, audioClip2)
            }

            return updated.sort((a, b) => {
              if (a.timelineStart !== b.timelineStart) return a.timelineStart - b.timelineStart
              const layerOrder = { 'camera': 0, 'screen': 1, 'microphone': 2 }
              return (layerOrder[a.layer] || 0) - (layerOrder[b.layer] || 0)
            })
          })
        }
      }
      
      saveToHistory()
      markAsEdited()
      // Explicitly save edit data after cutting clips (including audio)
      // Use a small delay to ensure all state updates complete
      setTimeout(() => {
        saveEditData()
      }, 100)
      return
    }

    // No clip selected - cut all layers at the cut time
    // Cut layout clips
    handleSplitLayoutClip(cutTime)
    
    // Cut all video clips at this time
    const clipsToCut = timelineClips.filter(c =>
      cutTime > c.timelineStart && cutTime < c.timelineEnd
    )

    if (clipsToCut.length > 0) {
      setTimelineClips(prev => {
        let updated = [...prev]

        clipsToCut.forEach(clip => {
          const relativeTime = cutTime - clip.timelineStart
          const clipDuration = clip.timelineEnd - clip.timelineStart
          const sourceTimeAtCut = clip.sourceIn + (relativeTime / clipDuration) * (clip.sourceOut - clip.sourceIn)

          const clip1: TimelineClip = {
            ...clip,
            id: `${clip.id}_part1_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            timelineEnd: cutTime,
            sourceOut: sourceTimeAtCut,
          }

          const clip2: TimelineClip = {
            ...clip,
            id: `${clip.id}_part2_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            timelineStart: cutTime,
            sourceIn: sourceTimeAtCut,
          }

          const clipIndex = updated.findIndex(c => c.id === clip.id)
          if (clipIndex >= 0) {
            updated.splice(clipIndex, 1, clip1, clip2)
          }
        })

        return updated.sort((a, b) => {
          if (a.timelineStart !== b.timelineStart) return a.timelineStart - b.timelineStart
          const layerOrder = { 'camera': 0, 'screen': 1, 'microphone': 2 }
          return (layerOrder[a.layer] || 0) - (layerOrder[b.layer] || 0)
        })
      })

      saveToHistory()
      markAsEdited()
      // Explicitly save edit data after cutting all clips
      setTimeout(() => {
        saveEditData()
      }, 0)
    }
  }, [timelineClips, layoutClips, selectedClipIds, selectedLayoutClipIds, handleSplitLayoutClip, saveToHistory, markAsEdited, saveEditData])

  // Move clip - drag horizontally (Linked)
  const handleStartMoveClip = useCallback((clipId: string, mouseX: number) => {
    const mainClip = timelineClips.find(c => c.id === clipId)
    if (!mainClip) return

    setDraggingClipId(clipId)
    const timelineContainer = document.querySelector('[data-timeline-container]') as HTMLElement
    if (!timelineContainer) return

    const containerRect = timelineContainer.getBoundingClientRect()
    const initialMouseX = mouseX - containerRect.left
    const initialMouseTime = initialMouseX / timelineZoom

    // Calculate the offset from the drag start to the clip start
    // This ensures we keep the mouse relative to the clip start
    const dragOffset = initialMouseTime - mainClip.timelineStart
    setDraggingOffset(dragOffset)

    // Set up smooth dragging
    const handleMouseMove = (e: MouseEvent) => {
      const rect = timelineContainer.getBoundingClientRect()
      const x = e.clientX - rect.left
      const currentMouseTime = x / timelineZoom

      // Calculate new start time based on mouse position and original offset
      const newStartTime = Math.max(0, currentMouseTime - dragOffset)

      setTimelineClips(prev => {
        // Find the current state of the main clip
        const currentMainClip = prev.find(c => c.id === clipId)
        if (!currentMainClip) return prev

        return prev.map(c => {
          // Check for linked clips (Same Scene/Take AND Same Timeline Position)
          // Use current state for comparison
          const isLinked = c.sceneId === currentMainClip.sceneId &&
            c.takeId === currentMainClip.takeId &&
            Math.abs(c.timelineStart - currentMainClip.timelineStart) < 0.1 &&
            Math.abs(c.timelineEnd - currentMainClip.timelineEnd) < 0.1

          if (isLinked) {
            const clipDuration = c.timelineEnd - c.timelineStart
            return {
              ...c,
              timelineStart: newStartTime,
              timelineEnd: newStartTime + clipDuration
            }
          }
          return c
        })
      })

      // Update total duration (simplified)
      // setTotalDuration(...) - handled in effect usually or we accept slight delay
    }

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      setDraggingClipId(null)
      setDraggingOffset(0)
      // Save to history after drag completes
      setTimeout(() => saveToHistory(), 0)
    }

    document.addEventListener('mousemove', handleMouseMove, { passive: true })
    document.addEventListener('mouseup', handleMouseUp)
  }, [timelineClips, timelineZoom])

  // Trim clip - drag edges (Linked)
  const handleStartTrimClip = useCallback((clipId: string, edge: 'in' | 'out', mouseX: number) => {
    const mainClip = timelineClips.find(c => c.id === clipId)
    if (!mainClip) return

    setTrimmingClipId(clipId)
    setTrimmingEdge(edge)

    const timelineContainer = document.querySelector('[data-timeline-container]') as HTMLElement
    if (!timelineContainer) return
    const containerRect = timelineContainer.getBoundingClientRect()

    // Calculate initial offset from the edge to the mouse
    const initialMouseX = mouseX - containerRect.left
    const initialMouseTime = initialMouseX / timelineZoom
    const initialEdgeTime = edge === 'in' ? mainClip.timelineStart : mainClip.timelineEnd
    const headerOffset = initialMouseTime - initialEdgeTime

    // Set up smooth trimming
    const handleMouseMove = (e: MouseEvent) => {
      const rect = timelineContainer.getBoundingClientRect()
      const x = e.clientX - rect.left
      const currentMouseTime = x / timelineZoom

      // Calculate total delta from initial click
      const totalDelta = currentMouseTime - initialMouseTime

      setTimelineClips(prev => {
        // Find the current state of the main clip
        const currentMainClip = prev.find(c => c.id === clipId)
        if (!currentMainClip) return prev

        return prev.map(c => {
          // Check for linked clips - use current state for comparison
          const isLinked = c.sceneId === currentMainClip.sceneId &&
            c.takeId === currentMainClip.takeId &&
            Math.abs(c.timelineStart - currentMainClip.timelineStart) < 0.1 &&
            Math.abs(c.timelineEnd - currentMainClip.timelineEnd) < 0.1

          if (isLinked) {
            const maxDuration = c.sourceDuration || 10000

            if (edge === 'in') {
              // Changing Start
              // New Start = Current Start + Total Delta (use current state, not initial)
              // But clamped by: 0 <= NewStart <= CurrentEnd - 0.1
              let newTimelineStart = currentMainClip.timelineStart + totalDelta
              newTimelineStart = Math.max(0, Math.min(newTimelineStart, currentMainClip.timelineEnd - 0.1))

              // Calculate effective delta (might be clamped)
              const effectiveDelta = newTimelineStart - currentMainClip.timelineStart

              // New Source In = Current Source In + effective delta
              let newSourceIn = currentMainClip.sourceIn + effectiveDelta

              // Clamp Source In to be >= 0 and < sourceOut
              if (newSourceIn < 0) {
                newSourceIn = 0
                newTimelineStart = currentMainClip.timelineStart - currentMainClip.sourceIn // The time corresponding to source 0
              }
              if (newSourceIn >= currentMainClip.sourceOut) {
                newSourceIn = Math.max(0, currentMainClip.sourceOut - 0.1)
                newTimelineStart = currentMainClip.timelineStart + (currentMainClip.sourceIn - newSourceIn)
              }

              // Recalculate timelineEnd based on actual clip duration
              const clipDuration = currentMainClip.sourceOut - newSourceIn
              const newTimelineEnd = newTimelineStart + clipDuration

              return {
                ...c,
                timelineStart: newTimelineStart,
                timelineEnd: newTimelineEnd,
                sourceIn: newSourceIn,
              }
            } else {
              // Changing End
              // New End = Current End + Total Delta (use current state, not initial)
              // Clamped by: Start + 0.1 <= New End <= Total Duration (optional)
              let newTimelineEnd = currentMainClip.timelineEnd + totalDelta
              newTimelineEnd = Math.max(currentMainClip.timelineStart + 0.1, newTimelineEnd)

              // Calculate effective delta
              const effectiveDelta = newTimelineEnd - currentMainClip.timelineEnd

              // New Source Out = Current Source Out + effective delta
              let newSourceOut = currentMainClip.sourceOut + effectiveDelta

              // Clamp Source Out <= Max Duration (sourceDuration)
              if (newSourceOut > maxDuration) {
                newSourceOut = maxDuration
                // Recalculate timelineEnd based on actual clip duration
                const clipDuration = newSourceOut - currentMainClip.sourceIn
                newTimelineEnd = currentMainClip.timelineStart + clipDuration
              } else {
                // Recalculate timelineEnd based on actual clip duration
                const clipDuration = newSourceOut - currentMainClip.sourceIn
                newTimelineEnd = currentMainClip.timelineStart + clipDuration
              }

              return {
                ...c,
                timelineEnd: newTimelineEnd,
                sourceOut: newSourceOut
                // Start remains same
              }
            }
          }
          return c
        })
      })
    }

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      setTrimmingClipId(null)
      setTrimmingEdge(null)
      setTrimmingStartPos(0)
      // Save to history after trim completes
      setTimeout(() => saveToHistory(), 0)
    }

    document.addEventListener('mousemove', handleMouseMove, { passive: true })
    document.addEventListener('mouseup', handleMouseUp)

    // Initial state for UI feedback if needed
    // const rect = timelineContainer.getBoundingClientRect()
    // const clickX = mouseX - rect.left
    // const clickTime = clickX / timelineZoom
    // setTrimmingStartPos(clickTime)
  }, [timelineClips, timelineZoom, totalDuration])

  // Handle clip click - select linked clips
  const handleClipClick = useCallback((clipId: string, clickTime: number) => {
    if (timelineTool === 'cut') {
      handleCutClip(clipId, clickTime)
    } else {
      // Select tool - deselect all others and select only the clicked clip (and linked clips)
      const clickedClip = timelineClips.find(c => c.id === clipId)

        if (clickedClip) {
          // Select only vertically linked clips (same scene/take AND same position)
          const linked = timelineClips.filter(c =>
            c.sceneId === clickedClip.sceneId &&
            c.takeId === clickedClip.takeId &&
            Math.abs(c.timelineStart - clickedClip.timelineStart) < 0.1 &&
            Math.abs(c.timelineEnd - clickedClip.timelineEnd) < 0.1
          )

        // Deselect all clips, then select only the linked ones
        setSelectedClipIds(new Set(linked.map(lc => lc.id)))
        // Deselect layout clips when selecting video clips
        setSelectedLayoutClipIds(new Set())

        setSelectedClip({
          sceneId: clickedClip.sceneId,
          takeId: clickedClip.takeId,
          layer: clickedClip.layer,
        })
        setActiveTab('clip')
      }
    }
  }, [timelineTool, timelineClips, handleCutClip])


  // Split a sceneTake at a given absolute time point
  const handleSplitSceneTake = useCallback((sceneTake: SceneTake, splitTime: number) => {
    // Calculate relative time within the sceneTake
    const relativeTime = splitTime - sceneTake.startTime
    const sceneDuration = sceneTake.endTime - sceneTake.startTime

    // Don't split if too close to edges
    if (relativeTime <= 0.1 || relativeTime >= sceneDuration - 0.1) {
      return
    }

    // Calculate the split point in the original video time (accounting for trims)
    const videoSplitTime = sceneTake.trimmedStart + relativeTime

    // Create first part: from start to split point
    const firstPart: SceneTake = {
      ...sceneTake,
      startTime: sceneTake.startTime,
      endTime: splitTime,
      trimmedStart: sceneTake.trimmedStart,
      trimmedEnd: sceneTake.take.duration - videoSplitTime,
    }

    // Create second part: from split point to end (starts right after first part)
    const secondPart: SceneTake = {
      ...sceneTake,
      startTime: splitTime,
      endTime: sceneTake.endTime,
      trimmedStart: videoSplitTime,
      trimmedEnd: sceneTake.trimmedEnd,
    }

    // Update sceneTakes: replace the original with the two parts
    setSceneTakes(prev => {
      const newTakes: SceneTake[] = []

      prev.forEach(st => {
        // Check if this is the sceneTake we're splitting
        // We need to match by sceneId, take.id, and time range
        if (st.sceneId === sceneTake.sceneId &&
          st.take.id === sceneTake.take.id &&
          Math.abs(st.startTime - sceneTake.startTime) < 0.01 &&
          Math.abs(st.endTime - sceneTake.endTime) < 0.01) {
          // Replace this sceneTake with the two parts
          newTakes.push(firstPart)
          newTakes.push(secondPart)
        } else {
          // Keep other sceneTakes as-is (no time adjustment needed since we're not removing time)
          newTakes.push(st)
        }
      })

      // Recalculate total duration (should remain the same since we're not removing time)
      const maxEnd = Math.max(...newTakes.map(st => st.endTime), 0)
      setTotalDuration(Math.max(maxEnd, 1))

      return newTakes
    })
  }, [])

  // OLD FUNCTION - REPLACED BY NEW CLIP-BASED SYSTEM ABOVE

  const handleDeleteSelectedClips = () => {
    setTimelineClips(prev => prev.filter(c => !selectedClipIds.has(c.id)))
    setSelectedClipIds(new Set())
    setSelectedClip(null)
  }

  const handleDeleteSelectedLayoutClips = useCallback(() => {
    setLayoutClips(prev => prev.filter(lc => !selectedLayoutClipIds.has(lc.id)))
    setSelectedLayoutClipIds(new Set())
    saveToHistory()
    // Explicitly save edit data after deletion completes
    setTimeout(() => {
      saveEditData()
    }, 0)
  }, [selectedLayoutClipIds, saveToHistory, saveEditData])

  // Handle keyboard delete key to create cuts from selected words OR delete selected clips
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // If text is selected in transcript, prioritize that
        if (selectedText) {
          e.preventDefault()
          handleCreateCut()
        }
        // Otherwise if layout clips are selected, delete them
        else if (selectedLayoutClipIds.size > 0) {
          e.preventDefault()
          handleDeleteSelectedLayoutClips()
        }
        // Otherwise if video clips are selected, delete them
        else if (selectedClipIds.size > 0) {
          e.preventDefault()
          handleDeleteSelectedClips()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [selectedText, selectedClipIds, handleCreateCut, handleDeleteSelectedClips])

  // OLD TRIMMING STATE - REMOVED (now using clip-based trimming with trimmingClipId)

  // OLD TRIMMING FUNCTIONS - REMOVED (now using handleStartTrimClip which handles all trimming internally)
  // OLD TRIMMING FUNCTIONS REMOVED - Now using clip-based trimming system

  // Video controls
  const handlePlayPause = () => {
    const video = videoRef.current
    const audio = audioRef.current

    // Ensure we have a valid scene loaded
    if (!currentSceneTake) {
      if (sceneTakes.length > 0) {
        setSelectedSceneIndex(0)
        // Wait a bit for scene to load, then play
        setTimeout(() => {
          const v = videoRef.current
          const a = audioRef.current
          if (v && v.readyState >= 2) {
            v.play().catch(err => console.error('Error playing video:', err))
            if (a && a.readyState >= 2) {
              a.currentTime = v.currentTime
              a.play().catch(err => console.error('Error playing audio:', err))
            }
          }
        }, 200)
      }
      return
    }

    if (!video || video.readyState < 2) {
      console.warn('Video not ready for playback')
      return
    }

    if (isPlaying) {
      video.pause()
      if (audio) audio.pause()
      setIsPlaying(false)
    } else {
      // Ensure we're at the correct position before playing
      const result = timelineToVideoTime(currentTime)
      if (result) {
        const { videoTime, sceneId, takeId } = result
        const sceneIndex = sceneTakes.findIndex(st =>
          st.sceneId === sceneId && st.take.id === takeId
        )
        if (sceneIndex >= 0 && sceneIndex !== selectedSceneIndex) {
          setSelectedSceneIndex(sceneIndex)
          setTimeout(() => {
            const v = videoRef.current
            const a = audioRef.current
            if (v && v.readyState >= 2) {
              v.currentTime = videoTime
              v.play().catch(err => console.error('Error playing video:', err))
              if (a && a.readyState >= 2) {
                a.currentTime = videoTime
                a.play().catch(err => console.error('Error playing audio:', err))
              }
            }
          }, 100)
        } else {
          if (video.readyState >= 2) {
            video.currentTime = videoTime
          }
          video.play().catch(err => console.error('Error playing video:', err))
          if (audio && audio.readyState >= 2) {
            audio.currentTime = videoTime
            audio.play().catch(err => console.error('Error playing audio:', err))
          }
        }
      } else {
        // Fallback: just play from current position
        video.play().catch(err => console.error('Error playing video:', err))
        if (audio) {
          audio.currentTime = video.currentTime
          audio.play().catch(err => console.error('Error playing audio:', err))
        }
      }
    }
  }



  const formatTime = (seconds: number) => {
    // Handle invalid values
    if (!Number.isFinite(seconds) || seconds < 0) {
      return '00:00.0'
    }
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    const ms = Math.floor((seconds % 1) * 10)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms}`
  }

  // Initialize layout clips when timeline clips are created
  useEffect(() => {
    if (timelineClips.length > 0 && layoutClips.length === 0) {
      // Create initial layout clip covering entire timeline
      const initialLayoutClip: LayoutClip = {
        id: `layout_initial_${Date.now()}`,
        timelineStart: 0,
        timelineEnd: totalDuration || 1,
        holders: JSON.parse(JSON.stringify(canvasHolders))
      }
      setLayoutClips([initialLayoutClip])
    }
  }, [timelineClips, totalDuration, canvasHolders, layoutClips.length])

  // Layout management
  const handleLayoutChange = (newLayout: Layout) => {
    setLayout(newLayout)
    
    // If it's a custom layout with positions, apply to current layout clip
    if (newLayout.type === 'custom' && (newLayout.cameraPosition || newLayout.screenPosition)) {
      const currentLayoutClip = getCurrentLayoutClip(currentTime)
      if (currentLayoutClip) {
        setLayoutClips(prev => prev.map(lc => {
          if (lc.id === currentLayoutClip.id) {
            const updatedHolders = lc.holders.map(holder => {
              if (holder.layer === 'camera' && newLayout.cameraPosition) {
                return {
                  ...holder,
                  x: newLayout.cameraPosition.x,
                  y: newLayout.cameraPosition.y,
                  width: newLayout.cameraPosition.width,
                  height: newLayout.cameraPosition.height
                }
              } else if (holder.layer === 'screen' && newLayout.screenPosition) {
                return {
                  ...holder,
                  x: newLayout.screenPosition.x,
                  y: newLayout.screenPosition.y,
                  width: newLayout.screenPosition.width,
                  height: newLayout.screenPosition.height
                }
              }
              return holder
            })
            return { ...lc, holders: updatedHolders }
          }
          return lc
        }))
        // Canvas holders are now derived from layout clips, so they're automatically updated
      }
    }
  }

  const handleSaveLayout = () => {
    const currentLayoutClip = getCurrentLayoutClip(currentTime)
    if (currentLayoutClip) {
      const templateLayout: Layout = {
        type: 'custom',
        name: currentLayoutClip.name || `Layout ${Date.now()}`,
        cameraPosition: currentLayoutClip.holders.find(h => h.layer === 'camera') 
          ? { 
              x: currentLayoutClip.holders.find(h => h.layer === 'camera')!.x,
              y: currentLayoutClip.holders.find(h => h.layer === 'camera')!.y,
              width: currentLayoutClip.holders.find(h => h.layer === 'camera')!.width,
              height: currentLayoutClip.holders.find(h => h.layer === 'camera')!.height
            }
          : undefined,
        screenPosition: currentLayoutClip.holders.find(h => h.layer === 'screen')
          ? {
              x: currentLayoutClip.holders.find(h => h.layer === 'screen')!.x,
              y: currentLayoutClip.holders.find(h => h.layer === 'screen')!.y,
              width: currentLayoutClip.holders.find(h => h.layer === 'screen')!.width,
              height: currentLayoutClip.holders.find(h => h.layer === 'screen')!.height
            }
          : undefined
      }
      if (templateLayout.name && !savedLayouts.find(l => l.name === templateLayout.name)) {
        setSavedLayouts([...savedLayouts, templateLayout])
      }
    } else if (layout.type === 'custom' && layout.name) {
      setSavedLayouts([...savedLayouts, layout])
    }
  }

  // Export
  const handleExport = async () => {
    if (sceneTakes.length === 0) {
      alert('No scenes with selected takes')
      return
    }

    // Determine which scenes to export
    const scenesToExport = selectedScenesForExport.size > 0
      ? sceneTakes.filter(st => selectedScenesForExport.has(st.sceneId))
      : sceneTakes // Export all if none selected

    if (scenesToExport.length === 0) {
      alert('Please select at least one scene to export')
      return
    }

    // Check if FFmpeg is ready
    if (!ffmpegReady) {
      if (ffmpegLoading) {
        alert('FFmpeg is still loading. Please wait...')
        return
      } else if (ffmpegError) {
        alert(`FFmpeg failed to load: ${ffmpegError}. Please refresh the page and try again.`)
        return
      } else {
        alert('FFmpeg is not ready. Please wait a moment and try again.')
        return
      }
    }

    setIsExporting(true)
    setExportProgress('Starting export...')
    setExportProgressPercent(0)

    // Set up FFmpeg log listener for frame progress tracking
    let currentFrameCount = 0
    let totalFrames = 0
    let currentSceneIndex = 0
    let currentSceneDuration = 0
    const frameRate = 60 // 60fps as per code

    const logHandler = ({ message }: { message: string }) => {
      // Parse frame count from FFmpeg log: "frame= 89 fps= 11 q=26.0..."
      const frameMatch = message.match(/frame=\s*(\d+)/)
      if (frameMatch) {
        const frameNum = parseInt(frameMatch[1], 10)
        currentFrameCount = frameNum
        
        // Calculate progress if we have total frames
        if (totalFrames > 0 && currentSceneDuration > 0) {
          // Progress for current scene
          const sceneProgress = Math.min(frameNum / (currentSceneDuration * frameRate), 1)
          // Overall progress across all scenes
          const overallProgress = (currentSceneIndex / scenesToExport.length) + (sceneProgress / scenesToExport.length)
          setExportProgressPercent(Math.min(overallProgress * 100, 99))
        }
      }
    }
    
    const ffmpeg = await getFFmpeg()
    ffmpeg.on('log', logHandler)

    // Add timeout to prevent getting stuck
    const exportTimeout = setTimeout(() => {
      setIsExporting(false)
      setExportProgress('')
      setExportProgressPercent(0)
      ffmpeg.off('log', logHandler)
      alert('Export is taking longer than expected. Please check the console for errors.')
    }, 300000) // 5 minute timeout

    try {
      // Process each scene: load, trim based on timeline clips, apply cuts, combine layers
      const processedSceneBlobs: Blob[] = []

      for (let i = 0; i < scenesToExport.length; i++) {
        const sceneTake = scenesToExport[i]
        setExportProgress(`Loading scene ${i + 1} of ${scenesToExport.length}...`)

        // Get timeline clips for this scene
        const sceneClips = timelineClips.filter(
          clip => clip.sceneId === sceneTake.sceneId
        )

        // Load and process each layer
        let sceneCameraBlob: Blob | null = null
        let sceneMicrophoneBlob: Blob | null = null
        let sceneScreenBlob: Blob | null = null

        // Load and trim camera
        if (sceneTake.take.hasCamera) {
          try {
            setExportProgress(`Loading camera for scene ${i + 1}...`)
            const cameraClip = sceneClips.find(c => c.layer === 'camera')
            if (cameraClip) {
              const originalBlob = await Promise.race([
                projectManager.loadRecording(
                  sceneTake.sceneId,
                  `${sceneTake.take.id}_camera`
                ),
                new Promise<Blob | null>((_, reject) => 
                  setTimeout(() => reject(new Error('Timeout loading camera recording')), 30000)
                )
              ])
              
              if (originalBlob && cameraClip.sourceIn < cameraClip.sourceOut) {
                setExportProgress(`Trimming camera for scene ${i + 1}...`)
                sceneCameraBlob = await Promise.race([
                  trimVideo(
                    originalBlob,
                    cameraClip.sourceIn,
                    cameraClip.sourceOut
                  ),
                  new Promise<Blob>((_, reject) => 
                    setTimeout(() => reject(new Error('Timeout trimming camera')), 60000)
                  )
                ])
              } else {
                sceneCameraBlob = originalBlob
              }
            }
          } catch (error) {
            console.error(`Error loading camera for scene ${i + 1}:`, error)
            setExportProgress(`Warning: Could not load camera for scene ${i + 1}`)
          }
        }

        // Load and trim microphone
        if (sceneTake.take.hasMicrophone) {
          try {
            setExportProgress(`Loading microphone for scene ${i + 1}...`)
            const micClip = sceneClips.find(c => c.layer === 'microphone')
            if (micClip) {
              const originalBlob = await Promise.race([
                projectManager.loadRecording(
                  sceneTake.sceneId,
                  `${sceneTake.take.id}_microphone`
                ),
                new Promise<Blob | null>((_, reject) => 
                  setTimeout(() => reject(new Error('Timeout loading microphone recording')), 30000)
                )
              ])
              
              if (originalBlob && micClip.sourceIn < micClip.sourceOut) {
                setExportProgress(`Trimming microphone for scene ${i + 1}...`)
                sceneMicrophoneBlob = await Promise.race([
                  trimVideo(
                    originalBlob,
                    micClip.sourceIn,
                    micClip.sourceOut
                  ),
                  new Promise<Blob>((_, reject) => 
                    setTimeout(() => reject(new Error('Timeout trimming microphone')), 60000)
                  )
                ])
              } else {
                sceneMicrophoneBlob = originalBlob
              }
            }
          } catch (error) {
            console.error(`Error loading microphone for scene ${i + 1}:`, error)
            setExportProgress(`Warning: Could not load microphone for scene ${i + 1}`)
          }
        }

        // Load and trim screen
        if (sceneTake.take.hasScreen) {
          try {
            setExportProgress(`Loading screen for scene ${i + 1}...`)
            const screenClip = sceneClips.find(c => c.layer === 'screen')
            if (screenClip) {
              const originalBlob = await Promise.race([
                projectManager.loadRecording(
                  sceneTake.sceneId,
                  `${sceneTake.take.id}_screen`
                ),
                new Promise<Blob | null>((_, reject) => 
                  setTimeout(() => reject(new Error('Timeout loading screen recording')), 30000)
                )
              ])
              
              if (originalBlob && screenClip.sourceIn < screenClip.sourceOut) {
                setExportProgress(`Trimming screen for scene ${i + 1}...`)
                sceneScreenBlob = await Promise.race([
                  trimVideo(
                    originalBlob,
                    screenClip.sourceIn,
                    screenClip.sourceOut
                  ),
                  new Promise<Blob>((_, reject) => 
                    setTimeout(() => reject(new Error('Timeout trimming screen')), 60000)
                  )
                ])
              } else {
                sceneScreenBlob = originalBlob
              }
            }
          } catch (error) {
            console.error(`Error loading screen for scene ${i + 1}:`, error)
            setExportProgress(`Warning: Could not load screen for scene ${i + 1}`)
          }
        }

        if (!sceneCameraBlob && !sceneScreenBlob) {
          console.warn(`No video to export for scene ${sceneTake.sceneId}`)
          setExportProgress(`Skipping scene ${i + 1}: No video available`)
          continue
        }

        // Get cuts for this scene (adjusted to trimmed timeline)
        const sceneCuts = cuts.get(sceneTake.sceneId) || []

        // Collect Audio Props for this scene
        const getSceneLayerProps = (layer: 'camera' | 'microphone' | 'screen') => {
          const key = `${sceneTake.sceneId}_${sceneTake.take.id}_${layer}`
          return clipProperties.get(key)
        }

        const audioProps = {
          camera: getSceneLayerProps('camera'),
          microphone: getSceneLayerProps('microphone'),
          screen: getSceneLayerProps('screen')
        }

        // Get layout clip for this scene's time range
        const sceneStartTime = sceneTake.startTime
        const sceneEndTime = sceneTake.endTime
        const sceneLayoutClip = layoutClips.find(lc => 
          lc.timelineStart <= sceneStartTime && lc.timelineEnd >= sceneEndTime
        ) || layoutClips[0] // Fallback to first layout clip
        
        // Convert layout clip to layout format for export
        // Layout positions in combineVideos expect percentages (0-100)
        const exportLayout: Layout = sceneLayoutClip ? {
          type: 'custom',
          cameraPosition: sceneLayoutClip.holders.find(h => h.layer === 'camera') ? {
            x: sceneLayoutClip.holders.find(h => h.layer === 'camera')!.x * 100,
            y: sceneLayoutClip.holders.find(h => h.layer === 'camera')!.y * 100,
            width: sceneLayoutClip.holders.find(h => h.layer === 'camera')!.width * 100,
            height: sceneLayoutClip.holders.find(h => h.layer === 'camera')!.height * 100,
          } : undefined,
          screenPosition: sceneLayoutClip.holders.find(h => h.layer === 'screen') ? {
            x: sceneLayoutClip.holders.find(h => h.layer === 'screen')!.x * 100,
            y: sceneLayoutClip.holders.find(h => h.layer === 'screen')!.y * 100,
            width: sceneLayoutClip.holders.find(h => h.layer === 'screen')!.width * 100,
            height: sceneLayoutClip.holders.find(h => h.layer === 'screen')!.height * 100,
          } : undefined,
        } : (layout.type === 'custom' ? layout : {
          type: 'camera-only' as const
        })

        // Combine layers with layout using canvas settings resolution
        setExportProgress(`Combining layers for scene ${i + 1}...`)
        try {
          // Get video duration for fade-out calculation (with timeout)
          let videoDuration = 0
          try {
            if (sceneCameraBlob) {
              setExportProgress(`Getting video duration for scene ${i + 1}...`)
              const video = document.createElement('video')
              video.preload = 'metadata'
              const videoUrl = URL.createObjectURL(sceneCameraBlob)
              video.src = videoUrl
              
              await new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => {
                  URL.revokeObjectURL(videoUrl)
                  reject(new Error('Timeout loading video metadata'))
                }, 5000) // 5 second timeout
                
                video.onloadedmetadata = () => {
                  clearTimeout(timeout)
                  videoDuration = video.duration || 0
                  URL.revokeObjectURL(videoUrl)
                  resolve()
                }
                video.onerror = () => {
                  clearTimeout(timeout)
                  URL.revokeObjectURL(videoUrl)
                  reject(new Error('Failed to load video metadata'))
                }
              })
            } else if (sceneScreenBlob) {
              setExportProgress(`Getting video duration for scene ${i + 1}...`)
              const video = document.createElement('video')
              video.preload = 'metadata'
              const videoUrl = URL.createObjectURL(sceneScreenBlob)
              video.src = videoUrl
              
              await new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => {
                  URL.revokeObjectURL(videoUrl)
                  reject(new Error('Timeout loading video metadata'))
                }, 5000) // 5 second timeout
                
                video.onloadedmetadata = () => {
                  clearTimeout(timeout)
                  videoDuration = video.duration || 0
                  URL.revokeObjectURL(videoUrl)
                  resolve()
                }
                video.onerror = () => {
                  clearTimeout(timeout)
                  URL.revokeObjectURL(videoUrl)
                  reject(new Error('Failed to load video metadata'))
                }
              })
            }
          } catch (durationError) {
            console.warn(`Could not get video duration for scene ${i + 1}, continuing without fade-out:`, durationError)
            // Continue without duration - fade-out will be skipped
          }
          
          setExportProgress(`Rendering scene ${i + 1}...`)
          currentSceneIndex = i
          currentSceneDuration = videoDuration || sceneTake.take.duration
          currentFrameCount = 0
          totalFrames = currentSceneDuration * frameRate
          
          const combinedBlob = await Promise.race([
            combineLayersWithLayout(
              sceneCameraBlob,
              sceneMicrophoneBlob,
              sceneScreenBlob,
              exportLayout,
              sceneCuts,
              audioProps,
              undefined, // captionData
              canvasSettings.resolution.width,
              canvasSettings.resolution.height,
              backgroundMusic.file || null,
              backgroundMusic.volume || 0.5,
              videoDuration
            ),
            new Promise<Blob>((_, reject) => 
              setTimeout(() => reject(new Error('Timeout combining layers (this may take a while for long videos)')), 300000) // 5 minute timeout
            )
          ])
          
          // If exporting separately, download this scene now
          if (exportMode === 'separate') {
            setExportProgress(`Finalizing scene ${i + 1}...`)
            let sceneBlob = combinedBlob
            
            // Convert to requested format if needed
            if (exportFormat === 'webm') {
              try {
                const ffmpegScene = await getFFmpeg()
                const inputFile = 'input_convert_scene.mp4'
                const outputFile = 'output_scene.webm'
                
                const inputData = await fetchFile(combinedBlob)
                await ffmpegScene.writeFile(inputFile, inputData)
                
                setExportProgress(`Converting scene ${i + 1} to WebM...`)
                await ffmpegScene.exec([
                  '-i', inputFile,
                  '-c:v', 'libvpx-vp9',
                  '-b:v', '2M',
                  '-c:a', 'libopus',
                  '-b:a', '192k',
                  outputFile
                ])
                
                const outputData = await ffmpegScene.readFile(outputFile)
                sceneBlob = outputData instanceof Uint8Array 
                  ? new Blob([outputData as BlobPart], { type: 'video/webm' })
                  : new Blob([outputData as any], { type: 'video/webm' })
                
                try {
                  await ffmpegScene.deleteFile(inputFile)
                  await ffmpegScene.deleteFile(outputFile)
                } catch (e) {
                  // Ignore cleanup errors
                }
              } catch (error) {
                console.warn(`WebM conversion failed for scene ${i + 1}, using MP4:`, error)
              }
            }
            
            // Download this scene
            const scene = scenes.find(s => s.id === sceneTake.sceneId)
            const sceneName = scene?.title || `Scene ${i + 1}`
            const finalFormat = exportFormat === 'webm' && sceneBlob.type === 'video/webm' ? 'webm' : 'mp4'
            const url = URL.createObjectURL(sceneBlob)
            const a = document.createElement('a')
            a.href = url
            a.download = `${sceneName}_${Date.now()}.${finalFormat}`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
            
            setExportProgress(`✓ Scene ${i + 1} exported`)
          } else {
            processedSceneBlobs.push(combinedBlob)
            setExportProgress(`✓ Scene ${i + 1} completed`)
          }
        } catch (error) {
          console.error(`Error combining layers for scene ${i + 1}:`, error)
          const errorMessage = error instanceof Error ? error.message : String(error)
          setExportProgress(`✗ Error in scene ${i + 1}: ${errorMessage}`)
          // Continue with other scenes instead of failing completely
          continue
        }

      }

      // If exporting separately, we're done (each scene was already downloaded)
      if (exportMode === 'separate') {
        setExportProgressPercent(100)
        clearTimeout(exportTimeout)
        ffmpeg.off('log', logHandler)
        setShowExportDialog(false)
        setIsExporting(false)
        setExportProgress('')
        setExportProgressPercent(0)
        return
      }

      // Combined export: concatenate all scenes
      if (processedSceneBlobs.length === 0) {
        alert('No video to export - all scenes failed to process')
        setIsExporting(false)
        setExportProgress('')
        setExportProgressPercent(0)
        ffmpeg.off('log', logHandler)
        return
      }

      // Concatenate all scenes if multiple
      setExportProgress('Concatenating scenes...')
      setExportProgressPercent(95)
      let finalBlob: Blob
      try {
        if (processedSceneBlobs.length === 1) {
          finalBlob = processedSceneBlobs[0]
        } else {
          finalBlob = await concatVideos(processedSceneBlobs)
        }
      } catch (error) {
        console.error('Error concatenating scenes:', error)
        throw new Error('Failed to concatenate scenes: ' + (error as Error).message)
      }

      // Convert to requested format if needed
      setExportProgress('Finalizing export...')
      setExportProgressPercent(98)
      let exportBlob = finalBlob
      
      if (exportFormat === 'webm') {
        // Convert MP4 to WebM using FFmpeg
        try {
          const inputFile = 'input_convert.mp4'
          const outputFile = 'output.webm'
          
          // Write input file
          const inputData = await fetchFile(finalBlob)
          await ffmpeg.writeFile(inputFile, inputData)
          
          setExportProgress('Converting to WebM...')
          await ffmpeg.exec([
            '-i', inputFile,
            '-c:v', 'libvpx-vp9',
            '-b:v', '2M',
            '-c:a', 'libopus',
            '-b:a', '192k',
            outputFile
          ])
          
          const outputData = await ffmpeg.readFile(outputFile)
          exportBlob = outputData instanceof Uint8Array 
            ? new Blob([outputData as BlobPart], { type: 'video/webm' })
            : new Blob([outputData as any], { type: 'video/webm' })
          
          // Cleanup
          try {
            await ffmpeg.deleteFile(inputFile)
            await ffmpeg.deleteFile(outputFile)
          } catch (e) {
            // Ignore cleanup errors
          }
        } catch (error) {
          console.warn('WebM conversion failed, using MP4:', error)
          setExportProgress('WebM conversion failed, using MP4 format')
          // Fallback to MP4 if conversion fails - keep original blob
        }
      }
      
      // Download video
      setExportProgress('Downloading...')
      setExportProgressPercent(100)
      const finalFormat = exportFormat === 'webm' && exportBlob.type === 'video/webm' ? 'webm' : 'mp4'
      const url = URL.createObjectURL(exportBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `export_${Date.now()}.${finalFormat}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      clearTimeout(exportTimeout)
      ffmpeg.off('log', logHandler)
      setShowExportDialog(false)
      setIsExporting(false)
      setExportProgress('')
      setExportProgressPercent(0)
    } catch (error) {
      clearTimeout(exportTimeout)
      try {
        ffmpeg.off('log', logHandler)
      } catch (e) {
        // Ignore if FFmpeg not available or already cleaned up
      }
      console.error('Export error:', error)
      alert('Export failed: ' + (error as Error).message)
      setIsExporting(false)
      setExportProgress('')
      setExportProgressPercent(0)
    }
  }

  // Export DaVinci Resolve timeline
  const handleExportDaVinci = () => {
    if (sceneTakes.length === 0) {
      alert('No scenes with selected takes')
      return
    }

    // Determine which scenes to export
    const scenesToExport = selectedScenesForExport.size > 0
      ? sceneTakes.filter(st => selectedScenesForExport.has(st.sceneId))
      : sceneTakes // Export all if none selected

    if (scenesToExport.length === 0) {
      alert('Please select at least one scene to export')
      return
    }

    // Calculate new timeline with only selected scenes
    let newStartTime = 0
    const adjustedSceneTakes = scenesToExport.map(st => {
      const adjusted = {
        ...st,
        startTime: newStartTime,
        endTime: newStartTime + st.take.duration,
      }
      newStartTime += st.take.duration
      return adjusted
    })
    const exportDuration = newStartTime

    // Combine transcripts from selected scenes
    const allWords: WordTimestamp[] = []
    adjustedSceneTakes.forEach(st => {
      const transcript = transcripts.get(st.sceneId)
      if (transcript) {
        // Adjust timestamps to new timeline
        const timeOffset = st.startTime - sceneTakes.find(ost => ost.sceneId === st.sceneId)!.startTime
        const adjustedWords = transcript.words.map(w => ({
          ...w,
          start: w.start + timeOffset,
          end: w.end + timeOffset,
        }))
        allWords.push(...adjustedWords)
      }
    })

    // For now, export first scene's files (in full implementation, would export all selected scenes)
    const firstScene = scenesToExport[0]
    const cameraFile = firstScene.take.hasCamera
      ? `${firstScene.sceneId}_${firstScene.take.id}_camera.webm`
      : null
    const microphoneFile = firstScene.take.hasMicrophone
      ? `${firstScene.sceneId}_${firstScene.take.id}_microphone.webm`
      : null
    const screenFile = firstScene.take.hasScreen
      ? `${firstScene.sceneId}_${firstScene.take.id}_screen.webm`
      : null

    // Combine cuts from selected scenes, adjusted to new timeline
    const allCuts: VideoCut[] = []
    adjustedSceneTakes.forEach(st => {
      const sceneCuts = cuts.get(st.sceneId) || []
      const originalSceneTake = sceneTakes.find(ost => ost.sceneId === st.sceneId)!
      const timeOffset = st.startTime - originalSceneTake.startTime

      sceneCuts.forEach(cut => {
        allCuts.push({
          ...cut,
          start: cut.start + st.startTime,
          end: cut.end + st.startTime,
        })
      })
    })

    const xml = exportDaVinciResolveTimeline(
      cameraFile,
      microphoneFile,
      screenFile,
      allCuts,
      layout,
      allWords,
      exportDuration
    )

    // Download XML
    const blob = new Blob([xml], { type: 'application/xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `timeline_${Date.now()}.fcpxml`
    a.click()
    URL.revokeObjectURL(url)

    setShowExportDialog(false)
  }

  // Toggle scene selection for export
  const toggleSceneSelection = (sceneId: string) => {
    const newSelection = new Set(selectedScenesForExport)
    if (newSelection.has(sceneId)) {
      newSelection.delete(sceneId)
    } else {
      newSelection.add(sceneId)
    }
    setSelectedScenesForExport(newSelection)
  }

  // Select all scenes
  const selectAllScenes = () => {
    setSelectedScenesForExport(new Set(sceneTakes.map(st => st.sceneId)))
  }

  // Deselect all scenes
  const deselectAllScenes = () => {
    setSelectedScenesForExport(new Set())
  }

  return (
    <>
    <div className="h-full flex flex-col bg-black text-white">
      <SettingsPanel isOpen={showSettings} onClose={() => setShowSettings(false)} />

      {/* Export Dialog */}
      {showExportDialog && (
        <>
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-50"
            onClick={() => !isExporting && setShowExportDialog(false)}
          />
          <div className="fixed inset-0 flex items-center justify-center z-50">
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 max-w-2xl w-full mx-4">
              <h3 className="text-lg font-semibold mb-4">Export Scenes</h3>
              <p className="text-sm text-gray-400 mb-4">
                Select which scenes to export. If none are selected, all scenes will be exported.
              </p>

              <div className="mb-4 flex gap-2">
                <button
                  onClick={selectAllScenes}
                  className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded text-sm"
                >
                  Select All
                </button>
                <button
                  onClick={deselectAllScenes}
                  className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded text-sm"
                >
                  Deselect All
                </button>
              </div>

              <div className="max-h-64 overflow-y-auto space-y-2 mb-4">
                {sceneTakes.map((sceneTake) => {
                  const scene = scenes.find(s => s.id === sceneTake.sceneId)
                  const isSelected = selectedScenesForExport.has(sceneTake.sceneId)
                  const sceneCuts = cuts.get(sceneTake.sceneId) || []

                  return (
                    <div
                      key={sceneTake.sceneId}
                      className={`p-3 rounded border cursor-pointer ${isSelected
                        ? 'bg-gray-900/30 border-gray-500'
                        : 'bg-gray-800 border-gray-700 hover:border-gray-600'
                        }`}
                      onClick={() => toggleSceneSelection(sceneTake.sceneId)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center ${isSelected
                              ? 'bg-gray-500 border-gray-500'
                              : 'border-gray-500'
                              }`}
                          >
                            {isSelected && (
                              <svg
                                className="w-3 h-3 text-white"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            )}
                          </div>
                          <div>
                            <div className="font-medium">
                              Scene {sceneTake.sceneIndex + 1}: {scene?.title || 'Untitled'}
                            </div>
                            <div className="text-xs text-gray-400">
                              Duration: {formatTime(sceneTake.take.duration)}
                              {sceneCuts.length > 0 && (
                                <span className="ml-2">• {sceneCuts.length} cut{sceneCuts.length !== 1 ? 's' : ''}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {(isExporting || ffmpegLoading) ? (
                <div className="mt-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-500"></div>
                    <span className="text-sm text-gray-300">
                      {ffmpegLoading && !exportProgress ? 'Loading FFmpeg...' : exportProgress || (isExporting ? 'Processing...' : '')}
                    </span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                      style={{ width: `${exportProgressPercent}%` }}
                    ></div>
                  </div>
                  {exportProgressPercent > 0 && exportProgressPercent < 100 && (
                    <div className="text-xs text-gray-400 mt-1 text-right">
                      {Math.round(exportProgressPercent)}%
                    </div>
                  )}
                </div>
              ) : null}
              {ffmpegError && !isExporting && (
                <div className="mt-4 p-3 bg-red-900/30 border border-red-700 rounded">
                  <span className="text-sm text-red-400">
                    FFmpeg Error: {ffmpegError}. Please refresh the page and try again.
                  </span>
                </div>
              )}

              <div className="mb-4">
                <label className="text-sm text-gray-300 mb-2 block">Export Format</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setExportFormat('mp4')}
                    className={`px-4 py-2 rounded text-sm ${exportFormat === 'mp4' ? 'bg-blue-600' : 'bg-gray-800 hover:bg-gray-700'}`}
                  >
                    MP4
                  </button>
                  <button
                    onClick={() => setExportFormat('webm')}
                    className={`px-4 py-2 rounded text-sm ${exportFormat === 'webm' ? 'bg-blue-600' : 'bg-gray-800 hover:bg-gray-700'}`}
                  >
                    WebM
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <label className="text-sm text-gray-300 mb-2 block">Export Mode</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setExportMode('combined')}
                    className={`px-4 py-2 rounded text-sm ${exportMode === 'combined' ? 'bg-blue-600' : 'bg-gray-800 hover:bg-gray-700'}`}
                  >
                    Combined Video
                  </button>
                  <button
                    onClick={() => setExportMode('separate')}
                    className={`px-4 py-2 rounded text-sm ${exportMode === 'separate' ? 'bg-blue-600' : 'bg-gray-800 hover:bg-gray-700'}`}
                  >
                    Separate Videos
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {exportMode === 'combined' 
                    ? 'Export all selected scenes as one video file' 
                    : 'Export each selected scene as a separate video file'}
                </p>
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={() => !isExporting && setShowExportDialog(false)}
                  disabled={isExporting}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExport}
                  disabled={isExporting || !ffmpegReady || ffmpegLoading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  title={!ffmpegReady ? (ffmpegLoading ? 'Loading FFmpeg...' : ffmpegError ? `FFmpeg error: ${ffmpegError}` : 'FFmpeg not ready') : undefined}
                >
                  {ffmpegLoading ? 'Loading FFmpeg...' : ffmpegError ? 'FFmpeg Error' : 'Export Video'}
                </button>
                <button
                  onClick={() => {
                    handleExportDaVinci()
                  }}
                  disabled={isExporting}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Export DaVinci Timeline
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-16 bg-gray-900 border-r border-gray-700 flex flex-col items-center py-4 space-y-4">
          <button
            onClick={() => setActiveTab('canvas')}
            className={`p-2 rounded ${activeTab === 'canvas' ? 'bg-blue-600' : 'hover:bg-gray-800'}`}
            title="Project Settings"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          <button
            onClick={() => setActiveTab('layout')}
            className={`p-2 rounded ${activeTab === 'layout' ? 'bg-blue-600' : 'hover:bg-gray-800'}`}
            title="Layout"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </button>
          <button
            onClick={() => setActiveTab('clip')}
            className={`p-2 rounded ${activeTab === 'clip' ? 'bg-blue-600' : 'hover:bg-gray-800'}`}
            title="Clip"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
          <button
            onClick={() => setActiveTab('captions')}
            className={`p-2 rounded ${activeTab === 'captions' ? 'bg-blue-600' : 'hover:bg-gray-800'}`}
            title="Captions"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </button>
          <button
            onClick={() => setActiveTab('audio')}
            className={`p-2 rounded ${activeTab === 'audio' ? 'bg-blue-600' : 'hover:bg-gray-800'}`}
            title="Audio Settings"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
          </button>
          <button
            onClick={() => setActiveTab('visual')}
            className={`p-2 rounded ${activeTab === 'visual' ? 'bg-blue-600' : 'hover:bg-gray-800'}`}
            title="Visual Settings"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
            </svg>
          </button>
        </div>

        {/* Sidebar Content */}
        <div className="w-64 bg-gray-900 border-r border-gray-700 overflow-y-auto flex-shrink-0" style={{ height: '100%' }}>
          {activeTab === 'clip' && selectedClip && (
            <div className="p-4">
              <h3 className="text-sm font-semibold mb-4">
                {selectedClip.layer === 'camera' && 'CAMERA'}
                {selectedClip.layer === 'microphone' && 'MICROPHONE'}
                {selectedClip.layer === 'screen' && 'SCREEN'}
              </h3>

              {selectedClip.layer === 'microphone' && (
                <div className="space-y-4">
                  {/* Apply to All Button */}
                  <div className="flex justify-end pb-2 border-b border-gray-800">
                    <button
                      onClick={() => {
                        if (!selectedClip) return
                        const sourceKey = `${selectedClip.sceneId}_${selectedClip.takeId}_${selectedClip.layer}`
                        const sourceProps = clipProperties.get(sourceKey)
                        if (!sourceProps) return

                        if (!confirm('Apply these audio settings to all microphone clips?')) return

                        const newMap = new Map(clipProperties)
                        timelineClips.forEach(clip => {
                          if (clip.layer === 'microphone') {
                            const targetKey = `${clip.sceneId}_${clip.takeId}_${clip.layer}`
                            const existing = newMap.get(targetKey) || {
                              enhanceVoice: false,
                              volume: 0,
                              removeNoise: false,
                              noiseRemovalLevel: 93,
                              audioQuality: 'best' as const,
                              brightness: 0,
                              contrast: 0,
                              saturation: 0,
                              exposure: 0,
                            }
                            newMap.set(targetKey, {
                              ...existing,
                              enhanceVoice: sourceProps.enhanceVoice,
                              volume: sourceProps.volume,
                              removeNoise: sourceProps.removeNoise,
                              noiseRemovalLevel: sourceProps.noiseRemovalLevel,
                              audioQuality: sourceProps.audioQuality
                            })
                          }
                        })
                        setClipProperties(newMap)
                      }}
                      className="text-xs bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 hover:text-blue-300 px-3 py-1.5 rounded transition-colors border border-blue-500/30"
                    >
                      Apply to all clips
                    </button>
                  </div>
                  {/* Enhance Voice */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs text-gray-300">Enhance Voice</label>
                      <button
                        onClick={() => {
                          const key = `${selectedClip.sceneId}_${selectedClip.takeId}_${selectedClip.layer}`
                          const current = clipProperties.get(key) || {
                            enhanceVoice: false,
                            volume: 0,
                            removeNoise: false,
                            noiseRemovalLevel: 93,
                            audioQuality: 'best' as const,
                            brightness: 0,
                            contrast: 0,
                            saturation: 0,
                            exposure: 0,
                          }
                          setClipProperties(new Map(clipProperties.set(key, {
                            ...current,
                            enhanceVoice: !current.enhanceVoice,
                          })))
                        }}
                        className={`w-12 h-6 rounded-full transition-colors ${(clipProperties.get(`${selectedClip.sceneId}_${selectedClip.takeId}_${selectedClip.layer}`)?.enhanceVoice) ? 'bg-green-500' : 'bg-gray-600'
                          }`}
                      >
                        <div
                          className={`w-5 h-5 bg-white rounded-full transition-transform ${(clipProperties.get(`${selectedClip.sceneId}_${selectedClip.takeId}_${selectedClip.layer}`)?.enhanceVoice) ? 'translate-x-6' : 'translate-x-0.5'
                            }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Volume */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs text-gray-300">Volume</label>
                      <span className="text-xs text-gray-400">
                        {clipProperties.get(`${selectedClip.sceneId}_${selectedClip.takeId}_${selectedClip.layer}`)?.volume || 0} dB
                      </span>
                    </div>
                    <input
                      type="range"
                      min="-60"
                      max="20"
                      value={clipProperties.get(`${selectedClip.sceneId}_${selectedClip.takeId}_${selectedClip.layer}`)?.volume || 0}
                      onChange={(e) => {
                        const key = `${selectedClip.sceneId}_${selectedClip.takeId}_${selectedClip.layer}`
                        const current = clipProperties.get(key) || {
                          enhanceVoice: false,
                          volume: 0,
                          removeNoise: false,
                          noiseRemovalLevel: 93,
                          audioQuality: 'best' as const,
                          brightness: 0,
                          contrast: 0,
                          saturation: 0,
                          exposure: 0,
                        }
                        setClipProperties(new Map(clipProperties.set(key, {
                          ...current,
                          volume: parseInt(e.target.value),
                        })))
                      }}
                      className="w-full"
                    />
                  </div>

                  {/* Remove Noise */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs text-gray-300">Remove Noise</label>
                      <button
                        onClick={() => {
                          const key = `${selectedClip.sceneId}_${selectedClip.takeId}_${selectedClip.layer}`
                          const current = clipProperties.get(key) || {
                            enhanceVoice: false,
                            volume: 0,
                            removeNoise: false,
                            noiseRemovalLevel: 93,
                            audioQuality: 'best' as const,
                            brightness: 0,
                            contrast: 0,
                            saturation: 0,
                            exposure: 0,
                          }
                          setClipProperties(new Map(clipProperties.set(key, {
                            ...current,
                            removeNoise: !current.removeNoise,
                          })))
                        }}
                        className={`w-12 h-6 rounded-full transition-colors ${(clipProperties.get(`${selectedClip.sceneId}_${selectedClip.takeId}_${selectedClip.layer}`)?.removeNoise) ? 'bg-green-500' : 'bg-gray-600'
                          }`}
                      >
                        <div
                          className={`w-5 h-5 bg-white rounded-full transition-transform ${(clipProperties.get(`${selectedClip.sceneId}_${selectedClip.takeId}_${selectedClip.layer}`)?.removeNoise) ? 'translate-x-6' : 'translate-x-0.5'
                            }`}
                        />
                      </button>
                    </div>
                    {(clipProperties.get(`${selectedClip.sceneId}_${selectedClip.takeId}_${selectedClip.layer}`)?.removeNoise) && (
                      <div className="mt-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-gray-400">Level</span>
                          <span className="text-xs text-gray-400">
                            {clipProperties.get(`${selectedClip.sceneId}_${selectedClip.takeId}_${selectedClip.layer}`)?.noiseRemovalLevel || 93}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={clipProperties.get(`${selectedClip.sceneId}_${selectedClip.takeId}_${selectedClip.layer}`)?.noiseRemovalLevel || 93}
                          onChange={(e) => {
                            const key = `${selectedClip.sceneId}_${selectedClip.takeId}_${selectedClip.layer}`
                            const current = clipProperties.get(key) || {
                              enhanceVoice: false,
                              volume: 0,
                              removeNoise: false,
                              noiseRemovalLevel: 93,
                              audioQuality: 'best' as const,
                              brightness: 0,
                              contrast: 0,
                              saturation: 0,
                              exposure: 0,
                            }
                            setClipProperties(new Map(clipProperties.set(key, {
                              ...current,
                              noiseRemovalLevel: parseInt(e.target.value),
                            })))
                          }}
                          className="w-full"
                        />
                      </div>
                    )}
                  </div>

                  {/* Quality */}
                  <div>
                    <label className="text-xs text-gray-300 mb-2 block">Quality</label>
                    <select
                      value={clipProperties.get(`${selectedClip.sceneId}_${selectedClip.takeId}_${selectedClip.layer}`)?.audioQuality || 'best'}
                      onChange={(e) => {
                        const key = `${selectedClip.sceneId}_${selectedClip.takeId}_${selectedClip.layer}`
                        const current = clipProperties.get(key) || {
                          enhanceVoice: false,
                          volume: 0,
                          removeNoise: false,
                          noiseRemovalLevel: 93,
                          audioQuality: 'best' as const,
                          brightness: 0,
                          contrast: 0,
                          saturation: 0,
                          exposure: 0,
                        }
                        setClipProperties(new Map(clipProperties.set(key, {
                          ...current,
                          audioQuality: e.target.value as 'fast' | 'balanced' | 'best',
                        })))
                      }}
                      className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs"
                    >
                      <option value="fast">Fast</option>
                      <option value="balanced">Balanced</option>
                      <option value="best">Best</option>
                    </select>
                    {clipProperties.get(`${selectedClip.sceneId}_${selectedClip.takeId}_${selectedClip.layer}`)?.audioQuality === 'best' && (
                      <p className="text-xs text-gray-400 mt-2">
                        Use the best quality noise cancelling algorithm. This requires more resources and might cause stutter while editing.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {(selectedClip.layer === 'camera' || selectedClip.layer === 'screen') && (
                <div className="space-y-4">
                  {/* Apply to All Button */}
                  <div className="flex justify-end pb-2 border-b border-gray-800">
                    <button
                      onClick={() => {
                        if (!selectedClip) return
                        const sourceKey = `${selectedClip.sceneId}_${selectedClip.takeId}_${selectedClip.layer}`
                        const sourceProps = clipProperties.get(sourceKey)
                        if (!sourceProps) return

                        const layerType = selectedClip.layer === 'camera' ? 'camera' : 'screen'
                        if (!confirm(`Apply these ${layerType} settings to all ${layerType} clips?`)) return

                        const newMap = new Map(clipProperties)
                        timelineClips.forEach(clip => {
                          if (clip.layer === layerType) {
                            const targetKey = `${clip.sceneId}_${clip.takeId}_${clip.layer}`
                            const existing = newMap.get(targetKey) || {
                              enhanceVoice: false,
                              volume: 0,
                              removeNoise: false,
                              noiseRemovalLevel: 93,
                              audioQuality: 'best' as const,
                              brightness: 0,
                              contrast: 0,
                              saturation: 0,
                              exposure: 0,
                            }
                            newMap.set(targetKey, {
                              ...existing,
                              brightness: sourceProps.brightness,
                              contrast: sourceProps.contrast,
                              saturation: sourceProps.saturation,
                              exposure: sourceProps.exposure,
                            })
                          }
                        })
                        setClipProperties(newMap)
                        // Save to history after applying to all clips
                        setTimeout(() => saveToHistory(), 0)
                        // Explicitly save edit data after applying to all clips
                        setTimeout(() => {
                          saveEditData()
                        }, 0)
                      }}
                      className="text-xs bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 hover:text-blue-300 px-3 py-1.5 rounded transition-colors border border-blue-500/30"
                    >
                      Apply to all clips
                    </button>
                  </div>
                  {/* Brightness */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs text-gray-300">Brightness</label>
                      <span className="text-xs text-gray-400">
                        {clipProperties.get(`${selectedClip.sceneId}_${selectedClip.takeId}_${selectedClip.layer}`)?.brightness || 0}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      value={clipProperties.get(`${selectedClip.sceneId}_${selectedClip.takeId}_${selectedClip.layer}`)?.brightness || 0}
                      onChange={(e) => {
                        const key = `${selectedClip.sceneId}_${selectedClip.takeId}_${selectedClip.layer}`
                        const current = clipProperties.get(key) || {
                          enhanceVoice: false,
                          volume: 0,
                          removeNoise: false,
                          noiseRemovalLevel: 93,
                          audioQuality: 'best' as const,
                          brightness: 0,
                          contrast: 0,
                          saturation: 0,
                          exposure: 0,
                        }
                        setClipProperties(new Map(clipProperties.set(key, {
                          ...current,
                          brightness: parseInt(e.target.value),
                        })))
                      }}
                      onMouseUp={() => {
                        // Explicitly save edit data after brightness adjustment completes
                        setTimeout(() => {
                          saveEditData()
                        }, 0)
                      }}
                      className="w-full"
                    />
                  </div>

                  {/* Contrast */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs text-gray-300">Contrast</label>
                      <span className="text-xs text-gray-400">
                        {clipProperties.get(`${selectedClip.sceneId}_${selectedClip.takeId}_${selectedClip.layer}`)?.contrast || 0}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      value={clipProperties.get(`${selectedClip.sceneId}_${selectedClip.takeId}_${selectedClip.layer}`)?.contrast || 0}
                      onChange={(e) => {
                        const key = `${selectedClip.sceneId}_${selectedClip.takeId}_${selectedClip.layer}`
                        const current = clipProperties.get(key) || {
                          enhanceVoice: false,
                          volume: 0,
                          removeNoise: false,
                          noiseRemovalLevel: 93,
                          audioQuality: 'best' as const,
                          brightness: 0,
                          contrast: 0,
                          saturation: 0,
                          exposure: 0,
                        }
                        setClipProperties(new Map(clipProperties.set(key, {
                          ...current,
                          contrast: parseInt(e.target.value),
                        })))
                      }}
                      onMouseUp={() => {
                        // Explicitly save edit data after contrast adjustment completes
                        setTimeout(() => {
                          saveEditData()
                        }, 0)
                      }}
                      className="w-full"
                    />
                  </div>

                  {/* Saturation */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs text-gray-300">Saturation</label>
                      <span className="text-xs text-gray-400">
                        {clipProperties.get(`${selectedClip.sceneId}_${selectedClip.takeId}_${selectedClip.layer}`)?.saturation || 0}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      value={clipProperties.get(`${selectedClip.sceneId}_${selectedClip.takeId}_${selectedClip.layer}`)?.saturation || 0}
                      onChange={(e) => {
                        const key = `${selectedClip.sceneId}_${selectedClip.takeId}_${selectedClip.layer}`
                        const current = clipProperties.get(key) || {
                          enhanceVoice: false,
                          volume: 0,
                          removeNoise: false,
                          noiseRemovalLevel: 93,
                          audioQuality: 'best' as const,
                          brightness: 0,
                          contrast: 0,
                          saturation: 0,
                          exposure: 0,
                        }
                        setClipProperties(new Map(clipProperties.set(key, {
                          ...current,
                          saturation: parseInt(e.target.value),
                        })))
                      }}
                      onMouseUp={() => {
                        // Explicitly save edit data after saturation adjustment completes
                        setTimeout(() => {
                          saveEditData()
                        }, 0)
                      }}
                      className="w-full"
                    />
                  </div>

                  {/* Exposure */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs text-gray-300">Exposure</label>
                      <span className="text-xs text-gray-400">
                        {clipProperties.get(`${selectedClip.sceneId}_${selectedClip.takeId}_${selectedClip.layer}`)?.exposure || 0}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      value={clipProperties.get(`${selectedClip.sceneId}_${selectedClip.takeId}_${selectedClip.layer}`)?.exposure || 0}
                      onChange={(e) => {
                        const key = `${selectedClip.sceneId}_${selectedClip.takeId}_${selectedClip.layer}`
                        const current = clipProperties.get(key) || {
                          enhanceVoice: false,
                          volume: 0,
                          removeNoise: false,
                          noiseRemovalLevel: 93,
                          audioQuality: 'best' as const,
                          brightness: 0,
                          contrast: 0,
                          saturation: 0,
                          exposure: 0,
                        }
                        setClipProperties(new Map(clipProperties.set(key, {
                          ...current,
                          exposure: parseInt(e.target.value),
                        })))
                      }}
                      onMouseUp={() => {
                        // Explicitly save edit data after exposure adjustment completes
                        setTimeout(() => {
                          saveEditData()
                        }, 0)
                      }}
                      className="w-full"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'captions' && (
            <div className="p-4">
              <h3 className="text-sm font-semibold mb-4">CAPTIONS</h3>

              {/* Font Selection */}
              <div className="mb-4">
                <label className="text-xs text-gray-300 mb-2 block">Font Family</label>
                <select
                  value={captionFont}
                  onChange={(e) => setCaptionFont(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs"
                  style={{ fontFamily: availableFonts.find(f => f.name === captionFont)?.value || 'Inter' }}
                >
                  {availableFonts.map(font => (
                    <option key={font.name} value={font.name} style={{ fontFamily: font.value }}>
                      {font.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Font Size */}
              <div className="mb-4">
                <label className="text-xs text-gray-300 mb-2 block">Font Size: {captionSize}px</label>
                <input
                  type="range"
                  min="12"
                  max="200"
                  value={captionSize}
                  onChange={(e) => setCaptionSize(parseInt(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>12px</span>
                  <span>200px</span>
                </div>
              </div>

              {/* Max Words */}
              <div className="mb-4">
                <label className="text-xs text-gray-300 mb-2 block">Max Words: {captionMaxWords}</label>
                <input
                  type="range"
                  min="1"
                  max="20"
                  value={captionMaxWords}
                  onChange={(e) => setCaptionMaxWords(parseInt(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>1</span>
                  <span>20</span>
                </div>
              </div>

              {/* Caption Styles */}
              <div className="mb-4">
                <label className="text-xs text-gray-300 mb-2 block">Caption Styles</label>
                <p className="text-xs text-gray-400 mb-3">Selected style will be applied to all captions</p>
                <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                  {captionStyles.map((style) => (
                    <button
                      key={style.id}
                      onClick={() => setSelectedCaptionStyle(style.id)}
                      className={`px-3 py-2 rounded text-xs text-center transition-all ${selectedCaptionStyle === style.id
                        ? 'ring-2 ring-blue-500'
                        : 'bg-gray-800 hover:bg-gray-700'
                        }`}
                      style={style.id !== 'none' ? {
                        background: style.backgroundColor,
                        color: style.textColor,
                        padding: style.padding,
                        borderRadius: style.borderRadius,
                        border: style.border || 'none',
                        boxShadow: style.boxShadow || 'none',
                        fontWeight: style.fontWeight,
                        textTransform: style.textTransform || 'none',
                      } : {
                        backgroundColor: '#1f2937',
                        color: '#9ca3af',
                      }}
                    >
                      {style.name}
                    </button>
                  ))}
                </div>
              </div>

            </div>
          )}

          {activeTab === 'layout' && (
            <div className="p-4 space-y-6 overflow-y-auto h-full">
              <h3 className="text-sm font-semibold mb-4">LAYOUT</h3>
              
              {/* Global Title Settings */}
              <div className="border-t border-gray-700 pt-4">
                <h4 className="text-xs font-semibold mb-3 text-gray-300">Title Settings (Global)</h4>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Font Family</label>
                    <select
                      value={titleSettings.font}
                      onChange={(e) => setTitleSettings({ ...titleSettings, font: e.target.value })}
                      className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs"
                      style={{ fontFamily: titleSettings.font }}
                    >
                      {availableFonts.map(font => (
                        <option key={font.name} value={font.value} style={{ fontFamily: font.value }}>
                          {font.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Font Size: {titleSettings.size}px</label>
                    <input
                      type="range"
                      min="12"
                      max="200"
                      value={titleSettings.size}
                      onChange={(e) => setTitleSettings({ ...titleSettings, size: parseInt(e.target.value) })}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>

              {/* Background Image */}
              <div className="border-t border-gray-700 pt-4">
                <h4 className="text-xs font-semibold mb-3 text-gray-300">Background Image</h4>
                {(() => {
                  const currentLayoutClip = getCurrentLayoutClip(currentTime)
                  const bgImage = currentLayoutClip?.backgroundImage
                  return (
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) {
                              const reader = new FileReader()
                              reader.onload = (event) => {
                                const dataUrl = event.target?.result as string
                                const currentLayoutClip = getCurrentLayoutClip(currentTime)
                                if (currentLayoutClip) {
                                  setLayoutClips(prev => prev.map(lc => 
                                    lc.id === currentLayoutClip.id 
                                      ? { 
                                          ...lc, 
                                          backgroundImage: { 
                                            enabled: true, 
                                            url: dataUrl 
                                          } 
                                        }
                                      : lc
                                  ))
                                  saveToHistory()
                                }
                              }
                              reader.readAsDataURL(file)
                            }
                          }}
                          className="flex-1 text-xs text-gray-400 file:mr-4 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-blue-600 file:text-white hover:file:bg-blue-700"
                        />
                        <button
                          onClick={() => {
                            setUnsplashModalOpen(true)
                            if (unsplashSearchQuery) {
                              searchUnsplash(unsplashSearchQuery)
                            }
                          }}
                          className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded whitespace-nowrap"
                        >
                          Unsplash
                        </button>
                      </div>
                      {bgImage?.url && (
                        <div className="relative w-full h-32 bg-gray-900 rounded overflow-hidden">
                          <img src={bgImage.url} alt="Background" className="w-full h-full object-cover" />
                <button
                            onClick={() => {
                              const currentLayoutClip = getCurrentLayoutClip(currentTime)
                              if (currentLayoutClip) {
                                setLayoutClips(prev => prev.map(lc => 
                                  lc.id === currentLayoutClip.id 
                                    ? { 
                                        ...lc, 
                                        backgroundImage: { 
                                          enabled: true, 
                                          url: '' 
                                        } 
                                      }
                                    : lc
                                ))
                                saveToHistory()
                                // Explicitly save edit data after removing background image
                                setTimeout(() => {
                                  saveEditData()
                                }, 0)
                              }
                            }}
                            className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white text-xs px-2 py-1 rounded"
                          >
                            Remove
                </button>
              </div>
                      )}
                    </div>
                  )
                })()}
              </div>

              {/* Title Text */}
              <div className="border-t border-gray-700 pt-4">
                <h4 className="text-xs font-semibold mb-3 text-gray-300">Title</h4>
                {(() => {
                  const currentLayoutClip = getCurrentLayoutClip(currentTime)
                  const title = currentLayoutClip?.title
                  return (
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-gray-400 mb-1 block">Title Text</label>
                        {/* Formatting Toolbar */}
                        <div className="flex gap-1 mb-1 p-1 bg-gray-800 border border-gray-700 rounded-t">
                          <button
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault()
                              document.execCommand('bold', false)
                              titleEditorRef.current?.focus()
                            }}
                            className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded text-white"
                            title="Bold"
                          >
                            <strong>B</strong>
                          </button>
                          <button
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault()
                              document.execCommand('italic', false)
                              titleEditorRef.current?.focus()
                            }}
                            className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded text-white"
                            title="Italic"
                          >
                            <em>I</em>
                          </button>
                          <button
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault()
                              document.execCommand('underline', false)
                              titleEditorRef.current?.focus()
                            }}
                            className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded text-white"
                            title="Underline"
                          >
                            <u>U</u>
                          </button>
                        </div>
                        {/* Rich Text Editor */}
                        <TitleEditor
                          ref={titleEditorRef}
                          html={title?.text || ''}
                          onChange={(htmlContent) => {
                            const currentLayoutClip = getCurrentLayoutClip(currentTime)
                            if (currentLayoutClip) {
                              setLayoutClips(prev => prev.map(lc => 
                                lc.id === currentLayoutClip.id 
                                  ? { 
                                      ...lc, 
                                      title: { 
                                        enabled: true,
                                        text: htmlContent,
                                        x: lc.title?.x ?? 0.5,
                                        y: lc.title?.y ?? 0.1
                                      } 
                                    }
                                  : lc
                              ))
                              saveToHistory()
                            }
                          }}
                          onBlur={() => {
                            setTimeout(() => {
                              saveEditData()
                            }, 0)
                          }}
                          className="w-full bg-gray-800 border border-gray-700 border-t-0 rounded-b px-2 py-1.5 text-xs text-white min-h-[4rem] focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="Enter title text... (supports formatting)"
                        />
                      </div>
                      <div className="text-xs text-gray-400">
                        Select text and use formatting buttons for bold, italic, or underline. Drag the title in the canvas to reposition it.
                      </div>
                    </div>
                  )
                })()}
              </div>

              {/* Save Current Layout as Preset */}
              <div className="border-t border-gray-700 pt-4">
                <h4 className="text-xs font-semibold mb-3 text-gray-300">Save Layout Preset</h4>
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Layout name"
                    value={(() => {
                      const currentLayoutClip = getCurrentLayoutClip(currentTime)
                      return currentLayoutClip?.name || ''
                    })()}
                    onChange={(e) => {
                      const currentLayoutClip = getCurrentLayoutClip(currentTime)
                      if (currentLayoutClip) {
                        setLayoutClips(prev => prev.map(lc => 
                          lc.id === currentLayoutClip.id 
                            ? { ...lc, name: e.target.value }
                            : lc
                        ))
                      }
                    }}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs"
                  />
                  <button
                    onClick={async () => {
                      const currentLayoutClip = getCurrentLayoutClip(currentTime)
                      if (!currentLayoutClip) {
                        alert('No layout clip at current time')
                        return
                      }
                      
                      // Generate thumbnail from canvas
                      const canvasContainer = document.querySelector('[data-canvas-container]') as HTMLElement
                      if (!canvasContainer) {
                        alert('Canvas not found')
                        return
                      }
                      
                      try {
                        // Create a temporary canvas to capture the layout
                        const tempCanvas = document.createElement('canvas')
                        tempCanvas.width = canvasDimensions.width
                        tempCanvas.height = canvasDimensions.height
                        const ctx = tempCanvas.getContext('2d')
                        if (!ctx) return
                        
                        // Draw background
                        ctx.fillStyle = canvasSettings.videoBackgroundColor
                        ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height)
                        
                        // Draw background image if enabled - fill canvas while maintaining aspect ratio
                        if (currentLayoutClip.backgroundImage?.enabled && currentLayoutClip.backgroundImage.url) {
                          const img = new Image()
                          await new Promise((resolve, reject) => {
                            img.onload = () => {
                              // Calculate dimensions to fill canvas while maintaining aspect ratio (cover)
                              const canvasAspect = tempCanvas.width / tempCanvas.height
                              const imgAspect = img.width / img.height
                              
                              let drawWidth = tempCanvas.width
                              let drawHeight = tempCanvas.height
                              let drawX = 0
                              let drawY = 0
                              
                              if (imgAspect > canvasAspect) {
                                // Image is wider - fit to height, crop width
                                drawHeight = tempCanvas.height
                                drawWidth = img.width * (tempCanvas.height / img.height)
                                drawX = (tempCanvas.width - drawWidth) / 2
                              } else {
                                // Image is taller - fit to width, crop height
                                drawWidth = tempCanvas.width
                                drawHeight = img.height * (tempCanvas.width / img.width)
                                drawY = (tempCanvas.height - drawHeight) / 2
                              }
                              
                              ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight)
                              resolve(null)
                            }
                            img.onerror = reject
                            img.src = currentLayoutClip.backgroundImage!.url
                          })
                        }
                        
                        // Draw title if it has text (support line breaks)
                        if (currentLayoutClip.title?.text) {
                          ctx.fillStyle = '#ffffff'
                          ctx.font = `${titleSettings.size}px ${titleSettings.font}`
                          ctx.textAlign = 'center'
                          ctx.textBaseline = 'top'
                          const x = currentLayoutClip.title.x * tempCanvas.width
                          const y = currentLayoutClip.title.y * tempCanvas.height
                          // Split text by line breaks and draw each line
                          const lines = currentLayoutClip.title.text.split('\n')
                          const lineHeight = titleSettings.size * 1.2
                          lines.forEach((line, index) => {
                            ctx.fillText(line, x, y + (index * lineHeight))
                          })
                        }
                        
                        const thumbnail = tempCanvas.toDataURL('image/jpeg', 0.8)
                        
                        const preset: LayoutPreset = {
                          id: `preset_${Date.now()}`,
                          name: currentLayoutClip.name || 'Untitled Layout',
                          thumbnail,
                          holders: JSON.parse(JSON.stringify(currentLayoutClip.holders)),
                          title: currentLayoutClip.title ? JSON.parse(JSON.stringify(currentLayoutClip.title)) : undefined,
                          backgroundImage: currentLayoutClip.backgroundImage ? JSON.parse(JSON.stringify(currentLayoutClip.backgroundImage)) : undefined,
                          createdAt: Date.now()
                        }
                        
                        setLayoutPresets(prev => [...prev, preset])
                        alert('Layout preset saved!')
                      } catch (error) {
                        console.error('Error saving layout preset:', error)
                        alert('Error saving layout preset')
                      }
                    }}
                    className="w-full bg-blue-600 hover:bg-blue-700 py-2 rounded text-xs text-white"
                  >
                    Save as Preset
                  </button>
                </div>
              </div>

              {/* Load Layout Presets */}
              {layoutPresets.length > 0 && (
                <div className="border-t border-gray-700 pt-4">
                  <h4 className="text-xs font-semibold mb-3 text-gray-300">Saved Presets</h4>
                  <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                    {layoutPresets.map((preset) => (
                    <button
                        key={preset.id}
                        onClick={() => {
                          const currentLayoutClip = getCurrentLayoutClip(currentTime)
                          const presetHolders = JSON.parse(JSON.stringify(preset.holders))
                          
                          if (currentLayoutClip) {
                            // Update existing layout clip - only update holders (position/scale), preserve title and backgroundImage
                            setLayoutClips(prev => prev.map(lc => 
                              lc.id === currentLayoutClip.id 
                                ? {
                                    ...lc,
                                    holders: presetHolders,
                                    // Preserve existing title and backgroundImage, only update name
                                    name: preset.name
                                  }
                                : lc
                            ))
                            // Canvas holders are now stored in layout clips, so they're automatically updated
                            saveToHistory()
                            markAsEdited()
                          } else {
                            // Create new layout clip at current timeline position
                            const nextClip = layoutClips.find(lc => lc.timelineStart > currentTime)
                            const endTime = nextClip ? nextClip.timelineStart : totalDuration
                            
                            const newLayoutClip: LayoutClip = {
                              id: `layout_${Date.now()}`,
                              timelineStart: currentTime,
                              timelineEnd: endTime,
                              holders: presetHolders,
                              // Use preset title/backgroundImage only if creating new clip (no existing content to preserve)
                              title: preset.title ? JSON.parse(JSON.stringify(preset.title)) : {
                                enabled: true,
                                text: '',
                                x: 0.5,
                                y: 0.1,
                              },
                              backgroundImage: preset.backgroundImage ? JSON.parse(JSON.stringify(preset.backgroundImage)) : {
                                enabled: true,
                                url: '',
                              },
                              name: preset.name
                            }
                            setLayoutClips(prev => {
                              const updated = [...prev, newLayoutClip].sort((a, b) => a.timelineStart - b.timelineStart)
                              // Adjust end times to prevent gaps
                              return updated.map((lc, idx) => {
                                if (idx < updated.length - 1) {
                                  return { ...lc, timelineEnd: updated[idx + 1].timelineStart }
                                }
                                return { ...lc, timelineEnd: totalDuration }
                              })
                            })
                            // Canvas holders are now stored in layout clips, so they're automatically updated
                            saveToHistory()
                            // Explicitly save edit data after creating layout clip from preset
                            setTimeout(() => {
                              saveEditData()
                            }, 0)
                            markAsEdited()
                          }
                        }}
                        className="relative bg-gray-800 hover:bg-gray-700 rounded p-2 text-left group"
                      >
                        <img src={preset.thumbnail} alt={preset.name} className="w-full h-20 object-cover rounded mb-1" />
                        <div className="text-xs text-white truncate">{preset.name}</div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            if (confirm('Delete this preset?')) {
                              setLayoutPresets(prev => prev.filter(p => p.id !== preset.id))
                            }
                          }}
                          className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 bg-red-600 hover:bg-red-700 text-white text-xs px-1.5 py-0.5 rounded"
                        >
                          ×
                        </button>
                    </button>
                  ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'canvas' && (
            <div className="p-4">
              <h3 className="text-sm font-semibold mb-4">PROJECT SETTINGS</h3>
              <div className="space-y-4">
                {/* Format Selection */}
                <div>
                  <label className="text-xs text-gray-300 mb-2 block">Video Format</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => {
                        const currentWidth = canvasSettings.resolution.width
                        const aspectRatio = 16 / 9
                        const calculatedHeight = currentWidth / aspectRatio
                        const newHeight = Math.round(calculatedHeight / 10) * 10 // Snap to nearest 10
                        setCanvasSettings({
                          ...canvasSettings,
                          format: '16:9',
                          resolution: { width: currentWidth, height: newHeight }
                        })
                        markAsEdited()
                        setTimeout(() => {
                          saveEditData()
                        }, 0)
                      }}
                      className={`px-3 py-2 rounded text-xs ${canvasSettings.format === '16:9' ? 'bg-blue-600' : 'bg-gray-800 hover:bg-gray-700'}`}
                    >
                      16:9
                    </button>
                    <button
                      onClick={() => {
                        const currentWidth = canvasSettings.resolution.width
                        const aspectRatio = 9 / 16
                        const calculatedHeight = currentWidth / aspectRatio
                        const newHeight = Math.round(calculatedHeight / 10) * 10 // Snap to nearest 10
                        setCanvasSettings({
                          ...canvasSettings,
                          format: '9:16',
                          resolution: { width: currentWidth, height: newHeight }
                        })
                        markAsEdited()
                        setTimeout(() => {
                          saveEditData()
                        }, 0)
                      }}
                      className={`px-3 py-2 rounded text-xs ${canvasSettings.format === '9:16' ? 'bg-blue-600' : 'bg-gray-800 hover:bg-gray-700'}`}
                    >
                      9:16
                    </button>
                    <button
                      onClick={() => {
                        const currentWidth = canvasSettings.resolution.width
                        // For 1:1, ensure both dimensions snap to 10s
                        const snappedWidth = Math.round(currentWidth / 10) * 10
                        setCanvasSettings({
                          ...canvasSettings,
                          format: '1:1',
                          resolution: { width: snappedWidth, height: snappedWidth }
                        })
                        markAsEdited()
                        setTimeout(() => {
                          saveEditData()
                        }, 0)
                      }}
                      className={`px-3 py-2 rounded text-xs ${canvasSettings.format === '1:1' ? 'bg-blue-600' : 'bg-gray-800 hover:bg-gray-700'}`}
                    >
                      1:1
                    </button>
                </div>
                </div>

                {/* Resolution */}
                <div>
                  <label className="text-xs text-gray-300 mb-2 block">Resolution</label>
                  <div className="space-y-2">
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Width: {canvasSettings.resolution.width}px</label>
                  <input
                    type="range"
                        min="480"
                        max="3840"
                        step="10"
                        value={canvasSettings.resolution.width}
                    onChange={(e) => {
                      const rawWidth = parseInt(e.target.value)
                      const newWidth = Math.round(rawWidth / 10) * 10 // Snap to nearest 10
                          const aspectRatio = canvasSettings.format === '16:9' ? 16 / 9 : canvasSettings.format === '9:16' ? 9 / 16 : 1
                          const calculatedHeight = newWidth / aspectRatio
                          const newHeight = Math.round(calculatedHeight / 10) * 10 // Snap to nearest 10
                          setCanvasSettings({
                            ...canvasSettings,
                            resolution: { width: newWidth, height: newHeight }
                          })
                          markAsEdited()
                          setTimeout(() => {
                            saveEditData()
                          }, 0)
                    }}
                    className="w-full"
                  />
                </div>
                <div>
                      <label className="text-xs text-gray-400 mb-1 block">Height: {canvasSettings.resolution.height}px</label>
                  <input
                    type="range"
                        min="480"
                        max="3840"
                        step="10"
                        value={canvasSettings.resolution.height}
                    onChange={(e) => {
                      const rawHeight = parseInt(e.target.value)
                      const newHeight = Math.round(rawHeight / 10) * 10 // Snap to nearest 10
                          const aspectRatio = canvasSettings.format === '16:9' ? 16 / 9 : canvasSettings.format === '9:16' ? 9 / 16 : 1
                          const calculatedWidth = newHeight * aspectRatio
                          const newWidth = Math.round(calculatedWidth / 10) * 10 // Snap to nearest 10
                          setCanvasSettings({
                            ...canvasSettings,
                            resolution: { width: newWidth, height: newHeight }
                          })
                          markAsEdited()
                          setTimeout(() => {
                            saveEditData()
                          }, 0)
                    }}
                    className="w-full"
                  />
                </div>
                  </div>
                </div>

                {/* Background Colors */}
                <div>
                  <label className="text-xs text-gray-300 mb-2 block">Work Area Background</label>
                  <input
                    type="color"
                    value={canvasSettings.workAreaBackgroundColor}
                    onChange={(e) => {
                      setCanvasSettings({ ...canvasSettings, workAreaBackgroundColor: e.target.value })
                      markAsEdited()
                      setTimeout(() => {
                        saveEditData()
                      }, 0)
                    }}
                    className="w-full h-10 rounded cursor-pointer"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-300 mb-2 block">Video Background</label>
                  <input
                    type="color"
                    value={canvasSettings.videoBackgroundColor}
                    onChange={(e) => {
                      setCanvasSettings({ ...canvasSettings, videoBackgroundColor: e.target.value })
                      markAsEdited()
                      setTimeout(() => {
                        saveEditData()
                      }, 0)
                    }}
                    className="w-full h-10 rounded cursor-pointer"
                  />
                  <p className="text-xs text-gray-500 mt-1">Used in exported video</p>
                </div>


                {/* Transition Duration */}
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">
                    Transition Duration: {canvasSettings.transitionDuration.toFixed(2)}s
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={canvasSettings.transitionDuration}
                    onChange={(e) => {
                      setCanvasSettings({ 
                        ...canvasSettings, 
                        transitionDuration: parseFloat(e.target.value) 
                      })
                      markAsEdited()
                      setTimeout(() => {
                        saveEditData()
                      }, 0)
                    }}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Duration for animated transitions between clip positions
                  </p>
                </div>

              </div>
            </div>
          )}

          {activeTab === 'audio' && (
            <div className="p-4">
              <h3 className="text-sm font-semibold mb-4">AUDIO SETTINGS</h3>
              <div className="space-y-4">
                {/* Noise Reduction */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs text-gray-300">Noise Reduction</label>
                    <button
                      onClick={() => setAudioSettings({ ...audioSettings, noiseReduction: !audioSettings.noiseReduction })}
                      className={`relative w-12 h-6 rounded-full transition-colors ${audioSettings.noiseReduction ? 'bg-green-500' : 'bg-gray-600'
                        }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${audioSettings.noiseReduction ? 'translate-x-6' : 'translate-x-0.5'
                          }`}
                      />
                    </button>
                  </div>
                  {audioSettings.noiseReduction && (
                    <div className="mb-2">
                      <label className="text-xs text-gray-400 mb-1 block">Level</label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={audioSettings.noiseReductionLevel}
                        onChange={(e) => setAudioSettings({ ...audioSettings, noiseReductionLevel: parseInt(e.target.value) })}
                        className="w-full"
                      />
                      <span className="text-xs text-gray-400">{audioSettings.noiseReductionLevel}%</span>
                    </div>
                  )}
                </div>

                {/* Enhance Voice */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs text-gray-300">Enhance Voice</label>
                    <button
                      onClick={() => setAudioSettings({ ...audioSettings, enhanceVoice: !audioSettings.enhanceVoice })}
                      className={`relative w-12 h-6 rounded-full transition-colors ${audioSettings.enhanceVoice ? 'bg-green-500' : 'bg-gray-600'
                        }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${audioSettings.enhanceVoice ? 'translate-x-6' : 'translate-x-0.5'
                          }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Normalize Audio */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs text-gray-300">Normalize Audio</label>
                    <button
                      onClick={() => setAudioSettings({ ...audioSettings, normalizeAudio: !audioSettings.normalizeAudio })}
                      className={`relative w-12 h-6 rounded-full transition-colors ${audioSettings.normalizeAudio ? 'bg-green-500' : 'bg-gray-600'
                        }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${audioSettings.normalizeAudio ? 'translate-x-6' : 'translate-x-0.5'
                          }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Remove Echo */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs text-gray-300">Remove Echo</label>
                    <button
                      onClick={() => setAudioSettings({ ...audioSettings, removeEcho: !audioSettings.removeEcho })}
                      className={`relative w-12 h-6 rounded-full transition-colors ${audioSettings.removeEcho ? 'bg-green-500' : 'bg-gray-600'
                        }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${audioSettings.removeEcho ? 'translate-x-6' : 'translate-x-0.5'
                          }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Remove Background Noise */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs text-gray-300">Remove Background Noise</label>
                    <button
                      onClick={() => setAudioSettings({ ...audioSettings, removeBackgroundNoise: !audioSettings.removeBackgroundNoise })}
                      className={`relative w-12 h-6 rounded-full transition-colors ${audioSettings.removeBackgroundNoise ? 'bg-green-500' : 'bg-gray-600'
                        }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${audioSettings.removeBackgroundNoise ? 'translate-x-6' : 'translate-x-0.5'
                          }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Audio Quality */}
                <div>
                  <label className="text-xs text-gray-300 mb-2 block">Audio Quality</label>
                  <select
                    value={audioSettings.audioQuality}
                    onChange={(e) => setAudioSettings({ ...audioSettings, audioQuality: e.target.value as 'fast' | 'balanced' | 'best' })}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs"
                  >
                    <option value="fast">Fast</option>
                    <option value="balanced">Balanced</option>
                    <option value="best">Best</option>
                  </select>
                </div>

                {/* Background Music */}
                <div className="border-t border-gray-700 pt-4">
                  <label className="text-xs text-gray-300 mb-2 block">Background Music</label>
                  <div className="space-y-3">
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          // Revoke old URL if exists
                          if (backgroundMusic.url) {
                            URL.revokeObjectURL(backgroundMusic.url)
                          }
                          const url = URL.createObjectURL(file)
                          setBackgroundMusic({
                            file,
                            url,
                            volume: backgroundMusic.volume
                          })
                          markAsEdited()
                        }
                      }}
                      className="w-full text-xs text-gray-400 file:mr-4 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-blue-600 file:text-white hover:file:bg-blue-700"
                    />
                    {backgroundMusic.file && (
                      <div className="bg-gray-800 rounded p-2">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-gray-300 truncate flex-1 mr-2">
                            {backgroundMusic.file.name}
                          </span>
                          <button
                            onClick={() => {
                              if (backgroundMusic.url) {
                                URL.revokeObjectURL(backgroundMusic.url)
                              }
                              setBackgroundMusic({
                                file: null,
                                url: null,
                                volume: 50
                              })
                              markAsEdited()
                            }}
                            className="text-red-400 hover:text-red-300 text-xs px-2"
                          >
                            Remove
                          </button>
                        </div>
                        <div>
                          <label className="text-xs text-gray-400 mb-1 block">
                            Volume: {backgroundMusic.volume}%
                          </label>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            step="1"
                            value={backgroundMusic.volume}
                            onChange={(e) => {
                              setBackgroundMusic({
                                ...backgroundMusic,
                                volume: parseInt(e.target.value)
                              })
                              markAsEdited()
                            }}
                            className="w-full"
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          Music will automatically fade out 1 second before the video ends
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'visual' && (
            <div className="p-4">
              <h3 className="text-sm font-semibold mb-4">VISUAL SETTINGS</h3>
              <div className="space-y-4">
                {/* LUT */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs text-gray-300">LUT (Look-Up Table)</label>
                    <button
                      onClick={() => setVisualSettings({ ...visualSettings, lutEnabled: !visualSettings.lutEnabled })}
                      className={`relative w-12 h-6 rounded-full transition-colors ${visualSettings.lutEnabled ? 'bg-green-500' : 'bg-gray-600'
                        }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${visualSettings.lutEnabled ? 'translate-x-6' : 'translate-x-0.5'
                          }`}
                      />
                    </button>
                  </div>
                  {visualSettings.lutEnabled && (
                    <div className="space-y-2">
                      <input
                        type="file"
                        accept=".cube,.3dl,.csp"
                        onChange={async (e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            setVisualSettings({ ...visualSettings, lutFile: file })
                            try {
                              if (file.name.endsWith('.cube')) {
                                const lut = await parseCubeLUT(file)
                                setLutData(lut)
                              } else {
                                // For other formats, you'd need additional parsers
                                console.warn('Only .cube files are currently supported')
                                setLutData(null)
                              }
                            } catch (error) {
                              console.error('Error parsing LUT file:', error)
                              alert('Failed to parse LUT file: ' + (error as Error).message)
                              setLutData(null)
                            }
                          }
                        }}
                        className="w-full text-xs text-gray-400 file:mr-4 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-blue-600 file:text-white hover:file:bg-blue-700"
                      />
                      {visualSettings.lutFile && (
                        <div className="text-xs text-gray-400">
                          Selected: {visualSettings.lutFile.name}
                        </div>
                      )}
                      <div>
                        <label className="text-xs text-gray-400 mb-1 block">Intensity</label>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={visualSettings.lutIntensity}
                          onChange={(e) => setVisualSettings({ ...visualSettings, lutIntensity: parseInt(e.target.value) })}
                          className="w-full"
                        />
                        <span className="text-xs text-gray-400">{visualSettings.lutIntensity}%</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Color Grading */}
                <div>
                  <label className="text-xs text-gray-300 mb-2 block">Color Grading</label>
                  <div className="space-y-2">
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Shadows</label>
                      <input
                        type="range"
                        min="-100"
                        max="100"
                        value={visualSettings.colorGrading.shadows}
                        onChange={(e) => setVisualSettings({
                          ...visualSettings,
                          colorGrading: { ...visualSettings.colorGrading, shadows: parseInt(e.target.value) }
                        })}
                        className="w-full"
                      />
                      <span className="text-xs text-gray-400">{visualSettings.colorGrading.shadows}</span>
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Midtones</label>
                      <input
                        type="range"
                        min="-100"
                        max="100"
                        value={visualSettings.colorGrading.midtones}
                        onChange={(e) => setVisualSettings({
                          ...visualSettings,
                          colorGrading: { ...visualSettings.colorGrading, midtones: parseInt(e.target.value) }
                        })}
                        className="w-full"
                      />
                      <span className="text-xs text-gray-400">{visualSettings.colorGrading.midtones}</span>
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Highlights</label>
                      <input
                        type="range"
                        min="-100"
                        max="100"
                        value={visualSettings.colorGrading.highlights}
                        onChange={(e) => setVisualSettings({
                          ...visualSettings,
                          colorGrading: { ...visualSettings.colorGrading, highlights: parseInt(e.target.value) }
                        })}
                        className="w-full"
                      />
                      <span className="text-xs text-gray-400">{visualSettings.colorGrading.highlights}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden relative">
          {/* Canvas Preview Area - fills entire space */}
          <div 
            className="absolute inset-0 flex items-center justify-center p-4"
                  style={{
              backgroundColor: canvasSettings.workAreaBackgroundColor,
              cursor: isPanning ? 'grabbing' : 'grab',
            }}
            onMouseDown={(e) => {
              // Only pan if clicking on the grey area (not on canvas or other elements)
              const target = e.target as HTMLElement
              if (target === e.currentTarget || target.classList.contains('work-area')) {
                setIsPanning(true)
                panStartPosRef.current = { x: e.clientX, y: e.clientY }
                panStartOffsetRef.current = { x: canvasPan.x, y: canvasPan.y }
                e.preventDefault()
                e.stopPropagation()
              }
            }}
          >
            {/* Canvas Container with strict aspect ratio enforcement - centered */}
            <div 
              ref={canvasContainerRef}
              className="relative flex-shrink-0"
              style={{
                width: `${canvasDisplaySize.width}px`,
                height: `${canvasDisplaySize.height}px`,
                aspectRatio: `${canvasDimensions.width} / ${canvasDimensions.height}`,
                maxWidth: 'calc(100% - 32px)',
                maxHeight: 'calc(100% - 32px)',
                minWidth: 0,
                minHeight: 0,
                margin: 'auto',
                transform: `translate(${canvasPan.x}px, ${canvasPan.y}px)`,
                transition: isPanning ? 'none' : 'transform 0.1s ease-out',
              }}
            >
              <div 
                data-canvas-container
                className="relative overflow-hidden"
                style={{
                  width: '100%',
                  height: '100%',
                  aspectRatio: `${canvasDimensions.width} / ${canvasDimensions.height}`,
                  transform: `scale(${canvasZoom})`,
                  transformOrigin: 'center',
                  backgroundColor: canvasSettings.videoBackgroundColor,
                }}
              >
                {/* Canvas content area - maintains aspect ratio */}
                <div
                  className="relative w-full h-full overflow-hidden"
                  style={{
                    width: '100%',
                    height: '100%',
                  }}
                >
                  {/* Background Image - rendered behind everything */}
                  {(() => {
                    const currentLayoutClip = getCurrentLayoutClip(currentTime)
                    const bgImage = currentLayoutClip?.backgroundImage
                    if (bgImage?.url && currentLayoutClip) {
                      // Calculate fade in/out based on layout clip position
                      const clipDuration = currentLayoutClip.timelineEnd - currentLayoutClip.timelineStart
                      const fadeDuration = Math.min(0.5, clipDuration * 0.1) // 10% of clip duration or max 0.5s
                      const timeInClip = currentTime - (currentLayoutClip.timelineStart || 0)
                      const timeFromEnd = (currentLayoutClip.timelineEnd || 0) - currentTime
                      
                      let opacity = 1
                      if (timeInClip < fadeDuration) {
                        // Fade in
                        opacity = timeInClip / fadeDuration
                      } else if (timeFromEnd < fadeDuration) {
                        // Fade out
                        opacity = timeFromEnd / fadeDuration
                      }
                      
                      return (
                        <img
                          src={bgImage.url}
                          alt="Background"
                          className="absolute inset-0 w-full h-full object-cover"
                          style={{
                            opacity,
                            zIndex: 0,
                          }}
                        />
                      )
                    }
                    return null
                  })()}
                  
                  {/* Video Holders - render in z-index order */}
                  {canvasHolders
                    .sort((a, b) => a.zIndex - b.zIndex)
                    .map(holder => {
                      const clip = timelineClips.find(c => c.id === holder.clipId)
                      if (!clip) return null
                      
                      const isSelected = selectedHolderId === holder.id
                      // Check if this exact clip should be active at the current timeline position
                      // A clip is active if currentTime is within its timeline bounds
                      const isActive = currentTime >= clip.timelineStart && currentTime < clip.timelineEnd && 
                                      clip.layer === holder.layer
                      
                      // Apply transition if active - check both by holder ID and by clipId_layer
                      let transition = transitioningHoldersRef.current.get(holder.id)
                      if (!transition) {
                        // Try to find transition by clipId_layer (in case holder ID changed)
                        const clipKey = `${holder.clipId}_${holder.layer}`
                        const clipTransition = transitioningByClipRef.current.get(clipKey)
                        if (clipTransition) {
                          transition = clipTransition
                          // Also store it on the holder for future lookups
                          transitioningHoldersRef.current.set(holder.id, {
                            ...transition,
                            clipId: holder.clipId,
                            layer: holder.layer
                          })
                        }
                      }
                      
                      let displayX = holder.x
                      let displayY = holder.y
                      let displayWidth = holder.width
                      let displayHeight = holder.height
                      let displayRotation = holder.rotation
                      
                      if (transition) {
                        const now = performance.now()
                        const elapsed = now - transition.startTime
                        const progress = Math.min(1, Math.max(0, elapsed / transition.duration))
                        
                        // Easing function (ease-in-out cubic) for smooth, natural motion
                        const eased = progress < 0.5
                          ? 4 * progress * progress * progress
                          : 1 - Math.pow(-2 * progress + 2, 3) / 2
                        
                        // Interpolate position and size
                        displayX = transition.startPos.x + (transition.endPos.x - transition.startPos.x) * eased
                        displayY = transition.startPos.y + (transition.endPos.y - transition.startPos.y) * eased
                        displayWidth = transition.startPos.width + (transition.endPos.width - transition.startPos.width) * eased
                        displayHeight = transition.startPos.height + (transition.endPos.height - transition.startPos.height) * eased
                        
                        // Interpolate rotation if provided
                        if (transition.startRotation !== undefined && transition.endRotation !== undefined) {
                          // Handle rotation wrapping (e.g., 350° to 10° should go through 0°, not backwards)
                          let startRot = transition.startRotation
                          let endRot = transition.endRotation
                          let diff = endRot - startRot
                          
                          // Normalize to shortest path
                          if (Math.abs(diff) > 180) {
                            if (diff > 0) {
                              diff -= 360
                            } else {
                              diff += 360
                            }
                          }
                          
                          displayRotation = startRot + diff * eased
                        }
                        
                        // Clean up completed transitions
                        if (progress >= 1) {
                          transitioningHoldersRef.current.delete(holder.id)
                          // Also clean up by clipId_layer
                          const clipKey = `${holder.clipId}_${holder.layer}`
                          transitioningByClipRef.current.delete(clipKey)
                        }
                      }
                      
                      // Get clip properties for filter calculation
                      const clipKey = `${clip.sceneId}_${clip.takeId}_${clip.layer}`
                      const props = clipProperties.get(clipKey)
                      const brightness = props?.brightness ?? 0
                      const contrast = props?.contrast ?? 0
                      const saturation = props?.saturation ?? 0
                      const exposure = props?.exposure ?? 0
                      
                      // Build CSS filter string
                      // Brightness: -100 to 100 maps to 0 to 2.0 (0 = normal, 100 = 2x brighter, -100 = black)
                      // Combine exposure with brightness (exposure also affects brightness)
                      const brightnessValue = Math.max(0, 1 + (brightness + exposure) / 100)
                      // Contrast: -100 to 100 maps to 0 to 2.0 (0 = no contrast, 100 = 2x contrast, -100 = gray)
                      const contrastValue = Math.max(0, 1 + contrast / 100)
                      // Saturation: -100 to 100 maps to 0 to 2.0 (0 = grayscale, 100 = 2x saturation, -100 = grayscale)
                      const saturationValue = Math.max(0, 1 + saturation / 100)
                      
                      const filterString = `brightness(${brightnessValue}) contrast(${contrastValue}) saturate(${saturationValue})`
                      
                      return (
                        <div
                          key={holder.id}
                          className={`absolute ${isSelected ? 'ring-2 ring-blue-500' : 'ring-1 ring-gray-700/50'} hover:ring-blue-400/50`}
                          style={{
                            left: `${displayX * 100}%`,
                            top: `${displayY * 100}%`,
                            width: `${displayWidth * 100}%`,
                            height: `${displayHeight * 100}%`,
                            transform: `rotate(${displayRotation}deg)`,
                            transformOrigin: 'center',
                            cursor: isSelected && !resizingHolderId ? 'move' : 'pointer',
                            overflow: 'hidden',
                            backgroundColor: !isActive ? 'rgba(0, 0, 0, 0.3)' : 'transparent',
                            zIndex: holder.zIndex || 10, // Video holders use their zIndex property
                            transition: transition ? 'none' : undefined, // Disable CSS transitions during programmatic transitions
                          }}
                          onMouseDown={(e) => {
                            // Only start drag if clicking on the holder itself (not on resize handles)
                            const target = e.target as HTMLElement
                            const isResizeHandle = target.closest('.resize-handle') !== null
                            if (!resizingHolderId && !isResizeHandle) {
                              e.preventDefault()
                              e.stopPropagation()
                              setSelectedHolderId(holder.id)
                              setDraggingHolderId(holder.id)
                              setDragStartPos({ x: e.clientX, y: e.clientY })
                              setDragStartHolder({ ...holder })
                            }
                          }}
                          onClick={(e) => {
                            // Select on click if not dragging
                            if (!draggingHolderId && !resizingHolderId) {
                              e.stopPropagation()
                              setSelectedHolderId(holder.id)
                            }
                          }}
                        >
                          {/* Video element for this holder */}
                          {isActive && (
                            <video
                              ref={holder.layer === 'camera' ? videoRef : (holder.layer === 'screen' ? screenVideoRef : null)}
                              className="w-full h-full object-cover pointer-events-none"
                              style={{
                                display: 'block',
                                filter: filterString,
                              }}
                              muted={holder.layer !== 'microphone'}
                              playsInline
                            />
                          )}
                          
                          {/* Placeholder when no video - always show border for visibility */}
                          {!isActive && (
                            <div className="w-full h-full bg-gray-800/50 border-2 border-dashed border-gray-600 flex items-center justify-center text-gray-500 text-xs pointer-events-none">
                              {holder.layer}
                  </div>
                )}
                          
                          {/* Selection border overlay - visible when selected */}
                          {isSelected && (
                            <div className="absolute inset-0 border-2 border-blue-500 pointer-events-none z-20" />
                          )}
                          
                          {/* Resize handles (corners) - only show when selected */}
                          {isSelected && (
                            <>
                              {/* Top-left */}
                              <div
                                className="resize-handle absolute -top-1 -left-1 w-3 h-3 bg-blue-500 rounded-full cursor-nwse-resize z-10 hover:bg-blue-400"
                                onMouseDown={(e) => {
                                  e.stopPropagation()
                                  setResizingHolderId(holder.id)
                                  setResizeCorner('nw')
                                  setResizeStartPos({ x: e.clientX, y: e.clientY })
                                  setResizeStartHolder({ ...holder })
                                }}
                              />
                              {/* Top-right */}
                              <div
                                className="resize-handle absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full cursor-nesw-resize z-10 hover:bg-blue-400"
                                onMouseDown={(e) => {
                                  e.stopPropagation()
                                  setResizingHolderId(holder.id)
                                  setResizeCorner('ne')
                                  setResizeStartPos({ x: e.clientX, y: e.clientY })
                                  setResizeStartHolder({ ...holder })
                                }}
                              />
                              {/* Bottom-left */}
                              <div
                                className="resize-handle absolute -bottom-1 -left-1 w-3 h-3 bg-blue-500 rounded-full cursor-nesw-resize z-10 hover:bg-blue-400"
                                onMouseDown={(e) => {
                                  e.stopPropagation()
                                  setResizingHolderId(holder.id)
                                  setResizeCorner('sw')
                                  setResizeStartPos({ x: e.clientX, y: e.clientY })
                                  setResizeStartHolder({ ...holder })
                                }}
                              />
                              {/* Bottom-right */}
                              <div
                                className="resize-handle absolute -bottom-1 -right-1 w-3 h-3 bg-blue-500 rounded-full cursor-nwse-resize z-10 hover:bg-blue-400"
                                onMouseDown={(e) => {
                                  e.stopPropagation()
                                  setResizingHolderId(holder.id)
                                  setResizeCorner('se')
                                  setResizeStartPos({ x: e.clientX, y: e.clientY })
                                  setResizeStartHolder({ ...holder })
                                }}
                              />
                            </>
                          )}
                        </div>
                      )
                    })}
                  
                  {/* Title - rendered on top of video holders but below canvas overlay */}
                  {(() => {
                    const currentLayoutClip = getCurrentLayoutClip(currentTime)
                    const title = currentLayoutClip?.title
                    if (title?.text && currentLayoutClip) {
                      const container = document.querySelector('[data-canvas-container]') as HTMLElement
                      if (!container) return null
                      
                      return (
                        <div
                          className="absolute cursor-move select-none"
                          style={{
                            left: `${title.x * 100}%`,
                            top: `${title.y * 100}%`,
                            transform: 'translate(-50%, 0)',
                            zIndex: 1000, // Title should always be on top of video holders
                            fontFamily: titleSettings.font,
                            fontSize: `${titleSettings.size}px`,
                            color: '#ffffff',
                            textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8)',
                            whiteSpace: 'pre-wrap', // Support line breaks
                            textAlign: 'center',
                            pointerEvents: 'auto',
                            maxWidth: '90%', // Prevent overflow
                          }}
                          onMouseDown={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setDraggingTitle(true)
                            setTitleDragStartPos({ x: e.clientX, y: e.clientY })
                            setTitleDragStartLayoutClip(currentLayoutClip)
                          }}
                          dangerouslySetInnerHTML={{ __html: title.text }}
                        />
                      )
                    }
                    return null
                  })()}
                  
                  {/* Main canvas for rendering (LUT, captions, etc.) - overlays on top */}
                  <canvas
                    ref={lutCanvasRef}
                    className="absolute inset-0 w-full h-full pointer-events-none"
                  />
                </div>
              </div>
            </div>
            
            {/* Hidden video elements for sources */}
            <video ref={videoRef} className="hidden" />
            <video ref={screenVideoRef} className="hidden" />
            <audio ref={audioRef} style={{ display: 'none' }} />
            </div>

            {/* Right Panel - Transcript */}
            <div
            className="bg-gray-900 border-l border-gray-700 flex flex-col absolute top-0 right-0 bottom-0"
            style={{ 
              width: `${transcriptWidth}px`,
              bottom: `${timelineHeight}px`, // Position above timeline
              height: `calc(100% - ${timelineHeight}px)`, // Fill space above timeline
            }}
            >
              {/* Resize handle */}
              <div
                ref={transcriptResizeRef}
                onMouseDown={() => setIsResizing(true)}
                className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 z-10"
                style={{ cursor: 'col-resize' }}
              />
              <div className="p-4 border-b border-gray-700">
                <h3 className="text-sm font-semibold">TRANSCRIPT</h3>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <div className="mb-4">
                  <button
                    onClick={() => setShowSettings(true)}
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    Settings
                  </button>
                </div>

                {/* Show all scenes with their transcripts - group by unique sceneId */}
                {Array.from(new Set(sceneTakes.map(st => st.sceneId))).map((sceneId) => {
                  const scene = scenes.find(s => s.id === sceneId)
                  const sceneTake = sceneTakes.find(st => st.sceneId === sceneId)
                  if (!sceneTake) return null
                  const sceneTranscript = transcripts.get(sceneId)
                  const isTranscribingScene = isTranscribing.get(sceneId) || false

                  return (
                    <div key={sceneId} className="mb-6">
                      <h4 className="text-sm font-semibold mb-2">
                        SCENE {sceneTake.sceneIndex + 1}
                        {scene?.title && `: ${scene.title}`}
                      </h4>

                      {!sceneTranscript ? (
                        <div className="border-2 border-dashed border-gray-700 rounded p-4 text-center">
                          {isTranscribingScene ? (
                            <div className="text-sm text-gray-400">Transcribing...</div>
                          ) : (
                            <>
                              <div className="text-sm text-gray-400 mb-2">
                                {sceneTake.take.hasMicrophone
                                  ? 'Not transcribed yet.'
                                  : 'This scene has no transcript'}
                              </div>
                              {sceneTake.take.hasMicrophone && (
                                <button
                                  onClick={() => handleTranscribe(sceneId, sceneTake.take.id)}
                                  disabled={isTranscribingScene}
                                  className="text-blue-400 hover:text-blue-300 text-sm font-semibold"
                                >
                                  Transcribe
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="text-sm leading-relaxed select-text text-gray-200">
                          {sceneTranscript.words.map((word, index) => {
                            const isDeleted = deletedWords.get(sceneId)?.has(index) || false
                            const isSelected = selectedWordIndices.get(sceneId)?.has(index) || false
                            const correctedText = wordCorrections.get(sceneId)?.get(index)
                            const displayText = correctedText || word.word
                            
                            // Also check if word overlaps with any cut
                            const sceneCuts = cuts.get(sceneId) || []
                            const wordOverlapsCut = sceneCuts.some(cut => {
                              const cutStart = cut.start + sceneTake.startTime
                              const cutEnd = cut.end + sceneTake.startTime
                              return (word.start >= cutStart && word.start < cutEnd) ||
                                (word.end > cutStart && word.end <= cutEnd) ||
                                (word.start <= cutStart && word.end >= cutEnd)
                            })
                            const showStrikethrough = isDeleted || wordOverlapsCut

                            return (
                              <span
                                key={index}
                                onClick={(e) => {
                                  if (isCPressedRef.current) {
                                    // C key is held - show correction dialog
                                    e.preventDefault()
                                    setCorrectionDialog({ sceneId, wordIndex: index, currentWord: displayText })
                                  } else {
                                    // Regular click - toggle selection
                                    setSelectedWordIndices(prev => {
                                      const sceneSelected = prev.get(sceneId) || new Set<number>()
                                      const newSelected = new Set(sceneSelected)
                                      if (newSelected.has(index)) {
                                        newSelected.delete(index)
                                      } else {
                                        newSelected.add(index)
                                      }
                                      const updated = new Map(prev)
                                      if (newSelected.size > 0) {
                                        updated.set(sceneId, newSelected)
                                      } else {
                                        updated.delete(sceneId)
                                      }
                                      return updated
                                    })
                                  }
                                }}
                                className={`px-1 rounded transition-all cursor-pointer ${
                                  showStrikethrough ? 'line-through text-red-400' : ''
                                } ${
                                  isSelected ? 'bg-blue-600/30 text-blue-200' : 'hover:bg-gray-700/50'
                                }`}
                              >
                                {displayText}{' '}
                              </span>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}

                {sceneTakes.length === 0 && (
                  <div className="text-center text-gray-400 py-8">
                    No scenes with recordings. Record a scene first.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Timeline Section - Resizable - positioned at bottom, overlaying canvas */}
          <div 
            className="absolute bottom-0 left-0 right-0 border-t border-gray-800 bg-[#050505] flex flex-col shrink-0 min-w-0 overflow-hidden z-10"
            style={{ 
              height: `${timelineHeight}px`, 
              width: '100%',
              maxHeight: '50vh', // Max 50% of viewport height
            }}
          >
            {/* Resize Handle */}
            <div
              onMouseDown={() => setIsResizingTimeline(true)}
              className="absolute top-0 left-0 right-0 h-1 cursor-row-resize hover:bg-blue-500 z-50 transition-colors"
              style={{ cursor: 'row-resize' }}
            />

          {/* Top Controls Bar - Centered Timecode & Transport */}
            <div className="h-14 border-b border-gray-800 flex items-center justify-between px-4 bg-[#0A0A0A] shrink-0 min-w-0">
            {/* Left Tools */}
            <div className="flex gap-2 w-1/3 min-w-0">
              <div className="flex gap-1 bg-gray-900 rounded-lg p-1 border border-gray-800">
                <button
                  onClick={() => setTimelineTool('select')}
                  className={`p-2 rounded-md transition-colors ${timelineTool === 'select' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                  title="Select Tool (V)"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" /></svg>
                </button>
                <button
                  onClick={() => setTimelineTool('cut')}
                  className={`p-2 rounded-md transition-colors ${timelineTool === 'cut' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                  title="Cut Tool (C)"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 3.293a1 1 0 011.414 0l1.172 1.172a1 1 0 010 1.414l-8.586 8.586a1 1 0 01-1.414 0l-1.172-1.172a1 1 0 010-1.414l8.586-8.586z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 14.121a1 1 0 011.414 0l1.172 1.172a1 1 0 010 1.414l-8.586 8.586a1 1 0 01-1.414 0l-1.172-1.172a1 1 0 010-1.414l8.586-8.586z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6" /></svg>
                </button>
                {selectedClipIds.size > 0 && (
                  <button
                    onClick={handleDeleteSelectedClips}
                    className="p-2 text-red-500 hover:bg-gray-800 rounded-md transition-colors"
                    title="Delete Selected (Del)"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                )}
              </div>
            </div>

            {/* Center Transport & Timecode */}
            <div className="flex flex-col items-center justify-center w-1/3 min-w-0 flex-shrink-0">
              <div className="font-mono text-xs text-gray-400 mb-1 tracking-wider">
                <span className="text-white font-semibold">{formatTime(currentTime)}</span>
                <span className="opacity-50 mx-1">/</span>
                <span>{formatTime(totalDuration)}</span>
              </div>
              <div className="flex items-center gap-4">
                <button className="text-gray-400 hover:text-white" onClick={() => handleSeek(0)}>
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z" /></svg>
                </button>
                <button
                  className="w-8 h-8 flex items-center justify-center bg-white text-black rounded-full hover:bg-gray-200 transition-colors"
                  onClick={handlePlayPause}
                >
                  {isPlaying ? (
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                  ) : (
                    <svg className="w-3 h-3 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                  )}
                </button>
                <button className="text-gray-400 hover:text-white" onClick={() => handleSeek(totalDuration)}>
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z" /></svg>
                </button>
              </div>
            </div>

            {/* Right Actions */}
            <div className="flex items-center justify-end gap-3 w-1/3 min-w-0 flex-shrink-0">
              <div className="flex items-center gap-2 bg-gray-900 px-3 py-1.5 rounded-lg border border-gray-800">
                <span className="text-xs text-gray-400">Timeline</span>
                <button onClick={() => setTimelineZoom(Math.max(minZoom, timelineZoom - 10))} className="text-gray-400 hover:text-white"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg></button>
                <input type="range" min={minZoom} max={maxZoom} value={timelineZoom} onChange={(e) => setTimelineZoom(parseInt(e.target.value))} className="w-20 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer" />
                <button onClick={() => setTimelineZoom(Math.min(maxZoom, timelineZoom + 10))} className="text-gray-400 hover:text-white"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg></button>
              </div>
              <div className="flex items-center gap-2 bg-gray-900 px-3 py-1.5 rounded-lg border border-gray-800">
                <span className="text-xs text-gray-400">Canvas</span>
                <button onClick={() => setCanvasZoom(Math.max(0.1, canvasZoom - 0.1))} className="text-gray-400 hover:text-white"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg></button>
                <input type="range" min="0.1" max="2" step="0.1" value={canvasZoom} onChange={(e) => setCanvasZoom(parseFloat(e.target.value))} className="w-20 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer" />
                <button onClick={() => setCanvasZoom(Math.min(2, canvasZoom + 0.1))} className="text-gray-400 hover:text-white"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg></button>
                <span className="text-xs text-gray-400 min-w-[3rem] text-right">{Math.round(canvasZoom * 100)}%</span>
              </div>
              <div className="flex items-center gap-2 bg-gray-900 px-3 py-1.5 rounded-lg border border-gray-800">
                <span className="text-xs text-gray-400">Layers</span>
                <button onClick={() => setTimelineLayerHeightScale(Math.max(0.1, timelineLayerHeightScale - 0.1))} className="text-gray-400 hover:text-white"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg></button>
                <input type="range" min="0.1" max="3" step="0.1" value={timelineLayerHeightScale} onChange={(e) => setTimelineLayerHeightScale(parseFloat(e.target.value))} className="w-20 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer" />
                <button onClick={() => setTimelineLayerHeightScale(Math.min(3, timelineLayerHeightScale + 0.1))} className="text-gray-400 hover:text-white"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg></button>
                <span className="text-xs text-gray-400 min-w-[3rem] text-right">{Math.round(timelineLayerHeightScale * 100)}%</span>
              </div>
              <div className="h-4 w-px bg-gray-800 mx-1"></div>
              <button onClick={() => setShowExportDialog(true)} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm shadow-blue-900/20">
                Export
              </button>
            </div>
          </div>

          {/* Timeline Scroll Container */}
          <div
              className="flex-1 overflow-x-auto overflow-y-hidden bg-[#050505] relative custom-scrollbar select-none min-w-0"
            data-timeline-container
              style={{ paddingBottom: '20px', width: '100%' }}
          >
            {/* Timeline Header (Time Scale) - Fixed Top Area specifically for scrubbing */}
            <div
              className="sticky top-0 z-30 h-10 border-b border-gray-800 bg-[#0A0A0A] cursor-pointer w-full min-w-full"
              onMouseDown={(e) => {
                e.preventDefault()
                e.stopPropagation()
                const headerElement = e.currentTarget
                const rect = headerElement.getBoundingClientRect()
                // Calculate x position relative to the header's left edge (accounting for scroll)
                const x = Math.max(0, e.clientX - rect.left + headerElement.scrollLeft)
                const time = Math.max(0, x / timelineZoom) // Ensure time is never negative
                handleSeek(time, true)

                const handleMouseMove = (mv: MouseEvent) => {
                  // Update rect in case of scroll/resize during drag (optional but safer)
                  // const currentRect = headerElement.getBoundingClientRect() 
                  // actually rect relative to viewport shouldn't change if container is sticky top, 
                  // but if page scrolls it might. Let's trust initial rect for now or update it.
                  // Simpler: Just rely on cached rect + current scrollLeft
                  const newX = mv.clientX - rect.left + headerElement.scrollLeft
                  const time = Math.max(0, newX / timelineZoom) // Ensure time is never negative
                  handleSeek(time, true)
                }
                const handleMouseUp = () => {
                  window.removeEventListener('mousemove', handleMouseMove)
                  window.removeEventListener('mouseup', handleMouseUp)
                }
                window.addEventListener('mousemove', handleMouseMove)
                window.addEventListener('mouseup', handleMouseUp)
              }}
              style={{ minWidth: `${Math.max(window.innerWidth, (Number.isFinite(totalDuration) ? totalDuration : 0) * timelineZoom + 200)}px` }}
            >
              {/* Time Markers */}
              {Array.from({ length: Math.ceil(Number.isFinite(totalDuration) ? totalDuration : 0) + 1 }).map((_, i) => (
                <div key={i} className="absolute bottom-0 h-4 border-l border-gray-700" style={{ left: `${i * timelineZoom}px` }}>
                  <span className="absolute bottom-full left-1 text-[10px] text-gray-500 font-mono mb-1 pointer-events-none">
                    {formatTime(i)}
                  </span>
                  {/* Sub-markers */}
                  {[0.25, 0.5, 0.75].map(sub => (
                    <div key={sub} className="absolute bottom-0 h-2 border-l border-gray-800" style={{ left: `${sub * timelineZoom}px` }} />
                  ))}
                </div>
              ))}

              {/* Playhead Handle (In Header) */}
              <div
                className="absolute top-1 z-40 transform -translate-x-1/2 pointer-events-none transition-transform duration-75"
                style={{ left: `${currentTime * timelineZoom}px` }}
              >
                <svg width="18" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-md">
                  <path d="M12 24L0 12C0 5.37258 5.37258 0 12 0C18.6274 0 24 5.37258 24 12L12 24Z" fill="#9CA3AF" />
                </svg>
              </div>
            </div>

            {/* Tracks Container */}
            <div
              className="relative min-w-full"
              style={{ 
                minWidth: `${Math.max(window.innerWidth, (Number.isFinite(totalDuration) ? totalDuration : 0) * timelineZoom + 200)}px`,
                paddingTop: `${1 * timelineLayerHeightScale}rem`,
                paddingRight: '1rem',
                paddingBottom: `${1 * timelineLayerHeightScale}rem`,
                paddingLeft: '0', // No left padding so time 0 aligns with the left edge
                gap: `${1 * timelineLayerHeightScale}rem`,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Playhead Line (Extends through tracks) */}
              <div
                className="absolute top-0 bottom-0 w-px bg-gray-500/50 z-20 pointer-events-none"
                style={{ left: `${currentTime * timelineZoom}px` }}
              />

              {/* Scene Labels Row (Optional, helpful context) */}
              <div className="relative w-full" style={{ height: `${6 * timelineLayerHeightScale * 4}px` }}>
                {sceneTakes.map((st, idx) => (
                  <div
                    key={st.sceneId}
                    className="absolute top-0 text-xs font-semibold text-gray-500 flex items-center"
                    style={{ left: `${st.startTime * timelineZoom}px` }}
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-600 mr-2" />
                    SCENE {idx + 1}
                  </div>
                ))}
              </div>

              {/* TRACK 1: LAYOUT (Orange, Top) */}
              <div className="relative w-full" style={{ height: `${16 * timelineLayerHeightScale * 4}px` }}>
                <div className="absolute inset-x-0 h-full bg-gray-900/30 rounded-2xl border border-gray-800 border-dashed opacity-50" />

                {/* Layout clips - individual clips that can be split, moved, and trimmed */}
                {layoutClips.map(layoutClip => {
                  const clipDuration = layoutClip.timelineEnd - layoutClip.timelineStart
                  const isDragging = draggingLayoutClipId === layoutClip.id
                  const isTrimming = trimmingLayoutClipId === layoutClip.id
                  const isSelected = selectedLayoutClipIds.has(layoutClip.id)
                  const hasImage = layoutClip.backgroundImage?.enabled && layoutClip.backgroundImage?.url
                  const hasTitle = layoutClip.title?.enabled && layoutClip.title?.text
                  
                  return (
                    <div
                      key={layoutClip.id}
                      data-layout-clip-id={layoutClip.id}
                      className={`absolute top-0 bottom-0 bg-orange-600 rounded-2xl overflow-hidden border transition-all cursor-move group
                                   ${isSelected ? 'border-white ring-1 ring-white z-10' : 'border-orange-500'}
                                   ${isDragging ? 'opacity-80 scale-[1.01] shadow-xl z-20' : ''}
                                   ${isTrimming ? 'z-30' : ''}
                                `}
                      style={{
                        left: `${layoutClip.timelineStart * timelineZoom}px`,
                        width: `${Math.max(2, clipDuration * timelineZoom)}px`,
                      }}
                      onMouseDown={(e) => {
                        if ((e.target as HTMLElement).closest('.trim-handle')) return
                        e.stopPropagation()
                        if (timelineTool === 'select') {
                          // Start moving if not clicking to select
                          if (!isSelected) {
                            handleStartMoveLayoutClip(layoutClip.id, e.clientX)
                          }
                        } else if (timelineTool === 'cut') {
                          const cutTime = (e.clientX - e.currentTarget.parentElement!.getBoundingClientRect().left) / timelineZoom
                          handleSplitLayoutClip(cutTime)
                        }
                      }}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest('.trim-handle')) return
                        e.stopPropagation()
                        // Select/deselect layout clip
                        setSelectedLayoutClipIds(prev => {
                          const newSet = new Set(prev)
                          if (newSet.has(layoutClip.id)) {
                            newSet.delete(layoutClip.id)
                          } else {
                            newSet.clear() // Exclusive selection
                            newSet.add(layoutClip.id)
                          }
                          return newSet
                        })
                        // Deselect video clips when selecting layout clip
                        setSelectedClipIds(new Set())
                        setSelectedClip(null)
                      }}
                    >
                      {/* Layout Clip Info */}
                      <div className="absolute left-3 top-2 right-3 flex justify-between items-start z-10 pointer-events-none">
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1v-3z" />
                          </svg>
                          <span className="text-xs font-semibold text-white drop-shadow-md truncate">
                            {layoutClip.name || 'Layout'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          {hasImage && (
                            <svg className="w-3 h-3 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          )}
                          {hasTitle && (
                            <svg className="w-3 h-3 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                            </svg>
                          )}
                        </div>
                      </div>

                      {/* Trim Handles */}
                      <div
                        className={`trim-handle absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-white/20 transition-colors z-20 flex items-center justify-center
                                  ${isSelected ? 'bg-white/10' : 'opacity-0 group-hover:opacity-100'}`}
                        onMouseDown={(e) => { e.stopPropagation(); handleStartTrimLayoutClip(layoutClip.id, 'in', e.clientX) }}
                      >
                        <div className="h-6 w-0.5 bg-white/50 rounded-full" />
                      </div>
                      <div
                        className={`trim-handle absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-white/20 transition-colors z-20 flex items-center justify-center
                                  ${isSelected ? 'bg-white/10' : 'opacity-0 group-hover:opacity-100'}`}
                        onMouseDown={(e) => { e.stopPropagation(); handleStartTrimLayoutClip(layoutClip.id, 'out', e.clientX) }}
                      >
                        <div className="h-6 w-0.5 bg-white/50 rounded-full" />
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* TRACK 2: CAMERA & SCREEN (Visuals) */}
              {(timelineClips.some(c => c.layer === 'camera' || c.layer === 'screen')) && (
                <div className="relative w-full" style={{ height: `${timelineTrackHeight * timelineLayerHeightScale}px` }}>
                  {/* Track Background/Gutter */}
                  <div className="absolute inset-x-0 h-full bg-gray-900/30 rounded-2xl" />

                  {timelineClips
                    .filter(c => c.layer === 'camera' || c.layer === 'screen')
                    .map(clip => {
                      const isSelected = selectedClipIds.has(clip.id)
                      const clipDuration = clip.timelineEnd - clip.timelineStart
                      const isDragging = draggingClipId === clip.id
                      const isTrimming = trimmingClipId === clip.id

                      return (
                        <div
                          key={clip.id}
                          data-clip-id={clip.id}
                          className={`absolute top-0 bottom-0 bg-[#3b82f6] rounded-2xl overflow-hidden border transition-all cursor-move group
                                       ${isSelected ? 'border-white ring-1 ring-white z-10' : 'border-[#3b82f6]'}
                                       ${isDragging ? 'opacity-80 scale-[1.01] shadow-xl z-20' : ''}
                                       ${isTrimming ? 'z-30' : ''}
                                    `}
                          style={{
                            left: `${clip.timelineStart * timelineZoom}px`,
                            width: `${Math.max(2, clipDuration * timelineZoom)}px`, // Min width to be visible
                          }}
                          onMouseDown={(e) => {
                            if ((e.target as HTMLElement).closest('.trim-handle')) return
                            e.stopPropagation()
                            if (timelineTool === 'select') handleStartMoveClip(clip.id, e.clientX)
                            else if (timelineTool === 'cut') handleCutClip(clip.id, (e.clientX - e.currentTarget.parentElement!.getBoundingClientRect().left) / timelineZoom)
                          }}
                          onClick={(e) => {
                            if ((e.target as HTMLElement).closest('.trim-handle')) return
                            const clickTime = (e.clientX - e.currentTarget.parentElement!.getBoundingClientRect().left) / timelineZoom
                            handleClipClick(clip.id, clickTime)
                          }}
                        >
                          {/* Thumbnails */}
                          <div className="absolute inset-0 flex overflow-hidden opacity-50 pointer-events-none select-none">
                            {/* Repeating thumbnails could go here, simplified to one for now */}
                            {videoThumbnails.get(`${clip.sceneId}_${clip.takeId}_${clip.layer}`) && (
                              <img
                                src={videoThumbnails.get(`${clip.sceneId}_${clip.takeId}_${clip.layer}`)}
                                className="h-full w-auto object-cover max-w-none"
                                alt=""
                              />
                            )}
                          </div>

                          {/* Clip Info */}
                          <div className="absolute left-3 top-2 right-3 flex justify-between items-start z-10 pointer-events-none">
                            <span className="text-xs font-semibold text-white drop-shadow-md truncate">
                              {clip.layer === 'camera' ? 'Camera' : 'Screen'}
                            </span>
                          </div>

                          {/* Trim Handles (Visible on hover/select) */}
                          <div
                            className={`trim-handle absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-white/20 transition-colors z-20 flex items-center justify-center
                                      ${isSelected ? 'bg-white/10' : 'opacity-0 group-hover:opacity-100'}`}
                            onMouseDown={(e) => { e.stopPropagation(); handleStartTrimClip(clip.id, 'in', e.clientX) }}
                          >
                            <div className="h-6 w-0.5 bg-white/50 rounded-full" />
                          </div>
                          <div
                            className={`trim-handle absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-white/20 transition-colors z-20 flex items-center justify-center
                                      ${isSelected ? 'bg-white/10' : 'opacity-0 group-hover:opacity-100'}`}
                            onMouseDown={(e) => { e.stopPropagation(); handleStartTrimClip(clip.id, 'out', e.clientX) }}
                          >
                            <div className="h-6 w-0.5 bg-white/50 rounded-full" />
                          </div>
                        </div>
                      )
                    })}
                </div>
              )}

              {/* TRACK 2: MICROPHONE (Audio) */}
              {(timelineClips.some(c => c.layer === 'microphone')) && (
                <div className="relative w-full" style={{ height: `${timelineTrackHeight * timelineLayerHeightScale}px` }}> {/* Dynamic Height */}
                  <div className="absolute inset-x-0 h-full bg-gray-900/30 rounded-2xl" />

                  {timelineClips
                    .filter(c => c.layer === 'microphone')
                    .map(clip => {
                      const isSelected = selectedClipIds.has(clip.id)
                      const clipDuration = clip.timelineEnd - clip.timelineStart
                      const isDragging = draggingClipId === clip.id
                      const isTrimming = trimmingClipId === clip.id

                      return (
                        <div
                          key={clip.id}
                          className={`absolute top-0 bottom-0 bg-zinc-800 rounded-2xl overflow-hidden border transition-all cursor-move group
                                       ${isSelected ? 'border-white ring-1 ring-white z-10' : 'border-zinc-700'}
                                       ${isDragging ? 'opacity-80 scale-[1.01] shadow-xl z-20' : ''}
                                       ${isTrimming ? 'z-30' : ''}
                                    `}
                          style={{
                            left: `${clip.timelineStart * timelineZoom}px`,
                            width: `${Math.max(2, clipDuration * timelineZoom)}px`,
                          }}
                          onMouseDown={(e) => {
                            if ((e.target as HTMLElement).closest('.trim-handle')) return
                            e.stopPropagation()
                            if (timelineTool === 'select') handleStartMoveClip(clip.id, e.clientX)
                            else if (timelineTool === 'cut') handleCutClip(clip.id, (e.clientX - e.currentTarget.parentElement!.getBoundingClientRect().left) / timelineZoom)
                          }}
                          onClick={(e) => {
                            if ((e.target as HTMLElement).closest('.trim-handle')) return
                            const clickTime = (e.clientX - e.currentTarget.parentElement!.getBoundingClientRect().left) / timelineZoom
                            handleClipClick(clip.id, clickTime)
                          }}
                        >
                          <TimelineAudioClip
                            sceneId={clip.sceneId}
                            takeId={clip.takeId}
                            startOffset={clip.sourceIn}
                            duration={clip.sourceOut - clip.sourceIn} // Use pure source duration
                            width={clipDuration * timelineZoom}
                            height={timelineTrackHeight * timelineLayerHeightScale}
                            color="#a1a1aa"
                          />

                          {/* Trim Handles */}
                          <div
                            className={`trim-handle absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-white/20 transition-colors z-20 flex items-center justify-center
                                      ${isSelected ? 'bg-white/10' : 'opacity-0 group-hover:opacity-100'}`}
                            onMouseDown={(e) => { e.stopPropagation(); handleStartTrimClip(clip.id, 'in', e.clientX) }}
                          >
                            <div className="h-6 w-0.5 bg-white/50 rounded-full" />
                          </div>
                          <div
                            className={`trim-handle absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-white/20 transition-colors z-20 flex items-center justify-center
                                      ${isSelected ? 'bg-white/10' : 'opacity-0 group-hover:opacity-100'}`}
                            onMouseDown={(e) => { e.stopPropagation(); handleStartTrimClip(clip.id, 'out', e.clientX) }}
                          >
                            <div className="h-6 w-0.5 bg-white/50 rounded-full" />
                          </div>
                        </div>
                      )
                    })}
                </div>
              )}


                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Unsplash Search Modal */}
        {unsplashModalOpen && (
          <div 
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setUnsplashModalOpen(false)
                setUnsplashSearchQuery('')
                setUnsplashResults([])
              }
            }}
          >
            <div className="bg-gray-900 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
              {/* Modal Header */}
              <div className="p-4 border-b border-gray-700 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Search Unsplash</h3>
                <button
                  onClick={() => {
                    setUnsplashModalOpen(false)
                    setUnsplashSearchQuery('')
                    setUnsplashResults([])
                  }}
                  className="text-gray-400 hover:text-white"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Search Input */}
              <div className="p-4 border-b border-gray-700">
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={unsplashSearchQuery}
                    onChange={(e) => setUnsplashSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        searchUnsplash(unsplashSearchQuery)
                      }
                    }}
                    placeholder="Search for images (e.g., nature, abstract, gradient)..."
                    className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={() => searchUnsplash(unsplashSearchQuery)}
                    disabled={unsplashLoading || !unsplashSearchQuery.trim()}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm rounded"
                  >
                    {unsplashLoading ? 'Searching...' : 'Search'}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    placeholder="Unsplash API Key (optional)"
                    defaultValue={localStorage.getItem('unsplash_access_key') || ''}
                    onChange={(e) => {
                      if (e.target.value.trim()) {
                        localStorage.setItem('unsplash_access_key', e.target.value.trim())
                      } else {
                        localStorage.removeItem('unsplash_access_key')
                      }
                    }}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <a
                    href="https://unsplash.com/developers"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300 whitespace-nowrap"
                  >
                    Get API Key
                  </a>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  {localStorage.getItem('unsplash_access_key') 
                    ? '✓ Using official Unsplash API for better results'
                    : 'Using Unsplash Source API (limited). Add an API key for better search results.'}
                </p>
              </div>

              {/* Results Grid */}
              <div className="flex-1 overflow-y-auto p-4">
                {unsplashLoading ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="text-gray-400">Loading images...</div>
                  </div>
                ) : unsplashResults.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {unsplashResults.map((image) => (
                      <div
                        key={image.id}
                        className="relative group cursor-pointer bg-gray-800 rounded overflow-hidden aspect-square"
                        onClick={() => handleSelectUnsplashImage(image.urls.regular)}
                      >
                        <img
                          src={image.urls.thumb}
                          alt={image.description || 'Unsplash image'}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs text-center p-2">
                            <div className="font-semibold">Click to select</div>
                            {image.description && (
                              <div className="text-gray-300 mt-1 truncate">{image.description}</div>
                            )}
                          </div>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="text-white text-xs truncate">
                            Photo by {image.user.name}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : unsplashSearchQuery ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="text-gray-400 text-center">
                      <p>No results found for "{unsplashSearchQuery}"</p>
                      <p className="text-xs mt-2">Try a different search term</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-64">
                    <div className="text-gray-400 text-center">
                      <p>Enter a search term to find images</p>
                      <p className="text-xs mt-2">Examples: nature, abstract, gradient, landscape</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
    </>
  )
}
