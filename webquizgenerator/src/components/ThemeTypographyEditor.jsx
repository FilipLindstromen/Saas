import React from 'react'
import './ThemeTypographyEditor.css'

const FONT_OPTIONS = [
  'Inter',
  'Oswald',
  'Poppins',
  'Roboto',
  'Lato',
  'Playfair Display'
]

function ThemeTypographyEditor({ typography, theme, onTypographyChange, onThemeChange }) {
  const handleFontChange = (field) => (e) => onTypographyChange(field, e.target.value)
  const handleSizeChange = (field) => (e) => onTypographyChange(field, e.target.value)

  const backgroundType = theme?.backgroundType || 'gradient'
  const backgroundValue = theme?.backgroundValue || ''
  const gradientStart = theme?.gradientStart || '#0b0d11'
  const gradientEnd = theme?.gradientEnd || '#1f242d'
  const gradientAngle = typeof theme?.gradientAngle === 'number' ? theme.gradientAngle : 333

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      onThemeChange({
        backgroundType: 'image',
        backgroundValue: reader.result
      })
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="theme-typo">
      <h2>Style & Theme</h2>
      <p className="section-description">Customize fonts, sizes, and background for the exported quiz and preview.</p>

      <div className="typo-grid">
        <div className="typo-card">
          <h3>Title</h3>
          <div className="form-group inline">
            <label>Font</label>
            <select value={typography.titleFont} onChange={handleFontChange('titleFont')} className="form-input">
              {FONT_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div className="form-group inline">
            <label>Size</label>
            <input
              type="text"
              value={typography.titleSize}
              onChange={handleSizeChange('titleSize')}
              className="form-input"
              placeholder="e.g., 2.4rem"
            />
          </div>
        </div>

        <div className="typo-card">
          <h3>Questions</h3>
          <div className="form-group inline">
            <label>Font</label>
            <select value={typography.questionFont} onChange={handleFontChange('questionFont')} className="form-input">
              {FONT_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div className="form-group inline">
            <label>Size</label>
            <input
              type="text"
              value={typography.questionSize}
              onChange={handleSizeChange('questionSize')}
              className="form-input"
              placeholder="e.g., 1.85rem"
            />
          </div>
        </div>

        <div className="typo-card">
          <h3>Answers</h3>
          <div className="form-group inline">
            <label>Font</label>
            <select value={typography.answerFont} onChange={handleFontChange('answerFont')} className="form-input">
              {FONT_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div className="form-group inline">
            <label>Size</label>
            <input
              type="text"
              value={typography.answerSize}
              onChange={handleSizeChange('answerSize')}
              className="form-input"
              placeholder="e.g., 1.05rem"
            />
          </div>
        </div>

        <div className="typo-card">
          <h3>Feedback</h3>
          <div className="form-group inline">
            <label>Font</label>
            <select value={typography.feedbackFont} onChange={handleFontChange('feedbackFont')} className="form-input">
              {FONT_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div className="form-group inline">
            <label>Size</label>
            <input
              type="text"
              value={typography.feedbackSize}
              onChange={handleSizeChange('feedbackSize')}
              className="form-input"
              placeholder="e.g., 1rem"
            />
          </div>
        </div>
      </div>

      <div className="background-card">
        <h3>Background</h3>
        <div className="form-group inline">
          <label>Type</label>
          <select
            value={backgroundType}
            onChange={(e) => onThemeChange({ backgroundType: e.target.value })}
            className="form-input"
          >
            <option value="color">Solid Color</option>
            <option value="gradient">Gradient</option>
            <option value="image">Image URL</option>
          </select>
        </div>
        <div className="form-group">
          <label>
            {backgroundType === 'color' && 'Color (e.g., #0a0e14)'}
            {backgroundType === 'gradient' && 'Gradient CSS (e.g., linear-gradient(...))'}
            {backgroundType === 'image' && 'Image URL'}
          </label>
          <input
            type="text"
            value={backgroundValue}
            onChange={(e) => onThemeChange({ backgroundValue: e.target.value })}
            className="form-input"
            placeholder={backgroundType === 'color'
              ? '#000000'
              : backgroundType === 'gradient'
              ? 'linear-gradient(333deg, ...)'
              : 'https://example.com/background.jpg'}
          />
          <small>Applied to preview and exported quiz.</small>
        </div>

        {backgroundType === 'gradient' && (
          <div className="gradient-editor">
            <div className="gradient-row">
              <div className="form-group">
                <label>Start Color</label>
                <input
                  type="color"
                  value={gradientStart}
                  onChange={(e) => onThemeChange({ gradientStart: e.target.value })}
                  className="color-input"
                />
              </div>
              <div className="form-group">
                <label>End Color</label>
                <input
                  type="color"
                  value={gradientEnd}
                  onChange={(e) => onThemeChange({ gradientEnd: e.target.value })}
                  className="color-input"
                />
              </div>
            </div>
            <div className="form-group">
              <label>Angle ({gradientAngle}°)</label>
              <input
                type="range"
                min="0"
                max="360"
                value={gradientAngle}
                onChange={(e) => onThemeChange({ gradientAngle: Number(e.target.value) })}
              />
            </div>
            <div
              className="gradient-preview"
              style={{ background: `linear-gradient(${gradientAngle}deg, ${gradientStart} 0%, ${gradientEnd} 100%)` }}
            />
          </div>
        )}

        {backgroundType === 'color' && (
          <div className="form-group">
            <label>Pick Color</label>
            <input
              type="color"
              value={backgroundValue || '#0b0d11'}
              onChange={(e) => onThemeChange({ backgroundValue: e.target.value })}
              className="color-input"
            />
          </div>
        )}

        {backgroundType === 'image' && (
          <div className="image-preview">
            {backgroundValue ? (
              <div
                className="image-thumb"
                style={{ backgroundImage: `url(${backgroundValue})` }}
              />
            ) : (
              <div className="image-thumb placeholder">Image preview</div>
            )}
            <div className="form-group inline image-actions">
              <label>Upload Image</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="file-input"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ThemeTypographyEditor

