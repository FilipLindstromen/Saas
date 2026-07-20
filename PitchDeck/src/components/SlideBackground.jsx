import React, { useState, useEffect, useRef } from 'react'
import InfographicBackground from './InfographicBackground'
import { loadInfographicProjectData } from '../utils/infographicLoader'
import {
  getImageBackgroundSize,
  getBackgroundScaleAnimationVars,
  getVideoBackgroundStyle,
  getFrozenBackgroundScaleSize,
  isImageScaleCustomized,
  shouldAnimateBackgroundScale,
  KEN_BURNS_AMOUNT_PCT,
  KEN_BURNS_DURATION_S,
} from '../utils/backgroundFit'
import './Slide.css'

/**
 * Renders only the background (infographic, image or video) of a slide.
 * Used in PlayMode when consecutive slides share the same background - we keep this layer visible
 * and only fade the content to avoid redundant background fade in/out.
 */
function SlideBackground({ slide, kenBurns = false, backgroundKenBurnsDirection = 'zoom-in', frozenScaleProgress = null, isPreload = false, isPlayMode = false }) {
  const [backgroundVideoSrc, setBackgroundVideoSrc] = useState(null)
  const backgroundVideoRef = useRef(null)
  const backgroundVideoBlobUrlRef = useRef(null)

  const layout = slide?.layout === 'title' ? 'centered' : (slide?.layout || 'default')
  const backgroundOpacity = slide?.backgroundOpacity !== undefined ? slide.backgroundOpacity : 0.6
  const imageScale = slide?.imageScale !== undefined ? slide.imageScale : 1.0
  const imagePositionX = slide?.imagePositionX !== undefined ? slide.imagePositionX : 50
  const imagePositionY = slide?.imagePositionY !== undefined ? slide.imagePositionY : 50

  useEffect(() => {
    const url = slide?.backgroundVideoUrl
    if (!url || layout === 'section') {
      if (backgroundVideoBlobUrlRef.current) {
        URL.revokeObjectURL(backgroundVideoBlobUrlRef.current)
        backgroundVideoBlobUrlRef.current = null
      }
      setBackgroundVideoSrc(null)
      return
    }
    const isExternal = url.startsWith('http://') || url.startsWith('https://')
    if (!isExternal) {
      setBackgroundVideoSrc(url)
      return
    }
    let cancelled = false
    if (backgroundVideoBlobUrlRef.current) {
      URL.revokeObjectURL(backgroundVideoBlobUrlRef.current)
      backgroundVideoBlobUrlRef.current = null
    }
    fetch(url, { mode: 'cors', credentials: 'omit' })
      .then((res) => {
        if (!res.ok) throw new Error(res.statusText)
        return res.blob()
      })
      .then((blob) => {
        if (cancelled) return
        const blobUrl = URL.createObjectURL(blob)
        backgroundVideoBlobUrlRef.current = blobUrl
        setBackgroundVideoSrc(blobUrl)
      })
      .catch(() => {
        if (!cancelled) setBackgroundVideoSrc(null)
      })
    return () => {
      cancelled = true
      if (backgroundVideoBlobUrlRef.current) {
        URL.revokeObjectURL(backgroundVideoBlobUrlRef.current)
        backgroundVideoBlobUrlRef.current = null
      }
      setBackgroundVideoSrc(null)
    }
  }, [slide?.backgroundVideoUrl, layout])

  useEffect(() => {
    if (!slide?.backgroundVideoUrl || layout === 'section' || isPreload) return
    const el = backgroundVideoRef.current
    const play = () => {
      const video = backgroundVideoRef.current
      if (video && video.paused) video.play().catch(() => {})
    }
    if (el) {
      if (el.readyState >= 2) play()
      else {
        el.addEventListener('loadeddata', play, { once: true })
        el.addEventListener('canplay', play, { once: true })
      }
    }
    const t = setTimeout(play, 100)
    return () => {
      clearTimeout(t)
      if (el) {
        el.removeEventListener('loadeddata', play)
        el.removeEventListener('canplay', play)
      }
    }
  }, [slide?.backgroundVideoUrl, layout, backgroundVideoSrc, isPreload])

  if (!slide || layout === 'section') return null
  if (!slide.infographicProjectId && !slide.imageUrl && !slide.backgroundVideoUrl) return null

  const currentPosition = { x: imagePositionX, y: imagePositionY }
  const layoutClass = layout === 'left-video' ? 'layout-left-video' : layout === 'right-video' ? 'layout-right-video' : ''
  const kenBurnsActive = shouldAnimateBackgroundScale(slide, kenBurns)
  const freezeScale = frozenScaleProgress !== null && frozenScaleProgress !== undefined && kenBurnsActive
  const imageBackgroundSize = freezeScale
    ? getFrozenBackgroundScaleSize(slide, KEN_BURNS_AMOUNT_PCT, frozenScaleProgress)
    : getImageBackgroundSize(slide)

  if (slide.infographicProjectId) {
    const projectData = loadInfographicProjectData(slide.infographicProjectId, slide.infographicTabId)
    if (!projectData) return null
    return (
      <div className={`slide slide-background-standalone ${layoutClass}`} style={{ position: 'absolute', inset: 0, overflow: 'hidden', backgroundColor: 'transparent' }}>
        <InfographicBackground
          key={`infographic-${slide.infographicProjectId}-${slide.infographicTabId || ''}`}
          projectData={projectData}
          isPlaying={isPlayMode && !freezeScale}
          showAllElements={!isPlayMode}
          opacity={backgroundOpacity}
          imageScale={imageScale}
          imageScaleCustomized={isImageScaleCustomized(slide)}
          imagePositionX={imagePositionX}
          imagePositionY={imagePositionY}
          flipHorizontal={slide.flipHorizontal}
        />
      </div>
    )
  }

  return (
    <div className={`slide slide-background-standalone ${layoutClass}`} style={{ position: 'absolute', inset: 0, overflow: 'hidden', backgroundColor: 'transparent' }}>
      {slide.imageUrl && !slide.backgroundVideoUrl && (
        <div
          className={`slide-background ${kenBurnsActive && !freezeScale ? 'background-scale-animation' : ''}`}
          style={{
            backgroundImage: `url(${slide.imageUrl})`,
            backgroundSize: imageBackgroundSize,
            backgroundPosition: `${currentPosition.x}% ${currentPosition.y}%`,
            backgroundRepeat: 'no-repeat',
            opacity: backgroundOpacity,
            transform: slide.flipHorizontal ? 'scaleX(-1)' : 'none',
            ...(kenBurnsActive && !freezeScale ? {
              '--scale-duration': `${KEN_BURNS_DURATION_S}s`,
              ...getBackgroundScaleAnimationVars(slide, KEN_BURNS_AMOUNT_PCT, backgroundKenBurnsDirection),
            } : {})
          }}
        />
      )}
      {slide.backgroundVideoUrl && (() => {
        const raw = slide.backgroundVideoUrl
        const isExternal = raw.startsWith('http://') || raw.startsWith('https://')
        const videoSrc = isExternal ? (backgroundVideoSrc || raw) : raw
        return (
          <div className="slide-background slide-background-video" aria-hidden="true">
            <video
              ref={backgroundVideoRef}
              src={videoSrc}
              crossOrigin={isExternal ? 'anonymous' : undefined}
              autoPlay={!isPreload}
              loop
              muted
              playsInline
              preload="auto"
              className="slide-background-video-el"
              style={getVideoBackgroundStyle(
                slide,
                { x: currentPosition.x, y: currentPosition.y },
                slide.flipHorizontal
              )}
            />
          </div>
        )
      })()}
    </div>
  )
}

export default SlideBackground
