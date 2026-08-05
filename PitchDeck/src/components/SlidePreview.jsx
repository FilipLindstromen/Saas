import { useState, useRef, useEffect } from 'react'
import Slide from './Slide'
import { normalizeWebcamSizePercent } from '../utils/webcamSize'
import ImagePicker from './ImagePicker'
import VideoPicker from './VideoPicker'
import InfographicPicker from './InfographicPicker'
import GraphicPicker from './GraphicPicker'
import GenerateBackgroundModal from './GenerateBackgroundModal'
import GenerateOverlayModal from './GenerateOverlayModal'
import { createSubSlide } from '../utils/subSlides'
import { resolveMotionSettings } from '../utils/motionPresets'
import { generateMediaSearchQuery } from '../utils/mediaSearchQuery'
import { searchStockVideo } from '../api/videoSearch'
import { getExportCanvasSize } from '../utils/slideFormats'
import DrawingLayer, { DrawingToolbar } from './DrawingLayer'
import {
  DEFAULT_DRAWING_BRUSH_SIZE,
  normalizeDrawingPenColors,
} from '../utils/drawingDefaults'
import { drawingRelativePath } from '../utils/drawingStorage'
import './SlidePreview.css'

const CAPTION_PREVIEW_STYLES = {
  'bottom-black': { position: 'bottom', bg: 'rgba(0,0,0,0.85)', fg: '#ffffff', outline: false },
  'bottom-white': { position: 'bottom', bg: 'rgba(255,255,255,0.9)', fg: '#111111', outline: false },
  'top-black': { position: 'top', bg: 'rgba(0,0,0,0.85)', fg: '#ffffff', outline: false },
  'top-white': { position: 'top', bg: 'rgba(255,255,255,0.9)', fg: '#111111', outline: false },
  'white-outline': { position: 'bottom', bg: 'transparent', fg: '#ffffff', outline: true },
  'large-white': { position: 'bottom', bg: 'rgba(0,0,0,0.75)', fg: '#ffffff', outline: false }
}

