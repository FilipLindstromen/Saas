import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import type { AspectRatio, CaptionStyle, OverlayItem, OverlayTextAnimation, QualityPreset, SafeZoneType, VideoSourceKind, LibraryClip } from './types'
import { useMediaDevices } from './hooks/useMediaDevices'
import { useRecorder } from './hooks/useRecorder'
import { getResolutionsForAspect, QUALITY_OPTIONS } from './constants'
import { loadVideoRecorderState, saveVideoRecorderState } from './utils/persistence'
import { getClipLibrary, saveClipToLibrary, removeClipFromLibrary, generateLibraryId } from './utils/clipLibrary'
import { saveRecording, loadRecording, clearRecording } from './utils/recordingStorage'
import { getVideoTrackCapabilities, filterResolutionsByCapabilities } from './utils/cameraCapabilities'
import { exportVideoForDownload, getVideoDurationFromBlob, type ExportFormat } from './utils/exportWithColorAdjustments'
import { RecordPreview } from './components/RecordPreview'
import { Timeline } from './components/Timeline'
import { TranscriptionPanel } from './components/TranscriptionPanel'
import { ThumbnailCaptionsPanel } from './components/ThumbnailCaptionsPanel'
import { ExportPanel } from './components/ExportPanel'
import { InspectorPanel, type InspectorTabId } from './components/InspectorPanel'
import { ClipLibraryPanel } from './components/ClipLibraryPanel'
import type { CaptionSegment } from './services/captions'
import { transcribeAudioFromVideo } from './services/captions'
import { SettingsModal, getStoredOpenAIKey } from './components/SettingsModal'
import { IconRecord, IconStop, IconThumbnail, IconExport, IconTrash, IconVideo, IconCamera } from './components/Icons'
import { getStoredTheme, setStoredTheme, applyTheme, type Theme } from './utils/theme'
import styles from './App.module.css'

const OVERLAY_DURATION = 5

function generateId() {
  return Math.random().toString(36).slice(2, 12)
}

