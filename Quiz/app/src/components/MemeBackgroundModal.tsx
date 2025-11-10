import React, { useState, useEffect } from 'react'
import { memeApi, MemeItem } from '../services/memeApi'

interface MemeBackgroundModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectMeme: (meme: MemeItem) => void
}

export function MemeBackgroundModal({ isOpen, onClose, onSelectMeme }: MemeBackgroundModalProps) {
  const [memes, setMemes] = useState<MemeItem[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'static' | 'gif'>('all')
  const [error, setError] = useState('')
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set())

  const categories = memeApi.getAvailableCategories()

  const loadMemes = async (category: string = selectedCategory, search: string = '', filter: 'all' | 'static' | 'gif' = selectedFilter) => {
    setLoading(true)
    setError('')
    
    try {
      let memeResults: MemeItem[]
      
      if (search.trim()) {
        memeResults = await memeApi.searchMemes(search, 60)
        // Apply filter to search results
        if (filter === 'static') {
          memeResults = memeResults.filter(m => !m.isGif)
        } else if (filter === 'gif') {
          memeResults = memeResults.filter(m => m.isGif)
        }
      } else {
        // Fetch based on filter
        if (filter === 'static') {
          memeResults = await memeApi.fetchStaticMemes(40)
        } else if (filter === 'gif') {
          memeResults = await memeApi.fetchGifMemes(20)
        } else {
          memeResults = await memeApi.fetchMemes(60)
        }
      }
      
      setMemes(memeResults)
      
      if (memeResults.length === 0) {
        setError('No memes found. Try a different search term or filter.')
      }
    } catch (err) {
      setError('Failed to load memes. Please try again.')
      console.error('Error loading memes:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    if (searchTerm.trim()) {
      loadMemes(selectedCategory, searchTerm, selectedFilter)
    } else {
      loadMemes(selectedCategory, '', selectedFilter)
    }
  }

  const handleCategoryChange = (newCategory: string) => {
    setSelectedCategory(newCategory)
    if (!searchTerm.trim()) {
      loadMemes(newCategory, '', selectedFilter)
    }
  }

  const handleFilterChange = (newFilter: 'all' | 'static' | 'gif') => {
    setSelectedFilter(newFilter)
    if (!searchTerm.trim()) {
      loadMemes(selectedCategory, '', newFilter)
    } else {
      loadMemes(selectedCategory, searchTerm, newFilter)
    }
  }

  const handleMemeSelect = (meme: MemeItem) => {
    onSelectMeme(meme)
    onClose()
  }

  const handleRandomMeme = async () => {
    setLoading(true)
    try {
      const randomMeme = await memeApi.getRandomMeme()
      if (randomMeme) {
        handleMemeSelect(randomMeme)
      } else {
        setError('Failed to get random meme. Please try again.')
      }
    } catch (err) {
      setError('Failed to get random meme. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Load initial memes
  useEffect(() => {
    if (isOpen && memes.length === 0) {
      loadMemes(selectedCategory, '', selectedFilter)
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold">🎭 Meme Backgrounds</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Controls */}
        <div className="p-4 border-b space-y-3">
          {/* Category Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            >
              {categories.map(category => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          {/* Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => handleFilterChange('all')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  selectedFilter === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
                disabled={loading}
              >
                All ({memes.length})
              </button>
              <button
                onClick={() => handleFilterChange('static')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  selectedFilter === 'static'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
                disabled={loading}
              >
                Static
              </button>
              <button
                onClick={() => handleFilterChange('gif')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  selectedFilter === 'gif'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
                disabled={loading}
              >
                GIF
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Search memes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
            <button
              onClick={handleSearch}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              Search
            </button>
          </div>

          {/* Random Meme Button */}
          <div className="flex gap-2">
            <button
              onClick={handleRandomMeme}
              disabled={loading}
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50"
            >
              🎲 Random Meme
            </button>
            <button
              onClick={() => {
                setSearchTerm('')
                loadMemes(selectedCategory, '', selectedFilter)
              }}
              disabled={loading}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-50 border-l-4 border-red-400 text-red-700">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">Loading memes...</p>
          </div>
        )}

        {/* Meme Grid */}
        {!loading && memes.length > 0 && (
          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {memes.map((meme) => (
                <div
                  key={meme.id}
                  className="group cursor-pointer bg-gray-100 rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
                  onClick={() => handleMemeSelect(meme)}
                >
                  <div className="aspect-square relative">
                    <img
                      src={meme.url}
                      alt={meme.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      crossOrigin="anonymous"
                      onError={(e) => {
                        console.log('Failed to load meme image:', meme.url)
                        
                        // Try multiple fallback approaches
                        const img = e.target as HTMLImageElement
                        
                        if (!img.src.includes('api.allorigins.win')) {
                          // Try with CORS proxy
                          const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(meme.url)}`
                          img.src = proxyUrl
                        } else if (!img.src.includes('corsproxy.io')) {
                          // Try different CORS proxy
                          const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(meme.url)}`
                          img.src = proxyUrl
                        } else {
                          // All attempts failed, mark as failed
                          setFailedImages(prev => new Set(prev).add(meme.id))
                        }
                      }}
                      onLoad={() => {
                        // Image loaded successfully, remove from failed set
                        setFailedImages(prev => {
                          const newSet = new Set(prev)
                          newSet.delete(meme.id)
                          return newSet
                        })
                      }}
                    />
                    {meme.isGif && (
                      <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
                        GIF
                      </div>
                    )}
                    {failedImages.has(meme.id) && (
                      <div className="absolute inset-0 bg-gray-200 flex items-center justify-center">
                        <div className="text-center text-gray-500 text-xs">
                          <div className="text-2xl mb-1">🚫</div>
                          <div>Image failed to load</div>
                          <div className="text-xs opacity-75 mt-1">Click to try anyway</div>
                        </div>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center">
                      <div className="opacity-0 group-hover:opacity-100 bg-white bg-opacity-90 rounded-full p-2">
                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  <div className="p-2">
                    <p className="text-sm text-gray-800 line-clamp-2 truncate">
                      {meme.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {meme.source} • {meme.width}×{meme.height}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No Results */}
        {!loading && memes.length === 0 && !error && (
          <div className="p-8 text-center text-gray-500">
            <p>No memes found. Try a different search term.</p>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50">
          <p className="text-sm text-gray-600 text-center">
            60+ meme templates (40 static, 20 GIF) • Reliable placeholder images
          </p>
        </div>
      </div>
    </div>
  )
}
