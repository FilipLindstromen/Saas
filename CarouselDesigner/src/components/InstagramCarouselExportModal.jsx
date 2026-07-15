import { useEffect, useMemo, useState } from 'react'
import { buildInstagramCaption } from '../utils/exportSlidesAsPng.jsx'
import { getSlidePlainText } from '../utils/slidePlainText'
import './InstagramCarouselExportModal.css'

const CAPTION_LIMIT = 2200
const DRAFT_KEY = 'carouselDesignerInstagramExportDraft'

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function saveDraft(draft) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  } catch (_) {}
}

function normalizeAltTextsById(draft, slides) {
  if (draft?.altTextsById && typeof draft.altTextsById === 'object') {
    return draft.altTextsById
  }
  if (Array.isArray(draft?.altTexts)) {
    const byId = {}
    slides.forEach((slide, i) => {
      if (draft.altTexts[i]) byId[slide.id] = draft.altTexts[i]
    })
    return byId
  }
  return {}
}

function InstagramCarouselExportModal({
  slides,
  projectName,
  onClose,
  onExport,
  isExporting = false,
  exportProgress = '',
}) {
  const [caption, setCaption] = useState('')
  const [hashtags, setHashtags] = useState('')
  const [firstComment, setFirstComment] = useState('')
  const [skipSectionSlides, setSkipSectionSlides] = useState(true)
  const [imageFormat, setImageFormat] = useState('jpeg')
  const [jpegQuality, setJpegQuality] = useState(0.92)
  const [altTextsById, setAltTextsById] = useState({})

  const visibleSlides = useMemo(
    () => slides.filter((s) => !skipSectionSlides || (s.layout || 'default') !== 'section'),
    [slides, skipSectionSlides]
  )

  useEffect(() => {
    const draft = loadDraft()
    if (draft) {
      setCaption(draft.caption || '')
      setHashtags(draft.hashtags || '')
      setFirstComment(draft.firstComment || '')
      setSkipSectionSlides(draft.skipSectionSlides !== false)
      setImageFormat(draft.imageFormat === 'png' ? 'png' : 'jpeg')
      setJpegQuality(typeof draft.jpegQuality === 'number' ? draft.jpegQuality : 0.92)
    }
    setAltTextsById((prev) => {
      const fromDraft = draft ? normalizeAltTextsById(draft, slides) : {}
      const next = { ...fromDraft, ...prev }
      visibleSlides.forEach((slide) => {
        if (next[slide.id] == null) {
          next[slide.id] = getSlidePlainText(slide).slice(0, 120)
        }
      })
      return next
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps -- init draft once on mount
  }, [])

  useEffect(() => {
    setAltTextsById((prev) => {
      const next = { ...prev }
      let changed = false
      visibleSlides.forEach((slide) => {
        if (next[slide.id] == null) {
          next[slide.id] = getSlidePlainText(slide).slice(0, 120)
          changed = true
        }
      })
      return changed ? next : prev
    })
  }, [visibleSlides])

  useEffect(() => {
    saveDraft({
      caption,
      hashtags,
      firstComment,
      skipSectionSlides,
      imageFormat,
      jpegQuality,
      altTextsById,
    })
  }, [caption, hashtags, firstComment, skipSectionSlides, imageFormat, jpegQuality, altTextsById])

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !isExporting) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, isExporting])

  const fullCaption = buildInstagramCaption({ caption, hashtags })
  const captionLength = fullCaption.length
  const slideCount = visibleSlides.length

  const handleAltChange = (slideId, value) => {
    setAltTextsById((prev) => ({ ...prev, [slideId]: value }))
  }

  const handleCopyCaption = async () => {
    try {
      await navigator.clipboard.writeText(fullCaption)
    } catch (err) {
      console.error('Copy failed:', err)
    }
  }

  const handleExport = () => {
    onExport({
      caption,
      hashtags,
      firstComment,
      altTexts: visibleSlides.map((slide) => altTextsById[slide.id] || ''),
      skipSectionSlides,
      imageFormat,
      jpegQuality,
    })
  }

  return (
    <div className="instagram-export-overlay" onClick={onClose}>
      <div className="instagram-export-modal" onClick={(e) => e.stopPropagation()}>
        <div className="instagram-export-header">
          <div>
            <h2>Export Instagram carousel</h2>
            <p className="instagram-export-subtitle">
              {slideCount} image{slideCount === 1 ? '' : 's'} at 1080×1440 px, numbered for upload order.
            </p>
          </div>
          <button type="button" className="instagram-export-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="instagram-export-body">
          <div className="instagram-export-field">
            <label htmlFor="ig-caption">Caption</label>
            <textarea
              id="ig-caption"
              rows={5}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Write the post caption…"
            />
            <div className={`instagram-export-meta${captionLength > CAPTION_LIMIT ? ' over-limit' : ''}`}>
              <span>{captionLength} / {CAPTION_LIMIT} characters</span>
              <button type="button" className="instagram-export-btn" onClick={handleCopyCaption} disabled={!fullCaption.trim()}>
                Copy caption
              </button>
            </div>
          </div>

          <div className="instagram-export-field">
            <label htmlFor="ig-hashtags">Hashtags</label>
            <input
              id="ig-hashtags"
              type="text"
              value={hashtags}
              onChange={(e) => setHashtags(e.target.value)}
              placeholder="#pitchdeck #content #carousel"
            />
          </div>

          <div className="instagram-export-field">
            <label htmlFor="ig-first-comment">First comment (optional)</label>
            <textarea
              id="ig-first-comment"
              rows={2}
              value={firstComment}
              onChange={(e) => setFirstComment(e.target.value)}
              placeholder="Link, CTA, or extra hashtags…"
            />
          </div>

          <div className="instagram-export-row">
            <div className="instagram-export-field">
              <label htmlFor="ig-format">Image format</label>
              <select
                id="ig-format"
                className="instagram-export-select"
                value={imageFormat}
                onChange={(e) => setImageFormat(e.target.value)}
              >
                <option value="jpeg">JPEG (recommended)</option>
                <option value="png">PNG</option>
              </select>
            </div>
            {imageFormat === 'jpeg' && (
              <div className="instagram-export-field">
                <label htmlFor="ig-quality">JPEG quality ({Math.round(jpegQuality * 100)}%)</label>
                <input
                  id="ig-quality"
                  type="range"
                  className="instagram-export-range"
                  min="0.75"
                  max="1"
                  step="0.01"
                  value={jpegQuality}
                  onChange={(e) => setJpegQuality(parseFloat(e.target.value))}
                />
              </div>
            )}
          </div>

          <label className="instagram-export-checkbox">
            <input
              type="checkbox"
              checked={skipSectionSlides}
              onChange={(e) => setSkipSectionSlides(e.target.checked)}
            />
            <span>Skip section divider slides</span>
          </label>

          <div className="instagram-export-field">
            <label>Alt text per slide</label>
            <div className="instagram-export-alt-list">
              {visibleSlides.map((slide, i) => (
                <div key={slide.id ?? i} className="instagram-export-alt-item">
                  <label htmlFor={`ig-alt-${slide.id}`}>Slide {i + 1}</label>
                  <input
                    id={`ig-alt-${slide.id}`}
                    type="text"
                    value={altTextsById[slide.id] || ''}
                    onChange={(e) => handleAltChange(slide.id, e.target.value)}
                    placeholder={getSlidePlainText(slide).slice(0, 80) || 'Describe this slide…'}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {isExporting && exportProgress && (
          <div className="instagram-export-progress">{exportProgress}</div>
        )}

        <div className="instagram-export-footer">
          <button type="button" className="instagram-export-btn" onClick={onClose} disabled={isExporting}>
            Cancel
          </button>
          <button
            type="button"
            className="instagram-export-btn instagram-export-btn-primary"
            onClick={handleExport}
            disabled={isExporting || slideCount === 0 || captionLength > CAPTION_LIMIT}
          >
            {isExporting ? 'Exporting…' : 'Download carousel ZIP'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default InstagramCarouselExportModal
