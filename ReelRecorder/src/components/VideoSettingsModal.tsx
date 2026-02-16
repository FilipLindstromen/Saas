import type { AspectRatio, QualityPreset, VideoSourceKind } from '../types'
import type { ResolutionOption } from '../types'
import type { MediaDeviceInfo } from '../hooks/useMediaDevices'
import { SourceSelectors } from './SourceSelectors'
import { OptionsBar } from './OptionsBar'
import { IconX } from './Icons'
import styles from './VideoSettingsModal.module.css'

interface VideoSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  videoDevices: MediaDeviceInfo[]
  audioDevices: MediaDeviceInfo[]
  videoKind: VideoSourceKind
  onVideoKindChange: (k: VideoSourceKind) => void
  videoDeviceId: string
  onVideoDeviceIdChange: (id: string) => void
  audioDeviceId: string
  onAudioDeviceIdChange: (id: string) => void
  error: string | null
  aspectRatio: AspectRatio
  onAspectRatioChange: (a: AspectRatio) => void
  resolutions: ResolutionOption[]
  resolutionIndex: number
  onResolutionIndexChange: (i: number) => void
  quality: QualityPreset
  onQualityChange: (q: QualityPreset) => void
  studioQuality: boolean
  onStudioQualityChange: (v: boolean) => void
  portraitFillHeight: boolean
  onPortraitFillHeightChange: (v: boolean) => void
}

export function VideoSettingsModal({
  isOpen,
  onClose,
  videoDevices,
  audioDevices,
  videoKind,
  onVideoKindChange,
  videoDeviceId,
  onVideoDeviceIdChange,
  audioDeviceId,
  onAudioDeviceIdChange,
  error,
  aspectRatio,
  onAspectRatioChange,
  resolutions,
  resolutionIndex,
  onResolutionIndexChange,
  quality,
  onQualityChange,
  studioQuality,
  onStudioQualityChange,
  portraitFillHeight,
  onPortraitFillHeightChange,
}: VideoSettingsModalProps) {
  if (!isOpen) return null

  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true" aria-label="Video settings">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Video settings</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <IconX />
          </button>
        </div>
        <div className={styles.body}>
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Sources</h3>
            <SourceSelectors
              videoDevices={videoDevices}
              audioDevices={audioDevices}
              videoKind={videoKind}
              onVideoKindChange={onVideoKindChange}
              videoDeviceId={videoDeviceId}
              onVideoDeviceIdChange={onVideoDeviceIdChange}
              audioDeviceId={audioDeviceId}
              onAudioDeviceIdChange={onAudioDeviceIdChange}
              error={error}
            />
          </section>
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Format & quality</h3>
            <OptionsBar
              aspectRatio={aspectRatio}
              onAspectRatioChange={onAspectRatioChange}
              resolutions={resolutions}
              resolutionIndex={resolutionIndex}
              onResolutionIndexChange={onResolutionIndexChange}
              quality={quality}
              onQualityChange={onQualityChange}
              studioQuality={studioQuality}
              onStudioQualityChange={onStudioQualityChange}
            />
            {(aspectRatio === '9:16' || aspectRatio === '1:1') && (
              <label className={styles.portraitFillRow}>
                <input
                  type="checkbox"
                  checked={portraitFillHeight}
                  onChange={(e) => onPortraitFillHeightChange(e.target.checked)}
                />
                <span>Fill screen height (scale video to full height, crop sides)</span>
              </label>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
