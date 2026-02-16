import { useState } from 'react'
import { IconX } from './Icons'
import { getStoredGoogleClientId } from './SettingsModal'
import {
  getYouTubeAccessToken,
  uploadVideoToYouTube,
  setYouTubeThumbnail,
} from '../services/youtubeUpload'
import type { ExportFormat } from '../utils/exportWithColorAdjustments'
import { exportVideoForDownload, getVideoDurationFromBlob } from '../utils/exportWithColorAdjustments'
import type { OverlayItem, OverlayTextAnimation, CaptionStyle } from '../types'
import type { CaptionSegment } from '../services/captions'
import styles from './ExportPanel.module.css'

interface ExportPanelProps {
  onClose: () => void
  videoBlob: Blob | null
  downloadUrl: string | null
  aspectRatio: string
  width: number
  height: number
  exportFormat: ExportFormat
  onExportFormatChange: (format: ExportFormat) => void
  youtubeTitle: string
  onYoutubeTitleChange: (v: string) => void
  youtubeCaption: string
  onYoutubeCaptionChange: (v: string) => void
  thumbnailBlob: Blob | null
  musicBlob?: Blob | null
  musicVolume?: number
  videoVolume?: number
  noiseRemovalEnabled?: boolean
  noiseRemovalAmount?: number
  overlays?: OverlayItem[]
  overlayTextAnimation?: OverlayTextAnimation
  defaultFontFamily?: string
  defaultSecondaryFont?: string
  defaultBold?: boolean
  trimStart?: number
  trimEnd?: number
  sourceDuration?: number
  colorAdjustmentsEnabled?: boolean
  colorBrightness?: number
  colorContrast?: number
  colorSaturation?: number
  captionSegments?: CaptionSegment[] | null
  captionStyle?: CaptionStyle
  captionFontSizePercent?: number
  captionY?: number
  onExportStart?: () => void
  onExportEnd?: () => void
}

