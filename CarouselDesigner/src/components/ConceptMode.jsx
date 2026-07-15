import { useEffect, useState } from 'react'
import { getApiKey } from '@shared/apiKeys'
import './ConceptMode.css'

const STORAGE_INSTRUCTIONS = 'carouselDesignerConceptInstructions'
const STORAGE_IDEAS = 'carouselDesignerConceptIdeas'

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function plainTextFromHtml(html) {
  if (!html) return ''
  return String(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .trim()
}

export default function ConceptMode({
  onApplyToPlan,
  slides = [],
}) {
  const [instructions, setInstructions] = useState(() => localStorage.getItem(STORAGE_INSTRUCTIONS) || '')
  const [topic, setTopic] = useState('')
  const [ideas, setIdeas] = useState(() => loadJson(STORAGE_IDEAS, []))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const openaiKey = getApiKey('openai')?.trim()

  useEffect(() => {
    localStorage.setItem(STORAGE_INSTRUCTIONS, instructions)
  }, [instructions])

  useEffect(() => {
    localStorage.setItem(STORAGE_IDEAS, JSON.stringify(ideas))
  }, [ideas])

  const handleGenerate = async () => {
    if (!openaiKey) {
      setError('Add your OpenAI API key on the SaaS Apps screen.')
      return
    }
    if (!topic.trim() && !instructions.trim()) {
      setError('Enter a topic or instructions first.')
      return
    }

    setLoading(true)
    setError('')
    try {
      const slideCount = Math.max(3, Math.min(10, slides.length || 5))
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `You generate Instagram carousel slide ideas. Each slide is one 1080×1440 image with a short headline and optional supporting line. Return ONLY valid JSON: an array of ${slideCount} objects with "headline" and "body" (body can be empty). Keep headlines punchy (under 12 words). Match the user's brand voice and instructions.`,
            },
            {
              role: 'user',
              content: [
                instructions.trim() && `Instructions:\n${instructions.trim()}`,
                topic.trim() && `Topic:\n${topic.trim()}`,
                `Generate ${slideCount} carousel slide ideas.`,
              ].filter(Boolean).join('\n\n'),
            },
          ],
          temperature: 0.8,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error?.message || 'OpenAI request failed')
      }

      const text = data.choices?.[0]?.message?.content || ''
      const jsonMatch = text.match(/\[[\s\S]*\]/)
      if (!jsonMatch) throw new Error('Could not parse AI response')

      const parsed = JSON.parse(jsonMatch[0])
      if (!Array.isArray(parsed) || !parsed.length) throw new Error('No ideas returned')

      setIdeas(parsed.map((item, i) => ({
        id: `idea-${Date.now()}-${i}`,
        headline: String(item.headline || item.title || '').trim(),
        body: String(item.body || item.copy || item.subtitle || '').trim(),
      })).filter((item) => item.headline))
    } catch (err) {
      setError(err?.message || 'Failed to generate ideas')
    } finally {
      setLoading(false)
    }
  }

  const handleApply = () => {
    if (!ideas.length) return
    onApplyToPlan?.(ideas)
  }

  const updateIdea = (id, patch) => {
    setIdeas((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  const removeIdea = (id) => {
    setIdeas((prev) => prev.filter((item) => item.id !== id))
  }

  const addIdea = () => {
    setIdeas((prev) => [...prev, { id: `idea-${Date.now()}`, headline: '', body: '' }])
  }

  return (
    <div className="concept-mode">
      <div className="concept-mode-intro">
        <h2>Concept</h2>
        <p>Define your carousel direction, generate slide ideas with AI, then send them to Plan — one idea becomes one carousel image.</p>
      </div>

      <div className="concept-mode-grid">
        <section className="concept-panel">
          <label className="concept-label" htmlFor="concept-instructions">Instructions</label>
          <textarea
            id="concept-instructions"
            className="concept-textarea"
            rows={5}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Brand voice, audience, offer, tone, things to avoid…"
          />

          <label className="concept-label" htmlFor="concept-topic">Topic or hook</label>
          <input
            id="concept-topic"
            type="text"
            className="concept-input"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. 5 mistakes founders make with paid ads"
          />

          {error && <p className="concept-error">{error}</p>}

          <button
            type="button"
            className="concept-btn concept-btn-primary"
            onClick={handleGenerate}
            disabled={loading || !openaiKey}
          >
            {loading ? 'Generating…' : 'Generate carousel ideas'}
          </button>
          {!openaiKey && (
            <p className="concept-hint">Add your OpenAI API key on the SaaS Apps home screen.</p>
          )}
        </section>

        <section className="concept-panel concept-ideas-panel">
          <div className="concept-ideas-header">
            <h3>Slide ideas</h3>
            <button type="button" className="concept-btn concept-btn-ghost" onClick={addIdea}>+ Add slide</button>
          </div>

          {ideas.length === 0 ? (
            <p className="concept-empty">Generated ideas appear here. Each row becomes one carousel image in Plan.</p>
          ) : (
            <ul className="concept-ideas-list">
              {ideas.map((idea, index) => (
                <li key={idea.id} className="concept-idea-card">
                  <span className="concept-idea-index">{index + 1}</span>
                  <div className="concept-idea-fields">
                    <input
                      type="text"
                      className="concept-input"
                      value={idea.headline}
                      onChange={(e) => updateIdea(idea.id, { headline: e.target.value })}
                      placeholder="Headline"
                    />
                    <textarea
                      className="concept-textarea concept-textarea-sm"
                      rows={2}
                      value={idea.body}
                      onChange={(e) => updateIdea(idea.id, { body: e.target.value })}
                      placeholder="Supporting line (optional)"
                    />
                  </div>
                  <button type="button" className="concept-remove" onClick={() => removeIdea(idea.id)} aria-label="Remove">×</button>
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            className="concept-btn concept-btn-primary"
            onClick={handleApply}
            disabled={!ideas.some((i) => i.headline?.trim())}
          >
            Use in Plan →
          </button>

          {slides.length > 0 && ideas.length > 0 && (
            <p className="concept-hint">
              Current carousel has {slides.length} slide{slides.length === 1 ? '' : 's'}. Applying will replace them with {ideas.filter((i) => i.headline?.trim()).length} slides from your ideas.
            </p>
          )}
        </section>
      </div>
    </div>
  )
}

export { plainTextFromHtml }
