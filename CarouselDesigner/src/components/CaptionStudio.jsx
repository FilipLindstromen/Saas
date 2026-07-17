import { useEffect, useState } from 'react'
import { generateCarouselCaption } from '../services/carouselAi'
import { buildInstagramCaption } from '../utils/exportSlidesAsPng'
import { CAROUSEL_LIMITS } from '../carousel/constants'
import './CaptionStudio.css'

const STORAGE_KEY = 'carouselDesignerCaption'

function loadCaption() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : { caption: '', hashtags: '', firstComment: '' }
  } catch {
    return { caption: '', hashtags: '', firstComment: '' }
  }
}

export default function CaptionStudio({
  slides = [],
  instructions = '',
  caption,
  hashtags,
  firstComment,
  onUpdate,
  compact = false,
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (caption === undefined) {
      const saved = loadCaption()
      onUpdate?.(saved)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (caption !== undefined) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ caption, hashtags, firstComment }))
    }
  }, [caption, hashtags, firstComment])

  const fullCaption = buildInstagramCaption({ caption, hashtags })
  const overLimit = fullCaption.length > CAROUSEL_LIMITS.captionChars

  const handleGenerate = async () => {
    setLoading(true)
    setError('')
    try {
      const result = await generateCarouselCaption({
        slides,
        instructions,
        platform: 'instagram',
      })
      onUpdate?.({
        caption: result.caption || '',
        hashtags: result.hashtags || '',
        firstComment: result.firstComment || firstComment || '',
      })
    } catch (err) {
      setError(err?.message || 'Caption generation failed')
    } finally {
      setLoading(false)
    }
  }

  const copyCaption = async () => {
    try {
      await navigator.clipboard.writeText(fullCaption)
    } catch {
      /* ignore */
    }
  }

  return (
    <div className={`caption-studio ${compact ? 'caption-studio-compact' : ''}`}>
      <div className="caption-studio-header">
        <h3>Caption</h3>
        {!compact && <p>AI-generated post caption for Instagram, LinkedIn, and TikTok.</p>}
      </div>

      <div className="caption-studio-actions">
        <button type="button" className="caption-btn caption-btn-primary" onClick={handleGenerate} disabled={loading}>
          {loading ? 'Generating…' : 'Generate caption with AI'}
        </button>
        <button type="button" className="caption-btn" onClick={copyCaption} disabled={!fullCaption.trim()}>
          Copy caption
        </button>
      </div>

      {error && <p className="caption-error">{error}</p>}

      <label className="caption-label" htmlFor="caption-text">Post caption</label>
      <textarea
        id="caption-text"
        className="caption-textarea"
        rows={compact ? 4 : 6}
        value={caption || ''}
        onChange={(e) => onUpdate?.({ caption: e.target.value, hashtags, firstComment })}
        placeholder="Write or generate your carousel caption…"
      />

      <label className="caption-label" htmlFor="caption-hashtags">Hashtags</label>
      <textarea
        id="caption-hashtags"
        className="caption-textarea caption-textarea-sm"
        rows={2}
        value={hashtags || ''}
        onChange={(e) => onUpdate?.({ caption, hashtags: e.target.value, firstComment })}
        placeholder="#marketing #carousel #tips"
      />

      <label className="caption-label" htmlFor="caption-first-comment">First comment (optional)</label>
      <input
        id="caption-first-comment"
        type="text"
        className="caption-input"
        value={firstComment || ''}
        onChange={(e) => onUpdate?.({ caption, hashtags, firstComment: e.target.value })}
        placeholder="Engagement question to post after publishing"
      />

      <div className={`caption-char-count ${overLimit ? 'over' : ''}`}>
        {fullCaption.length} / {CAROUSEL_LIMITS.captionChars} characters
      </div>
    </div>
  )
}
