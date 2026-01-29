import { useState, useEffect } from 'react'
import SlideList from './components/SlideList'
import SlidePreview from './components/SlidePreview'
import PlayMode from './components/PlayMode'
import PlanMode from './components/PlanMode'
import BottomMenu from './components/BottomMenu'
import Settings from './components/Settings'
import './App.css'

function App() {
  // Load slides and selectedSlideId from localStorage on initial mount
  const loadSavedData = () => {
    try {
      const savedSlides = localStorage.getItem('pitchDeckSlides')
      const savedSelectedId = localStorage.getItem('pitchDeckSelectedId')
      
      if (savedSlides) {
        const parsedSlides = JSON.parse(savedSlides)
        if (Array.isArray(parsedSlides) && parsedSlides.length > 0) {
          // Ensure all slides have layout, gradientStrength, flipHorizontal, backgroundOpacity, and gradientFlipped properties for backward compatibility
          const slidesWithLayout = parsedSlides.map(slide => ({
            ...slide,
            layout: slide.layout || 'default',
            gradientStrength: slide.gradientStrength !== undefined ? slide.gradientStrength : 0.7,
            flipHorizontal: slide.flipHorizontal !== undefined ? slide.flipHorizontal : false,
            backgroundOpacity: slide.backgroundOpacity !== undefined ? slide.backgroundOpacity : 1.0,
            gradientFlipped: slide.gradientFlipped !== undefined ? slide.gradientFlipped : false
          }))
          return {
            slides: slidesWithLayout,
            selectedId: savedSelectedId ? parseInt(savedSelectedId, 10) : slidesWithLayout[0].id
          }
        }
      }
    } catch (error) {
      console.error('Error loading saved data:', error)
    }
    
    // Default template if no saved data
    return {
      slides: [{ id: 1, content: 'IF YOU WANT TO FEEL CALM & IN CONTROL', imageUrl: '', layout: 'default', gradientStrength: 0.7, flipHorizontal: false, backgroundOpacity: 1.0, gradientFlipped: false }],
      selectedId: 1
    }
  }

  const initialData = loadSavedData()
  // Ensure selectedId exists in slides, fallback to first slide
  const validSelectedId = initialData.slides.find(s => s.id === initialData.selectedId) 
    ? initialData.selectedId 
    : initialData.slides[0]?.id || 1
  
  const [slides, setSlides] = useState(initialData.slides)
  const [selectedSlideId, setSelectedSlideId] = useState(validSelectedId)
  const [mode, setMode] = useState('edit') // 'plan', 'edit', 'present'
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState(() => {
    const savedSettings = {
      openaiKey: localStorage.getItem('openaiKey') || '',
      unsplashKey: localStorage.getItem('unsplashKey') || '',
      backgroundColor: localStorage.getItem('backgroundColor') || '#1a1a1a',
      textColor: localStorage.getItem('textColor') || '#ffffff',
      fontFamily: localStorage.getItem('fontFamily') || 'Inter',
      textDropShadow: localStorage.getItem('textDropShadow') === 'true',
      shadowBlur: parseInt(localStorage.getItem('shadowBlur')) || 4,
      shadowOffsetX: parseInt(localStorage.getItem('shadowOffsetX')) || 2,
      shadowOffsetY: parseInt(localStorage.getItem('shadowOffsetY')) || 2,
      shadowColor: localStorage.getItem('shadowColor') || '#000000',
      textInlineBackground: localStorage.getItem('textInlineBackground') === 'true',
      inlineBgColor: localStorage.getItem('inlineBgColor') || '#000000',
      inlineBgOpacity: parseFloat(localStorage.getItem('inlineBgOpacity')) || 0.7,
      inlineBgPadding: parseInt(localStorage.getItem('inlineBgPadding')) || 8
    }
    return savedSettings
  })

  // Save slides to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('pitchDeckSlides', JSON.stringify(slides))
    } catch (error) {
      console.error('Error saving slides:', error)
    }
  }, [slides])

  // Save selectedSlideId to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('pitchDeckSelectedId', selectedSlideId.toString())
    } catch (error) {
      console.error('Error saving selected slide ID:', error)
    }
  }, [selectedSlideId])

  // Load Google Fonts
  useEffect(() => {
    const fontFamily = settings.fontFamily || 'Inter'
    // Handle fonts with spaces (e.g., "Open Sans" becomes "Open+Sans")
    const fontFamilyEncoded = fontFamily.replace(/\s+/g, '+')
    const fontUrl = `https://fonts.googleapis.com/css2?family=${fontFamilyEncoded}:wght@400;600;700&display=swap`
    
    // Remove old font links
    const oldLinks = document.querySelectorAll('link[data-google-font]')
    oldLinks.forEach(link => link.remove())
    
    // Add new font link
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = fontUrl
    link.setAttribute('data-google-font', fontFamily)
    document.head.appendChild(link)
  }, [settings.fontFamily])

  // Save settings to localStorage
  useEffect(() => {
    if (settings.openaiKey) {
      localStorage.setItem('openaiKey', settings.openaiKey)
    }
    if (settings.unsplashKey) {
      localStorage.setItem('unsplashKey', settings.unsplashKey)
    }
    localStorage.setItem('backgroundColor', settings.backgroundColor)
    localStorage.setItem('textColor', settings.textColor)
    localStorage.setItem('fontFamily', settings.fontFamily)
    localStorage.setItem('textDropShadow', settings.textDropShadow ? 'true' : 'false')
    localStorage.setItem('shadowBlur', settings.shadowBlur?.toString() || '4')
    localStorage.setItem('shadowOffsetX', settings.shadowOffsetX?.toString() || '2')
    localStorage.setItem('shadowOffsetY', settings.shadowOffsetY?.toString() || '2')
    localStorage.setItem('shadowColor', settings.shadowColor || '#000000')
    localStorage.setItem('textInlineBackground', settings.textInlineBackground ? 'true' : 'false')
    localStorage.setItem('inlineBgColor', settings.inlineBgColor || '#000000')
    localStorage.setItem('inlineBgOpacity', settings.inlineBgOpacity?.toString() || '0.7')
    localStorage.setItem('inlineBgPadding', settings.inlineBgPadding?.toString() || '8')
  }, [settings])

  const addSlide = () => {
    const newId = Math.max(...slides.map(s => s.id), 0) + 1
    setSlides([...slides, { id: newId, content: '', imageUrl: '', layout: 'default', gradientStrength: 0.7, flipHorizontal: false, backgroundOpacity: 1.0, gradientFlipped: false }])
    setSelectedSlideId(newId)
  }

  const deleteSlide = (id) => {
    if (slides.length === 1) return
    setSlides(slides.filter(s => s.id !== id))
    if (selectedSlideId === id) {
      const index = slides.findIndex(s => s.id === id)
      const newSelected = index > 0 ? slides[index - 1].id : slides[index + 1]?.id
      setSelectedSlideId(newSelected)
    }
  }

  const updateSlide = (id, updates) => {
    setSlides(slides.map(s => s.id === id ? { ...s, ...updates } : s))
  }

  const updateSlides = (newSlides) => {
    setSlides(newSlides)
  }

  const selectedSlide = slides.find(s => s.id === selectedSlideId)

  // Present mode (fullscreen)
  if (mode === 'present') {
    return (
      <>
        <PlayMode 
          slides={slides} 
          onExit={() => setMode('edit')} 
          backgroundColor={settings.backgroundColor} 
          textColor={settings.textColor} 
          fontFamily={settings.fontFamily}
          textDropShadow={settings.textDropShadow}
          shadowBlur={settings.shadowBlur}
          shadowOffsetX={settings.shadowOffsetX}
          shadowOffsetY={settings.shadowOffsetY}
          shadowColor={settings.shadowColor}
          textInlineBackground={settings.textInlineBackground}
          inlineBgColor={settings.inlineBgColor}
          inlineBgOpacity={settings.inlineBgOpacity}
          inlineBgPadding={settings.inlineBgPadding}
          showMenu={true}
        />
        <BottomMenu currentMode={mode} onModeChange={setMode} />
      </>
    )
  }

  // Plan mode
  if (mode === 'plan') {
    return (
      <>
        <PlanMode slides={slides} onUpdateSlides={updateSlides} />
        <BottomMenu currentMode={mode} onModeChange={setMode} />
      </>
    )
  }

  return (
    <div className="app">
      <div className="app-header">
        <h1>Pitch Deck Generator</h1>
        <div className="header-actions">
          <button className="btn-settings" onClick={() => setShowSettings(true)}>
            🎨 Style & Settings
          </button>
        </div>
      </div>
      <div className="app-content" style={{ paddingBottom: '80px' }}>
        <SlideList
          slides={slides}
          selectedSlideId={selectedSlideId}
          onSelect={setSelectedSlideId}
          onAdd={addSlide}
          onDelete={deleteSlide}
          onUpdate={updateSlide}
        />
        <SlidePreview
          slide={selectedSlide}
          onUpdate={(updates) => updateSlide(selectedSlideId, updates)}
          settings={settings}
          backgroundColor={settings.backgroundColor}
          textColor={settings.textColor}
          fontFamily={settings.fontFamily}
          textDropShadow={settings.textDropShadow}
          shadowBlur={settings.shadowBlur}
          shadowOffsetX={settings.shadowOffsetX}
          shadowOffsetY={settings.shadowOffsetY}
          shadowColor={settings.shadowColor}
          textInlineBackground={settings.textInlineBackground}
          inlineBgColor={settings.inlineBgColor}
          inlineBgOpacity={settings.inlineBgOpacity}
          inlineBgPadding={settings.inlineBgPadding}
        />
      </div>
      {showSettings && (
        <Settings
          settings={settings}
          onUpdate={setSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
      <BottomMenu currentMode={mode} onModeChange={setMode} />
    </div>
  )
}

export default App
