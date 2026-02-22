import { useRef, useState, useCallback, useEffect } from 'react'
import type { OverlayItem } from '../types'
import { IconX, IconType, IconTrash } from './Icons'
import { UnsplashPicker } from './UnsplashPicker'
import { StockVideoPicker } from './StockVideoPicker'
import { AnimatedStickerPicker } from './AnimatedStickerPicker'
import { getStoredUnsplashAccessKey, getStoredPexelsApiKey, getStoredPixabayApiKey, getStoredGiphyApiKey } from './SettingsModal'
import styles from './OverlayEditor.module.css'

interface OverlayEditorProps {
  overlay: OverlayItem | null
  onUpdate: (patch: Partial<OverlayItem>) => void
  onClose: () => void
  /** When set, show a button to remove this overlay from the timeline */
  onRemove?: () => void
  /** When set, show "Save to library" to save this overlay to the clip library */
  onSaveToLibrary?: () => void
  /** When true, render only the form content (no wrap/header); for use inside Inspector */
  embedded?: boolean
}

function mergeRanges(ranges: { start: number; end: number }[]): { start: number; end: number }[] {
  if (ranges.length === 0) return []
  const sorted = [...ranges].sort((a, b) => a.start - b.start)
  const out: { start: number; end: number }[] = [sorted[0]]
  for (let i = 1; i < sorted.length; i++) {
    const last = out[out.length - 1]
    if (sorted[i].start <= last.end) {
      last.end = Math.max(last.end, sorted[i].end)
    } else {
      out.push(sorted[i])
    }
  }
  return out
}

const FONT_SIZE_PCT_MIN = 0.5
const FONT_SIZE_PCT_MAX = 15

