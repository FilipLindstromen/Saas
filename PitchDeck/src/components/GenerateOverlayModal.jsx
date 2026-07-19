import { useEffect, useMemo, useState } from 'react'
import {
  OVERLAY_STYLE_PRESETS,
  generateOverlayImage,
  getSlideText,
  normalizeOverlayStyleId,
  resolveImageToDataUrl,
} from '../services/backgroundAi'
import './GenerateBackgroundModal.css'

const STORAGE_INSTRUCTIONS = 'pitchDeckOverlayGenInstructions'
const STORAGE_STYLE = 'pitchDeckOverlayGenStyle'
const STORAGE_STYLE_NOTES = 'pitchDeckOverlayGenStyleNotes'
const STORAGE_USE_SLIDE_TEXT = 'pitchDeckOverlayGenUseSlideText'

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function GenerateOverlayModal({
  isOpen,
  onClose,
  onApply,
  slide,
  settings,
}) {
  const slideText = useMemo(() => getSlideText(slide), [slide])
  const [instructions, setInstructions] = useState('')
  const [styleId, setStyleId] = useState('illustration')
  const [styleNotes, setStyleNotes] = useState('')
  const [useSlideText, setUseSlideText] = useState(true)
  const [referenceImage, setReferenceImage] = useState(null)
  const [referenceName, setReferenceName] = useState('')
  const [previewUrl, setPreviewUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    localStorage.setItem(STORAGE_INSTRUCTIONS, instructions)
  }, [instructions])

  useEffect(() => {
    localStorage.setItem(STORAGE_STYLE, styleId)
  }, [styleId])

  useEffect(() => {
    localStorage.setItem(STORAGE_STYLE_NOTES, styleNotes)
  }, [styleNotes])

  useEffect(() => {
    localStorage.setItem(STORAGE_USE_SLIDE_TEXT, String(useSlideText))
  }, [useSlideText])

  useEffect(() => {
    if (!isOpen) return
    setPreviewUrl('')
    setError('')
    setInstructions(localStorage.getItem(STORAGE_INSTRUCTIONS) || '')
    setStyleId(normalizeOverlayStyleId(localStorage.getItem(STORAGE_STYLE) || 'illustration'))
    setStyleNotes(localStorage.getItem(STORAGE_STYLE_NOTES) || '')
    const savedUseSlideText = localStorage.getItem(STORAGE_USE_SLIDE_TEXT)
    setUseSlideText(savedUseSlideText == null ? true : savedUseSlideText === 'true')
    setReferenceImage(null)
    setReferenceName('')
  }, [isOpen])

  if (!isOpen) return null

  const selectedStyle = OVERLAY_STYLE_PRESETS.find((item) => item.id === styleId) || OVERLAY_STYLE_PRESETS[0]
  const hasOpenAiKey = !!settings?.openaiKey?.trim()

  const handleReferenceChange = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.')
      return
    }
    try {
      const dataUrl = await readFileAsDataUrl(file)
      setReferenceImage(dataUrl)
      setReferenceName(file.name)
      setError('')
    } catch {
      setError('Could not read the reference image.')
    }
  }

  const handleGenerate = async () => {
    if (!hasOpenAiKey) {
      setError('Add your OpenAI API key in Settings first.')
      return
    }
    if (!instructions.trim() && !useSlideText && !referenceImage) {
      setError('Add instructions, enable slide text, or upload a reference image.')
      return
    }

    setLoading(true)
    setError('')
    try {
      const referenceImageDataUrl = referenceImage
        ? await resolveImageToDataUrl(referenceImage)
        : null
      const imageUrl = await generateOverlayImage({
        instructions,
        styleId,
        styleNotes,
        slideText,
        useSlideText,
        referenceImageDataUrl,
        apiKey: settings.openaiKey,
      })
      setPreviewUrl(imageUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Image generation failed.')
    } finally {
      setLoading(false)
    }
  }

  const handleApply = () => {
    if (!previewUrl) return
    onApply?.(previewUrl)
    onClose?.()
  }

  return (
    <div className="generate-bg-overlay" onClick={onClose}>
      <div className="generate-bg-modal" onClick={(event) => event.stopPropagation()}>
        <div className="generate-bg-header">
          <div>
            <h2>Generate image</h2>
            <p>Create an AI graphic and add it to the slide as a movable overlay.</p>
          </div>
          <button type="button" className="btn-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="generate-bg-body">
          <div className="generate-bg-form">
            <label className="generate-bg-label" htmlFor="generate-overlay-instructions">Instructions</label>
            <textarea
              id="generate-overlay-instructions"
              className="generate-bg-textarea"
              rows={4}
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
              placeholder="Describe the subject, mood, and colors. Example: friendly robot waving, soft blue palette, clean flat style."
            />

            <label className="generate-bg-label">Style preference</label>
            <div className="generate-bg-style-grid" role="radiogroup" aria-label="Style preference">
              {OVERLAY_STYLE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={`generate-bg-style-option${styleId === preset.id ? ' is-selected' : ''}`}
                  onClick={() => setStyleId(preset.id)}
                  aria-pressed={styleId === preset.id}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <p className="generate-bg-hint">{selectedStyle.hint}</p>

            <label className="generate-bg-label" htmlFor="generate-overlay-style-notes">Style notes (optional)</label>
            <input
              id="generate-overlay-style-notes"
              className="generate-bg-input"
              type="text"
              value={styleNotes}
              onChange={(event) => setStyleNotes(event.target.value)}
              placeholder="Refine the preset, e.g. pastel colors, soft shadows."
            />

            <div className="generate-bg-reference">
              <div className="generate-bg-reference-head">
                <label className="generate-bg-label" htmlFor="generate-overlay-reference">Reference image (optional)</label>
                {referenceImage && (
                  <button
                    type="button"
                    className="generate-bg-link-btn"
                    onClick={() => {
                      setReferenceImage(null)
                      setReferenceName('')
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
              <div className="generate-bg-reference-actions">
                <label className="generate-bg-upload-btn">
                  Upload image
                  <input
                    id="generate-overlay-reference"
                    type="file"
                    accept="image/*"
                    onChange={handleReferenceChange}
                  />
                </label>
              </div>
              {referenceImage ? (
                <div className="generate-bg-reference-preview">
                  <img src={referenceImage} alt="" />
                  <span>{referenceName || 'Reference image'}</span>
                </div>
              ) : (
                <p className="generate-bg-hint">Upload a photo or sketch for visual guidance.</p>
              )}
            </div>

            <label className="generate-bg-checkbox">
              <input
                type="checkbox"
                checked={useSlideText}
                onChange={(event) => setUseSlideText(event.target.checked)}
              />
              <span>Include slide text in the prompt{slideText ? `: "${slideText.slice(0, 80)}${slideText.length > 80 ? '…' : ''}"` : ''}</span>
            </label>

            {error && <p className="generate-bg-error">{error}</p>}

            <div className="generate-bg-actions">
              <button
                type="button"
                className="btn-generate-bg"
                onClick={handleGenerate}
                disabled={loading || !hasOpenAiKey}
              >
                {loading ? 'Generating…' : previewUrl ? 'Regenerate' : 'Generate'}
              </button>
              {!hasOpenAiKey && (
                <p className="generate-bg-hint">OpenAI API key required. Add it in Settings.</p>
              )}
            </div>
          </div>

          <div className="generate-bg-preview-panel">
            <h3>Preview</h3>
            {previewUrl ? (
              <>
                <div className="generate-bg-preview-frame preview-format-1-1">
                  <img src={previewUrl} alt="Generated overlay preview" />
                </div>
                <button type="button" className="btn-apply-bg" onClick={handleApply}>
                  Add to slide
                </button>
              </>
            ) : (
              <div className="generate-bg-preview-empty">
                {loading ? 'Creating your image…' : 'Generated image will appear here.'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default GenerateOverlayModal
