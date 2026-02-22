interface SettingsPanelProps {
  isOpen: boolean
  onClose: () => void
}

export default function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  if (!isOpen) return null

  const saasAppsUrl = typeof window !== 'undefined'
    ? new URL('../index.html', window.location.href).href
    : '/index.html'

  return (
    <>
      <div
        className="fixed inset-0 bg-gray-900 bg-opacity-75 z-50"
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
          <p className="text-sm text-gray-400">
            API keys are configured in the{' '}
            <a href={saasAppsUrl} target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">
              SaaS Apps screen
            </a>
            . They are shared across all apps.
          </p>
        </div>
        <div className="p-4 border-t border-gray-700">
          <button
            onClick={onClose}
            className="w-full bg-gray-700 hover:bg-gray-700 text-white py-2 rounded"
          >
            Close
          </button>
        </div>
      </div>
    </>
  )
}

