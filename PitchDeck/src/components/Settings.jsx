import { useState } from 'react'
import { loadApiKeys } from '@shared/apiKeys'
import './Settings.css'

function Settings({ settings, onUpdate, onClose }) {
  const [localSettings, setLocalSettings] = useState(settings)
  const [activeTab, setActiveTab] = useState('api') // 'api' only (Colors/Typography/Text Effects are in header foldouts)

  const saasAppsUrl = typeof window !== 'undefined'
    ? new URL('../index.html', window.location.href).href
    : '/index.html'

  const handleSave = () => {
    const apiKeys = loadApiKeys()
    onUpdate({
      ...localSettings,
      openaiKey: apiKeys.openai || '',
      unsplashKey: apiKeys.unsplash || '',
      pexelsKey: apiKeys.pexels || '',
      pixabayKey: apiKeys.pixabay || '',
      googleClientId: apiKeys.googleClientId || ''
    })
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
              <p className="settings-hint" style={{ marginBottom: '1rem', gridColumn: '1 / -1' }}>
                API keys (OpenAI, Unsplash, Pexels, Pixabay, Google Client ID) are configured in the{' '}
                <a href={saasAppsUrl} target="_blank" rel="noopener noreferrer" className="settings-link">
                  SaaS Apps screen
                </a>
                . They are shared across all apps.
              </p>
              <p className="settings-hint" style={{ marginBottom: '1rem', gridColumn: '1 / -1' }}>
                For Google Drive: add <code>{typeof window !== 'undefined' ? window.location.origin : 'https://your-app-url.com'}</code> to Authorized JavaScript origins in your OAuth client.
              </p>
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
