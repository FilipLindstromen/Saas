import React from 'react'

interface AIModalProps {
  isOpen: boolean
  onClose: () => void
  customInstructions: string
  onCustomInstructionsChange: (value: string) => void
  openaiApiKey: string
  onOpenaiApiKeyChange: (value: string) => void
}

export function AIModal({
  isOpen,
  onClose,
  customInstructions,
  onCustomInstructionsChange,
  openaiApiKey,
  onOpenaiApiKeyChange
}: AIModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-iosbg rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">🤖 AI Settings</h3>
          <button 
            className="text-iossub hover:text-iostext"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        
        <div className="space-y-4 flex-1 overflow-y-auto">
          <div>
            <label className="block text-sm text-iossub mb-2">OpenAI API Key</label>
            <input 
              type="password"
              className="ios-input w-full" 
              placeholder="sk-..." 
              value={openaiApiKey} 
              onChange={e => onOpenaiApiKeyChange(e.target.value)}
            />
          </div>

                    <div>
                      <label className="block text-sm text-iossub mb-2">Custom Instructions</label>
                      <textarea 
                        className="ios-input w-full h-32 resize-y" 
                        placeholder="e.g., 'Generate 5 short, funny, and highly relatable quiz questions about stress, anxiety, and high-achiever behavior. The questions should have 3 answer options (a, b, c). The humor should come from exaggeration and real-life situations that overthinkers, perfectionists, or ambitious people experience daily. Keep the tone casual, social-media-friendly, and punchy — suitable for TikTok or Instagram Reels video quizzes.'"
                        value={customInstructions} 
                        onChange={e => onCustomInstructionsChange(e.target.value)}
                      />
                      <div className="text-xs text-iossub mt-2">
                        💡 Tip: You can request multiple questions by specifying a number (e.g., "Generate 5 questions about..."). The AI will create both multiple choice and true/false questions based on your instructions.
                      </div>
                    </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button 
            className="ios-card px-4 py-2 flex-1" 
            onClick={onClose}
          >
            Save & Close
          </button>
        </div>
      </div>
    </div>
  )
}
