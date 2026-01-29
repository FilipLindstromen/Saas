import './Slide.css'

function Slide({ slide, backgroundColor = '#1a1a1a', textColor = '#ffffff', fontFamily = 'Inter', isPlayMode = false, visibleBulletIndex = null, textDropShadow = false, shadowBlur = 4, shadowOffsetX = 2, shadowOffsetY = 2, shadowColor = '#000000', textInlineBackground = false, inlineBgColor = '#000000', inlineBgOpacity = 0.7, inlineBgPadding = 8 }) {
  if (!slide) return null

  const layout = slide.layout || 'default'
  const gradientStrength = slide.gradientStrength !== undefined ? slide.gradientStrength : 0.7
  const backgroundOpacity = slide.backgroundOpacity !== undefined ? slide.backgroundOpacity : 1.0
  const gradientFlipped = slide.gradientFlipped !== undefined ? slide.gradientFlipped : false

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

  const renderContent = () => {
    const textStyle = {
      textShadow: textDropShadow 
        ? `${shadowOffsetX}px ${shadowOffsetY}px ${shadowBlur}px ${shadowColor}` 
        : undefined,
      backgroundColor: textInlineBackground 
        ? `rgba(${hexToRgb(inlineBgColor).r}, ${hexToRgb(inlineBgColor).g}, ${hexToRgb(inlineBgColor).b}, ${inlineBgOpacity})` 
        : 'transparent',
      padding: textInlineBackground ? `${inlineBgPadding}px` : '0',
      display: textInlineBackground ? 'inline-block' : 'block',
      borderRadius: textInlineBackground ? '4px' : '0'
    }

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
                dangerouslySetInnerHTML={{ __html: bullet }}
              />
            </div>
          ))}
        </div>
      )
    }

    return (
      <div 
        className={`slide-text ${layout === 'centered' ? 'centered' : ''}`}
        style={textStyle}
        dangerouslySetInnerHTML={{ __html: slide.content }}
      />
    )
  }

  return (
    <div className="slide" style={{ backgroundColor: backgroundColor }}>
      {slide.imageUrl && (
        <div
          className="slide-background"
          style={{ 
            backgroundImage: `url(${slide.imageUrl})`,
            opacity: backgroundOpacity,
            transform: slide.flipHorizontal ? 'scaleX(-1)' : 'none'
          }}
        />
      )}
      {layout !== 'centered' && (
        <div 
          className="slide-gradient-overlay"
          style={{
            background: gradientFlipped
              ? `linear-gradient(to right, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${maxOpacity}) 0%, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${midOpacity}) 30%, transparent 100%)`
              : `linear-gradient(to left, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${maxOpacity}) 0%, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${midOpacity}) 30%, transparent 100%)`
          }}
        />
      )}
      <div 
        className={`slide-content ${layout === 'centered' ? 'centered' : ''}`}
        style={{ 
          color: textColor,
          fontFamily: `"${fontFamily}", sans-serif`
        }}
      >
        {renderContent()}
      </div>
    </div>
  )
}

export default Slide
