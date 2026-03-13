import React, { useState } from 'react'
import './ResultConfigEditor.css'

function ResultConfigEditor({
  responseModel,
  percentageTiers = [],
  categories = [],
  categoryHybridThreshold = 2,
  attributeLabels = [],
  profileConfig = {},
  onUpdate
}) {
  const [expandedTier, setExpandedTier] = useState(null)

  // Percentage tiers
  const updateTier = (index, field, value) => {
    const next = [...(percentageTiers || [])]
    if (!next[index]) next[index] = { min: 0, max: 40, level: '', title: '', message: '', suggestion: '', nextStep: '' }
    next[index] = { ...next[index], [field]: value }
    onUpdate({ percentageTiers: next })
  }

  const addTier = () => {
    const next = [...(percentageTiers || [])]
    const last = next[next.length - 1]
    const max = last ? (last.max || 40) + 1 : 0
    next.push({
      min: max,
      max: Math.min(max + 34, 100),
      level: '',
      title: '',
      message: '',
      suggestion: '',
      nextStep: ''
    })
    onUpdate({ percentageTiers: next })
  }

  const removeTier = (index) => {
    const next = percentageTiers.filter((_, i) => i !== index)
    onUpdate({ percentageTiers: next })
  }

  // Categories
  const updateCategory = (index, field, value) => {
    const next = [...(categories || [])]
    if (!next[index]) next[index] = { id: '', name: '', description: '', strengths: [], recommendation: '' }
    if (field === 'strengths') {
      const arr = typeof value === 'string' ? value.split(',').map(s => s.trim()).filter(Boolean) : value
      next[index] = { ...next[index], strengths: arr }
    } else {
      next[index] = { ...next[index], [field]: value }
      if (field === 'name' && !next[index].id) next[index].id = value
    }
    onUpdate({ categories: next })
  }

  const addCategory = () => {
    const next = [...(categories || []), { id: `cat_${Date.now()}`, name: '', description: '', strengths: [], recommendation: '' }]
    onUpdate({ categories: next })
  }

  const removeCategory = (index) => {
    const next = categories.filter((_, i) => i !== index)
    onUpdate({ categories: next })
  }

  // Attribute labels (profile)
  const updateAttributeLabel = (index, field, value) => {
    const next = [...(attributeLabels || [])]
    if (!next[index]) next[index] = { key: '', label: '' }
    next[index] = { ...next[index], [field]: value }
    if (field === 'key' && !next[index].label) next[index].label = value
    onUpdate({ attributeLabels: next })
  }

  const addAttribute = () => {
    const next = [...(attributeLabels || []), { key: `attr_${Date.now()}`, label: '' }]
    onUpdate({ attributeLabels: next })
  }

  const removeAttribute = (index) => {
    const next = attributeLabels.filter((_, i) => i !== index)
    onUpdate({ attributeLabels: next })
  }

  if (responseModel === 'percentage') {
    return (
      <div className="result-config-editor">
        <h3>Percentage result tiers</h3>
        <p className="section-description">Define feedback tiers by score range (0–40%, 41–75%, 76–100%).</p>
        {(percentageTiers || []).map((tier, i) => (
          <div key={i} className="result-config-card">
            <div className="result-config-card-header" onClick={() => setExpandedTier(expandedTier === i ? null : i)}>
              <span>{tier.min ?? 0}–{tier.max ?? 100}% → {tier.level || 'Tier ' + (i + 1)}</span>
              <button type="button" className="btn-icon small" onClick={(e) => { e.stopPropagation(); removeTier(i) }}>×</button>
            </div>
            {expandedTier === i && (
              <div className="result-config-card-body">
                <div className="form-group">
                  <label>Level name</label>
                  <input value={tier.level || ''} onChange={(e) => updateTier(i, 'level', e.target.value)} placeholder="e.g. Beginner" className="form-input" />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Min %</label>
                    <input type="number" min={0} max={100} value={tier.min ?? ''} onChange={(e) => updateTier(i, 'min', Number(e.target.value))} className="form-input" />
                  </div>
                  <div className="form-group">
                    <label>Max %</label>
                    <input type="number" min={0} max={100} value={tier.max ?? ''} onChange={(e) => updateTier(i, 'max', Number(e.target.value))} className="form-input" />
                  </div>
                </div>
                <div className="form-group">
                  <label>Title</label>
                  <input value={tier.title || ''} onChange={(e) => updateTier(i, 'title', e.target.value)} placeholder="Result title" className="form-input" />
                </div>
                <div className="form-group">
                  <label>Message</label>
                  <input value={tier.message || ''} onChange={(e) => updateTier(i, 'message', e.target.value)} placeholder="Short explanation" className="form-input" />
                </div>
                <div className="form-group">
                  <label>Suggestion</label>
                  <input value={tier.suggestion || ''} onChange={(e) => updateTier(i, 'suggestion', e.target.value)} placeholder="Personalized suggestion" className="form-input" />
                </div>
                <div className="form-group">
                  <label>Next step (optional)</label>
                  <input value={tier.nextStep || ''} onChange={(e) => updateTier(i, 'nextStep', e.target.value)} placeholder="Optional next step" className="form-input" />
                </div>
              </div>
            )}
          </div>
        ))}
        <button type="button" className="btn-secondary" onClick={addTier}>+ Add tier</button>
      </div>
    )
  }

  if (responseModel === 'category') {
    return (
      <div className="result-config-editor">
        <h3>Category result config</h3>
        <p className="section-description">Each answer can add points to a category. Configure description, strengths, and recommendation per category.</p>
        <div className="form-group">
          <label>Hybrid threshold (points)</label>
          <input type="number" min={0} value={categoryHybridThreshold ?? 2} onChange={(e) => onUpdate({ categoryHybridThreshold: Number(e.target.value) })} className="form-input" placeholder="2" />
          <small>If second place is within this many points, show a hybrid result.</small>
        </div>
        {(categories || []).map((cat, i) => (
          <div key={i} className="result-config-card">
            <div className="result-config-card-header">
              <span>{cat.name || cat.id || 'Category ' + (i + 1)}</span>
              <button type="button" className="btn-icon small" onClick={() => removeCategory(i)}>×</button>
            </div>
            <div className="result-config-card-body">
              <div className="form-group">
                <label>ID (used in answers)</label>
                <input value={cat.id || ''} onChange={(e) => updateCategory(i, 'id', e.target.value)} placeholder="e.g. Creator" className="form-input" />
              </div>
              <div className="form-group">
                <label>Name</label>
                <input value={cat.name || ''} onChange={(e) => updateCategory(i, 'name', e.target.value)} placeholder="Display name" className="form-input" />
              </div>
              <div className="form-group">
                <label>Description</label>
                <input value={cat.description || ''} onChange={(e) => updateCategory(i, 'description', e.target.value)} placeholder="e.g. You think in systems and long-term planning." className="form-input" />
              </div>
              <div className="form-group">
                <label>Strengths (comma-separated)</label>
                <input value={Array.isArray(cat.strengths) ? cat.strengths.join(', ') : ''} onChange={(e) => updateCategory(i, 'strengths', e.target.value)} placeholder="planning, analysis, optimization" className="form-input" />
              </div>
              <div className="form-group">
                <label>Recommendation</label>
                <input value={cat.recommendation || ''} onChange={(e) => updateCategory(i, 'recommendation', e.target.value)} placeholder="Focus on building execution speed..." className="form-input" />
              </div>
            </div>
          </div>
        ))}
        <button type="button" className="btn-secondary" onClick={addCategory}>+ Add category</button>
      </div>
    )
  }

  if (responseModel === 'profile') {
    return (
      <div className="result-config-editor">
        <h3>Profile result config</h3>
        <p className="section-description">Answers update attribute scores. Result shows strongest/weakest trait, summary, and recommendation.</p>
        <div className="form-group">
          <label>Default summary template</label>
          <textarea value={profileConfig.summary || ''} onChange={(e) => onUpdate({ profileConfig: { ...profileConfig, summary: e.target.value } })} placeholder="Optional default summary text" className="form-textarea" rows={2} />
        </div>
        <div className="form-group">
          <label>Default recommendation</label>
          <input value={profileConfig.recommendation || ''} onChange={(e) => onUpdate({ profileConfig: { ...profileConfig, recommendation: e.target.value } })} placeholder="e.g. Spend time strengthening foundational concepts." className="form-input" />
        </div>
        <h4>Attribute labels</h4>
        <p className="section-description">Define attributes that answers can affect (e.g. experience, confidence). Use the same keys in each answer’s attribute weights.</p>
        {(attributeLabels || []).map((attr, i) => (
          <div key={i} className="result-config-card inline">
            <input value={attr.key || ''} onChange={(e) => updateAttributeLabel(i, 'key', e.target.value)} placeholder="key" className="form-input" />
            <input value={attr.label || ''} onChange={(e) => updateAttributeLabel(i, 'label', e.target.value)} placeholder="Label" className="form-input" />
            <button type="button" className="btn-icon small" onClick={() => removeAttribute(i)}>×</button>
          </div>
        ))}
        <button type="button" className="btn-secondary" onClick={addAttribute}>+ Add attribute</button>
      </div>
    )
  }

  return null
}

export default ResultConfigEditor
