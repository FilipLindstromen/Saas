import { useCallback, useMemo, useRef, useEffect } from 'react'
import { ANIMATION_DURATION } from '../constants/animations'
import './CanvasElement.css'

const TEXT_TYPES = ['headline', 'cta', 'image-text']

export const ARROW_DESIGNS = {
  simple: { d: 'M5 12h14M12 5l7 7-7 7', strokeWidth: 2, strokeDasharray: 'none' },
  thick: { d: 'M5 12h14M12 5l7 7-7 7', strokeWidth: 3, strokeDasharray: 'none' },
  thin: { d: 'M5 12h14M12 5l7 7-7 7', strokeWidth: 1, strokeDasharray: 'none' },
  chevron: { d: 'M9 6l6 6-6 6', strokeWidth: 2, strokeDasharray: 'none' },
  dashed: { d: 'M5 12h14M12 5l7 7-7 7', strokeWidth: 2, strokeDasharray: '4 2' },
  double: { d: 'M4 12h8M16 12h4M12 5l7 7-7 7', strokeWidth: 2, strokeDasharray: 'none' },
  circle: { d: 'M12 8v8M8 12h8', strokeWidth: 2, strokeDasharray: 'none', circle: true },
  filled: { d: 'M5 12h14l-7-7v14z', strokeWidth: 1, strokeDasharray: 'none', fill: true },
  'hand-curved': {
    d: 'M6 6Q12 18 18 16',
    strokeWidth: 2.5,
    strokeDasharray: 'none',
    paths: [{ d: 'M17 13L21 16L17 19Z', fill: true, stroke: false }]
  },
  'hand-simple': {
    d: 'M5 12L12 12',
    strokeWidth: 2.5,
    strokeDasharray: 'none',
    paths: [{ d: 'M12 8L19 12L12 16Z', fill: true, stroke: 'currentColor', strokeWidth: 1 }]
  },
  outlined: {
    d: '',
    strokeWidth: 1.5,
    strokeDasharray: 'none',
    paths: [{
      d: 'M15 9L21 12L15 15L5 15A3 3 0 0 1 5 9L15 9Z',
      fill: '#ffffff',
      stroke: 'currentColor',
      strokeWidth: 1.5,
      strokeLinejoin: 'miter'
    }]
  }
}

