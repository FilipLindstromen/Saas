import { useState, useEffect, useRef } from 'react'
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
          // Ensure all slides have layout, gradientStrength, flipHorizontal, backgroundOpacity, gradientFlipped, and subtitle properties for backward compatibility
          const slidesWithLayout = parsedSlides.map(slide => ({
            ...slide,
            layout: slide.layout || 'default',
            gradientStrength: slide.gradientStrength !== undefined ? slide.gradientStrength : 0.7,
            flipHorizontal: slide.flipHorizontal !== undefined ? slide.flipHorizontal : false,
            backgroundOpacity: slide.backgroundOpacity !== undefined ? slide.backgroundOpacity : 1.0,
            gradientFlipped: slide.gradientFlipped !== undefined ? slide.gradientFlipped : false,
            subtitle: slide.subtitle || '',
            imageScale: slide.imageScale !== undefined ? slide.imageScale : 1.0,
            imagePositionX: slide.imagePositionX !== undefined ? slide.imagePositionX : 50,
            imagePositionY: slide.imagePositionY !== undefined ? slide.imagePositionY : 50
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
      slides: [{ id: 1, content: 'IF YOU WANT TO FEEL CALM & IN CONTROL', subtitle: '', imageUrl: '', layout: 'default', gradientStrength: 0.7, flipHorizontal: false, backgroundOpacity: 1.0, gradientFlipped: false, imageScale: 1.0, imagePositionX: 50, imagePositionY: 50 }],
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
  const fileInputRef = useRef(null)
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('sidebarWidth')
    return saved ? parseInt(saved, 10) : 350
  })
  const [isResizing, setIsResizing] = useState(false)
  const sidebarRef = useRef(null)
  const [settings, setSettings] = useState(() => {
    const savedSettings = {
      openaiKey: localStorage.getItem('openaiKey') || '',
      unsplashKey: localStorage.getItem('unsplashKey') || '',
      backgroundColor: localStorage.getItem('backgroundColor') || '#1a1a1a',
      textColor: localStorage.getItem('textColor') || '#ffffff',
      fontFamily: localStorage.getItem('fontFamily') || 'Inter',
      h1Size: parseFloat(localStorage.getItem('h1Size')) || 5,
      h2Size: parseFloat(localStorage.getItem('h2Size')) || 3.5,
      h3Size: parseFloat(localStorage.getItem('h3Size')) || 2.5,
      h1FontFamily: localStorage.getItem('h1FontFamily') || '',
      h2FontFamily: localStorage.getItem('h2FontFamily') || '',
      h3FontFamily: localStorage.getItem('h3FontFamily') || '',
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

  // Save sidebar width to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('sidebarWidth', sidebarWidth.toString())
    } catch (error) {
      console.error('Error saving sidebar width:', error)
    }
  }, [sidebarWidth])

  // Handle sidebar resize
  const handleResizeStart = (e) => {
    e.preventDefault()
    setIsResizing(true)
  }

  useEffect(() => {
    const handleResizeMove = (e) => {
      if (!isResizing) return
      const newWidth = e.clientX
      // Constrain width between 250px and 600px
      const constrainedWidth = Math.max(250, Math.min(600, newWidth))
      setSidebarWidth(constrainedWidth)
    }

    const handleResizeEnd = () => {
      setIsResizing(false)
    }

    if (isResizing) {
      window.addEventListener('mousemove', handleResizeMove)
      window.addEventListener('mouseup', handleResizeEnd)
      return () => {
        window.removeEventListener('mousemove', handleResizeMove)
        window.removeEventListener('mouseup', handleResizeEnd)
      }
    }
  }, [isResizing])

  // Load Google Fonts
  useEffect(() => {
    const fontsToLoad = new Set()
    const fontFamily = settings.fontFamily || 'Inter'
    fontsToLoad.add(fontFamily)
    
    // Add heading fonts if they're different
    if (settings.h1FontFamily && settings.h1FontFamily !== fontFamily) {
      fontsToLoad.add(settings.h1FontFamily)
    }
    if (settings.h2FontFamily && settings.h2FontFamily !== fontFamily) {
      fontsToLoad.add(settings.h2FontFamily)
    }
    if (settings.h3FontFamily && settings.h3FontFamily !== fontFamily) {
      fontsToLoad.add(settings.h3FontFamily)
    }
    
    // Remove old font links
    const oldLinks = document.querySelectorAll('link[data-google-font]')
    oldLinks.forEach(link => link.remove())
    
    // Load each unique font
    fontsToLoad.forEach(font => {
      const fontFamilyEncoded = font.replace(/\s+/g, '+')
      const fontUrl = `https://fonts.googleapis.com/css2?family=${fontFamilyEncoded}:wght@400;600;700&display=swap`
      
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = fontUrl
      link.setAttribute('data-google-font', font)
      document.head.appendChild(link)
    })
  }, [settings.fontFamily, settings.h1FontFamily, settings.h2FontFamily, settings.h3FontFamily])

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
    localStorage.setItem('h1Size', settings.h1Size?.toString() || '5')
    localStorage.setItem('h2Size', settings.h2Size?.toString() || '3.5')
    localStorage.setItem('h3Size', settings.h3Size?.toString() || '2.5')
    if (settings.h1FontFamily) {
      localStorage.setItem('h1FontFamily', settings.h1FontFamily)
    } else {
      localStorage.removeItem('h1FontFamily')
    }
    if (settings.h2FontFamily) {
      localStorage.setItem('h2FontFamily', settings.h2FontFamily)
    } else {
      localStorage.removeItem('h2FontFamily')
    }
    if (settings.h3FontFamily) {
      localStorage.setItem('h3FontFamily', settings.h3FontFamily)
    } else {
      localStorage.removeItem('h3FontFamily')
    }
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

  // Keyboard navigation for slide selection (only in edit mode)
  useEffect(() => {
    if (mode !== 'edit') return

    const handleKeyDown = (e) => {
      // Don't handle arrow keys if user is typing in an input/textarea
      const activeElement = document.activeElement
      const isInputFocused = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.isContentEditable
      )

      if (isInputFocused) return

      // Handle up/down arrow keys for slide navigation
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        const currentIndex = slides.findIndex(s => s.id === selectedSlideId)
        if (currentIndex > 0) {
          setSelectedSlideId(slides[currentIndex - 1].id)
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        const currentIndex = slides.findIndex(s => s.id === selectedSlideId)
        if (currentIndex < slides.length - 1) {
          setSelectedSlideId(slides[currentIndex + 1].id)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [mode, slides, selectedSlideId])

  const addSlide = () => {
    const newId = Math.max(...slides.map(s => s.id), 0) + 1
    setSlides([...slides, { id: newId, content: '', subtitle: '', imageUrl: '', layout: 'default', gradientStrength: 0.7, flipHorizontal: false, backgroundOpacity: 1.0, gradientFlipped: false, imageScale: 1.0, imagePositionX: 50, imagePositionY: 50 }])
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

  const duplicateSlide = (id) => {
    const slideToDuplicate = slides.find(s => s.id === id)
    if (!slideToDuplicate) return
    
    const newId = Math.max(...slides.map(s => s.id), 0) + 1
    const duplicatedSlide = {
      ...slideToDuplicate,
      id: newId,
      content: slideToDuplicate.content || '',
      subtitle: slideToDuplicate.subtitle || ''
    }
    
    const slideIndex = slides.findIndex(s => s.id === id)
    const newSlides = [...slides]
    newSlides.splice(slideIndex + 1, 0, duplicatedSlide)
    setSlides(newSlides)
    setSelectedSlideId(newId)
  }

  const updateSlide = (id, updates) => {
    setSlides(slides.map(s => s.id === id ? { ...s, ...updates } : s))
  }

  const updateSlides = (newSlides) => {
    setSlides(newSlides)
  }

  // Export all data to a file
  const handleExportFile = () => {
    const exportData = {
      version: '1.0',
      slides: slides,
      selectedSlideId: selectedSlideId,
      settings: settings,
      exportedAt: new Date().toISOString()
    }

    const dataStr = JSON.stringify(exportData, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `pitch-deck-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Import data from a file
  const handleImportFile = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const importData = JSON.parse(event.target?.result || '{}')
        
        // Validate the imported data
        if (!importData.slides || !Array.isArray(importData.slides)) {
          alert('Invalid file format. The file must contain slides data.')
          return
        }

        // Ensure all slides have required properties
        const slidesWithLayout = importData.slides.map(slide => ({
          ...slide,
          layout: slide.layout || 'default',
          gradientStrength: slide.gradientStrength !== undefined ? slide.gradientStrength : 0.7,
          flipHorizontal: slide.flipHorizontal !== undefined ? slide.flipHorizontal : false,
          backgroundOpacity: slide.backgroundOpacity !== undefined ? slide.backgroundOpacity : 1.0,
          gradientFlipped: slide.gradientFlipped !== undefined ? slide.gradientFlipped : false,
          subtitle: slide.subtitle || '',
          imageScale: slide.imageScale !== undefined ? slide.imageScale : 1.0,
          imagePositionX: slide.imagePositionX !== undefined ? slide.imagePositionX : 50,
          imagePositionY: slide.imagePositionY !== undefined ? slide.imagePositionY : 50
        }))

        // Confirm before importing (to avoid losing current work)
        const confirmMessage = `This will replace your current ${slides.length} slide(s) with ${slidesWithLayout.length} slide(s) from the file. Continue?`
        if (!window.confirm(confirmMessage)) {
          e.target.value = '' // Reset file input
          return
        }

        // Load slides
        setSlides(slidesWithLayout)
        
        // Load selected slide ID (validate it exists)
        const validSelectedId = slidesWithLayout.find(s => s.id === importData.selectedSlideId)
          ? importData.selectedSlideId
          : slidesWithLayout[0]?.id || 1
        setSelectedSlideId(validSelectedId)

        // Load settings if provided
        if (importData.settings) {
          setSettings(importData.settings)
        }

        alert(`Successfully imported ${slidesWithLayout.length} slide(s)!`)
      } catch (error) {
        console.error('Error importing file:', error)
        alert('Error importing file. Please make sure it is a valid JSON file.')
      }
    }

    reader.onerror = () => {
      alert('Error reading file. Please try again.')
    }

    reader.readAsText(file)
    
    // Reset file input so same file can be selected again
    e.target.value = ''
  }

  // Bulk select images for all slides without images
  const handleBulkSelectImages = async () => {
    if (!settings.openaiKey || !settings.unsplashKey) {
      alert('Please set your OpenAI and Unsplash API keys in settings first.')
      return
    }

    // Find slides without images
    const slidesWithoutImages = slides.filter(slide => !slide.imageUrl || slide.imageUrl.trim() === '')
    
    if (slidesWithoutImages.length === 0) {
      alert('All slides already have images!')
      return
    }

    const confirmMessage = `This will automatically select images for ${slidesWithoutImages.length} slide(s). This may take a moment. Continue?`
    if (!window.confirm(confirmMessage)) {
      return
    }

    // Process slides one by one
    const updatedSlides = [...slides]
    let successCount = 0
    let failCount = 0

    for (let i = 0; i < slidesWithoutImages.length; i++) {
      const slide = slidesWithoutImages[i]
      
      try {
        // Get slide content (remove HTML tags)
        const tempDiv = document.createElement('div')
        tempDiv.innerHTML = slide.content || ''
        const slideText = tempDiv.textContent || tempDiv.innerText || ''
        
        if (!slideText.trim()) {
          failCount++
          continue
        }

        // Use OpenAI to generate a search query
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
                content: `Generate an Unsplash search query for this slide text: "${slideText}"`
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
          const imageUrl = unsplashData.results[0].urls.regular
          const slideIndex = updatedSlides.findIndex(s => s.id === slide.id)
          if (slideIndex !== -1) {
            updatedSlides[slideIndex] = { ...updatedSlides[slideIndex], imageUrl }
            successCount++
          }
        } else {
          failCount++
        }

        // Add a small delay to avoid rate limiting
        if (i < slidesWithoutImages.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      } catch (error) {
        console.error(`Error selecting image for slide ${slide.id}:`, error)
        failCount++
      }
    }

    setSlides(updatedSlides)
    
    const message = `Image selection complete!\n${successCount} image(s) added successfully.${failCount > 0 ? `\n${failCount} slide(s) could not be processed.` : ''}`
    alert(message)
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
          h1Size={settings.h1Size}
          h2Size={settings.h2Size}
          h3Size={settings.h3Size}
          h1FontFamily={settings.h1FontFamily}
          h2FontFamily={settings.h2FontFamily}
          h3FontFamily={settings.h3FontFamily}
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
      <div className="app plan-mode-app">
        <div className="app-header">
          <div className="header-left">
            <h1>Pitch Deck Generator</h1>
            <div className="header-file-actions">
              <button className="btn-icon-header btn-export" onClick={handleExportFile} title="Save to file">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </button>
              <button className="btn-icon-header btn-import" onClick={handleImportFile} title="Load from file">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  <polyline points="12 11 12 17" />
                  <line x1="9" y1="14" x2="15" y2="14" />
                </svg>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
            </div>
          </div>
          <div className="header-actions">
            <div className="header-actions-row">
              <button 
                className="btn-icon-header btn-bulk-images" 
                onClick={handleBulkSelectImages}
                title="Auto-select images for all slides without images"
                disabled={!settings.openaiKey || !settings.unsplashKey}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
              </button>
            </div>
            <div className="header-actions-row">
              <button className="btn-icon-header btn-settings" onClick={() => setShowSettings(true)} title="Style & Settings">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 1v6m0 6v6M5.64 5.64l4.24 4.24m4.24 4.24l4.24 4.24M1 12h6m6 0h6M5.64 18.36l4.24-4.24m4.24-4.24l4.24-4.24" />
                </svg>
              </button>
            </div>
          </div>
        </div>
        <div className="app-content plan-mode-content" style={{ paddingBottom: '80px' }}>
          <PlanMode slides={slides} onUpdateSlides={updateSlides} />
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

  return (
    <div className="app">
      <div className="app-header">
        <div className="header-left">
          <h1>Pitch Deck Generator</h1>
          <div className="header-file-actions">
            <button className="btn-icon-header btn-export" onClick={handleExportFile} title="Save to file">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </button>
            <button className="btn-icon-header btn-import" onClick={handleImportFile} title="Load from file">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                <polyline points="12 11 12 17" />
                <line x1="9" y1="14" x2="15" y2="14" />
              </svg>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </div>
        </div>
        <div className="header-actions">
          <div className="header-actions-row">
            <button 
              className="btn-icon-header btn-bulk-images" 
              onClick={handleBulkSelectImages}
              title="Auto-select images for all slides without images"
              disabled={!settings.openaiKey || !settings.unsplashKey}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </button>
          </div>
          <div className="header-actions-row">
            <button className="btn-icon-header btn-settings" onClick={() => setShowSettings(true)} title="Style & Settings">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 1v6m0 6v6M5.64 5.64l4.24 4.24m4.24 4.24l4.24 4.24M1 12h6m6 0h6M5.64 18.36l4.24-4.24m4.24-4.24l4.24-4.24" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      <div className={`app-content ${isResizing ? 'resizing' : ''}`} style={{ paddingBottom: '80px' }}>
        <div 
          ref={sidebarRef}
          className="sidebar-container"
          style={{ width: `${sidebarWidth}px`, minWidth: `${sidebarWidth}px`, maxWidth: `${sidebarWidth}px` }}
        >
          <SlideList
            slides={slides}
            selectedSlideId={selectedSlideId}
            onSelect={setSelectedSlideId}
            onAdd={addSlide}
            onDelete={deleteSlide}
            onDuplicate={duplicateSlide}
            onUpdate={updateSlide}
          />
        </div>
        <div 
          className="resize-handle"
          onMouseDown={handleResizeStart}
          style={{ cursor: 'col-resize' }}
        />
        <SlidePreview
          slide={selectedSlide}
          onUpdate={(updates) => updateSlide(selectedSlideId, updates)}
          settings={settings}
          backgroundColor={settings.backgroundColor}
          textColor={settings.textColor}
          fontFamily={settings.fontFamily}
          h1Size={settings.h1Size}
          h2Size={settings.h2Size}
          h3Size={settings.h3Size}
          h1FontFamily={settings.h1FontFamily}
          h2FontFamily={settings.h2FontFamily}
          h3FontFamily={settings.h3FontFamily}
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
