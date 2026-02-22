import { useState } from 'react'
import type { OverlayItem } from '../types'
import { IconType, IconImage, IconSplit, IconVideo } from './Icons'
import { StickerPicker } from './StickerPicker'
import { AnimatedStickerPicker } from './AnimatedStickerPicker'
import { SubscribePicker } from './SubscribePicker'
import { InfographicPicker } from './InfographicPicker'
import { getStoredGiphyApiKey } from './SettingsModal'
import styles from './AddOverlayToolbar.module.css'

const MIN_CLIP_DURATION = 0.5

export interface AddOverlayToolbarProps {
  onAddOverlay: (type: 'text' | 'image' | 'video' | 'infographic', initialPatch?: Partial<OverlayItem>) => void
  onSplitClip?: () => void
  onVideoClipSplit?: () => void
  overlays: OverlayItem[]
  selectedId: string | null
  currentTime: number
  duration: number
  videoClipSegments?: Array<{ trimStart: number; trimEnd: number }> | null
  videoSourceDuration?: number
}

export function AddOverlayToolbar({
  onAddOverlay,
  onSplitClip,
  onVideoClipSplit,
  overlays,
  selectedId,
  currentTime,
  duration,
  videoClipSegments = null,
  videoSourceDuration = 0,
}: AddOverlayToolbarProps) {
  const safeDuration = Number.isFinite(duration) && duration >= 0 ? duration : 0
  const safeCurrentTime = Number.isFinite(currentTime) && currentTime >= 0 ? Math.min(currentTime, safeDuration) : 0

  const [stickerPickerOpen, setStickerPickerOpen] = useState(false)
  const [subscribePickerOpen, setSubscribePickerOpen] = useState(false)
  const [animatedStickerPickerOpen, setAnimatedStickerPickerOpen] = useState(false)
  const [infographicPickerOpen, setInfographicPickerOpen] = useState(false)
  const [animatedStickerInitialQuery, setAnimatedStickerInitialQuery] = useState<string | undefined>(undefined)

  const videoSegments = videoClipSegments ?? []
  const selectedOverlayForSplit = selectedId && selectedId !== 'background' ? overlays.find((x) => x.id === selectedId) : null
  const canSplitOverlay = !!(
    selectedOverlayForSplit &&
    onSplitClip &&
    safeCurrentTime > selectedOverlayForSplit.startTime + MIN_CLIP_DURATION &&
    safeCurrentTime < selectedOverlayForSplit.endTime - MIN_CLIP_DURATION
  )
  const canSplitVideoClip = !!(
    selectedId === 'background' &&
    onVideoClipSplit &&
    videoSegments.length > 0 &&
    videoSourceDuration > 0 &&
    safeCurrentTime > MIN_CLIP_DURATION &&
    safeCurrentTime < safeDuration - MIN_CLIP_DURATION
  )
  const canSplit = canSplitOverlay || canSplitVideoClip

  return (
    <div className={styles.toolbar}>
      {(onSplitClip || onVideoClipSplit) && (
        <button
          type="button"
          className={styles.toolbarBtn}
          onClick={canSplitVideoClip ? onVideoClipSplit : onSplitClip}
          disabled={!canSplit}
          title={
            canSplit
              ? 'Split selected clip at playhead'
              : canSplitVideoClip
                ? 'Position playhead inside video clip to split'
                : 'Select a clip and position playhead inside it to split'
          }
          aria-label="Split clip at playhead"
        >
          <IconSplit />
          <span>Split</span>
        </button>
      )}
      <button type="button" className={styles.toolbarBtn} onClick={() => onAddOverlay('text')} title="Add text overlay" aria-label="Add text overlay">
        <IconType />
        <span>Text</span>
      </button>
      <button type="button" className={styles.toolbarBtn} onClick={() => onAddOverlay('image')} title="Add image overlay" aria-label="Add image overlay">
        <IconImage />
        <span>Image</span>
      </button>
      <button type="button" className={styles.toolbarBtn} onClick={() => setStickerPickerOpen(true)} title="Add sticker" aria-label="Add sticker">
        <span className={styles.stickerIcon}>✱</span>
        <span>Sticker</span>
      </button>
      <StickerPicker
        isOpen={stickerPickerOpen}
        onClose={() => setStickerPickerOpen(false)}
        onSelect={(imageDataUrl, naturalWidth, naturalHeight) => {
          onAddOverlay('image', {
            imageDataUrl,
            naturalWidth,
            naturalHeight,
            imageScale: 1,
            x: 0.5,
            y: 0.5,
            burnIntoExport: true,
          })
          setStickerPickerOpen(false)
        }}
      />
      <button type="button" className={styles.toolbarBtn} onClick={() => setSubscribePickerOpen(true)} title="Add YouTube subscribe button" aria-label="Add YouTube subscribe button">
        <span className={styles.stickerIcon}>▶</span>
        <span>Subscribe</span>
      </button>
      <SubscribePicker
        isOpen={subscribePickerOpen}
        onClose={() => setSubscribePickerOpen(false)}
        onAddStatic={(imageDataUrl, naturalWidth, naturalHeight) => {
          onAddOverlay('image', {
            imageDataUrl,
            naturalWidth,
            naturalHeight,
            imageScale: 1,
            x: 0.5,
            y: 0.5,
            burnIntoExport: true,
          })
          setSubscribePickerOpen(false)
        }}
        onOpenAnimated={() => {
          setSubscribePickerOpen(false)
          setAnimatedStickerInitialQuery('youtube subscribe')
          setAnimatedStickerPickerOpen(true)
        }}
      />
      <button type="button" className={styles.toolbarBtn} onClick={() => { setAnimatedStickerInitialQuery(undefined); setAnimatedStickerPickerOpen(true) }} title="Add animated sticker (GIPHY)" aria-label="Add animated sticker">
        <span className={styles.stickerIcon}>G</span>
        <span>Animated</span>
      </button>
      <AnimatedStickerPicker
        isOpen={animatedStickerPickerOpen}
        onClose={() => { setAnimatedStickerPickerOpen(false); setAnimatedStickerInitialQuery(undefined) }}
        apiKey={getStoredGiphyApiKey()}
        initialQuery={animatedStickerInitialQuery}
        onSelect={(imageUrl, naturalWidth, naturalHeight) => {
          onAddOverlay('image', {
            imageUrl,
            naturalWidth,
            naturalHeight,
            imageScale: 1,
            x: 0.5,
            y: 0.5,
            burnIntoExport: true,
          })
          setAnimatedStickerPickerOpen(false)
          setAnimatedStickerInitialQuery(undefined)
        }}
      />
      <button type="button" className={styles.toolbarBtn} onClick={() => onAddOverlay('video', { imageScale: 1, x: 0.5, y: 0.5, burnIntoExport: true })} title="Add video overlay (set source in Inspector: Pexels or Pixabay)" aria-label="Add video overlay">
        <IconVideo />
        <span>Video</span>
      </button>
      <button type="button" className={styles.toolbarBtn} onClick={() => setInfographicPickerOpen(true)} title="Import infographic from InfoGraphics generator" aria-label="Import infographic">
        <span className={styles.stickerIcon}>📊</span>
        <span>Infographic</span>
      </button>
      <InfographicPicker
        isOpen={infographicPickerOpen}
        onClose={() => setInfographicPickerOpen(false)}
        onSelect={(projectId, tabId, projectName, tabName) => {
          const displayName = tabName !== projectName ? `${projectName} / ${tabName}` : projectName
          onAddOverlay('infographic', {
            infographicProjectId: projectId,
            infographicTabId: tabId,
            infographicProjectName: displayName,
            imageScale: 1,
            x: 0.5,
            y: 0.5,
            burnIntoExport: true,
          })
          setInfographicPickerOpen(false)
        }}
      />
    </div>
  )
}
