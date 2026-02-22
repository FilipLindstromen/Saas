import { useState, useEffect } from 'react'
import './GenerateInput.css'

export default function GenerateInput({
  onGenerate,
  selectedLayoutId,
  selectedLayoutName,
  templateEditMode = false,
  isCustomTemplate = false,
  onRenameTemplate
}) {
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [editingName, setEditingName] = useState(selectedLayoutName ?? '')

  useEffect(() => {
    setEditingName(selectedLayoutName ?? '')
  }, [selectedLayoutId, selectedLayoutName])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!prompt.trim() || loading) return
    setLoading(true)
    setError(null)
    try {
      await onGenerate(prompt.trim())
      setPrompt('')
    } catch (e) {
      setError(e.message || 'Generation failed')
    } finally {
      setLoading(false)
    }
  }

  const handleNameBlur = () => {
    if (isCustomTemplate && onRenameTemplate && editingName.trim()) {
      onRenameTemplate(editingName.trim())
    }
  }

  const canRename = templateEditMode && isCustomTemplate && onRenameTemplate

  return (
    <form className="generate-input" onSubmit={handleSubmit}>
      {selectedLayoutName != null && (
        canRename ? (
          <label className="generate-selected-template generate-template-name-label">
            Template:{' '}
            <input
              type="text"
              className="generate-template-name-input"
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onBlur={handleNameBlur}
              title="Edit template name"
            />
          </label>
        ) : (
          <span className="generate-selected-template" title="Selected in Layouts tab">
            Template: {selectedLayoutName}
          </span>
        )
      )}
      <input
        type="text"
        placeholder={selectedLayoutId ? 'Describe your content...' : 'Select a template in Layouts, then describe your content...'}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        disabled={loading}
      />
      <button type="submit" disabled={loading || !prompt.trim()}>
        {loading ? 'Generating...' : 'Generate'}
      </button>
      {error && <span className="generate-error">{error}</span>}
    </form>
  )
}
