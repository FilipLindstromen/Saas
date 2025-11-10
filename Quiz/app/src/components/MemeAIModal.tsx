import React, { useState } from 'react'

interface MemeAIModalProps {
  isOpen: boolean
  onClose: () => void
  onGenerateMeme: (topText: string, bottomText: string) => void
  apiKey: string
  onApiKeyChange: (key: string) => void
}

export function MemeAIModal({ isOpen, onClose, onGenerateMeme, apiKey, onApiKeyChange }: MemeAIModalProps) {
  const [customInstructions, setCustomInstructions] = useState(() => 
    localStorage.getItem('memeCustomInstructions') || 
    'Generate a funny meme with top and bottom text. The meme should be humorous, relatable, or satirical. Return the response in JSON format with "topText" and "bottomText" fields. Keep the text concise and punchy, suitable for social media.'
  )
  const [idea, setIdea] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState('')

  const handleGenerate = async () => {
    if (!apiKey.trim()) {
      setError('Please enter your OpenAI API key')
      return
    }

    if (!idea.trim()) {
      setError('Please enter a meme idea')
      return
    }

    setIsGenerating(true)
    setError('')

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: customInstructions
            },
            {
              role: 'user',
              content: `Create a meme about: ${idea}`
            }
          ],
          max_tokens: 200,
          temperature: 0.8
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || `API Error: ${response.status}`)
      }

      const data = await response.json()
      const content = data.choices[0]?.message?.content

      if (!content) {
        throw new Error('No response from AI')
      }

      // Try to parse JSON response
      let memeData
      try {
        memeData = JSON.parse(content)
      } catch {
        // If not JSON, try to extract text from response
        const lines = content.split('\n').filter(line => line.trim())
        memeData = {
          topText: lines[0] || 'TOP TEXT',
          bottomText: lines[1] || 'BOTTOM TEXT'
        }
      }

      onGenerateMeme(
        memeData.topText || 'TOP TEXT',
        memeData.bottomText || 'BOTTOM TEXT'
      )
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate meme')
    } finally {
      setIsGenerating(false)
    }
  }

  const persistCustomInstructions = (value: string) => {
    setCustomInstructions(value)
    localStorage.setItem('memeCustomInstructions', value)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">🤖 AI Meme Generator</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ×
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh] space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              OpenAI API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => onApiKeyChange(e.target.value)}
              placeholder="Enter your OpenAI API key"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Get your API key from{' '}
              <a 
                href="https://platform.openai.com/api-keys" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                platform.openai.com/api-keys
              </a>
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Meme Idea
            </label>
            <input
              type="text"
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder="e.g., 'working from home', 'Monday morning', 'coffee addiction'"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Custom Instructions
            </label>
            <textarea
              value={customInstructions}
              onChange={(e) => persistCustomInstructions(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Customize how the AI generates memes..."
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !apiKey.trim() || !idea.trim()}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? 'Generating...' : 'Generate Meme'}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}





