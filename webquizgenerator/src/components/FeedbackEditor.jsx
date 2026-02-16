import React, { useState, useEffect } from 'react'
import './FeedbackEditor.css'

function FeedbackEditor({ questions, tagLabels, headlines, tagInsights, cta, onUpdate }) {
  const [activeTag, setActiveTag] = useState(null)
  const [newTag, setNewTag] = useState('')
  
  // Extract all unique tags from questions + existing feedback keys
  const allTags = React.useMemo(() => {
    const tags = new Set()
    questions.forEach(q => {
      q.answers.forEach(a => {
        if (a.tag) tags.add(a.tag)
      })
    })
    Object.keys(tagLabels || {}).forEach(t => tags.add(t))
    Object.keys(headlines || {}).forEach(t => tags.add(t))
    Object.keys(tagInsights || {}).forEach(t => tags.add(t))
    Object.keys(cta || {}).forEach(t => tags.add(t))
    return Array.from(tags)
  }, [questions, tagLabels, headlines, tagInsights, cta])

  const updateTagLabel = (tag, value) => {
    onUpdate({
      tagLabels: { ...tagLabels, [tag]: value }
    })
  }

  const updateHeadline = (tag, value) => {
    onUpdate({
      headlines: { ...headlines, [tag]: value }
    })
  }

  const updateInsight = (tag, value) => {
    onUpdate({
      tagInsights: { ...tagInsights, [tag]: value }
    })
  }

  const updateCTA = (tag, value) => {
    onUpdate({
      cta: { ...cta, [tag]: value }
    })
  }

  const updateDefault = (field, value) => {
    if (field === 'tagLabel') {
      onUpdate({ tagLabels: { ...tagLabels, default: value } })
    } else if (field === 'headline') {
      onUpdate({ headlines: { ...headlines, default: value } })
    } else if (field === 'insight') {
      onUpdate({ tagInsights: { ...tagInsights, default: value } })
    } else if (field === 'cta') {
      onUpdate({ cta: { ...cta, default: value } })
    }
  }

  const addTag = () => {
    const tag = newTag.trim()
    if (!tag) return
    if (allTags.includes(tag)) {
      setActiveTag(tag)
      setNewTag('')
      return
    }
    onUpdate({
      tagLabels: { ...tagLabels, [tag]: '' },
      headlines: { ...headlines, [tag]: '' },
      tagInsights: { ...tagInsights, [tag]: '' },
      cta: { ...cta, [tag]: '' }
    })
    setActiveTag(tag)
    setNewTag('')
  }

  const removeTag = (tag) => {
    const { [tag]: _l, ...restLabels } = tagLabels
    const { [tag]: _h, ...restHeadlines } = headlines
    const { [tag]: _i, ...restInsights } = tagInsights
    const { [tag]: _c, ...restCta } = cta
    onUpdate({
      tagLabels: restLabels,
      headlines: restHeadlines,
      tagInsights: restInsights,
      cta: restCta
    })
    if (activeTag === tag) setActiveTag(null)
  }

  return (
    <div className="feedback-editor">
      <h2>Feedback Configuration</h2>
      <p className="section-description">
        Configure personalized feedback for each answer tag. The feedback system uses tags to provide
        relevant insights based on user answers.
      </p>

      <div className="default-feedback">
        <h3>Default Feedback</h3>
        <p className="sub-description">Used when a tag doesn't have specific feedback configured</p>
        
        <div className="form-group">
          <label>Default Tag Label</label>
          <input
            type="text"
            value={tagLabels.default || ''}
            onChange={(e) => updateDefault('tagLabel', e.target.value)}
            placeholder="e.g., the part of anxiety that feels the hardest for you"
            className="form-input"
          />
        </div>

        <div className="form-group">
          <label>Default Headline</label>
          <input
            type="text"
            value={headlines.default || ''}
            onChange={(e) => updateDefault('headline', e.target.value)}
            placeholder="e.g., Your System Is Working Overtime to Protect You"
            className="form-input"
          />
        </div>

        <div className="form-group">
          <label>Default Insight</label>
          <textarea
            value={tagInsights.default || ''}
            onChange={(e) => updateDefault('insight', e.target.value)}
            placeholder="Enter default insight text"
            className="form-textarea"
            rows="6"
          />
        </div>

        <div className="form-group">
          <label>Default CTA</label>
          <input
            type="text"
            value={cta.default || ''}
            onChange={(e) => updateDefault('cta', e.target.value)}
            placeholder="e.g., 👉 Show Me How to Feel Less Anxious Fast"
            className="form-input"
          />
        </div>
      </div>

      <div className="tag-feedback-list">
        <h3>Tag-Specific Feedback</h3>
        <p className="sub-description">Configure feedback for each tag used in your answers</p>
        
        <div className="add-tag-row">
          <input
            type="text"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            placeholder="Add new tag (e.g., resilience)"
            className="form-input"
          />
          <button className="btn-secondary" onClick={addTag}>+ Add Tag</button>
        </div>
        
        {allTags.length === 0 ? (
          <div className="empty-state">
            <p>No tags found. Add tags to your answers to configure feedback.</p>
          </div>
        ) : (
          <div className="tag-list">
            {allTags.map(tag => (
              <div key={tag} className="tag-feedback-card">
                <div className="tag-header" onClick={() => setActiveTag(activeTag === tag ? null : tag)}>
                  <span className="tag-name">{tag}</span>
                  <div className="tag-actions">
                    <span className="tag-toggle">{activeTag === tag ? '−' : '+'}</span>
                    {tag !== 'default' && (
                      <button
                        className="btn-icon small"
                        onClick={(e) => { e.stopPropagation(); removeTag(tag) }}
                        aria-label={`Remove ${tag}`}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
                
                {activeTag === tag && (
                  <div className="tag-content">
                    <div className="form-group">
                      <label>Tag Label</label>
                      <input
                        type="text"
                        value={tagLabels[tag] || ''}
                        onChange={(e) => updateTagLabel(tag, e.target.value)}
                        placeholder="Description of this tag"
                        className="form-input"
                      />
                    </div>

                    <div className="form-group">
                      <label>Headline</label>
                      <input
                        type="text"
                        value={headlines[tag] || ''}
                        onChange={(e) => updateHeadline(tag, e.target.value)}
                        placeholder="Result headline for this tag"
                        className="form-input"
                      />
                    </div>

                    <div className="form-group">
                      <label>Insight</label>
                      <textarea
                        value={tagInsights[tag] || ''}
                        onChange={(e) => updateInsight(tag, e.target.value)}
                        placeholder="Detailed insight text"
                        className="form-textarea"
                        rows="8"
                      />
                    </div>

                    <div className="form-group">
                      <label>CTA Button Text</label>
                      <input
                        type="text"
                        value={cta[tag] || ''}
                        onChange={(e) => updateCTA(tag, e.target.value)}
                        placeholder="Call-to-action button text"
                        className="form-input"
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default FeedbackEditor

