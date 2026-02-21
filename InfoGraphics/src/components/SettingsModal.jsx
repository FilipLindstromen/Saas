import { useState, useEffect } from 'react'
import './SettingsModal.css'

const STORAGE_KEY = 'infographicsApiKeys'

export function loadApiKeys() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      return {
        giphy: parsed.giphy || '',
        openai: parsed.openai || ''
      }
    }
  } catch (e) {
    console.error('Error loading API keys:', e)
  }
  return { giphy: '', openai: '' }
}

export function saveApiKeys(keys) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(keys))
}

export default function SettingsModal({ isOpen, onClose, apiKeys = {}, onSave }) {
  const [giphy, setGiphy] = useState(apiKeys?.giphy || '')
  const [openai, setOpenai] = useState(apiKeys?.openai || '')

  useEffect(() => {
    if (isOpen) {
      setGiphy(apiKeys?.giphy || '')
      setOpenai(apiKeys?.openai || '')
    }
  }, [isOpen, apiKeys])

  const handleSave = () => {
    onSave({ giphy: giphy.trim(), openai: openai.trim() })
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="settings-modal-backdrop" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-modal-header">
          <h2>Settings</h2>
          <button className="settings-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="settings-modal-body">
          <p className="settings-modal-desc">
            API keys are stored locally in your browser. They are sent to the server when making requests.
          </p>
          <div className="settings-field">
            <label htmlFor="giphy-key">Giphy API Key</label>
            <input
              id="giphy-key"
              type="password"
              value={giphy}
              onChange={(e) => setGiphy(e.target.value)}
              placeholder="Get one at developers.giphy.com"
              autoComplete="off"
            />
          </div>
          <div className="settings-field">
            <label htmlFor="openai-key">OpenAI API Key</label>
            <input
              id="openai-key"
              type="password"
              value={openai}
              onChange={(e) => setOpenai(e.target.value)}
              placeholder="For AI-powered infographic generation"
              autoComplete="off"
            />
          </div>
        </div>
        <div className="settings-modal-footer">
          <button className="settings-btn-secondary" onClick={onClose}>Cancel</button>
          <button className="settings-btn-primary" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  )
}
