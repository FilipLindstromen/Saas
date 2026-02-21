import './CanvasControls.css'

export default function CanvasControls({ zoom, onZoomChange, backgroundColor, onBackgroundColorChange }) {
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
    </div>
  )
}
