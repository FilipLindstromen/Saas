import { useState } from 'react'
import { CAPTION_FONT_LABELS } from '../types'
import type { CaptionAnimation, CaptionFont, CaptionSettings, CaptionStyle } from '../types'
import { deletePreset, loadPresets, savePreset } from '../services/presets'
import './CaptionsPanel.css'

type Props = {
  isOpen: boolean
  onClose: () => void
  captions: CaptionSettings
  onChange: (next: CaptionSettings) => void
  brandColor: string
  onApplyPreset: (captions: CaptionSettings, brandColor: string) => void
}

const STYLE_OPTIONS: { value: CaptionStyle; label: string }[] = [
  { value: 'subtitle', label: 'Subtitle' },
  { value: 'lower-third', label: 'Lower Third' },
  { value: 'bold-center', label: 'Bold Center' },
  { value: 'top-banner', label: 'Top Banner' },
]

const ANIMATION_OPTIONS: { value: CaptionAnimation; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'fade', label: 'Fade' },
  { value: 'pop', label: 'Pop' },
  { value: 'slide-up', label: 'Slide up' },
]

const SYSTEM_FONTS: CaptionFont[] = ['system', 'arial', 'georgia', 'courier', 'impact', 'verdana']
const GOOGLE_FONTS: CaptionFont[] = ['montserrat', 'poppins', 'oswald', 'playfair', 'bebasneue', 'anton', 'roboto', 'lato', 'inter', 'dmsans']

export default function CaptionsPanel({ isOpen, onClose, captions, onChange, brandColor, onApplyPreset }: Props) {
  const [presets, setPresets] = useState(loadPresets)
  const [newPresetName, setNewPresetName] = useState('')
  const [newPresetColor, setNewPresetColor] = useState(brandColor || '#3b82f6')

  if (!isOpen) return null

  const set = (patch: Partial<CaptionSettings>) => onChange({ ...captions, ...patch })

  return (
    <div className="captions-panel-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="captions-panel" role="dialog" aria-modal="true" aria-labelledby="captions-panel-title">
        <div className="captions-panel__header">
          <h2 id="captions-panel-title">Captions</h2>
          <button type="button" className="captions-panel__close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="captions-panel__field captions-panel__presets-field">
          <span className="captions-panel__label">Brand presets</span>
          {presets.length === 0 && <p className="captions-panel__hint">Set up captions and a color below, then save one as a preset to reuse across videos.</p>}
          {presets.length > 0 && (
            <div className="captions-panel__presets">
              {presets.map((p) => (
                <div key={p.id} className="captions-panel__preset-chip">
                  <button type="button" onClick={() => onApplyPreset(p.captions, p.brandColor)} title={`Apply "${p.name}"`}>
                    <span className="captions-panel__preset-swatch" style={{ backgroundColor: p.brandColor }} />
                    {p.name}
                  </button>
                  <button type="button" className="captions-panel__preset-delete" onClick={() => setPresets(deletePreset(p.id))} title="Delete preset" aria-label="Delete preset">×</button>
                </div>
              ))}
            </div>
          )}
          <div className="captions-panel__save-preset">
            <input
              type="color"
              value={newPresetColor}
              onChange={(e) => setNewPresetColor(e.target.value)}
              title="Preset brand color"
            />
            <input
              type="text"
              placeholder="Preset name"
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
            />
            <button
              type="button"
              disabled={!newPresetName.trim()}
              onClick={() => {
                setPresets(savePreset(newPresetName.trim(), captions, newPresetColor))
                setNewPresetName('')
              }}
            >
              Save current
            </button>
          </div>
        </div>

        <label className="captions-panel__enable">
          <input type="checkbox" checked={captions.enabled} onChange={(e) => set({ enabled: e.target.checked })} />
          Burn captions into the video
        </label>

        <div className={`captions-panel__body ${captions.enabled ? '' : 'captions-panel__body--disabled'}`}>
          <div className="captions-panel__field">
            <span className="captions-panel__label">Style</span>
            <div className="captions-panel__grid">
              {STYLE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`captions-panel__option ${captions.style === opt.value ? 'active' : ''}`}
                  onClick={() => set({ style: opt.value })}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="captions-panel__field">
            <span className="captions-panel__label">Font</span>
            <select value={captions.font} onChange={(e) => set({ font: e.target.value as CaptionFont })}>
              <optgroup label="Web-safe">
                {SYSTEM_FONTS.map((f) => (
                  <option key={f} value={f}>{CAPTION_FONT_LABELS[f]}</option>
                ))}
              </optgroup>
              <optgroup label="Google Fonts">
                {GOOGLE_FONTS.map((f) => (
                  <option key={f} value={f}>{CAPTION_FONT_LABELS[f]}</option>
                ))}
              </optgroup>
            </select>
          </div>

          <div className="captions-panel__field">
            <span className="captions-panel__label">Size ({captions.sizePct}% of frame height)</span>
            <input
              type="range"
              min={3}
              max={12}
              step={0.5}
              value={captions.sizePct}
              onChange={(e) => set({ sizePct: Number(e.target.value) })}
            />
          </div>

          <div className="captions-panel__field">
            <span className="captions-panel__label">Animation</span>
            <div className="captions-panel__grid">
              {ANIMATION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`captions-panel__option ${captions.animation === opt.value ? 'active' : ''}`}
                  onClick={() => set({ animation: opt.value })}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="captions-panel__field">
            <span className="captions-panel__label">Animation speed ({captions.animationSpeedMs}ms)</span>
            <input
              type="range"
              min={100}
              max={800}
              step={50}
              value={captions.animationSpeedMs}
              onChange={(e) => set({ animationSpeedMs: Number(e.target.value) })}
              disabled={captions.animation === 'none'}
            />
          </div>

          <label className="captions-panel__checkbox-field">
            <input
              type="checkbox"
              checked={captions.wordByWord}
              onChange={(e) => set({ wordByWord: e.target.checked })}
            />
            Show one word at a time, synced to the voice
          </label>
        </div>

        <button type="button" className="captions-panel__done" onClick={onClose}>Done</button>
      </div>
    </div>
  )
}