export default function App() {
  const { videoDevices, audioDevices, error: devicesError } = useMediaDevices()

  const initialState = useMemo(() => loadVideoRecorderState(), [])

  const [videoKind, setVideoKind] = useState<VideoSourceKind>(() => initialState?.videoKind ?? 'camera')
  const [videoDeviceId, setVideoDeviceId] = useState(() => initialState?.videoDeviceId ?? '')
  const [audioDeviceId, setAudioDeviceId] = useState(() => initialState?.audioDeviceId ?? '')
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(() => initialState?.aspectRatio ?? '16:9')
  const [resolutionIndex, setResolutionIndex] = useState(() => initialState?.resolutionIndex ?? 0)
  const [quality, setQuality] = useState<QualityPreset>(() => initialState?.quality ?? 'high')
  const [portraitFillHeight, setPortraitFillHeight] = useState(() => initialState?.portraitFillHeight ?? false)
  const [studioQuality, setStudioQuality] = useState(() => initialState?.studioQuality ?? false)

  const [videoStream, setVideoStream] = useState<MediaStream | null>(null)
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null)
  const [canvasStream, setCanvasStream] = useState<MediaStream | null>(null)

  const [overlays, setOverlays] = useState<OverlayItem[]>(() => initialState?.overlays ?? [])
  const [overlayTextAnimation, setOverlayTextAnimation] = useState<OverlayTextAnimation>(
    () => initialState?.overlayTextAnimation ?? 'fade'
  )
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [seekTime, setSeekTime] = useState<number | null>(null)
  const [previewTime, setPreviewTime] = useState(0)
  const [userTimelineDuration, setUserTimelineDuration] = useState<number | null>(() => initialState?.userTimelineDuration ?? null)
  const [timelineHeight, setTimelineHeight] = useState(() => initialState?.timelineHeight ?? 220)
  const [defaultFontFamily, setDefaultFontFamily] = useState(() => initialState?.defaultFontFamily ?? 'Oswald')
  const [defaultSecondaryFont, setDefaultSecondaryFont] = useState(() => initialState?.defaultSecondaryFont ?? 'Playfair Display')
  const [defaultBold, setDefaultBold] = useState(() => initialState?.defaultBold ?? false)
  const [burnOverlaysIntoExport, setBurnOverlaysIntoExport] = useState(() => initialState?.burnOverlaysIntoExport ?? true)
  const [flipVideo, setFlipVideo] = useState(() => initialState?.flipVideo ?? false)
  const [colorAdjustmentsEnabled, setColorAdjustmentsEnabled] = useState(() => initialState?.colorAdjustmentsEnabled ?? false)
  const [colorBrightness, setColorBrightness] = useState(() => initialState?.colorBrightness ?? 100)
  const [colorContrast, setColorContrast] = useState(() => initialState?.colorContrast ?? 100)
  const [colorSaturation, setColorSaturation] = useState(() => initialState?.colorSaturation ?? 100)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [openaiApiKey, setOpenaiApiKey] = useState(() => getStoredOpenAIKey())
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [cameraCapabilities, setCameraCapabilities] = useState<ReturnType<typeof getVideoTrackCapabilities>>(null)
  const [captionPreviewStyle, setCaptionPreviewStyle] = useState<CaptionStyle>(() => initialState?.captionPreviewStyle ?? 'lower-third')
  const [captionPreviewFontSizePercent, setCaptionPreviewFontSizePercent] = useState(() => initialState?.captionPreviewFontSizePercent ?? 2)
  const [captionPreviewCaptionY, setCaptionPreviewCaptionY] = useState(() => initialState?.captionPreviewCaptionY ?? 0.85)
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false)
  const [captionSegments, setCaptionSegments] = useState<CaptionSegment[] | null>(null)
  /** Trim range of the recorded video (source seconds). Timeline shows trimEnd - trimStart. */
  const [videoTrimStart, setVideoTrimStart] = useState(0)
  const [videoTrimEnd, setVideoTrimEnd] = useState<number | null>(null)
  /** Video clip segments for split support. When null/empty, we use videoTrimStart/End. */
  const [videoClipSegments, setVideoClipSegments] = useState<{ trimStart: number; trimEnd: number }[] | null>(null)
  const [thumbnailPanelOpen, setThumbnailPanelOpen] = useState(false)
  const [thumbnailBlob, setThumbnailBlob] = useState<Blob | null>(null)
  const [thumbnailSeekTime, setThumbnailSeekTime] = useState(() => initialState?.thumbnailSeekTime ?? 0)
  const [thumbnailTexts, setThumbnailTexts] = useState<{ id: string; text: string; x: number; y: number; fontSizePercent: number; fontFamily?: string }[]>(() => initialState?.thumbnailTexts ?? [])
  const [thumbnailWebcamDataUrl, setThumbnailWebcamDataUrl] = useState<string | null>(() => initialState?.thumbnailWebcamDataUrl ?? null)
  const [thumbnailGeneratedDataUrl, setThumbnailGeneratedDataUrl] = useState<string | null>(() => initialState?.thumbnailGeneratedDataUrl ?? null)
  const [youtubeCaption, setYoutubeCaption] = useState('')
  const [youtubeTitle, setYoutubeTitle] = useState('')
  const [clipLibrary, setClipLibrary] = useState<LibraryClip[]>(() => getClipLibrary())
  type LeftPanelTabId = 'transcription' | 'clips'
  const [leftPanelTab, setLeftPanelTab] = useState<LeftPanelTabId>('transcription')
  const [inspectorTab, setInspectorTab] = useState<InspectorTabId>(() => (initialState?.inspectorTab as InspectorTabId) ?? 'current')
  const [safeZoneType, setSafeZoneType] = useState<SafeZoneType>(() => (initialState?.safeZoneType as SafeZoneType) ?? 'youtube-9:16')
  const [safeZoneVisible, setSafeZoneVisible] = useState(() => initialState?.safeZoneVisible ?? false)
  const [exportPanelOpen, setExportPanelOpen] = useState(false)
  const [exportFormat, setExportFormat] = useState<ExportFormat>('webm')
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme())
  const [musicBlob, setMusicBlob] = useState<Blob | null>(null)
  const [musicVolume, setMusicVolume] = useState(50)
  const [downloadPreparing, setDownloadPreparing] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [transcribeError, setTranscribeError] = useState<string | null>(null)
  const previewVideoRef = useRef<HTMLVideoElement | null>(null)
  const userHasTrimmedVideoRef = useRef(false)
  const [timelineResize, setTimelineResize] = useState<{ startY: number; startHeight: number } | null>(null)
  const [inspectorWidth, setInspectorWidth] = useState(() => initialState?.inspectorWidth ?? 280)
  const [inspectorResize, setInspectorResize] = useState<{ startX: number; startWidth: number } | null>(null)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [isRestoring, setIsRestoring] = useState(true)
  /** In edit mode: show recording (playback) or live webcam in preview */
  const [editPreviewSource, setEditPreviewSource] = useState<'recording' | 'webcam'>('recording')

  /* Audio state */
  const [videoVolume, setVideoVolume] = useState(() => initialState?.videoVolume ?? 100)
  const [noiseRemovalEnabled, setNoiseRemovalEnabled] = useState(() => initialState?.noiseRemovalEnabled ?? false)
  const [noiseRemovalAmount, setNoiseRemovalAmount] = useState(() => initialState?.noiseRemovalAmount ?? 50)

  const countdownTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const skipUserTimelineDurationResetRef = useRef(false)

  const allResolutions = useMemo(() => getResolutionsForAspect(aspectRatio), [aspectRatio])
  const resolutions = useMemo(() => {
    const filtered =
      videoKind === 'camera' && cameraCapabilities
        ? filterResolutionsByCapabilities(allResolutions, cameraCapabilities)
        : allResolutions
    return filtered.length > 0 ? filtered : allResolutions
  }, [aspectRatio, videoKind, cameraCapabilities, allResolutions])
  const resolution = resolutions[resolutionIndex] ?? resolutions[0] ?? allResolutions[0]
  const { width, height } = resolution ?? { width: 1280, height: 720 }
  const videoBitrate = useMemo(() => {
    const base = width * height * 2
    const factor = QUALITY_OPTIONS.find((q) => q.value === quality)?.bitrateFactor ?? 1
    return Math.round(base * factor)
  }, [width, height, quality])

  const { isRecording, recordedBlob, error: recordError, startRecording, stopRecording, setRecordedBlob } = useRecorder({
    canvasStream,
    videoStream,
    audioStream,
    videoBitrate,
  })

  const recordStartTimeRef = useRef<number>(0)
  const [recordElapsedSeconds, setRecordElapsedSeconds] = useState(0)
  useEffect(() => {
    if (!isRecording) {
      setRecordElapsedSeconds(0)
      setIsPreviewPlaying(false)
      setEditPreviewSource('recording')
      return
    }
    // Auto-play timeline when recording starts
    setIsPreviewPlaying(true)
    setPreviewTime(0)
    recordStartTimeRef.current = Date.now()
    const id = setInterval(() => {
      setRecordElapsedSeconds(Math.floor((Date.now() - recordStartTimeRef.current) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [isRecording])

  const isPlayback = !!recordedBlob
  const showLiveStream =
    (editPreviewSource === 'webcam' && !!videoStream) ||
    (isRecording && !!videoStream) ||
    (!recordedBlob && !!videoStream)

  const displayTime = showLiveStream ? previewTime : currentTime
  const safeDisplayTime = Number.isFinite(displayTime) && displayTime >= 0 ? displayTime : 0
  const computedTimelineDuration = Math.max(60, ...overlays.map((o) => o.endTime), 1)
  const sourceDuration = duration
  const trimmedDuration = videoTrimEnd != null ? videoTrimEnd - videoTrimStart : sourceDuration
  // When we have a trim, timeline shows only the trimmed region (0 to trimmedDuration) so the end is on the right
  // Ensure we never show 0 - use at least 1s or source duration when available
  const effectiveTrimmed = trimmedDuration > 0 ? trimmedDuration : Math.max(sourceDuration || 0, 1)
  const timelineDuration = isPlayback
    ? (userTimelineDuration ?? (videoTrimEnd != null ? effectiveTrimmed : Math.max(sourceDuration || 0, 1)))
    : (userTimelineDuration ?? computedTimelineDuration)

  const handleTimelineDurationChange = useCallback((seconds: number) => {
    const n = Number(seconds)
    if (Number.isFinite(n) && n >= 1 && n <= 600) setUserTimelineDuration(n)
  }, [])

  const previewTimeRef = useRef(0)
  previewTimeRef.current = previewTime
  useEffect(() => {
    // Playback ticking: advance previewTime when playing/recording AND showing webcam (or no recording)
    // When showing recorded video, we use currentTime from the video instead
    if ((!isPreviewPlaying && !isRecording) || !showLiveStream) return
    const startWall = performance.now()
    const startTime = previewTimeRef.current
    let rafId = 0
    const tick = () => {
      const elapsed = (performance.now() - startWall) / 1000
      const next = startTime + elapsed
      if (next >= timelineDuration) {
        setPreviewTime(timelineDuration)
        // If recording, we continue beyond duration? 
        // Or stop recording? Usually stop recording.
        // For now let's just loop or stay at end.
        if (!isRecording) setIsPreviewPlaying(false)
        return
      }
      setPreviewTime(next)
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [isPreviewPlaying, isRecording, showLiveStream, timelineDuration])

  useEffect(() => {
    if (videoDevices.length && !videoDeviceId) setVideoDeviceId(videoDevices[0].deviceId)
    if (audioDevices.length && !audioDeviceId) setAudioDeviceId(audioDevices[0].deviceId)
  }, [videoDevices, audioDevices, videoDeviceId, audioDeviceId])

  useEffect(() => {
    if (videoDevices.length && videoDeviceId && !videoDevices.some((d) => d.deviceId === videoDeviceId)) {
      setVideoDeviceId('')
    }
    if (audioDevices.length && audioDeviceId && !audioDevices.some((d) => d.deviceId === audioDeviceId)) {
      setAudioDeviceId('')
    }
  }, [videoDevices, audioDevices, videoDeviceId, audioDeviceId])

  useEffect(() => {
    if (videoKind === 'screen' || !videoStream) {
      setCameraCapabilities(null)
      return
    }
    setCameraCapabilities(getVideoTrackCapabilities(videoStream))
  }, [videoKind, videoStream])

  useEffect(() => {
    if (resolutions.length > 0 && resolutionIndex >= resolutions.length) {
      setResolutionIndex(resolutions.length - 1)
    }
  }, [resolutions.length, resolutionIndex])

  useEffect(() => {
    setCaptionSegments(null)
    if (!recordedBlob) {
      setDownloadUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
      setVideoTrimStart(0)
      setVideoTrimEnd(null)
      setVideoClipSegments(null)
      userHasTrimmedVideoRef.current = false
      setThumbnailBlob(null)
      setThumbnailGeneratedDataUrl(null)
      setThumbnailPanelOpen(false)
      return
    }
    // Logic for new recording setup (don't run when restoring - preserves persisted userTimelineDuration)
    if (!isRestoring) {
      setVideoTrimStart(0)
      setVideoTrimEnd(null)
      setVideoClipSegments(null)
      userHasTrimmedVideoRef.current = false
      if (duration === 0) setDuration(0)
      if (!skipUserTimelineDurationResetRef.current) {
        setUserTimelineDuration(null)
      }
      skipUserTimelineDurationResetRef.current = false
    }

    const url = URL.createObjectURL(recordedBlob)
    setDownloadUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [recordedBlob, isRestoring])

  // Fallback: when we have a recording but duration is still 0, try to get it from the blob
  // If that fails, use persisted userTimelineDuration so the UI doesn't stay at 0
  useEffect(() => {
    if (!recordedBlob || (duration != null && duration > 0)) return
    let cancelled = false
    getVideoDurationFromBlob(recordedBlob)
      .then((d) => {
        if (!cancelled && d > 0) setDuration(d)
      })
      .catch(() => {
        if (!cancelled && userTimelineDuration != null && userTimelineDuration >= 1 && userTimelineDuration <= 600) {
          setDuration(userTimelineDuration)
        }
      })
    return () => { cancelled = true }
  }, [recordedBlob, duration, userTimelineDuration])

  // Initialize video trim when we get duration from the recorded video
  useEffect(() => {
    if (!recordedBlob || !Number.isFinite(duration) || duration <= 0 || videoTrimEnd !== null) return
    setVideoTrimStart(0)
    setVideoTrimEnd(duration)
    setVideoClipSegments(null)
  }, [recordedBlob, duration, videoTrimEnd])

  // Load persisted recording on mount
  useEffect(() => {
    async function restore() {
      try {
        const saved = await loadRecording()
        if (saved?.blob) {
          skipUserTimelineDurationResetRef.current = true
          setRecordedBlob(saved.blob)
          const validDuration =
            saved.duration != null &&
            Number.isFinite(saved.duration) &&
            saved.duration > 0
          if (validDuration) {
            setDuration(saved.duration)
          } else {
            const persisted = loadVideoRecorderState()
            const fallback = persisted?.userTimelineDuration
            if (fallback != null && fallback >= 1 && fallback <= 600) {
              setDuration(fallback)
            }
            getVideoDurationFromBlob(saved.blob)
              .then((d) => { if (d > 0) setDuration(d) })
              .catch(() => {})
          }
        }
      } catch (e) {
        console.error('Failed to restore recording', e)
      } finally {
        setIsRestoring(false)
      }
    }
    restore()
  }, [])

  // Save or clear recording when it changes
  useEffect(() => {
    if (isRestoring) return
    if (recordedBlob) {
      saveRecording(recordedBlob, duration)
    } else {
      clearRecording()
    }
  }, [recordedBlob, duration, isRestoring])

  // Restore thumbnail blob from persisted data URL (e.g. after page load)
  useEffect(() => {
    if (!thumbnailGeneratedDataUrl || thumbnailBlob != null) return
    const dataUrl = thumbnailGeneratedDataUrl
    fetch(dataUrl)
      .then((r) => r.blob())
      .then((blob) => setThumbnailBlob(blob))
      .catch(() => { })
  }, [thumbnailGeneratedDataUrl, thumbnailBlob])

  useEffect(() => {
    if (countdown === null) return
    countdownTimeoutRef.current = setTimeout(() => {
      countdownTimeoutRef.current = null
      if (countdown > 1) {
        setCountdown(countdown - 1)
      } else {
        setCountdown(null)
        startRecording()
      }
    }, 1000)
    return () => {
      if (countdownTimeoutRef.current) {
        clearTimeout(countdownTimeoutRef.current)
        countdownTimeoutRef.current = null
      }
    }
  }, [countdown, startRecording])

  useEffect(() => {
    saveVideoRecorderState({
      videoKind,
      videoDeviceId,
      audioDeviceId,
      aspectRatio,
      resolutionIndex,
      quality,
      portraitFillHeight,
      studioQuality,
      overlays,
      overlayTextAnimation,
      captionPreviewStyle,
      captionPreviewFontSizePercent,
      captionPreviewCaptionY,
      userTimelineDuration,
      timelineHeight,
      inspectorWidth,
      inspectorTab,
      safeZoneType,
      safeZoneVisible,
      defaultFontFamily,
      defaultSecondaryFont,
      defaultBold,
      burnOverlaysIntoExport,
      flipVideo,
      colorAdjustmentsEnabled,
      colorBrightness,
      colorContrast,
      colorSaturation,
      thumbnailSeekTime,
      thumbnailTexts,
      thumbnailWebcamDataUrl,
      thumbnailGeneratedDataUrl,
      videoVolume,
      noiseRemovalEnabled,
      noiseRemovalAmount,
    })
  }, [videoKind, videoDeviceId, audioDeviceId, aspectRatio, resolutionIndex, quality, portraitFillHeight, studioQuality, overlays, overlayTextAnimation, captionPreviewStyle, captionPreviewFontSizePercent, captionPreviewCaptionY, userTimelineDuration, timelineHeight, inspectorWidth, inspectorTab, safeZoneType, safeZoneVisible, defaultFontFamily, defaultSecondaryFont, defaultBold, burnOverlaysIntoExport, flipVideo, colorAdjustmentsEnabled, colorBrightness, colorContrast, colorSaturation, thumbnailSeekTime, thumbnailTexts, thumbnailWebcamDataUrl, thumbnailGeneratedDataUrl, videoVolume, noiseRemovalEnabled, noiseRemovalAmount])

  const handleThumbnailChange = useCallback((blob: Blob | null, dataUrl?: string | null) => {
    setThumbnailBlob(blob)
    setThumbnailGeneratedDataUrl(dataUrl ?? null)
  }, [])

  const handleThumbnailStateChange = useCallback(
    (state: { seekTime: number; texts: { id: string; text: string; x: number; y: number; fontSizePercent: number; fontFamily?: string }[]; webcamImageUrl: string | null }) => {
      setThumbnailSeekTime(state.seekTime)
      setThumbnailTexts(state.texts)
      setThumbnailWebcamDataUrl(state.webcamImageUrl)
    },
    []
  )

  const handleTimelineResizeMove = useCallback(
    (e: PointerEvent) => {
      if (!timelineResize) return
      const deltaY = timelineResize.startY - e.clientY
      setTimelineHeight((h) => Math.min(600, Math.max(120, timelineResize.startHeight + deltaY)))
    },
    [timelineResize]
  )
  const handleTimelineResizeEnd = useCallback(() => {
    setTimelineResize(null)
  }, [])

  const handleDownloadWithColor = useCallback(async () => {
    if (!recordedBlob) return
    const filename = `recording_${aspectRatio.replace(':', '-')}_${width}x${height}.webm`
    const hasOverlaysToBurn = overlays.some((o) => o.burnIntoExport !== false)
    const hasTrim =
      videoTrimEnd != null &&
      (videoTrimStart > 0 || (duration != null && videoTrimEnd < duration))
    const hasColor =
      colorAdjustmentsEnabled &&
      (colorBrightness !== 100 || colorContrast !== 100 || colorSaturation !== 100)
    const needsExport = hasOverlaysToBurn || hasTrim || hasColor
    if (needsExport) {
      setDownloadPreparing(true)
      try {
        const result = await exportVideoForDownload(recordedBlob, {
          width,
          height,
          sourceDuration: duration ?? undefined,
          trimStart: videoTrimEnd != null ? videoTrimStart : undefined,
          trimEnd: videoTrimEnd ?? (duration ?? undefined),
          overlays,
          overlayTextAnimation,
          defaultFontFamily,
          defaultSecondaryFont,
          defaultBold,
          colorBrightness: colorAdjustmentsEnabled ? colorBrightness : 100,
          colorContrast: colorAdjustmentsEnabled ? colorContrast : 100,
          colorSaturation: colorAdjustmentsEnabled ? colorSaturation : 100,
          musicBlob: musicBlob ?? undefined,
          musicVolume,
        })
        const blob = result && typeof result === 'object' && 'blob' in result ? result.blob : result
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        a.click()
        URL.revokeObjectURL(url)
      } catch (e) {
        console.error('Export with overlays/color failed', e)
      } finally {
        setDownloadPreparing(false)
      }
    } else if (downloadUrl) {
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = filename
      a.click()
    }
  }, [
    recordedBlob,
    downloadUrl,
    aspectRatio,
    width,
    height,
    overlays,
    videoTrimStart,
    videoTrimEnd,
    duration,
    colorAdjustmentsEnabled,
    colorBrightness,
    colorContrast,
    colorSaturation,
    overlayTextAnimation,
    defaultFontFamily,
    defaultSecondaryFont,
    defaultBold,
  ])

  const handleInspectorResizeMove = useCallback(
    (e: PointerEvent) => {
      if (!inspectorResize) return
      const deltaX = inspectorResize.startX - e.clientX
      setInspectorWidth((w) => Math.min(560, Math.max(200, inspectorResize.startWidth + deltaX)))
    },
    [inspectorResize]
  )
  const handleInspectorResizeEnd = useCallback(() => {
    setInspectorResize(null)
  }, [])
  useEffect(() => {
    if (!inspectorResize) return
    const move = (e: PointerEvent) => handleInspectorResizeMove(e)
    const up = () => {
      handleInspectorResizeEnd()
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [inspectorResize, handleInspectorResizeMove, handleInspectorResizeEnd])

  useEffect(() => {
    if (!timelineResize) return
    window.addEventListener('pointermove', handleTimelineResizeMove)
    window.addEventListener('pointerup', handleTimelineResizeEnd)
    return () => {
      window.removeEventListener('pointermove', handleTimelineResizeMove)
      window.removeEventListener('pointerup', handleTimelineResizeEnd)
    }
  }, [timelineResize, handleTimelineResizeMove, handleTimelineResizeEnd])

  useEffect(() => {
    let vStream: MediaStream | null = null
    let aStream: MediaStream | null = null
    let studioDisconnect: (() => void) | null = null

    async function start() {
      try {
        if (videoKind === 'screen') {
          vStream = await navigator.mediaDevices.getDisplayMedia({
            video: { width: { ideal: width }, height: { ideal: height } },
            audio: false,
          })
        } else {
          // Prioritize selected device: deviceId must come first so the browser uses the correct camera
          const deviceConstraint = videoDeviceId ? { deviceId: { exact: videoDeviceId } } : {}
          const videoConstraints: MediaTrackConstraints = {
            ...deviceConstraint,
            width: { ideal: width },
            height: { ideal: height },
          }
          try {
            vStream = await navigator.mediaDevices.getUserMedia({
              video: { ...deviceConstraint, width: { exact: width }, height: { exact: height } },
            })
          } catch (exactErr) {
            try {
              vStream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints })
            } catch (idealErr) {
              // Last resort: device only (no resolution), ensures correct camera is used
              vStream = await navigator.mediaDevices.getUserMedia({
                video: videoDeviceId ? { deviceId: { exact: videoDeviceId } } : { width: { ideal: width }, height: { ideal: height } },
              })
            }
          }
        }
        setVideoStream(vStream)
      } catch (e) {
        console.error(e)
        setVideoStream(null)
      }

      try {
        if (audioDeviceId) {
          aStream = await navigator.mediaDevices.getUserMedia({
            audio: { deviceId: { exact: audioDeviceId } },
          })
          if (studioQuality) {
            const { createStudioAudioStream } = await import('./utils/studioAudio')
            const { stream, disconnect } = await createStudioAudioStream(aStream)
            studioDisconnect = disconnect
            setAudioStream(stream)
          } else {
            setAudioStream(aStream)
          }
        } else {
          setAudioStream(null)
        }
      } catch (e) {
        console.error(e)
        setAudioStream(null)
      }
    }

    start()
    return () => {
      studioDisconnect?.()
      vStream?.getTracks().forEach((t) => t.stop())
      aStream?.getTracks().forEach((t) => t.stop())
      setVideoStream(null)
      setAudioStream(null)
    }
  }, [videoKind, videoDeviceId, audioDeviceId, width, height, studioQuality])

  const handleAddOverlay = useCallback((type: 'text' | 'image' | 'video', initialPatch?: Partial<OverlayItem>) => {
    const start = displayTime
    const item: OverlayItem = {
      id: generateId(),
      type,
      startTime: start,
      endTime: Math.min(start + OVERLAY_DURATION, timelineDuration),
      ...(type === 'text' ? { text: 'New text', fontSizePercent: 10, fontFamily: defaultFontFamily, secondaryFont: defaultSecondaryFont, color: '#ffffff', x: 0.1, y: 0.1, burnIntoExport: true } : { x: 0.5, y: 0.5, imageScale: 1, burnIntoExport: true }),
      ...initialPatch,
    }
    setOverlays((prev) => [...prev, item])
    setSelectedOverlayId(item.id)
  }, [displayTime, timelineDuration, defaultFontFamily, defaultSecondaryFont])

  const handleAddOverlayFromLibrary = useCallback((clip: LibraryClip) => {
    const start = displayTime
    const item: OverlayItem = {
      ...clip.payload,
      id: generateId(),
      startTime: start,
      endTime: Math.min(start + OVERLAY_DURATION, timelineDuration),
    }
    setOverlays((prev) => [...prev, item])
    setSelectedOverlayId(item.id)
  }, [displayTime, timelineDuration])

  const handleRemoveFromClipLibrary = useCallback((libraryId: string) => {
    removeClipFromLibrary(libraryId)
    setClipLibrary(getClipLibrary())
  }, [])

  const handleEditOverlay = useCallback((id: string, patch: Partial<OverlayItem>) => {
    setOverlays((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)))
  }, [])

  const handleRemoveOverlay = useCallback((id: string) => {
    setOverlays((prev) => prev.filter((o) => o.id !== id))
    if (selectedOverlayId === id) setSelectedOverlayId(null)
  }, [selectedOverlayId])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      const target = document.activeElement
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || (target as HTMLElement)?.isContentEditable) return
      if (!selectedOverlayId) return
      e.preventDefault()
      if (selectedOverlayId === 'background') {
        if (recordedBlob && window.confirm('Delete this recording?')) {
          setRecordedBlob(null)
          setSelectedOverlayId(null)
        }
      } else {
        handleRemoveOverlay(selectedOverlayId)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedOverlayId, recordedBlob, handleRemoveOverlay])

  const handleSplitClipAtPlayhead = useCallback(() => {
    if (!selectedOverlayId) return
    const overlay = overlays.find((o) => o.id === selectedOverlayId)
    if (!overlay) return
    const t = recordedBlob ? currentTime : previewTime
    const minLen = 0.5
    if (t <= overlay.startTime + minLen || t >= overlay.endTime - minLen) return
    const newId = generateId()
    setOverlays((prev) =>
      prev.flatMap((o) => {
        if (o.id !== selectedOverlayId) return [o]
        return [
          { ...o, endTime: t },
          { ...o, id: newId, startTime: t, endTime: overlay.endTime },
        ]
      })
    )
    setSelectedOverlayId(newId)
  }, [selectedOverlayId, overlays, recordedBlob, currentTime, previewTime])

  const handleVideoClipSplit = useCallback(() => {
    if (!recordedBlob || videoTrimEnd == null) return
    const sourceTime = videoTrimStart + currentTime
    const segments = videoClipSegments ?? [{ trimStart: videoTrimStart, trimEnd: videoTrimEnd }]
    const idx = segments.findIndex((s) => sourceTime > s.trimStart && sourceTime < s.trimEnd)
    if (idx < 0) return
    const seg = segments[idx]
    const minLen = 0.5
    if (sourceTime <= seg.trimStart + minLen || sourceTime >= seg.trimEnd - minLen) return
    const next = [
      ...segments.slice(0, idx),
      { trimStart: seg.trimStart, trimEnd: sourceTime },
      { trimStart: sourceTime, trimEnd: seg.trimEnd },
      ...segments.slice(idx + 1),
    ]
    setVideoClipSegments(next)
    setSelectedOverlayId('background')
  }, [recordedBlob, videoTrimStart, videoTrimEnd, currentTime, videoClipSegments])

  const handleVideoClipTrimChange = useCallback((trimStart: number, trimEnd: number, segmentIndex?: number) => {
    userHasTrimmedVideoRef.current = true
    let newDuration: number
    if (videoClipSegments && segmentIndex != null) {
      const nextSegments = [...videoClipSegments]
      nextSegments[segmentIndex] = { trimStart, trimEnd }
      setVideoClipSegments(nextSegments)
      const newTrimStart = Math.min(...nextSegments.map((s) => s.trimStart))
      const newTrimEnd = Math.max(...nextSegments.map((s) => s.trimEnd))
      setVideoTrimStart(newTrimStart)
      setVideoTrimEnd(newTrimEnd)
      newDuration = newTrimEnd - newTrimStart
    } else {
      setVideoClipSegments(null)
      setVideoTrimStart(trimStart)
      setVideoTrimEnd(trimEnd)
      newDuration = trimEnd - trimStart
    }
    setCurrentTime((t) => Math.min(t, newDuration))
    const minClip = 0.5
    setOverlays((prev) =>
      prev.map((o) => {
        const endTime = Math.min(o.endTime, newDuration)
        const startTime = Math.max(0, Math.min(o.startTime, endTime - minClip))
        return { ...o, startTime, endTime }
      })
    )
  }, [videoClipSegments])

  const handleBurnedBlob = useCallback((blob: Blob) => {
    setRecordedBlob(blob)
  }, [setRecordedBlob])

  const handleTranscribe = useCallback(async () => {
    if (!recordedBlob) return
    setTranscribeError(null)
    setIsTranscribing(true)
    try {
      const segments = await transcribeAudioFromVideo(recordedBlob, openaiApiKey)
      setCaptionSegments(segments)
    } catch (e) {
      setTranscribeError(e instanceof Error ? e.message : 'Transcription failed')
    } finally {
      setIsTranscribing(false)
    }
  }, [recordedBlob, openaiApiKey])

  const handlePlaybackEnd = useCallback(() => {
    setIsPreviewPlaying(false)
  }, [])

  const handleClearProject = useCallback(() => {
    if (!window.confirm('Are you sure you want to clear the entire project? This will remove all recordings and overlays.')) return

    setRecordedBlob(null)
    setOverlays([])
    setCaptionSegments(null)
    setMusicBlob(null)
    setThumbnailBlob(null)
    setVideoTrimStart(0)
    setVideoTrimEnd(null)
    setVideoClipSegments(null)
    userHasTrimmedVideoRef.current = false
    setUserTimelineDuration(null)
    setDuration(0)
    setCurrentTime(0)
    setSeekTime(null)
    setSelectedOverlayId(null)
    setThumbnailTexts([])
    setThumbnailWebcamDataUrl(null)
    setThumbnailGeneratedDataUrl(null)
    setYoutubeCaption('')
    setYoutubeTitle('')
  }, [])

  const selectedOverlay = overlays.find((o) => o.id === selectedOverlayId) ?? null

  const renderPreviewRow = () => (
    <div className={styles.previewRow}>
      <section className={styles.previewSection} aria-label="Preview">
        <div className={styles.previewHeader}>
          <h2 className={styles.previewTitle}>Preview</h2>
          <p className={styles.previewSubtitle}>Video + overlays</p>
          <span className={styles.exportFormat}>
            Export: {aspectRatio} · {width}×{height}
          </span>
        </div>
        <div
          className={`${styles.previewWrap} ${aspectRatio === '9:16' || aspectRatio === '1:1' ? styles.previewConstrained : ''} ${(aspectRatio === '9:16' || aspectRatio === '1:1') && portraitFillHeight ? styles.previewFillHeight : ''}`}
        >
          <div className={styles.previewInner}>
          {countdown != null && (
            <div className={styles.countdownOverlay} aria-live="polite" aria-label={`Countdown ${countdown}`}>
              <span className={styles.countdownNumber}>{countdown}</span>
            </div>
          )}
          <RecordPreview
            videoStream={videoStream}
            width={width}
            height={height}
            overlays={overlays}
            currentTime={currentTime}
            displayTime={displayTime}
            isRecording={isRecording}
            recordedBlob={recordedBlob}
            onCaptureStream={setCanvasStream}
            onDurationChange={setDuration}
            onTimeUpdate={(time) => {
              if (videoTrimEnd != null) {
                setCurrentTime(Math.max(0, Math.min(videoTrimEnd - videoTrimStart, time - videoTrimStart)))
              } else {
                setCurrentTime(time)
              }
            }}
            videoTrimStart={recordedBlob && videoTrimEnd != null ? videoTrimStart : undefined}
            videoTrimEnd={recordedBlob && videoTrimEnd != null ? videoTrimEnd : undefined}
            seekTime={seekTime}
            isPreviewPlaying={!!recordedBlob ? isPreviewPlaying : undefined}
            onPlaybackEnd={recordedBlob ? handlePlaybackEnd : undefined}
            videoRef={previewVideoRef}
            onOverlayMove={(id, x, y) => handleEditOverlay(id, { x, y })}
            selectedOverlayId={selectedOverlayId}
            onOverlayEdit={handleEditOverlay}
            portraitFillHeight={portraitFillHeight}
            overlayTextAnimation={overlayTextAnimation}
            videoVolume={videoVolume}
            defaultFontFamily={defaultFontFamily}
            defaultSecondaryFont={defaultSecondaryFont}
            defaultBold={defaultBold}
            burnOverlaysIntoExport={burnOverlaysIntoExport}
            flipVideo={flipVideo}
            colorAdjustmentsEnabled={colorAdjustmentsEnabled}
            colorBrightness={colorBrightness}
            colorContrast={colorContrast}
            colorSaturation={colorSaturation}
            captionPreview={
              recordedBlob
                ? {
                  style: captionPreviewStyle,
                  fontSizePercent: captionPreviewFontSizePercent,
                  captionY: captionPreviewCaptionY,
                }
                : undefined
            }
            captionSegments={recordedBlob ? captionSegments : undefined}
            onCaptionYChange={recordedBlob ? setCaptionPreviewCaptionY : undefined}
            playbackUrl={downloadUrl}
            editPreviewSource={editPreviewSource}
          />
          </div>
        </div>
      </section>
    </div>
  )

  return (
    <div className={styles.app} >
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.titleBlock}>
            <h1 className={styles.title}>ReelRecorder</h1>
            <p className={styles.subtitle}>Record with overlays and burn-in captions</p>
          </div>
        </div>
        <div className={styles.headerCenter}>
          {/* Spacer so headerRight stays right; record + timer are in overlay */}
        </div>
        <div className={styles.headerCenterOverlay}>
          <button
              type="button"
              className={editPreviewSource === 'recording' ? styles.editPreviewSourceBtnActive : styles.editPreviewSourceBtn}
              onClick={() => setEditPreviewSource((s) => (s === 'recording' ? 'webcam' : 'recording'))}
              title={editPreviewSource === 'recording' ? 'Preview: recording. Click to use webcam.' : 'Preview: webcam. Click to use recording.'}
              aria-label={editPreviewSource === 'recording' ? 'Use recording in preview' : 'Use webcam in preview'}
              aria-pressed={editPreviewSource === 'webcam'}
            >
              {editPreviewSource === 'recording' ? <IconVideo /> : <IconCamera />}
            </button>
          <button
            type="button"
            className={countdown != null ? styles.recordStopToggleStop : isRecording ? styles.recordStopToggleStop : styles.recordStopToggleRecord}
            disabled={!videoStream && !isRecording && countdown == null}
            onClick={
              countdown != null
                ? () => setCountdown(null)
                : isRecording
                  ? stopRecording
                  : () => setCountdown(3)
            }
            title={countdown != null ? 'Cancel countdown' : isRecording ? 'Stop recording' : 'Start recording'}
            aria-label={countdown != null ? 'Cancel countdown' : isRecording ? 'Stop recording' : 'Start recording'}
          >
            {countdown != null ? <span className={styles.countdownCancelLabel}>Cancel</span> : isRecording ? <IconStop /> : <IconRecord />}
          </button>
          <div className={styles.recordTimer} role="timer" aria-live="polite" aria-label={isRecording ? `Recording time ${Math.floor(recordElapsedSeconds / 60)}:${String(recordElapsedSeconds % 60).padStart(2, '0')}` : 'Recording time'}>
            {isRecording && <span className={styles.recordTimerDot} aria-hidden />}
            {Math.floor(recordElapsedSeconds / 60)}:{String(recordElapsedSeconds % 60).padStart(2, '0')}
          </div>
          {recordError && <span className={styles.headerError}>{recordError}</span>}
        </div>
        <div className={styles.headerRight}>
          <div className={styles.panelToggles} role="group" aria-label="Panel toggles">
            <button
              type="button"
              className={thumbnailPanelOpen ? styles.panelToggleActive : styles.panelToggle}
              onClick={() => setThumbnailPanelOpen((p) => !p)}
              title="Thumbnail & Captions"
              aria-label="Toggle Thumbnail & Captions panel"
              aria-pressed={thumbnailPanelOpen}
            >
              <IconThumbnail />
            </button>
            <button
              type="button"
              className={exportPanelOpen ? styles.panelToggleActive : styles.panelToggle}
              onClick={() => setExportPanelOpen((p) => !p)}
              disabled={!recordedBlob}
              title={!recordedBlob ? 'Record first to export' : 'Toggle Export panel'}
              aria-label={!recordedBlob ? 'Record first to export' : 'Toggle Export panel'}
              aria-pressed={exportPanelOpen}
            >
              <IconExport />
            </button>
          </div>
          <button
            type="button"
            className={styles.themeToggle}
            onClick={() => {
              const next: Theme = theme === 'dark' ? 'light' : 'dark'
              setTheme(next)
              setStoredTheme(next)
              applyTheme(next)
            }}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="12" cy="12" r="5" />
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
          <button
            type="button"
            className={styles.clearBtn}
            onClick={handleClearProject}
            title="Clear Project"
            aria-label="Clear Project"
          >
            <IconTrash />
          </button>
          <button
            type="button"
            className={styles.settingsBtn}
            onClick={() => setSettingsOpen(true)}
            title="Settings (API keys)"
            aria-label="Settings"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      </header>

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onApiKeyChange={setOpenaiApiKey}
      />

      {exportPanelOpen && recordedBlob && (
        <ExportPanel
          onClose={() => setExportPanelOpen(false)}
          videoBlob={recordedBlob}
          downloadUrl={downloadUrl}
          aspectRatio={aspectRatio}
          width={width}
          height={height}
          exportFormat={exportFormat}
          onExportFormatChange={setExportFormat}
          youtubeTitle={youtubeTitle}
          onYoutubeTitleChange={setYoutubeTitle}
          youtubeCaption={youtubeCaption}
          onYoutubeCaptionChange={setYoutubeCaption}
          thumbnailBlob={thumbnailBlob}
          overlays={overlays}
          overlayTextAnimation={overlayTextAnimation}
          defaultFontFamily={defaultFontFamily}
          defaultSecondaryFont={defaultSecondaryFont}
          defaultBold={defaultBold}
          trimStart={videoTrimStart}
          trimEnd={videoTrimEnd ?? undefined}
          sourceDuration={duration ?? undefined}
          colorAdjustmentsEnabled={colorAdjustmentsEnabled}
          colorBrightness={colorBrightness}
          colorContrast={colorContrast}
          colorSaturation={colorSaturation}
          musicBlob={musicBlob}
          musicVolume={musicVolume}
          videoVolume={videoVolume}
          noiseRemovalEnabled={noiseRemovalEnabled}
          noiseRemovalAmount={noiseRemovalAmount}
        />
      )
      }

      {recordedBlob && !thumbnailPanelOpen && (
        <div className={styles.leftPanel} aria-label="Left panel">
          <div className={styles.leftPanelTabs} role="tablist" aria-label="Left panel tabs">
            <button
              type="button"
              role="tab"
              aria-selected={leftPanelTab === 'transcription'}
              className={leftPanelTab === 'transcription' ? styles.leftPanelTabActive : styles.leftPanelTab}
              onClick={() => setLeftPanelTab('transcription')}
            >
              Transcription
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={leftPanelTab === 'clips'}
              className={leftPanelTab === 'clips' ? styles.leftPanelTabActive : styles.leftPanelTab}
              onClick={() => setLeftPanelTab('clips')}
            >
              Clip library
            </button>
          </div>
          <div className={styles.leftPanelContent}>
            {leftPanelTab === 'transcription' && (
              <TranscriptionPanel
                segments={captionSegments ?? []}
                onSegmentsChange={setCaptionSegments}
                currentTime={currentTime}
                onSeek={(sourceTime) => {
                  setSeekTime(sourceTime)
                  setCurrentTime(
                    videoTrimEnd != null ? sourceTime - videoTrimStart : sourceTime
                  )
                  setTimeout(() => setSeekTime(null), 150)
                }}
                onTranscribe={handleTranscribe}
                isTranscribing={isTranscribing}
                transcribeError={transcribeError}
              />
            )}
            {leftPanelTab === 'clips' && (
              <ClipLibraryPanel
                clips={clipLibrary}
                onAddToTimeline={handleAddOverlayFromLibrary}
                onRemove={handleRemoveFromClipLibrary}
              />
            )}
          </div>
        </div>
      )}

      <div
        className={styles.body}
        style={{
          paddingRight: inspectorWidth,
          paddingLeft: recordedBlob && !thumbnailPanelOpen ? 320 : 0,
        }}
      >
        <div className={styles.main}>
          <div className={styles.content}>
            {thumbnailPanelOpen ? (
              <ThumbnailCaptionsPanel
                videoUrl={downloadUrl ?? ''}
                videoBlob={recordedBlob ?? undefined}
                aspectRatio={aspectRatio}
                width={width}
                height={height}
                captionSegments={captionSegments}
                openaiApiKey={openaiApiKey}
                youtubeTitle={youtubeTitle}
                onYoutubeTitleChange={setYoutubeTitle}
                youtubeCaption={youtubeCaption}
                onYoutubeCaptionChange={setYoutubeCaption}
                thumbnailBlob={thumbnailBlob}
                onThumbnailChange={handleThumbnailChange}
                onClose={() => setThumbnailPanelOpen(false)}
                videoDeviceId={videoDeviceId}
                flipVideo={flipVideo}
                colorAdjustmentsEnabled={colorAdjustmentsEnabled}
                colorBrightness={colorBrightness}
                colorContrast={colorContrast}
                colorSaturation={colorSaturation}
                embedded
                initialSeekTime={thumbnailSeekTime}
                initialTexts={thumbnailTexts}
                initialWebcamImageUrl={thumbnailWebcamDataUrl}
                onThumbnailStateChange={handleThumbnailStateChange}
              />
            ) : (
              <>
                {renderPreviewRow()}
              </>
            )}
          </div>
        </div>

        {!thumbnailPanelOpen && (
          <div
            className={styles.globalTimeline}
            style={{ height: timelineHeight }}
          >
            <div
              className={styles.timelineResizeHandle}
              onPointerDown={(e) => {
                e.preventDefault()
                setTimelineResize({ startY: e.clientY, startHeight: timelineHeight })
                  ; (e.target as HTMLElement).setPointerCapture?.(e.pointerId)
              }}
              onPointerUp={(e) => {
                ; (e.target as HTMLElement).releasePointerCapture?.(e.pointerId)
                handleTimelineResizeEnd()
              }}
              role="slider"
              aria-label="Resize timeline height"
              aria-valuemin={120}
              aria-valuemax={600}
              aria-valuenow={timelineHeight}
            />
            <div className={styles.timelineInner}>
              <Timeline
                overlays={overlays}
                duration={timelineDuration}
                currentTime={safeDisplayTime}
                onSeek={(t) => {
                  const clamped = Math.min(Math.max(0, t), timelineDuration)
                  if (showLiveStream) {
                    setPreviewTime(clamped)
                  } else if (recordedBlob) {
                    const trimLen = videoTrimEnd != null ? videoTrimEnd - videoTrimStart : sourceDuration
                    const timelineTime = Math.min(Math.max(0, t), trimLen)
                    const sourceTime = videoTrimStart + timelineTime
                    setSeekTime(sourceTime)
                    setCurrentTime(timelineTime)
                    setTimeout(() => setSeekTime(null), 150)
                  }
                }}
                onAddOverlay={handleAddOverlay}
                onEditOverlay={handleEditOverlay}
                onRemoveOverlay={handleRemoveOverlay}
                onSelectOverlay={setSelectedOverlayId}
                selectedId={selectedOverlayId}
                onDurationChange={handleTimelineDurationChange}
                overlayTextAnimation={overlayTextAnimation}
                onOverlayTextAnimationChange={setOverlayTextAnimation}
                isPreviewPlaying={isPreviewPlaying}
                onPreviewPlayToggle={() => {
                  if (showLiveStream && !isPreviewPlaying && previewTime >= timelineDuration - 0.05) {
                    setPreviewTime(0)
                  }
                  setIsPreviewPlaying((p) => !p)
                }}
                onSplitClip={handleSplitClipAtPlayhead}
                videoClipTrim={
                  recordedBlob
                    ? { trimStart: videoTrimStart, trimEnd: videoTrimEnd ?? sourceDuration ?? 1 }
                    : undefined
                }
                videoSourceDuration={recordedBlob ? Math.max(sourceDuration, 0.01) : undefined}
                onVideoClipTrimChange={recordedBlob ? handleVideoClipTrimChange : undefined}
                onVideoClipSplit={recordedBlob ? handleVideoClipSplit : undefined}
                videoClipSegments={recordedBlob && videoClipSegments ? videoClipSegments : undefined}
              />
            </div>
          </div>
        )}
      </div>

      <div
        className={styles.inspectorWrap}
        style={{ width: inspectorWidth }}
      >
        <div
          className={styles.inspectorResizeHandle}
          onPointerDown={(e) => {
            e.preventDefault()
            setInspectorResize({ startX: e.clientX, startWidth: inspectorWidth })
              ; (e.target as HTMLElement).setPointerCapture?.(e.pointerId)
          }}
          role="separator"
          aria-label="Resize inspector"
        />
        <div className={styles.inspectorFixed}>
          <InspectorPanel
            activeTab={inspectorTab}
            onTabChange={setInspectorTab}
            overlayTextAnimation={overlayTextAnimation}
            onOverlayTextAnimationChange={setOverlayTextAnimation}
            defaultFontFamily={defaultFontFamily}
            onDefaultFontFamilyChange={setDefaultFontFamily}
            defaultSecondaryFont={defaultSecondaryFont}
            onDefaultSecondaryFontChange={setDefaultSecondaryFont}
            defaultBold={defaultBold}
            onDefaultBoldChange={setDefaultBold}
            burnOverlaysIntoExport={burnOverlaysIntoExport}
            onBurnOverlaysIntoExportChange={setBurnOverlaysIntoExport}
            flipVideo={flipVideo}
            onFlipVideoChange={setFlipVideo}
            selectedOverlay={selectedOverlay}
            onOverlayUpdate={(patch) => selectedOverlay && handleEditOverlay(selectedOverlay.id, patch)}
            onOverlayRemove={handleRemoveOverlay}
            onDeselectOverlay={() => setSelectedOverlayId(null)}
            videoDevices={videoDevices}
            audioDevices={audioDevices}
            videoKind={videoKind}
            onVideoKindChange={setVideoKind}
            videoDeviceId={videoDeviceId}
            onVideoDeviceIdChange={setVideoDeviceId}
            audioDeviceId={audioDeviceId}
            onAudioDeviceIdChange={setAudioDeviceId}
            videoError={devicesError}
            aspectRatio={aspectRatio}
            onAspectRatioChange={(a) => { setAspectRatio(a); setResolutionIndex(0) }}
            resolutions={resolutions}
            resolutionIndex={resolutionIndex}
            onResolutionIndexChange={setResolutionIndex}
            quality={quality}
            onQualityChange={setQuality}
            studioQuality={studioQuality}
            onStudioQualityChange={setStudioQuality}
            portraitFillHeight={portraitFillHeight}
            onPortraitFillHeightChange={setPortraitFillHeight}
            colorAdjustmentsEnabled={colorAdjustmentsEnabled}
            onColorAdjustmentsEnabledChange={setColorAdjustmentsEnabled}
            colorBrightness={colorBrightness}
            onColorBrightnessChange={setColorBrightness}
            colorContrast={colorContrast}
            onColorContrastChange={setColorContrast}
            colorSaturation={colorSaturation}
            onColorSaturationChange={setColorSaturation}
            videoBlob={recordedBlob}
            onBurnedBlob={handleBurnedBlob}
            captionStyle={captionPreviewStyle}
            onCaptionStyleChange={setCaptionPreviewStyle}
            captionFontSizePercent={captionPreviewFontSizePercent}
            onCaptionFontSizePercentChange={setCaptionPreviewFontSizePercent}
            captionY={captionPreviewCaptionY}
            onCaptionYChange={setCaptionPreviewCaptionY}
            captionSegments={captionSegments}
            onTranscriptionDone={setCaptionSegments}
            openaiApiKey={openaiApiKey}
            videoWidth={width}
            videoHeight={height}
            musicBlob={musicBlob}
            onMusicBlobChange={setMusicBlob}
            musicVolume={musicVolume}
            onMusicVolumeChange={setMusicVolume}
            videoVolume={videoVolume}
            onVideoVolumeChange={setVideoVolume}
            selectedId={selectedOverlayId}
            onRemoveBackgroundClip={() => {
              setRecordedBlob(null)
              setSelectedOverlayId(null)
            }}
            noiseRemovalEnabled={noiseRemovalEnabled}
            onNoiseRemovalEnabledChange={setNoiseRemovalEnabled}
            noiseRemovalAmount={noiseRemovalAmount}
            onNoiseRemovalAmountChange={setNoiseRemovalAmount}
            safeZoneType={safeZoneType}
            onSafeZoneTypeChange={setSafeZoneType}
            safeZoneVisible={safeZoneVisible}
            onSafeZoneVisibleChange={setSafeZoneVisible}
          />
        </div>
      </div>
    </div >
  )
}
