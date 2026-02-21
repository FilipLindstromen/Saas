import { useState } from 'react'
import type { AspectRatio, CaptionStyle, OverlayItem, OverlayTextAnimation, QualityPreset, ResolutionOption, SafeZoneType, VideoSourceKind } from '../types'
import type { MediaDeviceInfo } from '../hooks/useMediaDevices'
import { FONT_OPTIONS } from '../constants/fonts'
import { OverlayEditor } from './OverlayEditor'
import { SourceSelectors } from './SourceSelectors'
import { OptionsBar } from './OptionsBar'
import type { CaptionSegment } from '../services/captions'
import { IconTrash, IconVideo, IconAudio, IconLayers, IconCursor, IconType, IconColor, IconSafeZone } from './Icons'
import { CaptionBurnIn } from './CaptionBurnIn'
import styles from './InspectorPanel.module.css'

const TEXT_ANIMATION_OPTIONS: { value: OverlayTextAnimation; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'fade', label: 'Fade' },
  { value: 'fade-slide-left', label: 'Fade + slide left' },
  { value: 'fade-slide-right', label: 'Fade + slide right' },
  { value: 'fade-slide-up', label: 'Fade + slide up' },
  { value: 'fade-slide-down', label: 'Fade + slide down' },
]

export type InspectorTabId = 'video' | 'audio' | 'color' | 'overlays' | 'current' | 'captions' | 'safezones'

interface InspectorPanelProps {
  /** Controlled active tab; when set, parent can open e.g. Video tab from header button */
  activeTab?: InspectorTabId
  onTabChange?: (tab: InspectorTabId) => void
  overlayTextAnimation: OverlayTextAnimation
  onOverlayTextAnimationChange: (anim: OverlayTextAnimation) => void
  defaultFontFamily?: string
  onDefaultFontFamilyChange?: (font: string) => void
  defaultSecondaryFont?: string
  onDefaultSecondaryFontChange?: (font: string) => void
  defaultBold?: boolean
  onDefaultBoldChange?: (bold: boolean) => void
  burnOverlaysIntoExport: boolean
  onBurnOverlaysIntoExportChange: (value: boolean) => void
  flipVideo: boolean
  onFlipVideoChange: (value: boolean) => void
  selectedOverlay: OverlayItem | null
  onOverlayUpdate: (patch: Partial<OverlayItem>) => void
  onOverlayRemove: (id: string) => void
  onDeselectOverlay: () => void
  selectedId: string | null
  onRemoveBackgroundClip?: () => void
  mode?: 'record' | 'edit'
  /** When set, show "Save to library" in overlay editor */
  onSaveOverlayToLibrary?: (overlay: OverlayItem) => void
  /* Video tab (sources, format & quality) */
  videoDevices?: MediaDeviceInfo[]
  audioDevices?: MediaDeviceInfo[]
  videoKind?: VideoSourceKind
  onVideoKindChange?: (k: VideoSourceKind) => void
  videoDeviceId?: string
  onVideoDeviceIdChange?: (id: string) => void
  audioDeviceId?: string
  onAudioDeviceIdChange?: (id: string) => void
  videoError?: string | null
  onConnectMedia?: () => void | Promise<void>
  hasVideoStream?: boolean
  aspectRatio?: AspectRatio
  onAspectRatioChange?: (a: AspectRatio) => void
  videoWidth?: number
  videoHeight?: number
  resolutions?: ResolutionOption[]
  resolutionIndex?: number
  onResolutionIndexChange?: (i: number) => void
  quality?: QualityPreset
  onQualityChange?: (q: QualityPreset) => void
  studioQuality?: boolean
  onStudioQualityChange?: (v: boolean) => void
  portraitFillHeight?: boolean
  onPortraitFillHeightChange?: (v: boolean) => void
  colorAdjustmentsEnabled?: boolean
  onColorAdjustmentsEnabledChange?: (v: boolean) => void
  colorBrightness?: number
  onColorBrightnessChange?: (v: number) => void
  colorContrast?: number
  onColorContrastChange?: (v: number) => void
  colorSaturation?: number
  onColorSaturationChange?: (v: number) => void
  /* Captions tab (burn-in styling + transcribe/burn) */
  videoBlob?: Blob | null
  onBurnedBlob?: (blob: Blob) => void
  captionStyle?: CaptionStyle
  onCaptionStyleChange?: (style: CaptionStyle) => void
  captionFontSizePercent?: number
  onCaptionFontSizePercentChange?: (percent: number) => void
  captionY?: number
  onCaptionYChange?: (y: number) => void
  captionSegments?: CaptionSegment[] | null
  onTranscriptionDone?: (segments: CaptionSegment[]) => void
  openaiApiKey?: string
  /* Safe-zones tab (preview overlay only, not exported) */
  safeZoneType?: SafeZoneType
  onSafeZoneTypeChange?: (t: SafeZoneType) => void
  safeZoneVisible?: boolean
  onSafeZoneVisibleChange?: (v: boolean) => void
  /* Audio tab (video volume, background music, noise removal) */
  videoVolume?: number
  onVideoVolumeChange?: (v: number) => void
  musicBlob?: Blob | null
  onMusicBlobChange?: (blob: Blob | null) => void
  musicVolume?: number
  onMusicVolumeChange?: (v: number) => void
  noiseRemovalEnabled?: boolean
  onNoiseRemovalEnabledChange?: (v: boolean) => void
  noiseRemovalAmount?: number
  onNoiseRemovalAmountChange?: (v: number) => void
}

