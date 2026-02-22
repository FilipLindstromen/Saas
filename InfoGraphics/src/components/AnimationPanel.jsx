import { ANIMATION_OPTIONS } from '../constants/animations'
import './AnimationPanel.css'

export default function AnimationPanel({ element, selectedCount = 1, onUpdate }) {
  if (!element) {
    return (
      <div className="animation-panel">
        <div className="animation-panel-empty">
          <p>Select an element to edit its animation</p>
        </div>
      </div>
    )
  }

  const { type, animationIn, animationOut } = element

  return (
    <div className="animation-panel">
      <div className="animation-panel-header">
        <span className="animation-panel-title">
          {selectedCount > 1 ? `${selectedCount} items` : type.replace('-', ' ')}
        </span>
      </div>
      <div className="animation-panel-body">
        <div className="animation-panel-field">
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
        <div className="animation-panel-field">
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
  )
}
