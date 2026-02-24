import React, { useState, useEffect, useRef } from 'react'

const VIDEO_TRANSITION_MS = 500

/**
 * Get video container style for a given layout.
 * Returns { left, top, width, height, clipPath, borderRadius } in % or CSS values.
 */
function getVideoLayoutStyle(layout, canvasSize) {
  const w = canvasSize?.w ?? 1920
  const h = canvasSize?.h ?? 1080
  switch (layout) {
    case 'left-video':
      // Text on left 45%; video fills slide (fullscreen, text overlays)
      return { left: 0, top: 0, width: '100%', height: '100%', clipPath: 'none', borderRadius: 0 }
    case 'right-video':
      return { left: 0, top: 0, width: '100%', height: '100%', clipPath: 'none', borderRadius: 0 }
    case 'video':
    default:
      return { left: 0, top: 0, width: '100%', height: '100%', clipPath: 'none', borderRadius: 0 }
  }
}

/**
 * Persistent video layer: video stays mounted and visible across slides.
 * - Same format (layout) on consecutive slides: video persists, no change
 * - Different format: smooth transition of position, scale, masking
 * - Current slide has no video: slide video off to the right (camera stays on for fluid return)
 *
 * @param videoSlide - The slide whose video/image to show (when isSlidingOff, this is the slide we're leaving)
 * @param layout - Current target layout for positioning (video, left-video, right-video)
 * @param isSlidingOff - True when transitioning to a slide without video; animates video off to the right
 * @param isSlidingIn - True when transitioning from a slide without video; animates video in from the right
 */
function PersistentVideoLayer({ videoSlide, layout, isSlidingOff, isSlidingIn, canvasSize, recordSettings }) {
  const videoRef = useRef(null)
  const [backgroundVideoSrc, setBackgroundVideoSrc] = useState(null)
  const blobUrlRef = useRef(null)

  const effectiveLayout = layout || 'video'
  const hasVideo = !!(videoSlide?.backgroundVideoUrl || videoSlide?.imageUrl)
  const showVideo = hasVideo && !isSlidingOff
  const showSlidingOff = hasVideo && isSlidingOff
  const showSlidingIn = hasVideo && isSlidingIn

  const imageScale = videoSlide?.imageScale ?? 1
  const imagePositionX = videoSlide?.imagePositionX ?? 50
  const imagePositionY = videoSlide?.imagePositionY ?? 50

  // Resolve video/image URL (blob for cross-origin)
  useEffect(() => {
    const url = videoSlide?.backgroundVideoUrl || videoSlide?.imageUrl
    if (!url || (!showVideo && !showSlidingOff)) {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = null
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
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = null
    }
    fetch(url, { mode: 'cors', credentials: 'omit' })
      .then((res) => res.ok ? res.blob() : Promise.reject(new Error(res.statusText)))
      .then((blob) => {
        if (!cancelled) {
          const blobUrl = URL.createObjectURL(blob)
          blobUrlRef.current = blobUrl
          setBackgroundVideoSrc(blobUrl)
        }
      })
      .catch(() => !cancelled && setBackgroundVideoSrc(null))
    return () => {
      cancelled = true
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = null
      }
    }
  }, [videoSlide?.backgroundVideoUrl, videoSlide?.imageUrl, showVideo, showSlidingOff, showSlidingIn])

  // Play video when ready (showVideo or sliding off - keep playing during slide-off)
  useEffect(() => {
    if ((!showVideo && !showSlidingOff) || !videoRef.current || !backgroundVideoSrc) return
    const el = videoRef.current
    const play = () => el?.play?.().catch(() => {})
    if (el.readyState >= 2) play()
    else {
      el.addEventListener('loadeddata', play, { once: true })
      el.addEventListener('canplay', play, { once: true })
    }
    const t = setTimeout(play, 100)
    return () => {
      clearTimeout(t)
      el.removeEventListener('loadeddata', play)
      el.removeEventListener('canplay', play)
    }
  }, [showVideo, showSlidingOff, showSlidingIn, backgroundVideoSrc])

  if (!showVideo && !showSlidingOff && !showSlidingIn) return null

  const layoutStyle = getVideoLayoutStyle(effectiveLayout, canvasSize)
  const isVideo = !!videoSlide?.backgroundVideoUrl
  const mediaUrl = backgroundVideoSrc || videoSlide?.backgroundVideoUrl || videoSlide?.imageUrl

  if (!mediaUrl) return null

  const filterParts = []
  const b = typeof recordSettings?.videoBrightness === 'number' ? recordSettings.videoBrightness : 1
  const c = typeof recordSettings?.videoContrast === 'number' ? recordSettings.videoContrast : 1
  const s = typeof recordSettings?.videoSaturation === 'number' ? recordSettings.videoSaturation : 1
  if (b !== 1) filterParts.push(`brightness(${b})`)
  if (c !== 1) filterParts.push(`contrast(${c})`)
  if (s !== 1) filterParts.push(`saturate(${s})`)
  const filter = filterParts.length ? filterParts.join(' ') : 'none'

  return (
    <div
      className="play-persistent-video-layer"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 1,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      <div
        className="play-persistent-video-container"
        style={{
          position: 'absolute',
          ...layoutStyle,
          transform: isSlidingOff ? 'translateX(100%)' : 'translateX(0)',
          transition: isSlidingIn
            ? 'none'
            : `transform ${VIDEO_TRANSITION_MS}ms cubic-bezier(0.4, 0, 0.2, 1), left ${VIDEO_TRANSITION_MS}ms ease, top ${VIDEO_TRANSITION_MS}ms ease, width ${VIDEO_TRANSITION_MS}ms ease, height ${VIDEO_TRANSITION_MS}ms ease, clip-path ${VIDEO_TRANSITION_MS}ms ease`,
          animation: isSlidingIn ? `play-video-slide-in ${VIDEO_TRANSITION_MS}ms cubic-bezier(0.4, 0, 0.2, 1) forwards` : 'none',
          clipPath: layoutStyle.clipPath,
          borderRadius: layoutStyle.borderRadius,
        }}
      >
        {isVideo ? (
          <video
            ref={videoRef}
            src={mediaUrl}
            crossOrigin={mediaUrl?.startsWith?.('http') ? 'anonymous' : undefined}
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            className="play-persistent-video-el"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: `${imagePositionX}% ${imagePositionY}%`,
              transform: `${videoSlide?.flipHorizontal ? 'scaleX(-1) ' : ''}scale(${imageScale})`,
              transformOrigin: `${imagePositionX}% ${imagePositionY}%`,
              filter,
            }}
          />
        ) : (
          <div
            className="play-persistent-video-bg-image"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              backgroundImage: `url(${mediaUrl})`,
              backgroundSize: `${imageScale * 100}%`,
              backgroundPosition: `${imagePositionX}% ${imagePositionY}%`,
              backgroundRepeat: 'no-repeat',
              transform: videoSlide?.flipHorizontal ? 'scaleX(-1)' : 'none',
              filter,
            }}
          />
        )}
      </div>
    </div>
  )
}

export default PersistentVideoLayer
