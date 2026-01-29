import { useState, useRef } from 'react'
import Slide from './Slide'
import ImagePicker from './ImagePicker'
import './SlidePreview.css'

function SlidePreview({ slide, onUpdate, settings, backgroundColor = '#1a1a1a', textColor = '#ffffff', fontFamily = 'Inter', textDropShadow, shadowBlur, shadowOffsetX, shadowOffsetY, shadowColor, textInlineBackground, inlineBgColor, inlineBgOpacity, inlineBgPadding }) {
  const [isSelectingImages, setIsSelectingImages] = useState(false)
  const [showImagePicker, setShowImagePicker] = useState(false)
  const fileInputRef = useRef(null)

  const handleSelectImages = async () => {
    if (!settings.openaiKey || !settings.unsplashKey) {
      alert('Please set your OpenAI and Unsplash API keys in settings first.')
      return
    }

    setIsSelectingImages(true)
    try {
      // Use OpenAI to generate a search query based on slide content
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.openaiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are a helpful assistant that generates concise, descriptive search queries for finding images on Unsplash. Return only a single search query (2-4 words) that best represents the content and mood of the text.'
            },
            {
              role: 'user',
              content: `Generate an Unsplash search query for this slide text: "${slide.content}"`
            }
          ],
          max_tokens: 20
        })
      })

      const data = await response.json()
      const searchQuery = data.choices[0].message.content.trim().replace(/['"]/g, '')

      // Search Unsplash for images
      const unsplashResponse = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(searchQuery)}&per_page=5&orientation=landscape`,
        {
          headers: {
            'Authorization': `Client-ID ${settings.unsplashKey}`
          }
        }
      )

      const unsplashData = await unsplashResponse.json()
      
      if (unsplashData.results && unsplashData.results.length > 0) {
        // Use the first result
        const imageUrl = unsplashData.results[0].urls.regular
        onUpdate({ imageUrl })
      } else {
        alert('No images found. Try a different search query.')
      }
    } catch (error) {
      console.error('Error selecting image:', error)
      alert('Error selecting image. Please check your API keys and try again.')
    } finally {
      setIsSelectingImages(false)
    }
  }

  if (!slide) {
    return (
      <div className="slide-preview">
        <div className="preview-empty">No slide selected</div>
      </div>
    )
  }

  const handleSwapImage = () => {
    if (!settings.unsplashKey) {
      alert('Please set your Unsplash API key in settings first.')
      return
    }
    setShowImagePicker(true)
  }

  const handleImageSelect = (imageUrl) => {
    onUpdate({ imageUrl })
  }

  const handleUploadImage = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file.')
      return
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('Image file size must be less than 10MB.')
      return
    }

    // Convert to data URL
    const reader = new FileReader()
    reader.onload = (event) => {
      const dataUrl = event.target?.result
      if (dataUrl) {
        onUpdate({ imageUrl: dataUrl })
      }
    }
    reader.onerror = () => {
      alert('Error reading image file. Please try again.')
    }
    reader.readAsDataURL(file)

    // Reset input so same file can be selected again
    e.target.value = ''
  }

  return (
    <div className="slide-preview">
      <div className="preview-header">
        <h3>Preview</h3>
        <div className="preview-header-actions">
          {(slide.layout || 'default') !== 'centered' && (
            <>
              <div className="gradient-control">
                <label htmlFor="slide-gradient-strength">Gradient:</label>
                <input
                  id="slide-gradient-strength"
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={slide.gradientStrength !== undefined ? slide.gradientStrength : 0.7}
                  onChange={(e) => onUpdate({ gradientStrength: parseFloat(e.target.value) })}
                  className="gradient-slider"
                />
                <span className="gradient-value">{Math.round((slide.gradientStrength !== undefined ? slide.gradientStrength : 0.7) * 100)}%</span>
              </div>
              <button
                className={`btn-icon btn-flip-gradient ${slide.gradientFlipped ? 'active' : ''}`}
                onClick={() => onUpdate({ gradientFlipped: !slide.gradientFlipped })}
                title="Flip Gradient Direction"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12h-8M3 12h8M12 3l-9 9 9 9M12 21l9-9-9-9" />
                </svg>
                <span className="btn-tooltip">Flip Gradient</span>
              </button>
            </>
          )}
          <div className="gradient-control">
            <label htmlFor="slide-background-opacity">Image:</label>
            <input
              id="slide-background-opacity"
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={slide.backgroundOpacity !== undefined ? slide.backgroundOpacity : 1.0}
              onChange={(e) => onUpdate({ backgroundOpacity: parseFloat(e.target.value) })}
              className="gradient-slider"
            />
            <span className="gradient-value">{Math.round((slide.backgroundOpacity !== undefined ? slide.backgroundOpacity : 1.0) * 100)}%</span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          <button
            className="btn-icon btn-upload-image"
            onClick={handleUploadImage}
            title="Upload Image"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span className="btn-tooltip">Upload Image</span>
          </button>
          <button
            className="btn-icon btn-swap-image"
            onClick={handleSwapImage}
            disabled={!settings.unsplashKey}
            title="Swap Image"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            <span className="btn-tooltip">Swap Image</span>
          </button>
          <button
            className="btn-icon btn-select-images"
            onClick={handleSelectImages}
            disabled={isSelectingImages || !slide.content}
            title="Select Images"
          >
            {isSelectingImages ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            )}
            <span className="btn-tooltip">{isSelectingImages ? 'Selecting...' : 'Select Images'}</span>
          </button>
          {slide.imageUrl && (
            <button
              className={`btn-icon btn-flip-image ${slide.flipHorizontal ? 'active' : ''}`}
              onClick={() => onUpdate({ flipHorizontal: !slide.flipHorizontal })}
              title="Flip Image Horizontally"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12h-8M3 12h8M12 3l-9 9 9 9M12 21l9-9-9-9" />
              </svg>
              <span className="btn-tooltip">Flip Image</span>
            </button>
          )}
        </div>
      </div>
      <div className="preview-content">
        <Slide 
          slide={slide} 
          backgroundColor={backgroundColor} 
          textColor={textColor} 
          fontFamily={fontFamily}
          textDropShadow={textDropShadow}
          shadowBlur={shadowBlur}
          shadowOffsetX={shadowOffsetX}
          shadowOffsetY={shadowOffsetY}
          shadowColor={shadowColor}
          textInlineBackground={textInlineBackground}
          inlineBgColor={inlineBgColor}
          inlineBgOpacity={inlineBgOpacity}
          inlineBgPadding={inlineBgPadding}
        />
      </div>
      <ImagePicker
        isOpen={showImagePicker}
        onClose={() => setShowImagePicker(false)}
        onSelect={handleImageSelect}
        settings={settings}
      />
    </div>
  )
}

export default SlidePreview
