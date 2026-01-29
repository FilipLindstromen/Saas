import { useState } from 'react'
import './ImagePicker.css'

function ImagePicker({ isOpen, onClose, onSelect, settings }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [images, setImages] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

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
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(searchQuery)}&per_page=20&orientation=landscape`,
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
    } catch (err) {
      console.error('Error searching images:', err)
      setError(err.message || 'Failed to search images. Please try again.')
      setImages([])
    } finally {
      setIsLoading(false)
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
          )}
        </div>
      </div>
    </div>
  )
}

export default ImagePicker
