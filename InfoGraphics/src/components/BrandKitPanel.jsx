import { GOOGLE_FONTS } from '../constants/fonts'
import './BrandKitPanel.css'

export default function BrandKitPanel({
  primaryColor = '#3b82f6',
  secondaryColor = '#1e40af',
  fontFamily = 'Inter',
  onPrimaryColorChange,
  onSecondaryColorChange,
  onFontFamilyChange,
  onApplyToSelection,
  onApplyToAll,
  hasSelection = false,
  hasElements = false
}) {
  return (
    <div className="brand-kit-panel">
      <div className="brand-kit-header">
        <span className="brand-kit-title">Brand Kit</span>
        <p className="brand-kit-desc">Set brand colors and font. Apply to elements.</p>
      </div>
      <div className="brand-kit-field">
        <label>Primary color</label>
        <div className="brand-kit-color-row">
          <input
            type="color"
            value={primaryColor}
            onChange={(e) => onPrimaryColorChange?.(e.target.value)}
          />
          <input
            type="text"
            value={primaryColor}
            onChange={(e) => onPrimaryColorChange?.(e.target.value)}
            className="brand-kit-hex"
          />
        </div>
      </div>
      <div className="brand-kit-field">
        <label>Secondary color</label>
        <div className="brand-kit-color-row">
          <input
            type="color"
            value={secondaryColor}
            onChange={(e) => onSecondaryColorChange?.(e.target.value)}
          />
          <input
            type="text"
            value={secondaryColor}
            onChange={(e) => onSecondaryColorChange?.(e.target.value)}
            className="brand-kit-hex"
          />
        </div>
      </div>
      <div className="brand-kit-field">
        <label>Font</label>
        <select
          value={fontFamily}
          onChange={(e) => onFontFamilyChange?.(e.target.value)}
        >
          {GOOGLE_FONTS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
      </div>
      <div className="brand-kit-actions">
        <button
          type="button"
          className="brand-kit-btn"
          onClick={onApplyToSelection}
          disabled={!hasSelection}
          title={hasSelection ? 'Apply brand to selected elements' : 'Select elements first'}
        >
          Apply to selection
        </button>
        <button
          type="button"
          className="brand-kit-btn"
          onClick={onApplyToAll}
          disabled={!hasElements}
          title={hasElements ? 'Apply brand to all elements' : 'Add elements first'}
        >
          Apply to all
        </button>
      </div>
    </div>
  )
}
