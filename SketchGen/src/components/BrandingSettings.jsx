import { useEffect } from 'react'
import {
  BRAND_COLOR_FIELDS,
  BRAND_FONT_ROLES,
  GOOGLE_FONT_OPTIONS,
  injectGoogleFontsLink,
} from '../constants/brand'
import './BrandingSettings.css'

export default function BrandingSettings({ value, onChange }) {
  const colors = value?.colors ?? {}
  const fonts = value?.fonts ?? {}

  useEffect(() => {
    injectGoogleFontsLink(BRAND_FONT_ROLES.map(({ key }) => fonts[key]))
  }, [fonts.headline, fonts.body, fonts.accent])

  const setColor = (key, hex) => {
    onChange({ ...value, colors: { ...colors, [key]: hex } })
  }

  const setFont = (role, family) => {
    onChange({ ...value, fonts: { ...fonts, [role]: family } })
  }

  return (
    <div className="branding-settings">
      <h3 className="branding-settings-title">Branding</h3>
      <p className="branding-settings-desc">
        Brand colors and fonts are applied to generations when you enable &quot;Use brand colors&quot; in the prompt panel.
      </p>

      <div className="branding-settings-subtitle">Brand colors</div>
      <div className="branding-color-grid">
        {BRAND_COLOR_FIELDS.map(({ key, label }) => (
          <label key={key} className="branding-color-row">
            <span className="branding-color-label">{label}</span>
            <input
              type="color"
              className="branding-color-swatch"
              value={colors[key] ?? '#000000'}
              onChange={(e) => setColor(key, e.target.value)}
            />
            <input
              type="text"
              className="branding-color-hex"
              value={colors[key] ?? ''}
              onChange={(e) => setColor(key, e.target.value)}
              spellCheck={false}
              aria-label={`${label} hex color`}
            />
          </label>
        ))}
      </div>

      <div className="branding-settings-subtitle">Fonts (Google Fonts)</div>
      {BRAND_FONT_ROLES.map(({ key, label }) => (
        <div key={key} className="shared-settings-field">
          <label htmlFor={`brand-font-${key}`}>{label}</label>
          <select
            id={`brand-font-${key}`}
            value={fonts[key] ?? GOOGLE_FONT_OPTIONS[0]}
            onChange={(e) => setFont(key, e.target.value)}
          >
            {GOOGLE_FONT_OPTIONS.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>
      ))}

      <div className="branding-font-preview" aria-hidden>
        <p className="branding-font-preview-heading" style={{ fontFamily: `"${fonts.headline}", sans-serif` }}>
          Headline font
        </p>
        <p className="branding-font-preview-body" style={{ fontFamily: `"${fonts.body}", sans-serif` }}>
          Body text and chart labels
        </p>
        <p className="branding-font-preview-accent" style={{ fontFamily: `"${fonts.accent}", sans-serif` }}>
          Accent callout
        </p>
      </div>
      <p className="branding-settings-build-id" title="Deployed bundle version">
        Build {import.meta.env.VITE_APP_BUILD_ID || 'dev'}
      </p>
    </div>
  )
}
