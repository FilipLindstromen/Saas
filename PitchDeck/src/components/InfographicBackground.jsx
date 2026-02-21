import React, { useState, useEffect, useRef } from 'react'
import './InfographicBackground.css'

// Arrow designs - must match InfoGraphics CanvasElement
const ARROW_DESIGNS = {
  simple: { d: 'M5 12h14M12 5l7 7-7 7', strokeWidth: 2, strokeDasharray: 'none' },
  thick: { d: 'M5 12h14M12 5l7 7-7 7', strokeWidth: 3, strokeDasharray: 'none' },
  thin: { d: 'M5 12h14M12 5l7 7-7 7', strokeWidth: 1, strokeDasharray: 'none' },
  chevron: { d: 'M9 6l6 6-6 6', strokeWidth: 2, strokeDasharray: 'none' },
  dashed: { d: 'M5 12h14M12 5l7 7-7 7', strokeWidth: 2, strokeDasharray: '4 2' },
  double: { d: 'M4 12h8M16 12h4M12 5l7 7-7 7', strokeWidth: 2, strokeDasharray: 'none' },
  circle: { d: 'M12 8v8M8 12h8', strokeWidth: 2, strokeDasharray: 'none', circle: true },
  filled: { d: 'M5 12h14l-7-7v14z', strokeWidth: 1, strokeDasharray: 'none', fill: true },
  'hand-outline-3d': { d: 'M6 8h10l-5 8 5 8H6l4-8z', strokeWidth: 2.5, strokeDasharray: 'none', outlineOnly: true, paths: [{ d: 'M7 10h10l-5 8 5 8H7l4-8z', fill: true }] },
  'hand-curved-thick': { d: 'M6 12Q12 6 18 12M15 9l3 3-3 3', strokeWidth: 2.5, strokeDasharray: 'none' },
  'hand-chevrons-stack': { d: 'M12 6l4 6-4 6M12 10l4 6-4 6M12 14l4 6-4 6', strokeWidth: 1.5, strokeDasharray: 'none' },
  'hand-wavy': { d: 'M5 12Q7 10 9 12Q11 14 13 12Q15 10 17 12Q19 14 19 12', strokeWidth: 1.5, strokeDasharray: 'none' },
  'hand-pointing': { d: 'M11 4l1 2v12l-2 2-2-2V6l1-2z', strokeWidth: 1.5, strokeDasharray: 'none', fill: true, paths: [{ d: 'M10 3l2 1M12 3l-1 2M10 5l1 0.5M12 5l-1 0.5', strokeDasharray: '1 1' }] },
  'hand-block-3d': { d: 'M6 9h10l-5 6 5 6H6l4-6z', strokeWidth: 2, strokeDasharray: 'none', fill: true, paths: [{ d: 'M16 15l2 2M16 9l2-2', strokeDasharray: 'none' }] },
  'hand-swoosh': { d: 'M5 12Q8 8 14 10Q18 12 19 12M17 10l2 2-2 2', strokeWidth: 2, strokeDasharray: 'none', fill: true, paths: [{ d: 'M7 14Q8 12 10 13M9 16Q10 14 12 15M11 18Q12 16 14 17', strokeDasharray: 'none' }] }
}

const ANIMATION_DURATION = 0.5

function getCanvasSize(aspectRatio, resolution = 800) {
  const r = resolution || 800
  if (aspectRatio === '16:9') return { w: r, h: Math.round(r * 9 / 16) }
  if (aspectRatio === '9:16') return { w: Math.round(r * 9 / 16), h: r }
  if (aspectRatio === '1:1') return { w: r, h: r }
  return { w: r, h: Math.round(r * 9 / 16) }
}

