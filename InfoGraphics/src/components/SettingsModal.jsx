import { useState, useEffect } from 'react'
import { loadApiKeys as loadShared, saveApiKeys as saveShared } from '@shared/apiKeys'
import './SettingsModal.css'

export function loadApiKeys() {
  const keys = loadShared()
  return { giphy: keys.giphy, pixabay: keys.pixabay, pexels: keys.pexels, openai: keys.openai }
}

export function saveApiKeys(keys) {
  saveShared({ giphy: keys.giphy, pixabay: keys.pixabay, pexels: keys.pexels, openai: keys.openai })
}

export default function SettingsModal({ isOpen, onClose, apiKeys = {}, onSave }) {
  const [giphy, setGiphy] = useState(apiKeys?.giphy || '')
  const [pixabay, setPixabay] = useState(apiKeys?.pixabay || '')
  const [pexels, setPexels] = useState(apiKeys?.pexels || '')
  const [openai, setOpenai] = useState(apiKeys?.openai || '')

  useEffect(() => {
    if (isOpen) {
      setGiphy(apiKeys?.giphy || '')
      setPixabay(apiKeys?.pixabay || '')
      setPexels(apiKeys?.pexels || '')
      setOpenai(apiKeys?.openai || '')
    }
  }, [isOpen, apiKeys])

  const handleSave = () => {
    onSave({ giphy: giphy.trim(), pixabay: pixabay.trim(), pexels: pexels.trim(), openai: openai.trim() })
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
            API keys are stored once and shared across all Saas apps. They are sent to the server when making requests.
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
            <label htmlFor="pixabay-key">Pixabay API Key</label>
            <input
              id="pixabay-key"
              type="password"
              value={pixabay}
              onChange={(e) => setPixabay(e.target.value)}
              placeholder="Get one at pixabay.com/api/docs/"
              autoComplete="off"
            />
          </div>
          <div className="settings-field">
            <label htmlFor="pexels-key">Pexels API Key</label>
            <input
              id="pexels-key"
              type="password"
              value={pexels}
              onChange={(e) => setPexels(e.target.value)}
              placeholder="Get one at pexels.com/api"
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
