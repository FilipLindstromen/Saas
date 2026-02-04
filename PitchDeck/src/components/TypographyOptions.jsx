import { useEffect, useRef, useState } from 'react'
import './StyleDropdown.css'

const FONT_OPTIONS = ['Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins', 'Raleway', 'Oswald', 'Playfair Display', 'Merriweather', 'Source Sans Pro', 'Nunito', 'Ubuntu', 'Dancing Script', 'Bebas Neue']
export const SERIF_OPTIONS = [
  'Playfair Display', 'Merriweather', 'Lora', 'Crimson Text', 'Libre Baskerville', 'PT Serif', 'Source Serif Pro',
  'EB Garamond', 'Cormorant Garamond', 'Bitter', 'Noto Serif', 'Literata', 'Vollkorn', 'DM Serif Display', 'Fraunces',
  'Roboto Serif', 'Alegreya', 'Young Serif', 'Newsreader', 'Instrument Serif', 'Spectral',
  /* Script & handwritten */
  'Dancing Script', 'Great Vibes', 'Sacramento', 'Pacifico', 'Allura', 'Lobster', 'Kaushan Script', 'Satisfy',
  'Caveat', 'Parisienne', 'Cookie', 'Tangerine', 'Shadows Into Light', 'Patrick Hand', 'Caveat Brush', 'Indie Flower',
  'Comfortaa', 'Quicksand', 'Handlee', 'Permanent Marker'
]

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