function SlidePreview({ slide, onUpdate, selectedGraphicId, onSelectGraphic, onDeselectGraphic, selectedSubSlideId, onSelectSubSlide, onDeselectSubSlide, settings, backgroundColor = '#1a1a1a', textColor = '#ffffff', fontFamily = 'Inter', defaultTextSize = 4, h1Size = 10, h2Size = 3.5, h3Size = 2.5, h1FontFamily = '', h2FontFamily = '', h3FontFamily = '', defaultFontWeight = 700, h1Weight = 700, h2Weight = 700, h3Weight = 700, h1LineHeight = 1.2, h2LineHeight = 1.2, h3LineHeight = 1.2, textDropShadow, shadowBlur, shadowOffsetX, shadowOffsetY, shadowColor, textOutline, outlineWidth, outlineColor, textInlineBackground, inlineBgColor, inlineBgOpacity, inlineBgPadding, lineHeight = 1, bulletLineHeight = 1, bulletTextSize = 3, bulletGap = 0, bulletStyle = 'dot', contentBottomOffset = 12, contentEdgeOffset = 9, contentVerticalAlign = 'bottom', showBullets = true, recordSettings, slideFormat = '16:9', projectName = '', drawingPenColors, onDrawingPersist }) {
  // Default recordSettings if not provided
  const safeRecordSettings = recordSettings || { webcamEnabled: false, selectedCameraId: '', microphoneEnabled: false, selectedMicrophoneId: '', webcamFlipHorizontal: false, webcamFlipVertical: false }
  const [isSelectingImages, setIsSelectingImages] = useState(false)
  const [isSelectingVideos, setIsSelectingVideos] = useState(false)
  const [showImagePicker, setShowImagePicker] = useState(false)
  const [showVideoPicker, setShowVideoPicker] = useState(false)
  const [showInfographicPicker, setShowInfographicPicker] = useState(false)
  const [showGraphicPicker, setShowGraphicPicker] = useState(null) // 'giphy' | 'icon' | null
  const [showGenerateBackground, setShowGenerateBackground] = useState(false)
  const [showGenerateOverlay, setShowGenerateOverlay] = useState(false)
  const [backgroundMenuOpen, setBackgroundMenuOpen] = useState(false)
  const [overlayMenuOpen, setOverlayMenuOpen] = useState(false)
  const backgroundMenuRef = useRef(null)
  const overlayMenuRef = useRef(null)
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
  const [previewAnimKey, setPreviewAnimKey] = useState(0)
  const [motionPreviewOn, setMotionPreviewOn] = useState(() => settings?.editMotionPreview !== false)
  const resolvedMotion = resolveMotionSettings(
    { textAnimationMode: settings?.textAnimationMode || 'manual' },
    slide
  )
  const previewAnimationConfigured = !!(
    resolvedMotion.textAnimation && resolvedMotion.textAnimation !== 'none'
  )
  const liveMotionPreview = motionPreviewOn && previewAnimationConfigured && settings?.editMotionPreview !== false

  useEffect(() => {
    setMotionPreviewOn(settings?.editMotionPreview !== false)
  }, [settings?.editMotionPreview, slide?.id])
  const fileInputRef = useRef(null)
  const drawingLayerRef = useRef(null)
  const penColors = normalizeDrawingPenColors(drawingPenColors ?? settings?.drawingPenColors)
  const canvasSize = getExportCanvasSize(slideFormat || '16:9')
  const [drawingEnabled, setDrawingEnabled] = useState(false)
  const [drawTool, setDrawTool] = useState('pen')
  const [drawColor, setDrawColor] = useState(penColors[0])
  const [drawBrushSize, setDrawBrushSize] = useState(DEFAULT_DRAWING_BRUSH_SIZE)

  useEffect(() => {
    try {
      localStorage.setItem('pitchDeckPreviewZoom', String(previewZoom))
    } catch (e) {}
  }, [previewZoom])

  useEffect(() => {
    const closeMenus = (e) => {
      if (backgroundMenuRef.current && !backgroundMenuRef.current.contains(e.target)) {
        setBackgroundMenuOpen(false)
      }
      if (overlayMenuRef.current && !overlayMenuRef.current.contains(e.target)) {
        setOverlayMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', closeMenus)
    return () => document.removeEventListener('mousedown', closeMenus)
  }, [])

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
      const searchQuery = await generateMediaSearchQuery({
        slide,
        mediaType: 'image',
        openaiKey: settings.openaiKey,
      })

      if (!searchQuery) {
        alert('No slide text to search from.')
        return
      }

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
        const imageUrl = unsplashData.results[0].urls.regular
        onUpdate({ imageUrl, backgroundOpacity: 0.6, imageScale: 1.0, imageScaleCustomized: false })
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

  const handleSelectVideo = async () => {
    if (!settings.openaiKey) {
      alert('Please set your OpenAI API key in settings first.')
      return
    }
    if (!settings.pexelsKey?.trim() && !settings.pixabayKey?.trim()) {
      alert('Please set your Pexels or Pixabay API key in settings first.')
      return
    }
    if ((slide.layout || 'default') === 'video') {
      return
    }

    setIsSelectingVideos(true)
    try {
      const searchQuery = await generateMediaSearchQuery({
        slide,
        mediaType: 'video',
        openaiKey: settings.openaiKey,
      })

      if (!searchQuery) {
        alert('No slide text to search from.')
        return
      }

      const { url: videoUrl } = await searchStockVideo({
        query: searchQuery,
        pexelsKey: settings.pexelsKey,
        pixabayKey: settings.pixabayKey,
      })

      if (videoUrl) {
        onUpdate({
          backgroundVideoUrl: videoUrl,
          imageUrl: '',
          backgroundOpacity: 0.6,
          imageScale: 1.0,
          imageScaleCustomized: false,
        })
      } else {
        alert('No videos found. Try a different search query.')
      }
    } catch (error) {
      console.error('Error selecting video:', error)
      alert('Error selecting video. Please check your API keys and try again.')
    } finally {
      setIsSelectingVideos(false)
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
    onUpdate({ imageUrl, backgroundOpacity: 0.6, imageScale: 1.0, imageScaleCustomized: false })
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
        onUpdate({ imageUrl: dataUrl, backgroundOpacity: 0.6, imageScale: 1.0, imageScaleCustomized: false })
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
    onUpdate({ backgroundVideoUrl: videoUrl || '', imageScale: 1.0, imageScaleCustomized: false })
    setShowVideoPicker(false)
  }

  const handleRemoveVideoBackground = () => {
    onUpdate({ backgroundVideoUrl: '' })
  }

  const handleInfographicSelect = (projectId, tabId) => {
    onUpdate({ infographicProjectId: projectId || undefined, infographicTabId: tabId || undefined, imageScale: 1.0, imageScaleCustomized: false })
    setShowInfographicPicker(false)
  }

  const addGraphicOverlay = (url, type, size = 80) => {
    const overlays = Array.isArray(slide.graphicOverlays) ? [...slide.graphicOverlays] : []
    const id = 'g' + Date.now()
    overlays.push({
      id,
      type,
      url,
      x: 50,
      y: 50,
      width: size,
      height: size,
      rotation: 0,
      flipHorizontal: false
    })
    onUpdate({ graphicOverlays: overlays })
    onSelectGraphic?.(id)
    return id
  }

  const handleGraphicSelect = (url, source) => {
    addGraphicOverlay(url, source === 'iconify' ? 'icon' : 'giphy')
    setShowGraphicPicker(null)
  }

  const handleGeneratedOverlayApply = (imageUrl) => {
    addGraphicOverlay(imageUrl, 'generated', 200)
    setShowGenerateOverlay(false)
  }

  const handleAddSubSlide = () => {
    const subSlides = Array.isArray(slide.subSlides) ? [...slide.subSlides] : []
    const created = createSubSlide(subSlides.length)
    subSlides.push(created)
    onUpdate({ subSlides })
    onSelectSubSlide?.(created.id)
    onDeselectGraphic?.()
  }

  if (!slide) {
    return (
      <div className="slide-preview slide-preview-empty">
        <div className="preview-header">
          <h3>Preview</h3>
        </div>
        <p className="slide-preview-empty-msg">No slide to preview. Add a slide or choose a chapter that contains slides.</p>
      </div>
    )
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
          <button
            type="button"
            className={`preview-toolbar-group-btn ${drawingEnabled ? 'preview-toolbar-group-btn--active' : ''}`}
            onClick={() => setDrawingEnabled((v) => !v)}
            title="Draw on slide (top layer)"
          >
            Draw
          </button>
          {drawingEnabled && (
            <div className="preview-drawing-toolbar-wrap">
              <DrawingToolbar
                drawingEnabled={drawingEnabled}
                onToggleDrawing={() => setDrawingEnabled(false)}
                penColors={penColors}
                tool={drawTool}
                onToolChange={setDrawTool}
                color={drawColor}
                onColorChange={setDrawColor}
                brushSize={drawBrushSize}
                onBrushSizeChange={setDrawBrushSize}
                onClear={() => drawingLayerRef.current?.clear()}
              />
            </div>
          )}
          {previewAnimationConfigured && (
            <>
            <button
              type="button"
              className={`preview-toolbar-group-btn${liveMotionPreview ? ' preview-toolbar-group-btn--active' : ''}`}
              onClick={() => setMotionPreviewOn((v) => !v)}
              title="Toggle live text motion in preview"
            >
              Live motion
            </button>
            <button
              type="button"
              className="preview-toolbar-group-btn"
              onClick={() => setPreviewAnimKey((value) => value + 1)}
              title="Replay text and overlay animations"
            >
              Replay animation
            </button>
            </>
          )}
          {(slide.layout || 'default') !== 'section' && (
            <div className="preview-header-graphic-btns" ref={overlayMenuRef}>
              <button
                type="button"
                className="preview-toolbar-group-btn"
                onClick={() => { setOverlayMenuOpen((v) => !v); setBackgroundMenuOpen(false) }}
                aria-expanded={overlayMenuOpen}
              >
                Overlay
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
              </button>
              {overlayMenuOpen && (
                <div className="preview-toolbar-dropdown">
                  <button type="button" onClick={() => { setShowGraphicPicker('giphy'); setOverlayMenuOpen(false) }}>Add Giphy</button>
                  <button type="button" onClick={() => { setShowGraphicPicker('icon'); setOverlayMenuOpen(false) }}>Add icon</button>
                  <button
                    type="button"
                    onClick={() => { setShowGenerateOverlay(true); setOverlayMenuOpen(false) }}
                    disabled={!settings.openaiKey?.trim()}
                  >
                    Generate image…
                  </button>
                </div>
              )}
              <button
                type="button"
                className="preview-toolbar-group-btn preview-subslide-btn"
                onClick={handleAddSubSlide}
                title="Add a sub slide region (camera zoom target in present mode)"
              >
                Sub slide
              </button>
            </div>
          )}
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
              <div className="preview-toolbar-group" ref={backgroundMenuRef}>
                <button
                  type="button"
                  className="preview-toolbar-group-btn"
                  onClick={() => { setBackgroundMenuOpen((v) => !v); setOverlayMenuOpen(false) }}
                  aria-expanded={backgroundMenuOpen}
                >
                  Background
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
                </button>
                {backgroundMenuOpen && (
                  <div className="preview-toolbar-dropdown">
                    <button type="button" onClick={() => { handleUploadImage(); setBackgroundMenuOpen(false) }}>Upload image</button>
                    <button type="button" onClick={() => { handleSwapImage(); setBackgroundMenuOpen(false) }} disabled={!settings.unsplashKey}>Choose image</button>
                    <button type="button" onClick={() => { handleSelectImages(); setBackgroundMenuOpen(false) }} disabled={isSelectingImages || !slide.content || (slide.layout || 'default') === 'video'}>
                      {isSelectingImages ? 'Selecting…' : 'Auto-select image'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { handleSelectVideo(); setBackgroundMenuOpen(false) }}
                      disabled={isSelectingVideos || !slide.content || (slide.layout || 'default') === 'video' || !(settings.pexelsKey?.trim() || settings.pixabayKey?.trim()) || !settings.openaiKey?.trim()}
                    >
                      {isSelectingVideos ? 'Selecting…' : 'Auto-select video'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowGenerateBackground(true); setBackgroundMenuOpen(false) }}
                      disabled={(slide.layout || 'default') === 'video'}
                    >
                      Generate background…
                    </button>
                    <button type="button" onClick={() => { setShowInfographicPicker(true); setBackgroundMenuOpen(false) }}>Infographic</button>
                    <button type="button" onClick={() => { setShowVideoPicker(true); setBackgroundMenuOpen(false) }} disabled={!(settings.pexelsKey?.trim() || settings.pixabayKey?.trim())}>Video</button>
                    {slide.imageUrl && <button type="button" onClick={() => { handleRemoveImage(); setBackgroundMenuOpen(false) }}>Remove image</button>}
                    {slide.infographicProjectId && (
                      <button type="button" onClick={() => { onUpdate({ infographicProjectId: undefined, infographicTabId: undefined }); setBackgroundMenuOpen(false) }}>Remove infographic</button>
                    )}
                    {slide.backgroundVideoUrl && (
                      <button type="button" onClick={() => { handleRemoveVideoBackground(); setBackgroundMenuOpen(false) }}>Remove video</button>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      <div className="preview-content">
        <div
          className={`preview-zoom-wrap ${previewAnimationConfigured ? 'has-text-animation' : ''}`}
          style={{
            transform: `scale(${previewZoom})`,
            transformOrigin: 'center center'
          }}
        >
          <div className={`preview-slide-wrap preview-format-${(slideFormat || '16:9').replace(':', '-')}${safeRecordSettings.captionsEnabled ? ' has-caption-preview' : ''}${selectedGraphicId ? ' has-selected-graphic' : ''}${selectedSubSlideId ? ' has-selected-subslide' : ''}${drawingEnabled ? ' preview-slide-wrap--drawing' : ''}`}>
          <Slide 
            key={`${slide.id}-${previewAnimKey}`}
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
            webcamSize={normalizeWebcamSizePercent(safeRecordSettings.webcamSize)}
            webcamFlipHorizontal={safeRecordSettings.webcamFlipHorizontal === true}
            webcamFlipVertical={safeRecordSettings.webcamFlipVertical === true}
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
            textOutline={textOutline}
            outlineWidth={outlineWidth}
            outlineColor={outlineColor}
            textInlineBackground={textInlineBackground}
            inlineBgColor={inlineBgColor}
            inlineBgOpacity={inlineBgOpacity}
            inlineBgPadding={inlineBgPadding}
            lineHeight={lineHeight}
            bulletLineHeight={bulletLineHeight}
            bulletTextSize={bulletTextSize}
            bulletGap={bulletGap}
            bulletStyle={bulletStyle}
            contentBottomOffset={contentBottomOffset}
            contentEdgeOffset={contentEdgeOffset}
            contentVerticalAlign={contentVerticalAlign}
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
            previewTextAnimation={liveMotionPreview}
            motionPreviewInEdit={liveMotionPreview}
            deckTextAnimationMode={settings?.textAnimationMode || 'manual'}
            selectedGraphicId={selectedGraphicId}
            onSelectGraphic={onSelectGraphic}
            onDeselectGraphic={onDeselectGraphic}
            selectedSubSlideId={selectedSubSlideId}
            onSelectSubSlide={onSelectSubSlide}
            onDeselectSubSlide={onDeselectSubSlide}
          />
          <div className="slide-preview__drawing-wrap">
            <DrawingLayer
              ref={drawingLayerRef}
              slideId={slide.id}
              width={canvasSize.w}
              height={canvasSize.h}
              penColors={penColors}
              projectName={projectName}
              drawingEnabled={drawingEnabled}
              tool={drawTool}
              color={drawColor}
              brushSize={drawBrushSize}
              onDrawingPersist={(slideId, path) => {
                onDrawingPersist?.(slideId, path ? drawingRelativePath(slideId) : null)
              }}
            />
          </div>
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
        currentTabId={slide.infographicTabId}
      />
      <GraphicPicker
        isOpen={showGraphicPicker === 'giphy'}
        onClose={() => setShowGraphicPicker(null)}
        onSelect={handleGraphicSelect}
        presetService="giphy"
        presetType="stickers"
      />
      <GraphicPicker
        isOpen={showGraphicPicker === 'icon'}
        onClose={() => setShowGraphicPicker(null)}
        onSelect={handleGraphicSelect}
        presetService="iconify"
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
      <GenerateBackgroundModal
        isOpen={showGenerateBackground}
        onClose={() => setShowGenerateBackground(false)}
        onApply={onUpdate}
        slide={slide}
        settings={settings}
        slideFormat={slideFormat}
      />
      <GenerateOverlayModal
        isOpen={showGenerateOverlay}
        onClose={() => setShowGenerateOverlay(false)}
        onApply={handleGeneratedOverlayApply}
        slide={slide}
        settings={settings}
      />
    </div>
  )
}

export default SlidePreview
