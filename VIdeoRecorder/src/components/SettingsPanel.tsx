import { useState, useEffect } from 'react'

interface SettingsPanelProps {
  isOpen: boolean
  onClose: () => void
}

export default function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const [openaiApiKey, setOpenaiApiKey] = useState('')

  useEffect(() => {
    // Load API key from localStorage
    const savedKey = localStorage.getItem('openai_api_key') || ''
    setOpenaiApiKey(savedKey)
  }, [])

  const handleSave = () => {
    localStorage.setItem('openai_api_key', openaiApiKey)
    onClose()
  }

  if (!isOpen) return null

  return (
    <>
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-50"
        onClick={onClose}
      />
      <div className="fixed right-0 top-0 bottom-0 w-96 bg-gray-900 border-l border-gray-700 z-50 flex flex-col">
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Settings</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-700 rounded"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">
              OpenAI API Key
            </label>
            <input
              type="password"
              value={openaiApiKey}
              onChange={(e) => setOpenaiApiKey(e.target.value)}
              placeholder="sk-..."
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">
              Your API key is stored locally and never sent to our servers.
            </p>
          </div>
        </div>
        <div className="p-4 border-t border-gray-700">
          <button
            onClick={handleSave}
            className="w-full bg-white hover:bg-zinc-200 text-black py-2 rounded"
          >
            Save Settings
          </button>
        </div>
      </div>
    </>
  )
}

