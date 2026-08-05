import { useRef, useState } from 'react'
import './StyleGrid.css'

export default function StyleGrid({ styles, selectedId, onSelect, onAddCustomStyle, onDeleteCustomStyle, onUploadImageStyle, onDeleteImageStyle }) {
  const [formOpen, setFormOpen] = useState(false)
  const [name, setName] = useState('')
  const [prompt, setPrompt] = useState('')
  const fileInputRef = useRef(null)

  const handleSave = (e) => {
    e.preventDefault()
    if (!prompt.trim()) return
    onAddCustomStyle({ name, prompt })
    setName('')
    setPrompt('')
    setFormOpen(false)
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file) onUploadImageStyle(file)
    e.target.value = ''
  }

  const handleDelete = (style) => {
    if (style.type === 'image') onDeleteImageStyle(style.id)
    else onDeleteCustomStyle(style.id)
  }

  return (
    <div className="style-grid-section side-panel">
      <div className="side-panel-header">Style</div>
      <div className="side-panel-body">
      <div className="style-grid">
        {styles.map((style) => (
          <div key={style.id} className="style-card-wrap">
            <button
              type="button"
              className={`style-card ${selectedId === style.id ? 'active' : ''} ${style.type === 'image' ? 'style-card-image' : ''}`}
              onClick={() => onSelect(style.id)}
              aria-pressed={selectedId === style.id}
              title={style.type === 'image' ? `${style.name} (image reference)` : style.prompt}
            >
              {style.type === 'image' ? (
                <img className="style-card-thumb" src={style.thumbnailDataUrl} alt={style.name} />
              ) : (
                <span className="style-card-emoji">{style.emoji}</span>
              )}
              <span className="style-card-name">{style.name}</span>
            </button>
            {(style.custom || style.type === 'image') && (
              <button
                type="button"
                className="style-card-delete"
                onClick={() => handleDelete(style)}
                aria-label={`Delete ${style.name}`}
                title="Delete style"
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
        <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleFileChange} />
        <button type="button" className="style-card style-card-add" onClick={() => fileInputRef.current?.click()}>
          <span className="style-card-emoji">🖼️</span>
          <span className="style-card-name">Upload image</span>
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
    </div>
  )
}
