import { LAYOUTS } from '../layouts'
import './LayoutsPanel.css'

export default function LayoutsPanel({ onApplyLayout }) {
  return (
    <div className="layouts-panel">
      <div className="layouts-header">
        <span className="layouts-title">Layouts</span>
        <p className="layouts-desc">Apply a layout to replace canvas elements. Fill in images and text.</p>
      </div>
      <div className="layouts-grid">
        {LAYOUTS.map((layout) => (
          <button
            key={layout.id}
            type="button"
            className="layouts-card"
            onClick={() => onApplyLayout(layout.id)}
          >
            <span className="layouts-card-name">{layout.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