export function InspectorPanel({
  activeTab: controlledTab,
  onTabChange,
  overlayTextAnimation,
  onOverlayTextAnimationChange,
  defaultFontFamily = 'Oswald',
  onDefaultFontFamilyChange = () => { },
  defaultSecondaryFont = 'Playfair Display',
  onDefaultSecondaryFontChange = () => { },
  defaultBold = false,
  onDefaultBoldChange = () => { },
  burnOverlaysIntoExport,
  onBurnOverlaysIntoExportChange,
  flipVideo = false,
  onFlipVideoChange = () => { },
  selectedOverlay,
  onOverlayUpdate,
  onOverlayRemove,
  onDeselectOverlay,
  onSaveOverlayToLibrary,
  videoDevices = [],
  audioDevices = [],
  videoKind = 'camera',
  onVideoKindChange,
  videoDeviceId = '',
  onVideoDeviceIdChange,
  audioDeviceId = '',
  onAudioDeviceIdChange,
  videoError = null,
  onConnectMedia,
  hasVideoStream = false,
  aspectRatio = '16:9',
  onAspectRatioChange,
  resolutions = [],
  resolutionIndex = 0,
  onResolutionIndexChange,
  quality = 'high',
  onQualityChange,
  studioQuality = false,
  onStudioQualityChange,
  portraitFillHeight = false,
  onPortraitFillHeightChange,
  colorAdjustmentsEnabled = false,
  onColorAdjustmentsEnabledChange = () => { },
  colorBrightness = 100,
  onColorBrightnessChange = () => { },
  colorContrast = 100,
  onColorContrastChange = () => { },
  colorSaturation = 100,
  onColorSaturationChange = () => { },
  videoBlob = null,
  onBurnedBlob = () => { },
  captionStyle,
  onCaptionStyleChange = () => { },
  captionFontSizePercent,
  onCaptionFontSizePercentChange = () => { },
  captionY,
  onCaptionYChange = () => { },
  captionSegments = null,
  onTranscriptionDone = () => { },
  openaiApiKey,
  videoWidth = 1280,
  videoHeight = 720,
  safeZoneType = 'youtube-9:16',
  onSafeZoneTypeChange = () => { },
  safeZoneVisible = false,
  onSafeZoneVisibleChange = () => { },
  musicBlob = null,
  onMusicBlobChange,
  musicVolume = 50,
  onMusicVolumeChange = () => { },
  videoVolume = 100,
  onVideoVolumeChange = () => { },
  noiseRemovalEnabled = false,
  onNoiseRemovalEnabledChange = () => { },
  noiseRemovalAmount = 50,
  onNoiseRemovalAmountChange = () => { },
  mode,
  selectedId,
  onRemoveBackgroundClip,
}: InspectorPanelProps) {
  const [internalTab, setInternalTab] = useState<InspectorTabId>('current')
  const activeTab = controlledTab ?? internalTab
  const setActiveTab = (tab: InspectorTabId) => {
    if (onTabChange) onTabChange(tab)
    else setInternalTab(tab)
  }
  const tabTitle =
    activeTab === 'video'
      ? 'Video settings'
      : activeTab === 'audio'
        ? 'Audio settings'
        : activeTab === 'color'
          ? 'Camera color'
          : activeTab === 'current'
            ? (selectedOverlay ? 'Current object' : 'Select an overlay on the timeline')
            : activeTab === 'captions'
              ? 'Caption style'
              : activeTab === 'safezones'
                ? 'Safe zones'
                : 'Global overlay settings'

  const hasVideoSettings =
    onVideoKindChange &&
    onVideoDeviceIdChange &&
    onAudioDeviceIdChange &&
    onAspectRatioChange &&
    onResolutionIndexChange &&
    onQualityChange &&
    onStudioQualityChange &&
    onPortraitFillHeightChange

  return (
    <aside className={styles.panel} aria-label="Inspector">
      <h2 className={styles.title}>Inspector</h2>
      <p className={styles.subtitle}>{tabTitle}</p>

      <div className={styles.tabList} role="tablist" aria-label="Setting categories">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'current'}
          aria-label="Current object"
          id="inspector-tab-current"
          className={styles.tab}
          onClick={() => setActiveTab('current')}
        >
          <IconCursor />
        </button>
        {hasVideoSettings && (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'video'}
            aria-label="Video settings"
            id="inspector-tab-video"
            className={styles.tab}
            onClick={() => setActiveTab('video')}
          >
            <IconVideo />
          </button>
        )}
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'audio'}
          aria-label="Audio settings"
          id="inspector-tab-audio"
          className={styles.tab}
          onClick={() => setActiveTab('audio')}
        >
          <IconAudio />
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'color'}
          aria-label="Camera color"
          id="inspector-tab-color"
          className={styles.tab}
          onClick={() => setActiveTab('color')}
        >
          <IconColor />
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'overlays'}
          aria-label="Overlays"
          id="inspector-tab-overlays"
          className={styles.tab}
          onClick={() => setActiveTab('overlays')}
        >
          <IconLayers />
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'captions'}
          aria-label="Caption style"
          id="inspector-tab-captions"
          className={styles.tab}
          onClick={() => setActiveTab('captions')}
        >
          <IconType />
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'safezones'}
          aria-label="Safe zones"
          id="inspector-tab-safezones"
          className={styles.tab}
          onClick={() => setActiveTab('safezones')}
        >
          <IconSafeZone />
        </button>
      </div>

      {activeTab === 'video' && hasVideoSettings && (
        <div className={styles.tabPanel} role="tabpanel" aria-labelledby="inspector-tab-video">
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
              error={videoError}
              onConnect={onConnectMedia}
              hasStream={hasVideoStream}
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
            />
            {(aspectRatio === '9:16' || aspectRatio === '1:1') && (
              <label className={styles.checkRow}>
                <input
                  type="checkbox"
                  checked={portraitFillHeight}
                  onChange={(e) => onPortraitFillHeightChange(e.target.checked)}
                  aria-label="Fill screen height"
                />
                <span>Fill screen height (scale video to full height, crop sides)</span>
              </label>
            )}
            <label className={styles.checkRow}>
              <input
                type="checkbox"
                checked={flipVideo}
                onChange={(e) => onFlipVideoChange(e.target.checked)}
                aria-label="Flip video horizontally"
              />
              <span>Flip video</span>
            </label>
            <p className={styles.hint}>Mirror the video horizontally in preview and recording.</p>
          </section>
        </div>
      )}

      {activeTab === 'audio' && (
        <div className={styles.tabPanel} role="tabpanel" aria-labelledby="inspector-tab-audio">
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Video volume</h3>
            <p className={styles.hint}>Adjust the volume of the recorded video audio.</p>
            <label className={styles.label}>Volume: {videoVolume}%</label>
            <input
              type="range"
              min={0}
              max={100}
              value={videoVolume}
              onChange={(e) => onVideoVolumeChange(Number(e.target.value))}
              className={styles.slider}
              aria-label="Video volume"
            />
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Studio quality</h3>
            <p className={styles.hint}>Enhance speech with EQ, compression, and noise gating.</p>
            <label className={styles.checkRow}>
              <input
                type="checkbox"
                checked={studioQuality}
                onChange={(e) => onStudioQualityChange(e.target.checked)}
              />
              <span>Enable Studio Quality</span>
            </label>
          </section>

          {onMusicBlobChange && (
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Background music</h3>
              <p className={styles.hint}>Add a music track to mix with the video audio when exporting. Optional.</p>

              {!musicBlob ? (
                <div className={styles.fileUploadRow}>
                  <label className={styles.fileBtn}>
                    <IconAudio />
                    <span>Add background music</span>
                    <input
                      type="file"
                      accept="audio/*"
                      className={styles.hiddenInput}
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        onMusicBlobChange(f ? f : null)
                        e.target.value = ''
                      }}
                      aria-label="Choose music file"
                    />
                  </label>
                </div>
              ) : (
                <div className={styles.musicControl}>
                  <div className={styles.musicTrackInfo}>
                    <IconAudio />
                    <span>Music added</span>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      onClick={() => onMusicBlobChange(null)}
                      title="Remove music"
                    >
                      <IconTrash />
                    </button>
                  </div>
                  <label className={styles.label}>Music volume: {musicVolume}%</label>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={musicVolume}
                    onChange={(e) => onMusicVolumeChange(Number(e.target.value))}
                    className={styles.slider}
                    aria-label="Music volume"
                  />
                  <button
                    type="button"
                    className={styles.textBtn}
                    onClick={() => onMusicBlobChange(null)}
                  >
                    Remove music
                  </button>
                </div>
              )}
            </section>
          )}

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Noise removal</h3>
            <p className={styles.hint}>Remove background noise from the recorded audio. Applied during export.</p>
            <label className={styles.checkRow}>
              <input
                type="checkbox"
                checked={noiseRemovalEnabled}
                onChange={(e) => onNoiseRemovalEnabledChange(e.target.checked)}
                aria-label="Enable noise removal"
              />
              <span>Enable noise removal</span>
            </label>
            {noiseRemovalEnabled && (
              <>
                <label className={styles.label}>Noise reduction amount: {noiseRemovalAmount}%</label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={noiseRemovalAmount}
                  onChange={(e) => onNoiseRemovalAmountChange(Number(e.target.value))}
                  className={styles.slider}
                  aria-label="Noise reduction amount"
                />
              </>
            )}
          </section>
        </div>
      )}

      {activeTab === 'captions' && (
        <div className={styles.tabPanel} role="tabpanel" aria-labelledby="inspector-tab-captions">
          {videoBlob ? (
            <CaptionBurnIn
              videoBlob={videoBlob}
              onBurnedBlob={onBurnedBlob}
              width={videoWidth}
              height={videoHeight}
              openaiApiKey={openaiApiKey}
              captionStyle={captionStyle}
              captionFontSizePercent={captionFontSizePercent}
              captionY={captionY}
              onCaptionStyleChange={onCaptionStyleChange}
              onCaptionFontSizePercentChange={onCaptionFontSizePercentChange}
              onCaptionYChange={onCaptionYChange}
              captionSegments={captionSegments ?? null}
              onTranscriptionDone={onTranscriptionDone}
            />
          ) : (
            <p className={styles.hint}>Record a video and switch to Edit to use burn-in captions (transcribe and style).</p>
          )}
        </div>
      )}

      {activeTab === 'current' && (
        <div className={styles.tabPanel} role="tabpanel" aria-labelledby="inspector-tab-current">
          {selectedId === 'background' ? (
            <section className={styles.section}>
              <div className={styles.selectedOverlayBar}>
                <span className={styles.sectionTitle}>Current object: Recording</span>
                <div className={styles.selectedOverlayActions}>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    onClick={() => {
                      if (window.confirm('Delete this recording?')) {
                        onRemoveBackgroundClip?.()
                      }
                    }}
                    title="Delete recording"
                    aria-label="Delete recording"
                  >
                    <IconTrash />
                  </button>
                  <button
                    type="button"
                    className={styles.textBtn}
                    onClick={onDeselectOverlay}
                  >
                    Deselect
                  </button>
                </div>
              </div>
              <p className={styles.hint}>The main video recording from your webcam or screen.</p>
            </section>
          ) : selectedOverlay ? (
            <section className={styles.section}>
              <div className={styles.selectedOverlayBar}>
                <span className={styles.sectionTitle}>Current object</span>
                <div className={styles.selectedOverlayActions}>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    onClick={() => {
                      onOverlayRemove(selectedOverlay.id)
                      onDeselectOverlay()
                    }}
                    title="Remove from timeline"
                    aria-label="Remove from timeline"
                  >
                    <IconTrash />
                  </button>
                  <button
                    type="button"
                    className={styles.textBtn}
                    onClick={onDeselectOverlay}
                  >
                    Deselect
                  </button>
                </div>
              </div>
              <OverlayEditor
                overlay={selectedOverlay}
                onUpdate={(patch) => onOverlayUpdate(patch)}
                onClose={onDeselectOverlay}
                onRemove={() => {
                  onOverlayRemove(selectedOverlay.id)
                  onDeselectOverlay()
                }}
                onSaveToLibrary={onSaveOverlayToLibrary ? () => onSaveOverlayToLibrary(selectedOverlay) : undefined}
                embedded
              />
            </section>
          ) : (
            <p className={styles.hint}>Select a text or image overlay on the timeline to edit it here.</p>
          )}
        </div>
      )}

      {activeTab === 'color' && (
        <div className={styles.tabPanel} role="tabpanel" aria-labelledby="inspector-tab-color">
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Camera color</h3>
            <p className={styles.hint}>Preview and export only. Never recorded in the raw file. Turn off when recording, then on again for export if desired.</p>
            <label className={styles.checkRow}>
              <input
                type="checkbox"
                checked={colorAdjustmentsEnabled ?? false}
                onChange={(e) => onColorAdjustmentsEnabledChange(e.target.checked)}
                aria-label="Use color adjustments in preview and export"
              />
              <span>Use color adjustments</span>
            </label>
            {(colorAdjustmentsEnabled ?? false) && (
              <>
                <label className={styles.label}>Brightness {colorBrightness ?? 100}%</label>
                <input
                  type="range"
                  className={styles.slider}
                  min={0}
                  max={200}
                  value={colorBrightness ?? 100}
                  onChange={(e) => onColorBrightnessChange(Number(e.target.value))}
                  aria-label="Brightness"
                />
                <label className={styles.label}>Contrast {colorContrast ?? 100}%</label>
                <input
                  type="range"
                  className={styles.slider}
                  min={0}
                  max={200}
                  value={colorContrast ?? 100}
                  onChange={(e) => onColorContrastChange(Number(e.target.value))}
                  aria-label="Contrast"
                />
                <label className={styles.label}>Saturation {colorSaturation ?? 100}%</label>
                <input
                  type="range"
                  className={styles.slider}
                  min={0}
                  max={200}
                  value={colorSaturation ?? 100}
                  onChange={(e) => onColorSaturationChange(Number(e.target.value))}
                  aria-label="Saturation"
                />
              </>
            )}
          </section>
        </div>
      )}

      {activeTab === 'safezones' && (
        <div className={styles.tabPanel} role="tabpanel" aria-labelledby="inspector-tab-safezones">
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Safe zones</h3>
            <p className={styles.hint}>Overlay guide on the preview only. Not included in recording or export.</p>
            <label className={styles.label}>Preset</label>
            <select
              className={styles.select}
              value={safeZoneType ?? 'youtube-9:16'}
              onChange={(e) => onSafeZoneTypeChange?.(e.target.value as SafeZoneType)}
              aria-label="Safe zone preset"
            >
              <option value="youtube-9:16">YouTube (9:16 portrait)</option>
              <option value="youtube-16:9">YouTube (16:9 landscape)</option>
              <option value="youtube-1:1">YouTube (1:1 square)</option>
              <option value="tiktok">TikTok</option>
              <option value="instagram">Instagram</option>
            </select>
            <label className={styles.checkRow} style={{ marginTop: 12 }}>
              <input
                type="checkbox"
                checked={safeZoneVisible ?? false}
                onChange={(e) => onSafeZoneVisibleChange?.(e.target.checked)}
                aria-label="Show safe zone overlay"
              />
              <span>Show safe zone</span>
            </label>
          </section>
        </div>
      )}

      {activeTab === 'overlays' && (
        <div className={styles.tabPanel} role="tabpanel" aria-labelledby="inspector-tab-overlays">
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Recording & export</h3>
            <label className={styles.checkRow}>
              <input
                type="checkbox"
                checked={burnOverlaysIntoExport}
                onChange={(e) => onBurnOverlaysIntoExportChange(e.target.checked)}
                aria-label="Burn overlays into recording and export"
              />
              <span>Burn into recording / export</span>
            </label>
            <p className={styles.hint}>When unchecked, overlays are preview-only and will not appear in the recorded or exported video.</p>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Text animation</h3>
            <p className={styles.hint}>In/out animation applied to all text overlays</p>
            <select
              className={styles.select}
              value={overlayTextAnimation}
              onChange={(e) => onOverlayTextAnimationChange(e.target.value as OverlayTextAnimation)}
              aria-label="Text animation style"
            >
              {TEXT_ANIMATION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Global fonts</h3>
            <p className={styles.hint}>Default fonts and style for text overlays</p>
            <label className={styles.checkRow}>
              <input
                type="checkbox"
                checked={defaultBold ?? false}
                onChange={(e) => onDefaultBoldChange(e.target.checked)}
                aria-label="Bold by default"
              />
              <span>Bold by default</span>
            </label>
            <label className={styles.label}>Main font</label>
            <select
              className={styles.select}
              value={defaultFontFamily}
              onChange={(e) => onDefaultFontFamilyChange(e.target.value)}
              aria-label="Default main font"
            >
              {FONT_OPTIONS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
            <label className={styles.label}>Secondary font</label>
            <select
              className={styles.select}
              value={defaultSecondaryFont ?? 'Playfair Display'}
              onChange={(e) => onDefaultSecondaryFontChange(e.target.value)}
              aria-label="Default secondary font"
            >
              {FONT_OPTIONS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </section>
        </div>
      )}
    </aside>
  )
}
