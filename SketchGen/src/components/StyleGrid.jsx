import { useState } from 'react'
import './StyleGrid.css'

export default function StyleGrid({ styles, selectedId, onSelect, onAddCustomStyle, onDeleteCustomStyle }) {
  const [formOpen, setFormOpen] = useState(false)
  const [name, setName] = useState('')
  const [prompt, setPrompt] = useState('')

  const handleSave = (e) => {
    e.preventDefault()
    if (!prompt.trim()) return
    onAddCustomStyle({ name, prompt })
    setName('')
    setPrompt('')
    setFormOpen(false)
  }

  return (
    <div className="style-grid-section">
      <h3 className="style-grid-title">Style</h3>
      <div className="style-grid">
        {styles.map((style) => (
          <div key={style.id} className="style-card-wrap">
            <button
              type="button"
              className={`style-card ${selectedId === style.id ? 'active' : ''}`}
              onClick={() => onSelect(style.id)}
              aria-pressed={selectedId === style.id}
              title={style.prompt}
            >
              <span className="style-card-emoji">{style.emoji}</span>
              <span className="style-card-name">{style.name}</span>
            </button>
            {style.custom && (
              <button
                type="button"
                className="style-card-delete"
                onClick={() => onDeleteCustomStyle(style.id)}
                aria-label={`Delete ${style.name}`}
                title="Delete custom style"
              >
                ×
              </button>
            )}
          </div>
        ))}
        <button type="button" className="style-card style-card-add" onClick={() => setFormOpen((v) => !v)}>
          <span className="style-card-emoji">➕</span>
          <span className="style-card-name">Custom</span>
        </button>
      </div>

      {formOpen && (
        <form className="style-custom-form" onSubmit={handleSave}>
          <input
            type="text"
            placeholder="Style name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <textarea
            placeholder="Describe the style, e.g. 'a gritty noir ink illustration with heavy shadows'"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={2}
          />
          <div className="style-custom-form-actions">
            <button type="button" onClick={() => setFormOpen(false)}>Cancel</button>
            <button type="submit" disabled={!prompt.trim()}>Save style</button>
          </div>
        </form>
      )}
    </div>
  )
}
