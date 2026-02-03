import { useState } from 'react'
import './Settings.css'

function Settings({ settings, onUpdate, onClose }) {
  const [localSettings, setLocalSettings] = useState(settings)
  const [activeTab, setActiveTab] = useState('api') // 'api' only (Colors/Typography/Text Effects are in header foldouts)

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
            className={`settings-tab ${activeTab === 'api' ? 'active' : ''}`}
            onClick={() => setActiveTab('api')}
          >
            API Keys
          </button>
        </div>
        <div className="settings-content">
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
              <div className="settings-field">
                <label htmlFor="google-client-id">Google Client ID</label>
                <input
                  id="google-client-id"
                  type="password"
                  value={localSettings.googleClientId || ''}
                  onChange={(e) => handleChange('googleClientId', e.target.value)}
                  placeholder="xxxxx.apps.googleusercontent.com"
                />
                <p className="settings-hint">
                  Required for saving and opening projects from Google Drive. Create an OAuth 2.0 Client ID (Web application) in the{' '}
                  <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer">
                    Google Cloud Console
                  </a>
                  . To fix &quot;redirect_uri_mismatch&quot;, add this exact URL in your OAuth client:
                </p>
                <p className="settings-origin-hint">
                  <strong>Authorized JavaScript origins:</strong> add <code>{typeof window !== 'undefined' ? window.location.origin : 'https://your-app-url.com'}</code>
                  <br />
                  <strong>Authorized redirect URIs:</strong> add <code>{typeof window !== 'undefined' ? `${window.location.origin}/` : 'https://your-app-url.com/'}</code>
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
