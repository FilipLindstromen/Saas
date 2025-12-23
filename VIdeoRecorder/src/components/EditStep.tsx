import { useState, useEffect, useRef, useCallback } from 'react'
import { Scene, RecordingTake } from '../App'
import { projectManager } from '../utils/projectManager'
import { transcribeAudio, WordTimestamp } from '../utils/transcription'
import { VideoCut, Layout, combineLayersWithLayout, concatVideos } from '../utils/videoProcessing'
import { trimVideo } from '../utils/ffmpeg'
import { exportDaVinciResolveTimeline } from '../utils/davinciExport'
import { parseCubeLUT, applyLUTToImageData } from '../utils/lutProcessor'
import { analyzeWaveform } from '../utils/waveformAnalyzer'
import SettingsPanel from './SettingsPanel'

interface EditStepProps {
  scenes: Scene[]
  onScenesChange?: (scenes: Scene[]) => void
}

type SidebarTab = 'canvas' | 'layout' | 'clip' | 'zoom' | 'cursor' | 'captions' | 'audio' | 'visual'

interface SceneTake {
  sceneId: string
  sceneIndex: number
  take: RecordingTake
  startTime: number // Start time in the combined timeline
  endTime: number // End time in the combined timeline
  trimmedStart: number // Amount trimmed from start (in seconds)
  trimmedEnd: number // Amount trimmed from end (in seconds)
}