export function OverlayEditor({ overlay, onUpdate, onClose, onRemove, onSaveToLibrary, embedded = false }: OverlayEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [fontSizeInput, setFontSizeInput] = useState<string>('')
  const [fontSizeInputFocused, setFontSizeInputFocused] = useState(false)
  const [unsplashPickerOpen, setUnsplashPickerOpen] = useState(false)
  const [giphyPickerOpen, setGiphyPickerOpen] = useState(false) // GIPHY picker visibility
  const [stockVideoSource, setStockVideoSource] = useState<'pexels' | 'pixabay' | null>(null)

  const fontSizePct = overlay?.fontSizePercent ?? (overlay ? (overlay.fontSize ?? 24) / 1280 * 100 : 10)
  useEffect(() => {
    if (!fontSizeInputFocused) setFontSizeInput('')
  }, [fontSizeInputFocused, fontSizePct])
  useEffect(() => {
    setFontSizeInputFocused(false)
    setFontSizeInput('')
  }, [overlay?.id])

  const applySecondaryToSelection = useCallback(() => {
    if (!overlay || overlay.type !== 'text') return
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    if (start >= end) return
    const ranges = [...(overlay.secondaryRanges ?? []), { start, end }]
    const merged = mergeRanges(ranges)
    onUpdate({ secondaryRanges: merged })
  }, [overlay, onUpdate])

  const removeSecondaryRange = useCallback(
    (index: number) => {
      if (!overlay?.secondaryRanges) return
      const next = overlay.secondaryRanges.filter((_, i) => i !== index)
      onUpdate({ secondaryRanges: next.length ? next : undefined })
    },
    [overlay, onUpdate]
  )

  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newText = e.target.value
      const ranges = overlay?.secondaryRanges ?? []
      const len = newText.length
      const valid = ranges
        .filter((r) => r.start < r.end && r.end <= len)
        .map((r) => ({ start: r.start, end: Math.min(r.end, len) }))
      onUpdate({
        text: newText,
        ...(valid.length !== ranges.length ? { secondaryRanges: valid } : {}),
      })
    },
    [overlay?.secondaryRanges, onUpdate]
  )

  if (!overlay) return null

  const text = overlay.text ?? ''
  const secondaryRanges = overlay.secondaryRanges ?? []

  const formContent = (
    <>
      {overlay.type === 'text' && (
        <>
          <label className={styles.label}>Text</label>
          <textarea
            ref={textareaRef}
            className={styles.textarea}
            value={text}
            onChange={handleTextChange}
            onSelect={() => {}}
            rows={3}
            placeholder="Overlay text"
          />
          <div className={styles.selectionRow}>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={applySecondaryToSelection}
              title="Select some text above, then click to use the secondary font on it"
              aria-label="Apply secondary font to selection"
            >
              <IconType />
            </button>
          </div>
          {secondaryRanges.length > 0 && (
            <div className={styles.rangesList}>
              <label className={styles.label}>Secondary font on:</label>
              {secondaryRanges.map((r, i) => {
                const snippet = text.slice(r.start, r.end).replace(/\n/g, ' ')
                return (
                  <div key={`${r.start}-${r.end}-${i}`} className={styles.rangeChip}>
                    <span className={styles.rangeText} title={`Chars ${r.start}–${r.end}`}>
                      "{snippet.length > 20 ? snippet.slice(0, 20) + '…' : snippet}"
                    </span>
                    <button type="button" className={styles.rangeRemove} onClick={() => removeSecondaryRange(i)} title="Remove" aria-label="Remove">
                      <IconX />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
          <label className={styles.label}>Font size (% of width)</label>
          <div className={styles.sliderRow}>
            <input
              type="range"
              className={styles.slider}
              min={5}
              max={500}
              step={1}
              value={Math.round((overlay.fontSizePercent ?? (overlay.fontSize ?? 24) / 1280 * 100) * 10)}
              onChange={(e) => onUpdate({ fontSizePercent: Number(e.target.value) / 10 })}
              aria-label="Font size"
            />
            <div className={styles.sliderValueWrap}>
              <input
                type="number"
                className={styles.sliderValueInput}
                min={FONT_SIZE_PCT_MIN}
                max={FONT_SIZE_PCT_MAX}
                step={0.1}
                value={fontSizeInputFocused ? fontSizeInput : fontSizePct.toFixed(1)}
                onFocus={() => {
                  setFontSizeInputFocused(true)
                  setFontSizeInput(fontSizePct.toFixed(1))
                }}
                onChange={(e) => setFontSizeInput(e.target.value)}
                onBlur={() => {
                  const n = parseFloat(fontSizeInput)
                  if (!Number.isNaN(n)) {
                    onUpdate({ fontSizePercent: Math.max(FONT_SIZE_PCT_MIN, Math.min(FONT_SIZE_PCT_MAX, n)) })
                  }
                  setFontSizeInputFocused(false)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const n = parseFloat(fontSizeInput)
                    if (!Number.isNaN(n)) {
                      onUpdate({ fontSizePercent: Math.max(FONT_SIZE_PCT_MIN, Math.min(FONT_SIZE_PCT_MAX, n)) })
                    }
                    setFontSizeInputFocused(false)
                    ;(e.target as HTMLInputElement).blur()
                  }
                }}
                aria-label="Font size percentage"
              />
              <span className={styles.sliderValueSuffix}>%</span>
            </div>
          </div>
          <label className={styles.label}>Color</label>
          <input
            type="text"
            className={styles.input}
            value={overlay.color ?? '#ffffff'}
            onChange={(e) => onUpdate({ color: e.target.value })}
            placeholder="#ffffff"
          />
          <label className={styles.checkRow}>
            <input
              type="checkbox"
              checked={!!overlay.dropShadow}
              onChange={(e) => onUpdate({ dropShadow: e.target.checked })}
            />
            <span>Drop shadow</span>
          </label>
          <label className={styles.label}>Highlight color</label>
          <div className={styles.highlightRow}>
            <input
              type="text"
              className={styles.input}
              value={overlay.highlightColor ?? ''}
              onChange={(e) => onUpdate({ highlightColor: e.target.value || undefined })}
              placeholder="None or e.g. rgba(255,255,0,0.4)"
            />
            <input
              type="color"
              className={styles.colorSwatch}
              value={overlay.highlightColor?.match(/^#[0-9a-fA-F]{6}$/) ? overlay.highlightColor : '#ffff00'}
              onChange={(e) => onUpdate({ highlightColor: e.target.value + '99' })}
              title="Pick highlight color (adds transparency)"
            />
          </div>
        </>
      )}
      {overlay.type === 'video' && (
        <>
          <label className={styles.label}>Video overlay</label>
          {overlay.videoUrl && (
            <p className={styles.hint}>Stock video from Pexels or Pixabay. Replace using the buttons below.</p>
          )}
          <div className={styles.serviceRow}>
            <button type="button" className={styles.serviceBtn} onClick={() => setStockVideoSource('pexels')} title="Set or replace video from Pexels">
              From Pexels
            </button>
            <button type="button" className={styles.serviceBtn} onClick={() => setStockVideoSource('pixabay')} title="Set or replace video from Pixabay">
              From Pixabay
            </button>
          </div>
          {stockVideoSource && (
            <StockVideoPicker
              isOpen
              onClose={() => setStockVideoSource(null)}
              source={stockVideoSource}
              apiKey={stockVideoSource === 'pexels' ? getStoredPexelsApiKey() : getStoredPixabayApiKey()}
              onSelect={(videoUrl, width, height) => {
                onUpdate({ videoUrl, naturalWidth: width, naturalHeight: height, imageScale: 1 })
                setStockVideoSource(null)
              }}
            />
          )}
          <label className={styles.label}>Scale</label>
          <div className={styles.sliderRow}>
            <input
              type="range"
              className={styles.slider}
              min={10}
              max={200}
              value={Math.round((overlay.imageScale ?? 1) * 100)}
              onChange={(e) => onUpdate({ imageScale: Number(e.target.value) / 100 })}
              aria-label="Video scale"
            />
            <span className={styles.sliderValue}>{Math.round((overlay.imageScale ?? 1) * 100)}%</span>
          </div>
          <label className={styles.label}>Rotation</label>
          <div className={styles.sliderRow}>
            <input
              type="range"
              className={styles.slider}
              min={0}
              max={360}
              value={Math.round(overlay.rotation ?? 0)}
              onChange={(e) => onUpdate({ rotation: Number(e.target.value) })}
              aria-label="Rotation"
            />
            <span className={styles.sliderValue}>{Math.round(overlay.rotation ?? 0)}°</span>
          </div>
          <label className={styles.checkRow}>
            <input
              type="checkbox"
              checked={!!overlay.flipHorizontal}
              onChange={(e) => onUpdate({ flipHorizontal: e.target.checked })}
            />
            <span>Flip horizontal</span>
          </label>
        </>
      )}
      {overlay.type === 'infographic' && (
        <>
          <label className={styles.label}>Infographic</label>
          <p className={styles.hint}>
            {overlay.infographicProjectName || 'Untitled infographic'}. Animations play when this overlay is active in the timeline.
          </p>
          <label className={styles.label}>Scale</label>
          <div className={styles.sliderRow}>
            <input
              type="range"
              className={styles.slider}
              min={10}
              max={200}
              value={Math.round((overlay.imageScale ?? 1) * 100)}
              onChange={(e) => onUpdate({ imageScale: Number(e.target.value) / 100 })}
              aria-label="Infographic scale"
            />
            <span className={styles.sliderValue}>{Math.round((overlay.imageScale ?? 1) * 100)}%</span>
          </div>
          <label className={styles.label}>Rotation</label>
          <div className={styles.sliderRow}>
            <input
              type="range"
              className={styles.slider}
              min={0}
              max={360}
              value={Math.round(overlay.rotation ?? 0)}
              onChange={(e) => onUpdate({ rotation: Number(e.target.value) })}
              aria-label="Rotation"
            />
            <span className={styles.sliderValue}>{Math.round(overlay.rotation ?? 0)}°</span>
          </div>
          <label className={styles.checkRow}>
            <input
              type="checkbox"
              checked={!!overlay.flipHorizontal}
              onChange={(e) => onUpdate({ flipHorizontal: e.target.checked })}
            />
            <span>Flip horizontal</span>
          </label>
        </>
      )}
      {overlay.type === 'image' && (
        <>
          <label className={styles.label}>Image</label>
          {overlay.imageDataUrl ? (
            <div className={styles.imagePreview}>
              <img src={overlay.imageDataUrl} alt="Overlay" />
              <button type="button" className={styles.removeImg} onClick={() => onUpdate({ imageDataUrl: undefined })} title="Remove image" aria-label="Remove image">
                <IconTrash />
              </button>
            </div>
          ) : overlay.imageUrl ? (
            <div className={styles.imagePreview}>
              <img src={overlay.imageUrl} alt="Animated sticker" />
              <button type="button" className={styles.removeImg} onClick={() => onUpdate({ imageUrl: undefined, naturalWidth: undefined, naturalHeight: undefined })} title="Remove animated sticker" aria-label="Remove animated sticker">
                <IconTrash />
              </button>
            </div>
          ) : (
            <input
              type="file"
              accept="image/*"
              className={styles.fileInput}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) {
                  const r = new FileReader()
                  r.onload = () => {
                    const dataUrl = r.result as string
                    const img = new Image()
                    img.onload = () => {
                      onUpdate({
                        imageDataUrl: dataUrl,
                        naturalWidth: img.naturalWidth,
                        naturalHeight: img.naturalHeight,
                        imageScale: 1,
                      })
                    }
                    img.src = dataUrl
                  }
                  r.readAsDataURL(f)
                }
              }}
            />
          )}
          <div className={styles.serviceRow}>
            <button type="button" className={styles.serviceBtn} onClick={() => setUnsplashPickerOpen(true)} title="Set or replace image from Unsplash">
              From Unsplash
            </button>
            <button type="button" className={styles.serviceBtn} onClick={() => setGiphyPickerOpen(true)} title="Set or replace image from GIPHY (animated GIF)">
              From GIPHY
            </button>
          </div>
          <UnsplashPicker
            isOpen={unsplashPickerOpen}
            onClose={() => setUnsplashPickerOpen(false)}
            accessKey={getStoredUnsplashAccessKey()}
            onSelect={(imageDataUrl, naturalWidth, naturalHeight) => {
              onUpdate({ imageDataUrl, naturalWidth, naturalHeight, imageScale: 1, imageUrl: undefined })
              setUnsplashPickerOpen(false)
            }}
          />
          <AnimatedStickerPicker
            isOpen={giphyPickerOpen}
            onClose={() => setGiphyPickerOpen(false)}
            apiKey={getStoredGiphyApiKey()}
            onSelect={(imageUrl, naturalWidth, naturalHeight) => {
              onUpdate({ imageUrl, naturalWidth, naturalHeight, imageScale: 1, imageDataUrl: undefined })
              setGiphyPickerOpen(false)
            }}
          />
          {(overlay.imageDataUrl || overlay.imageUrl) && (
            <>
              <label className={styles.label}>Scale</label>
              <div className={styles.sliderRow}>
                <input
                  type="range"
                  className={styles.slider}
                  min={10}
                  max={200}
                  value={Math.round((overlay.imageScale ?? 1) * 100)}
                  onChange={(e) => onUpdate({ imageScale: Number(e.target.value) / 100 })}
                  aria-label="Image scale"
                />
                <span className={styles.sliderValue}>{Math.round((overlay.imageScale ?? 1) * 100)}%</span>
              </div>
              <label className={styles.label}>Rotation</label>
              <div className={styles.sliderRow}>
                <input
                  type="range"
                  className={styles.slider}
                  min={0}
                  max={360}
                  value={Math.round(overlay.rotation ?? 0)}
                  onChange={(e) => onUpdate({ rotation: Number(e.target.value) })}
                  aria-label="Rotation"
                />
                <span className={styles.sliderValue}>{Math.round(overlay.rotation ?? 0)}°</span>
              </div>
              <label className={styles.checkRow}>
                <input
                  type="checkbox"
                  checked={!!overlay.flipHorizontal}
                  onChange={(e) => onUpdate({ flipHorizontal: e.target.checked })}
                />
                <span>Flip horizontal</span>
              </label>
            </>
          )}
        </>
      )}
      {onSaveToLibrary && (
        <div className={styles.serviceRow}>
          <button type="button" className={styles.serviceBtn} onClick={onSaveToLibrary} title="Save this overlay to the clip library">
            Save to library
          </button>
        </div>
      )}
    </>
  )

  if (embedded) return formContent

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <span>Edit overlay</span>
        <div className={styles.headerActions}>
          {onRemove && (
            <button type="button" className={styles.removeOverlayBtn} onClick={onRemove} title="Remove from timeline" aria-label="Remove from timeline">
              <IconTrash />
            </button>
          )}
          <button type="button" className={styles.closeBtn} onClick={onClose} title="Close" aria-label="Close">
            <IconX />
          </button>
        </div>
      </div>
      {formContent}
    </div>
  )
}
