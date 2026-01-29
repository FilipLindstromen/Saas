import { useState, useEffect } from 'react'
import './ImagePicker.css'

function ImagePicker({ isOpen, onClose, onSelect, settings, initialSearchQuery = '' }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [images, setImages] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [hasMore, setHasMore] = useState(false)

  // When modal opens with initial search query, set it and search
  useEffect(() => {
    if (isOpen && initialSearchQuery) {
      setSearchQuery(initialSearchQuery)
      // Trigger search automatically
      if (settings.unsplashKey && initialSearchQuery.trim()) {
        const performSearch = async () => {
          setIsLoading(true)
          setError(null)

          try {
            const response = await fetch(
              `https://api.unsplash.com/search/photos?query=${encodeURIComponent(initialSearchQuery)}&per_page=20&page=1&orientation=landscape`,
              {
                headers: {
                  'Authorization': `Client-ID ${settings.unsplashKey}`
                }
              }
            )

            if (!response.ok) {
              throw new Error('Failed to search images. Please check your API key.')
            }

            const data = await response.json()
            setImages(data.results || [])
            setCurrentPage(1)
            setTotalPages(data.total_pages || 1)
            setHasMore(data.total_pages > 1)
          } catch (err) {
            console.error('Error searching images:', err)
            setError(err.message || 'Failed to search images. Please try again.')
            setImages([])
            setHasMore(false)
          } finally {
            setIsLoading(false)
          }
        }
        performSearch()
      }
    } else if (isOpen && !initialSearchQuery) {
      // Reset when opening without initial query
      setSearchQuery('')
      setImages([])
      setError(null)
      setCurrentPage(1)
      setTotalPages(1)
      setHasMore(false)
    }
  }, [isOpen, initialSearchQuery, settings.unsplashKey])

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!searchQuery.trim() || !settings.unsplashKey) {
      setError('Please enter a search query and set your Unsplash API key.')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(searchQuery)}&per_page=20&page=1&orientation=landscape`,
        {
          headers: {
            'Authorization': `Client-ID ${settings.unsplashKey}`
          }
        }
      )

      if (!response.ok) {
        throw new Error('Failed to search images. Please check your API key.')
      }

      const data = await response.json()
      setImages(data.results || [])
      setCurrentPage(1)
      setTotalPages(data.total_pages || 1)
      setHasMore(data.total_pages > 1)
    } catch (err) {
      console.error('Error searching images:', err)
      setError(err.message || 'Failed to search images. Please try again.')
      setImages([])
      setHasMore(false)
    } finally {
      setIsLoading(false)
    }
  }

  const handleLoadMore = async () => {
    if (!searchQuery.trim() || !settings.unsplashKey || isLoadingMore || !hasMore) {
      return
    }

    const nextPage = currentPage + 1
    setIsLoadingMore(true)
    setError(null)

    try {
      const response = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(searchQuery)}&per_page=20&page=${nextPage}&orientation=landscape`,
        {
          headers: {
            'Authorization': `Client-ID ${settings.unsplashKey}`
          }
        }
      )

      if (!response.ok) {
        throw new Error('Failed to load more images. Please check your API key.')
      }

      const data = await response.json()
      setImages(prevImages => [...prevImages, ...(data.results || [])])
      setCurrentPage(nextPage)
      setHasMore(nextPage < (data.total_pages || 1))
    } catch (err) {
      console.error('Error loading more images:', err)
      setError(err.message || 'Failed to load more images. Please try again.')
    } finally {
      setIsLoadingMore(false)
    }
  }

  const handleSelectImage = (imageUrl) => {
    onSelect(imageUrl)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="image-picker-overlay" onClick={onClose}>
      <div className="image-picker-modal" onClick={(e) => e.stopPropagation()}>
        <div className="image-picker-header">
          <h2>Select Image from Unsplash</h2>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>
        <div className="image-picker-search">
          <form onSubmit={handleSearch}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for images..."
              className="image-search-input"
            />
            <button type="submit" className="btn-search" disabled={isLoading || !settings.unsplashKey}>
              {isLoading ? 'Searching...' : 'Search'}
            </button>
          </form>
          {error && <div className="image-picker-error">{error}</div>}
        </div>
        <div className="image-picker-content">
          {isLoading && (
            <div className="image-picker-loading">Loading images...</div>
          )}
          {!isLoading && images.length === 0 && searchQuery && (
            <div className="image-picker-empty">No images found. Try a different search term.</div>
          )}
          {!isLoading && images.length === 0 && !searchQuery && (
            <div className="image-picker-empty">Enter a search term to find images.</div>
          )}
          {!isLoading && images.length > 0 && (
            <>
              <div className="image-grid">
                {images.map((image) => (
                  <div
                    key={image.id}
                    className="image-item"
                    onClick={() => handleSelectImage(image.urls.regular)}
                  >
                    <img
                      src={image.urls.thumb}
                      alt={image.alt_description || 'Unsplash image'}
                      loading="lazy"
                    />
                    <div className="image-overlay">
                      <span className="image-select-hint">Click to select</span>
                    </div>
                  </div>
                ))}
              </div>
              {hasMore && (
                <div className="image-picker-load-more">
                  <button
                    className="btn-load-more"
                    onClick={handleLoadMore}
                    disabled={isLoadingMore || !settings.unsplashKey}
                  >
                    {isLoadingMore ? 'Loading...' : 'Load More'}
                  </button>
                  <div className="image-picker-pagination">
                    Page {currentPage} of {totalPages}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default ImagePicker
