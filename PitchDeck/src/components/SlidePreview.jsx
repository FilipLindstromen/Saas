import { useState, useRef, useEffect } from 'react'
import Slide from './Slide'
import ImagePicker from './ImagePicker'
import VideoPicker from './VideoPicker'
import InfographicPicker from './InfographicPicker'
import './SlidePreview.css'

const CAPTION_PREVIEW_STYLES = {
  'bottom-black': { position: 'bottom', bg: 'rgba(0,0,0,0.85)', fg: '#ffffff', outline: false },
  'bottom-white': { position: 'bottom', bg: 'rgba(255,255,255,0.9)', fg: '#111111', outline: false },
  'top-black': { position: 'top', bg: 'rgba(0,0,0,0.85)', fg: '#ffffff', outline: false },
  'top-white': { position: 'top', bg: 'rgba(255,255,255,0.9)', fg: '#111111', outline: false },
  'white-outline': { position: 'bottom', bg: 'transparent', fg: '#ffffff', outline: true },
  'large-white': { position: 'bottom', bg: 'rgba(0,0,0,0.75)', fg: '#ffffff', outline: false }
}

function SlidePreview({ slide, onUpdate, settings, backgroundColor = '#1a1a1a', textColor = '#ffffff', fontFamily = 'Inter', defaultTextSize = 4, h1Size = 10, h2Size = 3.5, h3Size = 2.5, h1FontFamily = '', h2FontFamily = '', h3FontFamily = '', defaultFontWeight = 700, h1Weight = 700, h2Weight = 700, h3Weight = 700, h1LineHeight = 1.2, h2LineHeight = 1.2, h3LineHeight = 1.2, textDropShadow, shadowBlur, shadowOffsetX, shadowOffsetY, shadowColor, textInlineBackground, inlineBgColor, inlineBgOpacity, inlineBgPadding, lineHeight = 1, bulletLineHeight = 1, bulletTextSize = 3, bulletGap = 0.5, contentBottomOffset = 12, contentEdgeOffset = 9, showBullets = true, recordSettings, analysisFolded = false, onToggleAnalysisFold, slideFormat = '16:9' }) {
  // Default recordSettings if not provided
  const safeRecordSettings = recordSettings || { webcamEnabled: false, selectedCameraId: '', microphoneEnabled: false, selectedMicrophoneId: '' }
  const [isSelectingImages, setIsSelectingImages] = useState(false)
  const [showImagePicker, setShowImagePicker] = useState(false)
  const [showVideoPicker, setShowVideoPicker] = useState(false)
  const [showInfographicPicker, setShowInfographicPicker] = useState(false)
  const [previewZoom, setPreviewZoom] = useState(() => {
    try {
      const saved = localStorage.getItem('pitchDeckPreviewZoom')
      if (saved) {
        const v = parseFloat(saved)
        if (v >= 0.5 && v <= 1.5) return v
      }
    } catch (e) {}
    return 1
  })
  const fileInputRef = useRef(null)

  useEffect(() => {
    try {
      localStorage.setItem('pitchDeckPreviewZoom', String(previewZoom))
    } catch (e) {}
  }, [previewZoom])

  const handleSelectImages = async () => {
    if (!settings.openaiKey || !settings.unsplashKey) {
      alert('Please set your OpenAI and Unsplash API keys in settings first.')
      return
    }
    if ((slide.layout || 'default') === 'video') {
      return // Skip fullscreen camera layout
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
        onUpdate({ imageUrl, backgroundOpacity: 0.6 })
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
    onUpdate({ imageUrl, backgroundOpacity: 0.6 })
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
        onUpdate({ imageUrl: dataUrl, backgroundOpacity: 0.6 })
      }
    }
    reader.onerror = () => {
      alert('Error reading image file. Please try again.')
    }
    reader.readAsDataURL(file)

    // Reset input so same file can be selected again
    e.target.value = ''
  }

  const handleRemoveImage = () => {
    onUpdate({ imageUrl: '' })
  }

  const handleVideoBackgroundSelect = (videoUrl) => {
    onUpdate({ backgroundVideoUrl: videoUrl || '' })
    setShowVideoPicker(false)
  }

  const handleRemoveVideoBackground = () => {
    onUpdate({ backgroundVideoUrl: '' })
  }

  const handleInfographicSelect = (projectId) => {
    onUpdate({ infographicProjectId: projectId || undefined })
    setShowInfographicPicker(false)
  }

  return (
    <div className="slide-preview">
      <div className="preview-header">
        <div className="preview-header-left">
          <h3>Preview</h3>
          <div className="preview-header-zoom">
            <label htmlFor="preview-zoom-slider">Zoom:</label>
            <input
              id="preview-zoom-slider"
              type="range"
              min="0.5"
              max="1.5"
              step="0.1"
              value={previewZoom}
              onChange={(e) => setPreviewZoom(parseFloat(e.target.value))}
              className="preview-zoom-slider"
              title="Zoom in or out on the slide preview"
            />
            <span className="preview-zoom-value">{Math.round(previewZoom * 100)}%</span>
          </div>
        </div>
        <div className="preview-header-actions">
          {(slide.layout || 'default') !== 'section' && (
            <>
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
                title="Choose image"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                <span className="btn-tooltip">Choose image</span>
              </button>
              <button
                className="btn-icon btn-select-images"
                onClick={handleSelectImages}
                disabled={isSelectingImages || !slide.content || (slide.layout || 'default') === 'video'}
                title={(slide.layout || 'default') === 'video' ? 'Not available for fullscreen camera layout' : 'Auto select image'}
              >
                {isSelectingImages ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3v18" />
                    <path d="M12 3l-2 2M12 3l2 2" />
                    <path d="M8 6l-1.5-1.5M16 6l1.5-1.5" />
                    <path d="M6 9l-1-1M18 9l1-1" />
                    <circle cx="12" cy="12" r="1" fill="currentColor" />
                  </svg>
                )}
                <span className="btn-tooltip">{isSelectingImages ? 'Selecting...' : 'Auto select image'}</span>
              </button>
              <button
                className="btn-icon btn-infographic-background"
                onClick={() => setShowInfographicPicker(true)}
                title="Infographic background"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <path d="M3 9h18M9 21V9" />
                </svg>
                <span className="btn-tooltip">Infographic background</span>
              </button>
              <button
                className="btn-icon btn-video-background"
                onClick={() => setShowVideoPicker(true)}
                disabled={!(settings.pexelsKey && settings.pexelsKey.trim()) && !(settings.pixabayKey && settings.pixabayKey.trim())}
                title="Video background"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="23 7 16 12 23 17 23 7" />
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                </svg>
                <span className="btn-tooltip">Video background</span>
              </button>
              {slide.imageUrl && (
                <>
                  <button
                    className="btn-icon btn-remove-image"
                    onClick={handleRemoveImage}
                    title="Remove Image"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                    <span className="btn-tooltip">Remove Image</span>
                  </button>
                </>
              )}
              {slide.infographicProjectId && (
                <button
                  className="btn-icon btn-remove-infographic"
                  onClick={() => onUpdate({ infographicProjectId: undefined })}
                  title="Remove infographic background"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <path d="M3 9h18M9 21V9" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                  </svg>
                  <span className="btn-tooltip">Remove infographic</span>
                </button>
              )}
              {slide.backgroundVideoUrl && (
                <button
                  className="btn-icon btn-remove-video"
                  onClick={handleRemoveVideoBackground}
                  title="Remove video background"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="23 7 16 12 23 17 23 7" />
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                  </svg>
                  <span className="btn-tooltip">Remove video</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>
      <div className="preview-content">
        <div
          className="preview-zoom-wrap"
          style={{
            transform: `scale(${previewZoom})`,
            transformOrigin: 'center center'
          }}
        >
          <div className={`preview-slide-wrap ${safeRecordSettings.captionsEnabled ? 'has-caption-preview' : ''}`}>
          <Slide 
            slide={slide} 
            backgroundColor={backgroundColor} 
            textColor={textColor} 
            fontFamily={fontFamily}
            defaultTextSize={defaultTextSize}
            h1Size={h1Size}
            h2Size={h2Size}
            h3Size={h3Size}
            h1FontFamily={h1FontFamily}
            h2FontFamily={h2FontFamily}
            h3FontFamily={h3FontFamily}
            webcamEnabled={safeRecordSettings.webcamEnabled}
            selectedCameraId={safeRecordSettings.selectedCameraId}
            webcamFlipHorizontal={safeRecordSettings.webcamFlipHorizontal === true}
            videoBrightness={typeof safeRecordSettings.videoBrightness === 'number' ? safeRecordSettings.videoBrightness : 1}
            videoContrast={typeof safeRecordSettings.videoContrast === 'number' ? safeRecordSettings.videoContrast : 1}
            videoSaturation={typeof safeRecordSettings.videoSaturation === 'number' ? safeRecordSettings.videoSaturation : 1}
            videoShadows={typeof safeRecordSettings.videoShadows === 'number' ? safeRecordSettings.videoShadows : 1}
            videoMidtones={typeof safeRecordSettings.videoMidtones === 'number' ? safeRecordSettings.videoMidtones : 1}
            videoHighlights={typeof safeRecordSettings.videoHighlights === 'number' ? safeRecordSettings.videoHighlights : 1}
            videoShadowHue={typeof safeRecordSettings.videoShadowHue === 'number' ? safeRecordSettings.videoShadowHue : 0}
            videoMidHue={typeof safeRecordSettings.videoMidHue === 'number' ? safeRecordSettings.videoMidHue : 0}
            videoHighlightHue={typeof safeRecordSettings.videoHighlightHue === 'number' ? safeRecordSettings.videoHighlightHue : 0}
            cameraOverrideEnabled={slide.cameraOverrideEnabled === true}
            cameraOverridePosition={slide.cameraOverridePosition || 'fullscreen'}
            textDropShadow={textDropShadow}
            shadowBlur={shadowBlur}
            shadowOffsetX={shadowOffsetX}
            shadowOffsetY={shadowOffsetY}
            shadowColor={shadowColor}
            textInlineBackground={textInlineBackground}
            inlineBgColor={inlineBgColor}
            inlineBgOpacity={inlineBgOpacity}
            inlineBgPadding={inlineBgPadding}
            lineHeight={lineHeight}
            bulletLineHeight={bulletLineHeight}
            bulletTextSize={bulletTextSize}
            bulletGap={bulletGap}
            contentBottomOffset={contentBottomOffset}
            contentEdgeOffset={contentEdgeOffset}
            showBullets={showBullets}
            defaultFontWeight={defaultFontWeight}
            h1Weight={h1Weight}
            h2Weight={h2Weight}
            h3Weight={h3Weight}
            h1LineHeight={h1LineHeight}
            h2LineHeight={h2LineHeight}
            h3LineHeight={h3LineHeight}
            onUpdate={onUpdate}
            textStyleMode={settings.textStyleMode || 'standard'}
            fontPairingSerifFont={settings.fontPairingSerifFont || 'Playfair Display'}
            slideFormat={slideFormat}
          />
          {safeRecordSettings.captionsEnabled && (
            <div className="caption-preview-in-slide">
              <span
                className={`caption-preview-bar caption-preview-size-${safeRecordSettings.captionFontSize || 'medium'}`}
                style={{
                  background: (CAPTION_PREVIEW_STYLES[safeRecordSettings.captionStyle] || CAPTION_PREVIEW_STYLES['bottom-black']).bg,
                  color: (CAPTION_PREVIEW_STYLES[safeRecordSettings.captionStyle] || CAPTION_PREVIEW_STYLES['bottom-black']).fg,
                  fontFamily: `${safeRecordSettings.captionFont || 'Poppins'}, sans-serif`,
                  textShadow: (CAPTION_PREVIEW_STYLES[safeRecordSettings.captionStyle] || CAPTION_PREVIEW_STYLES['bottom-black']).outline
                    ? '0 0 2px #000, 0 0 2px #000, 0 1px 2px #000'
                    : safeRecordSettings.captionDropShadow
                      ? '1px 1px 4px rgba(0,0,0,0.8)'
                      : 'none'
                }}
              >
                Sample caption
              </span>
            </div>
          )}
        </div>
        </div>
      </div>
      {slide.analysis && (
        <div className="preview-analysis">
          <div className="preview-analysis-header" onClick={onToggleAnalysisFold}>
            <div className="preview-analysis-label">Analysis:</div>
            <button className="preview-analysis-toggle" title={analysisFolded ? 'Expand' : 'Collapse'}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {analysisFolded ? (
                  <polyline points="9 18 15 12 9 6"></polyline>
                ) : (
                  <polyline points="6 9 12 15 18 9"></polyline>
                )}
              </svg>
            </button>
          </div>
          {!analysisFolded && (
            <div className="preview-analysis-text">{slide.analysis}</div>
          )}
        </div>
      )}
      <VideoPicker
        isOpen={showVideoPicker}
        onClose={() => setShowVideoPicker(false)}
        onSelect={handleVideoBackgroundSelect}
        settings={settings}
      />
      <InfographicPicker
        isOpen={showInfographicPicker}
        onClose={() => setShowInfographicPicker(false)}
        onSelect={handleInfographicSelect}
        currentProjectId={slide.infographicProjectId}
      />
      <ImagePicker
        isOpen={showImagePicker}
        onClose={() => setShowImagePicker(false)}
        onSelect={handleImageSelect}
        settings={settings}
        initialSearchQuery={(() => {
          // First check if there's a saved search query for this slide
          if (slide.unsplashSearchQuery) {
            return slide.unsplashSearchQuery
          }
          // Otherwise, extract text from content (strip HTML tags)
          const contentText = slide.content ? slide.content.replace(/<[^>]*>/g, '').trim() : ''
          // Use content if available, otherwise use subtitle
          const subtitleText = slide.subtitle ? slide.subtitle.replace(/<[^>]*>/g, '').trim() : ''
          // Prefer content, fallback to subtitle, or empty string
          return contentText || subtitleText || ''
        })()}
        onSearchQueryChange={(query) => {
          // Save the search query to the slide
          onUpdate({ unsplashSearchQuery: query })
        }}
      />
    </div>
  )
}

export default SlidePreview