function InfographicElement({ element, currentTime = 0 }) {
  const { type, x, y, width, height, rotation, text, imageUrl, fontSize, fontFamily, color, backgroundColor, arrowDirection, arrowStyle, imageTint, imageTintOpacity, animationIn, animationOut, gradientColor } = element

  const clipStart = element.clipStart ?? 0
  const clipEnd = element.clipEnd ?? 10
  const animIn = animationIn || 'none'
  const animOut = animationOut || 'none'
  const isInPhase = animIn !== 'none' && currentTime < clipStart + ANIMATION_DURATION
  const isOutPhase = animOut !== 'none' && currentTime >= clipEnd - ANIMATION_DURATION
  const animationClasses = [isInPhase && animIn !== 'none' && `animate-in-${animIn}`, isOutPhase && animOut !== 'none' && `animate-out-${animOut}`].filter(Boolean).join(' ')

  const renderContent = () => {
    if (type === 'image') {
      return imageUrl ? (
        <div className="infographic-element-image-wrap infographic-element-image-full">
          <div className="infographic-element-image-inner">
            <img src={imageUrl} alt="" className="infographic-element-image" />
            {imageTint && (
              <div
                className="infographic-element-image-tint-mask"
                style={{
                  backgroundColor: imageTint,
                  opacity: (imageTintOpacity ?? 100) / 100,
                  WebkitMaskImage: `url(${imageUrl})`,
                  maskImage: `url(${imageUrl})`,
                }}
              />
            )}
          </div>
        </div>
      ) : null
    }
    if (type === 'image-text') {
      return (
        <>
          {imageUrl && (
            <div className="infographic-element-image-wrap">
              <div className="infographic-element-image-inner">
                <img src={imageUrl} alt="" className="infographic-element-image" />
                {imageTint && (
                  <div
                    className="infographic-element-image-tint-mask"
                    style={{
                      backgroundColor: imageTint,
                      opacity: (imageTintOpacity ?? 100) / 100,
                      WebkitMaskImage: `url(${imageUrl})`,
                      maskImage: `url(${imageUrl})`,
                    }}
                  />
                )}
              </div>
            </div>
          )}
          <div className="infographic-element-text" style={{ fontSize, fontFamily, color }}>
            {text || 'Add text'}
          </div>
        </>
      )
    }
    if (type === 'headline') {
      return (
        <div className="infographic-element-text infographic-element-headline" style={{ fontSize, fontFamily, color }}>
          {text || 'Headline'}
        </div>
      )
    }
    if (type === 'arrow') {
      const dir = arrowDirection || 'right'
      const rot = { right: 0, down: 90, left: 180, up: 270 }[dir]
      const design = ARROW_DESIGNS[arrowStyle || 'simple'] || ARROW_DESIGNS.simple
      const pathProps = {
        stroke: 'currentColor',
        strokeWidth: design.strokeWidth || 2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        strokeDasharray: design.strokeDasharray !== 'none' ? design.strokeDasharray : undefined
      }
      return (
        <svg className="infographic-element-arrow" viewBox="0 0 24 24" style={{ transform: `rotate(${rot}deg)`, color: color || '#000000' }}>
          {design.circle && <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth={design.strokeWidth} fill="none" />}
          {design.paths?.map((p, i) => (
            <path
              key={i}
              d={p.d}
              fill={p.fill ? 'currentColor' : 'none'}
              stroke={p.stroke !== false ? 'currentColor' : 'none'}
              strokeWidth={p.strokeWidth ?? design.strokeWidth}
              strokeDasharray={p.strokeDasharray}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          <path
            d={design.d}
            fill={design.outlineOnly ? 'none' : design.fill ? 'currentColor' : 'none'}
            {...pathProps}
          />
        </svg>
      )
    }
    if (type === 'cta') {
      return (
        <div className="infographic-element-cta" style={{ fontSize, fontFamily, color, backgroundColor: backgroundColor || '#3b82f6' }}>
          {text || 'Click Here'}
        </div>
      )
    }
    if (type === 'gradient') {
      const gradColor = gradientColor || '#000000'
      return (
        <div
          className="infographic-element-gradient"
          style={{
            background: `linear-gradient(to bottom, ${gradColor} 0%, transparent 100%)`,
            width: '100%',
            height: '100%'
          }}
        />
      )
    }
    return null
  }

  const baseSize = type === 'image-text' ? { w: 180, h: 100 } : type === 'image' ? { w: 80, h: 80 } : type === 'headline' ? { w: 300, h: 60 } : type === 'cta' ? { w: 180, h: 48 } : type === 'gradient' ? { w: 400, h: 300 } : { w: 200, h: 120 }
  const pad = type === 'headline' ? 0 : 20
  const innerW = Math.max(20, width - pad)
  const innerH = Math.max(20, height - pad)
  const contentScale = (type === 'image-text' || type === 'image' || type === 'headline' || type === 'cta')
    ? Math.min(innerW / baseSize.w, innerH / baseSize.h)
    : 1

  const style = {
    left: x,
    top: y,
    width,
    height,
    transform: rotation ? `rotate(${rotation}deg)` : undefined,
  }

  const needsScale = (type === 'image-text' || type === 'image' || type === 'headline' || type === 'cta') && contentScale !== 1

  return (
    <div className={`infographic-element infographic-element-${type}`} style={style}>
      <div className={`infographic-element-animation-wrapper ${animationClasses}`}>
      <div className="infographic-element-inner">
        {needsScale ? (
          <div
            className="infographic-element-scale-wrapper"
            style={{
              width: baseSize.w,
              height: baseSize.h,
              transform: `scale(${contentScale})`,
              transformOrigin: 'center center'
            }}
          >
            {renderContent()}
          </div>
        ) : (
          renderContent()
        )}
      </div>
      </div>
    </div>
  )
}

/**
 * Renders an infographic project as a background layer.
 * Supports timeline animations (clipStart/clipEnd) - when isPlaying, advances time and shows elements accordingly.
 */
function InfographicBackground({ projectData, isPlaying = false, opacity = 1, imageScale = 1, imagePositionX = 50, imagePositionY = 50, flipHorizontal = false, className = '' }) {
  const [currentTime, setCurrentTime] = useState(0)
  const [scale, setScale] = useState(1)
  const containerRef = useRef(null)
  const rafRef = useRef(null)
  const startTimeRef = useRef(null)

  if (!projectData || !Array.isArray(projectData.elements)) {
    return null
  }

  const elements = projectData.elements
  const aspectRatio = projectData.aspectRatio || '16:9'
  const resolution = projectData.resolution || 800
  const backgroundColor = projectData.backgroundColor || '#ffffff'
  const timelineDuration = typeof projectData.timelineDuration === 'number' ? projectData.timelineDuration : 10

  const size = getCanvasSize(aspectRatio, resolution)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const updateScale = () => {
      if (!el) return
      const cw = el.clientWidth
      const ch = el.clientHeight
      if (cw && ch && size.w && size.h) {
        const s = Math.max(cw / size.w, ch / size.h) * imageScale
        setScale(s)
      }
    }
    updateScale()
    const ro = new ResizeObserver(updateScale)
    ro.observe(el)
    return () => ro.disconnect()
  }, [size.w, size.h, imageScale])

  const visibleElements = elements
    .filter(el => {
      if (el.visible === false) return false
      if (el.clipStart != null && el.clipEnd != null) {
        return currentTime >= el.clipStart && currentTime < el.clipEnd
      }
      return true
    })
    .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))

  useEffect(() => {
    if (!isPlaying) return
    startTimeRef.current = performance.now() - currentTime * 1000
    const tick = () => {
      const elapsed = (performance.now() - startTimeRef.current) / 1000
      let next = elapsed
      if (next >= timelineDuration) {
        next = next % timelineDuration
        startTimeRef.current = performance.now() - next * 1000
      }
      setCurrentTime(next)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [isPlaying, timelineDuration])

  return (
    <div
      ref={containerRef}
      className={`infographic-background ${className}`.trim()}
      style={{
        opacity,
        transform: flipHorizontal ? 'scaleX(-1)' : 'none',
      }}
    >
      <div
        className="infographic-background-canvas"
        style={{
          width: size.w,
          height: size.h,
          backgroundColor,
          transform: `translate(-50%, -50%) scale(${scale})`,
          transformOrigin: 'center center',
        }}
      >
        {visibleElements.map(el => (
          <InfographicElement key={el.id} element={el} currentTime={currentTime} />
        ))}
      </div>
    </div>
  )
}

export default InfographicBackground
