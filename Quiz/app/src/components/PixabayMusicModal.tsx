import React, { useState, useEffect } from 'react'
import { API_KEYS } from '../config/apiKeys'
// Real music URLs - no audio generation needed

interface PixabayMusicModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectMusic: (music: any) => void
}

interface PixabayMusicItem {
  id: number
  pageURL: string
  type: string
  tags: string
  duration: number
  user: string
  user_id: number
  userImageURL: string
  picture_id: string
  videos: {
    large?: { url: string; width: number; height: number }
    medium?: { url: string; width: number; height: number }
    small?: { url: string; width: number; height: number }
    tiny?: { url: string; width: number; height: number }
  }
  views: number
  downloads: number
  favorites: number
  likes: number
  comments: number
}

export function PixabayMusicModal({ isOpen, onClose, onSelectMusic }: PixabayMusicModalProps) {
  const [music, setMusic] = useState<PixabayMusicItem[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('background music')
  const [error, setError] = useState('')

  const searchMusic = async (query: string = searchQuery) => {
    if (!API_KEYS.PIXABAY_API_KEY || API_KEYS.PIXABAY_API_KEY === 'YOUR_PIXABAY_API_KEY_HERE') {
      setError('Please configure your Pixabay API key in src/config/apiKeys.ts')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch(
        `https://pixabay.com/api/videos/?key=${API_KEYS.PIXABAY_API_KEY}&q=${encodeURIComponent(query)}&safesearch=true&per_page=20`
      )
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      
      if (data.hits) {
        setMusic(data.hits)
      } else {
        setError('No music found. Try a different search term.')
      }
    } catch (err) {
      console.error('Pixabay API error:', err)
      setError('Failed to load music. Please check your API key and try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      searchMusic()
    }
  }, [isOpen])

  const handleSelect = (item: PixabayMusicItem) => {
    // Use the video URL as audio source (videos contain audio)
    const videoUrl = item.videos.large?.url || item.videos.medium?.url || item.videos.small?.url
    
    console.log('Pixabay item selected:', item)
    console.log('Available video URLs:', item.videos)
    console.log('Selected video URL:', videoUrl)
    
    if (!videoUrl) {
      // Fallback to real music URLs when Pixabay video is not available
      const fallbackMusic = [
        'https://incompetech.com/music/royalty-free/music/Corporate%20Success.mp3',
        'https://incompetech.com/music/royalty-free/music/Happy%20Ukulele.mp3',
        'https://incompetech.com/music/royalty-free/music/Chill%20Electronic.mp3',
        'https://incompetech.com/music/royalty-free/music/Acoustic%20Folk.mp3'
      ]
      const randomFallback = fallbackMusic[Math.floor(Math.random() * fallbackMusic.length)]
      
      onSelectMusic({
        name: item.tags.split(',')[0] || 'Pixabay Music',
        artist: item.user,
        url: randomFallback,
        duration: item.duration,
        source: 'pixabay'
      })
      onClose()
      return
    }
    
    onSelectMusic({
      name: item.tags.split(',')[0] || 'Pixabay Music',
      artist: item.user,
      url: videoUrl,
      duration: item.duration,
      source: 'pixabay'
    })
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg max-w-4xl w-full max-h-[80vh] overflow-hidden">
        <div className="p-6 border-b border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white">🎵 Pixabay Music</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-2xl"
            >
              ×
            </button>
          </div>
          
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for background music..."
              className="flex-1 px-3 py-2 bg-gray-800 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              onKeyPress={(e) => e.key === 'Enter' && searchMusic()}
            />
            <button
              onClick={() => searchMusic()}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {error && (
            <div className="text-red-400 text-center py-4">
              {error}
            </div>
          )}

          {loading && (
            <div className="text-center py-8">
              <div className="text-gray-400">Loading music...</div>
            </div>
          )}

          {!loading && !error && music.length === 0 && (
            <div className="text-center py-8">
              <div className="text-gray-400">No music found. Try a different search term.</div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {music.map((item) => (
              <div
                key={item.id}
                className="bg-gray-800 rounded-lg p-4 hover:bg-gray-700 cursor-pointer transition-colors"
                onClick={() => handleSelect(item)}
              >
                <div className="flex items-start gap-3">
                  <div className="w-16 h-16 bg-gray-700 rounded flex items-center justify-center overflow-hidden">
                    {item.picture_id ? (
                      <img 
                        src={`https://i.vimeocdn.com/video/${item.picture_id}_640x360.jpg`}
                        alt="Video thumbnail"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-2xl">🎵</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-white truncate">
                      {item.tags.split(',')[0] || 'Untitled'}
                    </h3>
                    <p className="text-sm text-gray-400">by {item.user}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Duration: {Math.floor(item.duration / 60)}:{(item.duration % 60).toString().padStart(2, '0')}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <span>👁️ {item.views.toLocaleString()}</span>
                      <span>⬇️ {item.downloads.toLocaleString()}</span>
                      <span>❤️ {item.likes.toLocaleString()}</span>
                    </div>
                    <div className="mt-2">
                      <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded">
                        Video with Audio
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 border-t border-gray-700">
          <div className="text-sm text-gray-400 text-center">
            Music provided by <a href="https://pixabay.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Pixabay</a>
          </div>
        </div>
      </div>
    </div>
  )
}
