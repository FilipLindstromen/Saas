import { useEffect, useMemo, useState } from 'react'
import {
  BACKGROUND_STYLE_PRESETS,
  generateSlideBackground,
  getSlideText,
  normalizeBackgroundStyleId,
  resolveImageToDataUrl,
} from '../services/backgroundAi'
import './GenerateBackgroundModal.css'

const STORAGE_INSTRUCTIONS = 'pitchDeckBgGenInstructions'
const STORAGE_STYLE = 'pitchDeckBgGenStyle'
const STORAGE_STYLE_NOTES = 'pitchDeckBgGenStyleNotes'
const STORAGE_USE_SLIDE_TEXT = 'pitchDeckBgGenUseSlideText'

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function GenerateBackgroundModal({
  isOpen,
  onClose,
  onApply,
  slide,
  settings,
  slideFormat = '16:9',
}) {
  const slideText = useMemo(() => getSlideText(slide), [slide])
  const [instructions, setInstructions] = useState('')
  const [styleId, setStyleId] = useState('informational')
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
    setInstructions(slide?.backgroundPrompt?.trim() || localStorage.getItem(STORAGE_INSTRUCTIONS) || '')
    setStyleId(normalizeBackgroundStyleId(slide?.backgroundStyle || localStorage.getItem(STORAGE_STYLE) || 'informational'))
    setStyleNotes(localStorage.getItem(STORAGE_STYLE_NOTES) || '')
    const savedUseSlideText = localStorage.getItem(STORAGE_USE_SLIDE_TEXT)
    setUseSlideText(savedUseSlideText == null ? true : savedUseSlideText === 'true')
    setReferenceImage(null)
    setReferenceName('')
  }, [isOpen, slide?.backgroundPrompt, slide?.backgroundStyle])

  if (!isOpen) return null

  const selectedStyle = BACKGROUND_STYLE_PRESETS.find((item) => item.id === styleId) || BACKGROUND_STYLE_PRESETS[0]
  const hasOpenAiKey = !!settings?.openaiKey?.trim()
  const canUseSlideBackground = !!slide?.imageUrl

  const handleUseSlideBackground = () => {
    if (!slide?.imageUrl) return
    setReferenceImage(slide.imageUrl)
    setReferenceName('Current slide background')
    setError('')
  }

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
      const imageUrl = await generateSlideBackground({
        instructions,
        styleId,
        styleNotes,
        slideText,
        useSlideText,
        referenceImageDataUrl,
        slideFormat,
        apiKey: settings.openaiKey,
      })
      setPreviewUrl(imageUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Background generation failed.')
    } finally {
      setLoading(false)
    }
  }

  const handleApply = () => {
    if (!previewUrl) return
    onApply?.({
      imageUrl: previewUrl,
      backgroundOpacity: 0.6,
      imageScale: 1.0,
      imageScaleCustomized: false,
      backgroundVideoUrl: '',
      infographicProjectId: undefined,
      infographicTabId: undefined,
      backgroundPrompt: instructions.trim(),
      backgroundStyle: styleId,
    })
    onClose?.()
  }

  return (
    <div className="generate-bg-overlay" onClick={onClose}>
      <div className="generate-bg-modal" onClick={(event) => event.stopPropagation()}>
        <div className="generate-bg-header">
          <div>
            <h2>Generate background</h2>
            <p>Create an AI background using instructions, an optional reference image, and a style preference.</p>
          </div>
          <button type="button" className="btn-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="generate-bg-body">
          <div className="generate-bg-form">
            <label className="generate-bg-label" htmlFor="generate-bg-instructions">Instructions</label>
            <textarea
              id="generate-bg-instructions"
              className="generate-bg-textarea"
              rows={4}
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
              placeholder="Describe the scene, mood, colors, and subject. Example: calm morning light over a city skyline, soft blues and warm highlights."
            />

            <label className="generate-bg-label">Style preference</label>
            <div className="generate-bg-style-grid" role="radiogroup" aria-label="Style preference">
              {BACKGROUND_STYLE_PRESETS.map((preset) => (
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

            <label className="generate-bg-label" htmlFor="generate-bg-style-notes">Style notes (optional)</label>
            <input
              id="generate-bg-style-notes"
              className="generate-bg-input"
              type="text"
              value={styleNotes}
              onChange={(event) => setStyleNotes(event.target.value)}
              placeholder="Override or refine the preset, e.g. muted teal palette, soft blur."
            />

            <div className="generate-bg-reference">
              <div className="generate-bg-reference-head">
                <label className="generate-bg-label" htmlFor="generate-bg-reference">Reference image (optional)</label>
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
                    id="generate-bg-reference"
                    type="file"
                    accept="image/*"
                    onChange={handleReferenceChange}
                  />
                </label>
                {canUseSlideBackground && (
                  <button type="button" className="generate-bg-secondary-btn" onClick={handleUseSlideBackground}>
                    Use current background
                  </button>
                )}
              </div>
              {referenceImage ? (
                <div className="generate-bg-reference-preview">
                  <img src={referenceImage} alt="" />
                  <span>{referenceName || 'Reference image'}</span>
                </div>
              ) : (
                <p className="generate-bg-hint">Upload a photo or mood board. The model will use it as visual guidance.</p>
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
                <div className={`generate-bg-preview-frame preview-format-${(slideFormat || '16:9').replace(':', '-')}`}>
                  <img src={previewUrl} alt="Generated background preview" />
                </div>
                <button type="button" className="btn-apply-bg" onClick={handleApply}>
                  Use as slide background
                </button>
              </>
            ) : (
              <div className="generate-bg-preview-empty">
                {loading ? 'Creating your background…' : 'Generated image will appear here.'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default GenerateBackgroundModal
