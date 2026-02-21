import { GOOGLE_FONTS } from '../constants/fonts'
import './DocumentPanel.css'

const FONT_SIZES = [10, 12, 14, 16, 18, 20, 24, 28, 32]

const ASPECT_RATIOS = [
  { value: '16:9', label: '16:9' },
  { value: '9:16', label: '9:16' },
  { value: '1:1', label: '1:1' }
]

const RESOLUTIONS = [
  { value: 800, label: '800px' },
  { value: 1080, label: '1080px' },
  { value: 1920, label: '1920px' }
]

export default function DocumentPanel({
  aspectRatio,
  onAspectRatioChange,
  resolution,
  onResolutionChange,
  backgroundColor,
  onBackgroundColorChange,
  includeBackgroundInExport = true,
  onIncludeBackgroundInExportChange,
  defaultFontFamily = 'Inter',
  onDefaultFontFamilyChange,
  defaultFontSize = 14,
  onDefaultFontSizeChange
}) {
  return (
    <div className="document-panel">
      <div className="document-field">
        <label>Default font</label>
        <select
          value={defaultFontFamily}
          onChange={(e) => onDefaultFontFamilyChange?.(e.target.value)}
        >
          {GOOGLE_FONTS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
      </div>
      <div className="document-field">
        <label>Default text size</label>
        <select
          value={defaultFontSize}
          onChange={(e) => onDefaultFontSizeChange?.(Number(e.target.value))}
        >
          {FONT_SIZES.map((s) => (
            <option key={s} value={s}>{s}px</option>
          ))}
        </select>
      </div>
      <div className="document-field">
        <label>Aspect ratio</label>
        <select
          value={aspectRatio}
          onChange={(e) => onAspectRatioChange(e.target.value)}
        >
          {ASPECT_RATIOS.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </div>
      <div className="document-field">
        <label>Resolution</label>
        <select
          value={resolution}
          onChange={(e) => onResolutionChange(Number(e.target.value))}
        >
          {RESOLUTIONS.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </div>
      <div className="document-field">
        <label>Background</label>
        <div className="document-bg">
          <input
            type="color"
            value={backgroundColor}
            onChange={(e) => onBackgroundColorChange(e.target.value)}
          />
          <input
            type="text"
            value={backgroundColor}
            onChange={(e) => onBackgroundColorChange(e.target.value)}
            className="color-hex"
          />
        </div>
      </div>
      <div className="document-field document-field-checkbox">
        <label className="document-checkbox-label">
          <input
            type="checkbox"
            checked={includeBackgroundInExport}
            onChange={(e) => onIncludeBackgroundInExportChange?.(e.target.checked)}
          />
          Include background in export
        </label>
      </div>
    </div>
  )
}
