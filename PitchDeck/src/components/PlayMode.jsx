import { useState, useEffect, useCallback } from 'react'
import Slide from './Slide'
import './PlayMode.css'

function PlayMode({ slides, onExit, backgroundColor = '#1a1a1a', textColor = '#ffffff', fontFamily = 'Inter', h1Size = 5, h2Size = 3.5, h3Size = 2.5, h1FontFamily = '', h2FontFamily = '', h3FontFamily = '', showMenu = false, textDropShadow, shadowBlur, shadowOffsetX, shadowOffsetY, shadowColor, textInlineBackground, inlineBgColor, inlineBgOpacity, inlineBgPadding }) {
  const [currentIndex, setCurrentIndex] = useState(0)
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

  const currentSlide = slides[currentIndex]
  const bulletPoints = getBulletPoints(currentSlide)
  const isBulletSlide = (currentSlide?.layout || 'default') === 'bulletpoints'

  const nextSlide = useCallback(() => {
    setCurrentIndex((prevIndex) => {
      if (prevIndex < slides.length - 1) {
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
  }, [slides.length])

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

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error('Error attempting to enable fullscreen:', err)
      })
    } else {
      document.exitFullscreen()
    }
  }

  if (slides.length === 0) {
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
          slide={slides[currentIndex]} 
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
            {currentIndex + 1} / {slides.length}
          </div>
          <button className="btn-exit" onClick={onExit}>Exit</button>
        </div>
      )}
    </div>
  )
}

export default PlayMode
