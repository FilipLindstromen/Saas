import React, { useState, useEffect } from 'react'
import { getApiKeys } from '../config/apiKeys'

interface StockImage {
  id: string
  url: string
  thumbnail: string
  width: number
  height: number
  photographer: string
  photographerUrl: string
  source: 'pexels' | 'unsplash' | 'pixabay'
}

interface StockVideo {
  id: string
  url: string
  thumbnail: string
  width: number
  height: number
  duration: number
  user: string
  userUrl: string
  source: 'pexels' | 'pixabay'
}

interface StockMediaModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectImage: (image: StockImage) => void
  onSelectVideo: (video: StockVideo) => void
  type: 'image' | 'video'
}

export function StockMediaModal({ 
  isOpen, 
  onClose, 
  onSelectImage, 
  onSelectVideo, 
  type 
}: StockMediaModalProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [images, setImages] = useState<StockImage[]>([])
  const [videos, setVideos] = useState<StockVideo[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedSource, setSelectedSource] = useState<'pexels' | 'unsplash' | 'pixabay'>('pexels')
  const [page, setPage] = useState(1)

  // Use shared API keys (configure in Settings on main app screen)
  const apiKeys = getApiKeys()
  const PEXELS_API_KEY = apiKeys.pexels || ''
  const UNSPLASH_API_KEY = apiKeys.unsplash || ''
  const PIXABAY_API_KEY = apiKeys.pixabay || ''

  const searchMedia = async (query: string, pageNum: number = 1) => {
    if (!query.trim()) return
    
    if (selectedSource === 'pexels' && !PEXELS_API_KEY.trim()) {
      alert('Please add your Pexels API key in Settings (gear icon on the main app screen).')
      return
    }
    if (selectedSource === 'unsplash' && !UNSPLASH_API_KEY.trim()) {
      alert('Please add your Unsplash API key in Settings (gear icon on the main app screen).')
      return
    }
    if (selectedSource === 'pixabay' && !PIXABAY_API_KEY.trim()) {
      alert('Please add your Pixabay API key in Settings (gear icon on the main app screen).')
      return
    }
    
    setLoading(true)
    try {
      if (type === 'image') {
        await searchImages(query, pageNum)
      } else {
        await searchVideos(query, pageNum)
      }
    } catch (error) {
      console.error('Error searching media:', error)
      alert('Error searching media. Please check your API keys and try again.')
    } finally {
      setLoading(false)
    }
  }

  const searchImages = async (query: string, pageNum: number) => {
    if (selectedSource === 'pexels') {
      const response = await fetch(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=20&page=${pageNum}`,
        {
          headers: {
            'Authorization': PEXELS_API_KEY
          }
        }
      )
      const data = await response.json()
      
      const pexelsImages: StockImage[] = data.photos.map((photo: any) => ({
        id: photo.id.toString(),
        url: photo.src.large2x,
        thumbnail: photo.src.medium,
        width: photo.width,
        height: photo.height,
        photographer: photo.photographer,
        photographerUrl: photo.photographer_url,
        source: 'pexels'
      }))
      
      if (pageNum === 1) {
        setImages(pexelsImages)
      } else {
        setImages(prev => [...prev, ...pexelsImages])
      }
    } else if (selectedSource === 'unsplash') {
      const response = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=20&page=${pageNum}`,
        {
          headers: {
            'Authorization': `Client-ID ${UNSPLASH_API_KEY}`
          }
        }
      )
      const data = await response.json()
      
      const unsplashImages: StockImage[] = data.results.map((photo: any) => ({
        id: photo.id,
        url: photo.urls.full,
        thumbnail: photo.urls.regular,
        width: photo.width,
        height: photo.height,
        photographer: photo.user.name,
        photographerUrl: photo.user.links.html,
        source: 'unsplash'
      }))
      
      if (pageNum === 1) {
        setImages(unsplashImages)
      } else {
        setImages(prev => [...prev, ...unsplashImages])
      }
    } else if (selectedSource === 'pixabay') {
      const response = await fetch(
        `https://pixabay.com/api/?key=${PIXABAY_API_KEY}&q=${encodeURIComponent(query)}&image_type=photo&safesearch=true&per_page=20&page=${pageNum}`
      )
      const data = await response.json()
      
      const pixabayImages: StockImage[] = data.hits.map((photo: any) => ({
        id: photo.id.toString(),
        url: photo.largeImageURL,
        thumbnail: photo.previewURL,
        width: photo.imageWidth,
        height: photo.imageHeight,
        photographer: photo.user,
        photographerUrl: `https://pixabay.com/users/${photo.user}-${photo.user_id}/`,
        source: 'pixabay'
      }))
      
      if (pageNum === 1) {
        setImages(pixabayImages)
      } else {
        setImages(prev => [...prev, ...pixabayImages])
      }
    }
  }

  const searchVideos = async (query: string, pageNum: number) => {
    if (selectedSource === 'pexels') {
      const response = await fetch(
        `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=20&page=${pageNum}`,
        {
          headers: {
            'Authorization': PEXELS_API_KEY
          }
        }
      )
      const data = await response.json()
      
      const pexelsVideos: StockVideo[] = data.videos.map((video: any) => ({
        id: video.id.toString(),
        url: video.video_files.find((f: any) => f.quality === 'hd')?.link || video.video_files[0].link,
        thumbnail: video.image,
        width: video.width,
        height: video.height,
        duration: video.duration,
        user: video.user.name,
        userUrl: video.user.url,
        source: 'pexels'
      }))
      
      if (pageNum === 1) {
        setVideos(pexelsVideos)
      } else {
        setVideos(prev => [...prev, ...pexelsVideos])
      }
    } else if (selectedSource === 'pixabay') {
      const response = await fetch(
        `https://pixabay.com/api/videos/?key=${PIXABAY_API_KEY}&q=${encodeURIComponent(query)}&safesearch=true&per_page=20&page=${pageNum}`
      )
      const data = await response.json()
      
      const pixabayVideos: StockVideo[] = data.hits.map((video: any) => ({
        id: video.id.toString(),
        url: video.videos.large?.url || video.videos.medium?.url || video.videos.small?.url,
        thumbnail: video.picture_id ? `https://i.vimeocdn.com/video/${video.picture_id}_640x360.jpg` : video.previewURL,
        width: video.videos.large?.width || video.videos.medium?.width || 640,
        height: video.videos.large?.height || video.videos.medium?.height || 360,
        duration: video.duration,
        user: video.user,
        userUrl: `https://pixabay.com/users/${video.user}-${video.user_id}/`,
        source: 'pixabay'
      }))
      
      if (pageNum === 1) {
        setVideos(pixabayVideos)
      } else {
        setVideos(prev => [...prev, ...pixabayVideos])
      }
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    searchMedia(searchQuery, 1)
  }

  const loadMore = () => {
    const nextPage = page + 1
    setPage(nextPage)
    searchMedia(searchQuery, nextPage)
  }

  const handleImageSelect = (image: StockImage) => {
    onSelectImage(image)
    onClose()
  }

  const handleVideoSelect = (video: StockVideo) => {
    onSelectVideo(video)
    onClose()
  }

  // Load popular content on open
  useEffect(() => {
    if (isOpen) {
      const popularQuery = type === 'image' ? 'abstract' : 'nature'
      searchMedia(popularQuery, 1)
    }
  }, [isOpen, type, selectedSource])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-iosbg rounded-lg p-6 max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">
            {type === 'image' ? '📸' : '🎬'} Stock {type === 'image' ? 'Images' : 'Videos'}
          </h3>
          <button 
            className="text-iossub hover:text-iostext"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        
        {/* Search and Source Selection */}
        <div className="mb-4 space-y-3">
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              placeholder={`Search ${type === 'image' ? 'images' : 'videos'}...`}
              className="ios-input flex-1"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            <button type="submit" className="ios-card px-4 py-2" disabled={loading}>
              {loading ? 'Searching...' : 'Search'}
            </button>
          </form>
          
          <div className="flex gap-2">
            <button
              className={`px-3 py-2 rounded text-sm ${
                selectedSource === 'pexels' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-200 text-gray-700'
              }`}
              onClick={() => setSelectedSource('pexels')}
            >
              Pexels
            </button>
            {type === 'image' && (
              <button
                className={`px-3 py-2 rounded text-sm ${
                  selectedSource === 'unsplash' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-200 text-gray-700'
                }`}
                onClick={() => setSelectedSource('unsplash')}
              >
                Unsplash
              </button>
            )}
            <button
              className={`px-3 py-2 rounded text-sm ${
                selectedSource === 'pixabay' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-200 text-gray-700'
              }`}
              onClick={() => setSelectedSource('pixabay')}
            >
              Pixabay
            </button>
          </div>
        </div>

        {/* Media Grid */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {type === 'image' ? (
              images.map((image) => (
                <div
                  key={image.id}
                  className="cursor-pointer group"
                  onClick={() => handleImageSelect(image)}
                >
                  <div className="aspect-square rounded-lg overflow-hidden bg-gray-200">
                    <img
                      src={image.thumbnail}
                      alt=""
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  </div>
                  <div className="mt-2 text-xs text-iossub">
                    <div className="truncate">{image.photographer}</div>
                    <div className="text-xs opacity-75">{image.source}</div>
                  </div>
                </div>
              ))
            ) : (
              videos.map((video) => (
                <div
                  key={video.id}
                  className="cursor-pointer group"
                  onClick={() => handleVideoSelect(video)}
                >
                  <div className="aspect-video rounded-lg overflow-hidden bg-gray-200 relative">
                    <img
                      src={video.thumbnail}
                      alt=""
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="bg-black bg-opacity-50 rounded-full p-2">
                        <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M8 5v10l8-5-8-5z"/>
                        </svg>
                      </div>
                    </div>
                    <div className="absolute bottom-2 right-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
                      {Math.floor(video.duration / 60)}:{(video.duration % 60).toString().padStart(2, '0')}
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-iossub">
                    <div className="truncate">{video.user}</div>
                    <div className="text-xs opacity-75">{video.source}</div>
                  </div>
                </div>
              ))
            )}
          </div>
          
          {loading && (
            <div className="text-center py-8 text-iossub">
              Loading more {type === 'image' ? 'images' : 'videos'}...
            </div>
          )}
          
          {!loading && (type === 'image' ? images.length > 0 : videos.length > 0) && (
            <div className="text-center py-4">
              <button
                className="ios-card px-4 py-2"
                onClick={loadMore}
              >
                Load More
              </button>
            </div>
          )}
        </div>

        <div className="mt-4 text-xs text-iossub text-center">
          Powered by {type === 'image' ? 'Pexels, Unsplash & Pixabay' : 'Pexels & Pixabay'} • Free to use
        </div>
      </div>
    </div>
  )
}