function TypographyOptions({ settings, onUpdateSettings, onClose, buttonRef, slides = [], onUpdateSlide, openaiKey, embedded }) {
  const dropdownRef = useRef(null)
  const serifListRef = useRef(null)
  const [isAutoSettingFonts, setIsAutoSettingFonts] = useState(false)
  const [autoSetError, setAutoSetError] = useState(null)
  const [serifDropdownOpen, setSerifDropdownOpen] = useState(false)

  useEffect(() => {
    if (embedded) return
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
  }, [buttonRef, embedded])

  useEffect(() => {
    if (embedded) return
    const handleEscape = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose, embedded])

  useEffect(() => {
    if (!serifDropdownOpen) return
    const handleClickOutside = (e) => {
      if (serifListRef.current && !serifListRef.current.contains(e.target)) {
        setSerifDropdownOpen(false)
      }
    }
    const id = setTimeout(() => document.addEventListener('click', handleClickOutside), 0)
    return () => {
      clearTimeout(id)
      document.removeEventListener('click', handleClickOutside)
    }
  }, [serifDropdownOpen])

  const handleChange = (key, value) => {
    onUpdateSettings({ [key]: value })
  }

  const defaultTypographySettings = {
    textStyleMode: 'fontPairing',
    fontPairingSerifFont: 'Playfair Display',
    fontFamily: 'Poppins',
    defaultTextSize: 4,
    h1Size: 10,
    h2Size: 3.5,
    h3Size: 2.5,
    h1FontFamily: 'Poppins',
    h2FontFamily: 'Poppins',
    h3FontFamily: 'Oswald',
    lineHeight: 1,
    bulletLineHeight: 1,
    bulletTextSize: 3,
    bulletGap: 0.5,
    contentBottomOffset: 12,
    contentEdgeOffset: 9,
    defaultFontWeight: 700,
    h1Weight: 700,
    h2Weight: 700,
    h3Weight: 700
  }

  const handleResetStyling = () => {
    onUpdateSettings(defaultTypographySettings)
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

  const handleResetAllFontsAndTextFields = () => {
    if (!onUpdateSlide || !slides?.length) return
    slides.forEach((slide) => {
      const layout = slide.layout || 'default'
      if (layout === 'bulletpoints') {
        const lines = (slide.content || '').split('\n')
        const newLines = lines.map((line) => getPlainText(line))
        onUpdateSlide(slide.id, { content: newLines.join('\n') })
      } else {
        const newContent = getPlainText(slide.content || '').replace(/\n/g, '<br>')
        const newSubtitle = getPlainText(slide.subtitle || '').replace(/\n/g, '<br>')
        onUpdateSlide(slide.id, { content: newContent, subtitle: newSubtitle })
      }
    })
  }

  const content = (
    <div className="style-dropdown-content">
      <div className="style-dropdown-header-row">
            <button
              type="button"
              className="style-dropdown-btn style-dropdown-btn-reset"
              onClick={handleResetStyling}
              title="Reset all typography settings to defaults"
            >
              Reset styling
            </button>
          </div>

          {/* 1. Main font */}
          <div className="style-dropdown-field">
            <label>Font family</label>
            <select
              value={settings.fontFamily || 'Inter'}
              onChange={(e) => handleChange('fontFamily', e.target.value)}
              className="style-dropdown-select"
            >
              {FONT_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div className="style-dropdown-sub-fields style-dropdown-sub-fields-inline">
            <div className="style-dropdown-sub-field">
              <label>Size (rem)</label>
              <input
                type="number"
                min="0.5"
                max="10"
                step="0.1"
                value={settings.defaultTextSize !== undefined ? settings.defaultTextSize : 4}
                onChange={(e) => handleChange('defaultTextSize', parseFloat(e.target.value) || 4)}
                className="style-dropdown-input"
              />
            </div>
            <div className="style-dropdown-sub-field">
              <label>Line height</label>
              <input
                type="number"
                min="0.5"
                max="3"
                step="0.1"
                value={settings.lineHeight !== undefined ? settings.lineHeight : 1}
                onChange={(e) => handleChange('lineHeight', parseFloat(e.target.value) || 1)}
                className="style-dropdown-input"
              />
            </div>
            <div className="style-dropdown-sub-field">
              <label>Font weight</label>
              <input
                type="number"
                min="100"
                max="900"
                step="100"
                value={settings.defaultFontWeight !== undefined ? settings.defaultFontWeight : 700}
                onChange={(e) => handleChange('defaultFontWeight', Math.min(900, Math.max(100, parseInt(e.target.value, 10) || 700)))}
                className="style-dropdown-input"
                title="100–900 (e.g. 400 Normal, 700 Bold)"
              />
            </div>
          </div>

          {/* 2. Font pairing */}
          <div className="style-dropdown-field">
            <label>Text style mode</label>
            <select
              value={settings.textStyleMode || 'fontPairing'}
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
              <div className="style-dropdown-field" ref={serifListRef}>
                <label>Pairing font</label>
                <div className="font-preview-select-wrap">
                  <button
                    type="button"
                    className="font-preview-select-trigger"
                    onClick={(e) => { e.stopPropagation(); setSerifDropdownOpen(open => !open) }}
                    aria-expanded={serifDropdownOpen}
                    aria-haspopup="listbox"
                  >
                    <span
                      className="font-preview-select-value"
                      style={{ fontFamily: `"${settings.fontPairingSerifFont || 'Playfair Display'}", serif` }}
                    >
                      {settings.fontPairingSerifFont || 'Playfair Display'}
                    </span>
                  </button>
                  {serifDropdownOpen && (
                    <ul
                      className="font-preview-select-list"
                      role="listbox"
                      aria-label="Pairing font"
                    >
                      {SERIF_OPTIONS.map(f => (
                        <li
                          key={f}
                          role="option"
                          aria-selected={f === (settings.fontPairingSerifFont || 'Playfair Display')}
                          className="font-preview-select-option"
                          style={{ fontFamily: `"${f}", serif` }}
                          onClick={() => {
                            handleChange('fontPairingSerifFont', f)
                            setSerifDropdownOpen(false)
                          }}
                        >
                          {f}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
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

          {/* 3. Headings */}
          <div className="style-dropdown-sub-fields">
            <div className="style-dropdown-sub-field">
              <label>H1 size</label>
              <input
                type="number"
                min="1"
                max="10"
                step="0.1"
                value={settings.h1Size !== undefined ? settings.h1Size : 5}
                onChange={(e) => handleChange('h1Size', parseFloat(e.target.value) || 7)}
                className="style-dropdown-input"
              />
            </div>
            <div className="style-dropdown-sub-field">
              <label>H2 size</label>
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
              <label>H3 size</label>
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
          <div className="style-dropdown-sub-fields">
            <div className="style-dropdown-sub-field" style={{ flex: 1 }}>
              <label>H1 font</label>
              <select
                value={settings.h1FontFamily || settings.fontFamily || 'Poppins'}
                onChange={(e) => handleChange('h1FontFamily', e.target.value)}
                className="style-dropdown-select"
              >
                {FONT_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div className="style-dropdown-sub-field" style={{ flex: 1 }}>
              <label>H2 font</label>
              <select
                value={settings.h2FontFamily || settings.fontFamily || 'Inter'}
                onChange={(e) => handleChange('h2FontFamily', e.target.value)}
                className="style-dropdown-select"
              >
                {FONT_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div className="style-dropdown-sub-field" style={{ flex: 1 }}>
              <label>H3 font</label>
              <select
                value={settings.h3FontFamily || settings.fontFamily || 'Oswald'}
                onChange={(e) => handleChange('h3FontFamily', e.target.value)}
                className="style-dropdown-select"
              >
                {FONT_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </div>
          <div className="style-dropdown-sub-fields style-dropdown-sub-fields-inline">
            <div className="style-dropdown-sub-field">
              <label>H1 weight</label>
              <input
                type="number"
                min="100"
                max="900"
                step="100"
                value={settings.h1Weight !== undefined ? settings.h1Weight : 700}
                onChange={(e) => handleChange('h1Weight', Math.min(900, Math.max(100, parseInt(e.target.value, 10) || 700)))}
                className="style-dropdown-input"
              />
            </div>
            <div className="style-dropdown-sub-field">
              <label>H2 weight</label>
              <input
                type="number"
                min="100"
                max="900"
                step="100"
                value={settings.h2Weight !== undefined ? settings.h2Weight : 700}
                onChange={(e) => handleChange('h2Weight', Math.min(900, Math.max(100, parseInt(e.target.value, 10) || 700)))}
                className="style-dropdown-input"
              />
            </div>
            <div className="style-dropdown-sub-field">
              <label>H3 weight</label>
              <input
                type="number"
                min="100"
                max="900"
                step="100"
                value={settings.h3Weight !== undefined ? settings.h3Weight : 700}
                onChange={(e) => handleChange('h3Weight', Math.min(900, Math.max(100, parseInt(e.target.value, 10) || 700)))}
                className="style-dropdown-input"
              />
            </div>
          </div>

          {/* 4. Bullets */}
          <div className="style-dropdown-section-title">Bullets</div>
          <div className="style-dropdown-field" style={{ marginBottom: '0.25rem' }}>
            <label className="style-dropdown-checkbox">
              <input
                type="checkbox"
                checked={settings.showBullets !== false}
                onChange={(e) => handleChange('showBullets', e.target.checked)}
              />
              <span>Show bullets</span>
            </label>
          </div>
          <div className="style-dropdown-sub-fields style-dropdown-sub-fields-inline">
            <div className="style-dropdown-sub-field">
              <label>Line height</label>
              <input
                type="number"
                min="0.5"
                max="3"
                step="0.1"
                value={settings.bulletLineHeight !== undefined ? settings.bulletLineHeight : 1}
                onChange={(e) => handleChange('bulletLineHeight', parseFloat(e.target.value) || 1)}
                className="style-dropdown-input"
              />
            </div>
            <div className="style-dropdown-sub-field">
              <label>Text size (rem)</label>
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
            <div className="style-dropdown-sub-field">
              <label>Spacing between (rem)</label>
              <input
                type="number"
                min="0"
                max="5"
                step="0.1"
                value={settings.bulletGap !== undefined ? settings.bulletGap : 0.5}
                onChange={(e) => handleChange('bulletGap', parseFloat(e.target.value) ?? 0.5)}
                className="style-dropdown-input"
              />
            </div>
          </div>

          {/* 6. Reset content */}
          <div className="style-dropdown-field" style={{ marginTop: '0.5rem' }}>
            <button
              type="button"
              className="style-dropdown-btn style-dropdown-btn-reset-fields"
              onClick={handleResetAllFontsAndTextFields}
              disabled={!slides?.length}
              title="Remove all inline formatting (bold, italic, highlight, color, serif, headings) from every slide so text uses layout defaults"
            >
              Reset all fonts and text fields
            </button>
          </div>
    </div>
  )

  if (embedded) return content
  return (
    <>
      <div className="style-dropdown-backdrop" onClick={onClose} />
      <div className="style-dropdown-panel" ref={dropdownRef} onClick={(e) => e.stopPropagation()}>
        {content}
      </div>
    </>
  )
}

export default TypographyOptions
