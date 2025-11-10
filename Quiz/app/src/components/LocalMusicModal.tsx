import React, { useState, useRef } from 'react'

interface LocalMusicModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectMusic: (music: { name: string; url: string; duration: number; source: string }) => void
}

export function LocalMusicModal({ isOpen, onClose, onSelectMusic }: LocalMusicModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a', 'audio/aac']
    if (!allowedTypes.includes(file.type)) {
      setError('Please select a valid audio file (MP3, WAV, OGG, M4A, or AAC)')
      return
    }

    // Validate file size (max 50MB)
    const maxSize = 50 * 1024 * 1024 // 50MB
    if (file.size > maxSize) {
      setError('File size must be less than 50MB')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      // Create object URL for the file
      const audioUrl = URL.createObjectURL(file)
      
      // Get duration by creating an audio element
      const audio = new Audio(audioUrl)
      
      await new Promise((resolve, reject) => {
        audio.addEventListener('loadedmetadata', resolve)
        audio.addEventListener('error', reject)
        audio.load()
      })

      const duration = audio.duration || 0
      
      onSelectMusic({
        name: file.name.replace(/\.[^/.]+$/, ''), // Remove file extension
        url: audioUrl,
        duration: Math.round(duration),
        source: 'local'
      })
      
      onClose()
    } catch (err) {
      setError('Failed to load audio file. Please try a different file.')
      console.error('Error loading audio file:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    const files = event.dataTransfer.files
    if (files.length > 0) {
      const file = files[0]
      // Create a fake event to reuse the existing handler
      const fakeEvent = {
        target: { files: [file] }
      } as React.ChangeEvent<HTMLInputElement>
      handleFileSelect(fakeEvent)
    }
  }

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="p-6 border-b">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Upload Music File</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ×
            </button>
          </div>
        </div>

        <div className="p-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          <div
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            <div className="space-y-4">
              <div className="text-gray-500">
                <svg className="mx-auto h-12 w-12" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                  <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              
              <div>
                <p className="text-lg font-medium text-gray-900 mb-2">
                  {isLoading ? 'Processing file...' : 'Drop your music file here'}
                </p>
                <p className="text-sm text-gray-500 mb-4">
                  or click to browse files
                </p>
                <p className="text-xs text-gray-400">
                  Supports MP3, WAV, OGG, M4A, AAC (max 50MB)
                </p>
              </div>

              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Processing...' : 'Choose File'}
              </button>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          <div className="mt-6 text-sm text-gray-600">
            <h3 className="font-medium mb-2">Tips for best results:</h3>
            <ul className="space-y-1 text-xs">
              <li>• Use MP3 files for best compatibility</li>
              <li>• Keep files under 50MB for faster loading</li>
              <li>• Use stereo audio for better quality</li>
              <li>• Consider the length - longer tracks use more memory</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}





