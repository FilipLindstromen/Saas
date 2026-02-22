import { GOOGLE_FONTS } from '../constants/fonts'
import './CanvasControls.css'

const TEXT_TYPES = ['headline', 'cta', 'image-text']

export default function CanvasControls({
  zoom,
  onZoomChange,
  backgroundColor,
  onBackgroundColorChange,
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
      <div className="canvas-controls-group">
        <label>Background</label>
        <div className="canvas-controls-bg">
          <input
            type="color"
            value={backgroundColor}
            onChange={(e) => onBackgroundColorChange(e.target.value)}
            title="Document background color"
          />
          <input
            type="text"
            value={backgroundColor}
            onChange={(e) => onBackgroundColorChange(e.target.value)}
            className="canvas-controls-bg-hex"
          />
        </div>
      </div>
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
    </div>
  )
}
