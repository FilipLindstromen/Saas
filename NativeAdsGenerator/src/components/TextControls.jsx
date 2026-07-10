import { FONT_OPTIONS } from '../utils/adCompositor'
import './TextControls.css'

export default function TextControls({
  text,
  onChange,
  backgroundColor,
  onBackgroundColorChange,
  embedded = false,
  hideBackgroundColor = false,
}) {
  const update = (key, value) => onChange({ ...text, [key]: value })

  return (
    <section className={`nag-panel-section ${embedded ? 'nag-panel-embedded' : ''}`}>
      {!embedded && <h3 className="nag-section-title">Text style</h3>}

      <div className="nag-field-row">
        <div className="nag-field-group">
          <label className="nag-label" htmlFor="nag-font">Font</label>
          <select
            id="nag-font"
            className="nag-select"
            value={text.fontFamily}
            onChange={(e) => update('fontFamily', e.target.value)}
          >
            {FONT_OPTIONS.map((font) => (
              <option key={font} value={font}>{font}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="nag-field-row">
        <div className="nag-field-group">
          <label className="nag-label" htmlFor="nag-headline-size">Headline size</label>
          <input
            id="nag-headline-size"
            type="number"
            className="nag-input"
            min="16"
            max="200"
            value={text.headlineFontSize}
            onChange={(e) => update('headlineFontSize', parseInt(e.target.value, 10) || 72)}
          />
        </div>
        <div className="nag-field-group">
          <label className="nag-label" htmlFor="nag-copy-size">Copy size</label>
          <input
            id="nag-copy-size"
            type="number"
            className="nag-input"
            min="12"
            max="120"
            value={text.copyFontSize}
            onChange={(e) => update('copyFontSize', parseInt(e.target.value, 10) || 32)}
          />
        </div>
      </div>

      <div className="nag-field-row">
        <div className="nag-field-group">
          <label className="nag-label" htmlFor="nag-text-color">Text color</label>
          <div className="nag-color-row">
            <input
              id="nag-text-color"
              type="color"
              value={text.color}
              onChange={(e) => update('color', e.target.value)}
            />
            <input
              type="text"
              className="nag-input"
              value={text.color}
              onChange={(e) => update('color', e.target.value)}
            />
          </div>
        </div>
        {!hideBackgroundColor && (
        <div className="nag-field-group">
          <label className="nag-label" htmlFor="nag-bg-color">Canvas background</label>
          <div className="nag-color-row">
            <input
              id="nag-bg-color"
              type="color"
              value={backgroundColor}
              onChange={(e) => onBackgroundColorChange(e.target.value)}
            />
            <input
              type="text"
              className="nag-input"
              value={backgroundColor}
              onChange={(e) => onBackgroundColorChange(e.target.value)}
            />
          </div>
        </div>
        )}
      </div>

      <div className="nag-effects-block">
        <h4 className="nag-subsection-title">Text effects</h4>

        <label className="nag-checkbox">
          <input
            type="checkbox"
            checked={text.dropShadow}
            onChange={(e) => update('dropShadow', e.target.checked)}
          />
          <span>Drop shadow</span>
        </label>
        {text.dropShadow && (
          <div className="nag-sub-fields">
            <label className="nag-label">Blur <span>{text.shadowBlur}px</span></label>
            <input
              type="range"
              min="0"
              max="40"
              value={text.shadowBlur}
              onChange={(e) => update('shadowBlur', parseInt(e.target.value, 10))}
            />
            <div className="nag-field-row">
              <div className="nag-field-group">
                <label className="nag-label">Offset X</label>
                <input
                  type="number"
                  className="nag-input"
                  min="-30"
                  max="30"
                  value={text.shadowOffsetX}
                  onChange={(e) => update('shadowOffsetX', parseInt(e.target.value, 10) || 0)}
                />
              </div>
              <div className="nag-field-group">
                <label className="nag-label">Offset Y</label>
                <input
                  type="number"
                  className="nag-input"
                  min="-30"
                  max="30"
                  value={text.shadowOffsetY}
                  onChange={(e) => update('shadowOffsetY', parseInt(e.target.value, 10) || 0)}
                />
              </div>
            </div>
            <div className="nag-color-row">
              <input
                type="color"
                value={text.shadowColor?.startsWith('#') ? text.shadowColor : '#000000'}
                onChange={(e) => update('shadowColor', e.target.value)}
              />
              <input
                type="text"
                className="nag-input"
                value={text.shadowColor}
                onChange={(e) => update('shadowColor', e.target.value)}
              />
            </div>
          </div>
        )}

        <label className="nag-checkbox">
          <input
            type="checkbox"
            checked={text.highlight}
            onChange={(e) => update('highlight', e.target.checked)}
          />
          <span>Text highlight</span>
        </label>
        {text.highlight && (
          <div className="nag-sub-fields">
            <div className="nag-color-row">
              <input
                type="color"
                value={text.highlightColor}
                onChange={(e) => update('highlightColor', e.target.value)}
              />
              <input
                type="text"
                className="nag-input"
                value={text.highlightColor}
                onChange={(e) => update('highlightColor', e.target.value)}
              />
            </div>
            <label className="nag-label">
              Opacity <span>{Math.round((text.highlightOpacity ?? 0.85) * 100)}%</span>
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={text.highlightOpacity ?? 0.85}
              onChange={(e) => update('highlightOpacity', parseFloat(e.target.value))}
            />
            <label className="nag-label">Padding (px)</label>
            <input
              type="number"
              className="nag-input"
              min="0"
              max="60"
              value={text.highlightPadding ?? 16}
              onChange={(e) => update('highlightPadding', parseInt(e.target.value, 10) || 0)}
            />
            <label className="nag-checkbox nag-checkbox-nested">
              <input
                type="checkbox"
                checked={text.highlightHeadlineOnly !== false}
                onChange={(e) => update('highlightHeadlineOnly', e.target.checked)}
              />
              <span>Headline only</span>
            </label>
          </div>
        )}

        <label className="nag-checkbox">
          <input
            type="checkbox"
            checked={!!text.outline}
            onChange={(e) => update('outline', e.target.checked)}
          />
          <span>Outline</span>
        </label>
        {text.outline && (
          <div className="nag-sub-fields">
            <div className="nag-color-row">
              <input
                type="color"
                value={text.outlineColor || '#000000'}
                onChange={(e) => update('outlineColor', e.target.value)}
              />
              <input
                type="text"
                className="nag-input"
                value={text.outlineColor || '#000000'}
                onChange={(e) => update('outlineColor', e.target.value)}
              />
            </div>
            <label className="nag-label">
              Width <span>{text.outlineWidth ?? 3}px</span>
            </label>
            <input
              type="range"
              min="1"
              max="12"
              value={text.outlineWidth ?? 3}
              onChange={(e) => update('outlineWidth', parseInt(e.target.value, 10))}
            />
          </div>
        )}

        <label className="nag-checkbox">
          <input
            type="checkbox"
            checked={!!text.glow}
            onChange={(e) => update('glow', e.target.checked)}
          />
          <span>Glow</span>
        </label>
        {text.glow && (
          <div className="nag-sub-fields">
            <div className="nag-color-row">
              <input
                type="color"
                value={text.glowColor?.startsWith('#') ? text.glowColor : '#ffffff'}
                onChange={(e) => update('glowColor', e.target.value)}
              />
              <input
                type="text"
                className="nag-input"
                value={text.glowColor || '#ffffff'}
                onChange={(e) => update('glowColor', e.target.value)}
              />
            </div>
            <label className="nag-label">
              Blur <span>{text.glowBlur ?? 24}px</span>
            </label>
            <input
              type="range"
              min="4"
              max="60"
              value={text.glowBlur ?? 24}
              onChange={(e) => update('glowBlur', parseInt(e.target.value, 10))}
            />
          </div>
        )}
      </div>
    </section>
  )
}
