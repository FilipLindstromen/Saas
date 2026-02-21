import { useState } from 'react'
import './GenerateInput.css'

export default function GenerateInput({ onGenerate }) {
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
      <input
        type="text"
        placeholder='e.g. "5-step process of how the stress response works in hand drawn style"'
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
