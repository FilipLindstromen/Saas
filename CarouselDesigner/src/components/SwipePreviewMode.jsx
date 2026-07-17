import { useCallback, useEffect, useMemo, useState } from 'react'
import Slide from './Slide'
import SlideRoleBadge from './SlideRoleBadge'
import { CAROUSEL_FORMAT } from '../utils/slideFormats'
import './SwipePreviewMode.css'

export default function SwipePreviewMode({
  slides,
  settings,
  selectedSlideId,
  onSelectSlide,
}) {
  const contentSlides = useMemo(
    () => (slides || []).filter((s) => (s.layout || 'default') !== 'section'),
    [slides]
  )

  const initialIndex = Math.max(0, contentSlides.findIndex((s) => s.id === selectedSlideId))
  const [index, setIndex] = useState(initialIndex >= 0 ? initialIndex : 0)

  useEffect(() => {
    const idx = contentSlides.findIndex((s) => s.id === selectedSlideId)
    if (idx >= 0) setIndex(idx)
  }, [selectedSlideId, contentSlides])

  const slide = contentSlides[index]
  const slideProps = useMemo(() => ({
    backgroundColor: settings.backgroundColor,
    textColor: settings.textColor,
    fontFamily: settings.fontFamily,
    defaultTextSize: settings.defaultTextSize,
    h1Size: settings.h1Size,
    h2Size: settings.h2Size,
    h3Size: settings.h3Size,
    h1FontFamily: settings.h1FontFamily,
    h2FontFamily: settings.h2FontFamily,
    h3FontFamily: settings.h3FontFamily,
    textDropShadow: settings.textDropShadow,
    shadowBlur: settings.shadowBlur,
    shadowOffsetX: settings.shadowOffsetX,
    shadowOffsetY: settings.shadowOffsetY,
    shadowColor: settings.shadowColor,
    textOutline: settings.textOutline,
    outlineWidth: settings.outlineWidth,
    outlineColor: settings.outlineColor,
    textInlineBackground: settings.textInlineBackground,
    inlineBgColor: settings.inlineBgColor,
    inlineBgOpacity: settings.inlineBgOpacity,
    inlineBgPadding: settings.inlineBgPadding,
    lineHeight: settings.lineHeight ?? 1,
    bulletLineHeight: settings.bulletLineHeight ?? 1,
    bulletTextSize: settings.bulletTextSize ?? 3,
    bulletGap: settings.bulletGap ?? 0.5,
    bulletStyle: settings.bulletStyle || 'dot',
    contentBottomOffset: settings.contentBottomOffset ?? 12,
    contentEdgeOffset: settings.contentEdgeOffset ?? 9,
    contentVerticalAlign: settings.contentVerticalAlign ?? 'bottom',
    showBullets: settings.showBullets !== false,
    defaultFontWeight: settings.defaultFontWeight ?? 700,
    h1Weight: settings.h1Weight ?? 700,
    h2Weight: settings.h2Weight ?? 700,
    h3Weight: settings.h3Weight ?? 700,
    h1LineHeight: settings.h1LineHeight ?? 1.2,
    h2LineHeight: settings.h2LineHeight ?? 1.2,
    h3LineHeight: settings.h3LineHeight ?? 1.2,
    textStyleMode: settings.textStyleMode || 'standard',
    fontPairingSerifFont: settings.fontPairingSerifFont || 'Playfair Display',
    backgroundScaleAnimation: false,
    webcamEnabled: false,
    previewTextAnimation: false,
    textAnimation: 'none',
  }), [settings])

  const go = useCallback((delta) => {
    setIndex((i) => Math.max(0, Math.min(contentSlides.length - 1, i + delta)))
  }, [contentSlides.length])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); go(1) }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); go(-1) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go])

  useEffect(() => {
    if (slide && onSelectSlide) onSelectSlide(slide.id)
  }, [slide, onSelectSlide])

  if (!contentSlides.length) {
    return (
      <div className="swipe-preview-empty">
        <p>No slides to preview. Add slides in Plan or Concept first.</p>
      </div>
    )
  }

  return (
    <div className="swipe-preview-mode">
      <div className="swipe-preview-header">
        <h2>Swipe preview</h2>
        <p>See your carousel as viewers will on mobile. Use arrow keys to swipe.</p>
      </div>

      <div className="swipe-preview-stage">
        <div className="swipe-preview-phone">
          <div className="swipe-preview-safe-top" aria-hidden />
          <div className="swipe-preview-slide-wrap">
            {slide && (
              <Slide slide={slide} {...slideProps} slideFormat={CAROUSEL_FORMAT} />
            )}
          </div>
          <div className="swipe-preview-safe-bottom" aria-hidden />
          <div className="swipe-preview-dots">
            {contentSlides.map((_, i) => (
              <button
                key={contentSlides[i].id}
                type="button"
                className={`swipe-dot ${i === index ? 'active' : ''}`}
                onClick={() => setIndex(i)}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>
        </div>

        <div className="swipe-preview-meta">
          <div className="swipe-preview-counter">
            {index + 1} / {contentSlides.length}
          </div>
          {slide?.role && <SlideRoleBadge role={slide.role} size="md" />}
          <div className="swipe-preview-nav">
            <button type="button" onClick={() => go(-1)} disabled={index === 0}>← Prev</button>
            <button type="button" onClick={() => go(1)} disabled={index >= contentSlides.length - 1}>Next →</button>
          </div>
          <div className="swipe-preview-thumbs">
            {contentSlides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                className={`swipe-thumb ${i === index ? 'active' : ''}`}
                onClick={() => setIndex(i)}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
