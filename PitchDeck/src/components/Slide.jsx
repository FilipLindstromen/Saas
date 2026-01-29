import { useState, useEffect, useRef, useCallback } from 'react'
import './Slide.css'

function Slide({ slide, backgroundColor = '#1a1a1a', textColor = '#ffffff', fontFamily = 'Inter', h1Size = 5, h2Size = 3.5, h3Size = 2.5, h1FontFamily = '', h2FontFamily = '', h3FontFamily = '', isPlayMode = false, visibleBulletIndex = null, textDropShadow = false, shadowBlur = 4, shadowOffsetX = 2, shadowOffsetY = 2, shadowColor = '#000000', textInlineBackground = false, inlineBgColor = '#000000', inlineBgOpacity = 0.7, inlineBgPadding = 8, onUpdate }) {
  if (!slide) return null

  // Refs to track if contentEditable elements are being edited
  const contentRef = useRef(null)
  const subtitleRef = useRef(null)
  const isEditingContentRef = useRef(false)
  const isEditingSubtitleRef = useRef(false)

  const layout = slide.layout || 'default'
  const gradientStrength = slide.gradientStrength !== undefined ? slide.gradientStrength : 0.7
  const backgroundOpacity = slide.backgroundOpacity !== undefined ? slide.backgroundOpacity : 1.0
  const gradientFlipped = slide.gradientFlipped !== undefined ? slide.gradientFlipped : false
  const imageScale = slide.imageScale !== undefined ? slide.imageScale : 1.0
  const imagePositionX = slide.imagePositionX !== undefined ? slide.imagePositionX : 50
  const imagePositionY = slide.imagePositionY !== undefined ? slide.imagePositionY : 50

  // Convert hex color to RGB
  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 26, g: 26, b: 26 } // Default dark grey
  }

  const rgb = hexToRgb(backgroundColor)
  
  // Calculate gradient opacity based on strength (0-1)
  const maxOpacity = gradientStrength
  const midOpacity = gradientStrength * 0.57 // ~0.4 when strength is 0.7

  // Parse bullet points (one per line)
  const getBulletPoints = () => {
    if (layout !== 'bulletpoints') return []
    return slide.content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => line.replace(/^[-•*]\s*/, '')) // Remove bullet markers if present
  }

  // Convert line breaks to HTML breaks for display
  const formatContentForDisplay = (content) => {
    if (!content) return ''
    // If content already contains HTML tags (from formatting or contentEditable), 
    // convert \n to <br> within the HTML
    if (content.includes('<') && content.includes('>')) {
      // Replace \n with <br> but preserve existing HTML structure
      return content.replace(/\n/g, '<br>')
    }
    // Otherwise, escape HTML and convert \n to <br>
    return content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>')
  }

  // Check if subtitle has actual text content (strips HTML tags)
  const hasSubtitleContent = () => {
    if (!slide.subtitle) return false
    // Strip HTML tags and check if there's actual text
    const textOnly = slide.subtitle.replace(/<[^>]*>/g, '').trim()
    return textOnly.length > 0
  }

  const handleContentChange = (e) => {
    if (!onUpdate || isPlayMode) return
    isEditingContentRef.current = false
    const newContent = e.target.innerHTML
    onUpdate({ content: newContent })
  }

  const handleContentFocus = (e) => {
    isEditingContentRef.current = true
  }

  const handleSubtitleChange = (e) => {
    if (!onUpdate || isPlayMode) return
    isEditingSubtitleRef.current = false
    const newSubtitle = e.target.innerHTML
    onUpdate({ subtitle: newSubtitle })
  }

  const handleSubtitleFocus = (e) => {
    isEditingSubtitleRef.current = true
  }

  // Update contentEditable elements only when not being edited
  useEffect(() => {
    if (!isEditingContentRef.current && contentRef.current && slide.content !== undefined) {
      const formattedContent = formatContentForDisplay(slide.content)
      // Only update if content actually changed (avoid unnecessary updates)
      if (contentRef.current.innerHTML !== formattedContent) {
        const selection = window.getSelection()
        const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null
        const wasFocused = document.activeElement === contentRef.current
        
        contentRef.current.innerHTML = formattedContent
        
        // Restore focus and selection if it was focused
        if (wasFocused && range) {
          try {
            contentRef.current.focus()
            selection.removeAllRanges()
            selection.addRange(range)
          } catch (e) {
            // Ignore selection errors
          }
        }
      }
    }
  }, [slide.content])

  useEffect(() => {
    if (!isEditingSubtitleRef.current && subtitleRef.current && slide.subtitle !== undefined) {
      const formattedSubtitle = formatContentForDisplay(slide.subtitle)
      if (subtitleRef.current.innerHTML !== formattedSubtitle) {
        subtitleRef.current.innerHTML = formattedSubtitle
      }
    }
  }, [slide.subtitle])

  const handleBulletChange = (index, e) => {
    if (!onUpdate || isPlayMode) return
    const bullets = getBulletPoints()
    bullets[index] = e.target.innerHTML
    const newContent = bullets.join('\n')
    onUpdate({ content: newContent })
  }

  const renderContent = () => {
    const textHeadingLevel = slide.textHeadingLevel || null
    const subtitleHeadingLevel = slide.subtitleHeadingLevel || null
    
    // Get heading size and font based on heading level
    const getHeadingSize = (level) => {
      if (level === 'h1') return h1Size
      if (level === 'h2') return h2Size
      if (level === 'h3') return h3Size
      return null
    }
    
    const getHeadingFont = (level) => {
      if (level === 'h1') return h1FontFamily || fontFamily
      if (level === 'h2') return h2FontFamily || fontFamily
      if (level === 'h3') return h3FontFamily || fontFamily
      return fontFamily
    }
    
    const textStyle = {
      textShadow: textDropShadow 
        ? `${shadowOffsetX}px ${shadowOffsetY}px ${shadowBlur}px ${shadowColor}` 
        : undefined,
      backgroundColor: textInlineBackground 
        ? `rgba(${hexToRgb(inlineBgColor).r}, ${hexToRgb(inlineBgColor).g}, ${hexToRgb(inlineBgColor).b}, ${inlineBgOpacity})` 
        : 'transparent',
      padding: textInlineBackground ? `${inlineBgPadding}px` : '0',
      display: textInlineBackground ? 'inline-block' : 'block',
      borderRadius: textInlineBackground ? '4px' : '0',
      fontSize: textHeadingLevel ? `${getHeadingSize(textHeadingLevel)}rem` : undefined,
      fontFamily: textHeadingLevel ? `"${getHeadingFont(textHeadingLevel)}", sans-serif` : undefined
    }
    
    const subtitleStyle = {
      ...textStyle,
      fontSize: subtitleHeadingLevel ? `${getHeadingSize(subtitleHeadingLevel)}rem` : undefined,
      fontFamily: subtitleHeadingLevel ? `"${getHeadingFont(subtitleHeadingLevel)}", sans-serif` : undefined
    }

    const isEditable = !isPlayMode && onUpdate

    if (layout === 'bulletpoints') {
      const bullets = getBulletPoints()
      return (
        <div className="slide-bullets" style={textStyle}>
          {bullets.map((bullet, index) => (
            <div
              key={index}
              className={`slide-bullet ${isPlayMode && visibleBulletIndex !== null ? (index <= visibleBulletIndex ? 'visible' : 'hidden') : 'visible'}`}
            >
              <span className="bullet-marker">•</span>
              <span 
                className="bullet-text"
                contentEditable={isEditable}
                suppressContentEditableWarning={true}
                onBlur={(e) => handleBulletChange(index, e)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    e.target.blur()
                  }
                }}
                dangerouslySetInnerHTML={{ __html: bullet }}
              />
            </div>
          ))}
        </div>
      )
    }

    if (layout === 'section') {
      return (
        <div className="slide-section-text">
          <div 
            ref={contentRef}
            className={`slide-section-name ${textHeadingLevel ? `text-heading-${textHeadingLevel}` : ''}`}
            style={textStyle}
            contentEditable={isEditable}
            suppressContentEditableWarning={true}
            onBlur={handleContentChange}
            onFocus={handleContentFocus}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                e.stopPropagation()
                document.execCommand('insertLineBreak')
                // Keep focus on the element
                setTimeout(() => {
                  if (contentRef.current) {
                    contentRef.current.focus()
                  }
                }, 0)
              }
            }}
            dangerouslySetInnerHTML={{ __html: formatContentForDisplay(slide.content) }}
          />
        </div>
      )
    }

    if (layout === 'centered') {
      const subtitleHasContent = hasSubtitleContent()
      
      return (
        <div className="slide-text-centered-wrapper">
          <div 
            ref={contentRef}
            className={`slide-text centered ${textHeadingLevel ? `text-heading-${textHeadingLevel}` : ''}`}
            style={textStyle}
            contentEditable={isEditable}
            suppressContentEditableWarning={true}
            onBlur={handleContentChange}
            onFocus={handleContentFocus}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                e.stopPropagation()
                document.execCommand('insertLineBreak')
                // Keep focus on the element
                setTimeout(() => {
                  if (contentRef.current) {
                    contentRef.current.focus()
                  }
                }, 0)
              }
            }}
            dangerouslySetInnerHTML={{ __html: formatContentForDisplay(slide.content) }}
          />
          {subtitleHasContent ? (
            <div 
              ref={subtitleRef}
              className={`slide-subtitle ${subtitleHeadingLevel ? `text-heading-${subtitleHeadingLevel}` : ''}`}
              style={subtitleStyle}
              contentEditable={isEditable}
              suppressContentEditableWarning={true}
              onBlur={handleSubtitleChange}
              onFocus={handleSubtitleFocus}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  e.stopPropagation()
                  document.execCommand('insertLineBreak')
                  // Keep focus on the element
                  setTimeout(() => {
                    if (subtitleRef.current) {
                      subtitleRef.current.focus()
                    }
                  }, 0)
                }
              }}
              dangerouslySetInnerHTML={{ __html: formatContentForDisplay(slide.subtitle) }}
            />
          ) : isEditable ? (
            <div 
              className="slide-subtitle slide-subtitle-placeholder"
              style={textStyle}
              contentEditable={true}
              suppressContentEditableWarning={true}
              onBlur={(e) => {
                const text = e.target.textContent || e.target.innerText || ''
                // Only save if there's actual content (not just placeholder)
                if (text.trim() && text.trim() !== 'Subtitle (optional)') {
                  handleSubtitleChange(e)
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  e.stopPropagation()
                  document.execCommand('insertLineBreak')
                  // Keep focus on the element
                  setTimeout(() => {
                    if (e.target) {
                      e.target.focus()
                    }
                  }, 0)
                }
              }}
              data-placeholder="Subtitle (optional)"
              onFocus={(e) => {
                if (e.target.textContent === 'Subtitle (optional)') {
                  e.target.textContent = ''
                }
              }}
            />
          ) : null}
        </div>
      )
    }

    return (
      <div 
        ref={contentRef}
        className={`slide-text ${layout === 'centered' ? 'centered' : ''} ${textHeadingLevel ? `text-heading-${textHeadingLevel}` : ''}`}
        style={textStyle}
        contentEditable={isEditable}
        suppressContentEditableWarning={true}
        onBlur={handleContentChange}
        onFocus={handleContentFocus}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            e.stopPropagation()
            document.execCommand('insertLineBreak')
            // Keep focus on the element
            setTimeout(() => {
              if (contentRef.current) {
                contentRef.current.focus()
              }
            }, 0)
          }
        }}
        dangerouslySetInnerHTML={{ __html: formatContentForDisplay(slide.content) }}
      />
    )
  }

  // Get font family for each heading (fallback to main fontFamily if not set)
  const getHeadingFont = (headingFont) => {
    return headingFont || fontFamily
  }

  // Handle image dragging
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ mouseX: 0, mouseY: 0, imageX: 0, imageY: 0 })
  const [currentPosition, setCurrentPosition] = useState({ x: imagePositionX, y: imagePositionY })
  const slideRef = useRef(null)

  // Update current position when imagePositionX/Y changes from outside
  useEffect(() => {
    if (!isDragging) {
      setCurrentPosition({ x: imagePositionX, y: imagePositionY })
    }
  }, [imagePositionX, imagePositionY, isDragging])

  // Set base font-size as percentage of slide width for consistent scaling
  useEffect(() => {
    const updateFontSize = () => {
      if (slideRef.current) {
        const slideWidth = slideRef.current.offsetWidth
        // At 1200px width (max-width in preview), we want 16px base font-size
        // Calculate font-size that scales proportionally: (width / 1200) * 16
        // This ensures the same relative size regardless of actual slide dimensions
        if (slideWidth > 0) {
          const baseFontSize = (slideWidth / 1200) * 16
          slideRef.current.style.setProperty('--slide-base-font-size', `${baseFontSize}px`)
        }
      }
    }
    
    // Initial update with a small delay to ensure DOM is ready
    const timeoutId = setTimeout(() => {
      updateFontSize()
    }, 0)
    
    // Update on resize (handles both preview and present mode resizing)
    const resizeObserver = new ResizeObserver(() => {
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(updateFontSize)
    })
    
    if (slideRef.current) {
      resizeObserver.observe(slideRef.current)
    }
    
    // Also listen to window resize for present mode fullscreen changes
    const handleResize = () => {
      requestAnimationFrame(updateFontSize)
    }
    window.addEventListener('resize', handleResize)
    
    // Update when entering/exiting fullscreen (for present mode)
    const handleFullscreenChange = () => {
      setTimeout(() => {
        requestAnimationFrame(updateFontSize)
      }, 100)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    
    return () => {
      clearTimeout(timeoutId)
      resizeObserver.disconnect()
      window.removeEventListener('resize', handleResize)
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [isPlayMode]) // Re-run when play mode changes

  const handleImageMouseDown = (e) => {
    if (!onUpdate || isPlayMode || !slide.imageUrl) return
    // Only start dragging if clicking directly on the background, not on text content
    if (e.target.closest('.slide-content')) return
    e.preventDefault()
    e.stopPropagation()
    const rect = slideRef.current?.getBoundingClientRect()
    if (rect) {
      const mouseX = e.clientX
      const mouseY = e.clientY
      setIsDragging(true)
      setDragStart({ 
        mouseX, 
        mouseY, 
        imageX: imagePositionX, 
        imageY: imagePositionY 
      })
      setCurrentPosition({ x: imagePositionX, y: imagePositionY })
    }
  }

  const handleImageMouseMove = useCallback((e) => {
    if (!isDragging || !onUpdate || isPlayMode || !slide.imageUrl) return
    e.preventDefault()
    const rect = slideRef.current?.getBoundingClientRect()
    if (rect) {
      // Calculate delta in percentage, but invert to match mouse movement direction
      const deltaX = ((e.clientX - dragStart.mouseX) / rect.width) * 100
      const deltaY = ((e.clientY - dragStart.mouseY) / rect.height) * 100
      
      // Invert the direction so image follows mouse movement
      const newX = Math.max(0, Math.min(100, dragStart.imageX - deltaX))
      const newY = Math.max(0, Math.min(100, dragStart.imageY - deltaY))
      
      setCurrentPosition({ x: newX, y: newY })
    }
  }, [isDragging, dragStart, onUpdate, isPlayMode, slide.imageUrl])

  const handleImageMouseUp = useCallback(() => {
    if (isDragging && onUpdate && !isPlayMode && slide.imageUrl) {
      // Save the final position when releasing
      onUpdate({ 
        imagePositionX: currentPosition.x, 
        imagePositionY: currentPosition.y 
      })
    }
    setIsDragging(false)
  }, [isDragging, currentPosition, onUpdate, isPlayMode, slide.imageUrl])

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleImageMouseMove)
      window.addEventListener('mouseup', handleImageMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleImageMouseMove)
        window.removeEventListener('mouseup', handleImageMouseUp)
      }
    }
  }, [isDragging, handleImageMouseMove, handleImageMouseUp])

  return (
    <div 
      className="slide" 
      ref={slideRef} 
      style={{ backgroundColor: backgroundColor }}
      onMouseDown={(!isPlayMode && onUpdate && slide.imageUrl) ? handleImageMouseDown : undefined}
    >
      <style>{`
        .slide-content h1 {
          font-size: ${h1Size}rem !important;
          font-family: "${getHeadingFont(h1FontFamily)}", sans-serif !important;
        }
        .slide-content h2 {
          font-size: ${h2Size}rem !important;
          font-family: "${getHeadingFont(h2FontFamily)}", sans-serif !important;
        }
        .slide-content h3 {
          font-size: ${h3Size}rem !important;
          font-family: "${getHeadingFont(h3FontFamily)}", sans-serif !important;
        }
        .slide-subtitle h1 {
          font-size: ${h1Size * 0.5}rem !important;
          font-family: "${getHeadingFont(h1FontFamily)}", sans-serif !important;
        }
        .slide-subtitle h2 {
          font-size: ${h2Size * 0.5}rem !important;
          font-family: "${getHeadingFont(h2FontFamily)}", sans-serif !important;
        }
        .slide-subtitle h3 {
          font-size: ${h3Size * 0.5}rem !important;
          font-family: "${getHeadingFont(h3FontFamily)}", sans-serif !important;
        }
        .bullet-text h1 {
          font-size: ${h1Size * 0.6}rem !important;
          font-family: "${getHeadingFont(h1FontFamily)}", sans-serif !important;
        }
        .bullet-text h2 {
          font-size: ${h2Size * 0.6}rem !important;
          font-family: "${getHeadingFont(h2FontFamily)}", sans-serif !important;
        }
        .bullet-text h3 {
          font-size: ${h3Size * 0.6}rem !important;
          font-family: "${getHeadingFont(h3FontFamily)}", sans-serif !important;
        }
      `}</style>
      {slide.imageUrl && layout !== 'section' && (
        <div
          className={`slide-background ${(!isPlayMode && onUpdate) ? 'editable' : ''}`}
          style={{ 
            backgroundImage: `url(${slide.imageUrl})`,
            backgroundSize: `${imageScale * 100}%`,
            backgroundPosition: `${currentPosition.x}% ${currentPosition.y}%`,
            opacity: backgroundOpacity,
            transform: slide.flipHorizontal ? 'scaleX(-1)' : 'none',
            cursor: (!isPlayMode && onUpdate) ? 'move' : 'default',
            pointerEvents: (!isPlayMode && onUpdate) ? 'auto' : 'none'
          }}
        />
      )}
      {layout !== 'centered' && layout !== 'section' && (
        <div 
          className="slide-gradient-overlay"
          style={{
            background: gradientFlipped
              ? `linear-gradient(to right, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${maxOpacity}) 0%, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${midOpacity}) 30%, transparent 100%)`
              : `linear-gradient(to left, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${maxOpacity}) 0%, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${midOpacity}) 30%, transparent 100%)`,
            pointerEvents: (!isPlayMode && onUpdate && slide.imageUrl) ? 'none' : 'auto'
          }}
        />
      )}
      <div 
        className={`slide-content ${layout === 'centered' ? 'centered' : ''} ${layout === 'section' ? 'section' : ''} ${layout === 'bulletpoints' ? 'bulletpoints' : ''}`}
        style={{ 
          color: textColor,
          fontFamily: `"${fontFamily}", sans-serif`,
          pointerEvents: (!isPlayMode && onUpdate) ? 'none' : 'auto'
        }}
      >
        {renderContent()}
      </div>
    </div>
  )
}

export default Slide
