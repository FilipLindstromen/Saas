import React, { useState, useEffect } from 'react'

interface FreesoundTrack {
  id: number
  name: string
  description: string
  duration: number
  filesize: number
  download: string
  previews: {
    'preview-hq-mp3': string
    'preview-lq-mp3': string
  }
  tags: string[]
  username: string
  license: string
}

interface FreesoundMusicModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectMusic: (music: { name: string; url: string; duration: number; source: string }) => void
}

export function FreesoundMusicModal({ isOpen, onClose, onSelectMusic }: FreesoundMusicModalProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [tracks, setTracks] = useState<FreesoundTrack[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('freesoundApiKey') || '')

  const searchTracks = async (query: string) => {
    if (!apiKey.trim()) {
      setError('Please enter your Freesound API key')
      return
    }

    if (!query.trim()) {
      setTracks([])
      return
    }

    setIsLoading(true)
    setError('')

    try {
      // Freesound API search endpoint
      const response = await fetch(
        `https://freesound.org/apiv2/search/text/?query=${encodeURIComponent(query)}&filter=duration:[10 TO 300]&fields=id,name,description,duration,filesize,download,previews,tags,username,license&page_size=20`,
        {
          headers: {
            'Authorization': `Token ${apiKey}`
          }
        }
      )

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      setTracks(data.results || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search tracks')
      setTracks([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    searchTracks(searchQuery)
  }

  const handleSelectTrack = (track: FreesoundTrack) => {
    // Use the high-quality preview URL for playback
    const audioUrl = track.previews['preview-hq-mp3'] || track.previews['preview-lq-mp3']
    
    onSelectMusic({
      name: track.name,
      url: audioUrl,
      duration: track.duration,
      source: 'freesound'
    })
    onClose()
  }

  // Helper function to create WAV buffer
  const createWavBuffer = (audioBuffer: AudioBuffer): ArrayBuffer => {
    const numberOfChannels = audioBuffer.numberOfChannels
    const sampleRate = audioBuffer.sampleRate
    const length = audioBuffer.length
    const arrayBuffer = new ArrayBuffer(44 + length * numberOfChannels * 2)
    const view = new DataView(arrayBuffer)
    
    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i))
      }
    }
    
    writeString(0, 'RIFF')
    view.setUint32(4, 36 + length * numberOfChannels * 2, true)
    writeString(8, 'WAVE')
    writeString(12, 'fmt ')
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true)
    view.setUint16(22, numberOfChannels, true)
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, sampleRate * numberOfChannels * 2, true)
    view.setUint16(32, numberOfChannels * 2, true)
    view.setUint16(34, 16, true)
    writeString(36, 'data')
    view.setUint32(40, length * numberOfChannels * 2, true)
    
    // Convert float samples to 16-bit PCM
    let offset = 44
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(channel)[i]))
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true)
        offset += 2
      }
    }
    
    return arrayBuffer
  }

  const saveApiKey = (key: string) => {
    setApiKey(key)
    try {
      localStorage.setItem('freesoundApiKey', key)
    } catch {}
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Freesound Music</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ×
            </button>
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Freesound API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => saveApiKey(e.target.value)}
              placeholder="Enter your Freesound API key"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Get your free API key at{' '}
              <a 
                href="https://freesound.org/help/developers/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                freesound.org/help/developers/
              </a>
            </p>
          </div>

          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for music (e.g., 'ambient', 'upbeat', 'piano')"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={isLoading || !apiKey.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Searching...' : 'Search'}
            </button>
          </form>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          {tracks.length === 0 && !isLoading && searchQuery && !error && (
            <div className="text-center text-gray-500 py-8">
              No tracks found. Try a different search term.
            </div>
          )}

          {tracks.length === 0 && !searchQuery && (
            <div className="text-center text-gray-500 py-8">
              Enter a search term to find music tracks.
            </div>
          )}

          <div className="space-y-3">
            {tracks.map((track) => (
              <div
                key={track.id}
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
                onClick={() => handleSelectTrack(track)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900 mb-1">{track.name}</h3>
                    <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                      {track.description || 'No description available'}
                    </p>
                    <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                      <span>Duration: {Math.round(track.duration)}s</span>
                      <span>•</span>
                      <span>By: {track.username}</span>
                      <span>•</span>
                      <span>License: {track.license}</span>
                    </div>
                    {track.tags.length > 0 && (
                      <div className="mt-2">
                        <div className="flex flex-wrap gap-1">
                          {track.tags.slice(0, 5).map((tag, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="ml-4">
                    <button className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">
                      Select
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
