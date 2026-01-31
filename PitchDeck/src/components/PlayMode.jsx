import { useState, useEffect, useCallback, useRef } from 'react'
import Slide from './Slide'
import './PlayMode.css'

// Webcam overlay component - separate from slide transitions
function WebcamOverlay({ cameraId, layout, webcamSize = 'large', isVisible = true }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const containerRef = useRef(null)
  const prevLayoutRef = useRef(layout)
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight })

  // Update dimensions on resize
  useEffect(() => {
    const handleResize = () => {
      setDimensions({ width: window.innerWidth, height: window.innerHeight })
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Get webcam size based on setting
  const getWebcamSize = () => {
    switch (webcamSize) {
      case 'small': return { width: '15%', minWidth: '100px', minHeight: '100px' }
      case 'medium': return { width: '20%', minWidth: '120px', minHeight: '120px' }
      case 'large': return { width: '25%', minWidth: '150px', minHeight: '150px' }
      default: return { width: '20%', minWidth: '120px', minHeight: '120px' }
    }
  }

  // Get webcam position based on layout
  // Always use top/left positioning with explicit pixel values for smooth CSS transitions
  const getWebcamPosition = () => {
    if (layout === 'video') {
      return { 
        top: 0, 
        left: 0, 
        width: dimensions.width,
        height: dimensions.height
      }
    }
    
    if (layout === 'left-video') {
      // Full height on right third of slide
      const rightPanelWidth = dimensions.width / 3
      return {
        top: 0,
        left: dimensions.width - rightPanelWidth,
        width: rightPanelWidth,
        height: dimensions.height
      }
    }
    
    // Calculate webcam size in pixels
    const webcamWidth = dimensions.width * (webcamSize === 'small' ? 0.15 : webcamSize === 'medium' ? 0.20 : 0.25)
    const webcamHeight = webcamWidth // Square aspect ratio
    
    // Calculate position from top-left for smooth transitions
    const bottomOffset = dimensions.height * 0.04 // 4% from bottom
    const sideOffset = dimensions.width * 0.04 // 4% from side
    
    if (layout === 'right') {
      // Bottom-left: calculate top position
      return { 
        top: dimensions.height - bottomOffset - webcamHeight,
        left: sideOffset,
        width: webcamWidth,
        height: webcamHeight
      }
    }
    // Default: bottom-right - calculate top and left positions
    return { 
      top: dimensions.height - bottomOffset - webcamHeight,
      left: dimensions.width - sideOffset - webcamWidth,
      width: webcamWidth,
      height: webcamHeight
    }
  }

  useEffect(() => {
    if (!cameraId || !isVisible) return

    const startStream = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: cameraId } }
        })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          streamRef.current = stream
        }
      } catch (error) {
        console.error('Error accessing camera:', error)
      }
    }

    startStream()

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [cameraId, isVisible])

  // Update transition when layout changes - ensure smooth transition
  useEffect(() => {
    if (prevLayoutRef.current !== layout && containerRef.current) {
      // Use requestAnimationFrame to ensure the browser has rendered the current position
      // before applying the new position, enabling smooth transitions in both directions
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          // Force a reflow to ensure the browser recognizes the current position
          if (containerRef.current) {
            containerRef.current.offsetHeight
          }
        })
      })
      prevLayoutRef.current = layout
    }
  }, [layout, dimensions])

  if (!isVisible || !cameraId) return null

  const size = getWebcamSize()
  const position = getWebcamPosition()
  const isFullscreen = layout === 'video'

  // Build style object with all properties explicitly set for smooth transitions
  // Always use top/left positioning with explicit pixel values for seamless transitions
  // This ensures CSS can smoothly interpolate between all values (small to big and vice versa)
  const style = {
    position: 'fixed',
    top: `${position.top}px`,
    left: `${position.left}px`,
    width: `${position.width}px`,
    height: isFullscreen ? `${position.height}px` : `${position.height}px`, // Always use explicit height
    minWidth: isFullscreen ? '0' : size.minWidth,
    minHeight: isFullscreen ? '0' : size.minHeight,
    maxWidth: 'none',
    maxHeight: 'none',
    aspectRatio: (isFullscreen || layout === 'left-video') ? 'auto' : '1 / 1',
    borderRadius: (isFullscreen || layout === 'left-video') ? '0' : '50%',
    clipPath: (isFullscreen || layout === 'left-video') ? 'none' : 'circle(50% at center)',
    WebkitClipPath: (isFullscreen || layout === 'left-video') ? 'none' : 'circle(50% at center)',
    zIndex: 1000,
    pointerEvents: 'none'
  }

  return (
    <div
      ref={containerRef}
      className="play-webcam-overlay"
      style={style}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          position: 'absolute',
          top: '0',
          left: '0',
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          borderRadius: 'inherit'
        }}
      />
    </div>
  )
}

