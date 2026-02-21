import { useCallback } from 'react'
import './CanvasElement.css'

export const ARROW_DESIGNS = {
  simple: { d: 'M5 12h14M12 5l7 7-7 7', strokeWidth: 2, strokeDasharray: 'none' },
  thick: { d: 'M5 12h14M12 5l7 7-7 7', strokeWidth: 3, strokeDasharray: 'none' },
  thin: { d: 'M5 12h14M12 5l7 7-7 7', strokeWidth: 1, strokeDasharray: 'none' },
  chevron: { d: 'M9 6l6 6-6 6', strokeWidth: 2, strokeDasharray: 'none' },
  dashed: { d: 'M5 12h14M12 5l7 7-7 7', strokeWidth: 2, strokeDasharray: '4 2' },
  double: { d: 'M4 12h8M16 12h4M12 5l7 7-7 7', strokeWidth: 2, strokeDasharray: 'none' },
  circle: { d: 'M12 8v8M8 12h8', strokeWidth: 2, strokeDasharray: 'none', circle: true },
  filled: { d: 'M5 12h14l-7-7v14z', strokeWidth: 1, strokeDasharray: 'none', fill: true },
  // Hand-drawn styles (thick outline, 3D shadow, sketch aesthetic)
  'hand-outline-3d': {
    d: 'M6 8h10l-5 8 5 8H6l4-8z',
    strokeWidth: 2.5,
    strokeDasharray: 'none',
    outlineOnly: true,
    paths: [{ d: 'M7 10h10l-5 8 5 8H7l4-8z', fill: true }]
  },
  'hand-curved-thick': { d: 'M6 12Q12 6 18 12M15 9l3 3-3 3', strokeWidth: 2.5, strokeDasharray: 'none' },
  'hand-chevrons-stack': { d: 'M12 6l4 6-4 6M12 10l4 6-4 6M12 14l4 6-4 6', strokeWidth: 1.5, strokeDasharray: 'none' },
  'hand-wavy': { d: 'M5 12Q7 10 9 12Q11 14 13 12Q15 10 17 12Q19 14 19 12', strokeWidth: 1.5, strokeDasharray: 'none' },
  'hand-pointing': {
    d: 'M11 4l1 2v12l-2 2-2-2V6l1-2z',
    strokeWidth: 1.5,
    strokeDasharray: 'none',
    fill: true,
    paths: [{ d: 'M10 3l2 1M12 3l-1 2M10 5l1 0.5M12 5l-1 0.5', strokeDasharray: '1 1' }]
  },
  'hand-block-3d': {
    d: 'M6 9h10l-5 6 5 6H6l4-6z',
    strokeWidth: 2,
    strokeDasharray: 'none',
    fill: true,
    paths: [{ d: 'M16 15l2 2M16 9l2-2', strokeDasharray: 'none' }]
  },
  'hand-swoosh': {
    d: 'M5 12Q8 8 14 10Q18 12 19 12M17 10l2 2-2 2',
    strokeWidth: 2,
    strokeDasharray: 'none',
    fill: true,
    paths: [{ d: 'M7 14Q8 12 10 13M9 16Q10 14 12 15M11 18Q12 16 14 17', strokeDasharray: 'none' }]
  }
}

export default function CanvasElement({ element, isSelected, showResizeHandles = true, onPointerDown }) {
  const { type, x, y, width, height, rotation, text, imageUrl, fontSize, fontFamily, color, backgroundColor, arrowDirection, arrowStyle, imageTint, imageTintOpacity } = element

  const renderContent = () => {
    if (type === 'image') {
      return imageUrl ? (
        <div className="element-image-wrap element-image-full">
          <div className="element-image-inner">
            <img src={imageUrl} alt="" className="element-image" />
            {imageTint && (
              <div
                className="element-image-tint-mask"
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
      ) : (
        <div className="element-image-placeholder">Add image</div>
      )
    }
    if (type === 'image-text') {
      return (
        <>
          {imageUrl && (
            <div className="element-image-wrap">
              <div className="element-image-inner">
                <img src={imageUrl} alt="" className="element-image" />
                {imageTint && (
                  <div
                    className="element-image-tint-mask"
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
          <div className="element-text" style={{ fontSize, fontFamily, color }}>
            {text || 'Add text'}
          </div>
        </>
      )
    }
    if (type === 'headline') {
      return (
        <div className="element-text element-headline" style={{ fontSize, fontFamily, color }}>
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
        <svg className="element-arrow" viewBox="0 0 24 24" style={{ transform: `rotate(${rot}deg)`, color: color || '#000000' }}>
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
        <div className="element-cta" style={{ fontSize, fontFamily, color, backgroundColor: backgroundColor || '#3b82f6' }}>
          {text || 'Click Here'}
        </div>
      )
    }
    return null
  }

  const handlePointerDown = useCallback((e, handle) => {
    e.stopPropagation()
    onPointerDown(e, element.id, handle)
  }, [element.id, onPointerDown])

  const baseSize = type === 'image-text' ? { w: 180, h: 100 } : type === 'image' ? { w: 80, h: 80 } : type === 'headline' ? { w: 300, h: 60 } : type === 'cta' ? { w: 180, h: 48 } : { w: 200, h: 120 }
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
    // Elevate selected element so resize/rotate handles work when object is behind others
    ...(isSelected && showResizeHandles && { zIndex: 10000 })
  }

  const needsScale = (type === 'image-text' || type === 'image' || type === 'headline' || type === 'cta') && contentScale !== 1

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
      {isSelected && showResizeHandles && (
        <>
          {(type === 'image' || type === 'arrow') && (
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
