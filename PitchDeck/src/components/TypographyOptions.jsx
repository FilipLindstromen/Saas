import { useEffect, useRef, useState } from 'react'
import './StyleDropdown.css'

const FONT_OPTIONS = ['Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins', 'Raleway', 'Oswald', 'Playfair Display', 'Merriweather', 'Source Sans Pro', 'Nunito', 'Ubuntu', 'Dancing Script', 'Bebas Neue']
const SERIF_OPTIONS = ['Playfair Display', 'Merriweather', 'Lora', 'Crimson Text', 'Libre Baskerville', 'PT Serif', 'Source Serif Pro', 'EB Garamond', 'Cormorant Garamond', 'Bitter']

function stripSerifSpans(html) {
  if (!html || typeof html !== 'string') return html
  return html.replace(/<span\s+class="font-pairing-serif"[^>]*>([\s\S]*?)<\/span>/gi, '$1')
}

function getPlainText(html) {
  if (!html || typeof html !== 'string') return ''
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim()
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function wrapPhrasesInSerif(html, phrases) {
  if (!html || !Array.isArray(phrases) || phrases.length === 0) return html
  let result = html
  const sorted = [...phrases].filter(Boolean).map(p => p.trim()).filter(Boolean).sort((a, b) => b.length - a.length)
  const serifSpanRegex = /(<span\s+class="font-pairing-serif"[^>]*>[\s\S]*?<\/span>)/gi
  for (const phrase of sorted) {
    if (!phrase) continue
    const escaped = escapeRegex(phrase)
    const regex = new RegExp(`(${escaped})`, 'gi')
    const parts = result.split(serifSpanRegex)
    result = parts.map(part => {
      if (/^<span\s+class="font-pairing-serif"/i.test(part)) return part
      return part.replace(regex, '<span class="font-pairing-serif">$1</span>')
    }).join('')
  }
  return result
}

function TypographyOptions({ settings, onUpdateSettings, onClose, buttonRef, slides = [], onUpdateSlide, openaiKey }) {
  const dropdownRef = useRef(null)
  const [isAutoSettingFonts, setIsAutoSettingFonts] = useState(false)
  const [autoSetError, setAutoSetError] = useState(null)

  useEffect(() => {
    const updatePosition = () => {
      if (buttonRef?.current && dropdownRef?.current) {
        const buttonRect = buttonRef.current.getBoundingClientRect()
        dropdownRef.current.style.top = `${buttonRect.bottom + 8}px`
        dropdownRef.current.style.right = `${window.innerWidth - buttonRect.right}px`
      }
    }
    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [buttonRef])

  useEffect(() => {
    const handleEscape = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose])

  const handleChange = (key, value) => {
    onUpdateSettings({ [key]: value })
  }

  const handleAutoSetFonts = async () => {
    if (!openaiKey?.trim() || !onUpdateSlide || !slides?.length) return
    setIsAutoSettingFonts(true)
    setAutoSetError(null)
    try {
      const slidesToProcess = slides.filter(s => (s.layout || 'default') !== 'section')
      if (slidesToProcess.length === 0) return

      for (const slide of slidesToProcess) {
        const contentClean = stripSerifSpans(slide.content || '')
        const subtitleClean = stripSerifSpans(slide.subtitle || '')
        const contentPlain = getPlainText(contentClean)
        const subtitlePlain = getPlainText(subtitleClean)
        const bullets = (contentClean || '').split('\n').map(l => l.trim()).filter(Boolean)
        const isBulletLayout = (slide.layout || 'default') === 'bulletpoints'
        const bulletPlains = isBulletLayout ? bullets.map(l => getPlainText(stripSerifSpans(l))) : []
        const allText = [contentPlain, subtitlePlain, ...bulletPlains].filter(Boolean).join('\n')
        if (!allText.trim()) continue

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: 'You choose which words or short phrases (1–4 words) in slide text should be displayed in a serif font for visual emphasis. Pick only the most impactful: key terms, emotional words, or phrases that deserve emphasis. Return a JSON object with a single key "phrases" whose value is an array of exact strings to emphasize, e.g. {"phrases": ["pain", "your peace", "awareness"]}. Return only the JSON, no other text.'
              },
              {
                role: 'user',
                content: `Slide text:\n${allText.slice(0, 1500)}`
              }
            ],
            response_format: { type: 'json_object' },
            max_tokens: 300
          })
        })

        if (!response.ok) {
          const err = await response.json().catch(() => ({}))
          throw new Error(err.error?.message || `API error: ${response.status}`)
        }

        const data = await response.json()
        const text = data.choices?.[0]?.message?.content
        if (!text) continue
        let parsed
        try {
          parsed = JSON.parse(text)
        } catch {
          continue
        }
        const phrases = Array.isArray(parsed.phrases) ? parsed.phrases : []

        if ((slide.layout || 'default') === 'bulletpoints') {
          const bulletLines = (contentClean || '').split('\n').map(l => l.trim()).filter(Boolean)
          const updatedBullets = bulletLines.map(line => wrapPhrasesInSerif(stripSerifSpans(line), phrases))
          onUpdateSlide(slide.id, { content: updatedBullets.join('\n') })
        } else {
          const newContent = wrapPhrasesInSerif(contentClean, phrases)
          const newSubtitle = subtitleClean ? wrapPhrasesInSerif(subtitleClean, phrases) : (slide.subtitle || '')
          onUpdateSlide(slide.id, { content: newContent, subtitle: newSubtitle })
        }
      }
    } catch (err) {
      setAutoSetError(err.message || 'Failed to auto-set fonts')
    } finally {
      setIsAutoSettingFonts(false)
    }
  }

  return (
    <>
      <div className="style-dropdown-backdrop" onClick={onClose} />
      <div className="style-dropdown-panel" ref={dropdownRef} onClick={(e) => e.stopPropagation()}>
        <div className="style-dropdown-content">
          <div className="style-dropdown-title">Typography</div>
          <div className="style-dropdown-field">
            <label>Text Style Mode</label>
            <select
              value={settings.textStyleMode || 'standard'}
              onChange={(e) => handleChange('textStyleMode', e.target.value)}
              className="style-dropdown-select"
            >
              <option value="standard">Standard</option>
              <option value="fontPairing">Font Pairing</option>
              <option value="dynamic">Dynamic</option>
            </select>
          </div>
          {settings.textStyleMode === 'fontPairing' && (
            <>
              <div className="style-dropdown-field">
                <label>Serif Font</label>
                <select
                  value={settings.fontPairingSerifFont || 'Playfair Display'}
                  onChange={(e) => handleChange('fontPairingSerifFont', e.target.value)}
                  className="style-dropdown-select"
                >
                  {SERIF_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div className="style-dropdown-field">
                <button
                  type="button"
                  className="style-dropdown-btn style-dropdown-btn-auto-fonts"
                  onClick={handleAutoSetFonts}
                  disabled={!openaiKey?.trim() || !slides?.length || isAutoSettingFonts}
                  title={!openaiKey?.trim() ? 'Add OpenAI API key in Settings' : 'Use AI to pick the best words for serif on all slides'}
                >
                  {isAutoSettingFonts ? 'Setting fonts…' : 'Auto set fonts'}
                </button>
                {autoSetError && (
                  <p className="style-dropdown-error" role="alert">{autoSetError}</p>
                )}
              </div>
            </>
          )}
          <div className="style-dropdown-field">
            <label>Font Family</label>
            <select
              value={settings.fontFamily || 'Inter'}
              onChange={(e) => handleChange('fontFamily', e.target.value)}
              className="style-dropdown-select"
            >
              {FONT_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div className="style-dropdown-field">
            <label>Line Height</label>
            <input
              type="number"
              min="0.5"
              max="3"
              step="0.1"
              value={settings.lineHeight !== undefined ? settings.lineHeight : 1.4}
              onChange={(e) => handleChange('lineHeight', parseFloat(e.target.value) || 1.4)}
              className="style-dropdown-input"
            />
          </div>
          <div className="style-dropdown-field">
            <label>Bullet Line Height</label>
            <input
              type="number"
              min="0.5"
              max="3"
              step="0.1"
              value={settings.bulletLineHeight !== undefined ? settings.bulletLineHeight : 1.4}
              onChange={(e) => handleChange('bulletLineHeight', parseFloat(e.target.value) || 1.4)}
              className="style-dropdown-input"
            />
          </div>
          <div className="style-dropdown-field">
            <label>Bullet Text Size (rem)</label>
            <input
              type="number"
              min="0.5"
              max="10"
              step="0.1"
              value={settings.bulletTextSize !== undefined ? settings.bulletTextSize : 3}
              onChange={(e) => handleChange('bulletTextSize', parseFloat(e.target.value) || 3)}
              className="style-dropdown-input"
            />
          </div>
          <div className="style-dropdown-field">
            <label>Default Text Size (rem)</label>
            <input
              type="number"
              min="0.5"
              max="10"
              step="0.1"
              value={settings.defaultTextSize !== undefined ? settings.defaultTextSize : 5}
              onChange={(e) => handleChange('defaultTextSize', parseFloat(e.target.value) || 5)}
              className="style-dropdown-input"
            />
          </div>
          <div className="style-dropdown-title">Heading Sizes (rem)</div>
          <div className="style-dropdown-sub-fields">
            <div className="style-dropdown-sub-field">
              <label>H1</label>
              <input
                type="number"
                min="1"
                max="10"
                step="0.1"
                value={settings.h1Size !== undefined ? settings.h1Size : 5}
                onChange={(e) => handleChange('h1Size', parseFloat(e.target.value) || 5)}
                className="style-dropdown-input"
              />
            </div>
            <div className="style-dropdown-sub-field">
              <label>H2</label>
              <input
                type="number"
                min="1"
                max="10"
                step="0.1"
                value={settings.h2Size !== undefined ? settings.h2Size : 3.5}
                onChange={(e) => handleChange('h2Size', parseFloat(e.target.value) || 3.5)}
                className="style-dropdown-input"
              />
            </div>
            <div className="style-dropdown-sub-field">
              <label>H3</label>
              <input
                type="number"
                min="1"
                max="10"
                step="0.1"
                value={settings.h3Size !== undefined ? settings.h3Size : 2.5}
                onChange={(e) => handleChange('h3Size', parseFloat(e.target.value) || 2.5)}
                className="style-dropdown-input"
              />
            </div>
          </div>
          <div className="style-dropdown-title">Heading Fonts</div>
          <div className="style-dropdown-sub-fields">
            <div className="style-dropdown-sub-field" style={{ flex: 1 }}>
              <label>H1</label>
              <select
                value={settings.h1FontFamily || settings.fontFamily || 'Inter'}
                onChange={(e) => handleChange('h1FontFamily', e.target.value)}
                className="style-dropdown-select"
              >
                {FONT_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div className="style-dropdown-sub-field" style={{ flex: 1 }}>
              <label>H2</label>
              <select
                value={settings.h2FontFamily || settings.fontFamily || 'Inter'}
                onChange={(e) => handleChange('h2FontFamily', e.target.value)}
                className="style-dropdown-select"
              >
                {FONT_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div className="style-dropdown-sub-field" style={{ flex: 1 }}>
              <label>H3</label>
              <select
                value={settings.h3FontFamily || settings.fontFamily || 'Inter'}
                onChange={(e) => handleChange('h3FontFamily', e.target.value)}
                className="style-dropdown-select"
              >
                {FONT_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default TypographyOptions
