import InspectorImageSearch from './InspectorImageSearch'
import { ARROW_DESIGNS } from './CanvasElement'
import { GOOGLE_FONTS } from '../constants/fonts'
import { ANIMATION_OPTIONS } from '../constants/animations'
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

  const { type, text, imageUrl, fontSize, fontFamily, color, backgroundColor, arrowDirection, arrowStyle, rotation, imageTint, imageTintOpacity, animationIn, animationOut, gradientColor } = element

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
          <div className="inspector-field">
            <label>Text</label>
            <textarea
              value={text || ''}
              onChange={(e) => onUpdate({ text: e.target.value })}
              rows={3}
              placeholder="Enter text"
            />
          </div>
        )}
        {type === 'arrow' && (
          <>
            <div className="inspector-field">
              <label>Direction</label>
              <select
                value={arrowDirection || 'right'}
                onChange={(e) => onUpdate({ arrowDirection: e.target.value })}
              >
                <option value="right">Right</option>
                <option value="down">Down</option>
                <option value="left">Left</option>
                <option value="up">Up</option>
              </select>
            </div>
            <div className="inspector-field">
              <label>Color</label>
              <input
                type="color"
                value={color || '#000000'}
                onChange={(e) => onUpdate({ color: e.target.value })}
              />
              <input
                type="text"
                value={color || '#000000'}
                onChange={(e) => onUpdate({ color: e.target.value })}
                className="color-hex"
              />
            </div>
            <div className="inspector-field">
              <label>Style</label>
              <div className="inspector-arrow-styles">
                {Object.keys(ARROW_DESIGNS).map((style) => {
                  const design = ARROW_DESIGNS[style]
                  return (
                    <button
                      key={style}
                      type="button"
                      className={`inspector-arrow-btn ${(arrowStyle || 'simple') === style ? 'active' : ''}`}
                      onClick={() => onUpdate({ arrowStyle: style })}
                      title={style.replace(/-/g, ' ')}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={design.strokeWidth || 2}>
                        {design.circle && <circle cx="12" cy="12" r="8" />}
                        {design.paths?.map((p, i) => (
                          <path key={i} d={p.d} fill={p.fill ? 'currentColor' : 'none'} strokeDasharray={p.strokeDasharray} />
                        ))}
                        <path
                          d={design.d}
                          fill={design.outlineOnly ? 'none' : design.fill ? 'currentColor' : 'none'}
                          strokeDasharray={design.strokeDasharray !== 'none' ? design.strokeDasharray : undefined}
                        />
                      </svg>
                    </button>
                  )
                })}
              </div>
            </div>
          </>
        )}
        {(type === 'image-text' || type === 'headline' || type === 'cta') && (
          <>
            <div className="inspector-field">
              <label>Font size</label>
              <input
                type="number"
                value={fontSize || 14}
                onChange={(e) => onUpdate({ fontSize: parseInt(e.target.value, 10) || 14 })}
                min={8}
                max={72}
              />
            </div>
            <div className="inspector-field">
              <label>Font</label>
              <select
                value={fontFamily || 'Inter'}
                onChange={(e) => onUpdate({ fontFamily: e.target.value })}
              >
                {GOOGLE_FONTS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
                <option value="Georgia">Georgia</option>
                <option value="system-ui">System</option>
              </select>
            </div>
            <div className="inspector-field">
              <label>Color</label>
              <input
                type="color"
                value={color || '#000000'}
                onChange={(e) => onUpdate({ color: e.target.value })}
              />
              <input
                type="text"
                value={color || '#000000'}
                onChange={(e) => onUpdate({ color: e.target.value })}
                className="color-hex"
              />
            </div>
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
              <label>Rotation</label>
              <div className="inspector-rotation">
                <input
                  type="range"
                  min={-180}
                  max={180}
                  value={rotation || 0}
                  onChange={(e) => onUpdate({ rotation: parseInt(e.target.value, 10) || 0 })}
                />
                <input
                  type="number"
                  value={rotation || 0}
                  onChange={(e) => onUpdate({ rotation: parseInt(e.target.value, 10) || 0 })}
                  min={-180}
                  max={180}
                  className="inspector-rotation-value"
                />
              </div>
            </div>
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
        <div className="inspector-section inspector-section-animations">
          <div className="inspector-field">
            <label>Animation in</label>
            <select
              value={animationIn || 'none'}
              onChange={(e) => onUpdate({ animationIn: e.target.value })}
            >
              {ANIMATION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="inspector-field">
            <label>Animation out</label>
            <select
              value={animationOut || 'none'}
              onChange={(e) => onUpdate({ animationOut: e.target.value })}
            >
              {ANIMATION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  )
}
