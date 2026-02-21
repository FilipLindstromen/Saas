import { useState } from 'react'
import './GenerateInput.css'

export default function GenerateInput({ onGenerate, selectedLayoutId, selectedLayoutName }) {
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

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

  return (
    <form className="generate-input" onSubmit={handleSubmit}>
      {selectedLayoutName && (
        <span className="generate-selected-template" title="Selected in Layouts tab">
          Template: {selectedLayoutName}
        </span>
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