function PlayMode({ slides, onExit, backgroundColor = '#1a1a1a', textColor = '#ffffff', fontFamily = 'Inter', h1Size = 5, h2Size = 3.5, h3Size = 2.5, h1FontFamily = '', h2FontFamily = '', h3FontFamily = '', showMenu = false, textDropShadow, shadowBlur, shadowOffsetX, shadowOffsetY, shadowColor, textInlineBackground, inlineBgColor, inlineBgOpacity, inlineBgPadding, initialSlideId, transitionStyle = 'default', lineHeight = 1.4, bulletLineHeight = 1.4, recordSettings = { webcamEnabled: false, selectedCameraId: '', microphoneEnabled: false, selectedMicrophoneId: '' }, isRecording = false }) {
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
  const [slideKey, setSlideKey] = useState(0) // Force re-render on slide change
  
  // Recording state
  const [recordingState, setRecordingState] = useState('idle') // 'idle', 'recording', 'stopping'
  const mediaRecorderRef = useRef(null)
  const recordedChunksRef = useRef([])
  const screenStreamRef = useRef(null)
  const audioStreamRef = useRef(null)
  const combinedStreamRef = useRef(null)
  const isStartingRecordingRef = useRef(false) // Prevent multiple simultaneous recording starts

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

  // Get transition duration based on style
  const getTransitionDuration = (style) => {
    switch (style) {
      case 'dissolve':
        return 500 // 0.5s
      case 'sequence':
        return 600 // 0.6s
      case 'blur':
        return 400 // 0.4s
      case 'zoom':
        return 300 // 0.3s
      case 'slide':
        return 300 // 0.3s
      default:
        return 300 // 0.3s
    }
  }

  const nextSlide = useCallback(() => {
    setCurrentIndex((prevIndex) => {
      if (prevIndex < presentationSlides.length - 1) {
        const nextIndex = prevIndex + 1
        setIsTransitioning(true)
        setVisibleBulletIndex(-1) // Reset bullet animation
        
        const duration = getTransitionDuration(transitionStyle)
        
        // Phase 1: Start fade-out animation
        setTransitionPhase('fade-out')
        
        // Wait for fade-out animation to complete
        setTimeout(() => {
          // Phase 2: Set fade-in phase FIRST to prevent flicker
          setTransitionPhase('fade-in')
          // Use double requestAnimationFrame to ensure phase is set before slide change
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              // Phase 3: Change slide (now it will render with fade-in class)
              // Update state outside of the callback to avoid nested state updates
              setCurrentIndex(nextIndex)
              setSlideKey(prev => prev + 1) // Force re-render with new slide
              
              // Phase 4: Wait for fade-in animation to complete
              setTimeout(() => {
                setIsTransitioning(false)
                setTransitionPhase('idle')
              }, duration) // Fade in duration
            })
          })
        }, duration) // Fade out duration
        
        return prevIndex // Keep current index during fade-out
      }
      return prevIndex
    })
  }, [presentationSlides.length, transitionStyle])

  const prevSlide = useCallback(() => {
    setCurrentIndex((prevIndex) => {
      if (prevIndex > 0) {
        const nextIndex = prevIndex - 1
        setIsTransitioning(true)
        setVisibleBulletIndex(-1) // Reset bullet animation
        
        const duration = getTransitionDuration(transitionStyle)
        
        // Phase 1: Start fade-out animation
        setTransitionPhase('fade-out')
        
        // Wait for fade-out animation to complete
        setTimeout(() => {
          // Phase 2: Set fade-in phase FIRST to prevent flicker
          setTransitionPhase('fade-in')
          // Use double requestAnimationFrame to ensure phase is set before slide change
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              // Phase 3: Change slide (now it will render with fade-in class)
              // Update state outside of the callback to avoid nested state updates
              setCurrentIndex(nextIndex)
              setSlideKey(prev => prev + 1) // Force re-render with new slide
              
              // Phase 4: Wait for fade-in animation to complete
              setTimeout(() => {
                setIsTransitioning(false)
                setTransitionPhase('idle')
              }, duration) // Fade in duration
            })
          })
        }, duration) // Fade out duration
        
        return prevIndex // Keep current index during fade-out
      }
      return prevIndex
    })
  }, [transitionStyle])

  // Reset bullet index when slide changes
  useEffect(() => {
    setVisibleBulletIndex(-1)
  }, [currentIndex])

  // Auto-enter fullscreen and start recording when entering record mode
  useEffect(() => {
    if (isRecording && recordingState === 'idle' && !isStartingRecordingRef.current) {
      // Prevent multiple simultaneous calls
      isStartingRecordingRef.current = true
      
      // Request fullscreen first, then start recording
      const enterFullscreenAndRecord = async () => {
        try {
          // Enter fullscreen first
          if (!document.fullscreenElement) {
            await document.documentElement.requestFullscreen()
          }
          
          // Wait for fullscreen to be active before requesting screen share
          // This ensures we're in fullscreen when the dialog appears
          let attempts = 0
          while (!document.fullscreenElement && attempts < 20) {
            await new Promise(resolve => setTimeout(resolve, 50))
            attempts++
          }
          
          // Small additional delay to ensure fullscreen is fully active
          await new Promise(resolve => setTimeout(resolve, 300))
          
          // Now start recording (this will show the screen share dialog)
          // But we're already in fullscreen, so it won't exit
          if (recordingState === 'idle' && !screenStreamRef.current) {
            await startRecording()
          } else {
            isStartingRecordingRef.current = false
          }
        } catch (err) {
          console.warn('Could not enter fullscreen or start recording:', err)
          isStartingRecordingRef.current = false
        }
      }
      
      enterFullscreenAndRecord()
    } else if (!isRecording && recordingState === 'recording') {
      stopRecording()
      isStartingRecordingRef.current = false
    }
    
    // Cleanup on unmount
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop())
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop())
      }
      if (combinedStreamRef.current) {
        combinedStreamRef.current.getTracks().forEach(track => track.stop())
      }
      isStartingRecordingRef.current = false
    }
  }, [isRecording, recordingState])

  const startRecording = async () => {
    try {
      // Don't set recording state until we actually have the stream
      // This prevents the effect from running multiple times
      recordedChunksRef.current = []

      // Get screen capture - this will show the browser's native dialog
      // We can't bypass this for security reasons, but we're already in fullscreen
      // The dialog will appear, but we're already in fullscreen so it won't exit
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { 
          mediaSource: 'screen',
          displaySurface: 'monitor' // Prefer entire screen
        },
        audio: false
      })
      
      // Only set recording state after we have the stream
      setRecordingState('recording')
      isStartingRecordingRef.current = false
      screenStreamRef.current = screenStream

      // Get audio if microphone is enabled
      let audioStream = null
      if (recordSettings.microphoneEnabled && recordSettings.selectedMicrophoneId) {
        try {
          audioStream = await navigator.mediaDevices.getUserMedia({
            audio: { deviceId: { exact: recordSettings.selectedMicrophoneId } }
          })
          audioStreamRef.current = audioStream
        } catch (error) {
          console.warn('Could not access microphone:', error)
        }
      }

      // Combine streams
      const combinedStream = new MediaStream()
      screenStream.getVideoTracks().forEach(track => combinedStream.addTrack(track))
      if (audioStream) {
        audioStream.getAudioTracks().forEach(track => combinedStream.addTrack(track))
      }
      combinedStreamRef.current = combinedStream

      // Create MediaRecorder
      const options = {
        mimeType: 'video/webm;codecs=vp9,opus',
        videoBitsPerSecond: 2500000
      }
      
      // Fallback to other codecs if vp9 is not supported
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = 'video/webm;codecs=vp8,opus'
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
          options.mimeType = 'video/webm'
        }
      }

      const mediaRecorder = new MediaRecorder(combinedStream, options)
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `presentation-recording-${new Date().toISOString().split('T')[0]}.webm`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
        
        // Cleanup streams
        if (screenStreamRef.current) {
          screenStreamRef.current.getTracks().forEach(track => track.stop())
        }
        if (audioStreamRef.current) {
          audioStreamRef.current.getTracks().forEach(track => track.stop())
        }
        if (combinedStreamRef.current) {
          combinedStreamRef.current.getTracks().forEach(track => track.stop())
        }
        
        setRecordingState('idle')
      }

      // Handle screen share stop - don't exit fullscreen, just stop recording
      screenStream.getVideoTracks()[0].onended = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          stopRecording()
        }
        isStartingRecordingRef.current = false
        // Don't exit fullscreen when screen share stops
        // The user can exit manually with ESC
      }

      mediaRecorder.start(1000) // Collect data every second
    } catch (error) {
      console.error('Error starting recording:', error)
      setRecordingState('idle')
      isStartingRecordingRef.current = false
      alert('Failed to start recording. Please check your permissions.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      setRecordingState('stopping')
      mediaRecorderRef.current.stop()
    }
    isStartingRecordingRef.current = false
  }

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

  const currentSlideLayout = currentSlide?.layout || 'default'
  const nextSlideLayout = presentationSlides[currentIndex + 1]?.layout || currentSlideLayout

  return (
    <div className="play-mode" onClick={handleClick} style={{ paddingBottom: showMenu ? '80px' : '0' }}>
      <div 
        key={slideKey}
        className={`play-slide-container transition-${transitionStyle} ${transitionPhase === 'fade-out' ? 'fade-out' : transitionPhase === 'fade-in' ? 'fade-in' : 'visible'}`}
      >
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
          webcamEnabled={false}
          selectedCameraId=""
          shadowOffsetY={shadowOffsetY}
          shadowColor={shadowColor}
          textInlineBackground={textInlineBackground}
          inlineBgColor={inlineBgColor}
          inlineBgOpacity={inlineBgOpacity}
          inlineBgPadding={inlineBgPadding}
          lineHeight={lineHeight}
          bulletLineHeight={bulletLineHeight}
        />
      </div>
      {/* Webcam overlay - outside slide transitions */}
      {recordSettings.webcamEnabled && recordSettings.selectedCameraId && (
        <WebcamOverlay
          cameraId={recordSettings.selectedCameraId}
          layout={currentSlideLayout}
          webcamSize={recordSettings.webcamSize || 'large'}
          isVisible={true}
        />
      )}
      {!showMenu && (
        <div className="play-controls">
          <div className="play-slide-indicator">
            {currentIndex + 1} / {presentationSlides.length}
          </div>
          {isRecording && recordingState === 'recording' && (
            <div className="recording-indicator">
              <span className="recording-dot"></span>
              <span>Recording</span>
            </div>
          )}
          <button className="btn-exit" onClick={onExit}>Exit</button>
        </div>
      )}
    </div>
  )
}

export default PlayMode