export default function CanvasElement({ element, currentTime = 0, isSelected, showResizeHandles = true, onPointerDown, isEditingText = false, onStartEditText, onFinishEditText, onUpdate }) {
  const { type, x, y, width, height, rotation, text, imageUrl, fontSize, fontFamily, color, backgroundColor, arrowDirection, arrowStyle, imageTint, imageTintOpacity, imageFlipHorizontal, animationIn, animationOut, gradientColor, textAlign, fontWeight, fontStyle } = element
  const textEditRef = useRef(null)
  const isTextType = TEXT_TYPES.includes(type)

  useEffect(() => {
    if (isEditingText && textEditRef.current) {
      textEditRef.current.focus()
      textEditRef.current.select()
    }
  }, [isEditingText])

  const clipStart = element.clipStart ?? 0
  const clipEnd = element.clipEnd ?? 10
  const animIn = animationIn || 'none'
  const animOut = animationOut || 'none'
  const isInPhase = animIn !== 'none' && currentTime < clipStart + ANIMATION_DURATION
  const isOutPhase = animOut !== 'none' && currentTime >= clipEnd - ANIMATION_DURATION

  const animationClasses = useMemo(() => {
    const classes = []
    if (isInPhase && animIn !== 'none') classes.push(`animate-in-${animIn}`)
    if (isOutPhase && animOut !== 'none') classes.push(`animate-out-${animOut}`)
    return classes.join(' ')
  }, [isInPhase, isOutPhase, animIn, animOut])

  const animationDelay = useMemo(() => {
    if (isInPhase && animIn !== 'none') {
      const elapsed = Math.max(0, Math.min(ANIMATION_DURATION, currentTime - clipStart))
      return -elapsed
    }
    if (isOutPhase && animOut !== 'none') {
      const outStart = clipEnd - ANIMATION_DURATION
      const elapsed = Math.max(0, Math.min(ANIMATION_DURATION, currentTime - outStart))
      return -elapsed
    }
    return 0
  }, [isInPhase, isOutPhase, currentTime, clipStart, clipEnd, animIn, animOut])

  const textStyle = (type === 'image-text' || type === 'headline' || type === 'cta') ? {
    fontSize,
    fontFamily,
    color,
    textAlign: textAlign || 'center',
    fontWeight: fontWeight ?? (type === 'headline' ? 700 : 400),
    fontStyle: fontStyle || 'normal'
  } : {}

  const renderContent = () => {
    if (type === 'image') {
      const imgStyle = imageFlipHorizontal ? { transform: 'scaleX(-1)' } : undefined
      return imageUrl ? (
        <div className="element-image-wrap element-image-full">
          <div className="element-image-inner">
            <img src={imageUrl} alt="" className="element-image" style={imgStyle} />
            {imageTint && (
              <div
                className="element-image-tint-mask"
                style={{
                  backgroundColor: imageTint,
                  opacity: (imageTintOpacity ?? 100) / 100,
                  WebkitMaskImage: `url(${imageUrl})`,
                  maskImage: `url(${imageUrl})`,
                  ...(imageFlipHorizontal && { transform: 'scaleX(-1)' })
                }}
              />
            )}
          </div>
        </div>
      ) : (
        <div className="element-image-placeholder">Add image</div>
      )
    }
    if (type === 'image-text') {
      const imgStyle = imageFlipHorizontal ? { transform: 'scaleX(-1)' } : undefined
      return (
        <>
          {imageUrl && (
            <div className="element-image-wrap">
              <div className="element-image-inner">
                <img src={imageUrl} alt="" className="element-image" style={imgStyle} />
                {imageTint && (
                  <div
                    className="element-image-tint-mask"
                    style={{
                      backgroundColor: imageTint,
                      opacity: (imageTintOpacity ?? 100) / 100,
                      WebkitMaskImage: `url(${imageUrl})`,
                      maskImage: `url(${imageUrl})`,
                      ...(imageFlipHorizontal && { transform: 'scaleX(-1)' })
                    }}
                  />
                )}
              </div>
            </div>
          )}
          <div
            className="element-text element-text-multiline"
            style={textStyle}
            onDoubleClick={(e) => { e.stopPropagation(); isTextType && onStartEditText?.(element.id) }}
          >
            {isEditingText ? (
              <textarea
                ref={textEditRef}
                className="element-text-edit"
                value={text || ''}
                onChange={(e) => onUpdate?.(element.id, { text: e.target.value })}
                onBlur={(e) => onFinishEditText?.(element.id, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    onUpdate?.(element.id, { text: element.text })
                    e.target.blur()
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                style={textStyle}
              />
            ) : (
              (text || 'Add text').split('\n').map((line, i) => (
                <span key={i}>{line || '\u00A0'}{i < (text || '').split('\n').length - 1 ? <br /> : null}</span>
              ))
            )}
          </div>
        </>
      )
    }
    if (type === 'headline') {
      return (
        <div
          className="element-text element-headline element-text-multiline"
          style={textStyle}
          onDoubleClick={(e) => { e.stopPropagation(); isTextType && onStartEditText?.(element.id) }}
        >
          {isEditingText ? (
            <textarea
              ref={textEditRef}
              className="element-text-edit"
              value={text || ''}
              onChange={(e) => onUpdate?.(element.id, { text: e.target.value })}
              onBlur={(e) => onFinishEditText?.(element.id, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  onUpdate?.(element.id, { text: element.text })
                  e.target.blur()
                }
              }}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              style={textStyle}
            />
          ) : (
            (text || 'Headline').split('\n').map((line, i) => (
              <span key={i}>{line || '\u00A0'}{i < (text || 'Headline').split('\n').length - 1 ? <br /> : null}</span>
            ))
          )}
        </div>
      )
    }
    if (type === 'arrow') {
      if (imageUrl) {
        const imgStyle = imageFlipHorizontal ? { transform: 'scaleX(-1)' } : undefined
        return (
          <div className="element-image-wrap element-image-full">
            <div className="element-image-inner">
              <img src={imageUrl} alt="" className="element-image" style={imgStyle} />
              {imageTint && (
                <div
                  className="element-image-tint-mask"
                  style={{
                    backgroundColor: imageTint,
                    opacity: (imageTintOpacity ?? 100) / 100,
                    WebkitMaskImage: `url(${imageUrl})`,
                    maskImage: `url(${imageUrl})`,
                    ...(imageFlipHorizontal && { transform: 'scaleX(-1)' })
                  }}
                />
              )}
            </div>
          </div>
        )
      }
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
        <svg className="element-arrow" viewBox="0 0 24 24" style={{ transform: `rotate(${rot}deg)${imageFlipHorizontal ? ' scaleX(-1)' : ''}`, color: color || '#000000' }}>
          {design.circle && <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth={design.strokeWidth} fill="none" />}
          {design.paths?.map((p, i) => (
            <path
              key={i}
              d={p.d}
              fill={typeof p.fill === 'string' ? p.fill : p.fill ? 'currentColor' : 'none'}
              stroke={p.stroke !== false ? 'currentColor' : 'none'}
              strokeWidth={p.strokeWidth ?? design.strokeWidth}
              strokeDasharray={p.strokeDasharray}
              strokeLinecap="round"
              strokeLinejoin={p.strokeLinejoin || 'round'}
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
        <div
          className="element-cta element-text-multiline"
          style={{ ...textStyle, backgroundColor: backgroundColor || '#3b82f6' }}
          onDoubleClick={(e) => { e.stopPropagation(); isTextType && onStartEditText?.(element.id) }}
        >
          {isEditingText ? (
            <textarea
              ref={textEditRef}
              className="element-text-edit element-cta-edit"
              value={text || ''}
              onChange={(e) => onUpdate?.(element.id, { text: e.target.value })}
              onBlur={(e) => onFinishEditText?.(element.id, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  onUpdate?.(element.id, { text: element.text })
                  e.target.blur()
                }
              }}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              style={{ ...textStyle, backgroundColor: backgroundColor || '#3b82f6' }}
            />
          ) : (
            (text || 'Click Here').split('\n').map((line, i) => (
              <span key={i}>{line || '\u00A0'}{i < (text || 'Click Here').split('\n').length - 1 ? <br /> : null}</span>
            ))
          )}
        </div>
      )
    }
    if (type === 'gradient') {
      const color = gradientColor || '#000000'
      return (
        <div
          className="element-gradient"
          style={{
            background: `linear-gradient(to bottom, ${color} 0%, transparent 100%)`,
            width: '100%',
            height: '100%'
          }}
        />
      )
    }
    return null
  }

  const handlePointerDown = useCallback((e, handle) => {
    e.stopPropagation()
    onPointerDown(e, element.id, handle)
  }, [element.id, onPointerDown])

  const baseSize = type === 'image-text' ? { w: 180, h: 100 } : type === 'image' ? { w: 80, h: 80 } : type === 'headline' ? { w: 300, h: 60 } : type === 'cta' ? { w: 180, h: 48 } : type === 'gradient' ? { w: 400, h: 300 } : { w: 200, h: 120 }
  const pad = type === 'headline' ? 0 : 20
  const innerW = Math.max(20, width - pad)
  const innerH = Math.max(20, height - pad)
  const contentScale = type === 'image'
    ? Math.min(innerW / baseSize.w, innerH / baseSize.h)
    : 1

  const style = {
    left: x,
    top: y,
    width,
    height,
    transform: rotation ? `rotate(${rotation}deg)` : undefined,
    // Elevate selected element so resize/rotate handles work when object is behind others
    ...(isSelected && showResizeHandles && { zIndex: 10000 })
  }

  // Only scale images; text elements use fixed font size - box defines text area
  const needsScale = type === 'image' && contentScale !== 1

  // For rotated elements, keep resize handle at visual bottom-right corner
  const rot = (rotation || 0) * (Math.PI / 180)
  const cos = Math.cos(rot)
  const sin = Math.sin(rot)
  const corners = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height }
  ]
  const cornerScreen = corners.map(({ x, y }) => {
    const dx = x - width / 2
    const dy = y - height / 2
    return {
      x: dx * cos - dy * sin + width / 2,
      y: dx * sin + dy * cos + height / 2
    }
  })
  const brIdx = cornerScreen.reduce((best, p, i) =>
    (p.x + p.y) > (cornerScreen[best].x + cornerScreen[best].y) ? i : best
  , 0)
  const brCorner = corners[brIdx]
  const resizeHandleStyle = rot !== 0 ? {
    left: brCorner.x,
    top: brCorner.y,
    right: 'auto',
    bottom: 'auto',
    transform: `translate(-50%, -50%) rotate(${-rotation}deg)`
  } : undefined

  return (
    <div
      className={`canvas-element canvas-element-${type} ${isSelected ? 'selected' : ''}`}
      style={style}
      onPointerDown={(e) => handlePointerDown(e, 'move')}
    >
      <div
        className={`element-animation-wrapper ${animationClasses}`}
        style={animationDelay !== 0 ? { animationDelay: `${animationDelay}s` } : undefined}
      >
      <div className="element-inner">
        {needsScale ? (
          <div
            className="element-scale-wrapper"
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
      {isSelected && showResizeHandles && (
        <>
          {(type === 'image' || type === 'arrow' || type === 'gradient') && (
            <div
              className="rotate-handle"
              onPointerDown={(e) => handlePointerDown(e, 'rotate')}
              title="Rotate"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 11-9-9" />
                <path d="M21 3v6h-6" />
              </svg>
            </div>
          )}
          {(type === 'image' || type === 'arrow' || type === 'image-text') && (
            <div
              className="flip-handle"
              onPointerDown={(e) => handlePointerDown(e, 'flip')}
              title="Flip horizontally"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12h18" />
                <path d="M7 12l-4 4 4 4" />
                <path d="M17 12l4 4-4 4" />
              </svg>
            </div>
          )}
          <div
            className="resize-handle se"
            style={resizeHandleStyle}
            onPointerDown={(e) => handlePointerDown(e, 'se')}
          />
        </>
      )}
    </div>
  )
}
