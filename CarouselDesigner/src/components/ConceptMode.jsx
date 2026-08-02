import { useEffect, useState } from 'react'
import { getApiKey } from '@shared/apiKeys'
import { CAROUSEL_TEMPLATES } from '../carousel/constants'
import { generateCarouselIdeas, generateCarouselVariants } from '../services/carouselAi'
import SlideRoleBadge from './SlideRoleBadge'
import './ConceptMode.css'

const STORAGE_INSTRUCTIONS = 'carouselDesignerConceptInstructions'
const STORAGE_IDEAS = 'carouselDesignerConceptIdeas'
const STORAGE_TEMPLATE = 'carouselDesignerConceptTemplate'
const STORAGE_VARIANTS = 'carouselDesignerConceptVariants'

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function normalizeIdeaCopy(item) {
  if (!item) return ''
  if (item.copy?.trim()) return item.copy.trim()
  return [item.headline, item.body].filter((s) => s?.trim()).join('\n\n').trim()
}

function migrateIdea(item) {
  return { ...item, copy: normalizeIdeaCopy(item) }
}

export default function ConceptMode({
  onApplyToPlan,
  onApplyVariantToPlan,
  slides = [],
}) {
  const [instructions, setInstructions] = useState(() => localStorage.getItem(STORAGE_INSTRUCTIONS) || '')
  const [topic, setTopic] = useState('')
  const [ideas, setIdeas] = useState(() => loadJson(STORAGE_IDEAS, []).map(migrateIdea))
  const [variants, setVariants] = useState(() => loadJson(STORAGE_VARIANTS, []))
  const [selectedTemplate, setSelectedTemplate] = useState(() => localStorage.getItem(STORAGE_TEMPLATE) || 'hookTipsCta')
  const [slideCount, setSlideCount] = useState(6)
  const [loading, setLoading] = useState(false)
  const [variantLoading, setVariantLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('ideas')

  const openaiKey = getApiKey('openai')?.trim()
  const template = CAROUSEL_TEMPLATES[selectedTemplate]

  useEffect(() => {
    localStorage.setItem(STORAGE_INSTRUCTIONS, instructions)
  }, [instructions])

  useEffect(() => {
    localStorage.setItem(STORAGE_IDEAS, JSON.stringify(ideas))
  }, [ideas])

  useEffect(() => {
    localStorage.setItem(STORAGE_VARIANTS, JSON.stringify(variants))
  }, [variants])

  useEffect(() => {
    localStorage.setItem(STORAGE_TEMPLATE, selectedTemplate)
    if (template?.slideCount) setSlideCount(template.slideCount)
  }, [selectedTemplate, template?.slideCount])

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
      const count = template?.slideCount || slideCount
      const generated = await generateCarouselIdeas({
        instructions,
        topic,
        slideCount: count,
        templateHint: template ? `${template.name}: ${template.promptHint}. Roles: ${template.roles?.join(', ')}` : '',
        psychologyMode: true,
      })
      setIdeas(generated)
      setActiveTab('ideas')
    } catch (err) {
      setError(err?.message || 'Failed to generate ideas')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateVariants = async () => {
    if (!openaiKey) {
      setError('Add your OpenAI API key on the SaaS Apps screen.')
      return
    }
    if (!topic.trim() && !instructions.trim()) {
      setError('Enter a topic or instructions first.')
      return
    }

    setVariantLoading(true)
    setError('')
    try {
      const count = template?.slideCount || slideCount
      const result = await generateCarouselVariants({
        instructions,
        topic,
        slideCount: count,
        variantCount: 3,
      })
      setVariants(result.map((v, i) => ({
        ...v,
        id: v.id || `variant-${Date.now()}-${i}`,
        label: v.label || String.fromCharCode(65 + i),
      })))
      setActiveTab('variants')
    } catch (err) {
      setError(err?.message || 'Failed to generate variants')
    } finally {
      setVariantLoading(false)
    }
  }

  const handleApply = () => {
    if (!ideas.length) return
    onApplyToPlan?.(ideas)
  }

  const handleApplyVariant = (variant) => {
    const slidesFromVariant = (variant.slides || []).map((s, i) => ({
      id: `idea-${Date.now()}-${i}`,
      copy: normalizeIdeaCopy(s) || String(s.copy || '').trim(),
      role: s.role || template?.roles?.[i] || null,
    })).filter((s) => s.copy?.trim())

    if (onApplyVariantToPlan) {
      onApplyVariantToPlan(slidesFromVariant, variant.label)
    } else {
      onApplyToPlan?.(slidesFromVariant)
    }
  }

  const updateIdea = (id, patch) => {
    setIdeas((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  const removeIdea = (id) => {
    setIdeas((prev) => prev.filter((item) => item.id !== id))
  }

  const addIdea = () => {
    setIdeas((prev) => [...prev, { id: `idea-${Date.now()}`, copy: '', role: 'value' }])
  }

  const ideasWithCopy = ideas.filter((i) => normalizeIdeaCopy(i))

  return (
    <div className="concept-mode">
      <div className="concept-mode-intro">
        <h2>Concept</h2>
        <p>Pick a carousel structure, generate psychology-tuned copy and A/B variants, then send to Plan — one idea per image.</p>
      </div>

      <div className="concept-mode-grid">
        <section className="concept-panel">
          <label className="concept-label" htmlFor="concept-template">Carousel structure</label>
          <select
            id="concept-template"
            className="concept-input"
            value={selectedTemplate}
            onChange={(e) => setSelectedTemplate(e.target.value)}
          >
            {Object.entries(CAROUSEL_TEMPLATES).map(([key, t]) => (
              <option key={key} value={key}>{t.name} — {t.description}</option>
            ))}
          </select>
          {template && (
            <p className="concept-hint">{template.promptHint}</p>
          )}

          <label className="concept-label" htmlFor="concept-slide-count">Slide count</label>
          <input
            id="concept-slide-count"
            type="number"
            min={3}
            max={10}
            className="concept-input"
            value={slideCount}
            onChange={(e) => setSlideCount(Math.max(3, Math.min(10, parseInt(e.target.value, 10) || 5)))}
          />

          <label className="concept-label" htmlFor="concept-instructions">Instructions</label>
          <textarea
            id="concept-instructions"
            className="concept-textarea"
            rows={4}
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

          <div className="concept-action-row">
            <button
              type="button"
              className="concept-btn concept-btn-primary"
              onClick={handleGenerate}
              disabled={loading || variantLoading || !openaiKey}
            >
              {loading ? 'Generating…' : 'Generate carousel copy'}
            </button>
            <button
              type="button"
              className="concept-btn concept-btn-secondary"
              onClick={handleGenerateVariants}
              disabled={loading || variantLoading || !openaiKey}
            >
              {variantLoading ? 'Generating…' : 'Generate 3 A/B variants'}
            </button>
          </div>
          {!openaiKey && (
            <p className="concept-hint">Add your OpenAI API key on the SaaS Apps home screen.</p>
          )}
        </section>

        <section className="concept-panel concept-ideas-panel">
          <div className="concept-tabs">
            <button type="button" className={activeTab === 'ideas' ? 'active' : ''} onClick={() => setActiveTab('ideas')}>
              Slides ({ideas.length})
            </button>
            <button type="button" className={activeTab === 'variants' ? 'active' : ''} onClick={() => setActiveTab('variants')}>
              Variants ({variants.length})
            </button>
          </div>

          {activeTab === 'ideas' ? (
            <>
              <div className="concept-ideas-header">
                <h3>Slide ideas</h3>
                <button type="button" className="concept-btn concept-btn-ghost" onClick={addIdea}>+ Add slide</button>
              </div>

              {ideas.length === 0 ? (
                <p className="concept-empty">Generated slides appear here with role labels (Hook, Tip, CTA…).</p>
              ) : (
                <ul className="concept-ideas-list">
                  {ideas.map((idea, index) => (
                    <li key={idea.id} className="concept-idea-card">
                      <span className="concept-idea-index">{index + 1}</span>
                      <div className="concept-idea-fields">
                        <div className="concept-idea-role-row">
                          <SlideRoleBadge
                            role={idea.role}
                            editable
                            onChange={(role) => updateIdea(idea.id, { role })}
                          />
                        </div>
                        <textarea
                          className="concept-textarea concept-textarea-sm"
                          rows={4}
                          value={idea.copy ?? normalizeIdeaCopy(idea)}
                          onChange={(e) => updateIdea(idea.id, { copy: e.target.value })}
                          placeholder="Slide copy — same field as in Edit mode"
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
                disabled={!ideasWithCopy.length}
              >
                Use in Plan →
              </button>
            </>
          ) : (
            <>
              {variants.length === 0 ? (
                <p className="concept-empty">Generate 3 A/B variants to compare different hooks and CTAs side by side.</p>
              ) : (
                <div className="concept-variants-grid">
                  {variants.map((variant) => (
                    <div key={variant.id} className="concept-variant-card">
                      <div className="concept-variant-header">
                        <strong>Variant {variant.label}</strong>
                        {variant.hookAngle && <span className="concept-variant-angle">{variant.hookAngle}</span>}
                      </div>
                      <ol className="concept-variant-slides">
                        {(variant.slides || []).slice(0, 6).map((s, i) => (
                          <li key={i}>
                            {s.role && <SlideRoleBadge role={s.role} />}
                            <span>{normalizeIdeaCopy(s) || s.headline || s.title}</span>
                          </li>
                        ))}
                        {(variant.slides || []).length > 6 && (
                          <li className="concept-variant-more">+{(variant.slides || []).length - 6} more</li>
                        )}
                      </ol>
                      <button
                        type="button"
                        className="concept-btn concept-btn-primary concept-btn-sm"
                        onClick={() => handleApplyVariant(variant)}
                      >
                        Use variant {variant.label} in Plan
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {slides.length > 0 && ideas.length > 0 && activeTab === 'ideas' && (
            <p className="concept-hint">
              Current carousel has {slides.length} slide{slides.length === 1 ? '' : 's'}. Applying replaces them with {ideasWithCopy.length} slides.
            </p>
          )}
        </section>
      </div>
    </div>
  )
}