export function ExportPanel({
  onClose,
  videoBlob,
  downloadUrl,
  aspectRatio,
  width,
  height,
  exportFormat,
  onExportFormatChange,
  youtubeTitle,
  onYoutubeTitleChange,
  youtubeCaption,
  onYoutubeCaptionChange,
  thumbnailBlob,
  musicBlob,
  musicVolume = 50,
  videoVolume = 100,
  noiseRemovalEnabled = false,
  noiseRemovalAmount = 50,
  overlays = [],
  overlayTextAnimation = 'none',
  defaultFontFamily = 'Oswald',
  defaultSecondaryFont = 'Playfair Display',
  defaultBold = false,
  trimStart: trimStartProp = 0,
  trimEnd: trimEndProp,
  sourceDuration,
  colorAdjustmentsEnabled = false,
  colorBrightness = 100,
  colorContrast = 100,
  colorSaturation = 100,
  captionSegments,
  captionStyle,
  captionFontSizePercent,
  captionY,
  onExportStart,
  onExportEnd,
}: ExportPanelProps) {
  const [uploading, setUploading] = useState(false)
  const [downloadPreparing, setDownloadPreparing] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null)

  const hasOverlaysToBurn = overlays.some((o) => o.burnIntoExport !== false)
  const hasTrim = trimEndProp != null || trimStartProp > 0
  const hasColor =
    colorAdjustmentsEnabled &&
    (colorBrightness !== 100 || colorContrast !== 100 || colorSaturation !== 100)
  const hasAudioAdjustments = musicBlob || videoVolume !== 100 || noiseRemovalEnabled

  const needsExport = hasOverlaysToBurn || hasTrim || hasColor || hasAudioAdjustments || captionSegments

  const getExportBlob = async (): Promise<{ blob: Blob; extension: ExportFormat }> => {
    if (!videoBlob) throw new Error('No video')
    if (!needsExport) return { blob: videoBlob, extension: 'webm' }

    if (onExportStart) onExportStart()

    let resolvedDuration = sourceDuration
    if (resolvedDuration == null || resolvedDuration <= 0 || !Number.isFinite(resolvedDuration)) {
      try {
        resolvedDuration = await getVideoDurationFromBlob(videoBlob)
      } catch (e) {
        console.warn('Could not detect duration from blob', e)
        // Fallback or let exportVideoForDownload handle it if possible
        resolvedDuration = 10
      }
    }

    try {
      const result = await exportVideoForDownload(videoBlob, {
        width,
        height,
        sourceDuration: resolvedDuration || 0,
        trimStart: trimStartProp,
        trimEnd: trimEndProp ?? resolvedDuration,
        exportFormat,
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
        videoVolume,
        // TODO: Pass noise removal params once supported in export utils
        captionSegments: captionSegments ?? undefined, // Ensure null becomes undefined
        captionStyle,
        captionFontSizePercent,
        captionY,
      }, (progress) => {
        // We could expose this progress up if needed
      })

      if (onExportEnd) onExportEnd()
      return { blob: result, extension: exportFormat }
    } catch (err) {
      if (onExportEnd) onExportEnd()
      throw err
    }
  }

  const handleDownload = async () => {
    if (!videoBlob) return
    if (needsExport) {
      setDownloadPreparing(true)
      try {
        const { blob, extension } = await getExportBlob()
        const filename = `recording_${aspectRatio.replace(':', '-')}_${width}x${height}.${extension}`
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        a.click()
        URL.revokeObjectURL(url)
      } catch (e) {
        console.error('Export failed', e)
      } finally {
        setDownloadPreparing(false)
      }
    } else {
      const filename = `recording_${aspectRatio.replace(':', '-')}_${width}x${height}.webm`
      if (downloadUrl) {
        const a = document.createElement('a')
        a.href = downloadUrl
        a.download = filename
        a.click()
      }
    }
  }

  const handleUploadToYouTube = async () => {
    const clientId = getStoredGoogleClientId()
    if (!clientId) {
      setUploadError('Add your Google Client ID in Settings to upload to YouTube.')
      return
    }
    if (!videoBlob) {
      setUploadError('No video to upload.')
      return
    }
    const title = youtubeTitle.trim() || 'My video'
    setUploadError(null)
    setUploadSuccess(null)
    setUploading(true)
    try {
      const { blob: blobToUpload } = await getExportBlob()
      const token = await getYouTubeAccessToken(clientId)
      const videoId = await uploadVideoToYouTube(token, blobToUpload, {
        title,
        description: youtubeCaption.trim(),
        privacyStatus: 'private',
      })
      if (thumbnailBlob) {
        await setYouTubeThumbnail(token, videoId, thumbnailBlob)
      }
      setUploadSuccess('Uploaded! Check your YouTube Studio.')
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Export">
      <div className={styles.panel}>
        <div className={styles.header}>
          <h2 className={styles.title}>Export</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <IconX />
          </button>
        </div>
        <div className={styles.body}>
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Export settings</h3>
            <p className={styles.settingsRow}>
              <span className={styles.label}>Format</span>
              <select
                className={styles.formatSelect}
                value={exportFormat}
                onChange={(e) => onExportFormatChange(e.target.value as ExportFormat)}
                aria-label="Export format"
              >
                <option value="webm">WebM</option>
                <option value="mp4">MP4</option>
              </select>
            </p>
            <p className={styles.settingsRow}>
              <span className={styles.label}>Resolution</span>
              <span>{aspectRatio} · {width}×{height}</span>
            </p>
            <p className={styles.hint}>Resolution and aspect ratio are set in Video settings. MP4 is used only if your browser supports it; otherwise WebM is used.</p>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Download</h3>
            {(hasOverlaysToBurn || hasColor) && (
              <p className={styles.hint}>
                {hasOverlaysToBurn && 'Text and image overlays are burnt into the download.'}
                {hasOverlaysToBurn && hasColor && ' '}
                {hasColor && 'Color adjustments are applied.'}
              </p>
            )}
            <button
              type="button"
              className={styles.downloadBtn}
              onClick={handleDownload}
              disabled={!videoBlob || downloadPreparing}
              aria-label="Download video"
            >
              {downloadPreparing ? 'Preparing download…' : 'Download video'}
            </button>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Upload to YouTube</h3>
            <p className={styles.hint}>Set title and description. For a custom thumbnail, use the Thumbnail tab first.</p>
            <label className={styles.label}>Video title</label>
            <input
              type="text"
              className={styles.input}
              value={youtubeTitle}
              onChange={(e) => onYoutubeTitleChange(e.target.value)}
              placeholder="Video title"
            />
            <label className={styles.label}>Description</label>
            <textarea
              className={styles.textarea}
              value={youtubeCaption}
              onChange={(e) => onYoutubeCaptionChange(e.target.value)}
              placeholder="Video description…"
              rows={4}
            />
            {thumbnailBlob && <p className={styles.thumbNote}>Custom thumbnail will be uploaded.</p>}
            {uploadError && <p className={styles.error}>{uploadError}</p>}
            {uploadSuccess && <p className={styles.success}>{uploadSuccess}</p>}
            <button
              type="button"
              className={styles.uploadBtn}
              onClick={handleUploadToYouTube}
              disabled={uploading || !videoBlob}
            >
              {uploading ? 'Uploading…' : 'Upload to YouTube'}
            </button>
          </section>
        </div>
      </div>
    </div>
  )
}
