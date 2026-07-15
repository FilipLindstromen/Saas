import './SlideSettings.css'

function DocumentSettings({
  contentEdgeOffset = 9,
  contentBottomOffset = 12,
  contentVerticalAlign = 'bottom',
  onUpdateSettings,
}) {
  if (!onUpdateSettings) return null

  return (
    <div className="slide-settings-content">
      <div className="slide-settings-section">
        <h4 className="slide-settings-section-title">Carousel format</h4>
        <p className="slide-settings-hint">Fixed at 1080×1440 px — one slide equals one carousel image for Instagram and Meta ads.</p>
      </div>

      <div className="slide-settings-section slide-settings-text-position">
        <h4 className="slide-settings-section-title">Text position</h4>
        <div className="slide-settings-field">
          <label htmlFor="slide-settings-vertical-align">Vertical alignment</label>
          <select
            id="slide-settings-vertical-align"
            className="slide-settings-select"
            value={contentVerticalAlign || 'bottom'}
            onChange={(e) => onUpdateSettings({ contentVerticalAlign: e.target.value })}
          >
            <option value="bottom">Bottom</option>
            <option value="top">Top</option>
          </select>
        </div>
        <div className="slide-settings-field">
          <label htmlFor="slide-settings-edge">Distance from edge (%)</label>
          <input
            id="slide-settings-edge"
            type="number"
            min="2"
            max="25"
            step="0.5"
            value={contentEdgeOffset}
            onChange={(e) => onUpdateSettings({ contentEdgeOffset: parseFloat(e.target.value) ?? 9 })}
            className="slide-settings-input"
          />
        </div>
        <div className="slide-settings-field">
          <label htmlFor="slide-settings-vertical-distance">
            Distance from {contentVerticalAlign === 'top' ? 'top' : 'bottom'} (%)
          </label>
          <input
            id="slide-settings-vertical-distance"
            type="number"
            min="5"
            max="30"
            step="0.5"
            value={contentBottomOffset}
            onChange={(e) => onUpdateSettings({ contentBottomOffset: parseFloat(e.target.value) ?? 12 })}
            className="slide-settings-input"
          />
        </div>
      </div>
    </div>
  )
}

export default DocumentSettings