export default function EditStep({ scenes, onScenesChange }: EditStepProps) {
  // Get all selected takes from all scenes, arranged sequentially
  const [sceneTakes, setSceneTakes] = useState<SceneTake[]>([])
  const [selectedSceneIndex, setSelectedSceneIndex] = useState<number>(0)
  
  // Current scene being edited
  const currentSceneTake = sceneTakes[selectedSceneIndex]
  const selectedSceneId = currentSceneTake?.sceneId || ''
  const selectedTake = currentSceneTake?.take || null
  
  // Video playback
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
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
  
  // Cuts (per scene, stored with sceneId)
  const [cuts, setCuts] = useState<Map<string, VideoCut[]>>(new Map())
  
  // Layout (global)
  const [layout, setLayout] = useState<Layout>({ type: 'camera-only' })
  const [savedLayouts, setSavedLayouts] = useState<Layout[]>([])
  
  // Export selection
  const [selectedScenesForExport, setSelectedScenesForExport] = useState<Set<string>>(new Set())
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState('')
  
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
  })
  
  // Media blobs (for current scene)
  const [cameraBlob, setCameraBlob] = useState<Blob | null>(null)
  const [microphoneBlob, setMicrophoneBlob] = useState<Blob | null>(null)
  const [screenBlob, setScreenBlob] = useState<Blob | null>(null)
  
  // Canvas refs
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const lutCanvasRef = useRef<HTMLCanvasElement>(null)
  const [canvasZoom, setCanvasZoom] = useState(1)
  
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
    { id: 'style4', name: 'Neon Blue', backgroundColor: 'rgba(33, 150, 243, 0.9)', textColor: '#ffffff', padding: '10px 20px', borderRadius: '12px', fontWeight: 600, boxShadow: '0 0 20px rgba(33, 150, 243, 0.5)' },
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
  const [transcriptWidth, setTranscriptWidth] = useState(320)
  const [isResizing, setIsResizing] = useState(false)
  const transcriptResizeRef = useRef<HTMLDivElement>(null)
  
  // Resizable timeline
  const [timelineHeight, setTimelineHeight] = useState(192) // 48 * 4 = 192px (h-48)
  const [isResizingTimeline, setIsResizingTimeline] = useState(false)
  
  // Timeline zoom (pixels per second)
  const [timelineZoom, setTimelineZoom] = useState(50) // Default: 50px per second
  const minZoom = 10 // 10px per second (zoomed out)
  const maxZoom = 200 // 200px per second (zoomed in)
  
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
  
  const [timelineClips, setTimelineClips] = useState<TimelineClip[]>([])
  const [selectedClipIds, setSelectedClipIds] = useState<Set<string>>(new Set())
  const [draggingClipId, setDraggingClipId] = useState<string | null>(null)
  const [draggingOffset, setDraggingOffset] = useState<number>(0)
  const [trimmingClipId, setTrimmingClipId] = useState<string | null>(null)
  const [trimmingEdge, setTrimmingEdge] = useState<'in' | 'out' | null>(null)
  const [trimmingStartPos, setTrimmingStartPos] = useState<number>(0)
  
  // Build scene takes from all scenes with selected takes
  useEffect(() => {
    const takes: SceneTake[] = []
    let currentStartTime = 0
    
    scenes.forEach((scene, index) => {
      const selectedTake = scene.recordings.find(r => r.selected)
      if (selectedTake && selectedTake.duration > 0) {
        takes.push({
          sceneId: scene.id,
          sceneIndex: index,
          take: selectedTake,
          startTime: currentStartTime,
          endTime: currentStartTime + selectedTake.duration,
          trimmedStart: 0,
          trimmedEnd: 0,
        })
        currentStartTime += selectedTake.duration
      }
    })
    
    setSceneTakes(takes)
    setTotalDuration(Math.max(currentStartTime, 1)) // Ensure at least 1 second for timeline display
    
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
      const sourceDuration = sceneTake.take.duration
      
      // Create separate clips for each layer
      if (sceneTake.take.hasCamera) {
        clips.push({
          id: `${sceneTake.sceneId}_${sceneTake.take.id}_camera`,
          sceneId: sceneTake.sceneId,
          takeId: sceneTake.take.id,
          layer: 'camera',
          timelineStart: currentTimelinePos,
          timelineEnd: currentTimelinePos + sourceDuration,
          sourceIn: 0,
          sourceOut: sourceDuration,
          sourceDuration: sourceDuration,
        })
      }
      
      if (sceneTake.take.hasMicrophone) {
        clips.push({
          id: `${sceneTake.sceneId}_${sceneTake.take.id}_microphone`,
          sceneId: sceneTake.sceneId,
          takeId: sceneTake.take.id,
          layer: 'microphone',
          timelineStart: currentTimelinePos,
          timelineEnd: currentTimelinePos + sourceDuration,
          sourceIn: 0,
          sourceOut: sourceDuration,
          sourceDuration: sourceDuration,
        })
      }
      
      if (sceneTake.take.hasScreen) {
        clips.push({
          id: `${sceneTake.sceneId}_${sceneTake.take.id}_screen`,
          sceneId: sceneTake.sceneId,
          takeId: sceneTake.take.id,
          layer: 'screen',
          timelineStart: currentTimelinePos,
          timelineEnd: currentTimelinePos + sourceDuration,
          sourceIn: 0,
          sourceOut: sourceDuration,
          sourceDuration: sourceDuration,
        })
      }
      
      // Move timeline position forward for next scene
      currentTimelinePos += sourceDuration
    })
    
    setTimelineClips(clips)
    
    // Update total duration
    const maxEnd = clips.length > 0 ? Math.max(...clips.map(c => c.timelineEnd)) : 0
    setTotalDuration(Math.max(maxEnd, 1))
  }, [sceneTakes])
  
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
  
  // Handle timeline resize
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingTimeline) return
      const newHeight = window.innerHeight - e.clientY
      setTimelineHeight(Math.max(100, Math.min(600, newHeight)))
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
    const cameraClip = timelineClips.find(c => 
      c.layer === 'camera' && 
      clampedTime >= c.timelineStart && 
      clampedTime < c.timelineEnd
    )
    
    const clip = cameraClip || timelineClips.find(c => 
      clampedTime >= c.timelineStart && 
      clampedTime < c.timelineEnd
    )
    
    if (!clip) return null
    
    // Calculate relative time within the timeline clip
    const relativeTimelineTime = clampedTime - clip.timelineStart
    const clipDuration = clip.timelineEnd - clip.timelineStart
    const sourceDuration = clip.sourceOut - clip.sourceIn
    
    // Map timeline position to source video time
    // If clip is 10 seconds on timeline and source is 5-15 seconds, map proportionally
    const sourceTime = clip.sourceIn + (relativeTimelineTime / clipDuration) * sourceDuration
    
    return { 
      clip, 
      videoTime: Math.max(clip.sourceIn, Math.min(clip.sourceOut, sourceTime)),
      sceneId: clip.sceneId,
      takeId: clip.takeId
    }
  }, [timelineClips, totalDuration])
  
  // Set up video and audio playback (separate elements, synced)
  useEffect(() => {
    const video = videoRef.current
    const audio = audioRef.current
    const canvas = lutCanvasRef.current
    if (!video || !canvas) return
    
    const setupPlayback = async () => {
      // Clean up previous sources
      if (video.srcObject) {
        const stream = video.srcObject as MediaStream
        stream.getTracks().forEach(track => track.stop())
        video.srcObject = null
      }
      if (video.src) {
        URL.revokeObjectURL(video.src)
        video.src = ''
      }
      if (audio && audio.src) {
        URL.revokeObjectURL(audio.src)
        audio.src = ''
      }
      
      // Set video source
      if (cameraBlob) {
        video.src = URL.createObjectURL(cameraBlob)
        video.muted = true // Mute video to avoid double audio if it has audio
      } else if (screenBlob) {
        video.src = URL.createObjectURL(screenBlob)
        video.muted = true
      }
      
      // Set audio source (from microphone)
      if (audio && microphoneBlob) {
        audio.src = URL.createObjectURL(microphoneBlob)
      }
      
      // Sync audio with video
      const syncAudio = () => {
        if (audio && video) {
          audio.currentTime = video.currentTime
        }
      }
      
      // Function to draw video frame to canvas with LUT
      const drawFrame = () => {
        if (!video || !canvas || video.readyState < 2) return
        
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        
        // Keep canvas at native video resolution for quality
        // CSS will handle the scaling based on videoSize
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
        }
        
        // Draw video frame
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        
        // Apply LUT if enabled
        if (visualSettings.lutEnabled && lutData && visualSettings.lutIntensity > 0) {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const processedData = applyLUTToImageData(imageData, lutData, visualSettings.lutIntensity)
          ctx.putImageData(processedData, 0, 0)
        }
      }
      
      video.onloadedmetadata = () => {
        if (audio && microphoneBlob) {
          audio.load()
        }
        // Set initial size based on video dimensions
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          const aspectRatio = video.videoWidth / video.videoHeight
          setVideoAspectRatio(aspectRatio)
          // Set initial size to 80% of container, maintaining aspect ratio
          setVideoSize({ width: 80, height: 80 })
        }
        drawFrame()
      }
      
      video.ontimeupdate = () => {
        // Sync audio to video
        if (audio && Math.abs(audio.currentTime - video.currentTime) > 0.1) {
          audio.currentTime = video.currentTime
        }
        
        // Draw frame with LUT
        drawFrame()
        
        // Convert video time back to timeline time using clip system
        const videoTime = video.currentTime
        
        // Find the current clip based on selected scene/take
        if (selectedTake && selectedSceneId) {
          // Find clips for this scene/take
          const currentClips = timelineClips.filter(c => 
            c.sceneId === selectedSceneId && c.takeId === selectedTake.id
          )
          
          // Find which clip's source range contains this video time
          const currentClip = currentClips.find(c => 
            videoTime >= c.sourceIn && videoTime < c.sourceOut
          )
          
          if (currentClip) {
            // Map source video time to timeline time
            const sourceDuration = currentClip.sourceOut - currentClip.sourceIn
            const clipDuration = currentClip.timelineEnd - currentClip.timelineStart
            const relativeSourceTime = videoTime - currentClip.sourceIn
            const relativeTimelineTime = (relativeSourceTime / sourceDuration) * clipDuration
            const absoluteTime = currentClip.timelineStart + relativeTimelineTime
            
            setCurrentTime(Math.max(currentClip.timelineStart, Math.min(currentClip.timelineEnd, absoluteTime)))
            
            // Check if we've reached the end of this clip
            if (videoTime >= currentClip.sourceOut - 0.05) {
              // Find next clip in timeline
              const nextClip = timelineClips
                .filter(c => c.timelineStart > currentClip.timelineEnd)
                .sort((a, b) => a.timelineStart - b.timelineStart)[0]
              
              if (nextClip) {
                // Move to next clip
                const nextSceneIndex = sceneTakes.findIndex(st => 
                  st.sceneId === nextClip.sceneId && st.take.id === nextClip.takeId
                )
                if (nextSceneIndex >= 0) {
                  setSelectedSceneIndex(nextSceneIndex)
                  setTimeout(() => {
                    const v = videoRef.current
                    const a = audioRef.current
                    if (v && v.readyState >= 2) {
                      v.currentTime = nextClip.sourceIn
                      if (a && a.readyState >= 2) {
                        a.currentTime = nextClip.sourceIn
                      }
                    }
                  }, 100)
                }
              } else {
                // No more clips, stop playback
                video.pause()
                if (audio) audio.pause()
                setIsPlaying(false)
              }
            }
          } else {
            // Video time doesn't match any clip, try to find the right clip
            const result = timelineToVideoTime(currentTime)
            if (result && (result.sceneId !== selectedSceneId || result.takeId !== selectedTake.id)) {
              const nextSceneIndex = sceneTakes.findIndex(st => 
                st.sceneId === result.sceneId && st.take.id === result.takeId
              )
              if (nextSceneIndex >= 0) {
                setSelectedSceneIndex(nextSceneIndex)
                setTimeout(() => {
                  const v = videoRef.current
                  const a = audioRef.current
                  if (v && v.readyState >= 2) {
                    v.currentTime = result.videoTime
                    if (a && a.readyState >= 2) {
                      a.currentTime = result.videoTime
                    }
                  }
                }, 100)
              }
            }
          }
        } else {
          // No selected take, just use video time directly (fallback)
          setCurrentTime(videoTime)
        }
      }
      
      video.onplay = () => {
        setIsPlaying(true)
        if (audio) {
          // Sync audio to video time
          audio.currentTime = video.currentTime
          audio.play().catch(err => console.error('Error playing audio:', err))
        }
        // Start drawing frames
        const drawLoop = () => {
          if (video && !video.paused && !video.ended) {
            drawFrame()
            requestAnimationFrame(drawLoop)
          }
        }
        drawLoop()
        
        // Ensure we start from the correct position accounting for trims
        // Note: timelineToVideoTime is defined below, so we'll handle this in ontimeupdate instead
      }
      
      video.onpause = () => {
        setIsPlaying(false)
        if (audio) {
          audio.pause()
        }
      }
      
      video.onended = () => {
        // When video ends, check if we should continue to next scene
        // (This is handled in ontimeupdate when reaching trimmed end)
        setIsPlaying(false)
        if (audio) {
          audio.pause()
        }
      }
      
      video.onseeked = () => {
        syncAudio()
        drawFrame()
      }
    }
    
    setupPlayback()
    
    return () => {
      if (video.srcObject) {
        const stream = video.srcObject as MediaStream
        stream.getTracks().forEach(track => track.stop())
        video.srcObject = null
      }
      if (video.src) {
        URL.revokeObjectURL(video.src)
      }
      if (audio && audio.src) {
        URL.revokeObjectURL(audio.src)
      }
    }
  }, [cameraBlob, microphoneBlob, screenBlob, currentSceneTake, visualSettings.lutEnabled, visualSettings.lutIntensity, lutData, cuts, timelineToVideoTime, currentTime, sceneTakes, selectedSceneIndex])
  
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
  
  // Get caption style for a word
  const getCaptionStyleForWord = (sceneId: string, wordIndex: number): CaptionStyleId => {
    return captionWordStyles.get(sceneId)?.get(wordIndex) || 'none'
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
    
    // Remove the segment corresponding to the selected word
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
  }, [selectedText, sceneTakes, handleRemoveSegment, transcripts])
  
  // Handle keyboard delete key to create cuts from selected words
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedText) {
          e.preventDefault()
          handleCreateCut()
        }
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [selectedText, handleCreateCut])
  
  // Delete cut
  const handleDeleteCut = (cutId: string, sceneId: string) => {
    const sceneCuts = cuts.get(sceneId) || []
    const updatedCuts = new Map(cuts)
    updatedCuts.set(sceneId, sceneCuts.filter(c => c.id !== cutId))
    setCuts(updatedCuts)
  }
  
  // ========== NEW CLIP-BASED EDITING FUNCTIONS ==========
  
  // Cut clip - split at timeline position
  const handleCutClip = useCallback((clipId: string, cutTime: number) => {
    const clip = timelineClips.find(c => c.id === clipId)
    if (!clip) return
    
    // Calculate relative position within clip
    const relativeTime = cutTime - clip.timelineStart
    const clipDuration = clip.timelineEnd - clip.timelineStart
    
    // Don't cut if too close to edges
    if (relativeTime <= 0.1 || relativeTime >= clipDuration - 0.1) return
    
    // Calculate source time at cut point
    const sourceTimeAtCut = clip.sourceIn + (relativeTime / clipDuration) * (clip.sourceOut - clip.sourceIn)
    
    // Create two new clips
    const clip1: TimelineClip = {
      ...clip,
      id: `${clip.id}_part1_${Date.now()}`,
      timelineEnd: cutTime,
      sourceOut: sourceTimeAtCut,
    }
    
    const clip2: TimelineClip = {
      ...clip,
      id: `${clip.id}_part2_${Date.now()}`,
      timelineStart: cutTime,
      sourceIn: sourceTimeAtCut,
    }
    
    // Replace original clip with two new clips
    setTimelineClips(prev => {
      const filtered = prev.filter(c => c.id !== clipId)
      const updated = [...filtered, clip1, clip2].sort((a, b) => a.timelineStart - b.timelineStart)
      
      // Update total duration
      const maxEnd = updated.length > 0 ? Math.max(...updated.map(c => c.timelineEnd)) : 0
      setTotalDuration(Math.max(maxEnd, 1))
      
      return updated
    })
  }, [timelineClips])
  
  // Move clip - drag horizontally (optimized for smooth dragging)
  const handleStartMoveClip = useCallback((clipId: string, mouseX: number) => {
    const clip = timelineClips.find(c => c.id === clipId)
    if (!clip) return
    
    setDraggingClipId(clipId)
    const timelineContainer = document.querySelector('[data-timeline-container]') as HTMLElement
    if (!timelineContainer) return
    
    const containerRect = timelineContainer.getBoundingClientRect()
    const initialX = mouseX - containerRect.left
    const initialTime = initialX / timelineZoom
    const offset = initialTime - clip.timelineStart
    setDraggingOffset(offset)
    
    // Set up smooth dragging
    const handleMouseMove = (e: MouseEvent) => {
      const rect = timelineContainer.getBoundingClientRect()
      const x = e.clientX - rect.left
      const time = Math.max(0, x / timelineZoom - offset)
      const clipDuration = clip.timelineEnd - clip.timelineStart
      const newTimelineEnd = time + clipDuration
      
      // Update immediately for smooth dragging
      setTimelineClips(prev => {
        const updated = prev.map(c => {
          if (c.id === clipId) {
            return {
              ...c,
              timelineStart: time,
              timelineEnd: newTimelineEnd,
            }
          }
          return c
        })
        
        // Update total duration
        const maxEnd = updated.length > 0 ? Math.max(...updated.map(c => c.timelineEnd)) : 0
        setTotalDuration(Math.max(maxEnd, 1))
        
        return updated
      })
    }
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      setDraggingClipId(null)
      setDraggingOffset(0)
    }
    
    document.addEventListener('mousemove', handleMouseMove, { passive: true })
    document.addEventListener('mouseup', handleMouseUp)
  }, [timelineClips, timelineZoom])
  
  // Trim clip - drag edges to adjust in/out points (optimized for smooth trimming)
  const handleStartTrimClip = useCallback((clipId: string, edge: 'in' | 'out', mouseX: number) => {
    const clip = timelineClips.find(c => c.id === clipId)
    if (!clip) return
    
    setTrimmingClipId(clipId)
    setTrimmingEdge(edge)
    
    const timelineContainer = document.querySelector('[data-timeline-container]') as HTMLElement
    if (!timelineContainer) return
    
    const clipDuration = clip.timelineEnd - clip.timelineStart
    const sourceDuration = clip.sourceOut - clip.sourceIn
    
    // Set up smooth trimming
    const handleMouseMove = (e: MouseEvent) => {
      const rect = timelineContainer.getBoundingClientRect()
      const x = e.clientX - rect.left
      const newTime = Math.max(0, Math.min(totalDuration, x / timelineZoom))
      
      if (edge === 'in') {
        // Trimming start (left edge)
        const newTimelineStart = Math.max(0, Math.min(newTime, clip.timelineEnd - 0.1))
        const trimAmount = clip.timelineStart - newTimelineStart
        const sourceTrimAmount = (trimAmount / clipDuration) * sourceDuration
        const newSourceIn = Math.max(0, Math.min(clip.sourceOut - 0.1, clip.sourceIn - sourceTrimAmount))
        
        if (newSourceIn < 0 || newSourceIn >= clip.sourceOut) return
        
        setTimelineClips(prev => prev.map(c => {
          if (c.id === clipId) {
            return {
              ...c,
              timelineStart: newTimelineStart,
              sourceIn: newSourceIn,
            }
          }
          return c
        }))
      } else {
        // Trimming end (right edge)
        const newTimelineEnd = Math.max(clip.timelineStart + 0.1, newTime)
        const trimAmount = newTimelineEnd - clip.timelineEnd
        const sourceTrimAmount = (trimAmount / clipDuration) * sourceDuration
        const newSourceOut = Math.min(clip.sourceDuration, Math.max(clip.sourceIn + 0.1, clip.sourceOut + sourceTrimAmount))
        
        if (newSourceOut > clip.sourceDuration || newSourceOut <= clip.sourceIn) return
        
        setTimelineClips(prev => {
          const updated = prev.map(c => {
            if (c.id === clipId) {
              return {
                ...c,
                timelineEnd: newTimelineEnd,
                sourceOut: newSourceOut,
              }
            }
            return c
          })
          
          // Update total duration
          const maxEnd = updated.length > 0 ? Math.max(...updated.map(c => c.timelineEnd)) : 0
          setTotalDuration(Math.max(maxEnd, 1))
          
          return updated
        })
      }
    }
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      setTrimmingClipId(null)
      setTrimmingEdge(null)
      setTrimmingStartPos(0)
    }
    
    document.addEventListener('mousemove', handleMouseMove, { passive: true })
    document.addEventListener('mouseup', handleMouseUp)
    
    const rect = timelineContainer.getBoundingClientRect()
    const clickX = mouseX - rect.left
    const clickTime = clickX / timelineZoom
    setTrimmingStartPos(clickTime)
  }, [timelineClips, timelineZoom, totalDuration])
  
  // Handle clip click - select or cut
  const handleClipClick = useCallback((clipId: string, clickTime: number) => {
    if (timelineTool === 'cut') {
      handleCutClip(clipId, clickTime)
    } else {
      // Select tool - toggle selection
      setSelectedClipIds(prev => {
        const newSet = new Set(prev)
        if (newSet.has(clipId)) {
          newSet.delete(clipId)
        } else {
          newSet.add(clipId)
        }
        return newSet
      })
      
      const clip = timelineClips.find(c => c.id === clipId)
      if (clip) {
        setSelectedClip({
          sceneId: clip.sceneId,
          takeId: clip.takeId,
          layer: clip.layer,
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
  
  const handleSeek = (absoluteTime: number, immediate: boolean = false) => {
    // Update timeline position immediately for smooth scrubbing
    const clampedTime = Math.max(0, Math.min(totalDuration, absoluteTime))
    setCurrentTime(clampedTime)
    
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
          video.currentTime = videoTime
        } else {
          // Wait for video to be ready
          const onCanPlay = () => {
            if (video) {
              video.currentTime = videoTime
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
    
    if (immediate || !needsSceneSwitch) {
      // Immediate seek if no scene switch needed or if immediate flag is set
      requestAnimationFrame(seekToTime)
    } else {
      // Wait a bit for scene to load if switching scenes
      setTimeout(seekToTime, 100)
    }
  }
  
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    const ms = Math.floor((seconds % 1) * 10)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms}`
  }
  
  // Layout management
  const handleLayoutChange = (newLayout: Layout) => {
    setLayout(newLayout)
  }
  
  const handleSaveLayout = () => {
    if (layout.type === 'custom' && layout.name) {
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
    
    setIsExporting(true)
    setExportProgress('Initializing FFmpeg...')
    
    try {
      // Process each scene: load, trim based on timeline clips, apply cuts, combine layers
      const processedSceneBlobs: Blob[] = []
      
      for (let i = 0; i < scenesToExport.length; i++) {
        const sceneTake = scenesToExport[i]
        setExportProgress(`Processing scene ${i + 1} of ${scenesToExport.length}...`)
        
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
          const cameraClip = sceneClips.find(c => c.layer === 'camera')
          if (cameraClip) {
            const originalBlob = await projectManager.loadRecording(
              sceneTake.sceneId,
              `${sceneTake.take.id}_camera`
            )
            if (originalBlob && cameraClip.sourceIn < cameraClip.sourceOut) {
              sceneCameraBlob = await trimVideo(
                originalBlob,
                cameraClip.sourceIn,
                cameraClip.sourceOut
              )
            } else {
              sceneCameraBlob = originalBlob
            }
          }
        }
        
        // Load and trim microphone
        if (sceneTake.take.hasMicrophone) {
          const micClip = sceneClips.find(c => c.layer === 'microphone')
          if (micClip) {
            const originalBlob = await projectManager.loadRecording(
              sceneTake.sceneId,
              `${sceneTake.take.id}_microphone`
            )
            if (originalBlob && micClip.sourceIn < micClip.sourceOut) {
              sceneMicrophoneBlob = await trimVideo(
                originalBlob,
                micClip.sourceIn,
                micClip.sourceOut
              )
            } else {
              sceneMicrophoneBlob = originalBlob
            }
          }
        }
        
        // Load and trim screen
        if (sceneTake.take.hasScreen) {
          const screenClip = sceneClips.find(c => c.layer === 'screen')
          if (screenClip) {
            const originalBlob = await projectManager.loadRecording(
              sceneTake.sceneId,
              `${sceneTake.take.id}_screen`
            )
            if (originalBlob && screenClip.sourceIn < screenClip.sourceOut) {
              sceneScreenBlob = await trimVideo(
                originalBlob,
                screenClip.sourceIn,
                screenClip.sourceOut
              )
            } else {
              sceneScreenBlob = originalBlob
            }
          }
        }
        
        if (!sceneCameraBlob && !sceneScreenBlob) {
          console.warn(`No video to export for scene ${sceneTake.sceneId}`)
          continue
        }
        
        // Get cuts for this scene (adjusted to trimmed timeline)
        const sceneCuts = cuts.get(sceneTake.sceneId) || []
        
        // Combine layers with layout
        setExportProgress(`Combining layers for scene ${i + 1}...`)
        const combinedBlob = await combineLayersWithLayout(
          sceneCameraBlob,
          sceneMicrophoneBlob,
          sceneScreenBlob,
          layout,
          sceneCuts
        )
        
        processedSceneBlobs.push(combinedBlob)
      }
      
      if (processedSceneBlobs.length === 0) {
        alert('No video to export')
        setIsExporting(false)
        return
      }
      
      // Concatenate all scenes if multiple
      setExportProgress('Concatenating scenes...')
      let finalBlob: Blob
      if (processedSceneBlobs.length === 1) {
        finalBlob = processedSceneBlobs[0]
      } else {
        finalBlob = await concatVideos(processedSceneBlobs)
      }
      
      // Download video
      setExportProgress('Finalizing export...')
      const url = URL.createObjectURL(finalBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `export_${Date.now()}.mp4`
      a.click()
      URL.revokeObjectURL(url)
      
      setShowExportDialog(false)
      setIsExporting(false)
      setExportProgress('')
    } catch (error) {
      console.error('Export error:', error)
      alert('Export failed: ' + (error as Error).message)
      setIsExporting(false)
      setExportProgress('')
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
                      className={`p-3 rounded border cursor-pointer ${
                        isSelected
                          ? 'bg-blue-900/30 border-blue-500'
                          : 'bg-gray-800 border-gray-700 hover:border-gray-600'
                      }`}
                      onClick={() => toggleSceneSelection(sceneTake.sceneId)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                              isSelected
                                ? 'bg-blue-500 border-blue-500'
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
              
              {isExporting ? (
                <div className="mt-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
                    <span className="text-sm text-gray-300">{exportProgress || 'Processing...'}</span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-2">
                    <div className="bg-blue-500 h-2 rounded-full animate-pulse" style={{ width: '100%' }}></div>
                  </div>
                </div>
              ) : null}
              
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
                  disabled={isExporting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Export Video
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
            title="Canvas"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </button>
          <button
            onClick={() => setActiveTab('layout')}
            className={`p-2 rounded ${activeTab === 'layout' ? 'bg-blue-600' : 'hover:bg-gray-800'}`}
            title="Layout"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v9a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h6a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 13a1 1 0 011-1h4a1 1 0 011 1v6a1 1 0 01-1 1h-4a1 1 0 01-1-1v-6z" />
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
        <div className="w-64 bg-gray-900 border-r border-gray-700 overflow-y-auto">
          {activeTab === 'clip' && selectedClip && (
            <div className="p-4">
              <h3 className="text-sm font-semibold mb-4">
                {selectedClip.layer === 'camera' && 'CAMERA'}
                {selectedClip.layer === 'microphone' && 'MICROPHONE'}
                {selectedClip.layer === 'screen' && 'SCREEN'}
              </h3>
              
              {selectedClip.layer === 'microphone' && (
                <div className="space-y-4">
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
                        className={`w-12 h-6 rounded-full transition-colors ${
                          (clipProperties.get(`${selectedClip.sceneId}_${selectedClip.takeId}_${selectedClip.layer}`)?.enhanceVoice) ? 'bg-green-500' : 'bg-gray-600'
                        }`}
                      >
                        <div
                          className={`w-5 h-5 bg-white rounded-full transition-transform ${
                            (clipProperties.get(`${selectedClip.sceneId}_${selectedClip.takeId}_${selectedClip.layer}`)?.enhanceVoice) ? 'translate-x-6' : 'translate-x-0.5'
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
                        className={`w-12 h-6 rounded-full transition-colors ${
                          (clipProperties.get(`${selectedClip.sceneId}_${selectedClip.takeId}_${selectedClip.layer}`)?.removeNoise) ? 'bg-green-500' : 'bg-gray-600'
                        }`}
                      >
                        <div
                          className={`w-5 h-5 bg-white rounded-full transition-transform ${
                            (clipProperties.get(`${selectedClip.sceneId}_${selectedClip.takeId}_${selectedClip.layer}`)?.removeNoise) ? 'translate-x-6' : 'translate-x-0.5'
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
                  max="48"
                  value={captionSize}
                  onChange={(e) => setCaptionSize(parseInt(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>12px</span>
                  <span>48px</span>
                </div>
              </div>
              
              {/* Caption Styles */}
              <div className="mb-4">
                <label className="text-xs text-gray-300 mb-2 block">Caption Styles</label>
                <p className="text-xs text-gray-400 mb-3">Click a word in the transcript to apply the selected style</p>
                <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                  {captionStyles.map((style) => (
                    <button
                      key={style.id}
                      onClick={() => setSelectedCaptionStyle(style.id)}
                      className={`px-3 py-2 rounded text-xs text-center transition-all ${
                        selectedCaptionStyle === style.id 
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
              
              {/* Style Preview */}
              <div className="mt-4 pt-4 border-t border-gray-700">
                <label className="text-xs text-gray-300 mb-2 block">Preview</label>
                <div className="bg-gray-900 rounded p-3 min-h-[60px] flex items-center justify-center">
                  <span
                    style={{
                      background: captionStyles.find(s => s.id === selectedCaptionStyle)?.backgroundColor || 'transparent',
                      color: captionStyles.find(s => s.id === selectedCaptionStyle)?.textColor || '#ffffff',
                      padding: captionStyles.find(s => s.id === selectedCaptionStyle)?.padding || '8px 16px',
                      borderRadius: captionStyles.find(s => s.id === selectedCaptionStyle)?.borderRadius || '4px',
                      border: captionStyles.find(s => s.id === selectedCaptionStyle)?.border || 'none',
                      boxShadow: captionStyles.find(s => s.id === selectedCaptionStyle)?.boxShadow || 'none',
                      fontWeight: captionStyles.find(s => s.id === selectedCaptionStyle)?.fontWeight || 400,
                      textTransform: captionStyles.find(s => s.id === selectedCaptionStyle)?.textTransform || 'none',
                      fontSize: `${captionSize}px`,
                      fontFamily: availableFonts.find(f => f.name === captionFont)?.value || 'Inter',
                      display: 'inline-block',
                    }}
                  >
                    Hey there
                  </span>
                </div>
              </div>
            </div>
          )}
          
          {activeTab === 'layout' && (
            <div className="p-4">
              <h3 className="text-sm font-semibold mb-4">LAYOUT</h3>
              <div className="space-y-2">
                <button
                  onClick={() => handleLayoutChange({ type: 'side-by-side' })}
                  className={`w-full px-3 py-2 rounded text-left text-xs ${
                    layout.type === 'side-by-side' ? 'bg-blue-600' : 'bg-gray-800'
                  }`}
                >
                  Side-by-side
                </button>
                <button
                  onClick={() => handleLayoutChange({ type: 'picture-in-picture' })}
                  className={`w-full px-3 py-2 rounded text-left text-xs ${
                    layout.type === 'picture-in-picture' ? 'bg-blue-600' : 'bg-gray-800'
                  }`}
                >
                  Picture-in-picture
                </button>
                <button
                  onClick={() => handleLayoutChange({ type: 'screen-only' })}
                  className={`w-full px-3 py-2 rounded text-left text-xs ${
                    layout.type === 'screen-only' ? 'bg-blue-600' : 'bg-gray-800'
                  }`}
                >
                  Screen only
                </button>
                <button
                  onClick={() => handleLayoutChange({ type: 'camera-only' })}
                  className={`w-full px-3 py-2 rounded text-left text-xs ${
                    layout.type === 'camera-only' ? 'bg-blue-600' : 'bg-gray-800'
                  }`}
                >
                  Camera only
                </button>
                <button
                  onClick={() => handleLayoutChange({ type: 'custom', name: 'Custom' })}
                  className={`w-full px-3 py-2 rounded text-left text-xs ${
                    layout.type === 'custom' ? 'bg-blue-600' : 'bg-gray-800'
                  }`}
                >
                  Custom
                </button>
              </div>
              {layout.type === 'custom' && (
                <div className="mt-4">
                  <input
                    type="text"
                    placeholder="Layout name"
                    value={layout.name || ''}
                    onChange={(e) => setLayout({ ...layout, name: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs mb-2"
                  />
                  <button
                    onClick={handleSaveLayout}
                    className="w-full bg-blue-600 hover:bg-blue-700 py-2 rounded text-xs"
                  >
                    Save Template
                  </button>
                </div>
              )}
              {savedLayouts.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-xs font-semibold mb-2">Saved Templates</h4>
                  {savedLayouts.map((savedLayout, index) => (
                    <button
                      key={index}
                      onClick={() => handleLayoutChange(savedLayout)}
                      className="w-full px-3 py-2 rounded text-left text-xs bg-gray-800 hover:bg-gray-700 mb-1"
                    >
                      {savedLayout.name || 'Custom Layout'}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {activeTab === 'canvas' && (
            <div className="p-4">
              <h3 className="text-sm font-semibold mb-4">CANVAS</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Zoom</label>
                  <input
                    type="range"
                    min="0.5"
                    max="2"
                    step="0.1"
                    value={canvasZoom}
                    onChange={(e) => setCanvasZoom(parseFloat(e.target.value))}
                    className="w-full"
                  />
                  <span className="text-xs text-gray-400">{Math.round(canvasZoom * 100)}%</span>
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Video Size (Width)</label>
                  <input
                    type="range"
                    min="20"
                    max="100"
                    step="1"
                    value={videoSize.width}
                    onChange={(e) => {
                      const newWidth = parseInt(e.target.value)
                      // Maintain aspect ratio - calculate height from width
                      if (videoAspectRatio) {
                        const containerHeight = lutCanvasRef.current?.parentElement?.clientHeight || 100
                        const newHeight = (newWidth / videoAspectRatio) * (100 / (lutCanvasRef.current?.parentElement?.clientWidth || 100)) * 100
                        setVideoSize({ width: newWidth, height: Math.min(100, newHeight) })
                      } else {
                        setVideoSize(prev => ({ ...prev, width: newWidth }))
                      }
                    }}
                    className="w-full"
                  />
                  <span className="text-xs text-gray-400">{videoSize.width}%</span>
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Video Size (Height)</label>
                  <input
                    type="range"
                    min="20"
                    max="100"
                    step="1"
                    value={videoSize.height}
                    onChange={(e) => {
                      const newHeight = parseInt(e.target.value)
                      // Maintain aspect ratio - calculate width from height
                      if (videoAspectRatio) {
                        const containerWidth = lutCanvasRef.current?.parentElement?.clientWidth || 100
                        const newWidth = (newHeight * videoAspectRatio) * (100 / (lutCanvasRef.current?.parentElement?.clientHeight || 100)) * 100
                        setVideoSize({ width: Math.min(100, newWidth), height: newHeight })
                      } else {
                        setVideoSize(prev => ({ ...prev, height: newHeight }))
                      }
                    }}
                    className="w-full"
                  />
                  <span className="text-xs text-gray-400">{videoSize.height}%</span>
                </div>
                <div className="text-xs text-gray-500 italic">
                  Aspect ratio is maintained automatically
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
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        audioSettings.noiseReduction ? 'bg-green-500' : 'bg-gray-600'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                          audioSettings.noiseReduction ? 'translate-x-6' : 'translate-x-0.5'
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
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        audioSettings.enhanceVoice ? 'bg-green-500' : 'bg-gray-600'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                          audioSettings.enhanceVoice ? 'translate-x-6' : 'translate-x-0.5'
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
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        audioSettings.normalizeAudio ? 'bg-green-500' : 'bg-gray-600'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                          audioSettings.normalizeAudio ? 'translate-x-6' : 'translate-x-0.5'
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
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        audioSettings.removeEcho ? 'bg-green-500' : 'bg-gray-600'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                          audioSettings.removeEcho ? 'translate-x-6' : 'translate-x-0.5'
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
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        audioSettings.removeBackgroundNoise ? 'bg-green-500' : 'bg-gray-600'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                          audioSettings.removeBackgroundNoise ? 'translate-x-6' : 'translate-x-0.5'
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
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        visualSettings.lutEnabled ? 'bg-green-500' : 'bg-gray-600'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                          visualSettings.lutEnabled ? 'translate-x-6' : 'translate-x-0.5'
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
        <div className="flex-1 flex flex-col min-h-0">
          {/* Video Player */}
          <div className="flex-1 flex min-h-0 overflow-hidden">
            <div className="flex-1 flex flex-col items-center justify-center p-4 min-h-0 overflow-hidden">
              <div className="relative bg-black rounded overflow-hidden max-w-full max-h-full flex items-center justify-center" style={{ transform: `scale(${canvasZoom})` }}>
                {/* Hidden video element for source */}
                <video
                  ref={videoRef}
                  className="hidden"
                />
                {/* Canvas for LUT processing */}
                <canvas
                  ref={lutCanvasRef}
                  className="max-w-full max-h-full"
                  style={{ 
                    width: `${videoSize.width}%`,
                    height: videoAspectRatio ? 'auto' : `${videoSize.height}%`,
                    maxWidth: '100%', 
                    maxHeight: '100%',
                    objectFit: 'contain',
                    filter: (() => {
                      // Apply clip-specific color adjustments
                      const clipProps = selectedClip ? clipProperties.get(`${selectedClip.sceneId}_${selectedClip.takeId}_${selectedClip.layer}`) : null
                      const brightness = (clipProps?.brightness || 0) + (visualSettings.colorGrading.midtones || 0)
                      const contrast = clipProps?.contrast || 0
                      const saturation = clipProps?.saturation || 0
                      const exposure = clipProps?.exposure || 0
                      
                      // Apply global visual settings
                      const shadows = visualSettings.colorGrading.shadows
                      const highlights = visualSettings.colorGrading.highlights
                      
                      // Convert adjustments to CSS filter values
                      const brightnessValue = 1 + (brightness / 100) + (exposure / 100) + ((shadows + highlights) / 200)
                      const contrastValue = 1 + (contrast / 100)
                      const saturationValue = 1 + (saturation / 100)
                      
                      // Build filter string
                      return `brightness(${brightnessValue}) contrast(${contrastValue}) saturate(${saturationValue})`
                    })()
                  }}
                />
                {/* Hidden audio element for microphone playback */}
                <audio
                  ref={audioRef}
                  style={{ display: 'none' }}
                />
                {currentTranscript && currentTranscript.words.length > 0 && (
                  <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
                    {currentTranscript.words
                      .filter(w => w.start <= currentTime && w.end >= currentTime)
                      .map((w, idx) => {
                        const wordIndex = currentTranscript.words.findIndex(word => word === w)
                        const styleId = getCaptionStyleForWord(selectedSceneId, wordIndex)
                        const style = captionStyles.find(s => s.id === styleId) || captionStyles[0]
                        
                        // For words with no style, use default transparent background
                        const displayStyle: React.CSSProperties = styleId === 'none' 
                          ? {
                              backgroundColor: 'rgba(0, 0, 0, 0.7)',
                              color: '#ffffff',
                              padding: '8px 16px',
                              borderRadius: '4px',
                              fontSize: `${captionSize}px`,
                              fontFamily: captionFont,
                              fontWeight: 400,
                            }
                          : {
                              background: style.backgroundColor,
                              color: style.textColor,
                              padding: style.padding,
                              borderRadius: style.borderRadius,
                              border: style.border || 'none',
                              boxShadow: style.boxShadow || 'none',
                              fontWeight: style.fontWeight,
                              textTransform: style.textTransform || 'none',
                              fontSize: `${captionSize}px`,
                              fontFamily: captionFont,
                              display: 'inline-block',
                              margin: '0 2px',
                            }
                        
                        return (
                          <span key={idx} style={displayStyle}>
                            {w.word}
                          </span>
                        )
                      })}
                  </div>
                )}
              </div>
              
              {/* Playback Controls */}
              <div className="w-full max-w-4xl mt-4">
                <div className="flex items-center gap-2 mb-2">
                  <button
                    onClick={() => handleSeek(0)}
                    className="p-2 hover:bg-gray-800 rounded"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleSeek(Math.max(0, currentTime - 0.1))}
                    className="p-2 hover:bg-gray-800 rounded"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    onClick={handlePlayPause}
                    className="p-2 hover:bg-gray-800 rounded"
                  >
                    {isPlaying ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                  </button>
                  <button
                    onClick={() => handleSeek(Math.min(totalDuration, currentTime + 0.1))}
                    className="p-2 hover:bg-gray-800 rounded"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleSeek(totalDuration)}
                    className="p-2 hover:bg-gray-800 rounded"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                    </svg>
                  </button>
                  <select
                    value={playbackRate}
                    onChange={(e) => {
                      const rate = parseFloat(e.target.value)
                      setPlaybackRate(rate)
                      if (videoRef.current) {
                        videoRef.current.playbackRate = rate
                      }
                      if (audioRef.current) {
                        audioRef.current.playbackRate = rate
                      }
                    }}
                    className="ml-4 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs"
                  >
                    <option value="0.25">0.25X</option>
                    <option value="0.5">0.5X</option>
                    <option value="0.75">0.75X</option>
                    <option value="1">1X</option>
                    <option value="1.25">1.25X</option>
                    <option value="1.5">1.5X</option>
                    <option value="2">2X</option>
                  </select>
                  <span className="ml-4 text-sm">
                    {formatTime(currentTime)} / {formatTime(totalDuration)}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Right Panel - Transcript */}
            <div 
              className="bg-gray-900 border-l border-gray-700 flex flex-col relative"
              style={{ width: `${transcriptWidth}px` }}
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
                        <div
                          className="text-sm leading-relaxed select-text"
                          onMouseUp={() => handleTranscriptSelection(sceneId)}
                          onKeyUp={() => handleTranscriptSelection(sceneId)}
                        >
                          {sceneTranscript.words.map((word, index) => {
                            const isSelected = selectedText && 
                              selectedText.sceneId === sceneId &&
                              word.start >= selectedText.start && 
                              word.end <= selectedText.end
                            const isDeleted = deletedWords.get(sceneId)?.has(index) || false
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
                            
                            // Get caption style for this word
                            const styleId = getCaptionStyleForWord(sceneId, index)
                            const style = captionStyles.find(s => s.id === styleId) || captionStyles[0]
                            
                            const wordStyle: React.CSSProperties = styleId !== 'none' ? {
                              background: style.backgroundColor,
                              color: style.textColor,
                              padding: style.padding,
                              borderRadius: style.borderRadius,
                              border: style.border || 'none',
                              boxShadow: style.boxShadow || 'none',
                              fontWeight: style.fontWeight,
                              textTransform: style.textTransform || 'none',
                              fontSize: `${captionSize}px`,
                              fontFamily: captionFont,
                              display: 'inline-block',
                              margin: '2px',
                            } : {}
                            
                            return (
                              <span
                                key={index}
                                onClick={() => handleWordClick(word, sceneTake.sceneId, index)}
                                className={`cursor-pointer px-1 rounded transition-all ${
                                  isSelected ? 'ring-2 ring-blue-500' : showStrikethrough ? 'line-through text-red-400' : 'hover:opacity-80'
                                }`}
                                style={wordStyle}
                              >
                                {word.word}{' '}
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
          
          {/* Timeline */}
          <div 
            className="bg-gray-900 border-t border-gray-700 flex flex-col flex-shrink-0 relative"
            style={{ height: `${timelineHeight}px` }}
          >
            {/* Resize handle */}
            <div
              onMouseDown={() => setIsResizingTimeline(true)}
              className="absolute top-0 left-0 right-0 h-1 cursor-row-resize hover:bg-blue-500 z-20"
              style={{ cursor: 'row-resize' }}
            />
            <div className="flex-1 overflow-x-auto p-4">
              <div 
                className="relative" 
                data-timeline-container 
                style={{ 
                  width: `${totalDuration * timelineZoom}px`,
                  minWidth: `${totalDuration * timelineZoom}px`,
                  cursor: timelineTool === 'cut' ? 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23000\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'M14.121 3.293a1 1 0 011.414 0l1.172 1.172a1 1 0 010 1.414l-8.586 8.586a1 1 0 01-1.414 0l-1.172-1.172a1 1 0 010-1.414l8.586-8.586z\'/%3E%3Cpath d=\'M14.121 14.121a1 1 0 011.414 0l1.172 1.172a1 1 0 010 1.414l-8.586 8.586a1 1 0 01-1.414 0l-1.172-1.172a1 1 0 010-1.414l8.586-8.586z\'/%3E%3Cpath d=\'M9 12h6\'/%3E%3C/svg%3E") 12 12, crosshair' : 'default'
                }}
                onMouseDown={(e) => {
                  // Only handle scrubbing if not clicking on clips or other interactive elements
                  if ((e.target as HTMLElement).closest('[data-clip-id]') || 
                      (e.target as HTMLElement).closest('.trim-handle')) {
                    return
                  }
                  
                  e.preventDefault()
                  const timelineContainer = e.currentTarget
                  
                  // Pause video/audio if playing
                  if (videoRef.current && !videoRef.current.paused) {
                    videoRef.current.pause()
                  }
                  if (audioRef.current && !audioRef.current.paused) {
                    audioRef.current.pause()
                  }
                  setIsPlaying(false)
                  
                  const handleMouseMove = (moveEvent: MouseEvent) => {
                    const rect = timelineContainer.getBoundingClientRect()
                    const x = moveEvent.clientX - rect.left
                    const time = Math.max(0, Math.min(totalDuration, x / timelineZoom))
                    
                    // Immediate update for smooth scrubbing
                    handleSeek(time, true)
                  }
                  
                  const handleMouseUp = () => {
                    document.removeEventListener('mousemove', handleMouseMove)
                    document.removeEventListener('mouseup', handleMouseUp)
                  }
                  
                  document.addEventListener('mousemove', handleMouseMove, { passive: true })
                  document.addEventListener('mouseup', handleMouseUp)
                  
                  // Handle initial click
                  const rect = timelineContainer.getBoundingClientRect()
                  const x = e.clientX - rect.left
                  const time = Math.max(0, Math.min(totalDuration, x / timelineZoom))
                  handleSeek(time, true)
                }}
                onClick={(e) => {
                  // Only handle click-to-scrub if not clicking on clips
                  if ((e.target as HTMLElement).closest('[data-clip-id]') || 
                      (e.target as HTMLElement).closest('.trim-handle')) {
                    return
                  }
                  
                  const rect = e.currentTarget.getBoundingClientRect()
                  const x = e.clientX - rect.left
                  const time = Math.max(0, Math.min(totalDuration, x / timelineZoom))
                  handleSeek(time, true)
                }}
              >
                {/* Time markers - every 20 seconds */}
                <div className="absolute top-0 left-0 right-0 h-8 border-b border-gray-700">
                  {Array.from({ length: Math.ceil(totalDuration / 20) + 1 }).map((_, i) => {
                    const time = i * 20
                    if (time > totalDuration) return null
                    return (
                      <div
                        key={i}
                        className="absolute border-l border-gray-600"
                        style={{ left: `${time * timelineZoom}px` }}
                      >
                        <span className="text-xs text-gray-400 ml-1">{formatTime(time)}</span>
                      </div>
                    )
                  })}
                </div>
                
                {/* Scene markers/headlines - positioned above tracks */}
                <div className="absolute top-8 left-0 right-0 h-6 flex items-center z-25">
                  {Array.from(new Set(sceneTakes.map(st => st.sceneId))).map((sceneId) => {
                    const scene = scenes.find(s => s.id === sceneId)
                    // Find the first clip of this scene (earliest startTime)
                    const firstClip = sceneTakes
                      .filter(st => st.sceneId === sceneId)
                      .sort((a, b) => a.startTime - b.startTime)[0]
                    if (!firstClip) return null
                    
                    return (
                      <div
                        key={`scene-marker-${sceneId}`}
                        className="absolute flex items-center"
                        style={{ left: `${firstClip.startTime * timelineZoom}px` }}
                      >
                        <span className="text-xs text-white font-medium">
                          • SCENE {firstClip.sceneIndex + 1}
                          {scene?.title && `: ${scene.title}`}
                        </span>
                      </div>
                    )
                  })}
                </div>
                
                {/* Playhead - gray line with teardrop marker at top */}
                <div
                  className="absolute top-0 bottom-0 z-30 pointer-events-none"
                  style={{ left: `${currentTime * timelineZoom}px` }}
                >
                  {/* Circular marker at top */}
                  <div className="absolute -top-1.5 left-1/2 transform -translate-x-1/2 w-3 h-3 rounded-full bg-gray-400 border border-gray-300" />
                  {/* Vertical line */}
                  <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-px h-full bg-white" />
                </div>
                
                {/* Tracks - Separate horizontal tracks for each layer type */}
                <div className="mt-14 space-y-3">
                  {timelineClips.length === 0 ? (
                    <div className="text-center text-gray-400 py-8">
                      No clips on timeline. Record a scene first.
                    </div>
                  ) : (
                    <>
                      {/* Camera Track - All camera clips */}
                      {timelineClips.some(c => c.layer === 'camera') && (
                        <div className="relative h-20 bg-transparent">
                          <div className="absolute left-2 top-2 text-xs text-gray-400 z-10">
                            Camera
                          </div>
                          <div className="absolute inset-0 flex items-center pl-20">
                            {timelineClips
                              .filter(clip => clip.layer === 'camera')
                              .map((clip) => {
                                const isSelected = selectedClipIds.has(clip.id)
                                const isDragging = draggingClipId === clip.id
                                const isTrimming = trimmingClipId === clip.id
                                const clipDuration = clip.timelineEnd - clip.timelineStart
                                
                                return (
                                  <div
                                    key={clip.id}
                                    data-clip-id={clip.id}
                                    className={`absolute h-full bg-blue-600 rounded-lg transition-all cursor-move ${
                                      isSelected ? 'ring-2 ring-blue-400' : ''
                                    } ${isDragging ? 'opacity-75' : ''}`}
                                    style={{
                                      left: `${clip.timelineStart * timelineZoom}px`,
                                      width: `${clipDuration * timelineZoom}px`,
                                    }}
                                    onMouseDown={(e) => {
                                      if (e.target === e.currentTarget || (e.target as HTMLElement).closest('.trim-handle')) {
                                        return // Let trim handles handle their own events
                                      }
                                      e.stopPropagation()
                                      if (timelineTool === 'select') {
                                        handleStartMoveClip(clip.id, e.clientX)
                                      }
                                    }}
                                    onClick={(e) => {
                                      if ((e.target as HTMLElement).closest('.trim-handle')) return
                                      const rect = e.currentTarget.getBoundingClientRect()
                                      const timelineContainer = e.currentTarget.closest('[data-timeline-container]') as HTMLElement
                                      if (!timelineContainer) return
                                      const containerRect = timelineContainer.getBoundingClientRect()
                                      const clickX = e.clientX - containerRect.left
                                      const clickTime = clickX / timelineZoom
                                      handleClipClick(clip.id, clickTime)
                                    }}
                                  >
                                    {/* Left trim handle */}
                                    <div
                                      className={`trim-handle absolute left-0 top-0 bottom-0 w-2 bg-green-500 z-30 cursor-ew-resize ${
                                        isTrimming && trimmingEdge === 'in' ? 'bg-green-400 w-3' : 'hover:bg-green-400'
                                      }`}
                                      onMouseDown={(e) => {
                                        e.stopPropagation()
                                        handleStartTrimClip(clip.id, 'in', e.clientX)
                                      }}
                                    >
                                      <div className="absolute -left-1 top-1/2 transform -translate-y-1/2 flex items-center">
                                        <div className="w-3 h-4 border-l-2 border-t-2 border-b-2 border-white rounded-l" />
                                        <div className="w-1 h-1 bg-white rounded-full ml-0.5" />
                                      </div>
                                    </div>
                                    
                                    {/* Right trim handle */}
                                    <div
                                      className={`trim-handle absolute right-0 top-0 bottom-0 w-2 bg-green-500 z-30 cursor-ew-resize ${
                                        isTrimming && trimmingEdge === 'out' ? 'bg-green-400 w-3' : 'hover:bg-green-400'
                                      }`}
                                      onMouseDown={(e) => {
                                        e.stopPropagation()
                                        handleStartTrimClip(clip.id, 'out', e.clientX)
                                      }}
                                    >
                                      <div className="absolute -right-1 top-1/2 transform -translate-y-1/2 flex items-center">
                                        <div className="w-1 h-1 bg-white rounded-full mr-0.5" />
                                        <div className="w-3 h-4 border-r-2 border-t-2 border-b-2 border-white rounded-r" />
                                      </div>
                                    </div>
                                    
                                    {/* Video thumbnail */}
                                    {videoThumbnails.get(`${clip.sceneId}_${clip.takeId}_camera`) && (
                                      <img
                                        src={videoThumbnails.get(`${clip.sceneId}_${clip.takeId}_camera`)}
                                        alt="Video thumbnail"
                                        className="absolute inset-0 w-full h-full object-cover rounded opacity-80"
                                      />
                                    )}
                                  </div>
                                )
                              })}
                          </div>
                        </div>
                      )}
                      
                      {/* Microphone Track - All microphone clips */}
                      {timelineClips.some(c => c.layer === 'microphone') && (
                        <div className="relative h-24 bg-transparent">
                          <div className="absolute left-2 top-2 text-xs text-gray-400 z-10">
                            Microphone
                          </div>
                          <div className="absolute inset-0 flex flex-col pl-20">
                            {/* Audio waveform area - all clips on same layer */}
                            {timelineClips
                              .filter(clip => clip.layer === 'microphone')
                              .map((clip) => {
                                const isSelected = selectedClipIds.has(clip.id)
                                const isDragging = draggingClipId === clip.id
                                const isTrimming = trimmingClipId === clip.id
                                const clipDuration = clip.timelineEnd - clip.timelineStart
                                const sceneTranscript = transcripts.get(clip.sceneId)
                                
                                return (
                                  <div
                                    key={clip.id}
                                    data-clip-id={clip.id}
                                    className={`absolute h-full bg-blue-600 rounded-lg transition-all cursor-move ${
                                      isSelected ? 'ring-2 ring-blue-400' : ''
                                    } ${isDragging ? 'opacity-75' : ''}`}
                                    style={{
                                      left: `${clip.timelineStart * timelineZoom}px`,
                                      width: `${clipDuration * timelineZoom}px`,
                                    }}
                                    onMouseDown={(e) => {
                                      if ((e.target as HTMLElement).closest('.trim-handle')) return
                                      e.stopPropagation()
                                      if (timelineTool === 'select') {
                                        handleStartMoveClip(clip.id, e.clientX)
                                      }
                                    }}
                                    onClick={(e) => {
                                      if ((e.target as HTMLElement).closest('.trim-handle')) return
                                      const timelineContainer = e.currentTarget.closest('[data-timeline-container]') as HTMLElement
                                      if (!timelineContainer) return
                                      const containerRect = timelineContainer.getBoundingClientRect()
                                      const clickX = e.clientX - containerRect.left
                                      const clickTime = clickX / timelineZoom
                                      handleClipClick(clip.id, clickTime)
                                    }}
                                  >
                                    {/* Left trim handle */}
                                    <div
                                      className={`trim-handle absolute left-0 top-0 bottom-0 w-2 bg-green-500 z-30 cursor-ew-resize ${
                                        isTrimming && trimmingEdge === 'in' ? 'bg-green-400 w-3' : 'hover:bg-green-400'
                                      }`}
                                      onMouseDown={(e) => {
                                        e.stopPropagation()
                                        handleStartTrimClip(clip.id, 'in', e.clientX)
                                      }}
                                    >
                                      <div className="absolute -left-1 top-1/2 transform -translate-y-1/2 flex items-center">
                                        <div className="w-3 h-4 border-l-2 border-t-2 border-b-2 border-white rounded-l" />
                                        <div className="w-1 h-1 bg-white rounded-full ml-0.5" />
                                      </div>
                                    </div>
                                    
                                    {/* Right trim handle */}
                                    <div
                                      className={`trim-handle absolute right-0 top-0 bottom-0 w-2 bg-green-500 z-30 cursor-ew-resize ${
                                        isTrimming && trimmingEdge === 'out' ? 'bg-green-400 w-3' : 'hover:bg-green-400'
                                      }`}
                                      onMouseDown={(e) => {
                                        e.stopPropagation()
                                        handleStartTrimClip(clip.id, 'out', e.clientX)
                                      }}
                                    >
                                      <div className="absolute -right-1 top-1/2 transform -translate-y-1/2 flex items-center">
                                        <div className="w-1 h-1 bg-white rounded-full mr-0.5" />
                                        <div className="w-3 h-4 border-r-2 border-t-2 border-b-2 border-white rounded-r" />
                                      </div>
                                    </div>
                                    
                                    {/* Waveform visualization */}
                                    <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
                                      {(() => {
                                        const waveformKey = `${clip.sceneId}_${clip.takeId}`
                                        const waveformData = waveforms.get(waveformKey)
                                        
                                        if (!waveformData || waveformData.length === 0) {
                                          return (
                                            <div className="w-full h-8 flex items-center justify-center">
                                              <div className="w-full h-px bg-gray-600" />
                                            </div>
                                          )
                                        }
                                        
                                        const clipWidth = clipDuration * timelineZoom
                                        const clipHeight = 32
                                        const centerY = clipHeight / 2
                                        
                                        // Sample waveform - map source in/out to waveform data
                                        const sourceDuration = clip.sourceOut - clip.sourceIn
                                        const sourceStartRatio = clip.sourceIn / clip.sourceDuration
                                        const sourceEndRatio = clip.sourceOut / clip.sourceDuration
                                        const waveformStart = Math.floor(waveformData.length * sourceStartRatio)
                                        const waveformEnd = Math.floor(waveformData.length * sourceEndRatio)
                                        const relevantWaveform = waveformData.slice(waveformStart, waveformEnd)
                                        
                                        const samples = Math.max(50, Math.min(relevantWaveform.length, Math.floor(clipWidth / 2)))
                                        const step = relevantWaveform.length / samples
                                        
                                        let pathData = `M 0 ${centerY}`
                                        const points: Array<{ x: number; y: number }> = []
                                        
                                        for (let i = 0; i < samples; i++) {
                                          const index = Math.floor(i * step)
                                          const amplitude = relevantWaveform[index] || 0
                                          const x = (i / samples) * clipWidth
                                          const normalizedAmp = Math.max(0, Math.min(1, amplitude * 3))
                                          const y = centerY - (normalizedAmp * (clipHeight * 0.4))
                                          points.push({ x, y })
                                        }
                                        
                                        for (let i = 0; i < points.length; i++) {
                                          if (i === 0) {
                                            pathData += ` L ${points[i].x} ${points[i].y}`
                                          } else {
                                            const prevPoint = points[i - 1]
                                            const currentPoint = points[i]
                                            const controlX = (prevPoint.x + currentPoint.x) / 2
                                            pathData += ` Q ${controlX} ${prevPoint.y} ${currentPoint.x} ${currentPoint.y}`
                                          }
                                        }
                                        
                                        const bottomPath = points.map(p => ({ x: p.x, y: centerY + (centerY - p.y) }))
                                        for (let i = bottomPath.length - 1; i >= 0; i--) {
                                          if (i === bottomPath.length - 1) {
                                            pathData += ` L ${bottomPath[i].x} ${bottomPath[i].y}`
                                          } else {
                                            const nextPoint = bottomPath[i + 1]
                                            const currentPoint = bottomPath[i]
                                            const controlX = (nextPoint.x + currentPoint.x) / 2
                                            pathData += ` Q ${controlX} ${nextPoint.y} ${currentPoint.x} ${currentPoint.y}`
                                          }
                                        }
                                        
                                        pathData += ` Z`
                                        
                                        return (
                                          <svg
                                            width={clipWidth}
                                            height={clipHeight}
                                            className="absolute"
                                            style={{ left: 0, top: 0 }}
                                          >
                                            <line
                                              x1={0}
                                              y1={centerY}
                                              x2={clipWidth}
                                              y2={centerY}
                                              stroke="rgba(156, 163, 175, 0.3)"
                                              strokeWidth={1}
                                            />
                                            <path
                                              d={pathData}
                                              fill="rgb(96, 165, 250)"
                                              fillOpacity={0.7}
                                              stroke="rgb(96, 165, 250)"
                                              strokeWidth={0.5}
                                            />
                                          </svg>
                                        )
                                      })()}
                                    </div>
                                    
                                    {/* Circular thumbnail at start */}
                                    {cameraBlob && (
                                      <div className="absolute left-1 top-1 w-6 h-6 rounded-full overflow-hidden border border-white/30 z-10 bg-gray-700">
                                        {videoThumbnails.get(`${clip.sceneId}_${clip.takeId}_camera`) ? (
                                          <img
                                            src={videoThumbnails.get(`${clip.sceneId}_${clip.takeId}_camera`) || ''}
                                            alt="Thumbnail"
                                            className="w-full h-full object-cover"
                                            onError={(e) => {
                                              e.currentTarget.style.display = 'none'
                                            }}
                                          />
                                        ) : (
                                          <div className="w-full h-full flex items-center justify-center text-white text-xs">
                                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                                            </svg>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                    
                                    {/* Transcript text overlay */}
                                    {sceneTranscript && (
                                      <div className="absolute bottom-0 left-0 right-0 h-6 flex items-center pl-8 pr-2 overflow-hidden">
                                        <span className="text-xs text-white font-medium truncate">
                                          {sceneTranscript.words
                                            .filter(word => {
                                              // Map timeline time to source time
                                              const wordTimelineStart = clip.timelineStart + ((word.start - clip.sourceIn) / (clip.sourceOut - clip.sourceIn)) * clipDuration
                                              const wordTimelineEnd = clip.timelineStart + ((word.end - clip.sourceIn) / (clip.sourceOut - clip.sourceIn)) * clipDuration
                                              return wordTimelineStart >= clip.timelineStart && wordTimelineEnd <= clip.timelineEnd
                                            })
                                            .map(word => word.word)
                                            .join(' ')}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                          </div>
                        </div>
                      )}
                      
                      {/* Screen Track - All screen clips */}
                      {timelineClips.some(c => c.layer === 'screen') && (
                        <div className="relative h-20 bg-transparent">
                          <div className="absolute left-2 top-2 text-xs text-gray-400 z-10">
                            Screen
                          </div>
                          <div className="absolute inset-0 flex items-center pl-20">
                            {timelineClips
                              .filter(clip => clip.layer === 'screen')
                              .map((clip) => {
                                const isSelected = selectedClipIds.has(clip.id)
                                const isDragging = draggingClipId === clip.id
                                const isTrimming = trimmingClipId === clip.id
                                const clipDuration = clip.timelineEnd - clip.timelineStart
                                
                                return (
                                  <div
                                    key={clip.id}
                                    data-clip-id={clip.id}
                                    className={`absolute h-full bg-blue-600 rounded-lg transition-all cursor-move ${
                                      isSelected ? 'ring-2 ring-blue-400' : ''
                                    } ${isDragging ? 'opacity-75' : ''}`}
                                    style={{
                                      left: `${clip.timelineStart * timelineZoom}px`,
                                      width: `${clipDuration * timelineZoom}px`,
                                    }}
                                    onMouseDown={(e) => {
                                      if ((e.target as HTMLElement).closest('.trim-handle')) return
                                      e.stopPropagation()
                                      if (timelineTool === 'select') {
                                        handleStartMoveClip(clip.id, e.clientX)
                                      }
                                    }}
                                    onClick={(e) => {
                                      if ((e.target as HTMLElement).closest('.trim-handle')) return
                                      const timelineContainer = e.currentTarget.closest('[data-timeline-container]') as HTMLElement
                                      if (!timelineContainer) return
                                      const containerRect = timelineContainer.getBoundingClientRect()
                                      const clickX = e.clientX - containerRect.left
                                      const clickTime = clickX / timelineZoom
                                      handleClipClick(clip.id, clickTime)
                                    }}
                                  >
                                    {/* Left trim handle */}
                                    <div
                                      className={`trim-handle absolute left-0 top-0 bottom-0 w-2 bg-green-500 z-30 cursor-ew-resize ${
                                        isTrimming && trimmingEdge === 'in' ? 'bg-green-400 w-3' : 'hover:bg-green-400'
                                      }`}
                                      onMouseDown={(e) => {
                                        e.stopPropagation()
                                        handleStartTrimClip(clip.id, 'in', e.clientX)
                                      }}
                                    >
                                      <div className="absolute -left-1 top-1/2 transform -translate-y-1/2 flex items-center">
                                        <div className="w-3 h-4 border-l-2 border-t-2 border-b-2 border-white rounded-l" />
                                        <div className="w-1 h-1 bg-white rounded-full ml-0.5" />
                                      </div>
                                    </div>
                                    
                                    {/* Right trim handle */}
                                    <div
                                      className={`trim-handle absolute right-0 top-0 bottom-0 w-2 bg-green-500 z-30 cursor-ew-resize ${
                                        isTrimming && trimmingEdge === 'out' ? 'bg-green-400 w-3' : 'hover:bg-green-400'
                                      }`}
                                      onMouseDown={(e) => {
                                        e.stopPropagation()
                                        handleStartTrimClip(clip.id, 'out', e.clientX)
                                      }}
                                    >
                                      <div className="absolute -right-1 top-1/2 transform -translate-y-1/2 flex items-center">
                                        <div className="w-1 h-1 bg-white rounded-full mr-0.5" />
                                        <div className="w-3 h-4 border-r-2 border-t-2 border-b-2 border-white rounded-r" />
                                      </div>
                                    </div>
                                    
                                    {/* Screen thumbnail */}
                                    {videoThumbnails.get(`${clip.sceneId}_${clip.takeId}_screen`) && (
                                      <img
                                        src={videoThumbnails.get(`${clip.sceneId}_${clip.takeId}_screen`)}
                                        alt="Screen thumbnail"
                                        className="absolute inset-0 w-full h-full object-cover rounded opacity-80"
                                      />
                                    )}
                                  </div>
                                )
                              })}
                          </div>
                        </div>
                      )}
                      
                      {/* Layout Track - Orange bar extending across entire timeline */}
                      <div className="relative h-12 bg-transparent">
                        <div className="absolute left-2 top-2 text-xs text-gray-400 z-10">
                          Layout
                        </div>
                        <div className="absolute inset-0 flex items-center pl-20">
                          <div 
                            className="absolute h-full bg-orange-500 rounded"
                            style={{
                              left: '0px',
                              width: `${totalDuration * timelineZoom}px`,
                            }}
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
            
            {/* Timeline controls */}
            <div className="px-4 py-2 border-t border-gray-700 flex items-center justify-between">
              <div className="flex gap-2 items-center">
                {/* Timeline tool selector */}
                <div className="flex gap-1 bg-gray-800 rounded p-1">
                  <button
                    onClick={() => setTimelineTool('select')}
                    className={`px-2 py-1 rounded text-xs ${
                      timelineTool === 'select' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                    }`}
                    title="Select Tool"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setTimelineTool('cut')}
                    className={`px-2 py-1 rounded text-xs ${
                      timelineTool === 'cut' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                    }`}
                    title="Cut Tool"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 3.293a1 1 0 011.414 0l1.172 1.172a1 1 0 010 1.414l-8.586 8.586a1 1 0 01-1.414 0l-1.172-1.172a1 1 0 010-1.414l8.586-8.586z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 14.121a1 1 0 011.414 0l1.172 1.172a1 1 0 010 1.414l-8.586 8.586a1 1 0 01-1.414 0l-1.172-1.172a1 1 0 010-1.414l8.586-8.586z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6" />
                    </svg>
                  </button>
                </div>
                
                {/* Delete selected clips button */}
                {selectedClipIds.size > 0 && (
                  <button
                    onClick={handleDeleteSelectedClips}
                    className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs"
                    title="Delete Selected Clips"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
              
              {/* Timeline zoom controls */}
              <div className="flex gap-2 items-center">
                <button
                  onClick={() => setTimelineZoom(Math.max(minZoom, timelineZoom - 10))}
                  className="p-1 hover:bg-gray-800 rounded"
                  title="Zoom Out"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
                  </svg>
                </button>
                <input
                  type="range"
                  min={minZoom}
                  max={maxZoom}
                  value={timelineZoom}
                  onChange={(e) => setTimelineZoom(parseInt(e.target.value))}
                  className="w-24"
                />
                <button
                  onClick={() => setTimelineZoom(Math.min(maxZoom, timelineZoom + 10))}
                  className="p-1 hover:bg-gray-800 rounded"
                  title="Zoom In"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                  </svg>
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowExportDialog(true)}
                  className="px-4 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm"
                >
                  Export
                </button>
                <button
                  onClick={() => {
                    if (selectedScenesForExport.size === 0) {
                      selectAllScenes()
                    }
                    handleExportDaVinci()
                  }}
                  className="px-4 py-1 bg-purple-600 hover:bg-purple-700 rounded text-sm"
                >
                  Export DaVinci Timeline
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
