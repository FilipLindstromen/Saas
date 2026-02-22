import { GOOGLE_FONTS } from '../constants/fonts'
import './CanvasControls.css'

const TEXT_TYPES = ['headline', 'cta', 'image-text']

export default function CanvasControls({
  zoom,
  onZoomChange,
  selectedElement,
  defaultFontFamily = 'Inter',
  defaultFontSize = 14,
  onUpdate,
  onDefaultFontFamilyChange,
  onDefaultFontSizeChange
}) {
  const isTextElement = selectedElement && TEXT_TYPES.includes(selectedElement.type)
  const fontSize = isTextElement ? (selectedElement.fontSize || 14) : defaultFontSize
  const fontFamily = isTextElement ? (selectedElement.fontFamily || 'Inter') : defaultFontFamily
  const color = isTextElement ? (selectedElement.color || '#000000') : '#000000'
  const textAlign = isTextElement ? (selectedElement.textAlign || 'center') : 'center'
  const fontWeight = isTextElement ? (selectedElement.fontWeight ?? (selectedElement.type === 'headline' ? 700 : 400)) : 400
  const fontStyle = isTextElement ? (selectedElement.fontStyle || 'normal') : 'normal'

  const handleFontSizeChange = (e) => {
    const val = parseInt(e.target.value, 10) || 14
    if (isTextElement && onUpdate) onUpdate({ fontSize: val })
    else if (onDefaultFontSizeChange) onDefaultFontSizeChange(val)
  }
  const handleFontFamilyChange = (e) => {
    const val = e.target.value
    if (isTextElement && onUpdate) onUpdate({ fontFamily: val })
    else if (onDefaultFontFamilyChange) onDefaultFontFamilyChange(val)
  }
  const handleColorChange = (val) => {
    if (isTextElement && onUpdate) onUpdate({ color: val })
  }
  const handleTextAlignChange = (e) => {
    if (isTextElement && onUpdate) onUpdate({ textAlign: e.target.value })
  }
  const handleBoldToggle = () => {
    if (isTextElement && onUpdate) onUpdate({ fontWeight: fontWeight >= 600 ? 400 : 700 })
  }
  const handleItalicToggle = () => {
    if (isTextElement && onUpdate) onUpdate({ fontStyle: fontStyle === 'italic' ? 'normal' : 'italic' })
  }

  return (
    <div className="canvas-controls">
      <div className="canvas-controls-group">
        <label>Zoom</label>
        <div className="canvas-controls-zoom">
          <input
            type="range"
            min="25"
            max="200"
            value={zoom}
            onChange={(e) => onZoomChange(Number(e.target.value))}
          />
          <span className="canvas-controls-zoom-value">{zoom}%</span>
        </div>
      </div>
      {isTextElement && (
        <>
          <div className="canvas-controls-group">
            <label>Font size</label>
            <input
              type="number"
              value={fontSize}
              onChange={handleFontSizeChange}
              min={8}
              max={72}
              className="canvas-controls-font-size"
            />
          </div>
          <div className="canvas-controls-group">
            <label>Font</label>
            <select
              value={fontFamily}
              onChange={handleFontFamilyChange}
              className="canvas-controls-font-select"
            >
              {GOOGLE_FONTS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
              <option value="Georgia">Georgia</option>
              <option value="system-ui">System</option>
            </select>
          </div>
          <div className="canvas-controls-group">
            <label>Align</label>
            <select
              value={textAlign}
              onChange={handleTextAlignChange}
              className="canvas-controls-font-select"
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </div>
          <div className="canvas-controls-group canvas-controls-style-buttons">
            <button
              type="button"
              className={`canvas-controls-style-btn ${fontWeight >= 600 ? 'active' : ''}`}
              onClick={handleBoldToggle}
              title="Bold"
            >
              <strong>B</strong>
            </button>
            <button
              type="button"
              className={`canvas-controls-style-btn ${fontStyle === 'italic' ? 'active' : ''}`}
              onClick={handleItalicToggle}
              title="Italic"
            >
              <em>I</em>
            </button>
          </div>
          <div className="canvas-controls-group">
            <label>Color</label>
            <div className="canvas-controls-bg">
              <input
                type="color"
                value={color}
                onChange={(e) => handleColorChange(e.target.value)}
                title="Text color"
              />
              <input
                type="text"
                value={color}
                onChange={(e) => handleColorChange(e.target.value)}
                className="canvas-controls-bg-hex"
              />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
