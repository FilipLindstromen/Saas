import { useState } from 'react'
import './Settings.css'

function Settings({ settings, onUpdate, onClose }) {
  const [localSettings, setLocalSettings] = useState(settings)
  const [activeTab, setActiveTab] = useState('style') // 'style' or 'api'

  const handleSave = () => {
    onUpdate(localSettings)
    onClose()
  }

  const handleChange = (key, value) => {
    setLocalSettings({ ...localSettings, [key]: value })
  }

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>Settings</h2>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>
        <div className="settings-tabs">
          <button 
            className={`settings-tab ${activeTab === 'style' ? 'active' : ''}`}
            onClick={() => setActiveTab('style')}
          >
            Style
          </button>
          <button 
            className={`settings-tab ${activeTab === 'api' ? 'active' : ''}`}
            onClick={() => setActiveTab('api')}
          >
            API Keys
          </button>
        </div>
        <div className="settings-content">
          {activeTab === 'style' && (
            <>
              <div className="settings-section">
                <h3 className="settings-section-title">Colors</h3>
                <div className="settings-field">
                  <label htmlFor="background-color">Background Color</label>
                  <div className="color-input-group">
                    <input
                      id="background-color"
                      type="color"
                      value={localSettings.backgroundColor || '#1a1a1a'}
                      onChange={(e) => handleChange('backgroundColor', e.target.value)}
                      className="color-picker-input"
                    />
                    <input
                      type="text"
                      value={localSettings.backgroundColor || '#1a1a1a'}
                      onChange={(e) => handleChange('backgroundColor', e.target.value)}
                      className="color-text-input"
                      placeholder="#1a1a1a"
                    />
                  </div>
                </div>
                <div className="settings-field">
                  <label htmlFor="text-color">Text Color</label>
                  <div className="color-input-group">
                    <input
                      id="text-color"
                      type="color"
                      value={localSettings.textColor || '#ffffff'}
                      onChange={(e) => handleChange('textColor', e.target.value)}
                      className="color-picker-input"
                    />
                    <input
                      type="text"
                      value={localSettings.textColor || '#ffffff'}
                      onChange={(e) => handleChange('textColor', e.target.value)}
                      className="color-text-input"
                      placeholder="#ffffff"
                    />
                  </div>
                </div>
              </div>

              <div className="settings-section">
                <h3 className="settings-section-title">Typography</h3>
                <div className="settings-field">
                  <label htmlFor="font-family">Font Family</label>
                  <select
                    id="font-family"
                    value={localSettings.fontFamily || 'Inter'}
                    onChange={(e) => handleChange('fontFamily', e.target.value)}
                    className="settings-select"
                  >
                    <option value="Inter">Inter</option>
                    <option value="Roboto">Roboto</option>
                    <option value="Open Sans">Open Sans</option>
                    <option value="Lato">Lato</option>
                    <option value="Montserrat">Montserrat</option>
                    <option value="Poppins">Poppins</option>
                    <option value="Raleway">Raleway</option>
                    <option value="Oswald">Oswald</option>
                    <option value="Playfair Display">Playfair Display</option>
                    <option value="Merriweather">Merriweather</option>
                    <option value="Source Sans Pro">Source Sans Pro</option>
                    <option value="Nunito">Nunito</option>
                    <option value="Ubuntu">Ubuntu</option>
                    <option value="Dancing Script">Dancing Script</option>
                    <option value="Bebas Neue">Bebas Neue</option>
                  </select>
                </div>
                <div className="settings-field">
                  <label className="settings-sub-section-title">Heading Sizes (rem)</label>
                  <div className="settings-sub-fields">
                    <div className="settings-sub-field">
                      <label htmlFor="h1-size">H1 Size</label>
                      <input
                        id="h1-size"
                        type="number"
                        min="1"
                        max="10"
                        step="0.1"
                        value={localSettings.h1Size !== undefined ? localSettings.h1Size : 5}
                        onChange={(e) => handleChange('h1Size', parseFloat(e.target.value) || 5)}
                        className="settings-number-input"
                      />
                    </div>
                    <div className="settings-sub-field">
                      <label htmlFor="h2-size">H2 Size</label>
                      <input
                        id="h2-size"
                        type="number"
                        min="1"
                        max="10"
                        step="0.1"
                        value={localSettings.h2Size !== undefined ? localSettings.h2Size : 3.5}
                        onChange={(e) => handleChange('h2Size', parseFloat(e.target.value) || 3.5)}
                        className="settings-number-input"
                      />
                    </div>
                    <div className="settings-sub-field">
                      <label htmlFor="h3-size">H3 Size</label>
                      <input
                        id="h3-size"
                        type="number"
                        min="1"
                        max="10"
                        step="0.1"
                        value={localSettings.h3Size !== undefined ? localSettings.h3Size : 2.5}
                        onChange={(e) => handleChange('h3Size', parseFloat(e.target.value) || 2.5)}
                        className="settings-number-input"
                      />
                    </div>
                  </div>
                </div>
                <div className="settings-field">
                  <label className="settings-sub-section-title">Heading Fonts</label>
                  <div className="settings-sub-fields">
                    <div className="settings-sub-field">
                      <label htmlFor="h1-font">H1 Font</label>
                      <select
                        id="h1-font"
                        value={localSettings.h1FontFamily || localSettings.fontFamily || 'Inter'}
                        onChange={(e) => handleChange('h1FontFamily', e.target.value)}
                        className="settings-select"
                      >
                        <option value="Inter">Inter</option>
                        <option value="Roboto">Roboto</option>
                        <option value="Open Sans">Open Sans</option>
                        <option value="Lato">Lato</option>
                        <option value="Montserrat">Montserrat</option>
                        <option value="Poppins">Poppins</option>
                        <option value="Raleway">Raleway</option>
                        <option value="Oswald">Oswald</option>
                        <option value="Playfair Display">Playfair Display</option>
                        <option value="Merriweather">Merriweather</option>
                        <option value="Source Sans Pro">Source Sans Pro</option>
                        <option value="Nunito">Nunito</option>
                        <option value="Ubuntu">Ubuntu</option>
                        <option value="Dancing Script">Dancing Script</option>
                        <option value="Bebas Neue">Bebas Neue</option>
                      </select>
                    </div>
                    <div className="settings-sub-field">
                      <label htmlFor="h2-font">H2 Font</label>
                      <select
                        id="h2-font"
                        value={localSettings.h2FontFamily || localSettings.fontFamily || 'Inter'}
                        onChange={(e) => handleChange('h2FontFamily', e.target.value)}
                        className="settings-select"
                      >
                        <option value="Inter">Inter</option>
                        <option value="Roboto">Roboto</option>
                        <option value="Open Sans">Open Sans</option>
                        <option value="Lato">Lato</option>
                        <option value="Montserrat">Montserrat</option>
                        <option value="Poppins">Poppins</option>
                        <option value="Raleway">Raleway</option>
                        <option value="Oswald">Oswald</option>
                        <option value="Playfair Display">Playfair Display</option>
                        <option value="Merriweather">Merriweather</option>
                        <option value="Source Sans Pro">Source Sans Pro</option>
                        <option value="Nunito">Nunito</option>
                        <option value="Ubuntu">Ubuntu</option>
                        <option value="Dancing Script">Dancing Script</option>
                        <option value="Bebas Neue">Bebas Neue</option>
                      </select>
                    </div>
                    <div className="settings-sub-field">
                      <label htmlFor="h3-font">H3 Font</label>
                      <select
                        id="h3-font"
                        value={localSettings.h3FontFamily || localSettings.fontFamily || 'Inter'}
                        onChange={(e) => handleChange('h3FontFamily', e.target.value)}
                        className="settings-select"
                      >
                        <option value="Inter">Inter</option>
                        <option value="Roboto">Roboto</option>
                        <option value="Open Sans">Open Sans</option>
                        <option value="Lato">Lato</option>
                        <option value="Montserrat">Montserrat</option>
                        <option value="Poppins">Poppins</option>
                        <option value="Raleway">Raleway</option>
                        <option value="Oswald">Oswald</option>
                        <option value="Playfair Display">Playfair Display</option>
                        <option value="Merriweather">Merriweather</option>
                        <option value="Source Sans Pro">Source Sans Pro</option>
                        <option value="Nunito">Nunito</option>
                        <option value="Ubuntu">Ubuntu</option>
                        <option value="Dancing Script">Dancing Script</option>
                        <option value="Bebas Neue">Bebas Neue</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="settings-section">
                <h3 className="settings-section-title">Text Effects</h3>
                <div className="settings-field">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={localSettings.textDropShadow || false}
                      onChange={(e) => handleChange('textDropShadow', e.target.checked)}
                    />
                    <span>Enable Drop Shadow</span>
                  </label>
                  {localSettings.textDropShadow && (
                    <div className="settings-sub-fields">
                      <div className="settings-sub-field">
                        <label htmlFor="shadow-blur">Blur (px)</label>
                        <input
                          id="shadow-blur"
                          type="number"
                          min="0"
                          max="50"
                          value={localSettings.shadowBlur || 4}
                          onChange={(e) => handleChange('shadowBlur', parseInt(e.target.value) || 0)}
                          className="settings-number-input"
                        />
                      </div>
                      <div className="settings-sub-field">
                        <label htmlFor="shadow-offset-x">Offset X (px)</label>
                        <input
                          id="shadow-offset-x"
                          type="number"
                          min="-20"
                          max="20"
                          value={localSettings.shadowOffsetX || 2}
                          onChange={(e) => handleChange('shadowOffsetX', parseInt(e.target.value) || 0)}
                          className="settings-number-input"
                        />
                      </div>
                      <div className="settings-sub-field">
                        <label htmlFor="shadow-offset-y">Offset Y (px)</label>
                        <input
                          id="shadow-offset-y"
                          type="number"
                          min="-20"
                          max="20"
                          value={localSettings.shadowOffsetY || 2}
                          onChange={(e) => handleChange('shadowOffsetY', parseInt(e.target.value) || 0)}
                          className="settings-number-input"
                        />
                      </div>
                      <div className="settings-sub-field">
                        <label htmlFor="shadow-color">Shadow Color</label>
                        <div className="color-input-group">
                          <input
                            id="shadow-color"
                            type="color"
                            value={localSettings.shadowColor || '#000000'}
                            onChange={(e) => handleChange('shadowColor', e.target.value)}
                            className="color-picker-input"
                          />
                          <input
                            type="text"
                            value={localSettings.shadowColor || '#000000'}
                            onChange={(e) => handleChange('shadowColor', e.target.value)}
                            className="color-text-input"
                            placeholder="#000000"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="settings-field">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={localSettings.textInlineBackground || false}
                      onChange={(e) => handleChange('textInlineBackground', e.target.checked)}
                    />
                    <span>Enable Inline Background</span>
                  </label>
                  {localSettings.textInlineBackground && (
                    <div className="settings-sub-fields">
                      <div className="settings-sub-field">
                        <label htmlFor="inline-bg-color">Background Color</label>
                        <div className="color-input-group">
                          <input
                            id="inline-bg-color"
                            type="color"
                            value={localSettings.inlineBgColor || '#000000'}
                            onChange={(e) => handleChange('inlineBgColor', e.target.value)}
                            className="color-picker-input"
                          />
                          <input
                            type="text"
                            value={localSettings.inlineBgColor || '#000000'}
                            onChange={(e) => handleChange('inlineBgColor', e.target.value)}
                            className="color-text-input"
                            placeholder="#000000"
                          />
                        </div>
                      </div>
                      <div className="settings-sub-field">
                        <label htmlFor="inline-bg-opacity">Opacity</label>
                        <input
                          id="inline-bg-opacity"
                          type="range"
                          min="0"
                          max="1"
                          step="0.1"
                          value={localSettings.inlineBgOpacity !== undefined ? localSettings.inlineBgOpacity : 0.7}
                          onChange={(e) => handleChange('inlineBgOpacity', parseFloat(e.target.value))}
                          className="settings-range-input"
                        />
                        <span className="range-value">{Math.round((localSettings.inlineBgOpacity !== undefined ? localSettings.inlineBgOpacity : 0.7) * 100)}%</span>
                      </div>
                      <div className="settings-sub-field">
                        <label htmlFor="inline-bg-padding">Padding (px)</label>
                        <input
                          id="inline-bg-padding"
                          type="number"
                          min="0"
                          max="30"
                          value={localSettings.inlineBgPadding || 8}
                          onChange={(e) => handleChange('inlineBgPadding', parseInt(e.target.value) || 0)}
                          className="settings-number-input"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {activeTab === 'api' && (
            <>
              <div className="settings-field">
                <label htmlFor="openai-key">OpenAI API Key</label>
                <input
                  id="openai-key"
                  type="password"
                  value={localSettings.openaiKey || ''}
                  onChange={(e) => handleChange('openaiKey', e.target.value)}
                  placeholder="sk-..."
                />
                <p className="settings-hint">
                  Required for automatically selecting images based on slide content
                </p>
              </div>
              <div className="settings-field">
                <label htmlFor="unsplash-key">Unsplash API Key</label>
                <input
                  id="unsplash-key"
                  type="password"
                  value={localSettings.unsplashKey || ''}
                  onChange={(e) => handleChange('unsplashKey', e.target.value)}
                  placeholder="Your Unsplash Access Key"
                />
                <p className="settings-hint">
                  Get your free API key from{' '}
                  <a href="https://unsplash.com/developers" target="_blank" rel="noopener noreferrer">
                    unsplash.com/developers
                  </a>
                </p>
              </div>
            </>
          )}
        </div>
        <div className="settings-footer">
          <button className="btn-cancel" onClick={onClose}>Cancel</button>
          <button className="btn-save" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  )
}

export default Settings
