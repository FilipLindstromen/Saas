import { useState } from 'react'
import { LAYOUTS } from '../layouts'
import LayoutPreview from './LayoutPreview'
import { loadCustomTemplates, deleteCustomTemplate } from '../utils/customTemplates'
import './LayoutsPanel.css'

export default function LayoutsPanel({
  selectedLayoutId,
  onSelectLayout,
  onApplyLayout,
  customTemplates = [],
  onCustomTemplatesChange,
  onEnterTemplateMode,
  templateEditMode = false
}) {
  const [customExpanded, setCustomExpanded] = useState(true)
  const templates = customTemplates.length > 0 ? customTemplates : loadCustomTemplates()

  const handleDeleteCustom = (e, id) => {
    e.stopPropagation()
    deleteCustomTemplate(id)
    onCustomTemplatesChange?.()
  }

  return (
    <div className="layouts-panel">
      <div className="layouts-header">
        <span className="layouts-title">Templates</span>
        <p className="layouts-desc">
          Select a template, then write a prompt and press Generate. Or enter Change templates mode to edit and save your own.
        </p>
      </div>

      <button
        type="button"
        className={`layouts-mode-btn ${templateEditMode ? 'active' : ''}`}
        onClick={onEnterTemplateMode}
      >
        {templateEditMode ? 'Exit Change templates mode' : 'Change templates'}
      </button>

      <div className="layouts-section">
        <span className="layouts-section-title">Built-in</span>
        <div className="layouts-grid">
          {LAYOUTS.map((layout) => (
            <button
              key={layout.id}
              type="button"
              className={`layouts-card ${selectedLayoutId === layout.id ? 'selected' : ''}`}
              onClick={() => onSelectLayout?.(layout.id)}
              title={layout.description}
            >
              <div className="layouts-card-preview">
                <LayoutPreview layoutId={layout.id} />
              </div>
              <span className="layouts-card-name">{layout.name}</span>
            </button>
          ))}
        </div>
      </div>

      {templates.length > 0 && (
        <div className="layouts-section">
          <button
            type="button"
            className="layouts-section-title layouts-section-toggle"
            onClick={() => setCustomExpanded(!customExpanded)}
          >
            {customExpanded ? '▼' : '▶'} My templates ({templates.length})
          </button>
          {customExpanded && (
            <div className="layouts-grid">
              {templates.map((t) => (
                <div key={t.id} className="layouts-card-wrapper">
                  <button
                    type="button"
                    className={`layouts-card ${selectedLayoutId === t.id ? 'selected' : ''}`}
                    onClick={() => onSelectLayout?.(t.id)}
                    onDoubleClick={() => onApplyLayout?.(t.id)}
                  >
                    <div className="layouts-card-preview">
                      <LayoutPreview elements={t.elements} />
                    </div>
                    <span className="layouts-card-name">{t.name}</span>
                  </button>
                  <button
                    type="button"
                    className="layouts-card-delete"
                    onClick={(e) => handleDeleteCustom(e, t.id)}
                    title="Delete template"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {onApplyLayout && selectedLayoutId && (
        <p className="layouts-apply-hint">
          Or <button type="button" className="layouts-apply-link" onClick={() => onApplyLayout(selectedLayoutId)}>apply template now</button> without generating.
        </p>
      )}
    </div>
  )
}
