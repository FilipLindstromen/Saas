import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import type { AspectRatio, CaptionStyle, OverlayItem, OverlayTextAnimation, QualityPreset, SafeZoneType, VideoSourceKind } from './types'
import { useMediaDevices } from './hooks/useMediaDevices'
import { useRecorder } from './hooks/useRecorder'
import { getResolutionsForAspect, QUALITY_OPTIONS } from './constants'
import { loadVideoRecorderState, saveVideoRecorderState } from './utils/persistence'
import { getVideoTrackCapabilities, filterResolutionsByCapabilities } from './utils/cameraCapabilities'
import { exportVideoForDownload } from './utils/exportWithColorAdjustments'
import { RecordPreview } from './components/RecordPreview'
import { Timeline } from './components/Timeline'
import { TranscriptionPanel } from './components/TranscriptionPanel'
import { ThumbnailCaptionsPanel } from './components/ThumbnailCaptionsPanel'
import { ExportPanel } from './components/ExportPanel'
import { InspectorPanel, type InspectorTabId } from './components/InspectorPanel'
import { VideoSettingsModal } from './components/VideoSettingsModal'
import type { CaptionSegment } from './services/captions'
import { transcribeAudioFromVideo } from './services/captions'
import { SettingsModal, getStoredOpenAIKey } from './components/SettingsModal'
import { IconRecord, IconStop, IconPlay, IconDownload, IconEdit, IconThumbnail, IconExport } from './components/Icons'
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
  const [finalBlob, setFinalBlob] = useState<Blob | null>(null)
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
  const [mode, setMode] = useState<'record' | 'edit'>('record')
  /** Trim range of the recorded video (source seconds). Timeline shows trimEnd - trimStart. */
  const [videoTrimStart, setVideoTrimStart] = useState(0)
  const [videoTrimEnd, setVideoTrimEnd] = useState<number | null>(null)
  const [thumbnailPanelOpen, setThumbnailPanelOpen] = useState(false)
  const [thumbnailBlob, setThumbnailBlob] = useState<Blob | null>(null)
  const [thumbnailSeekTime, setThumbnailSeekTime] = useState(() => initialState?.thumbnailSeekTime ?? 0)
  const [thumbnailTexts, setThumbnailTexts] = useState<{ id: string; text: string; x: number; y: number; fontSizePercent: number; fontFamily?: string }[]>(() => initialState?.thumbnailTexts ?? [])
  const [thumbnailWebcamDataUrl, setThumbnailWebcamDataUrl] = useState<string | null>(() => initialState?.thumbnailWebcamDataUrl ?? null)
  const [thumbnailGeneratedDataUrl, setThumbnailGeneratedDataUrl] = useState<string | null>(() => initialState?.thumbnailGeneratedDataUrl ?? null)
  const [youtubeCaption, setYoutubeCaption] = useState('')
  const [youtubeTitle, setYoutubeTitle] = useState('')
  const [inspectorTab, setInspectorTab] = useState<InspectorTabId>(() => (initialState?.inspectorTab as InspectorTabId) ?? 'current')
  const [safeZoneType, setSafeZoneType] = useState<SafeZoneType>(() => (initialState?.safeZoneType as SafeZoneType) ?? 'youtube-9:16')
  const [safeZoneVisible, setSafeZoneVisible] = useState(() => initialState?.safeZoneVisible ?? false)
  const [exportPanelOpen, setExportPanelOpen] = useState(false)
  const [downloadPreparing, setDownloadPreparing] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [transcribeError, setTranscribeError] = useState<string | null>(null)
  const previewVideoRef = useRef<HTMLVideoElement | null>(null)
  const userHasTrimmedVideoRef = useRef(false)
  const [timelineResize, setTimelineResize] = useState<{ startY: number; startHeight: number } | null>(null)
  const [inspectorWidth, setInspectorWidth] = useState(() => initialState?.inspectorWidth ?? 280)
  const [inspectorResize, setInspectorResize] = useState<{ startX: number; startWidth: number } | null>(null)
  const [countdown, setCountdown] = useState<number | null>(null)
  const countdownTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
      return
    }
    recordStartTimeRef.current = Date.now()
    const id = setInterval(() => {
      setRecordElapsedSeconds(Math.floor((Date.now() - recordStartTimeRef.current) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [isRecording])

  const isPlayback = !!recordedBlob

  useEffect(() => {
    if (recordedBlob && !isRecording) setMode('edit')
  }, [recordedBlob, isRecording])
  const displayTime = isPlayback ? currentTime : previewTime
  const safeDisplayTime = Number.isFinite(displayTime) && displayTime >= 0 ? displayTime : 0
  const computedTimelineDuration = Math.max(60, ...overlays.map((o) => o.endTime), 1)
  const sourceDuration = duration
  const trimmedDuration = videoTrimEnd != null ? videoTrimEnd - videoTrimStart : sourceDuration
  const timelineDuration = isPlayback
    ? (userTimelineDuration ?? Math.max(sourceDuration || 0, trimmedDuration || 1, 1))
    : (userTimelineDuration ?? computedTimelineDuration)

  const handleTimelineDurationChange = useCallback((seconds: number) => {
    const n = Number(seconds)
    if (Number.isFinite(n) && n >= 1 && n <= 600) setUserTimelineDuration(n)
  }, [])

  const previewTimeRef = useRef(0)
  previewTimeRef.current = previewTime
  useEffect(() => {
    if (!isPreviewPlaying || recordedBlob) return
    const startWall = performance.now()
    const startTime = previewTimeRef.current
    let rafId = 0
    const tick = () => {
      const elapsed = (performance.now() - startWall) / 1000
      const next = startTime + elapsed
      if (next >= timelineDuration) {
        setPreviewTime(timelineDuration)
        setIsPreviewPlaying(false)
        return
      }
      setPreviewTime(next)
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [isPreviewPlaying, recordedBlob, timelineDuration])

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
      userHasTrimmedVideoRef.current = false
      setThumbnailBlob(null)
      setThumbnailGeneratedDataUrl(null)
      setThumbnailPanelOpen(false)
      return
    }
    setVideoTrimStart(0)
    setVideoTrimEnd(null)
    userHasTrimmedVideoRef.current = false
    setDuration(0)
    setUserTimelineDuration(null)
    const url = URL.createObjectURL(recordedBlob)
    setDownloadUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [recordedBlob])

  // Initialize video trim when we get duration from the recorded video
  useEffect(() => {
    if (!recordedBlob || !Number.isFinite(duration) || duration <= 0 || videoTrimEnd !== null) return
    setVideoTrimStart(0)
    setVideoTrimEnd(duration)
  }, [recordedBlob, duration, videoTrimEnd])

  // Restore thumbnail blob from persisted data URL (e.g. after page load)
  useEffect(() => {
    if (!thumbnailGeneratedDataUrl || thumbnailBlob != null) return
    const dataUrl = thumbnailGeneratedDataUrl
    fetch(dataUrl)
      .then((r) => r.blob())
      .then((blob) => setThumbnailBlob(blob))
      .catch(() => {})
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
    })
  }, [videoKind, videoDeviceId, audioDeviceId, aspectRatio, resolutionIndex, quality, portraitFillHeight, studioQuality, overlays, overlayTextAnimation, captionPreviewStyle, captionPreviewFontSizePercent, captionPreviewCaptionY, userTimelineDuration, timelineHeight, inspectorWidth, inspectorTab, safeZoneType, safeZoneVisible, defaultFontFamily, defaultSecondaryFont, defaultBold, burnOverlaysIntoExport, flipVideo, colorAdjustmentsEnabled, colorBrightness, colorContrast, colorSaturation, thumbnailSeekTime, thumbnailTexts, thumbnailWebcamDataUrl, thumbnailGeneratedDataUrl])

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
        const blob = await exportVideoForDownload(recordedBlob, {
          width,
          height,
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
        })
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
          vStream = await navigator.mediaDevices.getUserMedia({
            video: videoDeviceId
              ? { deviceId: { exact: videoDeviceId }, width: { ideal: width }, height: { ideal: height } }
              : { width: { ideal: width }, height: { ideal: height } },
          })
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

  const handleAddOverlay = useCallback((type: 'text' | 'image') => {
    const start = displayTime
    const item: OverlayItem = {
      id: generateId(),
      type,
      startTime: start,
      endTime: Math.min(start + OVERLAY_DURATION, timelineDuration),
      ...(type === 'text' ? { text: 'New text', fontSizePercent: 10, fontFamily: defaultFontFamily, secondaryFont: defaultSecondaryFont, color: '#ffffff', x: 0.1, y: 0.1, burnIntoExport: true } : { x: 0.5, y: 0.5, imageScale: 1, burnIntoExport: true }),
    }
    setOverlays((prev) => [...prev, item])
    setSelectedOverlayId(item.id)
  }, [displayTime, timelineDuration, defaultFontFamily, defaultSecondaryFont])

  const handleEditOverlay = useCallback((id: string, patch: Partial<OverlayItem>) => {
    setOverlays((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)))
  }, [])

  const handleRemoveOverlay = useCallback((id: string) => {
    setOverlays((prev) => prev.filter((o) => o.id !== id))
    if (selectedOverlayId === id) setSelectedOverlayId(null)
  }, [selectedOverlayId])

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

  const handleVideoClipTrimChange = useCallback((trimStart: number, trimEnd: number) => {
    userHasTrimmedVideoRef.current = true
    setVideoTrimStart(trimStart)
    setVideoTrimEnd(trimEnd)
    const newDuration = trimEnd - trimStart
    setCurrentTime((t) => Math.min(t, newDuration))
    const minClip = 0.5
    setOverlays((prev) =>
      prev.map((o) => {
        const endTime = Math.min(o.endTime, newDuration)
        const startTime = Math.max(0, Math.min(o.startTime, endTime - minClip))
        return { ...o, startTime, endTime }
      })
    )
  }, [])

  const handleBurnedBlob = useCallback((blob: Blob) => {
    setFinalBlob(blob)
    setRecordedBlob(blob)
  }, [])

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
          className={`${styles.previewWrap} ${aspectRatio === '9:16' || aspectRatio === '1:1' ? styles.previewConstrained : ''}`}
        >
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
            onTimeUpdate={setCurrentTime}
            videoTrimStart={recordedBlob && videoTrimEnd != null ? videoTrimStart : undefined}
            videoTrimEnd={recordedBlob && videoTrimEnd != null ? videoTrimEnd : undefined}
            seekTime={seekTime}
            isPreviewPlaying={mode === 'edit' && !!recordedBlob ? isPreviewPlaying : undefined}
            onPlaybackEnd={mode === 'edit' && recordedBlob ? () => setIsPreviewPlaying(false) : undefined}
            videoRef={previewVideoRef}
            onOverlayMove={(id, x, y) => handleEditOverlay(id, { x, y })}
            portraitFillHeight={portraitFillHeight}
            overlayTextAnimation={overlayTextAnimation}
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
          />
        </div>
      </section>
    </div>
  )

  const renderPlaybackBar = () => (
    <div className={styles.playbackBar}>
      <button
        type="button"
        className={styles.playBtn}
        onClick={() => {
          const v = previewVideoRef.current
          if (!v) return
          if (v.paused) {
            const p = v.play()
            if (p && typeof p.catch === 'function') p.catch(() => {})
          } else {
            v.pause()
          }
        }}
        title="Play / Pause"
        aria-label="Play / Pause"
      >
        <IconPlay />
      </button>
      <button
        type="button"
        className={styles.downloadBtn}
        title={downloadPreparing ? 'Preparing…' : `Download ${aspectRatio} ${width}×${height}`}
        aria-label={downloadPreparing ? 'Preparing download' : 'Download recording'}
        disabled={!recordedBlob || downloadPreparing}
        onClick={handleDownloadWithColor}
      >
        <IconDownload />
      </button>
    </div>
  )

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.titleBlock}>
            <h1 className={styles.title}>ReelRecorder</h1>
            <p className={styles.subtitle}>Record with overlays and burn-in captions</p>
          </div>
          <div className={styles.modeToggle} role="tablist" aria-label="Record, Edit, Thumbnail, Export">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'record'}
              aria-label="Record"
              className={mode === 'record' ? styles.modeBtnActive : styles.modeBtn}
              onClick={() => setMode('record')}
              title="Record"
            >
              <IconRecord />
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'edit' && !thumbnailPanelOpen && !exportPanelOpen}
              aria-label="Edit"
              className={mode === 'edit' && !thumbnailPanelOpen && !exportPanelOpen ? styles.modeBtnActive : styles.modeBtn}
              onClick={() => {
                setMode('edit')
                setThumbnailPanelOpen(false)
                setExportPanelOpen(false)
              }}
              disabled={!recordedBlob}
              title={!recordedBlob ? 'Record first to edit' : 'Edit recording'}
            >
              <IconEdit />
            </button>
            <button
              type="button"
              aria-label="Thumbnail & Captions"
              className={thumbnailPanelOpen ? styles.modeBtnActive : styles.modeBtn}
              onClick={() => {
                setThumbnailPanelOpen((p) => !p)
                if (!thumbnailPanelOpen) setExportPanelOpen(false)
              }}
              disabled={!recordedBlob}
              title={!recordedBlob ? 'Record first' : 'Thumbnail & YouTube description'}
              aria-pressed={thumbnailPanelOpen}
            >
              <IconThumbnail />
            </button>
            <button
              type="button"
              aria-label="Export"
              className={exportPanelOpen ? styles.modeBtnActive : styles.modeBtn}
              onClick={() => {
                setExportPanelOpen((p) => !p)
                if (!exportPanelOpen) setThumbnailPanelOpen(false)
              }}
              disabled={!recordedBlob}
              title={!recordedBlob ? 'Record first to export' : 'Export, download, publish to YouTube'}
              aria-pressed={exportPanelOpen}
            >
              <IconExport />
            </button>
          </div>
        </div>
        <div className={styles.headerCenter}>
          {/* Spacer so headerRight stays right; record + timer are in overlay */}
        </div>
        <div className={styles.headerCenterOverlay}>
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
        />
      )}

      {mode === 'edit' && recordedBlob && !thumbnailPanelOpen && (
        <div className={styles.leftPanel} aria-label="Transcription">
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
        </div>
      )}

      <div
        className={styles.body}
        style={{
          paddingRight: inspectorWidth,
          paddingLeft: mode === 'edit' && recordedBlob && !thumbnailPanelOpen ? 320 : 0,
        }}
      >
        <div className={styles.main}>
        <div className={styles.content}>
          {thumbnailPanelOpen && recordedBlob && downloadUrl ? (
            <ThumbnailCaptionsPanel
              videoUrl={downloadUrl}
              videoBlob={recordedBlob}
              aspectRatio={aspectRatio}
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
              embedded
              initialSeekTime={thumbnailSeekTime}
              initialTexts={thumbnailTexts}
              initialWebcamImageUrl={thumbnailWebcamDataUrl}
              onThumbnailStateChange={handleThumbnailStateChange}
            />
          ) : (
            <>
              {renderPreviewRow()}
              {mode === 'edit' && recordedBlob && renderPlaybackBar()}
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
              ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
            }}
            onPointerUp={(e) => {
              ;(e.target as HTMLElement).releasePointerCapture?.(e.pointerId)
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
              if (recordedBlob) {
                const trimLen = videoTrimEnd != null ? videoTrimEnd - videoTrimStart : sourceDuration
                const timelineTime = Math.min(Math.max(0, t), trimLen)
                const sourceTime = videoTrimStart + timelineTime
                setSeekTime(sourceTime)
                setCurrentTime(timelineTime)
                setTimeout(() => setSeekTime(null), 150)
              } else {
                setPreviewTime(t)
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
              if (recordedBlob) {
                setIsPreviewPlaying((p) => !p)
              } else {
                if (!isPreviewPlaying && previewTime >= timelineDuration - 0.05) setPreviewTime(0)
                setIsPreviewPlaying((p) => !p)
              }
            }}
            onSplitClip={handleSplitClipAtPlayhead}
            videoClipTrim={
              recordedBlob
                ? { trimStart: videoTrimStart, trimEnd: videoTrimEnd ?? sourceDuration ?? 1 }
                : undefined
            }
            videoSourceDuration={recordedBlob ? Math.max(sourceDuration, 0.01) : undefined}
            onVideoClipTrimChange={recordedBlob ? handleVideoClipTrimChange : undefined}
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
            ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
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
            safeZoneType={safeZoneType}
            onSafeZoneTypeChange={setSafeZoneType}
            safeZoneVisible={safeZoneVisible}
            onSafeZoneVisibleChange={setSafeZoneVisible}
          />
        </div>
      </div>
    </div>
  )
}
