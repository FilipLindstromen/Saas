import './SlideSettings.css'

function DocumentSettings({
  slideFormat = '16:9',
  contentEdgeOffset = 9,
  contentBottomOffset = 12,
  contentVerticalAlign = 'bottom',
  textAnimationMode = 'manual',
  editMotionPreview = true,
  onUpdateSettings,
}) {
  if (!onUpdateSettings) return null

  return (
    <div className="slide-settings-content">
      <div className="slide-settings-section">
        <h4 className="slide-settings-section-title">Slide format</h4>
        <div className="slide-settings-field slide-settings-format">
          <label htmlFor="slide-settings-format">Aspect ratio</label>
          <select
            id="slide-settings-format"
            className="slide-settings-select"
            value={slideFormat}
            onChange={(e) => onUpdateSettings({ slideFormat: e.target.value })}
            title="Slide aspect ratio for preview, present, and export"
          >
            <option value="16:9">16:9</option>
            <option value="1:1">1:1</option>
            <option value="9:16">9:16</option>
            <option value="3:4">1080×1440 (Instagram)</option>
          </select>
        </div>
        <p className="slide-settings-hint">Applies to all slides in preview, present mode, and export.</p>
        {slideFormat === '3:4' && (
          <p className="slide-settings-hint">Export as an Instagram carousel from Share in the header or command palette (Ctrl+K).</p>
        )}
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
            title="Align slide text to the top or bottom (all slides)"
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
            title="Horizontal distance from left/right edge for all slides"
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
            title={`How far from the ${contentVerticalAlign === 'top' ? 'top' : 'bottom'} the text sits (all slides)`}
          />
        </div>
        <p className="slide-settings-hint">Applies to all slides in edit, present, and export.</p>
      </div>

      <div className="slide-settings-section">
        <h4 className="slide-settings-section-title">Text motion (deck)</h4>
        <div className="slide-settings-field">
          <label htmlFor="deck-text-animation-mode">Default animation mode</label>
          <select
            id="deck-text-animation-mode"
            className="slide-settings-select"
            value={textAnimationMode || 'manual'}
            onChange={(e) => onUpdateSettings({ textAnimationMode: e.target.value })}
          >
            <option value="manual">Manual (per-slide animation)</option>
            <option value="smart">Smart (content-aware picks)</option>
          </select>
        </div>
        <div className="slide-settings-field">
          <label className="slide-settings-checkbox">
            <input
              type="checkbox"
              checked={editMotionPreview !== false}
              onChange={(e) => onUpdateSettings({ editMotionPreview: e.target.checked })}
            />
            <span>Live motion preview in editor</span>
          </label>
          <p className="slide-settings-hint">Shows entrance animations on the canvas (turn off to edit text without animation).</p>
        </div>
      </div>
    </div>
  )
}

export default DocumentSettings
