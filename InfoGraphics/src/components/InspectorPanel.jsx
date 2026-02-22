import InspectorImageSearch from './InspectorImageSearch'
import './InspectorPanel.css'

export default function InspectorPanel({ element, selectedCount = 1, onUpdate, onDelete, apiKeys, latestImages, onImageSelect }) {
  if (!element) {
    return (
      <div className="inspector-panel">
        <div className="inspector-empty">
          <p>Select an element to edit its properties</p>
        </div>
      </div>
    )
  }

  const { type, text, imageUrl, fontSize, fontFamily, color, backgroundColor, arrowDirection, arrowStyle, imageTint, imageTintOpacity, gradientColor } = element

  return (
    <div className="inspector-panel">
      <div className="inspector-header">
        <span className="inspector-title">
          {selectedCount > 1 ? `${selectedCount} items` : type.replace('-', ' ')}
        </span>
        <button className="inspector-delete" onClick={onDelete} title="Delete">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
            <line x1="10" y1="11" x2="10" y2="17" />
            <line x1="14" y1="11" x2="14" y2="17" />
          </svg>
        </button>
      </div>
      <div className="inspector-body">
        {(type === 'image-text' || type === 'headline' || type === 'cta') && (
          <div className="inspector-field inspector-hint">
            <p className="inspector-text-hint">Double-click text on the canvas to edit. Press Enter for line breaks.</p>
          </div>
        )}
        {type === 'arrow' && (
          <>
            <div className="inspector-field">
              <label>Image</label>
              {element.imageUrl ? (
                <div className="inspector-image-preview">
                  <img src={element.imageUrl} alt="" />
                </div>
              ) : null}
              {onImageSelect && (
                <InspectorImageSearch
                  apiKeys={apiKeys}
                  latestImages={latestImages || []}
                  onSelect={(url, source, searchQuery) => onImageSelect(url, source, searchQuery, 'arrow')}
                  presetQuery="arrows"
                  presetService="giphy"
                  presetType="stickers"
                  recentFilter="arrow"
                />
              )}
            </div>
            {element.imageUrl && (
              <>
                <div className="inspector-field">
                  <label>Recolor</label>
                  <div className="inspector-recolor">
                    <input
                      type="color"
                      value={element.imageTint || '#ffffff'}
                      onChange={(e) => onUpdate({ imageTint: e.target.value })}
                    />
                    <input
                      type="text"
                      value={element.imageTint || ''}
                      onChange={(e) => onUpdate({ imageTint: e.target.value || null })}
                      placeholder="None"
                      className="color-hex"
                    />
                    {element.imageTint && (
                      <button type="button" className="inspector-recolor-clear" onClick={() => onUpdate({ imageTint: null })}>
                        Clear
                      </button>
                    )}
                  </div>
                  {element.imageTint && (
                    <div className="inspector-opacity">
                      <label className="inspector-opacity-label">Opacity</label>
                      <div className="inspector-opacity-controls">
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={element.imageTintOpacity ?? 100}
                          onChange={(e) => onUpdate({ imageTintOpacity: parseInt(e.target.value, 10) })}
                        />
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={element.imageTintOpacity ?? 100}
                          onChange={(e) => onUpdate({ imageTintOpacity: Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0)) })}
                          className="inspector-opacity-value"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}
        {type === 'gradient' && (
          <div className="inspector-field">
            <label>Color</label>
            <input
              type="color"
              value={gradientColor || '#000000'}
              onChange={(e) => onUpdate({ gradientColor: e.target.value })}
            />
            <input
              type="text"
              value={gradientColor || '#000000'}
              onChange={(e) => onUpdate({ gradientColor: e.target.value })}
              className="color-hex"
            />
          </div>
        )}
        {type === 'cta' && (
          <div className="inspector-field">
            <label>Background</label>
            <input
              type="color"
              value={backgroundColor || '#3b82f6'}
              onChange={(e) => onUpdate({ backgroundColor: e.target.value })}
            />
            <input
              type="text"
              value={backgroundColor || '#3b82f6'}
              onChange={(e) => onUpdate({ backgroundColor: e.target.value })}
              className="color-hex"
            />
          </div>
        )}
        {(type === 'image-text' || type === 'image') && (
          <>
            <div className="inspector-field">
              <label>Recolor</label>
              <div className="inspector-recolor">
                <input
                  type="color"
                  value={imageTint || '#ffffff'}
                  onChange={(e) => onUpdate({ imageTint: e.target.value })}
                />
                <input
                  type="text"
                  value={imageTint || ''}
                  onChange={(e) => onUpdate({ imageTint: e.target.value || null })}
                  placeholder="None"
                  className="color-hex"
                />
                {imageTint && (
                  <button type="button" className="inspector-recolor-clear" onClick={() => onUpdate({ imageTint: null })}>
                    Clear
                  </button>
                )}
              </div>
              {imageTint && (
                <div className="inspector-opacity">
                  <label className="inspector-opacity-label">Opacity</label>
                  <div className="inspector-opacity-controls">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={imageTintOpacity ?? 100}
                      onChange={(e) => onUpdate({ imageTintOpacity: parseInt(e.target.value, 10) })}
                    />
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={imageTintOpacity ?? 100}
                      onChange={(e) => onUpdate({ imageTintOpacity: Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0)) })}
                      className="inspector-opacity-value"
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="inspector-field">
              <label>Image</label>
              {imageUrl ? (
                <div className="inspector-image-preview">
                  <img src={imageUrl} alt="" />
                </div>
              ) : null}
              {onImageSelect && (
                <InspectorImageSearch
                  apiKeys={apiKeys}
                  latestImages={latestImages || []}
                  onSelect={onImageSelect}
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
