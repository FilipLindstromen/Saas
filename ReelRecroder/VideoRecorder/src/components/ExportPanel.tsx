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
  overlays = [],
  overlayTextAnimation = 'none',
  defaultFontFamily = 'Oswald',
  defaultSecondaryFont = 'Playfair Display',
  defaultBold = false,
  trimStart: trimStartProp,
  trimEnd: trimEndProp,
  sourceDuration,
  colorAdjustmentsEnabled = false,
  colorBrightness = 100,
  colorContrast = 100,
  colorSaturation = 100,
}: ExportPanelProps) {
  const [uploading, setUploading] = useState(false)
  const [downloadPreparing, setDownloadPreparing] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null)

  const hasOverlaysToBurn = overlays.some((o) => o.burnIntoExport !== false)
  const hasTrim = trimEndProp != null
  const hasColor =
    colorAdjustmentsEnabled &&
    (colorBrightness !== 100 || colorContrast !== 100 || colorSaturation !== 100)
  const needsExport = hasOverlaysToBurn || hasTrim || hasColor

  const getExportBlob = async (): Promise<{ blob: Blob; extension: ExportFormat }> => {
    if (!videoBlob) throw new Error('No video')
    if (!needsExport) return { blob: videoBlob, extension: 'webm' }
    let resolvedDuration = sourceDuration
    if (resolvedDuration == null || resolvedDuration <= 0 || !Number.isFinite(resolvedDuration)) {
      try {
        resolvedDuration = await getVideoDurationFromBlob(videoBlob)
      } catch (e) {
        throw new Error('Could not read video duration. Try playing the video in Edit mode first, then export again.')
      }
    }
    const result = await exportVideoForDownload(videoBlob, {
      width,
      height,
      sourceDuration: resolvedDuration,
      trimStart: trimEndProp != null ? trimStartProp : undefined,
      trimEnd: trimEndProp ?? resolvedDuration ?? undefined,
      exportFormat,
      overlays,
      overlayTextAnimation,
      defaultFontFamily,
      defaultSecondaryFont,
      defaultBold,
      colorBrightness: colorAdjustmentsEnabled ? colorBrightness : 100,
      colorContrast: colorAdjustmentsEnabled ? colorContrast : 100,
      colorSaturation: colorAdjustmentsEnabled ? colorSaturation : 100,
    })
    return result
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
      const blobToUpload = await getExportBlob()
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
