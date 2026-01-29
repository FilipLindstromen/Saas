import { useState, useEffect, useCallback, useRef } from 'react'
import Slide from './Slide'
import './PlayMode.css'

function PlayMode({ slides, onExit, backgroundColor = '#1a1a1a', textColor = '#ffffff', fontFamily = 'Inter', h1Size = 5, h2Size = 3.5, h3Size = 2.5, h1FontFamily = '', h2FontFamily = '', h3FontFamily = '', showMenu = false, textDropShadow, shadowBlur, shadowOffsetX, shadowOffsetY, shadowColor, textInlineBackground, inlineBgColor, inlineBgOpacity, inlineBgPadding, initialSlideId }) {
  // Filter out section slides for presentation
  const presentationSlides = slides.filter(slide => (slide.layout || 'default') !== 'section')
  
  // Find the initial index based on initialSlideId in the filtered slides, or default to 0
  const getInitialIndex = () => {
    if (initialSlideId && presentationSlides.length > 0) {
      const index = presentationSlides.findIndex(slide => slide.id === initialSlideId)
      return index >= 0 ? index : 0
    }
    return 0
  }
  
  const [currentIndex, setCurrentIndex] = useState(getInitialIndex)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [transitionPhase, setTransitionPhase] = useState('idle') // 'idle', 'fade-out', 'fade-in'
  const [visibleBulletIndex, setVisibleBulletIndex] = useState(-1)

  // Get bullet points for current slide
  const getBulletPoints = (slide) => {
    if (!slide || (slide.layout || 'default') !== 'bulletpoints') return []
    return slide.content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => line.replace(/^[-•*]\s*/, ''))
  }

  const currentSlide = presentationSlides[currentIndex]
  const bulletPoints = getBulletPoints(currentSlide)
  const isBulletSlide = (currentSlide?.layout || 'default') === 'bulletpoints'

  const nextSlide = useCallback(() => {
    setCurrentIndex((prevIndex) => {
      if (prevIndex < presentationSlides.length - 1) {
        const nextIndex = prevIndex + 1
        setIsTransitioning(true)
        setVisibleBulletIndex(-1) // Reset bullet animation
        
        // Phase 1: Fade out current slide
        setTransitionPhase('fade-out')
        
        setTimeout(() => {
          // Phase 2: Change slide (while invisible)
          setCurrentIndex(nextIndex)
          
          // Phase 3: Fade in new slide
          setTimeout(() => {
            setTransitionPhase('fade-in')
            setTimeout(() => {
              setIsTransitioning(false)
              setTransitionPhase('idle')
            }, 300) // Fade in duration
          }, 50) // Small delay to ensure slide change
        }, 300) // Fade out duration
        
        return prevIndex // Keep current index during fade-out
      }
      return prevIndex
    })
  }, [presentationSlides.length])

  const prevSlide = useCallback(() => {
    setCurrentIndex((prevIndex) => {
      if (prevIndex > 0) {
        const nextIndex = prevIndex - 1
        setIsTransitioning(true)
        setVisibleBulletIndex(-1) // Reset bullet animation
        
        // Phase 1: Fade out current slide
        setTransitionPhase('fade-out')
        
        setTimeout(() => {
          // Phase 2: Change slide (while invisible)
          setCurrentIndex(nextIndex)
          
          // Phase 3: Fade in new slide
          setTimeout(() => {
            setTransitionPhase('fade-in')
            setTimeout(() => {
              setIsTransitioning(false)
              setTransitionPhase('idle')
            }, 300) // Fade in duration
          }, 50) // Small delay to ensure slide change
        }, 300) // Fade out duration
        
        return prevIndex // Keep current index during fade-out
      }
      return prevIndex
    })
  }, [])

  // Reset bullet index when slide changes
  useEffect(() => {
    setVisibleBulletIndex(-1)
  }, [currentIndex])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (document.fullscreenElement) {
          document.exitFullscreen()
        } else {
          onExit()
        }
        return
      } else if ((e.key === 'ArrowRight' || e.key === ' ') && !isTransitioning) {
        e.preventDefault()
        // If it's a bullet slide and not all bullets are visible, show next bullet
        if (isBulletSlide && visibleBulletIndex < bulletPoints.length - 1) {
          setVisibleBulletIndex(prev => prev + 1)
        } else {
          nextSlide()
        }
      } else if (e.key === 'ArrowLeft' && !isTransitioning) {
        e.preventDefault()
        // If it's a bullet slide and some bullets are visible, hide last bullet
        if (isBulletSlide && visibleBulletIndex >= 0) {
          setVisibleBulletIndex(prev => prev - 1)
        } else {
          prevSlide()
        }
      } else if (e.key === 'ArrowDown' && !isTransitioning) {
        e.preventDefault()
        // If it's a bullet slide and not all bullets are visible, show next bullet
        if (isBulletSlide && visibleBulletIndex < bulletPoints.length - 1) {
          setVisibleBulletIndex(prev => prev + 1)
        } else {
          nextSlide()
        }
      } else if (e.key === 'ArrowUp' && !isTransitioning) {
        e.preventDefault()
        // If it's a bullet slide and some bullets are visible, hide last bullet
        if (isBulletSlide && visibleBulletIndex >= 0) {
          setVisibleBulletIndex(prev => prev - 1)
        } else {
          prevSlide()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isTransitioning, onExit, nextSlide, prevSlide, isBulletSlide, visibleBulletIndex, bulletPoints.length])

  const handleClick = (e) => {
    if (isTransitioning) return
    
    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const width = rect.width
    
    if (clickX > width / 2) {
      // Right side: next bullet or next slide
      if (isBulletSlide && visibleBulletIndex < bulletPoints.length - 1) {
        setVisibleBulletIndex(prev => prev + 1)
      } else {
        nextSlide()
      }
    } else {
      // Left side: previous bullet or previous slide
      if (isBulletSlide && visibleBulletIndex >= 0) {
        setVisibleBulletIndex(prev => prev - 1)
      } else {
        prevSlide()
      }
    }
  }

  const [isFullscreen, setIsFullscreen] = useState(false)

  // Automatically enter fullscreen when component mounts
  useEffect(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error('Error attempting to enable fullscreen:', err)
      })
    }
  }, [])

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!document.fullscreenElement
      setIsFullscreen(isCurrentlyFullscreen)
      
      // If fullscreen is exited, return to edit mode
      if (!isCurrentlyFullscreen) {
        onExit()
      }
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [onExit])

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error('Error attempting to enable fullscreen:', err)
      })
    } else {
      document.exitFullscreen()
    }
  }

  if (presentationSlides.length === 0) {
    return (
      <div className="play-mode">
        <div className="play-empty">No slides to play</div>
        <button className="btn-exit" onClick={onExit}>Exit</button>
      </div>
    )
  }

  return (
    <div className="play-mode" onClick={handleClick} style={{ paddingBottom: showMenu ? '80px' : '0' }}>
      <div className={`play-slide-container ${transitionPhase === 'fade-out' ? 'fade-out' : transitionPhase === 'fade-in' ? 'fade-in' : 'visible'}`}>
        <Slide 
          slide={presentationSlides[currentIndex]} 
          backgroundColor={backgroundColor}
          textColor={textColor}
          fontFamily={fontFamily}
          h1Size={h1Size}
          h2Size={h2Size}
          h3Size={h3Size}
          h1FontFamily={h1FontFamily}
          h2FontFamily={h2FontFamily}
          h3FontFamily={h3FontFamily}
          isPlayMode={true}
          visibleBulletIndex={visibleBulletIndex}
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
      {!showMenu && (
        <div className="play-controls">
          <div className="play-slide-indicator">
            {currentIndex + 1} / {presentationSlides.length}
          </div>
          <button className="btn-exit" onClick={onExit}>Exit</button>
        </div>
      )}
    </div>
  )
}

export default PlayMode
